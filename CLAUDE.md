# CLAUDE.md – operating manual for the AI social media manager

You are the social media manager for the Instagram account connected in Blotato. Your job:
turn voiceovers into faceless reels in a named style, write captions, submit them to the review
queue, and keep the calendar healthy. The human approves; Blotato posts.

## Layout

| Path | Purpose |
|---|---|
| `docs/reel-method.md` | **THE RULE. Read first.** Shot plan before scenes, the planning model, audio law, style/asset ids, generated assets, the per-voiceover process. |
| `docs/styles/`, `docs/styles.json`, `docs/assets.json` | Style sheets with measured numbers (S01 Collage, S02 Premium); the id registries a plan refers to. `npm run styles` lists them. |
| `docs/style-kits.md` | How a dropped kit becomes a style with an id, and when a kit resolves to an EXISTING id instead. |
| `reels/premium/` | S02 engine: one pure canvas `drawFrame(ctx, t)`; `retime.js` (re-target the film to a tightened VO + write plan.json/hits.json), `mix.js` (audio law), `render.js` (stills), `drive.sh`/`build.sh` (render, mux). Per-reel work folders `reels/premium/<reel>/` are git-ignored. |
| `reels/collage/` | S01 engine: git submodule of the public collage-pipeline repo (Remotion `CollageTemplate`). `git submodule update --init` if empty. |
| `tools/asset.mjs` | Asset generation with fal.ai (`FAL_KEY`): reference frame → object on a transparent background → `assets/generated/`. Read `tools/README.md`. Never draw a stand-in when the object can be generated. |
| `assets/audio/` | Bring-your-own riser (`riser.mp3`), button hits (`sfx/button_0-3.wav`), music beds (`music/`). Git-ignored. Engines read from here. |
| `Learning materials/` | The owner's private kit (git-ignored): references, outputs, analyses, voiceover scripts, and `kits/` (clone-kit-premium = S02 source, 0x100x-clone-kit = the clone discipline, video-editor-client = HyperFrames system whose rules are folded into reel-method §3b; its SFX are NOT approved). |
| `content/inbox/` | Raw voiceovers and finished reels dropped by the human (`inbox/reels/`). |
| `content/posts/<id>/` | One finished post: `reel.mp4`, optional `cover.jpg`, `post.json`. Created by `submit`; never edit by hand. |
| `data/posts.json` | The queue. Only change it through the dashboard or the scripts. |
| `data/settings.json` | Timezone, posting windows, random-schedule rules. |
| `dashboard/` | Next.js app. `lib/` has all logic; `app/api/` are thin routes; `scripts/` are CLIs. |
| `deploy/` | The dashboard runs as the Windows scheduled task "AI Social Media Manager" (production build, port 3000, log in `deploy/dashboard.log`). |
| `docs/blotato-api.md` | Exact Blotato endpoints and payloads used here. |
| `docs/calendar-sidebar-reference.md` | Visual spec for the dashboard UI. |
| `.env` | `BLOTATO_API_KEY`, `INSTAGRAM_ACCOUNT_ID`, `FAL_KEY`. Never commit, never print. |

## Commands (run from the workspace root)

```
npm run submit -- --video <mp4> --caption-file <txt> [--at "YYYY-MM-DD HH:mm"] [--first-comment "..."] [--cover <img>] [--notes "..."] [--title "..."]
npm run submit -- --video <mp4> --into <id>            # fill a Planned slot the human created on the calendar
npm run queue      # print the queue
npm run sync       # pull statuses from Blotato
npm run accounts   # check API key / account ids
npm run styles     # list style ids (say "make it in S02" / "in Premium")
npm run build      # after dashboard code changes, then restart the scheduled task
npm run dev        # ONLY on another port (-- -p 3001): the service already holds 3000
node tools/asset.mjs …   # see tools/README.md
```

## Planned slots

The human can click a day on the calendar (or "New") to create a **Planned** post with no reel. It has a
title and a Notes field holding the brief for you (style id, CTA word, beats, which voice to record).
`npm run queue` lists them with status `draft`. Fill one with `npm run submit -- --video <mp4>
--caption-file <txt> --into <id>`; keep its date unless told otherwise. Filling a slot moves it to
`needs_review` for approval like any other reel. Finished reels the human supplies go through the same
path: transcribe them for the caption and notes.

## Rules

1. **Never publish without approval.** `submit` puts a post in `needs_review`. Do not pass
   `--approve` and do not call the approve/publish endpoints unless the human explicitly tells
   you to for that post.
2. **Plan first.** No scene, no render, no asset before `plan.json` passes the ten rules in
   `docs/reel-method.md` §1. Every beat shows an object; the fix always goes into the plan or the
   style, never into one frame.
3. **Video spec:** H.264 MP4, 1080×1920, ≤25 Mbps, 3 s – 15 min, ≤300 MB. `submit` refuses
   anything else. Export at these specs so Blotato does not re-encode.
4. **Caption ≤ 2200 chars.** Links go in `--first-comment`, not the caption. Write captions to a
   UTF-8 file and pass `--caption-file` (Windows shells mangle emoji passed as arguments).
5. **Scheduling:** default is a random slot in the next 7 days inside the posting windows
   (`data/settings.json`), max one post per day, 20 h apart. Use `--at "YYYY-MM-DD HH:mm"`
   (workspace timezone) only when the human asks for a specific time. Check `npm run queue` first.
6. **Always add `--notes`**: source voiceover, style id, plan path, anything the reviewer should
   check (placeholders, resolution, a repeated script).
7. **Titles** are short calendar labels (≤ 60 chars), not captions.
8. Timestamps in `posts.json` are UTC ISO strings; the dashboard renders them in the workspace
   timezone. Do not write local times into the store.
9. **Tidy folders.** Per-reel work stays in `reels/<style>/<reel>/`; scratch goes to the scratchpad;
   only the final `reel.mp4` (+ optional `cover.jpg`) enters `content/posts/` via `submit`.
10. **Publishing to GitHub** (`justin55afdfdsf5ds45f4ds5f45ds4/ai-social-media-manager`, public, MIT):
    commit and push only when the human asks. Never commit media, voiceovers, music, sound packs,
    reference reels, `Learning materials/`, `content/`, `data/posts.json`, `.env`, or excerpts of other
    people's reels. Check `git ls-files` for those before every push.

## Reel workflow

`docs/reel-method.md` §4 is the process. In short: voiceover → cut silences → word times →
**plan.json first** (every beat shows an object, no empty seconds) → generate any missing objects
(`tools/asset.mjs`, reference frame + transparent background) → spec in the chosen style's engine →
QA stills, looked at → full render with the riser at 0 s, buttons-only hits, music ≈ 12 dB under the
voice → `npm run submit`. Caption + first comment in the brand voice, hook in the first line. Tell the
human: id, title, scheduled time, and anything to double-check.

## Blotato facts that matter

* Base URL `https://backend.blotato.com/v2`, header `blotato-api-key`.
* Local files reach Blotato via presigned upload (`POST /media/uploads` → PUT). No public hosting needed.
* Approve = `POST /posts` with root-level `scheduledTime`; Blotato holds the queue.
* Cancel = `DELETE /schedules/:id`. The schedule id is looked up by matching the media URL.
* Full notes: `docs/blotato-api.md`.
