# Roo image font v8: reference colours and visible glisten

V8 retains the approved v6 finished glyphs and glisten sources. Each finished glyph supplies the artwork. Full painted bevels, highlights, counter shapes and pointed terminals are retained. The original Roo vectors guide the letter design and cap metrics; they do not clip the finished image. All 51 nonempty glyphs have individual image-model sources. The approved accented zero is reused unchanged from v5, and the other 50 neutral masters were rebuilt to match its finish.

## Artwork and glisten

`art/roo-reference-match/raster-v6/manifest.json` records the selected neutral masters and two glisten edits for every glyph. Each glisten request feeds **only the already-generated neutral** to the built-in image model and asks for highlights and shadows in gently different areas. Camera, form, openings, bevels, gradients and detail stay fixed. Near-white specular peaks are retained for the user's later real-time bloom; the font bake adds no halo or glow.

The bake removes a separate magenta matte (or uses genuine generated alpha), keeps all complete artwork, registers each edit to its neutral, and composites it source-atop the neutral bitmap. The neutral image supplies the fixed full alpha shape. Where a model contour drifts slightly, the original edge pixels remain available. All three output frames share identical alpha. There is no inferred normal field, procedural reshading, reconstructed bevel or original-vector stencil.

A–D initially received opaque gray checkerboards despite transparent requests. Background-only model edits replaced those mattes with flat magenta while preserving white bevel glints. The font baker rejects gray/checker mattes instead of guessing which white pixels belong to the lettering. Original outputs and prompts remain in the authoring record.

The approved gold/orange neutral PNG is retained byte-for-byte. Green/cobalt now follows the original reference's saturated lime/green and azure/cobalt pigment, using the earlier sampled reference palette rather than the fluorescent v6 or washed v7 grade. The mapping retains painted detail and white glints with no spatial masks or geometry changes. Newly lit specular pixels in each existing image-model light edit are strengthened, preserving the same alpha and the approved neutral. It does not reconstruct or reshape the bevels.

The built-in image tool did not expose or report a selectable model ID or quality tier. Provenance records those fields as unknown; this work makes no claim of a verified GPT Image 2.5/max setting.

## Runtime, size and spacing

Both palettes contain neutral, `-light1` and `-light2` PNG atlases at a **512 px source cap band**. Canvas first draws a complete word per frame, then adds weighted premultiplied frames on an isolated surface. SVG uses matching isolated groups and `plus-lighter`. The weights sum to one, retaining edge alpha even when tight letters overlap. The full light cycle is now 4.2 seconds, with saved strength controls and a finer 1/256 phase cache. No extra gameplay WebGL context or live glyph mesh is introduced.

Reference sizing remains 107 px for counters and 165 px for BONUS at 1672×941. Numerator and denominator share size and baseline. Advances follow the complete neutral artwork; the measured BONUS optical layout remains available. Default extra tracking is −0.065 cap units and can be tuned from −0.160 to +0.160. Settings now use `solProtoRooAppearanceV4`. V3 spacing and explicit off/zero/custom strength preferences migrate; the old default 70% movement becomes the new 100% default. Updates propagate across open game tabs.

Font Studio now moves its light-position slider with the actual animation, reports paused/reduced-motion/zero-strength states, enables manual inspection while motion is reduced, and provides a three-frame comparison view. The main BONEMAN title uses the orange palette at a larger responsive size; its menu controls retain a compact, separate column. Font Studio opens on the orange BONEMAN preview. The same font serves HUD, menus, world-map titles and competition headings. Semantic DOM text, button targets, comic control hints and the existing pre-CRT presentation path are preserved.

## Delivered files

- `public/fonts/roo-bonus-v8.png`, `roo-bonus-v8-light1.png`, `roo-bonus-v8-light2.png`.
- `public/fonts/roo-counter-v8.png`, `roo-counter-v8-light1.png`, `roo-counter-v8-light2.png`.
- Palette metrics, `roo-font-v8-provenance.json`, and `roo-image-font-v8.zip`.

The ZIP contains six PNGs, two metrics files, provenance and integration notes. Provenance includes all neutral and glisten source hashes, exact prompts, and the neutral input used by every glisten edit. Raw authoring sources are retained in the repository rather than downloaded at runtime.

## Rebuild and review

The neutral masters are frozen. Generate new candidates only when an explicit art revision requires them. Glisten edits always start from the selected neutral, never the flat font stencil.

```sh
npm run dev -- --host 127.0.0.1 --port 5178
node tools/roo-type/prepare-glisten-prompts.mjs
# Run each saved prompt through built-in image_gen with its approved neutral.
node tools/roo-type/register-glisten-output.mjs 0041 left /absolute/generated.png
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/raster-bake.mjs
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/capture-atlas-audit.mjs
# Inspect the complete artwork and every glisten frame before installation.
python3 tools/roo-type/install-raster-bake.py
# V8 restores the reference palette and strengthens existing model glints.
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/refine-font.mjs
python3 tools/roo-type/install-refined-font.py
python3 tools/roo-type/check-raster.py
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/review.mjs
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/review-lighting.mjs
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/review-menus.mjs
PYTHON_BIN=/absolute/python3 PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs node tools/roo-type/review-dom-alpha.mjs
npm run build
```

`glisten-proof.html` compares the neutral and an actual animated fade. `atlas-audit.html` and its capture script show all three frames for all 51 glyphs in both palettes. Checks cover preserved components, no clipped tile borders, complete source provenance, fixed alpha, different glisten pixels, actual clock-driven pixel changes, pause/manual/reduced-motion controls, exports, sizing, spacing and lite/full HUD/menu rendering. Exact overlap with the original flat font is deliberately not an acceptance gate. Visual review of the finished artwork remains required. The full test suite is not part of this brief.

Menu appearance controls now live in the M-dismissible **Text Tuning** panel, including shimmer, light strength, letter spacing and the studio link. They are not gameplay options. The menu Canvas mirror keeps the full HUD render-target resolution (physical DPR on a direct target) and skips nested PNG decoration when collecting semantic text, so each label is painted once.
