# Performance quick wins (November 2026)

Four presentation and query changes that leave authored geometry, materials,
gameplay ownership and query results unchanged. The editor build keeps one
native, pickable mesh per fruit and crate.

1. **Fruit batching in every play build.** `PickupVisualBatch` (first proved on
   Drowned Crown) now runs for every level, not only the `drowned-crown`
   atmosphere profile.
2. **Crate shell instancing.** `src/crateShellBatch.ts` draws intact crate
   shells that share geometry, material, flags and a 16 m cell as one
   `InstancedMesh`, copying each shell's world matrix every view update. A shell
   that breaks, hides, relabels or swaps geometry/material draws natively again.
   TNT, nitro, transparent and custom-`onBeforeRender` shells are skipped. The
   batch is built as soon as every crate's art settles, and
   `Level.prepareJungleAssets()` waits for it, so the covered destination
   warm-up compiles the instanced programs before the first gameplay frame.
   `Level.dispose` releases it before the root traversal so shared crate art
   survives.
3. **Bounded ground raycasts.** `boundedAcceleratedRaycast`
   (`src/groundAcceleration.ts`) applies Three's stock bounding-sphere rejection
   (slightly inflated) before entering three-mesh-bvh, which otherwise inverts
   the world matrix and allocates typed-array views for every mesh on every ray.
   Carlisle scenery and warehouse solids use it too.
4. **Shared world-map sand.** The island and sky/dry sand materials share one
   upload of the 2048² MatrixRex sand maps and the moss map.

## Measurements

The measurements were taken in headless Chromium using SwiftShader WebGL at
1280×720, with the render-quality preset fixed and `?playtest&renderdiag`
(`?lite` for the ground benchmark). `main` (`d02c6bb`) and this change were
built and served side by side. Timings from software rendering are not
representative, so only counts, bytes and relative ray costs are reported.

### Draw calls per frame (paired, same pose)

For each view, the production batches were toggled against native draws at a
frozen pose. Triangles were identical in every pair.

| View | Native draws | Batched draws |
| --- | ---: | ---: |
| Treehouse Trail spawn | 1,631 | 1,608 |
| Treehouse Trail fruit #28 | 1,798 | 1,778 |
| Treehouse Trail fruit #71 | 787 | 778 |
| Treehouse Trail fruit #114 | 799 | 789 |
| Carlisle Coast spawn | 906 | 884 |
| Carlisle Coast fruit #44 | 897 | 842 |
| Carlisle Coast fruit #111 | 812 | 790 |
| Carlisle Coast fruit #178 | 354 | 340 |

The batched build draws the same images:

- **Treehouse spawn:** pixel-identical.
- **Carlisle spawn:** 8 pixels of 921,600 differ by more than 8 levels, with a
  mean RGB difference of 0.00014 (floating-point edge samples).
- **Drowned Crown (`check-fruit-batches.mjs --lite`):** pixel-identical in all
  five views. The treasury view's `grounded` assertion failed because the
  player was still settling after the fixed 2 s wait under software
  rendering; its pixels still matched exactly.

Fruit gains are smaller than the per-level fruit counts suggest. Fruit cycles
through six sculpt variants, each its own geometry, so most 16 m cells hold one
fruit of a variant. Treehouse batches 38 of 143 fruit; Carlisle batches only 2
of 223, because its fruit is spaced about 18 m apart along a 3.8 km course.
Cells of 32–96 m saved at most another 10–30 draws per view, at the cost of
extra off-screen triangles, so the validated 16 m cell was kept.

Crates instance almost completely: Carlisle puts 359 of 362 batchable shells
into 40 cells, and Treehouse puts 4 of 27 into 2 cells. Most remaining draws
come from scenery, not pickups.

### Ground query cost (Codex lab, 120 ground meshes)

The benchmark ran 2,000 downward rays (`near` 0, `far` 6) around the spawn
through `player.raycaster.intersectObjects(level.groundMeshes)`.

| Build | Typed arrays allocated per ray | Time per ray (relative) | Hits / distance checksum |
| --- | ---: | ---: | --- |
| `main` | 102 | 26.1 µs | 1,025 / 2805.083333 |
| This change | 6 | 8.1 µs | 1,025 / 2805.083333 |

`tools/test-ground-raycast-bounds.mjs` additionally compares 240,000 mesh-ray
results and `intersectObjects` ordering exactly. Under the old path, the
per-mesh allocations drove the periodic JS-heap sawtooth on Codex lab.

### World-map texture memory (`warproom`)

| Build | Live textures | Estimated GPU texture bytes |
| --- | ---: | ---: |
| `main` | 292 | 1,160 MB |
| This change | 288 | 1,091 MB |

## Validation

- `npm run build`, `npm run check:release` (989.6 MB of the 1,000 MB budget).
- `check:ground` (the validator now expects `boundedAcceleratedRaycast` on dense
  ground), `check:crate-types` (including `test-crate-shell-batch.mjs`),
  `check:pipe`, `check:ledge`, `check:rail-air`, `check:run-facing`,
  `check:surfaces`, `test-milk.mjs` and `test-pickup-visual-batch.mjs`. The last
  now expects batches in every play build and none in editor builds.
- Drowned Crown fruit collection passes, including the batch after respawn.
- Browser crate behaviour on Treehouse:
  - the batch exists when gameplay starts;
  - no new shader programs compile during the first 20 gameplay frames;
  - instance matrices follow the squash pulse;
  - breaking a crate removes its instance, and a checkpoint respawn restores it;
  - a material swap returns the shell to its native draw, and restoring the
    material re-batches it.
- `check:crate-types` runs out of memory at Node's default heap on `main` as well
  (`test-nitro-clear-switch.mjs`). It passes with
  `NODE_OPTIONS=--max-old-space-size=8192`.
