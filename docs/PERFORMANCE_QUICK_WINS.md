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

## Carlisle texture resolution (follow-up)

A census of live Carlisle textures (94 textures, about 1.56 GB estimated GPU)
found these large maps:

- the broad-deck and shrimp-boat 8192² colour maps, about 341 MB each on the
  GPU (their files were only 2.6 and 4.1 MB: GPU cost follows pixel count, not
  file size);
- the 4096² solid-timber colour map, about 85 MB;
- 32 textures at 2048²: shipyard/cone colour maps, crate art, and the shipyard
  and cone metallic-roughness JPEGs.

The fish market and repair shed already ship at 1024² through the top-40 stage.

**Step 1 (commit `d9d73cc`):** the 13 shipyard and cone metallic-roughness
JPEGs (2048²) went through the existing Carlisle policy limit of 256² with
linear Lanczos, stored as lossless WebP. Previously `prepare-release-textures.py`
skipped every non-colour JPEG, so these shipped at full size.

**Step 2:** the user set Carlisle colour maps to 1024. The 16 colour maps in the
joined decks, shrimp boat, shipyard kit and cone are resized 8192/2048 → 1024
(linear-light Lanczos with the pipeline's restrained sharpening) and encoded as
WebP quality 95.

The reviewed lossy gate (PSNR ≥ 40 dB, p99 ≤ 8, max ≤ 64) was calibrated for
unresized originals. A resized colour map is measured against its sharpened,
resized reference, which is far noisier: the 8192 → 1024 maps reach only
32–36 dB even at quality 100, because WebP subsamples chroma. Falling back to
lossless would have added about 27 MB and broken the 1 GB hosting budget. The
policy therefore gained a `resizedColor` entry (quality 95; floor PSNR ≥ 30 dB,
p99 ≤ 32, max ≤ 128) that both `prepare-release-textures.py` and the build-time
check in `release-textures.mjs` apply only to resized colour maps at that
quality; everything else keeps the strict gate, and `test-release-textures.mjs`
covers both gates. The resize is the authorized loss, so these maps are judged
by the paired captures below rather than by the floor.

| Measure | Before | After |
| --- | ---: | ---: |
| Hosted bytes, the 16 affected models | 22.1 MB | 13.4 MB (12.6 MB with the boat at 1024) |
| Release output | 989.6 MB | 975.5 MB (974.8 MB with the boat at 1024) |
| Carlisle estimated GPU texture bytes at spawn | 1,583 MB (1,310 MB after step 1) | 346 MB measured with the boat at 1024; about 363 MB with the boat at 2048 |

Rows for every image in the batch are in `release-textures/carlisle-review.json`.
Every normal map reproduced its existing reviewed encoding byte for byte.

### Paired captures

Both builds (`main` at `d9d73cc` and this change) were loaded in headless
Chromium (SwiftShader, 1280×720, native render quality, player hidden) and
rendered from the same camera at the spawn deck: the broad joined deck, whose
colour map went 8192² → 1024², with the shipyard kit behind it.
`carlisle-textures-1024/deck-pair.jpg` is before (left) and after (right);
`deck-crop.png` is a 2× centre crop. Per pixel: mean difference 3.4 levels,
10.3 % of pixels differ by more than 8 levels, maximum 79. The plank grain is
marginally softer at 1024; draw calls (854) and triangles (19.2 M) are
identical. Estimated GPU texture bytes at this camera: 1,306 → 346 MB. The shrimp boat was captured the same way from a fixed camera (no player)
at 16 m (`boat-pair.jpg`) and 7 m (`boat-close-crop.png`, a 2× centre crop).
At 1024 the boat read the same from 16 m but visibly softer, with hull
scratches and paint chips smeared (mean 2.2 levels, 7.8 % of pixels > 8), and
the 7 m close-up lost its paint detail (mean 7.3 levels, 28.7 % > 8). The boat
is a 20 m hero prop seen from the quays, so its colour map stays at 2048 via a
policy override (quality 95, PSNR 36.9 dB, p99 15.0, max 96; file
1.24 MB; about 21 MB on the GPU instead of 341 MB). Every other Carlisle
colour map stays at 1024. At 2048 (`boat-2048-pair.jpg`,
`boat-2048-close-crop.png`, same fixed camera as the 1024 pair) the boat
matches the original from 16 m (mean 1.4 levels, 4.2 % of pixels > 8; the hull
scuffs and scratches are back), while the 7 m close-up is still softer than
the 8192 original (mean 4.4 levels, 16.4 % > 8): paint chips read as features
but not crisply. That is the chosen trade; a 4096 override would cost about
85 MB on the GPU instead of 21 MB if extreme close-ups matter.

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
- `check:crate-types` ran out of memory at Node's default heap, on `main` as
  well (`test-nitro-clear-switch.mjs`). Its npm script now gives that test an
  8 GB heap, so the check runs without `NODE_OPTIONS`.

## 10 November follow-up: hosting headroom and what is left

### Desert vista terrain is packed losslessly

The lossless native-geometry stage only covers the pinned
`NATIVE_GEOMETRY_FILES` list, which held 402 of the release's 623 models. The
173 `desert-canyon/vista/terrain-*.glb` tiles were not on it and shipped as
plain float buffers (46,080 unshared vertices each).

| Measure | Before | After |
| --- | ---: | ---: |
| The 173 vista tiles, hosted | 101.9 MB | 48.9 MB |
| Release output | 987.95 MB | 935.05 MB |

The "before" release figure is `main` on 10 November: commits from other chats
since 8 November had taken it from 975.5 MB to 987.95 MB, 12 MB under the
limit.

Nothing about the decoded geometry changes:

- `tools/test-release-native-geometry.mjs` decodes every buffer view of all 575
  listed models and compares bytes (4,994 views), and checks every other glTF
  field is unchanged.
- The tiles load through the same `jungleAssets` loader that already decodes
  the packed `desert-canyon/survey-rim.glb`, so the Meshopt decoder is in the
  path.
- In a browser (`bryce-canyon`, lite), every geometry under the level root was
  fingerprinted (position, index, normal, colour and UV buffers). The previous
  build with only the tiles packed matched its unpacked run on all 1,813
  geometries. The shipping build loaded with no console errors or failed
  requests and matched on all 534 vista/terrain geometries; its 125 other
  differences are race-fence contacts and boxes from unrelated commits.

One trap for local checks: since the motion-study loader landed, `vite preview`
cannot start the game. It serves `motion.json.gz` with `Content-Encoding: gzip`,
so the browser hands `loadMotionStudyBuffer` already-decoded bytes and its own
`DecompressionStream` fails ("Game startup failed"). GitHub Pages serves `.gz`
as plain gzip and is unaffected. The checks above used
`python3 -m http.server --directory dist`. Checking for the gzip magic bytes
before decompressing would make the loader work on either kind of host.

`tools/native-geometry-candidates.mjs` reports released models outside the list
and what packing them would save, so new content can be added to it as it
lands. About 6 MB is still available (other `desert-canyon` models 3.1 MB,
`props/crate-family` 1.4 MB, one enemy 1.4 MB). Each needs its loader's
`setMeshoptDecoder` call confirmed before it is listed.

### Remaining texture targets

From `tools/texture-census.py`, an offline census of a built release. GPU
figures are estimates if the texture is loaded (pixels × 4 bytes × 4/3).

| Target | Textures | Estimated GPU each |
| --- | --- | ---: |
| Drowned Crown `excellence/crash-*` colour maps (exterior ship, coastal headland, oak arch, stern gallery, cavern skylight) | 5 at 4096² | 85 MB |
| `hollowwake/round-cave-bore`, `blockworks-art/flagstone-deck-v3` | 2 at 4096² | 85 MB |
| `boulder-camera/cracks-a/b/c` | 3 at 3840×2160 | 42 MB |
| 2048² maps: `jungle-kit` 22, `blockworks-art` 21, `nightworks-kit` 9, `carlisle-kit` 8, `custard-creek` 7, `rooftop-kook` 7, `warehouse` 6, `desert-canyon` 5, `ancient-gates-tripo` 5 | 90 | 21 MB |
| Crate art (wood and metal crate sculpts) in `__shared_textures`; loads in nearly every level | 5 at 2048² | 21 MB |

The Drowned Crown five are the largest single step, about 320 MB on that level.
They are the maps the texture README lists as failing "the smaller encoding's
quality gate"; the `resizedColor` floor now accepts their 2048 encodes, and the
policy limit is already 2048. Re-run
`prepare-release-textures.py --resize-drowned --only-prefix` for those five
models and merge as the Carlisle batch was merged. It is not applied here
because that level's texture README asks for a native-4K traversal review.

### Checked and not worth doing

- **Font atlases** (six 2048×4046 PNGs, 37 MB hosted): load-bearing.
  `loadingTitle.ts` uses the uncapped atlas above cap 256, and the on-demand
  font archive is rebuilt from these exact PNG bytes.
- **Remaining plain `acceleratedRaycast` uses**: `hollowwakeTunnels.ts` probes
  once while fitting the bore, and the `worldSurfaceBinding.ts` proxies already
  sit behind their own broad phase (`prepareRay` / `raySurfaces`).
- **Unreferenced asset directories**: none. Every shipped directory is
  referenced by the bundle, or from inside the models for `__shared_textures`.

