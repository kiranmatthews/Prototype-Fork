# Nightworks floating rock kit

Seven original Meshy smart-topology models, generated and textured from original built-in OpenAI imagegen references for the project owner. This pass used **105 of the authorized 1,000 Meshy credits**. Task handles and budget accounting are in `tools/nightworks-kit/tasks.json`; private signed responses and raw exports stay in the ignored `.img2threejs/nightworks-kit` authoring directory.

| Model | Use | Near / far triangles |
| --- | --- | ---: |
| plateau | Broad rest islands | 2,527 / 707 |
| stepping-rock | Moving islands and lifts | 1,856 / 555 |
| long-island | Elongated rest islands | 2,081 / 623 |
| phase-rock | Disappearing pads | 1,863 / 556 |
| rock-ridge | Moving grind crests | 1,659 / 580 |
| anchor-rock | Rope anchors and beacon crags | 1,850 / 553 |
| distant-arch | Large background silhouettes | 2,402 / 573 |

The seven public GLBs total about 6.2 MiB. Each includes a real far mesh, mipmapped KTX2 albedo with a JPEG fallback, and retained normal/roughness maps. Play uses matte Lambert lighting. Coordinates are normalized; `src/nightworksModules.ts` supplies the nominal editor dimensions. Textures and geometry are shared between placements.

The playable models have a single planar stone cap around their natural outer rim. Overlapping generated top shells were cut away in Blender, then closed and textured using `references/top-albedo.png`. `src/nightworksShapes.json` comes from those same fitted vertices and triangles, so ground and ledge collision are available before model downloads complete. Moving platforms, phase pads and stone grind ridges carry their collision and art on the same authored cycles. Inactive phase pads remove ground and side collision together with their solid art.

The complete course is source-owned in `src/levels/nightworks.ts`. A fixed-heading camera spine keeps the switchbacks stable. The long two-rail crossing has a forward-looking view volume spanning both rails’ full sideways cycles, with feathered approach/landing transitions. Held input keeps its direction through the camera blend; fresh input follows the current view. Existing travel direction, sine timings, checkpoints and summit gate remain; two touching pairs of rest slabs are joined into single islands to avoid seams. All seven models also appear in the editor asset catalog. The `travelPhase` rope field preserves the third ferry's independent anchor phase through editing and export.

Swing ropes and grind ropes globally use continuous helical hemp geometry and a fine fibre texture. The swing's endpoints keep their original pendulum timing, while the middle gains a modest secondary bend and sideways sway. Grab distance, hand positions, rope visuals and release velocity sample the same curve. Grind-rope visuals follow their rebaked sagging polyline.

Rebuild with the official Meshy CLI wrapper, `bake.py` in Blender, then `pack.py`. The generated image references and prompt descriptions are in `tools/nightworks-kit/references` and `tools/nightworks-kit/prompts.json`. No credentials or signed download URLs are published.
