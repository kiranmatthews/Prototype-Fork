# Scenery lifetime audit — 20 September 2026

## Confirmed faults and fixes

- Jungle/Treehouse/Nightworks templates and the Carlisle library stayed in global promise caches after their last level was destroyed. They retained GPU resources and decoded image data. Levels now lease assets; the last owner releases geometry, materials, textures and ImageBitmaps. Overlapping level builds and suspended levels can continue sharing assets. A load completing after retirement is cleaned up instead of resurrecting the cache.
- Loaders eagerly uploaded textures even when a level had already been abandoned, or a material did not use the normal/roughness map. Uploads now happen when a material actually renders.
- Tree and separated canopy GLBs embed identical color and normal atlases. A loader dependency shares those textures before decoding/uploading. A regression test compares the encoded image bytes, samplers and material mapping. Geometry remains separate.
- Level texture cleanup missed shader-only grass maps and cached textures on removed props. Those caches now participate in disposal and successor preservation.
- Three r166's reused shadow material retained an absent map's old shader uniform. Browser allocation tracing caught a disposed 512×512 level texture being uploaded again while drawing an untextured character bone. The renderer adapter clears only absent map/alpha/displacement samplers on depth/distance materials. Cutout maps, displacement and shader code are preserved.
- Offline saving broadcast an update for every file, repeatedly invalidating menu artwork. Progress broadcasts are limited to four per second; completion/errors/status requests remain immediate. Background downloads request low network priority.

## Asset audit

`node tools/audit-runtime-assets.mjs /tmp/runtime-assets.json` reads all 64 published GLBs, including external image references. None contains a million-triangle mesh. No GLB texture exceeds 2048 pixels on either axis.

Treehouse uses Meshy's `smart-topology` mode. Recorded generation targets range from 1,200 to 8,000 triangles, below the requested 15,000 limit. The audit fails if a Treehouse mesh exceeds that limit.

| Active Treehouse module | Detailed mesh triangles |
| --- | ---: |
| Cabin body | 7,555 |
| Supporting trunk/boughs | 6,662 |
| Tree | 2,860 |
| Stairs | 1,880 |
| Canopy | 1,301 |
| Landing | 1,181 |
| Bush | 961 |
| Balcony deck | 432 |

These files use 2048² color and 1024² normal images. Encoded file size understates their memory cost: each pair is approximately 26.7 MiB as RGBA8 with mipmaps. Treehouse's scenery diagnostics fall from **245.65 to 218.98 MiB** by sharing the duplicate pair, with identical pixels and texture dimensions.

The largest existing scenery file is the complete Carlisle city library: 292,500 triangles including bundled detail variants, with a largest individual mesh of 45,122. It predates Treehouse and is not one generated Treehouse object. Runtime scene totals include instances and hidden geometry; they are not the number drawn in every camera view.

## Browser measurements

Real level-switch handlers and WebGL renderer, same 1280×720 viewport, 1280×720 internal render, 2560×1440 output, fixed-60 setting enabled, CRT off. Counts are `renderer.info.memory` after asset readiness and warm-up.

| Sky Bridge after this route | Before geometries / textures | After geometries / textures |
| --- | ---: | ---: |
| Initial Sky | 146 / 41 | 146 / 41 |
| Treehouse → Sky | 166 / 68 | 149 / 42 |
| Treehouse → Sky again | 166 / 69 | 149 / 42 |
| Map → Carlisle → Sky | 315 / 106 | 156 / 52 |
| Repeat Map → Carlisle → Sky | Not sampled | 156 / 52 |

The first-visit plateau includes lazily initialized shared gameplay resources, such as the milk carton. Treehouse meshes are absent from Sky's attached scene. Repeated visits no longer accumulate their resources.

The same scene inventory was preserved in both versions: Sky 239 meshes / 328,455 triangles; Treehouse 510 / 479,715; map 446 / 2,332,042; Carlisle 7,189 / 16,330,773. Treehouse's scenery kit stays at 136 placements and 208,700 triangles. No level layouts, mesh buffers, image files, material styling, detail switching, resolution settings or frame caps changed.

Scene-render CPU medians stayed around 1.5–1.6 ms in Sky, 3.0–3.2 ms in Treehouse and 8.4–8.6 ms in Carlisle. Browser timings are noisy and are not an iPhone FPS benchmark. The supported improvement is reclaimed memory, removed repeat-visit leaks and reduced background UI work, without lowering fidelity.

## Validation and reproduction

- `tools/test-asset-lifetime.mjs`: shared owners, idempotent release, late completion/reacquisition, failure/retry, dependency lifetime, bitmap cleanup, identical atlases and stale shadow sampler cleanup.
- Existing jungle, Nightworks, level-switch, Treehouse traversal and offline-cache checks pass. Headless gameplay validators deliberately stub unrelated assets with 404 responses; live browser checks have no console errors.
- Isolated production TypeScript check and Vite build pass, excluding unrelated local character work. Full-render Treehouse and lightweight Jungle Ruins smoke checks pass.
- Local-only `performance-review.html?playtest&level=sky` runs the real level-switch sequences. Add `&trace` to inspect actual GPU texture allocation ownership. It is excluded from production entry points.

Assets are decoded again when revisiting a level after its last owner has released them; HTTP/offline file caching remains available. This trades an unnecessary permanent GPU allocation for work at the existing level-loading boundary.

## Follow-up: mobile remains slow at 540p

The next profile measured the full player step, rather than just scene submission. In the real touch presentation path at a literal 960×540, with CRT off, the dominant CPU cost was **full skinned-character interaction bounds on every simulation tick**. Three's default vertex getter repeatedly multiplies each bone's world/inverse matrices for every vertex influence. The torso's animated shape also prevented a simple whole-shape cache from helping.

The replacement preserves the full vertex set and current morphs. It shares each bone matrix across the pose, caches double-precision bind-space vertices and morph deltas, and reuses decoded skin indices/weights. Geometry, morph attributes and bind-matrix edits invalidate those caches. Non-affine bind matrices and custom vertex getters retain compatible paths. No collider approximation, animation throttling or rendering quality change is involved.

Desktop browser measurements of the mobile path (not physical iPhone FPS):

| Work per presented frame | Before | After |
| --- | ---: | ---: |
| Sky: character interaction bounds | 5.91 ms | 1.35 ms |
| Sky: complete player step | 7.29 ms | 2.72 ms |
| Treehouse: complete player step | 7.04 ms | 2.75 ms |

Also removed `backdrop-filter` from the **already invisible DOM copies** of touch buttons while the WebGL UI mirror is active. These blurs operated at the browser's device resolution independently of the game's 540p setting. The visible canvas controls, CSS dimensions, source colors, transitions and hit areas are preserved; native DOM presentation still retains its original blur.

Validation: 72 comparisons against Three's original bounds across multi-target relative/absolute morphs, four bone weights, non-unit weight sums, independent bone stretch, moving roots, cache edits, normalized/interleaved attributes, projective bind fallback and overridden getters agree within 1e-10. Existing character interaction and death-performance checks pass. Isolated TypeScript/Vite production build passes. Production touch pause/options/resume works, the selected 540p canvas reads 960×540, and full Treehouse rendering has no console errors. The older `test-game-hud-pipeline.mjs` fails an unrelated text-panel visibility source assertion; the same failure was reproduced on the unchanged previous release.

`mobile-performance-review.html?touch&playtest&level=sky` is a local-only profiling harness. Its optional ablations separate shadows, canvas UI and CRT costs; none of those ablations ships as a game setting or runtime quality reduction.
