# Roo reference image font, v2

V2 is a PNG image font built from **51 separate image-model glyph passes** and the existing `RooRegular.ttf` contours. It replaces the rejected v1 procedural material. `roo-type-lab.html` previews the shipped font, accepts arbitrary supported text, and exports transparent text PNGs or the complete font ZIP. Lighting is baked; this version does not claim live 3D relighting.

## Material construction

Each nonempty Roo glyph received its own built-in `image_gen` call. The alphabet, 0, 2, 3 and slash use the supplied reference artwork as direct material evidence. Other glyphs use the original Roo silhouette and the same reference material. All selected RGB outputs and their prompts are preserved in `art/roo-reference-match/`; `public/fonts/roo-font-v2-provenance.json` records hashes and generator output IDs for every glyph.

The image model can change the reference's light balance or leave a black surround. The final bake therefore uses three explicit sources of truth:

1. Original Roo contours for the silhouette, holes and antialiased alpha.
2. Reference pixels for the visible light/color field where a reference glyph exists.
3. The individual model pass for finer surface detail on the raised face. That detail fades out at the outer bevel, preserving the reference's edge profile.

The reference crops contain black-matted antialiasing and bits of scenery. The authoring renderer identifies the connected colored glyph, retains real bright glints, rejects dim background-contaminated boundary samples, and extends valid edge colors before sampling. This avoids the dark dotted seams that a naive crop or transparent-black texture produced. The final PNG alpha comes from Roo geometry, not from a painted checkerboard. Model RGB files remain unchanged.

`tools/roo-type/color-projection.ts` implements this bake. `palette-profile.ts` keeps the two colorways consistent while preserving light/dark variation. Direct reference glyphs in their original colorway retain their full two-dimensional light/color field. The alternate colorway and unseen glyphs are derived from the same measured material family; they are not claimed to be recovered original game assets.

## Typography

The reference is 1672×941. Its BONUS word occupies about 626×162 colored pixels. `layouts.BONUS` records each letter's measured x/y position and size, because equal tracking or a total-width fit hid errors in N and U. Font size 165 reproduces that optical layout.

The alphabet proof uses a 59 px band. The warm numeral reference uses a 107 px band, producing a roughly 93 px zero. Optical glyph sizes and baseline offsets are derived from the reference boxes while retaining Roo's vector contours. The source font-wide band is −76 to 806, or 882 units in a 1000-unit em; CSS em size and visible letter height are not interchangeable.

The game scales the number and title bands against the reference viewport height. Current/total crate counts now share one font size and baseline. Numeric tracking is 0.10 band units with measured slash/23 pair corrections; the split `/total` starts with a 0.04-em gap. Both the DOM/lite renderer and Canvas/CRT renderer consume the same placements and metrics. Changing digit count does not change the cap band. Compact portrait layout places the bonus crate counter above the fruit/life row so the enlarged readouts stay on-screen.

## Delivered files

- `public/fonts/roo-bonus-v2.png` — green/cobalt RGBA atlas.
- `public/fonts/roo-counter-v2.png` — gold/vermilion RGBA atlas.
- Matching `.json` files — crops, bearings, advances, kerning, cap metrics and BONUS optical layout.
- `public/fonts/roo-font-v2-provenance.json` — all 51 image-model hashes, output IDs and exact prompts.
- `public/fonts/roo-image-font-v2.zip` — both atlases, metrics, provenance and a short integration note.

Each atlas is 2048×2724 with 384 pixels per cap band. The bake renders at twice that resolution with MSAA and downsamples with smooth alpha. The two colorways have identical alpha masks. Space is an advance without a bitmap. Roo does not contain ×, ° or an ellipsis; the existing readable font fallback still handles unsupported characters.

`src/roo-type/atlas.ts` uses the existing Canvas2D HUD surface, adding no gameplay WebGL context or per-frame bake. `dom.ts` uses the identical atlas in SVG viewports with semantic text retained. Game-owned artwork remains below CRT, so the full game's existing CRT treatment still applies to the final display.

## Rebuild and review

```sh
node tools/roo-type/build-source.mjs
python3 tools/roo-type/prepare-image-inputs.py
npm run dev -- --host 127.0.0.1 --port 5178
# Run each desired glyph prompt with built-in image_gen, then register its output:
python3 tools/roo-type/register-model-output.py --glyph A --palette bonus --version 01 --source /absolute/generated.png --prompt A-extraction-prompt.txt
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/model-font-review.mjs
# Inspect dark/light and enlarged proofs before installing:
python3 tools/roo-type/install-bake.py
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/review.mjs
node tools/test-game-hud-pipeline.mjs
node tools/test-hud-visibility.mjs
node tools/test-combo-hud-parity.mjs
npm run build
```

`ROO_LAB_URL` changes the local review server. The model-font bake refuses missing glyph passes unless explicitly run as an authoring-only partial proof. Installation verifies every model file against its generator output hash or previously recorded provenance. These tools do not make new API/CLI image-generation calls.

The direct authoring comparison remains in `tools/roo-type/reference-review.html`. It shows the original, rejected v1, raw model treatment and reference-preserving treatment separately. Interior color statistics are explicitly scoped to the interior and are not used as proof of edge quality. Final browser review checks all glyph masks, palette alpha parity, absence of magenta contamination, PNG/ZIP exports, dynamic number sizing, equal `/total` sizing, and actual lite/full/bonus/portrait presentation. Visual inspection covers the bevels and color transitions at native size and the repaired edges at larger size. The full test suite is not part of this brief.
