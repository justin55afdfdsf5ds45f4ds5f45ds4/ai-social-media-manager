# assets/audio – bring your own sounds (not in the repo)

| file | rule |
|---|---|
| `riser.mp3` | Plays at t = 0 in every reel, untouched (no normalising, no trimming). ~2 s. |
| `sfx/button_0.wav` … `button_3.wav` | The only hit sounds. One per object landing, 2 frames ahead of the visual, rotated in order. Normalise to −3 dBFS peak. |
| `music/*.mp3` | Optional beds. A reel picks one and mixes it 12 dB under the voice (`-26 LUFS` against a `-14 LUFS` voice). |

The engines look here first (`reels/premium/mix.js`, `reels/premium/build.sh`). Anything missing is
skipped with a warning; a reel without a riser is not finished.
