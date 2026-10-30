# Carlisle barrier-island shoreline

Local visual increment following `82a097b1ca714f37d5aaecd6ec82050ea3f9c52e`.
The distant shore previously repeated flattened spheres and bare poles. Two
Imagegen references became complete Tripo P2.0 dune and marsh banks, placed as
unequal reaches with open inlets. The final act has wider interruptions between
banks. All banks remain well outside the playable harbour.

The dune has three unequal crests, eroded sand channels and scattered sea oats.
The marsh has undercut banks, exposed roots and separate grassy hummocks. Cool
taupe and muted green sit under the existing blue-hour lighting. Every placement
uses a uniform XYZ scale; no axis is flattened or stretched. Its height is offset
by the actual rendered water profile, preserving the full modeled relief over
the course's descending sea. A triangle–waterline intersection supplies an
irregular foam strip around each bank, including its inlets.

The two models retain all 100,707 source triangles and their original UVs and
8K textures. Their 32 placements contain 1,657,437 triangles. The only distance
policy is the existing scenery-chunk visibility; meshes do not switch to lower
detail, including in reflections. There are no coastal colliders. Dry timber,
wet slopes, native movement, camera, bonus boats, reactive nets, all seven
airborne crate clusters and four nitro-row challenges are unchanged.

## Source and cost

`references/` holds the two generated input images and exact prompts.
`dune-studio.jpg` and `marsh-studio.jpg` show the completed textured assets.
The byte-identical downloaded GLBs are installed in
`public/props/carlisle-coast/`; its `provenance.json` records hashes, bounds,
texture dimensions and source triangle counts. No remeshing, retopology or
decimation was performed.

| Studio asset ID | Step | Observed credits deducted |
| --- | --- | ---: |
| `2f361c59-4182-46f9-b778-a9f0b9f4075b` | Dune image-to-model, P2.0 | 100 |
| `2f361c59-4182-46f9-b778-a9f0b9f4075b` | Dune texture, 8K | 30 |
| `dc6610e8-a1ed-47b2-9312-de47ead19b24` | Marsh image-to-model, P2.0 | 100 |
| `dc6610e8-a1ed-47b2-9312-de47ead19b24` | Marsh texture, 8K | 30 |

Total: **260 existing Studio plan credits**, balance **24,485 → 24,225**.
Known cumulative spend: 1,365. No API purchase or top-up. These are observed UI
prices and balance deductions, not API billing records. Studio exposes the
asset IDs; separate internal texture task IDs were not exposed. Both exports
are complete and downloaded. `credits.json` preserves the ordered ledger.

## Validation

`geometry-validation.json` checks all 2,203,710 placed vertices, exact source
indices/UVs, finite unit normals, retained above/below-water relief and fitted
foam elevation. The maximum relief error is below 0.00001m. The minimum X
separation from the course at the same Z is 253.4m. This is decorative shoreline,
not traversable terrain.

`before/` records the prior full-render overview. `review/` records the compiled
build at native 1920×1080 and normal 480p/CRT. The browser tool checks loading,
source triangles at every inspected distance, wet slopes, original collider and
crate counts, and removal/reload through the bonus. Final validation details
are recorded in `validation.json` after review.

Reproduce using the shared heavy-job lease:

```sh
node tools/test-carlisle-coastal-banks.mjs
CARLISLE_BASE=http://127.0.0.1:5484 node tools/carlisle-coast-review.mjs
```

Use `--lite` for the fast shader check, and `COAST_OUT` to keep an exploratory
capture outside the final evidence. The source/asset fingerprint check remains
`node tools/test-carlisle-shipyard.mjs`. The original
`tools/test-carlisle-coast.mjs` still owns the earlier gameplay checks.

Local publication hold remains in force.

Final checks passed: production build, source/asset fingerprints, geometry fit,
two lite views, six compiled native views, normal 480p/CRT, main/bonus/main reload,
walking, and a real-keyboard Storm crosswind transfer collecting four airborne
crates and reaching the next trampoline with zero deaths or bails. No console
errors. Arrival sample: 16.7ms median / 17.3ms p95 over 119 frames; this short
sample is not a whole-course performance guarantee. Sixteen protected gameplay
and prior art source files remain byte-identical. Both GLBs remain byte-identical
in the compiled build as well. Build stamp: `Codex/sol fork · build 10-29 23:12 UTC`;
offline version `bc4336fd6a484fcf672d`.
