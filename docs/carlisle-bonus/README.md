# Carlisle Coast — Quayside Cargo storyboard rebuild

Six overlapping player-camera views cover the entire bonus, from x = −10 to 77 m. The source captures were made before editing. Each was redrawn with the **built-in ImageGen tool**, using Carlisle Coast’s existing mossy sandstone presentation and the first storyboard as the shared style reference. The original TNT and switch-bridge puzzles, six breakable boxes, jump distances and return gate remain.

| Section | Source | ImageGen storyboard | Playable rebuild |
| --- | --- | --- | --- |
| Arrival | [Image](before/01-arrival.png) | [Image](storyboards/01-arrival.png) | [Image](after/01-arrival.png) |
| TNT bounce court | [Image](before/02-fuse-court.png) | [Image](storyboards/02-fuse-court.png) | [Image](after/02-fuse-court.png) |
| Switch approach | [Image](before/03-switch-approach.png) | [Image](storyboards/03-switch-approach.png) | [Image](after/03-switch-approach.png) |
| Broken aqueduct | [Image](before/04-chasm.png) | [Image](storyboards/04-chasm.png) | [Image](after/04-chasm.png) |
| Receiver landing | [Image](before/05-receiver.png) | [Image](storyboards/05-receiver.png) | [Image](after/05-receiver.png) |
| Return sanctuary | [Image](before/06-return-sanctuary.png) | [Image](storyboards/06-return-sanctuary.png) | [Image](after/06-return-sanctuary.png) |

The rebuild images use the actual production gameplay camera with the HUD hidden for comparison. Source captures retain the HUD. The 18 m, 56° composition is scoped to this storyboarded bonus; it keeps the 9 m high crate visible and preserves the six views despite newer general bonus-camera defaults. Ground anchoring still follows real landings.

## Artwork and assets

- [Exact six-section prompts](prompts.json), including the role of each reference image.
- [Exact environment asset prompts](../../tools/carlisle-bonus-assets/prompts.json).
- [Original generated sky and transparent matte PNGs](../../tools/carlisle-bonus-assets/references/).
- [Runtime WebP assets and manifest](../../public/carlisle-bonus/): skybox, canyon panorama, ruined cargo quay and hanging moss. About 1.54 MiB combined transfer; alpha is retained.
- [Published comparison gallery](https://kiranmatthews.github.io/Prototype-Fork/carlisle-bonus/storyboard.html).

The foreground uses sculpted collision terrain and the existing high-detail Carlisle GLBs at their measured proportions, with their original texture atlases and licensing. The distant canyon and ruined quay have separate depth planes. Hanging moss and fine grass dress the ledge rims. All generated finals are saved in this repository; no runtime asset depends on a Codex cache path. No additional 3D provider job was purchased or submitted.

## Parent level repair

Both side-scrolling turning courts now omit the giant upper bank masses that hid the continuation. Deep foundations remain below the route, and foreground banks near the transitions cut away in side view. All four reviewed turn positions have no scenery between the camera and player.

The parent now has **1,075 solid structural scenery placements**. Ten shared collision templates are baked from the exact accepted LOD0 GLBs, using the renderer’s normalization and transforms. Their real tops join ordinary ground queries; swept capsule contacts on the sides use the existing wall-impact and rebound behavior. Camera cutaways and render LOD changes do not remove physics. Foliage and distant mattes remain visual. Roots at descending joins sit below the lower receiver, preserving the authored landing heights.

## Validation

- Bonus journey: all six boxes, gem and finish; zero deaths.
- Structural contacts: 41 standable top probes, 15 swept side probes, and a passable arch opening.
- Actual player: skates into a sandstone face at 23 m/s and rebounds at −7.36 m/s without dying; real browser input stands and walks on scenery.
- Parent geometry: 4,819 support probes, 1,944 actor footholds, 1,191 join/turn probes and 1,499 gap probes; retained channel, timber, checkpoint and gate checks.
- Lite gameplay smoke and full production browser review; console errors checked.
- `check:levels` and the production build; no full-suite run.

The first playable rebuilt bonus was captured **18.0 minutes after the prompt**. Subsequent work completed structural collisions, turn repairs, regression checks, and integration with the newer published main branch.
