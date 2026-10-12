# Custard Creek waterfall revision (superseded)

The user rejected this mist and expansive panorama. The current result is documented in `docs/custard-waterfall-simple`; the footage here is retained only as revision history.

The background now shows a wide gorge below the summit, with a complete view down to the river. The vista's top moved from Y=60 to Y=-3.25, its width decreased from 550 to 270 metres, and its position moved 16 metres downstream. The foreground cliff plate is smaller and lower. New built-in ImageGen plates contain no frozen spray.

Three transparent mist layers use the existing scenery clock and different world-position phases. Billows rise, drift and continually change density. Their six total triangles share one material and need no particle spawning or separate render pass. The foreground waterfall crest continues to flow.

- `before.jpg`: original crop and photographed spray.
- `after-approach.jpg`, `after-summit.jpg`, `after-brink.jpg`: actual full-render player views.
- `motion.webm`: 4.5 seconds recorded directly from the game canvas.
- `verification.json`: exact gameplay preservation, final layer placement and the WebGL motion check.

Final generated assets: `public/custard-creek/waterfall-vista-v3.webp` and `waterfall-cliffs-v2.webp`. The complete built-in ImageGen prompts and hashes are in `tools/custard-assets/waterfall-revision/`. The shader is in `src/custardWaterfall.ts`; placements are source-owned in `src/levels/custard-valley.ts` and synchronized to the published pack.
