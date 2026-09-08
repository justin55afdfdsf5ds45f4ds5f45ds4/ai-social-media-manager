# reels/premium – the S02 Premium engine

One pure function, `drawFrame(ctx, t)` in `engine.js`, paints any frame of a film: a dark green-grey text
board the camera flies across, Helvetica bold/light with a felt-tip script for emphasis words, glass
objects, teal cards, hold-move-hold camera, whips, a typed-in screen, a strobe into an Instagram CTA.
Style sheet with the measured numbers: `docs/styles/S02-premium.md`. Design space 720×1280 at 25 fps,
rendered ×1.5 = 1080×1920.

## Files

| file | what |
|---|---|
| `engine.js` | the film: SCENES (one per board: camera keys + draw), TRANS (whip / cut / xfade / strobe), TYPED (the sentence typed into the screen). The header comment explains how to write a new film. |
| `reference_dissection.js` | everything measured on the reference: shot list, style system, camera motion tables, transitions, the beat map. Read before writing a new film. |
| `retime.js` | `node retime.js <reelDir> <words.json> [duration]` – re-targets the film to a tightened take of the same script (word-anchored remap of every time literal, whip lengths restored), applies the plan's beat edits, writes `plan.json` and `hits.json`. |
| `render.js` | stills: `SC=1 REEL=<reelDir> node render.js <outDir> preview 1.2 5.0 …` |
| `render_seg.js` | one frame range → one MP4 segment via ffmpeg pipe (`SC=1.5` for 1080p) |
| `drive.sh` | `REEL=<reelDir> ./drive.sh` renders the missing segments (run until `ALLDONE`) |
| `mix.js` | the audio law: voice at −14 LUFS + `assets/audio/riser.mp3` at 0 s untouched + optional `<reelDir>/music.*` at −26 LUFS + one button per `hits.json` entry, limiter |
| `build.sh` | `REEL=<reelDir> ./build.sh` → `<reelDir>/reel.mp4` |
| `load_assets.js` | picks up `<reelDir>/assets/card1-4.png` (9:16 stills) and `post.png` (1:1) |
| `fonts/` | TeX Gyre Heros regular/bold (Helvetica clone), Caveat, Permanent Marker |
| `proof/` | the render check that proved the engine on this machine |

## Make a reel

```
mkdir <reel> && cp vo-tight.mp3 <reel>/vo.mp3 && cp words.json <reel>/words.json
node retime.js <reel> <reel>/words.json           # if the script is the kit's; otherwise write SCENES from plan.json
SC=1 REEL=<reel> node render.js <reel>/qa preview 1 4 8 12 …   # look at the stills, fix the plan
REEL=<reel> ./drive.sh                              # until ALLDONE
cp <bed>.mp3 <reel>/music.mp3 && REEL=<reel> ./build.sh
```

Per-reel folders (`vo-*/`) are git-ignored: they hold the owner's voice and music. The engine, tools,
fonts and measurements are what the repo publishes.
