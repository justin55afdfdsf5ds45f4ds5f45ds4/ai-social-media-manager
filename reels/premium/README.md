# Reference clone kit — "problem · steps · proof"

A frame-by-frame clone of a kinetic-typography Instagram reel (the reference MP4), rebuilt around a new
voice-over. The reference's audio is muted; the VO is the only audio track. Everything that was measured
in the reference and every decision made in the rebuild is in this folder, so another AI can pick it up,
remake the film, swap the placeholders, or produce a new film in the same style from a different VO.

## Files

| file | what it is |
|---|---|
| `problem_steps_proof_clone.mp4` | the finished film, 1080x1920, 25 fps, 51.64 s, VO at -14 LUFS |
| `reference.mp4` | the reference reel that was cloned (720x1280, 25 fps, 25 s) |
| `vo.mp3` | the voice-over (ElevenLabs Adam) |
| `reference_dissection.js` | **read this first** — the reference's transcript, shot list, style system, measured camera motion, transition list, the VO transcript, the beat map (VO beat → reference asset → engine scene) and the placeholder slots |
| `engine.js` | the film. One pure function `drawFrame(ctx, t)`. The header comment explains the architecture and how to remake the film with a new VO |
| `preview.html` | scrubbable silent preview of `engine.js` in a browser (fonts fall back to Helvetica/Arial there) |
| `render_seg.js` | renders a frame range straight into ffmpeg (raw RGBA pipe, no PNGs) → one MP4 segment |
| `drive.sh` | renders all missing 130-frame segments within a ~36 s budget; run it until it prints `ALLDONE` |
| `build.sh` | concatenates the segments, normalises the VO, muxes, final x264 encode |
| `render.js` | stills at given seconds (`node render.js out preview 1.2 3.4 …`) or PNG frames |
| `load_assets.js` | picks up placeholder replacements from `assets/` |
| `fonts/` | Caveat (script), Permanent Marker (unused alt). Bold/regular grotesque = TeX Gyre Heros from the system (Helvetica clone) |
| `ref_words.json`, `vo_words.json`, `*.srt` | word-level transcripts of both audio tracks |
| `measurements.json` | raw measurements (per-frame luminance/diff of the reference, phase-correlation motion) |
| `sheet_ref.png`, `sheet_final.png` | contact sheets of the reference and of the clone |
| `look/` | frame-by-frame crops used to measure the caption reveal and the whips |

## Run it

```bash
npm i @napi-rs/canvas          # prebuilt binary
./drive.sh                     # repeat until it prints ALLDONE (each call renders ~260 frames)
./build.sh                     # -> problem_steps_proof_clone.mp4
```

`SC=1 ./drive.sh` renders at 720x1280 (faster). `drive.sh` skips segments that already exist, so a
one-beat change only re-renders the segments that beat touches — delete those `seg/seg_XXXX.mp4` first.

## Replace the placeholders

Drop files into `assets/` and re-render the affected segments:

- `assets/card1.png` … `card4.png` — 9:16 stills of the finished video (scene `finished`, 28.9–33.6 s). Drawn object-fit cover inside the four cards.
- `assets/post.png` — 1:1 still for the Instagram post media (scene `comment-tool`, 46.4 s → end).

Both currently use procedural stand-ins (caption frame, motion bars, waveform, "3×", and a "PROBLEM / STEPS / PROOF" tile). The handle in the post header is the string `'justin_lords'` in `igPost()`.

## How the reference was dissected (method, so it can be repeated on any reference)

1. `ffprobe` both files; extract every frame (`fps=25`) and a 2 fps contact sheet; look at it.
2. Transcribe both audio tracks word-level (faster-whisper via `tools/transcribe.py`).
3. Per-frame mean luminance + mean absolute frame difference → finds fades, hard cuts, whips and the 8-frame strobe (`measurements.json`).
4. Phase-correlation between consecutive frames → the camera's translation per frame. This is what showed the camera is **hold → eased move → hold**, not a continuous drift (`reference_dissection.js → reference.motionPer0_2s`).
5. Frame-by-frame crops of individual word reveals → blur-in over ~5 frames with a slight rise, script words grow from ~0.85, bold words settle from ~1.12 (`look/reveal1.png`, `look/reveal2.png`).
6. Close reads of the objects (clock card, "?" panels, pill morph, tilted screen, Instagram rail) → rebuilt as canvas primitives in `engine.js`.
7. The VO's word onsets become the `t` of every caption; the beat map decides which reference board type each VO beat borrows.

## Where things live in engine.js

- captions: `W_(voTime, 'word', 'bold' | 'light' | 'script', px)` inside each scene's `draw`
- camera: `keys: [K(t, dur, x, y, z, rot, [driftX, driftY])]` — one key per word cluster
- transitions: `TRANS` — `whip` (continuous camera move, both boards in one world), `cut`, `xfade`, `strobe`
- typed sentence on the UI screen: `TYPED`
- palette and type colours: `C`
