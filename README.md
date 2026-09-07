# AI Social Media Manager

An AI (Claude Code) that turns voiceovers into faceless Instagram reels in named, measured **styles**,
drops them into a calendar for a human to approve, and publishes through [Blotato](https://blotato.com).
You approve; Blotato posts; nothing goes out on its own.

```
voiceover.mp3 ──▶ plan.json ──▶ render in a style (S01 Collage, S02 Premium, …) ──▶ calendar ──▶ Approve ──▶ Instagram
                  (every beat            reels/<style>/                            dashboard        Blotato
                   shows an object)
```

## What's inside

| Folder | What |
|---|---|
| `dashboard/` | Next.js app: month calendar, Notion-style post page (reel player, caption, date, notes), Approve / Post now / Reject, planned slots, Blotato sync. CLI scripts: `submit`, `queue`, `sync`, `accounts`, `styles`. |
| `reels/premium/` | **S02 Premium** engine: one pure `drawFrame(ctx, t)` on a 2D canvas (node, `@napi-rs/canvas`). Kinetic typography on a dark board, glass objects, hold-move-hold camera, whips, typed-in screen, strobe CTA. `retime.js` re-targets a film to a tightened voiceover; `mix.js` applies the audio law. |
| `reels/collage/` | **S01 Collage** engine (git submodule of [collage-pipeline](https://github.com/justin55afdfdsf5ds45f4ds5f45ds4/collage-pipeline)): Remotion template, paper-cutout collage on a lit table, speed-ramped motion. |
| `docs/reel-method.md` | The rules. Shot plan before scenes, the planning model, audio law, style and asset ids, the per-voiceover process. |
| `docs/styles/`, `docs/styles.json`, `docs/assets.json` | Style sheets with measured numbers, the registries a plan refers to. |
| `docs/style-kits.md` | How to add a style: drop a kit, the AI measures it and gives it an id. |
| `docs/blotato-api.md` | The Blotato endpoints used here. |
| `CLAUDE.md` | The operating manual the AI follows. |

## Quick start

Requirements: Node 20+, ffmpeg/ffprobe on PATH, Python 3.10+ with `faster-whisper` (transcription),
a paid Blotato plan with Instagram connected.

```bash
git clone --recursive https://github.com/justin55afdfdsf5ds45f4ds5f45ds4/ai-social-media-manager.git
cd ai-social-media-manager
npm run setup                      # dashboard deps
cd reels/premium && npm install && cd ../..
cp .env.example .env               # BLOTATO_API_KEY, INSTAGRAM_ACCOUNT_ID
npm run accounts                   # verifies the key, prints your account ids
npm run dev                        # http://localhost:3000
```

Put your own audio in `assets/audio/` (see its README): the riser that opens every reel and the
button sounds used for every hit. They are not in the repo.

Then open the folder in Claude Code and say what you want: *"make the voiceover in content/inbox/x.mp3
in Premium"*. The AI plans, renders, and submits; you approve in the calendar.

## Styles

A **style** is one reference reel measured into an engine plus rules. Each has an id. Saying the id
is enough: *"make this one in S02"*.

| id | name | engine | look |
|---|---|---|---|
| S01 | Collage | Remotion | green felt / chalk / paper tables, sepia cutouts, paper props, pop rings |
| S02 | Premium | canvas `drawFrame` | dark green-grey text board, Helvetica + felt-tip script, glass objects, whips |

Adding one: `docs/style-kits.md`.

## The rule that makes it work

Before any scene is written the AI writes `plan.json`: one entry per beat with the spoken words, the
object shown, the word that triggers it, the camera move, the sound, and a gap check. **No beat may be
empty.** The plan is checked against ten rules (`docs/reel-method.md` §1), then the spec is generated
from it. Stills are rendered and looked at before the full render. The fix always goes into the plan
or the style, never into one frame.

## Commands (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` / `npm run start` | Dashboard (dev / production build) |
| `npm run submit -- --video <mp4> --caption-file <txt> [--at "YYYY-MM-DD HH:mm"] [--notes ...] [--title ...]` | Add a reel to the review queue |
| `npm run submit -- --video <mp4> --into <id>` | Fill a planned slot |
| `npm run queue` | Print the queue |
| `npm run sync` | Refresh statuses from Blotato |
| `npm run styles` | List the registered styles |
| `npm run accounts` | Verify the API key, list connected accounts |

## Deploying

The dashboard and the engines read local files and need ffmpeg, so they run on the machine that
renders. `deploy/` has a script that keeps the production server up as a Windows scheduled task
(`deploy/install-service.ps1`). The calendar is local by design: it can approve a post to a real
Instagram account with one click, so it never sits on a public URL without a login in front of it.

## Licence

MIT. Bundled fonts keep their own licences (see LICENSE). Bring your own music and sound effects.
