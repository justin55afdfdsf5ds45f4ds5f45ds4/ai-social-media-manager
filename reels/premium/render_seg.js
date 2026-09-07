const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
GlobalFonts.registerFromPath(__dirname + '/fonts/texgyreheros-regular.otf', 'Heros');
GlobalFonts.registerFromPath(__dirname + '/fonts/texgyreheros-bold.otf', 'Heros');
GlobalFonts.registerFromPath(__dirname + '/fonts/Caveat.ttf', 'Caveat');
GlobalFonts.registerFromPath(__dirname + '/fonts/PermanentMarker.ttf', 'Marker');
const path = require('path');
const REEL = process.env.REEL ? path.resolve(process.env.REEL) : __dirname;
const E = require(path.join(REEL, 'engine.js'));
const loadAssets = require('./load_assets.js');
const SC = parseFloat(process.env.SC || '1.5');
const from = parseInt(process.argv[2]), to = parseInt(process.argv[3]), out = process.argv[4];
const W = Math.round(E.W * SC), H = Math.round(E.H * SC);
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', W + 'x' + H, '-r', String(E.FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '15', '-pix_fmt', 'yuv420p', '-g', '25', out], { stdio: ['pipe', 'inherit', 'inherit'] });
loadAssets(E, REEL).then(() => {
const t0 = Date.now();
let i = from;
function pump() {
  while (i < to) {
    E.drawFrame(ctx, i / E.FPS);
    const ok = ff.stdin.write(canvas.data());
    i++;
    if (!ok) { ff.stdin.once('drain', pump); return; }
  }
  ff.stdin.end();
}
ff.on('close', code => console.log(out, 'frames', from, '->', to, 'exit', code, ((Date.now() - t0) / 1000).toFixed(1) + 's'));
pump();
});
