# Carlisle solid pier structure

Local presentation increment after `4670a18fbf47e8486a575425ea6137646e8f6655`.
The tall pier shafts previously reused a horizontal deck-plank material on
uniform cylinders. The result was striped columns beneath otherwise detailed
boats, buildings and solid timber decks, with no bracing across tall bays.

The replacement keeps the original fender, rope and cap assets intact. Three
slightly unequal solid log profiles form each pile cluster. Continuous timber
grain follows each member's long axis with fixed metres per texture tile.
Beveled ledgers and paired cross-braces connect adjacent piles of the same
scenery quay, with recessed crossings, iron joint plates and hexagonal bolts.
The upper bays use crossed braces; taller lower bays alternate direction.
Braces remain within one quay's footprint and below its deck. No new geometry
connects the playable gaps, and this system adds no collision or support data.

A restrained damp band follows the authored water height at each timber's
endpoints. Grain, bump detail and roughness continue down to the waterline.
Static full geometry is instanced by existing scenery chunk; there are no
distance-dependent mesh substitutions or decimation, including reflections.
The main course contains 4,146 pile shafts, 1,218 ledgers, 1,604 braces, 2,432
joint plates and 4,864 bolts: 2,177,728 triangles in this complete structure.
These counts include the replacement shafts, not only added geometry.

## Surface asset

The built-in Imagegen tool produced the continuous salt-weathered timber
surface. The original output is copied unchanged to
`public/textures/carlisle-piers/weathered-timber.png` (1254×1254). Exact prompt,
source and destination are in `imagegen.json`; the image hash and byte count
are in `protected-source.json`. It is an albedo and fine bump source on actual
solid geometry, not a replacement plane. No Tripo credits were spent in this
increment; all existing generated models remain intact.

## Review

`before/` captures the preceding compiled build at matching native cameras.
`review/` records the final compiled under-pier views, close grain/material
view, later-act structures, the bonus and normal 480p/CRT presentation.
The final report checks finite geometry, texture/bump loading, conservative
full-member clearance from all six main fishing boats, main/bonus/main
disposal and reload, original scene counts, keyboard walking and console errors.
Protected source hashes cover movement/camera, authored courses, cargo/nitro,
wet slopes, decks, nets, cones, coast, water/sky and the new fishing fleet.

Reproduce with the shared heavy-job lease around:

```sh
CARLISLE_BASE=http://127.0.0.1:5484 node tools/carlisle-pier-review.mjs
```

`--lite` selects two quick views; `--baseline` captures a prior build;
`PIER_OUT` selects a separate evidence folder. No repeated level-data audit,
new full-course traversal or full suite is claimed for this scenery increment.
Publication remains held for local playtest rounds.

The last short arrival sample ran at about 30fps after earlier samples near
60fps. A controlled same-process new/prior/new/prior comparison reconstructed
the preceding cylindrical supports without changing the scene or camera.
All four windows returned the same 33.3ms median; p95 was 34.7/34.3/34.8/34.6ms.
This does not identify the broader cadence change's cause or establish whole-
course performance. Other active rendering processes were observed and left
alone. `timing-comparison.json` preserves all 960 measured frames' summary
statistics and render counts; `tools/carlisle-pier-timing.mjs` reproduces it.
