# S02 · Premium style

Source: `Learning materials/kits/clone-kit-premium/` (reference reel + `reference_dissection.js` + working
`engine.js`). Engine copy that renders here: `reels/premium/`. Proof: `reels/premium/proof/render-check-2026-09-06.png`.
Every number below was measured on the reference by the kit (phase-correlation motion, per-frame luminance,
frame crops), not guessed.

## The look in one line
A dark green-grey "text board" the camera flies across: kinetic typography in Helvetica bold / light with a
felt-tip script for the emphasis word, matte glass objects, translucent teal cards, screenshots as tilted
3D panels, film grain, and an Instagram "comment / save" ending.

## Frame
1080 × 1920 at **25 fps** (design space 720 × 1280 scaled × 1.5). Fade in from light grey 0.25 s, fade out
to light grey 0.3 s.

## Palette
| token | hex | use |
|---|---|---|
| bgC / bgM / bgE | `#36463f` → `#1c2621` → `#070a09` | radial background, centre to edge |
| vignette | black 0.62 at 0.78 H | steer the eye |
| grain | animated overlay ≈ 16 % | material |
| bold | `#d8dcd7` | the weight words |
| light | `#b8bfb8` | connector words |
| script | `#f1f4ef` | emphasis words |
| teal / tealD | `#3a5b52` @ 55 % / `#2b4640` | cards, pills, chips |
| panel | `#0f1412` | "?" panels, glass |
| line | white 14 % | hairlines |

## Type
| style | font | size (at 720 w) | colour |
|---|---|---|---|
| bold | Helvetica Bold (TeX Gyre Heros Bold) | 60–180 px | `#d8dcd7` |
| light | Helvetica Regular | 36–52 px | `#b8bfb8` |
| script | Caveat 700 | 80–130 px | `#f1f4ef` |

Rules: one board per idea; mixed sizes share one baseline; word gap 0.2 em; soft dark drop shadow on every
word; script only on emphasis words ("time", "video", "friend", "part two").

**Word reveal** (measured, `look/reveal1.png`): ≈ 5 frames starting 1–2 frames before the word is spoken,
blur 16 px → 0, alpha 0 → 1, rises 10 px, scale settles from 1.12 (bold) / 1.06 (light) / grows from 0.85
(script). **Words stay on the board once revealed.**

## Objects (asset ids P-*)
| id | what | notes |
|---|---|---|
| P-glass-tile | dark matte glass object, rim light top-left, deep drop shadow | people silhouette, play tile, enter key |
| P-question-panel | near-black rounded rect, 12 % white border, big "?" , light streaks | the unknown |
| P-clock-card | analog clock on translucent teal square | time passing (hands spin) |
| P-pill-morph | teal circle with a number that stretches into a pill while its label types in | numbered steps |
| P-cards-2x2 | screenshot cards, 14 px radius, 1.5 px 35 % white border, drop shadow, 2×2 grid | product results |
| P-tilted-screen | 3D-tilted UI screen, left edge near, far edge defocused; the spoken words are TYPED into its fields | the product, a prompt |
| P-timeline-panel | dark editor timeline with a cursor dragging a clip | editing pain |
| P-ig-post | Instagram post frame + action rail + white hand cursor that taps | CTA (comment / save) |
| P-link-card | small card with the link | CTA payoff |

## Camera (the signature)
**Hold → one eased move → hold.** Not a drift. Holds of 1–3 s with dx = dy = 0; then one move of 0.5–1.0 s
that starts fast and decelerates, peak 25–60 px/frame at 720 w; occasionally a slow linear creep of ≈ 4 px/f
during a hold. A move starts on the first word of the next cluster. In the engine: `keys: [K(t, dur, x, y,
z, rot, [driftX, driftY])]`, one key per word cluster.

## Transitions (asset ids T-*)
| id | rule |
|---|---|
| T-whip | one continuous camera move between two boards that live in the same world, 0.6–0.8 s, bell-shaped velocity peaking 60–130 px/f, directional motion smear; the next board's first word pops while the camera is still settling. **Never crossfade a whip.** |
| T-cut | hard cut, used once, when a panel lands |
| T-xfade | overlay dissolve, used once, into the clock board, with a small drift |
| T-strobe | 8-frame light-leak flicker (hi / lo / hi / mid / lo / hi / mid / lo = 1.0, .12, .85, .45, .06, .8, .5, 0) over a hard cut, into the Instagram beat |

## Beat grammar (how a VO maps onto boards)
The kit's beat map is the template: hook board (small light + one huge bold + a glass object) → pain board
(clock card + panel) → "?" board → short black board → tilted screen with the words typed in → 2×2 cards
→ one-huge-word board → circle-to-pill steps → script emphasis board → strobe → Instagram post + cursor.
Every beat has an object; type-only boards are allowed only for one short beat ("so I tried it").

## Audio
Voice normalised to −14 LUFS. **`Riser.mp3` at t = 0, untouched.** Music bed 12 dB under the voice
(`MUSIC=… ./build.sh`). Hits: the owner's button sounds on board landings, 2 frames ahead (to wire into
the engine's board list when the first reel is planned; not in the kit's build yet).

## Placeholders / brand slots
`assets/card1.png … card4.png` (9:16 stills of the finished video) · `assets/post.png` (1:1 post media) ·
IG handle string in `igPost()` (`justin_lords`) · `TYPED[]` = the sentence typed into the screen.

## What not to do in this style
No pure white, no emoji, no bright colours besides the teal, no bouncing entrances (the reveal is blur-in,
not spring), no continuous camera drift, no crossfades between boards.
