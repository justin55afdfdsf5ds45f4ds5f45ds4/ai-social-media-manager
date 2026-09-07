# S01 · Collage style

Source: `Learning materials/ref/refA–C.mp4` measured frame by frame; outputs `Learning materials/output/
motionvid-02/03-collage.mp4` (the ones the owner approved). Engine: Remotion `CollageTemplate.tsx`, newest copy
in `C:\YouTube Automations Builds\Talking head AI Ads God\studio` (public repo `collage-pipeline`).
Full rule set: the repo's `docs/MOTION-RULES.md`, `docs/SPEC-FORMAT.md`, `docs/REF-NOTES.md` and the old
project's memory notes (summarised here).

## The look in one line
Paper-cutout collage on a lit table: green felt / dark chalk grid / cream paper backdrops with drifting light
bands and dust, sepia photo cutouts, paper props, word-timed poster type, speed-ramped motion, pop rings for
the finale.

## Frame
1080 × 1920 at 30 fps. `safe: true` (Reels safe zone: top 240, bottom 320, left 60, right 150).

## Backdrops
felt `#0B3322` (home) · chalk `#29292B` · paper `#EDE4D0` · purple `#221A42` · pop rings yellow/blue for the
finale and CTA only. No sky, no grass. Two diagonal light bands (−40°), breathing light pool, 42 dust specks,
live grain, deep vignette, camera float 9 px + 0.35° roll.

## Type
Big word Arial/Helvetica Bold silver `#C9C4B5` through a halftone, 0.12 W · gold word Arial Rounded MT Bold
`#CF9A2C` 0.57× · pre-words Times Italic 0.36× · comic word Lilita One · notes Caveat. Flat, screen-locked,
left-aligned compact stack, lockup centre ≈ 0.20–0.26 H, words slide up 8 frames.

## Props (asset ids A-*)
A-sticker (cutout, sepia) · A-polaroid · A-doc (PDF page, `real` A4 letter) · A-phone · A-screen (browser with
recording) · A-clock · A-chart (bars grow, card blows apart) · A-eye (blinks) · A-paint (red stroke + stencil) ·
A-newspaper · A-calendar · A-envelope · A-bubble (typed prompt / CTA word) · A-starburst · A-arrow · A-xmark ·
A-silhouettes · A-note · A-progress. Banned: tape/stamp labels, emoji.

Cutouts (C-*): founder-couch, founder-facepalm, founder-typing, founder-night, handshake, investor-a/b, investors,
bored-phone. Footage (F-*): motionvid home-typing / editor-build / editor-chat / projects. Samples (V-*): the nine
real MotionVid renders in `library/clips/motionvid-samples/`.

## Motion
Speed ramps on both keys: in-frame `bezier(.7,0,.2,1)`, entrances `bezier(.6,0,.12,1)` over 28 f starting just
inside the frame, no smear, no bounce. Props idle (push 1 → 1.07, sway) and LEAVE before the next arrives.
Camera static inside a scene except one ramped `push` (0.35–0.6 s, ≤ 1.4×) on the emphasis word; between scenes
`pan-left` / `pan-up` (18 f) or a hard `cut` for pop scenes. No spiral, iris, vortex, hanging tilts.

## Scene vocabulary (reuse)
"PDF" → only the document · "nobody is reading it" → the eye shuts · "hours" → one wall clock + fast push ·
"numbers moving" → MRR card, bars grow, card shatters · "investors watch" → two cutouts flank the document ·
"phone" → phone centred, reader overlapping · prompts → `bubble` · CTA → bubble word + envelope + logo card.

## Audio
Riser at 0 s · only the owner's Button sounds (button_0–3) on landings, 2 f ahead, same-class within 2 f dropped ·
music bed ≈ 12 dB under the voice (`musicVolume`) · real MotionVid clips inside polaroids always muted.
