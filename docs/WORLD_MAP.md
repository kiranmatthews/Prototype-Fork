# Island world map

The campaign hub keeps the historical level id `warproom` only for save,
replay, and tooling compatibility. Its runtime is the fixed-rail island map in
`src/worldMap.ts`; it is not a free-movement level.

## Data contract

- `CAMPAIGN_LEVELS` owns stable progress keys, generic island ids, hub poses,
  prerequisites, join rules, finale markers, and time targets.
- `CAMPAIGN_MAP_EDGES` owns graph connectivity, a unique directional input at
  each endpoint, map-only curve guides, and the `trail` or `boardslide` travel
  presentation. Every edge is regression-tested in both directions.
- Playable island lobes are generated from `CAMPAIGN_LEVELS.mapPosition`; only
  decorative cays and mountain ranges are scenery-authored. Moving or adding a
  hub therefore moves or creates its supporting island without geometry edits.
- Normal clears unlock time trial and any newly satisfied outgoing hubs. The
  first island fork is a true join: both branches are required for its finale.
- `CampaignSaveV1.mapFocus` is optional for backward compatibility. New and
  migrated saves remember the last settled hub.
- Finale markers currently reserve and dress the end-of-island hubs. They do
  not claim that their backing courses contain implemented boss combat yet.

## Input and flow

Keyboard, D-pad/stick, and touch direction changes all become one discrete map
step. Quick keyboard and touch down/up pairs are latched even when both events
occur between render frames. Movement is ignored until the current canned
travel finishes. Cross/Enter enters a hub; the map exposes Progress, Options,
Save/Load, and Quit directly.

Quit Level, Game Over No, and Results Continue pass the originating progress
key back through the shared return helper. The controller seats the character
on that exact hub and persists it as map focus. A first clear announces and
animates newly opened routes; replaying the level does not repeat the
time-trial unlock banner.

## MatrixRex ocean contract

The map uses the same full `CoastWater`/`UnityOcean` owner as the ocean levels:
planar reflection, opaque color/depth prepass, refraction, projected caustics,
intersection foam, two-way normals, Gerstner displacement, specular, shadows,
and horizon fill.

Important map-specific requirements:

- The straight shore is authored from positive X to negative X with seaward
  `-Z`. Reversing that order back-face culls the detailed `FrontSide` ribbon
  and leaves only the flat, double-sided horizon visible.
- Caustics require real opaque scene depth. Every dry island lobe therefore has
  an outward submerged sand/reef shelf roughly 0.1–0.7 m below sea level.
  `terrainHeight` is sampler compatibility only; it does not create a seabed.
- The elevated map camera needs a longer caustic distance range and a lower
  reflection Fresnel exponent than the close gameplay coast. These are
  presentation-scale adjustments on the same shader, not a replacement water
  material.
- `?lite` intentionally disables reflection, prepass, refraction, caustics,
  and intersection. Judge ocean fidelity only in a full-render pass.

## Visual QA

At 16:9, water should occupy roughly a third or more of the frame. Both deep
normal/specular motion and bright moving caustics over the shallow shelves must
be obvious without opening debug tools. The selected character should remain
readable and every hub must clear mountain footprints and have visible terrain
support.

For a diagnostic pass, add `?renderdiag`, enter the map, and inspect the hidden
`#render-diagnostics` payload. Ocean quality must be `full`; reflection and
prepass dimensions and render counts must be non-zero. Also check 844×390 and
390×844 with `?touch`, then finish at 1920×1080 with a clean console.
