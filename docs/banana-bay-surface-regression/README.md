# Banana Bay surface regression

User report: unintended glossy water and sand in production Banana Bay
(`beachfront`). The initial reference to Beach Street was corrected before
source changes. Baseline: `28dc012efe798234a90ab861f569e3e6e3391e55`.

## Trace

- `f0516064` (5 October) added the shared wet-shore effect. It darkens damp sand
  and lowers its roughness from 1 to 0.24.
- `992ecfde` (15 October) introduced Banana Bay’s sunny palette and sand. Its
  water overrides reflection, normals and colours, but left specular colour
  inherited from the MatrixRex source: RGB (14.27, 22.6274, 24.66).
- `f441f4c6` (4 November) changed Banana Bay’s sky and lowered/rotated its sun
  from (0.36, 0.91, 0.22) to (0.42, 0.52, -0.74). This changed the illumination
  of the existing glossy wet material; it did not directly edit roughness.
- `49865f0a` repaired shoreline clipping and the ocean join. Archived shoreline
  [before](../banana-bay-seams/shore-before.jpg) and
  [after](../banana-bay-seams/shore-after.jpg) images already contain bright water highlights in both versions,
  so that geometry fix is not evidence of a newly introduced specular setting.
- `5a154d31` isolated Banana Bay’s sky/sun effect from other levels. That isolation
  remains in place.

The identifiable causes are the inherited HDR water glint and polished wet-sand
finish. The newer sun exposing the existing wet gloss is a causal inference
from the material and lighting history, not a claim that the sky commit added
a new gloss shader.

## Correction

`BAY_OCEAN_LOOK` supplies restrained RGB (0.45, 0.60, 0.65) specular colour.
Its existing reflection strength (0.38), caustics (0.4), surface motion, foam,
geometry and sky are preserved. The shared palette also covers the Banana Bay
bonus and saved custom levels that select the sunny-beach ocean look.

The wet-shore shader receives a material roughness uniform. Only `sunny-sand`
uses 0.92; other Unity-sand shores retain 0.24. Damp-sand colour darkening,
normal maps and dry-sand shading remain intact.

## Validation

`node tools/test-banana-bay-surface-look.mjs` passes: separate wet-material
uniforms with a shared shader program, legacy coast isolation, unchanged dry
material, bounded lagoon glint, retained reflections/caustics, 80 identical
water/shore samples across lite/full quality, editor override/reset and untouched
shared defaults.

All required checks pass using Node 22.23.3: the focused surface check,
`node tools/test-ocean-formulas.mjs`, `npm run check:levels` and `npm run build`.
The build produced 1,763 files / 775.5 MiB; offline version
`bf63a4abc8d4cd438722`, entry `assets/index-DtBJJGvE.js`,
stamp **Codex/sol fork · build 11-04 21:25 UTC**. No `check:all` ran.

Chrome review used the compiled production bundle. The local-only fixture
reinstated the published RGB and wet roughness for the before views, then
restored the source correction. It held the camera, sunlight and ocean time
(6.662200000002974 seconds) constant for the matched comparisons.

- Water: [before](water-before.jpg) / [after](water-after.jpg). The strong
  blooming glints become small restrained highlights; reflection strength
  stays 0.38.
- Wet sand: [before](sand-before.jpg) / [after](sand-after.jpg). The damp band
  remains darker; its roughness stays high instead of becoming polished.
- Gameplay: [native/MAX](gameplay-native.jpg) at 3024 × 1612 and
  [normal CRT](gameplay-normal.jpg) at 900 × 480. Keyboard movement advanced
  along the opening beach with supported ground contact and zero deaths,
  followed by a supported spawn reset. Earlier lite review also passed.
- No console warnings/errors and no reported asset failures. Full-render
  reflection and opaque-prepass counters were advancing throughout the review.
  Exact view settings and diagnostics are in [browser-validation.json](browser-validation.json).

The broad white shoreline ribbon is the existing depth-foam layer. A separate
layer-isolation check confirmed that it is distinct from the specular glints;
its settings were restored and remain unchanged. Archived pre-repair images
also show that foam.

Approximately 65 minutes from the initial report to completed local review,
including the target clarification, the shared validation queue, required
checks/build and an eight-minute browser download-event stall. The actual
download succeeded; its captures were recovered from the Downloads folder.
These are wall-clock estimates, not productive geometry-authoring time.
The task-owned browser/server were closed and the heavy lease released.
Publication belongs to the active release coordinator.

