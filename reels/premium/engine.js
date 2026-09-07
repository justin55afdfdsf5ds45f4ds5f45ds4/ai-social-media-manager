/* =============================================================================
   engine.js — the whole film as ONE pure function:  drawFrame(ctx, tSeconds)

   READ THIS FIRST if you are another AI picking this up.

   What this is
   ------------
   A frame-exact clone of the reference reel's visual grammar (see
   reference_dissection.js for everything that was measured), driven by a new
   voice-over. Design space is 720x1280 @ 25 fps (same as the reference); it renders
   at any scale — render_seg.js uses SC=1.5 for 1080x1920.

   How it is organised
   -------------------
   1. CONFIG + MATH      palette C, easing, colour helpers, canvas factory
   2. PRIMITIVES         rr(), drawWord() (the caption reveal), wline() (a line of
                         mixed-size words sharing a baseline), glass objects, teal card
   3. OBJECTS            clock, "?" panels, play tile, hand cursor, timeline panel,
                         pill morph, video cards (PLACEHOLDER slot), perspective UI
                         screen, Instagram post (PLACEHOLDER slot), link card
   4. TYPED              the sentence typed into the UI screen, word + VO time
   5. CAMERA             camFromKeys(): hold -> eased move -> hold, exactly like the
                         reference (measured, not guessed)
   6. SCENES             one object per board: { name, a, keys, draw }
                           keys  = camera keyframes K(t, dur, x, y, z, rot, drift)
                           draw  = the board's content; every caption is
                                   W_(voTime, 'word', 'bold'|'light'|'script', px)
   7. TRANS              whip / cut / xfade / strobe between consecutive scenes
   8. COMPOSITING        background, grain, vignette, directional motion smear,
                         strobe flashes, fade bookends, drawFrame()

   To remake this film with a NEW voice-over
   -----------------------------------------
   a. transcribe the VO word-level (tools/transcribe.py from the video-editor skill)
   b. write the beat map: which VO beat uses which board type (reference_dissection.js §3)
   c. for each scene: place the lines with wline()/L()/W_() using the word onsets as t,
      then put ONE camera key at the start of each word cluster (move 0.6-0.9 s)
   d. put a whip between boards (d = direction, D = 800 horizontal / 1000 vertical),
      the strobe before the Instagram beat, fade bookends stay as they are
   e. set DUR to the VO length, then: ./drive.sh (repeat until ALLDONE) && ./build.sh

   To replace the placeholders
   ---------------------------
   drop assets/card1.png..card4.png (9:16) and assets/post.png (1:1) into assets/ —
   load_assets.js picks them up automatically. See PLACEHOLDER SLOTS below.

   Rules that keep it looking like the reference
   ---------------------------------------------
   - captions blur in over ~5 frames on the spoken beat and STAY on the board
   - the camera holds still while a cluster pops, then moves in one eased move
   - never crossfade a whip: both boards live in one world, the camera flies
   - one idea per board, mixed sizes on one baseline, script only for emphasis words
   ============================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PROMO = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 720, H = 1280, FPS = 25, DUR = 51.64;
  var S = 1;                                   // device scale, set per frame

  var C = {
    bgC: '#36463f', bgM: '#1c2621', bgE: '#070a09',
    bold: '#d8dcd7', light: '#b8bfb8', script: '#f1f4ef',
    teal: '#3a5b52', tealD: '#2b4640', panel: '#0f1412', line: 'rgba(255,255,255,0.14)'
  };

  /* ---------- math ---------- */
  function clamp(v, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function inv(t, a, b) { return clamp((t - a) / (b - a)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOut4(t) { return 1 - Math.pow(1 - t, 4); }
  function easeIn(t) { return t * t * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function hexa(h, a) { var n = parseInt(h.slice(1), 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function rng(seed) { var s = seed; return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

  var mk = (typeof document !== 'undefined')
    ? function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    : function (w, h) { return require('@napi-rs/canvas').createCanvas(w, h); };

  function setBlur(ctx, px) { try { ctx.filter = px > 0.4 ? 'blur(' + (px * S).toFixed(1) + 'px)' : 'none'; } catch (e) { } }

  /* ---------- primitives ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function fontFor(style, size) {
    if (style === 'bold') return 'bold ' + size + 'px Heros';
    if (style === 'light') return '400 ' + size + 'px Heros';
    if (style === 'script') return '700 ' + size + 'px Caveat';
    if (style === 'marker') return '400 ' + size + 'px Marker';
    return '400 ' + size + 'px Heros';
  }
  function colorFor(style) { return style === 'bold' ? C.bold : style === 'light' ? C.light : C.script; }

  /* kinetic word: blur-in + settle, stays on the board */
  function drawWord(ctx, t, w) {
    var d = w.dur || 0.24, p = inv(t, w.t - 0.04, w.t - 0.04 + d);
    if (p <= 0) return;
    var e = easeOut(p);
    ctx.save();
    // measured on the reference: ~5 frames, blur -> sharp, fade in, slight rise;
    // script words grow from ~0.85, bold words settle from ~1.12
    ctx.translate(w.x, w.y + (1 - e) * 10); if (w.rot) ctx.rotate(w.rot);
    var s = lerp(w.style === 'script' ? 0.85 : w.style === 'bold' ? 1.12 : 1.06, 1, e); ctx.scale(s, s);
    ctx.globalAlpha = (w.a === undefined ? 1 : w.a) * e;
    setBlur(ctx, (1 - e) * 16);
    ctx.font = fontFor(w.style, w.size);
    ctx.textAlign = w.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14 * S; ctx.shadowOffsetY = 5 * S;
    ctx.fillStyle = w.color || colorFor(w.style);
    ctx.fillText(w.txt, 0, 0);
    ctx.restore();
  }
  /* a line of mixed-size words sharing a baseline; each word reveals at its own time */
  function wline(ctx, t, L) {
    var ws = L.words, i, widths = [], total = 0;
    for (i = 0; i < ws.length; i++) {
      ctx.font = fontFor(ws[i].style, ws[i].size);
      widths[i] = ctx.measureText(ws[i].txt).width;
      total += widths[i] + (i < ws.length - 1 ? ws[i].size * 0.20 : 0);
    }
    var x = L.align === 'left' ? L.x : L.align === 'right' ? L.x - total : L.x - total / 2;
    for (i = 0; i < ws.length; i++) {
      var w = ws[i];
      drawWord(ctx, t, { t: w.t, x: x + widths[i] / 2, y: L.y + (w.dy || 0), txt: w.txt, style: w.style, size: w.size, color: w.color, rot: L.rot });
      x += widths[i] + w.size * 0.20;
    }
  }
  function W_(t, txt, style, size, dy) { return { t: t, txt: txt, style: style, size: size, dy: dy }; }

  /* dark matte glass object with rim light (the reference's icon objects) */
  function glassRect(ctx, x, y, w, h, r, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 14 * S;
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2a302d'); g.addColorStop(0.5, '#0f1311'); g.addColorStop(1, '#060807');
    rr(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    var rim = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    rim.addColorStop(0, 'rgba(255,255,255,0.35)'); rim.addColorStop(0.5, 'rgba(255,255,255,0.05)'); rim.addColorStop(1, 'rgba(255,255,255,0)');
    rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, r); ctx.strokeStyle = rim; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  function glassCircle(ctx, cx, cy, r, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 22 * S; ctx.shadowOffsetY = 10 * S;
    var g = ctx.createRadialGradient(cx - r * 0.5, cy - r * 0.6, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#30373a'); g.addColorStop(0.55, '#0f1312'); g.addColorStop(1, '#050706');
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, -Math.PI * 0.95, -Math.PI * 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }
  /* translucent teal card (behind the clock / the pills) */
  function tealCard(ctx, x, y, w, h, r, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    rr(ctx, x, y, w, h, r); ctx.fillStyle = hexa(C.teal, 0.55); ctx.fill();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  /* ---------- objects ---------- */
  function clock(ctx, cx, cy, r, hourA, minA, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    tealCard(ctx, cx - r * 1.15, cy - r * 1.15, r * 2.3, r * 2.3, 10, 1);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 10 * S;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#8e918c'; ctx.fill();
    ctx.shadowColor = 'transparent';
    var g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#dfe2dd'); g.addColorStop(1, '#b9bdb7');
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.93, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#202523'; ctx.font = '400 ' + (r * 0.24) + 'px Heros'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 1; i <= 12; i++) {
      var an = -Math.PI / 2 + i * Math.PI / 6;
      ctx.fillText(String(i), cx + Math.cos(an) * r * 0.74, cy + Math.sin(an) * r * 0.74);
    }
    ctx.strokeStyle = '#2b2f2d';
    for (i = 0; i < 60; i++) {
      var a2 = i * Math.PI / 30, r1 = i % 5 === 0 ? r * 0.86 : r * 0.89;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * r1, cy + Math.sin(a2) * r1); ctx.lineTo(cx + Math.cos(a2) * r * 0.9, cy + Math.sin(a2) * r * 0.9);
      ctx.lineWidth = i % 5 === 0 ? 2 : 1; ctx.stroke();
    }
    ctx.lineCap = 'round'; ctx.strokeStyle = '#1b1f1d';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(hourA) * r * 0.5, cy + Math.sin(hourA) * r * 0.5); ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(minA) * r * 0.78, cy + Math.sin(minA) * r * 0.78); ctx.lineWidth = 3.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#1b1f1d'; ctx.fill();
    ctx.restore();
  }

  function qpanel(ctx, x, y, w, h, a, variant, t) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24 * S; ctx.shadowOffsetY = 10 * S;
    rr(ctx, x, y, w, h, 6); ctx.fillStyle = '#0a0d0c'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rr(ctx, x, y, w, h, 6); ctx.clip();
    if (variant === 1) {
      var drift = Math.sin(t * 1.3) * 12;
      setBlur(ctx, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rr(ctx, x + w * 0.25 + drift, y + h * 0.36, w * 0.5, 9, 4); ctx.fill();
      rr(ctx, x + w * 0.35 - drift, y + h * 0.58, w * 0.45, 8, 4); ctx.fill();
      setBlur(ctx, 0);
    } else {
      var g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0.18)');
      rr(ctx, x + w * 0.22, y + h * 0.16, w * 0.56, h * 0.68, 4); ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
    ctx.font = 'bold ' + (h * 0.62) + 'px Heros'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(240,243,238,0.94)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8 * S;
    ctx.fillText('?', x + w / 2, y + h * 0.52);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6); ctx.stroke();
    ctx.restore();
  }

  function playObj(ctx, cx, cy, a) {
    glassRect(ctx, cx - 150, cy - 85, 300, 170, 16, a);
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2); ctx.fillStyle = 'rgba(210,215,209,0.92)'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 17); ctx.lineTo(cx + 18, cy); ctx.lineTo(cx - 10, cy + 17); ctx.closePath();
    ctx.fillStyle = '#0d1110'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, cx - 120, cy + 56, 240, 4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; rr(ctx, cx - 120, cy + 56, 90, 4, 2); ctx.fill();
    ctx.restore();
  }

  function handCursor(ctx, x, y, sc, press) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8 * S; ctx.shadowOffsetY = 3 * S;
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.2; ctx.strokeStyle = '#111';
    ctx.fillStyle = '#f2f4f0';
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(0, 6); ctx.lineTo(-7, 0); ctx.quadraticCurveTo(-14, -3, -12, 6);
    ctx.lineTo(-2, 20); ctx.quadraticCurveTo(2, 26, 12, 26); ctx.lineTo(22, 26); ctx.quadraticCurveTo(30, 24, 30, 14);
    ctx.lineTo(30, 4); ctx.quadraticCurveTo(30, -2, 24, -2); ctx.lineTo(24, -4); ctx.quadraticCurveTo(24, -9, 17, -9);
    ctx.lineTo(16, -8); ctx.quadraticCurveTo(16, -13, 9, -13); ctx.lineTo(8, -12); ctx.lineTo(8, -30);
    ctx.quadraticCurveTo(8, -36, 4, -36); ctx.quadraticCurveTo(0, -36, 0, -30); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function timelinePanel(ctx, x, y, w, h, a, tl, dragP) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 30 * S; ctx.shadowOffsetY = 14 * S;
    rr(ctx, x, y, w, h, 10); ctx.fillStyle = '#0e1311'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rr(ctx, x, y, w, h, 10); ctx.clip();
    // ruler
    ctx.fillStyle = '#121816'; ctx.fillRect(x, y, w, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '400 11px Heros'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 12; i++) {
      var tx = x + 16 + i * (w - 32) / 12;
      ctx.fillRect(tx, y + 20, 1, 8);
      if (i % 2 === 0) ctx.fillText('00:' + String(i * 5).padStart(2, '0'), tx + 3, y + 12);
    }
    // tracks
    var rows = [[44, 'V2'], [92, 'V1'], [140, 'A1'], [176, 'A2']];
    for (i = 0; i < rows.length; i++) {
      ctx.fillStyle = i % 2 ? '#101615' : '#0e1412'; ctx.fillRect(x, y + rows[i][0] - 6, w, i < 2 ? 44 : 32);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '400 11px Heros'; ctx.fillText(rows[i][1], x + 8, y + rows[i][0] + (i < 2 ? 16 : 10));
    }
    // clips
    function clip(cx, cy, cw, ch, col, label) {
      rr(ctx, cx, cy, cw, ch, 4); ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; rr(ctx, cx + 0.5, cy + 0.5, cw - 1, ch - 1, 4); ctx.stroke();
      if (label) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '400 11px Heros'; ctx.fillText(label, cx + 8, cy + 12); }
    }
    var x0 = x + 40;
    clip(x0, y + 44, 120, 32, '#2a3531', 'intro.mp4');
    clip(x0 + 300, y + 44, 90, 32, '#2a3531', 'b-roll');
    clip(x0, y + 92, 170, 32, C.tealD, 'talking_head_01');
    clip(x0 + 200, y + 92, 90, 32, '#2a3531', 'cut_04');
    // dragged clip: shuffles back and forth and never lands
    var dx = Math.sin(dragP * Math.PI * 2.2) * 90 + dragP * 60;
    var cxx = x0 + 330 + dx;
    ctx.save(); ctx.globalAlpha = 0.9; clip(cxx, y + 92 - 4, 110, 32, '#556a62', 'clip_07'); ctx.restore();
    // audio
    ctx.fillStyle = '#1e2825'; ctx.fillRect(x0, y + 140, w - 80, 22);
    var rnd = rng(7);
    ctx.fillStyle = 'rgba(160,200,185,0.55)';
    for (i = 0; i < 110; i++) { var hh = 4 + rnd() * 14; ctx.fillRect(x0 + 4 + i * ((w - 88) / 110), y + 151 - hh / 2, 2, hh); }
    ctx.fillStyle = '#1a2320'; ctx.fillRect(x0, y + 176, 220, 20);
    // playhead
    var px = x0 + 20 + (tl % 6) * 14;
    ctx.fillStyle = '#ff3425'; ctx.fillRect(px, y + 8, 1.5, h - 8);
    ctx.beginPath(); ctx.moveTo(px - 6, y + 8); ctx.lineTo(px + 7, y + 8); ctx.lineTo(px + 0.75, y + 18); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 10); ctx.stroke();
    handCursor(ctx, cxx + 60, y + 118, 0.7, false);
    ctx.restore();
  }

  /* three-word pill: teal circle with a number that expands into a pill and types its label */
  function pill(ctx, x, y, num, label, p, typedP) {
    if (p <= 0) return;
    var e = easeOut4(p);
    var r = 40, wmax = 96 + label.length * 26, wcur = lerp(r * 2, wmax, easeInOut(clamp((p - 0.35) / 0.55)));
    ctx.save();
    ctx.globalAlpha = clamp(p * 3);
    var s = lerp(0.6, 1, e); ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16 * S; ctx.shadowOffsetY = 6 * S;
    rr(ctx, -r, -r, wcur, r * 2, r); ctx.fillStyle = C.teal; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.bold; ctx.font = 'bold 40px Heros'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, 0, 2);
    if (typedP > 0) {
      ctx.save(); ctx.globalAlpha = easeOut(typedP);
      setBlur(ctx, (1 - typedP) * 10);
      ctx.font = '400 34px Heros'; ctx.textAlign = 'left'; ctx.fillStyle = C.light;
      ctx.fillText(label, r + 14, 2); ctx.restore();
    }
    ctx.restore();
  }

  /* ---------- PLACEHOLDER SLOTS ----------
     ASSETS.cards[0..3] : 9:16 stills for the four "finished video" cards (scene 6)
     ASSETS.post        : 1:1 still for the Instagram post media (scene 10)
     Pass loaded Image/Canvas objects via setAssets(). When a slot is null the
     procedural stand-in below is drawn instead. Nothing else needs to change. */
  var ASSETS = { cards: [null, null, null, null], post: null };
  function setAssets(a) { if (a.cards) ASSETS.cards = a.cards; if (a.post) ASSETS.post = a.post; }
  function coverImage(ctx, img, x, y, w, h) {      // object-fit: cover
    var s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /* finished-video cards, 9:16, procedurally drawn unless ASSETS.cards[i] is set */
  function videoCard(ctx, x, y, w, h, kind, t, a, slot) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    if (ASSETS.cards[slot]) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26 * S; ctx.shadowOffsetY = 12 * S;
      rr(ctx, x, y, w, h, 14); ctx.fillStyle = '#0b0e0d'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.save(); rr(ctx, x, y, w, h, 14); ctx.clip(); coverImage(ctx, ASSETS.cards[slot], x, y, w, h); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
      ctx.restore(); return;
    }
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26 * S; ctx.shadowOffsetY = 12 * S;
    rr(ctx, x, y, w, h, 14); ctx.fillStyle = '#0b0e0d'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rr(ctx, x, y, w, h, 14); ctx.clip();
    var g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#1b2320'); g.addColorStop(1, '#070908'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    var cx = x + w / 2, cy = y + h / 2, i;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (kind === 'captions') {
      var lines = ['SAY IT', 'LIKE A', 'FRIEND'];
      var active = Math.floor((t * 2.2) % 3);
      for (i = 0; i < 3; i++) {
        ctx.font = 'bold ' + (w * 0.22) + 'px Heros';
        ctx.fillStyle = i === active ? '#8fd6bf' : '#e8ebe6';
        ctx.fillText(lines[i], cx, cy - w * 0.28 + i * w * 0.27);
      }
    } else if (kind === 'motion') {
      var k = (t * 0.9) % 1;
      for (i = 0; i < 5; i++) {
        var yy = y + h * 0.12 + i * h * 0.13, ww = w * (0.35 + 0.5 * (0.5 + 0.5 * Math.sin(k * 6.28 + i)));
        rr(ctx, cx - ww / 2, yy, ww, h * 0.07, 6); ctx.fillStyle = i === 2 ? '#8fd6bf' : 'rgba(220,226,220,0.85)'; ctx.fill();
      }
      ctx.font = 'bold ' + (w * 0.2) + 'px Heros'; ctx.fillStyle = '#eef1ec'; ctx.fillText('STEP 2', cx, y + h * 0.86);
    } else if (kind === 'music') {
      var rnd = rng(3);
      for (i = 0; i < 26; i++) {
        var base = rnd(), hh = h * (0.08 + 0.32 * Math.abs(Math.sin(t * 5 + i * 0.7)) * base + 0.05);
        ctx.fillStyle = i % 4 === 0 ? '#8fd6bf' : 'rgba(220,226,220,0.8)';
        ctx.fillRect(x + w * 0.1 + i * (w * 0.8 / 26), cy - hh / 2, w * 0.8 / 26 * 0.55, hh);
      }
      ctx.font = '400 ' + (w * 0.11) + 'px Heros'; ctx.fillStyle = 'rgba(240,243,238,0.85)'; ctx.fillText('01:00  ·  music', cx, y + h * 0.88);
    } else {
      ctx.font = 'bold ' + (w * 0.42) + 'px Heros'; ctx.fillStyle = '#eef1ec'; ctx.fillText('3×', cx, cy - h * 0.06);
      ctx.font = '400 ' + (w * 0.12) + 'px Heros'; ctx.fillStyle = '#8fd6bf'; ctx.fillText('more replies', cx, cy + h * 0.13);
      for (i = 0; i < 4; i++) { var bh = h * (0.06 + i * 0.05); ctx.fillStyle = i === 3 ? '#8fd6bf' : 'rgba(220,226,220,0.4)'; ctx.fillRect(x + w * 0.22 + i * w * 0.15, y + h * 0.8 - bh, w * 0.1, bh); }
    }
    // progress bar
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 12, y + h - 10, w - 24, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 12, y + h - 10, (w - 24) * ((t * 0.15) % 1), 3);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; rr(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 14); ctx.stroke();
    ctx.restore();
  }

  /* --- END PART 1 --- */

  /* ---------- perspective panel (the reference's tilted UI screen) ---------- */
  var PANW = 1000, PANH = 760, panC = null, panB = [null, null];
  function promptPanelImage(t) {
    if (!panC) { panC = mk(PANW * S, PANH * S); panB[0] = mk(PANW * S, PANH * S); panB[1] = mk(PANW * S, PANH * S); }
    var c = panC.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.scale(S, S);
    c.clearRect(0, 0, PANW, PANH);
    var g = c.createLinearGradient(0, 0, PANW, PANH);
    g.addColorStop(0, '#12181600'); g.addColorStop(1, '#0a0e0c');
    c.fillStyle = '#0f1412'; c.fillRect(0, 0, PANW, PANH);
    c.fillStyle = '#131a17'; c.fillRect(0, 0, PANW, 56);
    ['#ff5f57', '#febc2e', '#28c840'].forEach(function (col, i) { c.beginPath(); c.arc(30 + i * 24, 28, 7, 0, 6.29); c.fillStyle = col; c.fill(); });
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.font = '400 20px Heros'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('new video', PANW / 2, 28);
    c.textAlign = 'left';
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.font = '400 26px Heros'; c.fillText('describe your video', 60, 118);
    rr(c, 60, 150, PANW - 120, 330, 18); c.fillStyle = '#171e1b'; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 1.5; rr(c, 60.75, 150.75, PANW - 121.5, 328.5, 18); c.stroke();
    // typed words, wrapped
    var words = TYPED, line = '', lines = [], i, maxW = PANW - 200;
    c.font = '400 36px Heros';
    var shown = [];
    for (i = 0; i < words.length; i++) if (t >= words[i].t) shown.push(words[i].w);
    for (i = 0; i < shown.length; i++) {
      var test = line ? line + ' ' + shown[i] : shown[i];
      if (c.measureText(test).width > maxW) { lines.push(line); line = shown[i]; } else line = test;
    }
    lines.push(line);
    c.fillStyle = '#e4e8e3';
    for (i = 0; i < lines.length; i++) c.fillText(lines[i], 100, 205 + i * 50);
    // caret
    if (shown.length > 0 && Math.floor(t * 3) % 2 === 0) {
      var lw = c.measureText(lines[lines.length - 1]).width;
      c.fillRect(104 + lw, 205 + (lines.length - 1) * 50 - 18, 3, 36);
    }
    // chips
    var chips = [['problem', 17.80], ['3 steps', 21.60], ['the number', 23.55]], cx = 60;
    for (i = 0; i < chips.length; i++) {
      c.font = '400 26px Heros';
      var cw = c.measureText(chips[i][0]).width + 64, on = t >= chips[i][1];
      var pp = inv(t, chips[i][1], chips[i][1] + 0.25);
      rr(c, cx, 520, cw, 56, 28); c.fillStyle = on ? C.teal : '#151b19'; c.fill();
      c.strokeStyle = on ? 'rgba(143,214,191,0.7)' : 'rgba(255,255,255,0.14)'; c.lineWidth = 1.5; rr(c, cx + 0.75, 520.75, cw - 1.5, 54.5, 28); c.stroke();
      c.fillStyle = on ? '#eef1ec' : 'rgba(255,255,255,0.45)';
      c.beginPath(); c.arc(cx + 28, 548, 6 + pp * 2, 0, 6.29); c.fill();
      c.fillText(chips[i][0], cx + 46, 549);
      cx += cw + 18;
    }
    // build button
    var bp = inv(t, 25.0, 25.4);
    rr(c, PANW - 300, 630, 240, 72, 36); c.fillStyle = bp > 0 ? '#dfe4de' : '#1a211e'; c.fill();
    c.fillStyle = bp > 0 ? '#0f1412' : 'rgba(255,255,255,0.5)'; c.font = 'bold 30px Heros'; c.textAlign = 'center';
    c.fillText('build', PANW - 180, 667);
    c.fillStyle = 'rgba(255,255,255,0.28)'; c.font = '400 22px Heros'; c.textAlign = 'left';
    c.fillText('problem  →  steps  →  proof', 60, 667);
    // blurred variants for depth of field
    for (i = 0; i < 2; i++) {
      var b = panB[i].getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, PANW * S, PANH * S);
      try { b.filter = 'blur(' + ((i ? 7 : 2.5) * S) + 'px)'; } catch (e) { }
      b.drawImage(panC, 0, 0); try { b.filter = 'none'; } catch (e) { }
    }
  }
  /* draw an image into a quad (tl,tr,br,bl) with vertical strips; depth[u] in 0..1 picks blur level */
  function drawQuad(ctx, imgs, q, strips, depthFn) {
    var n = strips, i, img0 = imgs[0], iw = img0.width, ih = img0.height;
    for (i = 0; i < n; i++) {
      var u0 = i / n, u1 = (i + 1) / n, um = (u0 + u1) / 2;
      var tx0 = lerp(q[0][0], q[1][0], u0), ty0 = lerp(q[0][1], q[1][1], u0);
      var tx1 = lerp(q[0][0], q[1][0], u1), ty1 = lerp(q[0][1], q[1][1], u1);
      var bx0 = lerp(q[3][0], q[2][0], u0), by0 = lerp(q[3][1], q[2][1], u0);
      var dw = tx1 - tx0, dh = by0 - ty0, shear = (ty1 - ty0) / dw;
      var d = depthFn(um), img = d < 0.4 ? imgs[0] : d < 0.7 ? imgs[1] : imgs[2];
      ctx.save();
      ctx.transform(dw / (iw / n), shear * dw / (iw / n), 0, dh / ih, tx0, ty0);
      ctx.drawImage(img, i * iw / n, 0, iw / n + 1, ih, 0, 0, iw / n + 1, ih);
      ctx.restore();
    }
  }

  /* ---------- Instagram post (closing scene) ---------- */
  function heart(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.2, y - s * 0.1, x - s * 0.6, y - s * 1.0, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.2, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
  }
  function bubble(ctx, x, y, s) {
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.moveTo(x - s * 0.55, y + s * 0.8); ctx.lineTo(x - s * 1.05, y + s * 1.25); ctx.lineTo(x - s * 0.2, y + s * 0.97);
  }
  function plane(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y - s * 0.1); ctx.lineTo(x - s * 0.1, y + s * 0.2); ctx.lineTo(x + s * 0.3, y + s); ctx.closePath();
    ctx.moveTo(x - s * 0.1, y + s * 0.2); ctx.lineTo(x + s, y - s);
  }
  function bookmark(ctx, x, y, s, fill) {
    ctx.beginPath(); ctx.moveTo(x - s * 0.7, y - s); ctx.lineTo(x + s * 0.7, y - s); ctx.lineTo(x + s * 0.7, y + s); ctx.lineTo(x, y + s * 0.45); ctx.lineTo(x - s * 0.7, y + s); ctx.closePath();
  }
  function igPost(ctx, x, y, w, t, tapP, typedP) {
    ctx.save();
    // header
    ctx.beginPath(); ctx.arc(x + 26, y + 24, 18, 0, 6.29); ctx.fillStyle = C.teal; ctx.fill();
    ctx.fillStyle = '#eef1ec'; ctx.font = 'bold 18px Heros'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', x + 26, y + 25);
    ctx.textAlign = 'left'; ctx.font = 'bold 17px Heros'; ctx.fillText('justin_lords', x + 54, y + 24);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 15px Heros'; ctx.fillText('· Follow', x + 158, y + 25);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; [0, 1, 2].forEach(function (i) { ctx.beginPath(); ctx.arc(x + w - 24 + i * 7, y + 24, 1.6, 0, 6.29); ctx.fill(); });
    // media
    var my = y + 50, mh = w * 1.0;
    ctx.fillStyle = '#101514'; ctx.fillRect(x, my, w, mh);
    if (ASSETS.post) { ctx.save(); ctx.beginPath(); ctx.rect(x, my, w, mh); ctx.clip(); coverImage(ctx, ASSETS.post, x, my, w, mh); ctx.restore(); }
    var g = ctx.createRadialGradient(x + w / 2, my + mh * 0.45, 10, x + w / 2, my + mh / 2, w * 0.8);
    g.addColorStop(0, '#2a3833'); g.addColorStop(1, '#0a0d0c');
    if (!ASSETS.post) {
      ctx.fillStyle = g; ctx.fillRect(x, my, w, mh);
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px Heros'; ctx.fillStyle = '#eef1ec'; ctx.fillText('PROBLEM', x + w / 2, my + mh * 0.34);
      ctx.font = 'bold 34px Heros'; ctx.fillStyle = '#8fd6bf'; ctx.fillText('STEPS', x + w / 2, my + mh * 0.50);
      ctx.font = 'bold 34px Heros'; ctx.fillStyle = '#eef1ec'; ctx.fillText('PROOF', x + w / 2, my + mh * 0.66);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, my + mh - 3, w, 3);
    ctx.fillStyle = '#eef1ec'; ctx.fillRect(x, my + mh - 3, w * 0.62, 3);
    // actions
    var ay = my + mh + 30;
    ctx.strokeStyle = '#f2f4f0'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
    heart(ctx, x + 22, ay, 12); ctx.stroke();
    var tap = tapP;
    ctx.save(); ctx.translate(x + 74, ay); ctx.scale(1 + Math.sin(tap * Math.PI) * 0.25, 1 + Math.sin(tap * Math.PI) * 0.25); ctx.translate(-(x + 74), -ay);
    bubble(ctx, x + 74, ay, 12); if (tap > 0.5) { ctx.fillStyle = '#f2f4f0'; ctx.fill(); } ctx.stroke(); ctx.restore();
    plane(ctx, x + 122, ay, 12); ctx.stroke();
    bookmark(ctx, x + w - 22, ay, 13); ctx.stroke();
    // composer
    var cy = ay + 44;
    rr(ctx, x, cy, w, 44, 22); ctx.fillStyle = '#161b19'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; rr(ctx, x + 0.5, cy + 0.5, w - 1, 43, 22); ctx.stroke();
    ctx.textAlign = 'left'; ctx.font = '400 17px Heros';
    var typed = 'tool'.slice(0, Math.round(typedP * 4));
    ctx.fillStyle = typed ? '#eef1ec' : 'rgba(255,255,255,0.4)'; ctx.fillText(typed || 'Add a comment…', x + 18, cy + 23);
    if (typedP > 0 && typedP < 1.5 && Math.floor(t * 3) % 2 === 0) { var tw = ctx.measureText(typed).width; ctx.fillRect(x + 20 + tw, cy + 12, 2, 22); }
    ctx.fillStyle = typedP >= 1 ? '#8fd6bf' : 'rgba(255,255,255,0.35)'; ctx.font = 'bold 17px Heros'; ctx.textAlign = 'right'; ctx.fillText('Post', x + w - 18, cy + 23);
    ctx.restore();
  }

  function linkCard(ctx, x, y, a) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20 * S; ctx.shadowOffsetY = 8 * S;
    rr(ctx, x - 150, y - 34, 300, 68, 34); ctx.fillStyle = '#1a221f'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(143,214,191,0.6)'; ctx.lineWidth = 1.5; rr(ctx, x - 149.25, y - 33.25, 298.5, 66.5, 34); ctx.stroke();
    ctx.strokeStyle = '#eef1ec'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x - 106, y - 6, 9, Math.PI * 0.6, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 92, y + 6, 9, Math.PI * 1.6, Math.PI * 2.9); ctx.stroke();
    ctx.fillStyle = '#eef1ec'; ctx.font = 'bold 26px Heros'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('sent you the link', x - 72, y + 1);
    ctx.restore();
  }
  /* --- END PART 2 --- */

  /* ---------- the typed sentence (VO-timed) ---------- */
  var TYPED = [
    ['open', 16.90], ['with', 17.38], ['the', 17.68], ['problem', 17.86], ['my', 18.20], ['customers', 18.44], ['have,', 18.80],
    ['then', 19.70], ['show', 19.90], ['how', 20.14], ['the', 20.38], ['product', 20.48], ['fixes', 20.84], ['it', 21.26],
    ['in', 21.50], ['three', 21.64], ['steps', 21.84], ['and', 22.26], ['end', 22.94], ['on', 23.16], ['the', 23.50],
    ['number', 23.62], ['that', 24.00], ['proves', 24.28], ['it', 24.58], ['works.', 24.88]
  ].map(function (p) { return { w: p[0], t: p[1] }; });

  /* ---------- CAMERA: hold → eased move → hold (measured on the reference) ----------
     Phase-correlation on the reference shows the camera is static most of the time
     (dx=dy=0 for 1–3 s stretches) and moves to the next word cluster in a single
     eased move of 0.5–1.0 s that starts fast and decelerates (peak 25–60 px/frame at
     720 wide), occasionally with a slow linear creep of ~4 px/frame during a hold.
     A scene's camera is a list of keys: { t, dur, x, y, z, rot, drift:[dx,dy] }.
     The camera holds at the previous key until `t`, then moves to this key over `dur`
     with moveEase(); `drift` (px/s) is applied after arrival until the next key. */
  function moveEase(p) { return smooth(Math.min(1, p / 0.14)) * (1 - Math.pow(1 - p, 2.6)); }
  function camFromKeys(keys, t) {
    var k = keys[0], cur = { x: k.x, y: k.y, z: k.z || 1, rot: k.rot || 0 };
    for (var i = 1; i < keys.length; i++) {
      var n = keys[i], prev = keys[i - 1];
      if (t < n.t) { // holding at prev (+ drift since prev arrived)
        var held = clamp(t - (prev.t + (prev.dur || 0)), 0, 1e9), d = prev.drift || [0, 0];
        cur.x += d[0] * held; cur.y += d[1] * held; return cur;
      }
      var arrivedPrev = prev.t + (prev.dur || 0), dprev = prev.drift || [0, 0];
      var holdLen = Math.max(0, n.t - arrivedPrev);
      var from = { x: cur.x + dprev[0] * holdLen, y: cur.y + dprev[1] * holdLen, z: cur.z, rot: cur.rot };
      var e = moveEase(inv(t, n.t, n.t + (n.dur || 0.7)));
      cur = { x: lerp(from.x, n.x, e), y: lerp(from.y, n.y, e), z: lerp(from.z, n.z || 1, e), rot: lerp(from.rot, n.rot || 0, e) };
    }
    var last = keys[keys.length - 1], dl = last.drift || [0, 0], h2 = clamp(t - (last.t + (last.dur || 0)), 0, 1e9);
    cur.x += dl[0] * h2; cur.y += dl[1] * h2; return cur;
  }

  /* ---------- scenes ---------- */
  function L(y, words, x, align) { return { y: y, words: words, x: x || 0, align: align }; }
  var K = function (t, dur, x, y, z, rot, drift) { return { t: t, dur: dur, x: x, y: y, z: z, rot: rot || 0, drift: drift }; };

  var SCENES = [
    { name: 'hook', a: 0,
      keys: [K(0, 0, 0, -250, 1.12, 0, [0, 6]), K(1.36, 0.8, -40, -140, 1.05, 0, [0, 8]), K(2.02, 0.9, 0, 120, 1.0, 0, [0, 12])],
      draw: function (c, t) {
        wline(c, t, L(-330, [W_(0.14, 'so', 'light', 44), W_(0.20, 'last', 'light', 44), W_(0.38, 'week', 'light', 44)]));
        wline(c, t, L(-240, [W_(0.70, 'I', 'bold', 74), W_(0.90, 'sat', 'bold', 74), W_(1.08, 'down', 'bold', 74)]));
        wline(c, t, L(-150, [W_(1.38, 'to', 'light', 44), W_(1.54, 'make', 'light', 44), W_(1.70, 'a', 'light', 44)], -270, 'left'));
        drawWord(c, t, { t: 1.80, x: 130, y: -128, txt: 'video', style: 'script', size: 118, rot: -0.05 });
        playObj(c, 0, 60, easeOut(inv(t, 1.95, 2.35)));
        wline(c, t, L(250, [W_(2.08, 'about', 'light', 44), W_(2.36, 'my', 'light', 44)]));
        wline(c, t, L(348, [W_(2.56, 'product', 'bold', 98)]));
      } },
    { name: 'two-hours', a: 3.6,
      keys: [K(3.4, 0, 0, -290, 1.02), K(4.88, 0.8, 0, 20, 1.0), K(5.68, 0.7, 0, 160, 1.0, 0, [0, 10]), K(6.62, 0.9, 0, 470, 1.0, 0, [0, 8])],
      draw: function (c, t) {
        wline(c, t, L(-400, [W_(3.44, 'two', 'bold', 86), W_(3.62, 'hours', 'bold', 86), W_(3.94, 'in', 'light', 50)]));
        var sp = easeInOut(inv(t, 3.6, 7.7));
        clock(c, 0, -150, 118, -Math.PI / 2 + Math.PI * 1.5 + sp * Math.PI / 3, -Math.PI / 2 + sp * Math.PI * 4, easeOut(inv(t, 3.5, 3.85)));
        wline(c, t, L(40, [W_(4.22, 'I', 'light', 44), W_(4.56, 'was', 'light', 44), W_(4.68, 'still', 'light', 44)]));
        wline(c, t, L(130, [W_(4.90, 'dragging', 'script', 100), W_(5.34, 'clips', 'script', 100)]));
        wline(c, t, L(215, [W_(5.70, 'around', 'light', 44), W_(6.02, 'a', 'light', 44), W_(6.04, 'timeline', 'bold', 66)]));
        timelinePanel(c, -320, 258, 640, 212, easeOut(inv(t, 6.12, 6.45)), t, inv(t, 6.2, 7.9));
        wline(c, t, L(590, [W_(6.64, 'with', 'light', 44), W_(7.04, 'nothing', 'bold', 114)]));
        wline(c, t, L(668, [W_(7.28, 'to', 'light', 44), W_(7.54, 'show', 'light', 44), W_(7.74, 'for', 'light', 44), W_(7.98, 'it.', 'light', 44)]));
      } },
    { name: 'thought', a: 9.2,
      keys: [K(8.9, 0, 0, -330, 1.02, -0.015), K(10.5, 0.8, 0, 120, 1.0, 0.0, [0, 6]), K(12.22, 0.8, 0, 330, 1.0, 0.012), K(13.6, 0.7, 20, 480, 1.0, 0.012)],
      draw: function (c, t) {
        wline(c, t, L(-430, [W_(8.96, 'and', 'light', 44), W_(9.06, 'I', 'light', 44), W_(9.20, 'had', 'light', 44), W_(9.36, 'this', 'light', 44)]));
        wline(c, t, L(-335, [W_(9.54, 'thought', 'bold', 98)]));
        qpanel(c, -300, -270, 280, 150, easeOut(inv(t, 9.72, 10.05)), 1, t);
        qpanel(c, 40, -250, 220, 220, easeOut(inv(t, 9.92, 10.25)), 2, t);
        wline(c, t, L(110, [W_(10.54, 'what', 'bold', 74), W_(10.70, 'if', 'bold', 74), W_(10.82, 'I', 'bold', 74)]));
        wline(c, t, L(195, [W_(10.96, 'stopped', 'bold', 64), W_(11.18, 'editing', 'bold', 64)]));
        var sk = easeOut(inv(t, 12.30, 12.62));
        if (sk > 0) { c.save(); c.strokeStyle = C.script; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-240, 172); c.lineTo(-240 + 480 * sk, 168); c.stroke(); c.restore(); }
        wline(c, t, L(275, [W_(11.64, 'and', 'light', 44), W_(12.10, 'just', 'light', 44)]));
        drawWord(c, t, { t: 12.28, x: 0, y: 372, txt: 'described', style: 'script', size: 112, rot: -0.03 });
        wline(c, t, L(455, [W_(12.66, 'what', 'bold', 62), W_(13.22, 'I', 'bold', 62), W_(13.36, 'wanted', 'bold', 62)]));
        drawWord(c, t, { t: 13.64, x: -100, y: 560, txt: 'instead', style: 'light', size: 52 });
        drawWord(c, t, { t: 13.72, x: 170, y: 610, txt: '?', style: 'bold', size: 180 });
      } },
    { name: 'tried', a: 14.95,
      keys: [K(14.8, 0, -40, -20, 1.0), K(15.3, 0.7, 0, 60, 1.06, 0, [0, 5])],
      draw: function (c, t) {
        drawWord(c, t, { t: 14.84, x: -215, y: -60, txt: 'so', style: 'light', size: 48 });
        wline(c, t, L(40, [W_(15.32, 'I', 'bold', 112), W_(15.48, 'tried', 'bold', 112), W_(15.64, 'it.', 'bold', 112)]));
        var a = easeOut(inv(t, 15.78, 16.15));
        glassRect(c, -70, 130, 140, 140, 22, a);
        if (a > 0) { c.save(); c.globalAlpha = a; c.strokeStyle = 'rgba(220,225,220,0.9)'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
          c.beginPath(); c.moveTo(30, 170); c.lineTo(30, 205); c.lineTo(-25, 205); c.moveTo(-8, 188); c.lineTo(-28, 205); c.lineTo(-8, 222); c.stroke(); c.restore(); }
      } },
    { name: 'typed-screen', a: 16.55,
      keys: [K(16.55, 0, -190, -230, 1.24, 0, [6, 0]), K(19.6, 1.2, -120, -80, 1.12, 0, [6, 0]), K(22.9, 1.0, -60, 60, 1.06, 0, [6, 0]), K(24.9, 0.8, -40, 120, 1.04)],
      draw: function (c, t) {
        promptPanelImage(t);
        c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 40 * S; c.shadowOffsetY = 20 * S;
        c.fillStyle = '#0a0d0c'; c.beginPath(); c.moveTo(-470, -470); c.lineTo(330, -360); c.lineTo(330, 330); c.lineTo(-470, 460); c.closePath(); c.fill(); c.restore();
        drawQuad(c, [panC, panB[0], panB[1]], [[-470, -470], [330, -360], [330, 330], [-470, 460]], 90, function (u) { return u; });
      } },
    { name: 'finished', a: 26.2,
      keys: [K(26.0, 0, 0, -380, 1.0), K(28.3, 0.8, 0, -200, 1.0), K(29.2, 0.9, 0, 130, 1.02), K(30.6, 0.8, 0, 330, 1.08, 0, [0, 6]), K(32.0, 0.9, 0, 640, 1.05)],
      draw: function (c, t) {
        wline(c, t, L(-430, [W_(26.12, 'that', 'bold', 78), W_(26.24, 'was', 'bold', 78), W_(26.38, 'it.', 'bold', 78)]));
        wline(c, t, L(-338, [W_(26.56, 'a', 'script', 100), W_(26.88, 'minute', 'script', 100), W_(27.68, 'later', 'script', 100)]));
        wline(c, t, L(-245, [W_(28.34, 'I', 'light', 44), W_(28.44, 'had', 'light', 44), W_(28.52, 'a', 'light', 44), W_(28.56, 'finished', 'light', 44)]));
        wline(c, t, L(-150, [W_(28.82, 'video', 'bold', 104)]));
        wline(c, t, L(-68, [W_(29.28, 'with', 'light', 44), W_(29.68, 'the', 'light', 44), W_(29.80, 'captions,', 'bold', 58)]));
        wline(c, t, L(12, [W_(30.62, 'the', 'light', 44), W_(30.64, 'motion,', 'bold', 58), W_(31.24, 'the', 'light', 44), W_(31.30, 'music,', 'bold', 58)]));
        var kinds = ['captions', 'motion', 'music', 'proof'], pos = [[-215, 80], [15, 80], [-215, 460], [15, 460]];
        for (var i = 0; i < 4; i++) videoCard(c, pos[i][0], pos[i][1], 200, 355, kinds[i], t, easeOut(inv(t, 28.9 + i * 0.09, 29.25 + i * 0.09)), i);
        wline(c, t, L(890, [W_(32.08, 'everything', 'bold', 72)]));
        wline(c, t, L(962, [W_(32.58, 'already', 'light', 44), W_(33.00, 'in', 'light', 44), W_(33.26, 'place', 'bold', 66)]));
      } },
    { name: 'better', a: 34.35,
      keys: [K(34.0, 0, 0, -180, 1.0), K(35.5, 0.7, 0, -20, 1.06), K(36.7, 0.8, 0, 120, 1.04, 0, [0, 5])],
      draw: function (c, t) {
        wline(c, t, L(-270, [W_(34.48, 'and', 'script', 96), W_(34.60, 'honestly,', 'script', 96)]));
        wline(c, t, L(-170, [W_(35.32, 'it', 'light', 46), W_(35.40, 'looked', 'light', 46)]));
        wline(c, t, L(-40, [W_(35.54, 'better', 'bold', 152)]));
        wline(c, t, L(60, [W_(35.86, 'than', 'light', 40), W_(36.14, 'what', 'light', 40), W_(36.28, 'I', 'light', 40), W_(36.40, 'would', 'light', 40), W_(36.52, 'have', 'light', 40), W_(36.58, 'made', 'light', 40)]));
        wline(c, t, L(165, [W_(36.78, 'by', 'bold', 92), W_(37.02, 'hand', 'bold', 92)]));
        var a = easeOut(inv(t, 37.08, 37.4));
        glassRect(c, -70, 230, 140, 140, 22, a);
        if (a > 0) { c.save(); c.globalAlpha = a; handCursor(c, 0, 305, 1.35, false); c.restore(); }
      } },
    { name: 'trick', a: 38.15,
      keys: [K(37.9, 0, 0, -330, 1.0), K(40.3, 0.8, -40, 20, 1.04), K(41.58, 0.6, -40, 80, 1.04, 0, [0, 6])],
      draw: function (c, t) {
        wline(c, t, L(-430, [W_(38.12, "that's", 'light', 46), W_(38.44, 'the', 'light', 46), W_(38.58, 'whole', 'light', 46)]));
        wline(c, t, L(-335, [W_(38.70, 'trick', 'bold', 112)]));
        wline(c, t, L(-245, [W_(39.02, 'by', 'script', 80), W_(39.24, 'the', 'script', 80), W_(39.38, 'way,', 'script', 80)]));
        var ps = [['1', 'problem', 40.36, -80], ['2', 'steps', 40.74, 60], ['3', 'proof', 41.62, 200]];
        for (var i = 0; i < 3; i++) pill(c, -200, ps[i][3], ps[i][0], ps[i][1], inv(t, ps[i][2], ps[i][2] + 0.6), inv(t, ps[i][2] + 0.28, ps[i][2] + 0.55));
      } },
    { name: 'friend', a: 42.85,
      keys: [K(42.8, 0, 0, -220, 1.0), K(43.9, 0.7, 0, -90, 1.03), K(45.1, 0.7, 0, 40, 1.06, 0, [0, 5])],
      draw: function (c, t) {
        wline(c, t, L(-320, [W_(42.88, 'say', 'light', 46), W_(42.94, 'it', 'light', 46), W_(43.08, 'like', 'light', 46), W_(43.22, "you'd", 'light', 46), W_(43.46, 'say', 'light', 46), W_(43.60, 'it', 'light', 46)]));
        wline(c, t, L(-225, [W_(43.74, 'to', 'light', 46), W_(43.84, 'a', 'light', 46)]));
        wline(c, t, L(-110, [W_(43.96, 'friend', 'script', 132)]));
        wline(c, t, L(20, [W_(44.22, 'and', 'light', 46), W_(44.64, 'let', 'light', 46), W_(44.80, 'the', 'light', 46), W_(44.94, 'tool', 'light', 46)]));
        wline(c, t, L(152, [W_(45.16, 'build', 'bold', 124), W_(45.56, 'it.', 'bold', 124)]));
      } },
    { name: 'comment-tool', a: 46.36, dark: true,
      keys: [K(46.36, 0, 0, -120, 1.0), K(49.4, 0.8, 0, 0, 1.0), K(50.5, 0.9, 0, 180, 1.0)],
      draw: function (c, t) {
        wline(c, t, L(-560, [W_(46.46, 'if', 'light', 36), W_(46.60, 'you', 'light', 36), W_(46.72, 'want', 'light', 36), W_(46.88, 'the', 'light', 36), W_(47.02, 'editor', 'bold', 46)]));
        wline(c, t, L(-500, [W_(47.30, 'I', 'light', 36), W_(47.56, 'used', 'light', 36), W_(47.82, 'for', 'light', 36), W_(48.06, 'this,', 'light', 36)]));
        wline(c, t, L(-418, [W_(48.56, 'just', 'light', 44), W_(48.70, 'comment', 'bold', 56), W_(49.02, 'the', 'light', 44), W_(49.28, 'word', 'light', 44)]));
        drawWord(c, t, { t: 49.50, x: 0, y: -275, txt: 'tool', style: 'bold', size: 150 });
        igPost(c, -230, -200, 460, t, inv(t, 48.85, 49.25), inv(t, 49.58, 49.9));
        var mp = easeInOut(inv(t, 48.15, 48.85)), tp = inv(t, 48.85, 49.25), lv = easeIn(inv(t, 49.4, 49.9));
        var hx = lerp(200, -156 + 8, mp) + lv * 260, hy = lerp(480, 340 + 22, mp) + lv * 160;
        var sc = 1 - Math.sin(tp * Math.PI) * 0.18;
        if (t > 48.0 && lv < 1) handCursor(c, hx, hy, sc * 0.9, tp > 0.3 && tp < 0.7);
        wline(c, t, L(530, [W_(50.60, "I'll", 'light', 44), W_(50.76, 'send', 'light', 44), W_(50.94, 'you', 'light', 44), W_(51.10, 'the', 'light', 44)]));
        drawWord(c, t, { t: 51.18, x: 0, y: 662, txt: 'link', style: 'script', size: 124, dur: 0.18 });
      } }
  ];
  for (var si = 0; si < SCENES.length; si++) (function (sc) { sc.cam = function (t) { return camFromKeys(sc.keys, t); }; })(SCENES[si]);

  /* ---------- TRANSITIONS (measured on the reference) ----------
     whip   : ONE continuous camera move from board A to board B (both live in the
              same world, B placed D px away in direction d). Bell-shaped velocity
              over 0.6–0.8 s, peak ≈ 50–90 px/frame, directional smear from velocity.
     cut    : hard cut (ref 11.16 s, the screenshot lands).
     xfade  : slow overlay dissolve with a small drift (ref 3.5 s, clock scene).
     strobe : 8 frames of alternating light-leak flashes over a hard cut at the
              midpoint (ref 21.36–21.64 s), lum pattern hi/lo/hi/mid/lo/hi/mid/lo.
     ia = outgoing scene index; incoming is ia+1. */
  var TRANS = [
    { ia: 0, t0: 2.95, t1: 3.60, type: 'whip', d: [1, 0], D: 800 },
    { ia: 1, t0: 8.50, t1: 9.20, type: 'whip', d: [0, 1], D: 1000 },
    { ia: 2, t0: 14.30, t1: 14.95, type: 'whip', d: [-1, 0], D: 800 },
    { ia: 3, t0: 16.55, t1: 16.55, type: 'cut', d: [0, 0], D: 0 },
    { ia: 4, t0: 25.50, t1: 26.20, type: 'whip', d: [0, 1], D: 1000 },
    { ia: 5, t0: 33.65, t1: 34.35, type: 'whip', d: [1, 0], D: 800 },
    { ia: 6, t0: 37.50, t1: 38.15, type: 'whip', d: [-1, 0], D: 800 },
    { ia: 7, t0: 42.55, t1: 42.85, type: 'xfade', d: [0, 0.25], D: 120 },
    { ia: 8, t0: 46.20, t1: 46.52, type: 'strobe', d: [0, 0], D: 0 }
  ];

  /* ---------- background, grain, vignette ---------- */
  var noise = null;
  function grain(ctx, t) {
    if (!noise) {
      noise = mk(256, 256); var nc = noise.getContext('2d'), id = nc.createImageData(256, 256), r = rng(11), d = id.data;
      for (var i = 0; i < d.length; i += 4) { var v = 128 + (r() - 0.5) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      nc.putImageData(id, 0, 0);
    }
    var f = Math.floor(t * FPS);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.16;
    var pat = ctx.createPattern(noise, 'repeat');
    ctx.translate((f * 37) % 256, (f * 91) % 256); ctx.scale(S * 1.2, S * 1.2);
    ctx.fillStyle = pat; ctx.fillRect(-512, -512, W * 2 + 1024, H * 2 + 1024);
    ctx.restore();
  }
  function background(ctx, cam, dark) {
    ctx.save(); ctx.setTransform(S, 0, 0, S, 0, 0);
    var cx = W / 2 - cam.x * 0.12, cy = H / 2 - cam.y * 0.12;
    var g = ctx.createRadialGradient(cx, cy - 60, 0, cx, cy, 900);
    if (dark) { g.addColorStop(0, '#171d1a'); g.addColorStop(0.5, '#0c100e'); g.addColorStop(1, '#040605'); }
    else { g.addColorStop(0, C.bgC); g.addColorStop(0.5, C.bgM); g.addColorStop(1, C.bgE); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  function vignette(ctx) {
    ctx.save(); ctx.setTransform(S, 0, 0, S, 0, 0);
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---------- compositing ---------- */
  var offA = null, offB = null;
  function applyCam(ctx, cam) {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.rotate(cam.rot || 0); ctx.translate(-cam.x, -cam.y);
  }
  function paintScene(ctx, sc, t) {
    var cam = sc.cam(t);
    ctx.save(); background(ctx, cam, sc.dark); applyCam(ctx, cam); sc.draw(ctx, t); ctx.restore();
    return cam;
  }
  /* both boards in one world, one camera flying between them */
  function paintWhip(ctx, tr, t) {
    var A = SCENES[tr.ia], B = SCENES[tr.ia + 1], p = inv(t, tr.t0, tr.t1), dur = tr.t1 - tr.t0;
    var Ae = A.cam(tr.t0), Bs = B.cam(tr.t1), e = easeInOut(p);
    var target = { x: Ae.x + tr.d[0] * tr.D, y: Ae.y + tr.d[1] * tr.D };
    var off = { x: target.x - Bs.x, y: target.y - Bs.y };            // B's world origin
    var cam = { x: lerp(Ae.x, target.x, e), y: lerp(Ae.y, target.y, e), z: lerp(Ae.z, Bs.z, e), rot: lerp(Ae.rot || 0, Bs.rot || 0, e) };
    ctx.save(); background(ctx, cam, p > 0.5 ? B.dark : A.dark);
    applyCam(ctx, cam); A.draw(ctx, t);
    applyCam(ctx, cam); ctx.translate(off.x, off.y); B.draw(ctx, t);
    ctx.restore();
    var dd = 0.01, v = (easeInOut(clamp(p + dd)) - easeInOut(clamp(p - dd))) / (2 * dd) * tr.D / (FPS * dur) * cam.z;
    return { vx: -tr.d[0] * v, vy: -tr.d[1] * v };
  }
  function blit(ctx, off, vx, vy, alpha) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    var n = (Math.abs(vx) + Math.abs(vy)) < 2 ? 1 : 16;
    for (var k = 0; k < n; k++) {
      var f = n === 1 ? 0 : (k / (n - 1) - 0.5) * 1.0;
      ctx.globalAlpha = k === 0 ? alpha : alpha / (k + 1);
      ctx.drawImage(off, vx * f * S, vy * f * S);
    }
    ctx.restore();
  }
  function sceneAt(t) { for (var i = SCENES.length - 1; i >= 0; i--) if (t >= SCENES[i].a) return i; return 0; }

  function drawFrame(ctx, t) {
    S = ctx.canvas.width / W;
    t = clamp(t, 0, DUR);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    var tr = null, i;
    for (i = 0; i < TRANS.length; i++) if (t >= TRANS[i].t0 && t < TRANS[i].t1 && TRANS[i].type !== 'cut') { tr = TRANS[i]; break; }
    if (!offA) { offA = mk(ctx.canvas.width, ctx.canvas.height); offB = mk(ctx.canvas.width, ctx.canvas.height); }
    var ca = offA.getContext('2d'), cb = offB.getContext('2d');
    if (!tr) {
      paintScene(ctx, SCENES[sceneAt(t)], t);
    } else if (tr.type === 'whip') {
      var v = paintWhip(ca, tr, t);
      blit(ctx, offA, v.vx, v.vy, 1);
    } else if (tr.type === 'xfade') {
      var p = inv(t, tr.t0, tr.t1), A = SCENES[tr.ia], B = SCENES[tr.ia + 1];
      var camA = A.cam(t), camB = B.cam(t);
      ca.save(); background(ca, camA, A.dark); applyCam(ca, { x: camA.x + tr.d[0] * tr.D * p, y: camA.y + tr.d[1] * tr.D * p, z: camA.z, rot: camA.rot }); A.draw(ca, t); ca.restore();
      cb.save(); background(cb, camB, B.dark); applyCam(cb, { x: camB.x - tr.d[0] * tr.D * (1 - p), y: camB.y - tr.d[1] * tr.D * (1 - p), z: camB.z, rot: camB.rot }); B.draw(cb, t); cb.restore();
      blit(ctx, offA, 0, 0, 1); blit(ctx, offB, 0, 0, smooth(p));
    } else { // strobe: hard cut at the midpoint; flashes are added after grain/vignette
      var pp = inv(t, tr.t0, tr.t1);
      paintScene(ctx, SCENES[pp < 0.5 ? tr.ia : tr.ia + 1], t);
    }
    grain(ctx, t);
    vignette(ctx);
    for (i = 0; i < TRANS.length; i++) if (TRANS[i].type === 'strobe' && t >= TRANS[i].t0 && t < TRANS[i].t1) {
      var fi = Math.floor((t - TRANS[i].t0) * FPS), fl = [1.0, 0.12, 0.85, 0.45, 0.06, 0.8, 0.5, 0.0][Math.min(7, fi)];
      if (fl > 0) {
        ctx.setTransform(S, 0, 0, S, 0, 0);
        var g = ctx.createRadialGradient(W * 0.32, H * 0.42, 0, W * 0.32, H * 0.42, H * 0.7);
        g.addColorStop(0, 'rgba(235,245,255,' + fl + ')'); g.addColorStop(0.45, 'rgba(120,180,255,' + fl * 0.55 + ')'); g.addColorStop(1, 'rgba(60,110,200,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,' + fl * 0.35 + ')'; ctx.fillRect(0, 0, W, H);
      }
    }
    var fin = 1 - easeOut(inv(t, 0, 0.36)), fout = easeIn(inv(t, DUR - 0.28, DUR));
    var fade = Math.max(fin, fout);
    if (fade > 0) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.fillStyle = 'rgba(225,230,225,' + fade + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  return { W: W, H: H, FPS: FPS, DUR: DUR, drawFrame: drawFrame, setAssets: setAssets, SCENES: SCENES, TRANS: TRANS, TYPED: TYPED };
});
