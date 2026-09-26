# Rendering follow-up

This iteration builds on renderer release `1512611`. Resolution, movement tuning, character geometry and animation timing remain authored as before. Benchmarks hold that release's scenes constant; the production validation also includes the separately committed enemy visual change in `5257726`.

## Additional work removed

- **Character submission:** rigid limb, shoe and hand-mark surfaces share small material batches. Live character draws fall from **49 to 15 per color/shadow pass**. An affine matrix palette preserves independent stretch, shear, morphs, mirrored winding and normals. Original meshes remain authoritative for contacts, editor data and animation. Unsupported shaders, projective transforms, geometry edits or material changes restore the original drawing path. Conservative proxy culling can submit some extra offscreen triangles; no character geometry is removed.
- **Map/interface painting:** unchanged interface pixels reuse their texture. Input prompts share one measured layout/style snapshot. Shimmering Roo text blends cached authored-light rasters instead of repeatedly sampling every glyph from the large atlases. Existing 4/16 MiB text-cache budgets remain enforced.
- **CRT output:** deconvergence joins the final decode/display shader. This removes one more fullscreen draw and **28.125 MiB** at 2560×1440. The live graph now has ten internal draws; standalone review keeps its canonical path. An additional final resize retains the original intermediate/filter ordering through a lazy fallback.
- **Full-vertex bounds:** an optional **939-byte scalar WebAssembly f64 kernel** runs the same morph/skin/bind arithmetic as the existing JavaScript loop. It uses one 1.19 MiB workspace for current characters, capped at 8 MiB. Inputs are copied each call, so it retains no per-mesh native allocations or stale poses. Missing WebAssembly, CSP, allocation failure, custom vertex getters, projective matrices and invalid inputs retain JavaScript behavior.

Ordinary inverse matrices sometimes have a constant homogeneous divisor of `1 ± one floating-point step`. The accelerator preserves the exact reciprocal at the original arithmetic position; it does not normalize away that difference. Live diagnostics show no unsupported-matrix fallbacks in Sky, the map or Beachside after this correction. Startup compilation is asynchronous and included in presentation readiness. There is no runtime network request or added runtime package.

## Measurements

Isolated Chrome/ANGLE Metal on Apple M1 Pro, 1280×720 viewport, DPR 1, unchanged 720p input and 2560×1440 output. The normal four-scene pass retained the 60 FPS cap. GPU query timing was disabled. Whole-frame draws at the same default views:

| Scene | Previous release | This iteration |
| --- | ---: | ---: |
| Sky | 266 | 198 |
| World map | 551 | 449 |
| Beachside | 414 | 347 |

Final matched Chrome 4× CPU stress samples:

| Scene | FPS before → after | p95 frame interval before → after |
| --- | ---: | ---: |
| Sky | 38.7 → 42.5 | 33.4 → 33.4 ms |
| World map | 15.6 → 21.6 | 66.7 → 66.6 ms |
| Beachside | 21.9 → 22.1 | 50.1 → 66.6 ms |

Host load and JIT scheduling produced variation between runs, including a worse Beachside p95 in the final stress sample; this is not a claim of universally improved frame tails or physical-phone FPS. Deterministic draw/buffer reductions and paired CPU measurements are stronger evidence than one short FPS sample. The actual-model, alternating microbenchmark includes copies, palette preparation and animated pose updates: torso **0.263 → 0.151 ms**, shorts **0.341 → 0.170 ms**. All 240 measured production poses were bit-identical to the original bounds loop.

The map interface needed only three uploads across 379 compositions in one steady run. The compiled bounds workspace stayed at 1,245,184 bytes. Raw and summarized evidence is in `docs/performance/renderer-followup.json`.

## Verification and precision

- Character batches: twelve poses/views, four material/geometry edits, six unsupported constructors and 44 mutation cases. Worst mean RGB difference was 0.000525/255, with at most two edge pixels exceeding eight levels from matrix rasterization rounding. Triangles in the isolated character fixture were unchanged.
- Atlas/interface: 270 exact RGBA comparisons across atlas sizes, text configurations, raster backends and shimmer phases; thirteen exact real-interface states. Warm shimmer samples no atlas glyphs.
- CRT: thirty exact upstream frames, 163 output comparisons across eight tone maps/four color spaces, seventeen presentation cases and lifecycle fallbacks. Final RGB differs by at most 1/255; alpha is exact.
- Bounds: 82 JavaScript and 82 accelerated Three.js oracle comparisons, bit-exact production meshes, signed zero/subnormal/nonunit weights, constant divisors, edits, module/runtime/memory failures and the hard workspace cap. Real player crate/pickup/contact regressions run with the accelerator ready.
- Production browser: lite spawn/traversal/checkpoint/pit/finish; full Sky/Treehouse/map/Beachside; CRT, pause, split-screen, native/fixed resizing, hidden/resume, six repeat transitions and three context losses. Touch 540p CRT pause/resume also passes. Console errors: zero.
- `npm run check:renderer`, focused character-contact/death/interpolation checks, and the isolated production build pass. The full suite was not requested or run.

The inherited footwear test still fails identically on the untouched baseline at a 1.79e-8 mount-position difference against its 1e-8 threshold. The earlier HUD source-pattern audit failure is also unchanged. Neither test was weakened. In-progress Blockworks and character-study work was excluded from the renderer release.

## Reproducing the kernel

The checked-in generator contains readable WAT and emits the embedded bytes using pinned `wabt@1.0.39`. The compiler is a development tool only. Install it in a temporary directory with scripts disabled, then run:

```sh
node tools/build-skin-bounds-kernel.mjs --wabt=/path/to/wabt/index.js --check
node tools/benchmark-skin-bounds.mjs --json=/tmp/skin-bounds-benchmark.json
```

Browser proof tools accept baseline/candidate Vite URLs and `PLAYWRIGHT_MODULE`; see their usage headers. `tools/profile-frame-cpu.mjs` records actual sampled CPU stacks. `tools/profile-render-pipeline.mjs` records complete frame metrics, character batching, interface uploads and accelerator residency.
