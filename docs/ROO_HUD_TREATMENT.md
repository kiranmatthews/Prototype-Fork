# Roo HUD bevel and image font

The working treatment is in `roo-type-lab.html`. It has two render modes: real lit 3D letters and the baked PNG font used by the game. Both originate in the existing `public/fonts/RooRegular.ttf`; the font is not traced, redrawn or substituted. This is a close material study of the supplied screenshot, not a claim to have recovered that game's original shader.

## What makes the reference work

The important features are broad, angled chamfers around both the outside and the holes; sharp changes between the front face and bevel; a saturated height gradient; a strong upper-left key and restrained opposing fill. The reference's green remains green through most of the letter before becoming cobalt near the bottom. The warm digits progress from yellow to orange to deep red. A bright outline alone cannot produce those direction-dependent faces.

The old code had two different presentations: an SVG offset/rim treatment and a flatter Canvas2D gradient plus stroke. The full game used the latter before CRT, so improving the SVG did not improve the composited HUD.

`src/roo-type/geometry.ts` now constructs a genuine inset face, triangulated bevel, side walls and back. A simple Three `ExtrudeGeometry` proof produced folds at Roo's narrow spikes. The final implementation uses an integer polygon inset/difference to resolve those intersections. This follows the negative-offset behavior documented by [Clipper](https://www.angusj.com/clipper2/Docs/Units/Clipper.Offset/Classes/ClipperOffset/_Body.htm); Three's separate [bevel width, thickness and depth controls](https://threejs.org/docs/pages/ExtrudeGeometry.html) informed the initial proof.

The default bevel width is 3.2% of the fixed cap band, its rise 2.6%, and the back depth 2.6%. Curved contours share normals within 36°, while the face/bevel break remains hard. The shader shades those real normals, interpolates colors in linear light, and outputs sRGB. It has no outer stroke, black extrusion copies, drop shadow, bloom or stock environment map.

The live proof allows ±25° yaw, pointer-directed light, slow ±2.6° idle yaw, ±1° pitch, and approximately ±3.5% light modulation. Reduced-motion preference disables the idle animation. A PNG has fixed lighting; a CSS transform on it would move the image without relighting its bevel. Use the live geometry when that distinction matters.

## Size and spacing measured from the supplied image

Measurements below are approximate colored-pixel bounds in the 1672×941 reference, excluding the heavy black surround.

| Reference element | Colored bounds / size | Spacing observation |
| --- | --- | --- |
| BONUS | X 546–1172, Y 60–222; 626×162 px | Approximately 8–16 px between the colored bounding boxes |
| Left `0` | 69×93 px | Broad standalone counter |
| `0/23` | 286×105 px, including the taller slash | Approximately 11–19 px gaps |
| First alphabet row | 712×55 px | Deliberately spaced specimen; approximately 18–23 px gaps |

The alphabet panel is not normal word tracking. Giving a title the same loose spacing makes it look wrong. The lab therefore uses 1.2% cap-band tracking for the title, 7% for the reference counter specimen and 32% for the alphabet specimen, **in addition to Roo's original advances and bearings**. The game retains its existing compact authored counter tracking.

The exact Roo font-wide A–Z/0–9 band is −76 to 806: 882 units in a 1000-unit em. A 90 px cap band needs a 102.04 px CSS font, rather than a 90 px CSS font. Individual letters deliberately have different outlines: Roo's `0` occupies 768/882 of the band, so a 107 px band produces a roughly 93 px tall `0`. The lab defaults to a 166 px title band, 107 px counters, and a 56 px alphabet band. Roo's own proportions are retained, so word width is not forced to the reference using horizontal distortion.

Both game paths now use the same band, advances, tracking and baseline. The 1.285-em DOM box has symmetric vertical padding. The Canvas mirror derives the cap height from that box before width fitting; adding digits cannot silently enlarge individual letters. Max-width fitting scales the whole line proportionally.

## PNG delivery and runtime

- `public/fonts/roo-bonus-v1.png` and `roo-counter-v1.png`: transparent 2048×1085 atlases, 256 pixels per cap band, 52 supported glyphs including digits and punctuation. Together the PNGs are about 1.64 MB.
- Matching `.json` files contain crop rectangles, bearings, advances, kerning, cap metrics, palette and source font SHA-256. They are image fonts, not equally sized tiles.
- `src/roo-type/atlas.ts` draws cropped glyphs into the existing gameplay Canvas2D texture below CRT. It adds no game WebGL context, per-frame mesh generation, shader or texture upload.
- `src/roo-type/dom.ts` uses the same images in SVG viewports for direct/lite rendering and retains semantic text for accessibility and HUD state reads.
- The old renderer remains the image-load fallback. Unsupported characters use readable font rendering rather than substituted question marks in the shipped HUD.

The bake renders each glyph at twice the atlas resolution with MSAA, then downsamples with smooth alpha. The live lab renders at 2–3 physical pixels per CSS pixel with MSAA. CRT continues to affect the full game's output; the lab shows the source lettering without CRT.

The lab exports the current title as a transparent PNG at twice its selected cap height. **Export PNG image font + metrics** produces one ZIP containing both palettes and their JSON metadata. Its lighting and bevel follow the live material settings; the PNG comparison mode displays the shipped default atlas.

## Reproduce and verify

```sh
node tools/roo-type/build-source.mjs
npm run dev -- --host 127.0.0.1 --port 5178
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/bake.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/roo-type/review.mjs
node tools/test-game-hud-pipeline.mjs
node tools/test-hud-visibility.mjs
node tools/test-combo-hud-parity.mjs
npm run build
```

`ROO_LAB_URL` selects another local server; `ROO_REVIEW_DIR` selects the capture directory. `ROO_REVIEW_GAME=0` runs only the isolated material proof. Playwright is a development tool, not a shipped dependency. Clipper and its types are pinned development dependencies used by the live lab; they are absent from the gameplay atlas renderer.

The browser review checks every glyph's alpha silhouette against Roo's native rasterization, antialiased coverage, actual light response with a fixed pose, positive yaw, dark/light backgrounds, mobile layout, and the game in lite/full modes. The initial complete glyph comparison had a worst overlap of 97.9% (the tiny apostrophe), with 43,235 partially covered alpha pixels. The full game used one existing HUD composite, with no browser or shader errors. Only focused checks and the lightweight production build were run for this brief.
