# Rooftop Relay animal residents

The three goose matrons and four bulldog guards replace the human cast. Both wear storm clothing and keep the existing 1.7× encounter scale. All seven stroll on short, supported roof-aligned patrols. Bulldogs acquire and fire independently. A goose inhales for 0.9 seconds, locks direction before release, then emits a finite 18 m fatal squawk cone. Sidestepping and solid cover work; the cone and collision share the cover clip. Spawn/uber invulnerability remains effective. Ordinary masks do not absorb the fatal squawk, including while hanging.

## Art and rig provenance

The built-in ImageGen tool produced the two outfit/anatomy references, then Meshy 7.1 generated both complete PBR models. [Prompts](../../../tools/rooftop-anthro-assets/prompts.json), [references](../../../tools/rooftop-anthro-assets/references/), and [official CLI job ledger](../../../tools/rooftop-anthro-assets/tasks.json) are retained. Two successful jobs consumed 70 credits total; the recorded remaining balance is 86. No code-modeled character surfaces or human fallback models are used.

The original Meshy triangles are partitioned into 12 goose and 11 bulldog components and bound to 22 semantic bone-man controls plus 11 independent surface shafts. Semantic endpoint joints never inherit stretch. Shared editable enemy elasticity supplies breathing, planted strolling, anticipation, rebound and finite recovery; the long neck and torso compress independently. Foot IK preserves world contacts, while palm targets follow the original Meshy gun. The source native models, reference reviews and retired human GLBs are retained in the ignored authoring cache.

All 738,404 goose triangles and 1,362,932 bulldog triangles survive at every distance. Position values and oriented topology are verified exactly through lossless cache reordering and Meshopt compression. Shading-only normal/UV encoding has explicit precision bounds in the manifests; atlases retain native dimensions. Two existing rooftop scenery normal maps use native-size WebP 98 to fit the host, verifying unchanged geometry and exact color/roughness atlas bytes. No geometry simplification, roof changes, movement tuning or fog changes.

## Verification

- `tools/test-rooftop-enemies.mjs`: independent fire, patrol bounds/bearings, aim lock, safe telegraph, finite cone, sidestep, cover clipping, actual fatal Player collision and hanging paths, masks, invulnerability, reset/capture, 1.7× dimensions.
- `tools/rooftop-anthro-review.mjs`: native 2560×1440 static views and three complete 12-second motion cycles (front, 40°, side), finite transforms, unscaled semantic joints and actor roots, independently varying torso/neck, supported skin, palm/sole contacts.
- `tools/rooftop-anthro-browser.mjs`: all seven loaded and strolling, actual squawk, gunfire with every lookout disabled, MAX and normal CRT, no console errors. Three leave/return cycles reload all seven actors with stable GPU resources (310–311 geometries, 70 textures).
- Required level checks and production build/type-check pass. The complete prepared release fits the 1 GB host at 999,391,596 bytes.

Evidence lives alongside this file in `rig/`, `production/`, and `gameplay.json`. The dedicated browser sessions do not navigate or reload the user's playtest tab.
