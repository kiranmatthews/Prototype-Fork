# Rendering pipeline performance

This change removes repeated rendering and allocations while retaining authored geometry, animation, lighting, shadows, resolution settings and the fixed simulation step. The renderer baseline is `2d502a9`; its renderer sources match the isolated pre-change snapshot used for comparison.

## Frame graph

Full-resolution ocean rendering now draws opaque geometry once. Its color and depth feed refraction, and the primary view then draws the remaining transparent surfaces. Painted sky backplates still enter the water capture and retain their original ordering in the main view. Shadows refresh once with every caster present, correcting the previous one-frame shadow delay in the refraction source.

The shared path checks dimensions, target formats, depth, viewport, camera and material ordering before drawing. Reduced-resolution water, mixed opaque/transparent material groups, opaque children below transparent parents, transmission, scissoring and unsupported targets retain the established path. Both paths restore renderer state after exceptions.

Reflection, refraction and the primary view share one scene-matrix update. The identity scene root and immutable jungle instance placements no longer recompute local transforms. Split-screen reuses the first camera's complete shadow map for the second view; camera layers and the light frustum are unchanged.

Warp-pad flame tongues use one instanced mesh with the same eighteen animated transforms. This removes 34 draw calls per visible pad without removing triangles. The standalone pad fell from 48 to 14 draws; four camera/animation comparisons were pixel-identical.

CRT encoding writes its opaque stock surface directly, eliminating an identical copy. Disabled CRT no longer draws a native-resolution bypass copy. Bloom keeps unchanged target sizes and tint data, and avoids redundant clears. Overlay renderer methods are cached while respecting later instrumentation replacements.

The game's final CRT decode and Three display transfer now share a shader. The fixed/GameFlow path no longer allocates its output-sized RGBA16F intermediate. Together with the stock-copy removal, this saves 31.64 MiB at the default desktop preset (1280×720 source, 2560×1440 output), and reduces the active game CRT graph from thirteen draws to eleven. Native rendering also avoids the extra decode draw; standalone CRT review retains its canonical output path.

The final fusion removes intermediate half-float rounding. It is therefore checked at final display precision, with at most one 8-bit RGB step of difference and exact alpha, rather than described as bit-identical. The tone mapping, transfer functions, LUTs and authored settings remain the same. A caller that requests an additional final resize retains decode-before-filter ordering through a lazy fallback target. No GPU readback or device calibration runs at startup.

## Frame pacing and lifecycle

The presentation limiter retains fractional timing debt instead of periodically discarding a deadline. A 60-second, quantized 59.94 Hz timeline with ±2 ms jitter previously accepted 3,444 of 3,596 refreshes; it now accepts all 3,596. Higher-refresh tests retain the requested 60 FPS cap, and stalls restart presentation cadence without bursts. The simulation remains fixed at 60 Hz.

Hidden tabs stop presentation and simulation work. Resume discards suspended time, snaps interpolation and waits for held controls to release. Actual WebGL loss/restoration is tested independently. Renderer diagnostics now count the entire presented frame, including shadows, ocean, postprocessing and HUD, rather than reporting only the final fullscreen draw.

The production recovery test exposed a race: the driver can revoke shaders before delivering `webglcontextlost`, leaving Three r166 reading a null shader log from a HUD draw. Frame and presentation boundaries now check the driver's actual context state. A mid-frame exception is ignored only while that context is lost, after normal `finally` cleanup; ordinary application and shader errors still propagate.

## Measurement method

Browser comparisons use isolated Chrome contexts on the same Apple M1 Pro/ANGLE Metal machine, a 1280×720 viewport, DPR 1, the unchanged 720p input and 2560×1440 output preset, and the default effects. Additional runs explicitly enable CRT and apply Chrome's 4× CPU throttle. Browser CPU throttling is a repeatable stress condition, not a measurement of a physical phone.

`tools/profile-render-pipeline.mjs` records actual presented frames, rAF intervals, submitted draws/triangles, renderer CPU time, target dimensions and resources. The published results use GPU timers disabled: query instrumentation changed driver scheduling on this host and was excluded from performance conclusions. FPS depends on simulation work, JIT compilation and host load; draw counts and intermediate storage reductions are the stronger structural measurements.

Final measurements are recorded with this report in `docs/performance/renderer-pipeline.json`.

| Scene | Draws before → after | Triangles before → after | Renderer CPU ms before → after |
| --- | ---: | ---: | ---: |
| Sky | 300 → 266 | 0.210 M → 0.210 M | 1.48 → 1.27 |
| Treehouse | 417 → 383 | 0.635 M → 0.635 M | 1.97 → 1.70 |
| World map | 672 → 551 | 3.896 M → 3.164 M | 4.74 → 3.80 |
| Beachside | 559 → 414 | 2.208 M → 1.604 M | 2.82 → 2.11 |

All four scenes remain at the 60 FPS presentation cap without CPU throttling. In the final matched 4× CPU runs:

| Scene | Presented FPS before → after | p95 frame interval ms before → after |
| --- | ---: | ---: |
| Sky | 39.0 → 40.5 | 33.4 → 33.4 |
| World map | 13.3 → 15.2 | 83.4 → 83.3 |
| Beachside | 18.1 → 19.6 | 66.7 → 66.7 |

These final controlled samples replace the larger gains seen in early exploratory runs. They show less render work and more headroom, but heavy CPU throttling still leaves simulation as a major cost. The strongest deterministic cuts are 26% fewer Beachside draws, 27% fewer Beachside submitted triangles, and the removed CRT buffers.

## Verification

- `npm run check:renderer`: frame pacing, hierarchy updates, warp transforms/bounds/disposal, ocean resource and sizing behavior, fixed/native post contracts, CRT shader graph and bloom lifecycle.
- `npm run check:interpolation`: unchanged simulation/render pose behavior.
- `tools/test-post-pipeline-browser.mjs`: exact standalone CRT/bloom comparisons and bounded fused native/fixed/GameFlow display comparisons.
- `tools/test-crt-output-browser.mjs`: fused display precision across tone maps/color spaces, output scaling, inactive/loading/failure/retry paths, alpha and resource lifetime.
- `tools/test-ocean-primary-browser.mjs`: exact HDR, depth, reflection, current-shadow and full post output; perspective/orthographic cameras, odd sizes, unsupported configurations, exception recovery and disposal.
- `tools/test-warp-pad-browser.mjs`: whole-pad pixel comparisons and exact draw/triangle counts.
- `tools/test-render-pipeline-browser.mjs`: lite traversal, supported spawn, checkpoint, pit respawn and finish; full Sky/Treehouse/map/Beachside rendering; pause, split-screen, resolution changes, suspension, repeated transitions and WebGL recovery.

Run browser tools with `PLAYWRIGHT_MODULE` pointing to an installed Playwright module. The pixel tools take baseline and candidate Vite URLs; the integration smoke and profiler take one base URL. All use fresh browser contexts and leave the user's saved browser data untouched.

An existing `check:render-quality` HUD source-pattern assertion also fails on the unchanged baseline because its fixed-length regular expression no longer reaches the pause branch. It is not evidence of a runtime regression; the actual pause paths are covered by the browser smoke. The full suite was not requested or run.
