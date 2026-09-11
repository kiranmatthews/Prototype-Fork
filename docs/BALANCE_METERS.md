# Curved balance meters and glove marker

The grind and manual bars now use four individual image-model drawings of a carved opening-parenthesis gauge. Horizontal grind/lip displays rotate the same artwork into an overhead arch; vertical manuals/lip displays retain the opening parenthesis on the player's left. Existing balance values, critical thresholds and lip camera-axis signs remain authoritative.

The meter has yellow/gold at the safe centre, orange toward the ends and red tips. Its small outline chips, painted scuffs and changing bevel facets come from the generated artwork. An irregular 90–180 ms cel sequence and restrained rigid jitter provide the requested stop-motion character. The glove and meter receive the same pose transform. Each frame has its own measured centreline, so the fingertip stays on the actual painted gauge as the artwork changes. Horizontal negative balance reads left; vertical positive balance reads down. Reduced Motion holds one cel while the functional marker still follows balance.

Both lite DOM and full pre-CRT gameplay call `src/balanceMeter.ts`. The full path uses the existing HUD Canvas2D surface and does not create another WebGL context. The old bars remain a loading/error fallback. The glove's red rim signals the critical state.

The built-in `image_gen` tool generated all artwork. Original outputs and exact prompts are saved in `art/balance-meter/v1/`. The three alternate meters initially received opaque checkerboard mattes; background-only image-model edits replaced those with a removable flat magenta matte. Packing keeps the complete generated contour and white highlights, using the existing matte-removal code, rather than clipping against a font vector. No image-model ID or quality tier was exposed by the tool.

Runtime files:

- `public/hud/balance-v1/meter-0.png` through `meter-3.png`.
- `public/hud/balance-v1/glove.png`.
- `public/hud/balance-v1/provenance.json` records source hashes, crops and exact prompts.
- `src/balanceMeterAssets.ts` records the measured per-frame paths and glove fingertip anchor.

Repack with `PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/balance-meter/bake.mjs` against the local Vite server at port 5178. Inspect `tools/balance-meter/review.html` for neutral/edge positions, all poses and light/dark backdrops. Source artwork and prompts stay separate from packed runtime PNGs.
