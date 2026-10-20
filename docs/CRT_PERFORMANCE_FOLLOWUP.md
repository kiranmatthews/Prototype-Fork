# Further CRT optimization — 8 October 2026

This pass builds on the first rewrite, using deployed commit
`187b1d279eed787171b0421b0ff6e71d9c86bf19` as its performance reference.
The authored presets and their storage format remain unchanged.

## Additional savings

Chrome / ANGLE Metal on Apple M1 Pro. Reference and candidate remain loaded;
each of seven rounds alternates AB/BA order, warming 24 frames before measuring
48 frames with a GPU timer query. This reduces clock/thermal drift between runs.
Figures cover the CRT graph and final display, excluding scene rendering.

| Case | Previous → new GPU time | Further reduction |
| --- | ---: | ---: |
| Native 1920×1080 startup | 4.395 → 3.576 ms | 18.6% |
| 640×360 → 1920×1080 startup | 3.459 → 3.172 ms | 8.3% |
| Native heavy effects | 8.194 → 7.150 ms | 12.7% |
| Upscaled heavy effects | 4.875 → 4.437 ms | 9.0% |
| HD defaults at 540p output | 1.289 → 1.195 ms | 7.3% |
| Advanced colour grading | 0.313 → 0.297 ms | 5.1% |
| Native black lift, afterglow off | 3.859 → 2.436 ms | 36.9% |

Raw samples, picture comparisons, GPU precision results and source hashes are
in [the report](performance/crt-followup.json). Default native output retains
five draws; its contributing shaders are faster. Threshold-only black lift
uses three draws instead of five, and releases its two afterglow histories and
otherwise-unused stock target.

## Implementation

- Main and final shaders no longer fetch frame-wide gamma/interlace metadata
  from a large texture at every output pixel. The interlace state becomes a
  constant, exposing more dead branches to the compiler. Non-identity gamma
  keeps a uniform so dragging it doesn't compile a program at every step.
- Gamma metadata preserves the actual RGBA16F write conversion. This GPU
  truncates rather than rounding to nearest. A lazy, one-pixel probe determines
  the convention once per renderer; unknown results keep the original texture
  path. Widths below four also keep that path because their metadata bands mix.
- On a native, unwarped HD raster, narrow positive vertical filters use their
  centre sample. Other geometry, resampling, ringing and interlace modes retain
  the full filter. Small scan-gamma/input-gamma ratios retain tiny filter tails
  because those tails can become significant in peak alpha.
- Reciprocal mask powers are composed into one power and a multiplication,
  preserving the saturation clamp. Disabled vignette alpha becomes one even
  when another consumer still needs the pre image.
- When afterglow strength is zero, positive black lift needs only the current
  pixel's threshold alpha. Compute and quantize that alpha inline instead of
  running the spatial/temporal afterglow stage. Threshold controls stay useful.
- Scanline gamma remains visible in interlaced output: it also affects the
  peak-alpha signal used by the mask, even without progressive scanlines.

Context restoration invalidates the device conversion cache and re-enables the
floating-point target extension. The calibration probe uses its own geometry;
disposing Three's shared fullscreen geometry during this probe disturbed
restored-context resources, which the new recovery regression caught.

## Verification

All 33 picture cases differ by at most **1/255 per channel**, with exact alpha,
against both the previous release and the original pre-rewrite chain. This
includes the original 28 presets plus threshold-only lift, native gamma,
curvature and extreme peak-gamma guards. No cumulative image degradation was
observed beyond that bound. CPU/storage preset rules are unchanged.

The metadata test compares both variants at all 81 gamma steps against the
actual stored GPU values, then tests tiny textures, actual context loss and
restoration, recalibration, GL errors and complete disposal. Existing output
tests retain eight tone mappings, four colour spaces, resize/fallback/failure
paths and ownership checks. Game smoke tests exercise the real pause/CRT
controls, native/upscaled/portrait rendering, checkpoint/pit recovery and finish.

```sh
npm run check:crt
npm run check:renderer
npm run build
node tools/benchmark-crt-paired.mjs http://127.0.0.1:5186 http://127.0.0.1:5187
node tools/test-crt-metadata-browser.mjs http://127.0.0.1:5186
node tools/test-crt-rewrite-browser.mjs http://127.0.0.1:5186 http://127.0.0.1:5187
node tools/test-crt-deconvergence-browser.mjs http://127.0.0.1:5186
node tools/test-crt-game-browser.mjs http://127.0.0.1:5186/
```

Serve the candidate and the stated reference revision with separate Vite
dependency caches. The picture tool's sequential timing fields are diagnostic;
use the alternating paired benchmark for performance comparisons.
