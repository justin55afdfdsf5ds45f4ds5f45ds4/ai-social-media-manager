/* mix.js — the S02 audio law in one ffmpeg call.
 *   node mix.js <reelDir>            -> <reelDir>/mix.wav
 * inputs: <reelDir>/vo_norm.wav (voice at -14 LUFS, made by build.sh), the riser (t = 0, untouched),
 *         <reelDir>/music.* (optional, loudnorm'd to -26 LUFS = 12 dB under the voice),
 *         <reelDir>/hits.json + assets/audio/sfx/button_0-3.wav (one hit per object landing, already 2 frames early)
 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const reel = path.resolve(process.argv[2] || '.');
const RISER = process.env.RISER || path.join(__dirname, '..', '..', 'assets', 'audio', 'riser.mp3');
const BUTTONS = [0, 1, 2, 3].map(i => path.join(__dirname, '..', '..', 'assets', 'audio', 'sfx', `button_${i}.wav`));
const HIT_GAIN = 0.72; // just under the voice ceiling (audio.tsx TRANSIENT)

const vo = path.join(reel, 'vo_norm.wav');
const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vo]).toString());
const music = ['music.mp3', 'music.wav', 'music.m4a'].map(f => path.join(reel, f)).find(fs.existsSync);
const hits = fs.existsSync(path.join(reel, 'hits.json')) ? JSON.parse(fs.readFileSync(path.join(reel, 'hits.json'), 'utf8')) : [];

const inputs = ['-i', vo, '-i', RISER];
const fc = ['[1:a]aformat=sample_rates=48000:channel_layouts=stereo[r]'];
const mixIn = ['[0:a]', '[r]'];
if (music) {
  inputs.push('-i', music);
  fc.push(`[2:a]loudnorm=I=-26:TP=-8:LRA=11,aformat=sample_rates=48000:channel_layouts=stereo,afade=t=in:d=0.7,afade=t=out:st=${(dur - 1.5).toFixed(2)}:d=1.5,atrim=0:${dur.toFixed(2)}[m]`);
  mixIn.push('[m]');
}
hits.forEach((h, i) => {
  const idx = inputs.length / 2;
  inputs.push('-i', BUTTONS[i % BUTTONS.length]);
  const ms = Math.max(0, Math.round(h.t * 1000));
  fc.push(`[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${HIT_GAIN},adelay=${ms}|${ms}[h${i}]`);
  mixIn.push(`[h${i}]`);
});
fc.push(`${mixIn.join('')}amix=inputs=${mixIn.length}:duration=first:normalize=0,alimiter=limit=0.94:level=false[a]`);
const out = path.join(reel, 'mix.wav');
execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', fc.join(';'), '-map', '[a]', '-ar', '48000', out], { stdio: 'inherit' });
console.log(`mix.wav: voice + riser${music ? ' + music (' + path.basename(music) + ')' : ''} + ${hits.length} hits -> ${out}`);
