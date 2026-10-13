# Nightworks caldera depth and lighting

The existing approved painting now occupies three world-space layers: the far mountain/bowl, an independently placed front crater lip, and nearer lower terraces. Their authored geometry follows silhouettes in the original image and shares one texture. Gouraud smoke begins below the lip and behind it; the native depth buffer hides its lower portion until it rises into view.

The plume's lower colour is redder, and the magma material applies a stronger, slow brightness cycle only to molten pixels. The cool rock and sky remain steady. Two pooled scarlet point lights select nearby authored fissure positions, while small glow cards identify the vents. The pool changes positions/intensity rather than adding lights as the player travels.

Overlapping 3D basalt terraces form a continuous canyon around the existing route. A small, native-resolution colour capture of the three background layers lets distant opaque rocks blend into the actual scenery behind them before their streaming boundary. This preserves solid faces. The far terraces borrow the existing low-detail basalt mesh and its texture lease; no additional model or image download is required.

The source geometry, ground vertices, automatic grind paths, moving/phase timings, checkpoints, pickups and gates remain unchanged. Added scenery has explicit `scenerySolid:false`. The original Nightworks level does not create the caldera capture or light pool.

Verification files:

- `occlusion-lighting.json`: four-render comparisons with smoke and crater rim independently enabled/disabled, plus the real light contribution. The rim hides 1,879–6,037 smoke pixels across the reviewed main/bonus views while the upper plume remains visible.
- `blend-state.json`: a fully faded test rock compared with the background and exact logical/physical viewport, target, scissor and shadow-state restoration at pixel ratio 2. The average RGB difference is below two byte values per channel; remaining differences are concentrated at multisampled silhouette edges.
- `rendering.json`: magma pixel animation, Gouraud motion, draw/triangle counts and six main/bonus switches. Resource counts stabilize at 87 geometries, 37 textures and 43 programs. The 4-view run sampled a 33.3 ms display cadence; `frame-control.json` separately records 16.7 ms medians with capture enabled, capture frozen and the original Nightworks level in the same isolated session. These are desktop measurements.
- Actual gameplay captures: `arrival.jpg`, `cutbacks.jpg`, `summit.jpg` and `bonus.jpg`.

Reproduce through the local Vite server:

```sh
node tools/test-nightworks-volcano.mjs
node tools/test-nightworks-depth-browser.mjs http://127.0.0.1:5236/
node tools/test-nightworks-backdrop-state-browser.mjs http://127.0.0.1:5236/
node tools/test-nightworks-volcano-browser.mjs http://127.0.0.1:5236/
```

Set `PLAYWRIGHT_MODULE` when Playwright is provided by an external runtime. The native full-course browser pilot and themed-bonus journey cover gameplay separately. No new ImageGen or Meshy generation was needed for this pass.
