# Reel method – the standing rules for every faceless reel

Learned from `Learning materials/` (the collage system, its references, the owner's feedback rounds) on 2026-09-06.
Two engines exist: S01 Collage (`reels/collage`, Remotion) and S02 Premium (`reels/premium`, canvas). We do not build
new engines for a voiceover; we build PLANS and ASSETS for a named style, and a new engine only when a kit is a new style.

## 0. The one rule above all: the shot plan comes first

Before a single scene is written, before any render, the AI writes `plan.json` for the voiceover. The plan is judged
on its own, then the spec is generated from it. **A reel is never made without a plan, and a plan is never approved
with an empty beat.**

Why: the collage style only works when something meaningful is on screen at every moment. Past reels went static
(2 s of felt and a caption) whenever the AI ran out of ideas mid-sentence. The plan makes that impossible to miss.

## 1. The planning model (`content/posts/<id>/plan.json`)

One entry per **beat**. A beat is a stretch of the voiceover (0.7–4 s) that carries one idea.

```jsonc
{
  "style": "S01",                          // style id (see §3)
  "voice": "vo-tight.mp3", "words": "vo-tight.words.json",
  "beats": [
    {
      "id": "b01", "from": 0.00, "to": 2.84,
      "says": "If you're still cutting your videos clip by clip",
      "idea": "the pain: raw clips, one by one",
      "show": [                              // ≥ 1 object on screen for the WHOLE beat, never zero
        { "asset": "A-polaroid", "as": "clip 01", "on": "clip", "at": 1.50, "enter": "pop", "until": null },
        { "asset": "A-polaroid", "as": "clip 02", "on": "by",   "at": 1.94, "enter": "pop" },
        { "asset": "A-polaroid", "as": "clip 03", "on": "clip", "at": 2.18, "enter": "pop" }
      ],
      "type":   { "big": "clip by clip", "gold": "cutting" },   // the lockup words (≤ 2 emphasised)
      "camera": { "enter": "cut", "push": null },
      "sound":  ["button@1.50", "button@1.94", "button@2.18"],
      "why": "'clip by clip' -> three raw clips slap down one per word",
      "gap_check": "0.0–1.5 s: felt + type only = 1.5 s. Covered by the opening push (1.25 → 1.0). OK"
    }
  ]
}
```

Rules the plan must pass (the AI checks them before rendering, and says so):

1. **Something is always showing.** Every beat lists at least one object visible from `from` to `to`. If the previous
   beat's object stays, say so (`"holds": "b01.clip 03"`). "Type only" is allowed for at most 1.0 s and only in the
   first beat or under a camera push.
2. **The object comes from the words.** `on` names the spoken word that triggers it and `why` quotes the words. If a
   prop cannot be justified by a spoken word, cut the prop, not the rule.
3. **One idea per beat, 1–2 props.** Three only when the words count things (clip / by / clip).
4. **Show it, then say it.** A prop lands on or ≤ 0.2 s before its word, never after.
5. **Nothing dead on the table.** A prop that is done leaves (`until` + `exit`) before the next one arrives, or the
   camera pushes onto it. No prop sits still for > 3 s without an action (push, path, exit, chart grow, clock spin).
6. **Safe zone.** All props, type and captions inside the Reels centre zone (`safe: true`). Corners are decoration only.
7. **No emoji, no tape/stamp labels, no sky/grass, no spiral/iris.** Sepia cutouts, paper props, drawn marks, real
   screens. (Owner's bans from the feedback rounds.)
8. **Motion = speed ramps, no smear.** Ease in AND out; entrances start just inside the frame; no bounce.
9. **Type is small, flat, screen-locked**, lockup centre ≈ 0.20–0.26 H, ≤ 2 emphasised words per sentence.
10. **Ends with the CTA beat** (bubble with the comment word, envelope, logo card) unless the script has no CTA.

## 2. Audio rules

| Layer | Rule |
|---|---|
| Voice | Untouched except `cut_silence.py` (silences only, max pause 0.22 s). Transcribe AFTER cutting. |
| Riser | `assets/audio/riser.mp3` (2.28 s, peak −1.2 dB). **In every reel, at t = 0, as-is, gain 1.0.** No normalising, no trimming. |
| Hits | Only the owner's Button sounds (`assets/audio/sfx/button_0–3.wav`) on prop landings and cuts, 2 frames ahead of the visual. |
| Music | A bed from `assets/audio/music/` (the owner's Notion library), **≈ 12 dB under the voice peak** (the owner's "50 % lower" – half as loud). Fades in over 20 f, out over 40 f. Adjustable per reel with `musicVolume`. |

## 3. Styles and assets have ids

**Style** = one reference reel measured and turned into template parameters + rules. Registry: `docs/styles.json`.

| id | name | source | status |
|---|---|---|---|
| S01 | **Collage** (felt / chalk / paper, cutouts, pop rings) | ref/refA–C, motionvid-02/03 | approved by owner |
| S02 | **Premium** (dark text board, Helvetica + script, glass objects, whip camera) | `kits/clone-kit-premium` | engine proven 2026-09-06 |

Sheets with the measured numbers: `docs/styles/S01-collage.md`, `docs/styles/S02-premium.md`.
Registries: `docs/styles.json`, `docs/assets.json`. Engines: `reels/<style>/`.

**Asset** = anything that can be placed in a scene: a prop kind from the template (`A-clock`, `A-doc`, `A-eye`…),
a cutout (`C-founder-facepalm`), a footage moment (`F-motionvid-home-typing`), a sample clip (`V-style-vox-collage`),
a sound (`X-button-0`, `X-riser`). Registry: `docs/assets.json`. Each entry: id, kind, file, what it means
("time passing", "not reading", "the product"), which styles it fits, owner rating.

Picking a style is picking its asset kit. New references add a style and its assets; they never overwrite S01.

## 3b. Laws borrowed from the video-editor kit (`Learning materials/kits/video-editor-client`)

Adopted because they match what the owner already asked for:

* **SFX law:** sounds come from graphic events, one hit per prop entrance, a cut's sound leads it by 2 frames,
  a same-class hit within 2 frames is a doubling and is dropped. Hits sit just under the voice peak.
* **Music:** a bed ≈ 12–18 dB under the voice, one per reel, fade in short, fade out long; never a silent tail.
* **Density:** something visual happens constantly; the longest bare stretch in a reel is 1.0 s (our rule 1),
  and a visual sentence gets continuous coverage for its whole length.
* **Readable text holds:** anything the viewer is meant to read (a prompt, a list) sits complete for ≥ 2 s;
  budget the type-on backwards from the hold. Type-on in word bursts (2–6 words), longer pause after punctuation,
  never one character per frame, never `Math.random`.
* **Vary by role, not by count:** peers share one entrance; the payoff element gets the different one. Exits
  never vary.
* **State changes animate** over the move that motivates them; nothing switches in one frame except a cut.
* **A held element floats** (x/y on different periods, a few px, zero rotation) for its whole life.
* **Screens are objects:** a raw screenshot is never parked; give it a border, vignette, a slow drift, grain.
* **Real artifacts beat drawn ones:** if the script points at a real thing (a post, a page, a tool), show the
  real thing.
* **No pure white; every effect at half of what first looked exciting.**

## 3c. Generated assets

When a plan needs an object the style kit lacks, generate it, never draw a stand-in: `tools/README.md`. Reference
frame first, native transparent background, segmentation only for opaque objects, chroma key last. A generated
asset gets an id (`G-*`) and the same justification rule as any prop.

## 4. The process per voiceover

```
content/inbox/<name>.mp3
  1. cut_silence  -> vo-tight.mp3 (+ cuts.json)
  2. transcribe   -> words.json (faster-whisper, word times)
  3. PLAN         -> plan.json  (this document's §1; checked against the 10 rules; shown to the owner on request)
  3b. ASSETS      -> every object the plan names that the style kit does not have: tools/asset.mjs (fal.ai), reference
                     frame + native transparent background, saved to assets/generated/<style>/ and given an id in docs/assets.json
  4. spec         -> S01: studio/src/videos/<id>.ts · S02: reels/premium/<id>/engine.js SCENES/TRANS/TYPED (from the plan)
  5. QA stills    -> 6 frames with showSafeZone, one per beat with a prop; fix the plan, not the frames
  6. render       -> reel.mp4 (GPU flags), music + riser + buttons mixed in the template
  7. submit       -> npm run submit -- --video reel.mp4 --caption-file caption.txt --notes "plan summary"
```
The owner approves in the calendar. If a reel is rejected, the fix goes into the plan or the style rules, never into
one-off frame edits.
