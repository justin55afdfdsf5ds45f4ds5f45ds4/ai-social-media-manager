/* retime.js — make a reel folder from the kit engine for a TIGHTENED take of the same script.
 *
 *   node retime.js <reelDir> <tightWords.json> [tightDuration]
 *
 * The kit's engine.js is timed to vo.mp3 (the untightened take). Every time literal in it is
 * remapped through a piecewise-linear map anchored on word onsets (kit vo_words.json → tight
 * words.json), so words, camera keys, whips and object cues all land on the tight audio.
 * Then the four beat edits from plan.json are applied (see PLAN below) and plan.json + hits.json
 * are written. Whip durations are restored where a cut had squeezed them.
 */
const fs = require('fs'), path = require('path');
const [, , reelDir, tightPath, durArg] = process.argv;
if (!reelDir || !tightPath) { console.error('usage: node retime.js <reelDir> <tightWords.json> [duration]'); process.exit(1); }

const kit = require('./vo_words.json');
const origWords = (kit.words || kit).map(w => ({ w: (w.word ?? w.w).trim(), t: w.start ?? w.t }));
const tight = require(path.resolve(tightPath)).map(w => ({ w: w.word.trim(), t: w.start }));
/* align the two transcripts (they can tokenise differently); anchors come from matched words only */
const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');
const A0 = origWords, B0 = tight;
const dp = Array.from({ length: A0.length + 1 }, () => new Array(B0.length + 1).fill(0));
for (let i = A0.length - 1; i >= 0; i--) for (let j = B0.length - 1; j >= 0; j--)
  dp[i][j] = norm(A0[i].w) === norm(B0[j].w) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
const pairs = []; { let i = 0, j = 0; while (i < A0.length && j < B0.length) {
  if (norm(A0[i].w) === norm(B0[j].w)) { pairs.push([A0[i].t, B0[j].t]); i++; j++; }
  else if (dp[i + 1][j] >= dp[i][j + 1]) { console.warn(`kit-only token: "${A0[i].w}" @${A0[i].t}`); i++; }
  else { console.warn(`tight-only token: "${B0[j].w}" @${B0[j].t}`); j++; } } }
console.log(`aligned ${pairs.length} of ${A0.length}/${B0.length} words`);
const AW = pairs.map(p => ({ t: p[0] })), BW = pairs.map(p => ({ t: p[1] }));
const DUR = durArg ? parseFloat(durArg) : BW[BW.length - 1].t + (51.64 - AW[AW.length - 1].t);

/* piecewise-linear orig → tight, anchored on word onsets */
function R(t) {
  t = +t;
  const A = AW, B = BW, n = A.length;
  if (t <= A[0].t) return t + (B[0].t - A[0].t);
  if (t >= A[n - 1].t) return Math.min(DUR, t + (B[n - 1].t - A[n - 1].t));
  let i = 0; while (i < n - 1 && A[i + 1].t <= t) i++;
  const span = A[i + 1].t - A[i].t; if (span <= 0) return B[i].t;
  return B[i].t + (t - A[i].t) / span * (B[i + 1].t - B[i].t);
}
const r2 = t => R(parseFloat(t)).toFixed(2);

let src = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');

/* ---------- beat edits, in ORIGINAL time (they get remapped with everything else) ---------- */
// (b) 'better': the hand tile arrives on "looked" (35.40) instead of after "hand", and presses on "hand" (37.02)
src = src.replace("var a = easeOut(inv(t, 37.08, 37.4));\n        glassRect(c, -70, 230, 140, 140, 22, a);\n        if (a > 0) { c.save(); c.globalAlpha = a; handCursor(c, 0, 305, 1.35, false); c.restore(); }",
  "var a = easeOut(inv(t, 35.40, 35.75)), hp = inv(t, 37.02, 37.34);\n        glassRect(c, -70, 230, 140, 140, 22, a);\n        if (a > 0) { c.save(); c.globalAlpha = a; handCursor(c, 0, 305, 1.35 - Math.sin(hp * Math.PI) * 0.18, hp > 0.2 && hp < 0.8); c.restore(); }");
// (c) 'trick': the three circles appear on "trick" (38.72) and stretch into pills on their own words
src = src.replace("for (var i = 0; i < 3; i++) pill(c, -200, ps[i][3], ps[i][0], ps[i][1], inv(t, ps[i][2], ps[i][2] + 0.6), inv(t, ps[i][2] + 0.28, ps[i][2] + 0.55));",
  "for (var i = 0; i < 3; i++) { var cp = inv(t, 38.72 + i * 0.1, 39.02 + i * 0.1) * 0.35, wp = inv(t, ps[i][2], ps[i][2] + 0.6); pill(c, -200, ps[i][3], ps[i][0], ps[i][1], Math.max(cp, wp), inv(t, ps[i][2] + 0.28, ps[i][2] + 0.55)); }");
// (a) 'finished': a small clock card on "a minute later" (26.85 → 28.75), before the cards arrive
src = src.replace("wline(c, t, L(-338, [W_(26.56, 'a', 'script', 100), W_(26.88, 'minute', 'script', 100), W_(27.68, 'later', 'script', 100)]));",
  "wline(c, t, L(-338, [W_(26.56, 'a', 'script', 100), W_(26.88, 'minute', 'script', 100), W_(27.68, 'later', 'script', 100)]));\n        var msp = easeInOut(inv(t, 26.90, 28.20)), mca = easeOut(inv(t, 26.85, 27.15)) * (1 - inv(t, 28.20, 28.42));\n        clock(c, 0, -240, 58, -Math.PI / 2 + Math.PI * 1.5, -Math.PI / 2 + msp * Math.PI * 2, mca);");
// (d) 'friend': a glass tile with a chat bubble on "friend" (43.90)
src = src.replace("wline(c, t, L(-110, [W_(43.96, 'friend', 'script', 132)]));",
  "wline(c, t, L(-110, [W_(43.96, 'friend', 'script', 132)]));\n        var fa = easeOut(inv(t, 43.90, 44.25));\n        glassRect(c, -320, -170, 120, 120, 20, fa);\n        if (fa > 0) { c.save(); c.globalAlpha = fa; c.strokeStyle = 'rgba(220,225,220,0.9)'; c.lineWidth = 5; c.lineJoin = 'round'; bubble(c, -260, -112, 28); c.stroke(); c.restore(); }");
for (const must of ["hp > 0.2", "var cp = inv", "var msp", "var fa = easeOut"]) if (!src.includes(must)) { console.error('beat edit did not apply: ' + must); process.exit(1); }

/* ---------- remap every time literal ---------- */
const N = '(\\d+(?:\\.\\d+)?)';
const reps = [
  [new RegExp('W_\\(' + N + ', ', 'g'), (m, a) => `W_(${r2(a)}, `],
  [new RegExp('\\{ t: ' + N + ', x:', 'g'), (m, a) => `{ t: ${r2(a)}, x:`],
  [new RegExp('K\\(' + N + ', ', 'g'), (m, a) => `K(${r2(a)}, `],
  [new RegExp("(name: '[\\w-]+', a: )" + N + ',', 'g'), (m, p, a) => `${p}${r2(a)},`],
  [new RegExp('t0: ' + N + ', t1: ' + N, 'g'), (m, a, b) => `t0: ${r2(a)}, t1: ${r2(b)}`],
  [new RegExp("\\['([^']+)', " + N + '\\]', 'g'), (m, w, a) => `['${w}', ${r2(a)}]`],
  [new RegExp('inv\\(t, ' + N + ' \\+ i \\* (0\\.\\d+), ' + N + ' \\+ i \\* \\2\\)', 'g'), (m, a, k, b) => `inv(t, ${r2(a)} + i * ${k}, ${r2(b)} + i * ${k})`],
  [new RegExp('inv\\(t, ' + N + ', ' + N + '\\)', 'g'), (m, a, b) => `inv(t, ${r2(a)}, ${r2(b)})`],
  [new RegExp("\\['(\\d)', '(\\w+)', " + N + ', (-?\\d+)\\]', 'g'), (m, n, l, a, y) => `['${n}', '${l}', ${r2(a)}, ${y}]`],
  [/t > 48\.0 &&/g, () => `t > ${r2(48.0)} &&`],
  [/DUR = 51\.64;/, () => `DUR = ${DUR.toFixed(3)};`],
];
let count = 0;
for (const [re, fn] of reps) src = src.replace(re, (...args) => { count++; return fn(...args); });

/* ---------- whips: a cut inside a whip squeezed it; restore its length, never before the last word of A ---------- */
const kitEngine = require('./engine.js');
const scenesA = kitEngine.SCENES;
src = src.replace(/\{ ia: (\d), t0: ([\d.]+), t1: ([\d.]+), type: 'whip'/g, (m, ia, t0, t1) => {
  const orig = kitEngine.TRANS[+ia], want = +(orig.t1 - orig.t0).toFixed(2);
  let a = +t0, b = +t1;
  if (b - a < want - 0.05) {
    // last word of the outgoing scene, in tight time
    const nextA = R(scenesA[+ia + 1].a);
    const lastWordEnd = Math.max(...tight.filter(w => w.t < nextA - 0.3).map(w => w.t));
    a = Math.max(b - want, lastWordEnd + 0.10);
    console.log(`  whip ${ia}: squeezed ${t0}-${t1} -> ${a.toFixed(2)}-${b.toFixed(2)} (kit ${orig.t0}-${orig.t1})`);
  }
  return `{ ia: ${ia}, t0: ${a.toFixed(2)}, t1: ${b.toFixed(2)}, type: 'whip'`;
});

fs.mkdirSync(reelDir, { recursive: true });
fs.writeFileSync(path.join(reelDir, 'engine.js'), src);
console.log(`engine.js written: ${count} time literals remapped, DUR ${DUR.toFixed(3)} s`);

/* ---------- PLAN (docs/reel-method.md §1), tight times ---------- */
const beat = (id, from, to, says, idea, show, type, camera, why, gap) => ({ id, from: +R(from).toFixed(2), to: +R(to).toFixed(2), says, idea, show: show.map(s => ({ ...s, at: +R(s.at).toFixed(2), until: s.until == null ? null : +R(s.until).toFixed(2) })), type, camera, why, gap_check: gap });
const plan = {
  style: 'S02', voice: 'vo.mp3', words: 'words.json', duration: +DUR.toFixed(3), engine: 'engine.js (retimed from the kit)',
  audio: { riser: 'Riser.mp3 @ 0 s untouched', music: 'Girlfriends - New Computers (Thought-provoking), -26 LUFS = 12 dB under the voice', hits: 'button_0-3 on every object landing, 2 frames early (hits.json)' },
  beats: [
    beat('b01', 0.0, 2.95, 'So last week I sat down to make a video about my product', 'the setup: a video',
      [{ asset: 'P-glass-tile', as: 'play tile', on: 'video', at: 1.95, enter: 'fade-rise', until: null }],
      { bold: ['I sat down', 'product'], script: ['video'] }, { enter: 'fade-in', keys: 'hold → move on "to make" → move on "about"' },
      "'make a video' -> the play tile lands under the script word 'video'",
      '0.00-1.95 type only = first beat exception (the camera is travelling the whole time: keys at 1.36 and 2.02 with drift)'),
    beat('b02', 3.6, 8.5, 'two hours in I was still dragging clips around a timeline with nothing to show for it', 'the pain: time burned, nothing landed',
      [{ asset: 'P-clock-card', as: 'wall clock, hands race 2 h', on: 'two hours', at: 3.5, enter: 'fade', until: null },
       { asset: 'P-timeline-panel', as: 'editor timeline, clip_07 never lands', on: 'timeline', at: 6.12, enter: 'fade-rise', until: null }],
      { bold: ['two hours', 'timeline', 'nothing'], script: ['dragging clips'] }, { enter: 'whip →', keys: 'hold → 4.88 → 5.68 → 6.62 (camera walks down the board)' },
      "'two hours' -> the clock; 'dragging clips around a timeline' -> the timeline with a cursor shuffling a clip",
      'clock is on screen from 3.5 to the whip; timeline joins at 6.12. No bare stretch.'),
    beat('b03', 9.2, 14.3, 'And I had this thought, what if I stopped editing and just described what I wanted instead?', 'the idea',
      [{ asset: 'P-question-panel', as: '? panel 1', on: 'thought', at: 9.72, enter: 'fade-rise', until: null },
       { asset: 'P-question-panel', as: '? panel 2', on: 'thought', at: 9.92, enter: 'fade-rise', until: null },
       { asset: 'strike', as: 'line through "stopped editing"', on: 'described', at: 12.30, enter: 'draw', until: null },
       { asset: 'big ?', as: '180 px ?', on: 'instead', at: 13.72, enter: 'blur-in', until: null }],
      { bold: ['thought', 'what if I', 'stopped editing', 'what I wanted'], script: ['described'] }, { enter: 'whip ↓', keys: '8.9 → 10.5 → 12.22 → 13.6' },
      "'thought' -> the two ? panels; 'described' strikes 'stopped editing'; 'instead?' -> the big ?",
      '8.96-9.72 type only = 0.76 s (< 1.0 s). OK'),
    beat('b04', 14.95, 16.55, 'So I tried it.', 'the decision',
      [{ asset: 'P-glass-tile', as: 'enter-key tile', on: 'it.', at: 15.78, enter: 'fade', until: null }],
      { bold: ['I tried it.'] }, { enter: 'whip ←', keys: '14.8 → 15.3' },
      "'tried it' -> pressing enter",
      '14.84-15.78 type only = 0.94 s (< 1.0 s). OK'),
    beat('b05', 16.55, 25.5, 'I typed: open with the problem my customers have, then show how the product fixes it in three steps and end on the number that proves it works.', 'the prompt, typed live',
      [{ asset: 'P-tilted-screen', as: 'the editor prompt box; words type on their onsets; chips problem / 3 steps / the number light; build lights at 25.0', on: 'typed', at: 16.55, enter: 'cut', until: null }],
      { typed: 'TYPED[] = the sentence, word by word' }, { enter: 'cut', keys: '16.55 → 19.6 → 22.9 → 24.9 (creep across the screen)' },
      "'I typed …' -> the words appear inside the product's prompt box as he says them",
      'screen present the whole beat. Readable hold: the full sentence sits from 24.9 to the whip at 25.5 + the chips; short, but the typing IS the content here.'),
    beat('b06', 26.2, 33.65, 'That was it. A minute later I had a finished video with the captions, the motion, the music, everything already in place.', 'the result',
      [{ asset: 'P-clock-card', as: 'small clock under the line, one sweep = a minute', on: 'minute', at: 26.85, enter: 'fade', until: 28.40 },
       { asset: 'P-cards-2x2', as: 'four finished-video cards (real MotionVid stills)', on: 'finished video', at: 28.9, enter: 'fade-rise', until: null }],
      { bold: ['that was it', 'video', 'captions', 'motion', 'music', 'everything', 'place'], script: ['a minute later'] }, { enter: 'whip ↓', keys: '26.0 → 28.3 → 29.2 → 30.6 → 32.0' },
      "'a minute later' -> the clock sweeps once; 'finished video … captions, motion, music' -> the four cards",
      'clock 26.85-28.40, cards from 28.9 (0.5 s gap while the type keeps arriving). Bare 26.12-26.85 = 0.73 s. OK (edit (a) added the clock; kit had 2.8 s of type only)'),
    beat('b07', 34.35, 37.5, 'And honestly, it looked better than what I would have made by hand.', 'the verdict',
      [{ asset: 'P-glass-tile', as: 'hand-cursor tile; presses on "hand"', on: 'looked', at: 35.40, enter: 'fade', until: null }],
      { bold: ['better', 'by hand'], script: ['and honestly,'] }, { enter: 'whip →', keys: '34.0 → 35.5 → 36.7' },
      "'looked' -> the hand tile; 'by hand' -> it presses",
      '34.48-35.40 type only = 0.92 s. OK (edit (b) moved the tile earlier; kit had 2.6 s)'),
    beat('b08', 38.15, 42.55, "That's the whole trick by the way: problem, steps, proof.", 'the formula',
      [{ asset: 'P-pill-morph', as: 'three circles appear on "trick", stretch into pills on problem / steps / proof', on: 'trick', at: 38.72, enter: 'pop', until: null }],
      { bold: ['trick'], script: ['by the way,'] }, { enter: 'whip ←', keys: '37.9 → 40.3 → 41.58' },
      "'trick' -> the three-step structure; each word fills its pill",
      '38.12-38.72 type only = 0.60 s. OK (edit (c); kit had 2.2 s)'),
    beat('b09', 42.85, 46.2, "Say it like you'd say it to a friend and let the tool build it.", 'the advice',
      [{ asset: 'P-glass-tile', as: 'chat-bubble tile', on: 'friend', at: 43.90, enter: 'fade', until: null }],
      { bold: ['build it.'], script: ['friend'] }, { enter: 'xfade', keys: '42.8 → 43.9 → 45.1' },
      "'say it to a friend' -> a message bubble",
      '42.88-43.90 type only = 1.02 s, at the limit. Accepted: the overlay dissolve is still settling until 42.85+. (edit (d); kit had 3.3 s)'),
    beat('b10', 46.36, 51.64, "If you want the editor I used for this, just comment the word tool and I'll send you the link.", 'the CTA',
      [{ asset: 'P-ig-post', as: 'Instagram post (real still), rail, hand taps comment, "tool" types into the composer, Post lights', on: 'comment', at: 46.36, enter: 'strobe', until: null }],
      { bold: ['editor', 'comment', 'tool'], script: ['link'] }, { enter: 'strobe', keys: '46.36 → 49.4 → 50.5' },
      "'comment the word tool' -> the post, the tap, the typed comment",
      'post on screen for the whole beat.'),
  ],
};
fs.writeFileSync(path.join(reelDir, 'plan.json'), JSON.stringify(plan, null, 2));

/* ---------- hits: one button per object landing, 2 frames (0.08 s) early ---------- */
const hits = [];
for (const b of plan.beats) for (const s of b.show) if (s.enter !== 'cut' && s.enter !== 'strobe') hits.push({ t: +(s.at - 0.08).toFixed(2), what: `${b.id} ${s.as}` });
// extra landings inside beats: the four cards stagger, the three pill labels, the tap and the link
[[28.99, 'b06 card 2'], [29.08, 'b06 card 3'], [29.17, 'b06 card 4'], [40.36, 'b08 pill problem'], [40.74, 'b08 pill steps'], [41.62, 'b08 pill proof'], [48.85, 'b10 tap comment'], [51.18, 'b10 link']]
  .forEach(([t, what]) => hits.push({ t: +(R(t) - 0.08).toFixed(2), what }));
hits.sort((a, b) => a.t - b.t);
// same-class hit within 2 frames = doubling -> dropped
const kept = []; for (const h of hits) if (!kept.length || h.t - kept[kept.length - 1].t > 0.08) kept.push(h);
fs.writeFileSync(path.join(reelDir, 'hits.json'), JSON.stringify(kept, null, 1));
console.log(`plan.json: ${plan.beats.length} beats; hits.json: ${kept.length} hits`);
console.log('scenes (tight):', scenesA.map(s => `${s.name}@${r2(s.a)}`).join('  '));
