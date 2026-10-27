Waterfall Climb material art

wet-basalt.webp and sluice-timber.webp were generated with OpenAI's built-in
image generation tool for this project on 27 October 2026. The exact prompts
are retained in docs/waterfall-climb/imagegen-prompts.json. Runtime WebP files
are 1024 x 1024; the generated source PNGs remain in the author's image library.

Scenery reuses existing project Meshy assets from custard-creek,
carlisle-coast-fidelity and treehouse-trials-v2. Their original geometry,
textures and provenance are unchanged. Attribution: Meshy (https://meshy.ai/),
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), retaining the existing
library's conservative attribution basis. Source manifests and license files
remain beside the original models. This level adds no downloaded models.

The level's rock supports, gorge, water curtains, foam and sluice mechanisms
are authored procedurally in src/levels/waterfall-climb-art.ts. Existing
Three.js-based river/cascade shaders and scenery instancing are reused.
The same authored mesh geometry is retained at every viewing distance and in
reflections. No character animation or movement tuning is changed.
