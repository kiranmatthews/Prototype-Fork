# Warehouse visual refinement — first pass

Goal opened 17 October 2026 at 10:19:59 UTC. The target remains [the original ImageGen concept](arrival-target.png). This is an incremental presentation pass, **not a claim that the rendered park now matches the concept's overall quality**.

## Rendered changes

- Redirect daylight through the existing window openings onto the narrower room's actual skating floor. Keep real window-grid shadows, add warmer lower lamps, and give two of the four bounded local lights real shadows. Light assignments fade before reuse so pools do not jump between fixtures.
- Preserve all original Meshy wall surfaces and atlas UVs. No wall tile, new surface image, paid asset, or camera override was introduced.
- Use the existing Poly Haven concrete at a more readable scale, distinguish dry surfaces from shallow water, and place sourced staining locally around leaks and margins. Retain the existing planar reflection and bounded environment probe.
- Give flat concrete caps proper shading creases, add thin coping and deck fascias, and follow the actual halfpipe profile with plywood sheet seams and end panels. These are ordinary source-owned render components; native riding triangles and grind boundaries remain authoritative.
- Add four pieces from the existing graffiti atlas and three shallow original-model workshop fittings. Lower the hoist into the Crane district and raise the decorative crossbeam above the reward-camera view. Correct dark greybox tints that were multiplying the already-painted steel map into black.
- Retain the competition camera, optional walking, all five objectives and the existing movement tuning.

## Iteration evidence

Six fixed review stations use the player's normal competition camera. Respawning for these screenshots is explicitly an art-review operation, not traversal evidence. Original captures are kept without image edits.

| Pass | Arrival capture, minutes after goal opened | Evidence directory |
|---|---:|---|
| Baseline | 8.58 | `/private/tmp/warehouse-visual-before` |
| Daylight and lamp placement | 24.23 | `/private/tmp/warehouse-visual-light-01` |
| Local shadows and construction details | 55.70 | `/private/tmp/warehouse-visual-detail-02` |
| Localized wear and water | 110.98 | `/private/tmp/warehouse-visual-wear-03` |
| Concrete creases and reflection balance | 134.03 | `/private/tmp/warehouse-visual-surface-04` |

The integrated final review is `/private/tmp/warehouse-visual-final-profile`. Native-resolution review is a temporary test setting; the release preserves the user's render-quality preference. The first playable visual correction was verified at **24.23 minutes**. Later work included repeated image review, playthroughs, main-branch integration and release checks.

## Gameplay and renderer checks

- Native art parity: 32 riding surfaces, 1,978 finite UV triangles, 194 measured halfpipe profile edges, unchanged support/grind topology and identical movement through 1,091 recorded input frames.
- Source/enclosure, ordinary rail catches, six halfpipe pump/return cases, checkpoints and complete collectible lifecycle pass.
- Historical bank collision, native ramp underpass/top/ceiling and optional mount/brake/dismount regression pass.
- Shared-camera regression passes 163 protected steep/vert samples, 30/60/120 Hz parity and four actual vert routes.
- Actual walking-camera test: 315 rendered on-foot observations; 48 settled samples after opposing turns; maximum horizontal camera-heading error **0.00043°**; shared FOV **49°**; no level camera rig or forced boarding. Reproduce with `node tools/test-warehouse-walking-camera.mjs <game-url>`.
- Full-render east-first collectathon: **67.52 s**, order **3, 4, 5, 1, 2**, real gate finish, zero bails/deaths/snaps/errors. Evidence: `/private/tmp/warehouse-visual-five-goal-05`.
- Full-render west-first collectathon after final integration: **84.05 s**, order **5, 1, 2, 3, 4**, real gate finish, zero bails/deaths/snaps/errors. Evidence: `/private/tmp/warehouse-visual-west-final`.
- Both complete plans explicitly include walking connectors. Neither is presented as an uninterrupted five-goal skating combo.
- Renderer lifecycle: all **144 original wall sections** retain UVs within 0–1; no mapped backing or repeated brick-map request. Finite environment pixels, compressed assets, three leave/return cycles, two WebGL recoveries and portrait/landscape views pass. Repeated warehouse residency stays at 262 geometries and 109 textures; away residency returns to 117 and 68. Evidence: `/private/tmp/warehouse-visual-stability`.
- Required `check:levels` and production build pass. No full-suite run.

## Completion audit and next pass

The camera, optional walking, original-wall-material and gameplay-preservation requirements have direct passing evidence. The quality requirement is still incomplete: the central floor and broad ramp faces remain visually sparse compared with the concept, the architectural detail does not yet have the same depth at the fixed playing angle, and some water patches read as bright ovals rather than convincing irregular wet areas. A brighter screenshot alone does not close those gaps.

Continue from these actual captures, improve those specific weaknesses with the existing/source-licensed assets, and recheck the moving camera. Do not use the concept as proof of implemented fidelity or change the camera to imitate its framing.
