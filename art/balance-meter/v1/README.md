# Balance HUD artwork

Created with the built-in image_gen tool for this project. Four real meter drawings and a separate cartoon glove are packed into `public/hud/balance-v1/` by `tools/balance-meter/bake.mjs`.

Selected source files are `meter-0-source.png`, `meter-1-source.png`, `meter-2-source.png`, `meter-3-source.png` and `glove-clean-source.png`. The original glove and the opaque-checker attempts are retained as authoring history. Exact prompts are in `prompts/`; the packed provenance JSON includes their full text and source SHA-256 values. The three `meter-*-checker-source.png` images are not runtime assets.

The meter variations are image-model edits of the finished base artwork, not procedural redraws. Magenta-only corrections remove the model's accidental background pattern while preserving the coloured surface. A common canvas and a measured curve for each frame keep the marker's value accurate during the stop-motion animation.
