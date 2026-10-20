# Campaign atlas and annotation return

The [completed Figma atlas](https://www.figma.com/design/kQePXXe2DEBRE4BCTFrEzC?node-id=18-1711)
replaces the earlier draft in the same file. The portable artifact is
`public/provenance/level-atlas/Level Atlas.sketch`; import it through Figma's file browser. It contains all 26 current campaign
levels, including branches, cups and the Crab Chief encounter, on three pages.
Each level has actual orthographic game scenery, transparent PNG cutouts for its
enemies/crates, editable geometry and labels, and an empty annotation group.

The [published atlas](https://kiranmatthews.github.io/Prototype-Fork/provenance/level-atlas/)
also provides visual SVGs, clean engineering SVGs, source snapshots and object
manifests. This auxiliary directory uses the existing `provenance/` exclusion
from the game's offline cache. No game geometry or movement was changed.

Duplicate a map before editing. Add arrows and numbered notes, retaining its
title, snapshot ID and A–D reference crosses. Moving, scaling and rotating the
whole drawing is supported. Keep names on objects you move. Identify the Y
height or surface ID when routes overlap. Return an edited Figma frame link
or SVG; screenshots need legible references. Scenery is a raster reference,
so describe scenery changes with an arrow and text rather than expecting to
edit an individual 3D prop by manipulating the raster.

The original projection is `8 px = 1 m`, +X right, −Z up. `offsetX/offsetY`
and `minX/minZ` in each manifest map frame-local coordinates back to the game.
`tools/level-atlas-return.mjs` also solves an affine registration from A/B/C,
checks D, and reports nearby source identities and height ranges. A component
index is snapshot-relative: confirm its hash/name/position against the current
source before applying edits. Native-builder captures are reference evidence;
never replace a native level with its potentially lossy editor capture.

The exporter runs the real `Level` with the public pack passed through the
normal registry resolver. Surface triangles are transformed into world X/Z
and unioned at 1 mm coordinate precision. Actual pit polygons, grind paths,
crate boxes, checkpoint spawn positions and moving-object centre travel are
retained. Blocking outlines are runtime bounds, which may be broad-phase
bounds. Max-Y labels describe whole meshes rather than the exact height under
the label. Conditional platforms and boss phase geometry are shown separately.

The scenery pass builds the same levels in a real browser, loads the assets,
and renders registered orthographic tiles at 4 pixels per metre. Every capture
reported zero failed assets and the same ground-mesh count as the vector pass.
Cutout centres retain exact X/Z locations. Each crate and enemy has its own
transparent PNG layer, with no white card or leader line. Stacked crates can
overlap in plan view; their names and manifests retain individual Y values.

Regeneration:

1. `node tools/level-atlas.mjs` — vectors, manifests and source snapshots.
2. `node tools/serve-level-atlas.mjs` — open the printed local URL and capture.
3. `node tools/style-level-atlas.mjs` — compose scenery and vector overlays.
4. `python3 tools/package-level-atlas.py` — native interchange (Pillow needed).
5. `node tools/test-level-atlas.mjs` — coverage, hashes and spatial round trip.
6. `python3 tools/validate-level-atlas-sketch.py <official-schema-dist>` —
   native file schema, embedded images and unchanged reference coordinates
   (jsonschema needed). Uses official `@sketch-hq/sketch-file-format` 6.5.0;
   template structures retain the MIT notice from Sketch's reference files.

Figma supports [Sketch imports](https://help.figma.com/hc/en-us/articles/360040027794-Guide-to-imports-in-Figma-Design).
The native file was imported and visually checked in Figma, then its 26 frames
were copied into the original file's three pages (12 / 11 / 3). Scenery and
transparent cutouts display alongside editable vectors, source names and
annotation groups. `figma.json` records the file/page links and archive hash.

The Sketch interchange uses PNG resources named by their SHA-1 digest,
transparent outline clipping masks, and Figma's available Inter fonts. These
are importer requirements found by small UI import comparisons: SHA-256 image
names produce empty fills, and painted masks cover the scenery. The validator
checks both conditions, the official schema and all anchor/cutout coordinates.
Direct SVG API import is unsuitable for this atlas because it omits embedded
images; the visual SVGs remain useful for previews and annotated returns.
