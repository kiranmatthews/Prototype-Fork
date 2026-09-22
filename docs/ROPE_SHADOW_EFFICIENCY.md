# Approved shadow and rope efficiency changes

23 September 2026. Baseline: `7e64170`. The user approved efficient shadows,
further CPU savings and simple rope geometry with shader-based strand detail.

## Mobile shadows

The existing touch/coarse-pointer presentation path now selects a 2048² sun
shadow map. Desktop retains 4096². The camera footprint, depth range, bias,
normal bias and PCFSoft filtering are unchanged.

Real WebGL allocation checks show 112 → 28 MiB of logical shadow storage:
**84 MiB saved**. Both a forced-touch URL and a real coarse-pointer browser
context use the smaller map. Contact shadows become softer, as approved.
This is requested texture/renderbuffer storage, excluding driver padding and
browser-owned buffers; it is not an OS process-memory reading.

## Shader ropes

Ropes now use an eight-sided tube with 24–96 axial segments (two per metre,
within those limits). The physical sampling function remains the source of the
centreline. The fragment shader supplies three helical strands, fine fibers and
normal relief. Both detail frequencies fade when they become smaller than a
pixel, limiting distant shimmer. No rope canvas/texture is generated or uploaded.

Curve updates reuse buffers and precomputed ring directions. Conservative
curve-envelope bounds replace repeated scans of every tube vertex. The envelope
includes float32 rounding at distant world coordinates. Outward triangle winding
agrees with the normals, and the knot's UVs follow its arc length with a continuous
strand seam. Its existing 576-triangle geometry is retained.

| Rope length | Old tube triangles | New tube triangles | Dynamic update median, old → new |
| --- | ---: | ---: | ---: |
| 3 m | 1,584 | 384 | 0.094 → 0.011 ms |
| 8 m | 4,224 | 384 | 0.245 → 0.013 ms |
| 16 m | 8,448 | 512 | 0.486 → 0.017 ms |
| 24 m | 10,080 | 768 | 0.583 → 0.025 ms |

These are isolated desktop browser measurements, 960 changing-curve updates per
length after warm-up. Idle Sky ropes already skipped rebuilds before this change;
these savings apply when ropes swing, sag, recover or fall. Reduced geometry also
applies to ordinary and shadow drawing while idle. Six matched close/gameplay
views cover vertical ropes, sagged ropes and knots.

The rope's broad silhouette is now a smooth low-poly tube rather than physically
modelled tiny lobes. Swing/grind equations, grab points, release velocity, sag,
break/regrow timing, collision and authored animation are unchanged. The shader
does not displace the mesh away from the physical curve.

## Exact character-bounds CPU saving

The bounds pass recognizes ordinary affine bone and inverse-bind matrices and
skips their redundant projective denominator calculations. Projective matrices,
invalid data and custom vertex getters retain their compatible paths. All
vertices, morphs and deformation are still measured at the existing cadence.

A paired 27,560-vertex benchmark measured median 1.013 → 0.875 ms (about 14%
less bounds CPU), with bit-identical boxes over 800 changing poses. Another 268
live gameplay measurements through movement/jumping produced identical bounds.
Unchanged-pose caching had no hits on that live route and was not added.

## Combined production result

Fresh touch contexts, the same idle Sky spawn, literal 960×540 output and CRT off.
Actual draw counts were sampled first; their wrappers were removed before two
CPU-throttled samples per build. No other builds or browser profiles ran during
the measurement.

| Measurement | Baseline `7e64170` | Updated build |
| --- | ---: | ---: |
| Submitted triangles per frame, including shadows/UI | 395,743 | 209,503 |
| Draw calls per frame | ~301 | ~301 |
| FPS with Chrome CPU throttling at 4× | 33.1–33.8 | 35.2–35.4 |

Triangle submissions decrease about 47%; mean stressed FPS improves about 5.5%.
Both builds hold 60 FPS without throttling and retain approximately 60 simulation
ticks/second, with exact run-clock/tick agreement. These production values must
not be mixed with the earlier development-server comparison or treated as phone
FPS. The remaining skinned-character and interface work still costs CPU.

A first attempt against two development checkouts encountered Vite's shared
dependency-cache invalidation (`Outdated Optimize Dep`) before game startup.
That attempt produced no measurements. The final comparison uses separately
built production bundles and has no page/console errors or context losses.

## Evidence and reproduction

- `tools/test-rope-efficiency.mjs`: 21 curves, topology/buffer limits, centrelines,
  endpoints, knot seam, outward faces and culling bounds including large coordinates.
- `tools/test-idle-rope.mjs`: idle reuse, loaded sag, exact rest recovery, break
  collision and restring.
- `tools/test-editor-motion-transforms.mjs`: 42 editor/motion cases, including
  rotated/scaled ropes, exact grip curves and knot endpoints.
- `tools/test-nightworks.mjs`: ground/collision/ledge/phase/rope and finish coverage.
- `tools/test-rope-board-transfer.mjs` and `tools/test-rope-limb-mapping.mjs`:
  catches, release and board transfer; 1,620 live hang/climb/descend frames.
- `tools/test-skinned-interaction-bounds.mjs`: 76 full-vertex comparisons against
  Three.js, including projective and invalid-input fallbacks.
- Clean production TypeScript and Vite build passed. No full suite was run.
- Chrome and WebKit production both caught a real Sky rope into a sustained
  grind with visible sag and the 768-triangle tube. Chrome also exercised actual
  grabbing, keyboard climb/descend (grip distance 3 → 2 → 3 metres), and a fully
  charged release into the air. Hand errors stayed below 7e-11 metres. Screenshots
  were inspected; neither browser reported page, console, asset or GL errors or
  context loss.

Browser rope review (Vite source checkouts):

```sh
node tools/test-rope-efficiency-browser.mjs <baseline-url> <candidate-url> --timing
```

Run timings without other builds or browser profiles. The tool emits a paired
image gallery, triangle/buffer counts, curve errors and optional CPU timings.
Set `PLAYWRIGHT_MODULE` when Playwright is supplied outside this project.

Recorded evidence: [rope comparison](performance/shader-rope-comparison.json),
[shadow policy](performance/mobile-shadow-policy.json),
[bounds CPU](performance/affine-skinning-cpu.json), and
[live bounds parity](performance/affine-skinning-live.json), plus the
[combined production comparison](performance/rope-shadow-production.json) and
[production interactions](performance/rope-production-interactions.json).

Physical-device restart rate still requires an affected-device retest. These
checks establish specific memory/work reductions and preserved gameplay, rather
than an inferred OS termination cause.
