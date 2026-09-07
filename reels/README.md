# reels/ – the render engines, one folder per style

| folder | style | engine | status |
|---|---|---|---|
| `premium/` | S02 Premium | `engine.js` = one pure `drawFrame(ctx, t)` on a 2D canvas (node `@napi-rs/canvas`), 25 fps, design 720×1280 rendered ×1.5 = 1080×1920 | proven on this machine 2026-09-06 (`proof/`) |
| `collage/` | S01 Collage | git submodule of the public [collage-pipeline](https://github.com/justin55afdfdsf5ds45f4ds5f45ds4/collage-pipeline) repo: Remotion `CollageTemplate`, 30 fps, 1080×1920 (`git submodule update --init`) | published |

Premium, per reel: transcribe the VO → `plan.json` (docs/reel-method.md) → edit `SCENES`/`TRANS`/`TYPED`
in a copy of `engine.js` (one scene per beat, captions `W_(t, 'word', style, px)` on the VO word onsets,
one camera key per word cluster) → stills `SC=1 node render.js out preview 1.2 5.0 …` → `./drive.sh`
until `ALLDONE` → `MUSIC=<bed> ./build.sh` → `reel.mp4` → `npm run submit`.

Style sheets with the measured numbers: `docs/styles/`.
