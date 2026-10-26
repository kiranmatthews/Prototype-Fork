# Rooftop surface and architectural cleanup — 2026-10-26

Curved turquoise roofs now use consecutive cross-sections for their coplanar caps. Previously, long ear-clipped triangles crossed several bends and collapsed the centerline UV mapping. The replacement retains the exact Float32 perimeter, original wall faces and supported heights. Side UVs follow the perimeter with real vertical coordinates. Pitched fascia has separate UVs and face normals, while top normals remain smooth.

White fascia follows the actual roof outlines, including the atrium and construction break. Folded metal flashing marks the existing grindable ridges. Pitched-roof planters have fitted masonry footings. Obsolete straight branch support panels that protruded beyond bends were removed from the non-colliding scenery batch. No roof footprint, slope, gap, collider, pickup, enemy, checkpoint, fog or movement setting changed.

## Validation

- `node tools/test-rooftop-uv.mjs`: 92 roof/building polygons, 12,640 pitched faces, 140,148 before/after support rays. No collapsed UVs, reversed faces or changed surface envelopes. Before/after gameplay comparison passes.
- `node tools/test-rooftop-ridges.mjs`: all 18 ridged roofs retain safe landings and grind catches; six checkpoints and two physical rails remain.
- `npm run check:levels`: passes. Final integrated level validation and `check:level-sync` also pass.
- `npm run build` and `npm run check:release`: pass; 998,807,943 of 1,000,000,000 bytes.
- Production Chrome: 58 MAX/native 2560×1440 views cover every main and alternate roof plus branch joins and finish; ten normal CRT views cover all districts. This review exposed the stray support panels, followed by four lite and seven final native views after their removal and integration with current main. All reports have zero console errors and zero failed requests. Every full-detail view reports zero reduced meshes and zero automatic LOD objects.
- Full native screenshots and 1:1 pixel crops were inspected. Final examples: [curved branch](integrated-native/roof-234.png), [atrium](integrated-native/roof-9.png), [ridge](integrated-native/roof-40.png). Other local captures remain alongside their reports in the working checkout.

The published level-pack comparison against current main changes only `rooftop-relay`; current kart work is preserved. First corrected production view was available in approximately 25 minutes, with the full local cleanup and review complete in approximately 40 minutes.

## Reproduce the browser review

```sh
ROOFTOP_BASE=http://127.0.0.1:5369 ROOFTOP_OUTPUT=docs/rooftop-kook/quality-pass/native node tools/rooftop-kook-review.mjs --all-roofs --native
ROOFTOP_BASE=http://127.0.0.1:5369 ROOF_SCENES=roof-0,roof-8,roof-16,roof-24,roof-33,roof-40,roof-43,fork-1-split,fork-3-merge,finish ROOFTOP_OUTPUT=docs/rooftop-kook/quality-pass/crt node tools/rooftop-kook-review.mjs --all-roofs
```
