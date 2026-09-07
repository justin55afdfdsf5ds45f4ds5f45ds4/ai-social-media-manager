# Style kits – how a folder becomes a style with an id

A **kit** is any folder that teaches the AI a look. Typical contents:

```
kits/<name>/
  README.md            what it is, what the reference is, what was measured
  reference.mp4        the reel being cloned (kept local, never published)
  *.zip                a nested kit, tools, or an editor project – unzip it in place
  assets/              footage crops, stills, logos, cutouts
  fonts/               the type the reference uses
  tools/  *.py  *.js   motion tools: trackers, scorers, contact-sheet makers
  *.json               measurements: per-frame tables, colours, word times, beat maps
```

Drop it in `Learning materials/kits/<name>/` (private) and say *"make a style out of this"*.

## What the AI does with a kit

1. **Unzip and read everything.** README first, then measurements, then the code. Look at the reference
   as contact sheets (`ffmpeg -vf "fps=2,tile=9x3"`), never only as text.
2. **Compare with the registered styles** (`docs/styles.json`). If the kit's look is the same family as an
   existing style (same backdrop, type system, camera grammar, object language), **do not create a new
   style**: answer with the existing id string (e.g. `S02`) and note what the kit adds to that style's
   sheet. Similar styles collapse to one id; only a genuinely different look gets a new one.
3. **Otherwise register it:** next free id `S0N`, a short name, a sheet `docs/styles/S0N-<name>.md` with the
   measured numbers (frame, palette, type, objects, camera, transitions, audio, bans), an entry in
   `docs/styles.json`, its objects in `docs/assets.json` with ids, and its engine in `reels/<name>/`.
4. **Prove the engine on this machine** before the style is usable: render stills, keep the proof sheet in
   `reels/<name>/proof/`. The style's status stays "proven" until the owner approves a reel made in it.

## Using a style

*"Make `content/inbox/x.mp3` in S02"* or *"… in Premium"*. Names and ids are interchangeable; both resolve
through `docs/styles.json`. `npm run styles` prints the table.

The reel is planned first (`docs/reel-method.md` §1), then built with that style's engine and asset kit.
Assets from another style are not mixed in unless the owner asks.

## What is never published

Reference reels, the owner's voiceovers, music, third-party sound packs and third-party kits stay in
`Learning materials/` (git-ignored). A style's sheet, engine, fonts with open licences and measurements
are publishable; that is what makes a style reusable by someone else with their own audio.
