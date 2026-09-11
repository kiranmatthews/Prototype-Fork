# Rebuilt Roo zero, v5

The zero begins as a flat black-and-white letterform with a broad accent integrated into its inner contour. The entire glyph then receives a fresh built-in `image_gen` pass and the existing complete bevel, material, analytic-alpha and three-light bake. The v4 accent overlay was removed.

- Flat input: [zero-flat.png](zero-flat.png), with editable [SVG](zero-flat.svg) and complete [Roo outline](zero-outline.json).
- Original flat Roo zero: [zero-original.png](zero-original.png).
- Exact image-model prompt: [0-counter-rebuild-prompt.txt](0-counter-rebuild-prompt.txt).
- Unchanged generated output: [0-counter-rebuild-v5.png](../candidates/0-counter-rebuild-v5.png). The model/quality selector was not exposed by the built-in tool.
- Installed font: [roo-image-font-v5.zip](../../../public/fonts/roo-image-font-v5.zip), including both palettes, all three light frames, metrics and provenance.

The full outline and source input are recorded in `roo-font-v5-provenance.json`. Original Roo outer contours, cap size, bearings and advance remain unchanged. The new accent adds 3,029 opaque-mask pixels versus v4's 1,022 at the 384 px cap band. All other glyph pixels match v4 exactly. The complete zero has newly rendered material; its ring pixels are intentionally refreshed with the accent.

Inspected both palettes at 32, 56, 107 and 330 px, plus the three light positions. Focused checks verify the thicker stroke, open right gap, fresh model source, exact outline, unchanged other glyphs/metrics and identical frame alpha. Font exports, lite/full HUD smoke checks and the production build pass without browser errors. No full suite was run.
