# Illustrated live 3D crate HUD

The HUD crate now shares the Bone Head/fruit illustration treatment: warm brown
contours, broad lit planes, brighter carved bevels and deeper timber recesses.
The original wood texture and complete sculpt remain. The HUD surface references
the same **12,804-triangle geometry** as a world wood crate; only its material
and private back-face outline differ. No model substitution, decimation or new
bitmap assets are used.

The old view was orthographic with a 35.264° downward tilt. The chosen view uses
a **17° tilt**, **23° initial yaw** and a **100 mm lens** (19.85° vertical field
of view on the square icon gate). It emphasizes the upright faces, leaving a
shallow strip of lid. Idle rotation remains **0.6 rad/s**, or 10.47 seconds per
turn. The projected full-turn envelope fixes the scale through every angle,
including narrow Bonus/reward-flight slots.

These are visually chosen prototype settings, not recovered camera values from
the reference games. References inspected:

- [PlayStation's official N. Sane Trilogy HUD example](https://playstation-doc.net/j/crash-ps4/screen.html).
- [Original Crash 2, Turtle Woods Bonus, around 5:53](https://www.youtube.com/watch?v=bmnq7yedAzI&t=353s).
- [Original Crash 3, Toad Village Bonus, around 6:23](https://www.youtube.com/watch?v=9AbkpJD54mU&t=383s).

The comparison is an authoring page served by Vite at
`/docs/illustrated-crate-hud/compare.html`. It includes playback, tilt/lens
controls, light/dark backdrops and a small HUD-size strip. The runtime defaults
live in `src/crateHudCamera.ts`. The comparison is not part of the shipped game.

Validation on 6 November 2026:

- `node tools/test-crate-hud-camera.mjs`: 194,535 independently projected points
  across complete rotations, five aspect ratios, 50–180 mm lenses and 5–35°
  tilts; no clipping or excessive empty framing.
- `node tools/test-hud-visibility.mjs`: regular/Bonus/inventory visibility passes.
- `node tools/test-bonus-transfer.mjs`: 90 reward receipts, shared crate/fruit
  slots and portrait transitions pass. Its existing Vite harness emits a local
  sandbox WebSocket warning; assertions complete successfully.
- `npm run build` and `npm run check:release`: pass. Release output is
  2,355 files / 854,362,043 bytes, within the 1,000,000,000-byte limit.
- Real browser: regular inventory reveal/hide, a full rotation, light/dark
  comparisons, production Bonus HUD, and full rendering at MAX/native
  1920 × 1080 with CRT. No game console warnings/errors.
- Comparison confirms 12,804 source and HUD triangles, shared surface geometry,
  and distinct world/HUD materials. The asynchronous sculpt replaces its
  fallback with the same illustrated treatment.

Evidence: `comparison.jpg`, `game-bonus.jpg`, `game-max-crt.jpg`.
