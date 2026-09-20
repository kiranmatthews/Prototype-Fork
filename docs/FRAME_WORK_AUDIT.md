# Mobile frame work and loading follow-up — 20 September 2026

The previous memory fixes did not address all per-frame work. This pass measured
draw submissions, geometry volume, texture uploads, GPU queries and the real
finish/results path. It does not establish an iPhone or iPad frame rate.

## Confirmed waste and fixes

- **Hidden water rendered Jungle Ruins three times per frame.** Reflection also
  disabled fog, drawing distant temple blocks. A non-blocking depth visibility
  query now skips reflection/refraction passes while the real wave surface is
  completely occluded. The surface itself still draws and is queried, so visible
  water resumes the existing full-quality passes. Camera teleports force a fresh
  capture. No water resolution, mesh detail or shader quality changed.
- **The whole scenery kit was requested on entry.** Runtime cells now acquire
  leases around the camera's visible distance, with 64 m of prefetch and another
  64 m of retirement hysteresis. Both split-screen cameras are included. Incoming
  leases precede outgoing releases; late loads cannot resurrect retired cells.
  Background silhouettes/mattes remain resident. Editor/tool consumers can still
  prepare the complete kit. These are the original meshes, without LOD reduction.
- **Treehouse's decorative rope/timber components each submitted a draw.**
  Non-solid static surface pieces now share materials and merge in 16 m cells.
  Authoring components, collision, positions, UVs and mesh detail are preserved.
- **Two full-screen UI canvases uploaded every gameplay frame on touch devices.**
  Unchanged touch controls now reuse their texture. Gameplay HUD uploads only its
  occupied rectangle at the same pixel density, expanding for messages/effects.
  Hidden duplicate SVG lettering also stops animating while its canvas is shown.
- **The fade curtain was copied into a canvas that could stop repainting.**
  Native compositor opacity now owns the black curtain. Synchronous construction
  starts while it is opaque. Textures and visible/shadow-relevant geometry are
  warmed in bounded batches, then real completed GPU frames gate the reveal.
  Results can no longer draw prematurely from RAF during preparation. Idle
  presentation advances under the reveal while input, physics and run clocks
  remain locked.

## Same-view desktop measurements using the touch path

Literal 960 × 540, CRT off, same authored views. World GPU timings use
`EXT_disjoint_timer_query_webgl2`; UI/upload counts come from actual WebGL calls.
Jungle's baseline is normalized to a presented frame (three world passes).

| Work per presented frame | Before | After |
| --- | ---: | ---: |
| Treehouse draws, including shadows/UI/post | 756 | 414 |
| Treehouse triangle estimate | 633,386 | 633,386 |
| Treehouse world CPU submission | 3.25 ms | 2.10 ms |
| Treehouse world GPU | 5.45 ms | 5.75 ms |
| Jungle world passes, hidden sea at spawn | 3 | 1 |
| Jungle draws, including shadows/UI/post | 1,969 | 597 |
| Jungle triangle estimate | 10,486,969 | 2,229,737 |
| Jungle world CPU submission | 20.19 ms | 3.12 ms |
| Jungle world GPU | 21.56 ms | 8.56 ms |
| Steady gameplay UI upload pixels | 1,036,800 | 20,480 |
| Jungle resident placements at spawn | 9,409 | 1,694 |

Treehouse's GPU timing difference is within the variability of these samples;
the supported Treehouse gains are draw submission and UI work, not a claimed
GPU speedup. The UI upload reduction is 98%. Later Jungle temple sections remain
more demanding than spawn because their visible authored masonry is dense.
Triangle estimates count each submitted geometry's indices and instances;
material groups/draw ranges can make actual GPU triangle counts lower. Draw
submissions, world-pass counts and canvas upload pixels are measured directly.

## Validation

- Focused asset, retirement/cancellation, two-camera residency, geometry, Treehouse
  traversal, results, idle/run-state, loading/GPU fence, warm-up state restoration,
  water visibility/recovery, render sizing and graphics-memory checks pass.
- Browser checks cover repeated Treehouse/Jungle/Sky finishes, the Jungle
  checkpoint route through Z = -580, a forced context reset during GPU warm-up,
  and map → Sky return, with no console errors. HUD comparison is exact in most
  samples; its tolerance allows at most eight antialiasing channel differences
  of eight/255 across a full frame, and rejects clipping/layout changes.
- Isolated production type-check/build passes, retaining the 201.1 MiB offline
  pack and excluding unrelated local character work. No full suite was run.
- Existing `test-mobile-ui-layout.mjs` fails a source-text assertion about
  `style.textContent += menuLayoutStyle` in unchanged `gameFlowUI.ts`. This is
  unrelated to the runtime changes; it is not reported as passing.

Reproduce with local-only `frame-work-review.html?touch&playtest&level=treehouse-trail`.
Its buttons exercise real transition/finish handlers and report workload, pixel
parity, streaming and recovery. It is not a production entry point. Timing under
forced recovery or simultaneous build/test work is excluded from the table.

No authored art, gameplay tuning, regular render resolution or frame cap changed.
Physical-device crash rate and sustained FPS still require an iPhone/iPad run.

## Stale offline build found during public verification

After the successful deployment, the public browser still showed
`Codex/sol fork · build 09-14 23:20 UTC`. Its cache-first worker could keep an
older release alive while game windows remained open. This makes an ordinary
reload an unreliable way to receive performance fixes.

`update-game.html` provides a deliberate, save-preserving update. It verifies
connectivity, unregisters only this application's exact worker scope, then
navigates to the current game. It never clears saves, settings, custom levels or
cached asset files. The page is excluded from offline manifests so future stale
workers cannot intercept it. Normal offline updates retain their existing
mid-run protection. Focused tests cover scope isolation, connectivity failure,
same-origin navigation and retained data.
