# Beach Street kite run

The kite owns forward speed. The player owns lateral position and jump timing.
Left/right steers continuously; Jump presses launch immediately and holding adds
lift. There is a brief wind-up at the start and after checkpoint respawns.
Forward/brake, grinding and board-abandon inputs cannot stop or detach the tow.
Crashes and missed canals spend a life through the existing fatal presentation.

The original three-kilometre street grades, four canal gaps, finish and solid
offshore islands remain. Coral launch ramps/stair terraces, teal obstacles and
cream coping retain the accepted visual treatment. The canopy, inflated frame,
struts, control bar and four lines are procedural geometry at every distance.
The existing elastic skateboard animation retains planted feet and landing
compression; the final two-arm IK pass keeps both glove grip sockets on the bar.
The kite lives outside the player hierarchy and cannot enlarge the hitbox.

## Encounter intent

| Section | Lesson | Development |
| --- | --- | --- |
| Market, 0–430 m | Steer right, then left; one isolated hop | S-turn, breathing space, checkpoint, first canal |
| Harbour, 441–900 m | Freight occupies one side with an always-clear opposite lane | Swap sides, hop after settling, avoid a paired patrol, canal |
| Cliff / Surf, 912–1810 m | Wind rises from 20 to 23 m/s | Uphill hop, terrace view, turtle crossing, shorter S-turn, canal |
| Festival / Lighthouse, 1823–2680 m | Wind reaches 25 m/s | Freight S-turn, uphill hop, contrasting terraces, final canal |
| Home stretch, 2694–3005 m | Reprise familiar controls | Left/right reversal, final hop, crate ribbon and finish |

There are 52 authored beats, 13 jump cues, ten checkpoints and ten enemies in
four readable types. A fruit line anticipates lane changes and lifts over jump
arcs. Enemies are confined to the occupied side; their patrol phase cannot close
the suggested lane. Mandatory jumps have clear takeoff and landing space.
Checkpoints precede the canals and introduce the later sections. No random
placement or global tuning changes are involved.

## Validation entrypoints

- `node tools/test-kite-motion.mjs`: acceleration, brake immunity, steering,
  jump edges, coyote time, landing buffer, tap/held arcs and reset.
- `node tools/test-beach-kite.mjs`: connected native journey using only movement
  inputs, all jumps/checkpoints/collectible progression, fatal wall/hurdle/gap,
  checkpoint retry, explicit schema and isolation when changing levels.
- `node tools/test-kite-progression.mjs`: supported forward gem pickup in kite
  mode and exact preservation of ordinary side-of-gate gem placement.
- `node tools/review-beach-kite-pacing.mjs`: light review of 42 lane transitions
  and the measured landing-to-next-approach spacing. This supplements native
  collision evidence; it does not simulate the complete scene.
- `node tools/beach-kite-browser.mjs --lite`: connected keyboard journey with
  DOM key events, no position/velocity writes after the initial start reset.
- `node tools/beach-kite-browser.mjs`: full-render journey, normal CRT play and
  MAX/native captures, console/asset checks and measured hand contact.
- `node tools/validate-beach-kite.mjs`: sequential motion/native/coastal checks,
  the complete `check:levels` package script and production build. Invoke through
  the shared release queue's `run_heavy.py` capacity guard. `--build-only` records
  a later presentation-only rebuild separately without replacing prior checks.

`native.json`, `checks.json` and `browser-*.json` record outcomes and timings.
Production assets and integration/publication belong to the release coordinator.
