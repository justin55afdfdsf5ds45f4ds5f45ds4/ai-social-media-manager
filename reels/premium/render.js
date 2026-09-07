const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs'), path = require('path');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/texgyreheros-regular.otf'), 'Heros');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/texgyreheros-bold.otf'), 'Heros');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/Caveat.ttf'), 'Caveat');
GlobalFonts.registerFromPath(path.join(__dirname, 'fonts/PermanentMarker.ttf'), 'Marker');
const REEL = process.env.REEL ? path.resolve(process.env.REEL) : __dirname;
const ENGINE = require(path.join(REEL, 'engine.js'));
const loadAssets = require('./load_assets.js');
const outDir = process.argv[2] || './frames', mode = process.argv[3] || 'all';
const SC = parseFloat(process.env.SC || '1.5');
fs.mkdirSync(outDir, { recursive: true });
const total = Math.round(ENGINE.DUR * ENGINE.FPS);
const canvas = createCanvas(Math.round(ENGINE.W * SC), Math.round(ENGINE.H * SC));
const ctx = canvas.getContext('2d');
loadAssets(ENGINE, REEL).then(() => {
if (mode === 'preview') {
  process.argv.slice(4).map(Number).forEach((t, i) => { ENGINE.drawFrame(ctx, t); fs.writeFileSync(path.join(outDir, 'p_' + String(i).padStart(2, '0') + '.png'), canvas.toBuffer('image/png')); });
} else if (mode === 'missing') {
  const have = new Set(fs.readdirSync(outDir).filter(f => /^f_\d+\.png$/.test(f)).map(f => parseInt(f.slice(2, -4), 10)));
  const miss = []; for (let i = 0; i < total; i++) if (!have.has(i)) miss.push(i);
  console.log(JSON.stringify({ total, have: have.size, missing: miss.length, first: miss.slice(0, 10) }));
} else {
  const a = parseInt(process.argv[4] || '0', 10), b = parseInt(process.argv[5] || '0', 10);
  const from = b > 0 ? a : 0, to = b > 0 ? Math.min(b, total) : total, t0 = Date.now(); let drew = 0;
  for (let i = from; i < to; i++) {
    const p = path.join(outDir, 'f_' + String(i).padStart(4, '0') + '.png');
    if (fs.existsSync(p) && fs.statSync(p).size > 2000) continue;
    ENGINE.drawFrame(ctx, i / ENGINE.FPS); fs.writeFileSync(p, canvas.toBuffer('image/png')); drew++;
  }
  console.log(`rendered ${from}->${to} (${drew} new) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
});
