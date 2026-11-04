# Wumpa reference revision — 5 November 2026

Runtime source: `37dedc7a0cb0788180551410934a757b6205035c`, based on published
`28dc012efe798234a90ab861f569e3e6e3391e55`. The accompanying documentation and
evidence commit does not change the runtime. This replaces the visual first pass;
`../validation/` is historical evidence, not proof of the revised material.

The [reference study](https://www.artstation.com/artwork/Aq6bKo) guided taller,
uneven fruit bodies, fuller shoulders, red/orange/gold ripeness, fresh green bases,
folded leaves and curved stalks. All geometry and material patterns are authored
in source. No downloaded mesh, image texture or Tripo generation is used.

## Visual review

- `classic-detail-native.jpg`: soft scene-lit highlight, subtle skin texture,
  folded and veined crown, curved stalk, front detail at MAX.
- `collection-native.jpg`: all six silhouettes and crown arrangements at MAX.
- `wild-gold-shade.jpg`: detail under cooler shade lighting.
- `sunset-release.jpg`: warm lighting and release deformation.
- `collection-flight-720p.jpg`: ordinary-resolution collection motion.
- `banana-native-cluster.jpg`: loose fruit on the boardwalk, full game lighting.
- `jungle-full-before.jpg` and `banana-native-before.jpg`: visible runtime
  diagnostics alongside supported clusters before collection.

Gallery review also covered each variant, three-quarter/back/top/underside views,
drag orbit and turntable. The oversized blossom scar and small stalk rim/normal
seams found during review were corrected before these final captures. Each
complete fruit uses 4,352 or 4,904 triangles; no camera-distance mesh swap exists.

The gallery is a lighting inspection tool using the same geometry, material and
morph implementation as gameplay. Its stronger studio lights are not added to
the game. Browser captures are 1280 × 720 CSS pixels; MAX renders a 2560 × 1440
drawing buffer. The game canvas dimensions are recorded separately because the
runtime quality summary reports CSS size.

## Gameplay review

The local-only `fruit-runtime-review.html` provides visible actions that drive
ordinary Player input. It does not award fruit or change pickup alive state.

| Evidence | Mode | Result |
| --- | --- | --- |
| `jungle-lite-collected.json` | Jungle arrival, lite | 6 collected, 6 credits, 0 deaths |
| `jungle-full-collected.json` | Jungle homeward cluster, full 720p | 6 collected, 6 credits, 0 deaths |
| `jungle-crate-collected.json` | Jungle crate, full 720p | Crate broken, 7 credits including nearby fruit, 0 deaths |
| `banana-native-collected.json` | Banana Bay arrival, full MAX | 6 collected, 6 credits, 0 deaths |

All reviewed flights retired cleanly. The later Banana Bay boardwalk cluster
was visually reviewed at native resolution. `jungle-normal-canvas.json` records
1280 × 720; `banana-native-canvas.json` records 2560 × 1440. Gallery, Jungle lite,
Jungle full and Banana native warning/error logs are empty.

## Focused checks

All three checks passed. `checks.json` records exit codes, exact source SHA and command durations for
`npm run check:milk`, `node tools/test-character-interactions.mjs` and
`npm run build`, run with Node 22 under the shared heavy-job guard.

The production build includes type-checking, bundling and release-asset preparation.
It completed successfully at approximately 20:54 UTC on 4 November. Its 1,266.7
seconds are build time, separate from the approximately 24-minute art/gameplay
review interval. The heavy lease was released after completion.

The milk checks cover complete geometry, material behavior, morphs, pooling,
scene depth isolation and instanced morph parity. New checks verify rooted leaf
flex weights, sealed stalk rims, and smooth bark seams in every normal target.
Player interaction checks exercise actual collection and reward contracts.

No level data, cluster placement, movement tuning or shared level-pack snapshot
changed in this revision. The already-published 54-fruit placement/lifecycle
fixture remains applicable to those unchanged sources. No whole-game suite or
duplicate release/deployment audit was run. The dev terminal repeats the existing
Carlisle manifest import warning; there is no corresponding browser error.

Publication is handed to the active release coordinator. This evidence establishes
local behavior and rendering, not public deployment or user art approval.
