# Bone Head HUD portrait

Generated on 5 November 2026 (Pacific/Auckland) using the built-in ImageGen tool with transparency enabled. The exact prompt is in `prompt.txt`.

- Style/edit reference: the existing `public/roo.png` portrait.
- Identity reference: `model-reference.png`, rendered from the game's exact `createMeshyHead()` model by `reference.html`. The underlying Crowned Inferno Skull model was created with [Meshy](https://www.meshy.ai/), attributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); see `public/characters/meshy-head/provenance.json`.
- Original generated output: `hero-source.png` (1254 × 1254 RGBA, preserved unchanged).
- Runtime asset: `public/bone-head.png`, packaged at 256 × 256 with alpha preserved using `sips -Z 256 art/bone-head-hud/hero-source.png --out public/bone-head.png`.

The active character head chooses the HUD portrait: `skull` uses Bone Head; `alternate` keeps BoolieRoo. Both direct DOM and the native pre-CRT HUD use the same selected asset. Classic portrait/SPECIAL placement moves down by 10% of its own height (the old -14% offset is now -4%). Modern's count below the portrait and Bonus's bottom-row composition keep their existing layout.

SHA-256: source `95385e5bda3ce7e405d8147e67378fca532ed46e0b50cae796ccb6dd174e838a`; runtime `4793901710d793c69c4342f11b8d7677497325963c46b35cd4ff044f1dba3998`.
