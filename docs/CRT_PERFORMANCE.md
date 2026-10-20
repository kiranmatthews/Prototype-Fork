# CRT performance rewrite — 8 October 2026

This is the first rewrite's baseline. A [follow-up optimization](CRT_PERFORMANCE_FOLLOWUP.md)
further reduces the contributing shader work while retaining its picture and presets.

The runtime preserves the pinned Guest look and existing presets while executing
only the current image dependencies. This includes substantial changes to the
stages that remain active. The generated shader sources and GPL provenance stay
available as the reference; the optimized implementation lives in
`src/crt-guest/optimize.ts` and `pass.ts`.

## Measurements

Chrome / ANGLE Metal on an Apple M1 Pro, using GPU timer queries. Each median
contains seven batches of 24 CRT frames after warmup. These measure CRT plus
display output, excluding scene rendering. Full case definitions, samples,
target memory and image errors are in [the report](performance/crt-rewrite.json).

| Case | GPU before → after | Reduction | Fullscreen draws |
| --- | ---: | ---: | ---: |
| Startup HD, native 1920×1080 | 11.73 → 3.92 ms | 66.6% | 11 → 5 |
| Startup HD, 640×360 → 1920×1080 | 5.68 → 2.68 ms | 52.9% | 11 → 6 |
| HD with glow, bloom and halation, 1080p output | 5.93 → 4.14 ms | 30.2% | 11 → 10 |
| HD effects and vignette, all original draws retained | 1.93 → 1.34 ms | 30.3% | 11 → 11 |
| HD wide glow/bloom kernels | 6.50 → 2.51 ms | 61.4% | 11 → 10 |
| Advanced edge detection + raster bloom, Balanced | 3.27 → 2.41 ms | 26.4% | 11 → 12 |

The last case adds a one-pixel luminance draw to avoid calculating global
luminance at every spatial edge pixel. Fewer draws alone is not the objective.
Startup native HD target storage falls from **104.74 MiB to 55.37 MiB** (47.1%);
upscaled startup HD falls from **37.35 MiB to 25.49 MiB** (31.8%). These figures
cover CRT-owned targets, not the entire game's GPU memory.

Across **28 reference cases**, maximum displayed channel error is **1/255**,
with exact alpha and no console/WebGL errors. Cases include both variants,
all kernel qualities, native/upscaled/odd dimensions, LUT and white-point
grading, interlacing, deconvergence/noise, wide kernels, magic glow, negative
bloom/halation and live preset/size transitions. Results are hardware-specific;
the report retains the individual timings rather than asserting a universal FPS.

## Work removed or combined

- Afterglow exists only when its RGB or positive black-level threshold is used.
- Glow and bloom each have separate dependency checks. Magic glow derives its
  local colour mixture from Glow; it does not require the Bloom surface.
- Advanced edge detection is spatial and needs no history. Raster luminance
  uses two **1×1** history targets and runs only when raster bloom is enabled.
  Mipmaps are generated only for that luminance calculation.
- Colour preparation and linearization share a source-sized draw when neither
  neighbourhood reconstruction nor vignette/edge/luminance consumers require
  the intermediate pre image. Input encoding also joins that draw when stock
  has no remaining consumer. The original RGBA8 quantization is retained.
- At native horizontal resolution, a sufficiently narrow positive HD filter
  has no meaningful neighbour contribution. The linear surface substitutes
  for reconstruction when the scanline path does not consume peak alpha.
- Deconvergence, Guest decoding and Three's display transfer remain combined
  in the final draw. The standalone CRT review now uses that same path.

## Faster contributing stages

- Afterglow uses integer texel neighbours and one size lookup; pre colour reads
  use direct texel fetches. Their original weighting and border behavior remain.
- Neutral EBU/sRGB gamut and zero-temperature round trips are eliminated before
  the preserved quantization. Non-neutral grading remains available.
- Discrete choices and exact neutral values become shader constants, removing
  unused mask, noise, grading and glow paths. Continuous values remain uniforms;
  obsolete compiled programs are disposed when a structural choice changes.
- HD filter loop bounds follow the selected support instead of a 512-iteration
  ceiling. The GPU's original exit test preserves fractional-boundary rounding.
- Gaussian passes use stable centre-out recurrences: three exponentials per
  fragment instead of one per tap. Tails beyond 5.5σ are discarded. Ordinary
  glow pairs adjacent source texels through linear filtering; nonlinear magic
  glow and bloom-alpha calculations keep separate samples and black borders.
- Draw order, target sizes and static sampler bindings are cached. Per-frame
  work updates only source/history/frame bindings and submits the selected draws.

Raster-coordinate arithmetic retains its evaluation order: folding neutral
warps changed a scanline boundary in an early experiment. Similarly, eliminating
tiny HD reconstruction terms while peak alpha was consumed amplified numerical
differences. Neither shortcut is used in those paths.

## Controls and lifecycle

The 143-slot preset schema, source/version validation, import/export, startup
values and browser storage key are unchanged. Startup remains disabled. The
panel shows controls that can contribute under the current effect and source
resolution. Dependent controls return when their parent effect is enabled.
The two aliased afterglow sources and fixed LUT size are not editable rows;
ineffective narrow-kernel radius controls are hidden. Closing the panel releases
keyboard focus so game controls and Pause work immediately.

Radius slider limits follow the current blur width and sampling scale, excluding
the range discarded by Gaussian-tail truncation. Imported larger radii remain
in preset storage; the panel shows their effective radius and explains the saved
value in its tooltip. Auto-resolution appears only for source sizes where it
can operate, and mask/scanline subcontrols follow their actual consumers.

Unused targets are released. Temporal surfaces initialize when their effect
becomes active and clear on the established resize/preset/enable resets. Shader
specializations invalidate the borrowed final output and its cached display
program. Bypass, failures, retries, resize fallbacks and disposal keep their
existing ownership and colour-conversion rules.

Changing a reused pre target from unmipped to mipped now reallocates its WebGL2
storage. The old renderer could retain one immutable mip level after a same-size
HD→Advanced switch. Reference comparisons therefore instantiate the legacy graph
fresh for each preset, while the candidate reuses one graph across transitions;
this checks against the canonical preset image rather than that old allocation
accident. Edge→raster and scalar→edge/raster transitions are explicit cases.

## Reproduction and integration

The pre-rewrite reference is commit `c906367489b089c6e1d0e016358ff853d4cb713c`;
reference source hashes are in the report. Serve it and the candidate from
separate Vite roots/dependency caches, then run:

```sh
npm run check:crt
npm run check:renderer
npm run build
CRT_BATCH=24 CRT_SAMPLES=7 node tools/test-crt-rewrite-browser.mjs http://127.0.0.1:5186 http://127.0.0.1:5187
node tools/test-crt-deconvergence-browser.mjs http://127.0.0.1:5186
node tools/test-crt-game-browser.mjs http://127.0.0.1:5186/
```

The output suite covers 30 graph frames and 163 display comparisons across
eight tone mappings, four colour spaces, resize and inactive/failure/retry
paths, plus borrowed-texture ownership and complete disposal. Game smoke checks
cover supported spawn, movement, checkpoint/pit recovery, finish pad, live
controls, Pause, 390px portrait and 1920×1080, in lite and full rendering. This is
staged rendering/integration coverage, not a complete playthrough of every level.
The production release is built from an isolated latest-main checkout; unrelated
workspace changes and movement tuning are not part of this rewrite.
