# Roo image font and highlight frames, v4

V3 repairs the enlarged font, adds three aligned baked lighting frames per glyph, and uses the PNG font in the HUD and menu screens. The Font Studio at `roo-type-lab.html` lets the user inspect any glyph, page through all 51, change spacing, control shimmer, export text PNGs and download the complete font.

V4 adds the supplied reference's short rising inner stroke to **0**, making it distinct from **O**. The stroke joins the inner left wall, curves upward and tapers before reaching the right wall. The zero's outer silhouette, cap size, bearings and advance are unchanged; every other glyph is pixel-identical to v3.

## Model and quality provenance

All 51 nonempty glyphs have recorded individual built-in `image_gen` passes. V3 adds individual cleanup passes for the 21 alphabet glyphs whose small reference crops had blurred or blotchy bevels: A, C, D, E, F, G, H, I, J, K, L, M, P, Q, R, T, V, W, X, Y and Z. The larger BONUS reference letters retain their measured material field. The numeric and punctuation passes retain their original source images with a repaired color bake.

The built-in tool does not expose a model selector or quality control, and its output does not report a selectable model ID or quality tier. This work therefore does **not** claim GPT Image 2.5 at `max` quality. OpenAI documents that combination for its API at https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst; that separate API path was not used. The exported provenance records these unknown fields as null.

Raw outputs and exact prompts remain in `art/roo-reference-match/`. Some raw images contain a painted matte/checkerboard or imperfect generated alpha. They are preserved unchanged as color sources. Final font transparency comes from the original Roo contours plus the authored zero accent; generated backgrounds never become font alpha.

## Repairs and bake

The old per-row 8-bit color correction followed holes and bevels, creating visible horizontal bands and hue excursions on otherwise smooth model images. `palette-profile.ts` now uses a smooth floating-point profile and continuous palette curves. Lighting variation is separated from the material hue, and shadow corrections are restrained. `color-projection.ts` pads the complete valid color field before sampling, avoiding magenta seams where model and Roo contours differ.

The alphabet cleanup passes replace the enlarged low-resolution color field with clean carved facets and continuous shading. The connected foreground extraction excludes neutral matte pixels and pads from uncontaminated interior colors. The bevel mesh uses 48 curve samples per segment for its lighting. Final alpha clips the padded RGB with Roo's original analytic Canvas paths, independently of mesh triangulation; this fixes narrow punctuation whose mesh coverage did not precisely match the font. The camera preserves exactly 384 pixels per cap band, with rendering and curve clipping at twice that resolution before downsampling. Space has an advance without a bitmap.

The two palettes are green/cobalt and gold/vermilion. Alternate-color glyphs are derived from the same material family; these are reconstructed Roo assets, not recovered original game assets.

The v4 accent is an authored vector in `tools/roo-type/zero-accent.ts`, using the user's preserved `art/roo-reference-match/zero-accent-reference.jpg`. Its narrow bevel samples a smooth floating-point color profile from the existing zero face and responds to the same three light positions. It is clipped at twice the atlas resolution and composited behind the existing zero, preserving all existing opaque pixels. There is no additional image-model pass. Metrics and provenance include the accent path so the bake and silhouette checks remain reproducible. The original TTF remains unchanged.

## Three lighting frames

Each palette has a neutral PNG plus `-light1` (left) and `-light2` (right). All three use the same camera, geometry, crop rectangles, bearings and alpha. Only the bevel illumination changes. The front gradient remains fixed.

The normal display follows an 11-second wave between the three positions. Strength defaults to 70%; reduced motion holds neutral. Canvas first paints each complete word with normal glyph overlap, then adds weighted premultiplied frames on an isolated surface. SVG uses isolated groups with `plus-lighter`. Ordinary source-over fading would change edge alpha and is intentionally avoided. This also keeps very tight or overlapping letters from brightening at their intersections.

The renderer reuses the existing Canvas/CRT path and caches word rasters. Menus reuse their measured DOM layout and existing composite surface; a changed light blend repaints color without remeasuring unchanged layout. There is no additional gameplay WebGL context or runtime mesh bake.

## Spacing and menus

Default extra tracking is now **−0.065 cap-band units**. Persistent counters previously added +0.10 units; their extra local offset is now zero. The `/total` gap uses the same preference, and numerator/denominator retain equal size and baseline. The measured reference scale remains 107 px for counters and 165 px for BONUS at 1672×941. BONUS retains its individual optical letter placements, with the shared tracking adjustment applied afterward.

Font Studio offers a slider and exact number input from −0.160 to +0.160, a reset button, shimmer/strength controls and a frozen light-position preview. Settings persist under `solProtoRooAppearanceV3` and propagate to other open game tabs. Options → Text Appearance opens the studio; Text Shimmer also toggles motion directly.

The PNG font decorates Roo menu titles, actions, saved-game labels, level/progress screens, results and Game Over. Warm timber panels use green/cobalt for contrast; dark areas use gold/vermilion. The world-map board title and competition headings/countdown also use the atlas. Existing comic control hints and prose retain their authored fonts. Semantic text and actual button hit targets remain in the DOM, and game-owned artwork remains below CRT.

## Delivered files

- `public/fonts/roo-bonus-v4.png`, `roo-bonus-v4-light1.png`, `roo-bonus-v4-light2.png`.
- `public/fonts/roo-counter-v4.png`, `roo-counter-v4-light1.png`, `roo-counter-v4-light2.png`.
- Matching palette metrics JSON, `roo-font-v4-provenance.json`, and `roo-image-font-v4.zip`.

Both palette metrics describe all three frames. The ZIP includes six PNGs, two metrics files, provenance and integration notes. Raw generation records and repair inputs are authoring sources, not runtime downloads.

## Rebuild and review

```sh
npm run dev -- --host 127.0.0.1 --port 5178
# Run any new per-letter edit with built-in image_gen, then register it:
python3 tools/roo-type/register-model-output.py --glyph A --palette bonus --version repair-v3 --source /absolute/generated.png --prompt A-repair-v3-prompt.txt --cleaned-material
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/model-font-review.mjs
# Inspect the baked proof before installing:
python3 tools/roo-type/install-bake.py
python3 tools/roo-type/check-zero.py
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/audit-glyphs.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/review.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/review-menus.mjs
PYTHON_BIN=/absolute/path/to/python3 PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/review-dom-alpha.mjs
node tools/test-game-hud-pipeline.mjs
node tools/test-game-flow-surface.mjs
node tools/test-game-flow-interaction.mjs
node tools/test-map-level-presentation.mjs
npm run build
```

Checks cover source provenance, Roo masks, exact alpha parity across the three frames, palette alpha parity, absence of pink/gray background contamination, distinct highlights on every glyph, stable overlapping-letter crossfades, exports, dynamic counter sizing, saved/cross-tab spacing, reduced motion, and lite/full menu layouts at 1280×720, 1920×1080, 1024×768, 390×844 and 844×390. Visual inspection remains necessary for material fidelity; numerical mask/color checks do not replace it. The full test suite is not part of this brief.

For the v4 accent, `check-zero.py` compares all six installed atlases against v3: only the zero tile may change, existing opaque zero pixels must remain identical, the new stroke must be present with an open right gap, and metrics and lighting-frame alpha must match. `tools/roo-type/zero-accent-review.html` displays the authoring bake beside O at 32, 56, 107 and 330 px, plus all three light positions. The v4 review repeated font/export checks and lite/full HUD smoke checks; the unchanged menu renderer retains the v3 layout review above.
