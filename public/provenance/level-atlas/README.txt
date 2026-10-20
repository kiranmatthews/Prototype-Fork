LEVEL ATLAS — CODEX / SOL
26 campaign levels, including branches, cups, and the Crab Chief encounter.
Bonus stages, the world-map hub, room interiors, retired levels and debug-only
courses are outside this pack. Bonus entrances inside main levels are shown.

OPEN AND EDIT
Import "Level Atlas.sketch" from Figma's file browser (Home > Import).
It contains all 26 maps on three pages, with image layers and editable paths
and labels. Figma officially supports Sketch imports:
https://help.figma.com/hc/en-us/articles/360040027794-Guide-to-imports-in-Figma-Design
The completed atlas is already in the original Figma file:
https://www.figma.com/design/kQePXXe2DEBRE4BCTFrEzC?node-id=18-1711
All 26 maps were imported and visually checked on its three pages.
The visual SVGs are portable previews, but Figma's API SVG importer dropped
embedded imagery in the checked samples. Use .sketch for the complete visual
atlas, or import .plan.svg when you only want editable engineering vectors.
Each map combines real top-down game scenery, actual model portraits,
editable geometry outlines, and editable text. Duplicate the frame
before experimenting. Add an "ANNOTATIONS" layer above its geometry.

DRAW AND RETURN
1. Put a numbered note beside each arrow, area, or moved object. Examples:
   "01: widen this landing 2 m to the right"; "02: move CP0002 to this dot";
   "03: raise C0034's upper end by 1.5 m, keeping the lower end fixed".
2. Keep the title and the four A/B/C/D reference crosses with the map.
   Moving, scaling or rotating the entire map together is fine. Do not move
   the crosses independently or distort/warp the drawing.
3. For object moves, keep the vector's existing name/ID. Leave a ghost copy
   or an arrow at the original position if the move is visually ambiguous.
   Additions should be labelled NEW with type, width/depth and intended Y.
4. Send the edited FRAME link back to Codex. Exported SVG is the portable
   alternative. Screenshots also work when title, coordinate references and
   annotations are legible, but SVG/Figma gives more precise positions.
5. Specify vertical changes in words or numbers. This plan contains X/Z;
   height is Y and cannot be inferred from a freehand arrow alone. When two
   floors overlap, identify the surface ID or its Y range.

READ THE MAP
All drawings use 8 pixels per metre, +X right and -Z up. Grid spacing is 10 m.
The visual SVG includes a separate raster scenery layer with the actual
trees, buildings, rocks, textures and props. Its enemy and crate portraits
are captured from loaded game models. The actual models appear as small transparent PNG cutouts centred on their
exact X/Z positions, with no white cards, leader lines or grouped callouts.
Every crate and enemy has its own named cutout. Stacked crates share X/Z and
can overlap; their individual Y values remain in layer names and the manifest.
The clean plan retains every individual collision footprint.
The right-hand visual key names and counts the enemy/crate types in that level.
The .plan.svg alternative omits imagery for a clean engineering view.
Green, teal, blue and violet encode increasing surface height. Surface text
says maxY: the maximum Y of that whole collision mesh, not the height at the
text's position. A ramp/terrain mesh can span a wide height interval. Select
its named vector to read min and max Y; the manifest retains both.
Hide higher "03 Surfaces" layers to inspect lower overlapping geometry.
Blue lines are real grind paths, including systemic edge rails.
Rust outlines show runtime BLOCKING BOUNDS (including invisible containment).
They can be broad collision bounds rather than the rendered wall silhouette.
Red areas are death volumes; surfaces above them are drawn over the red.
Purple dashed lines show platform/rail centre travel, rope reach, portals or
conditional geometry. They are not swept occupied areas or recommended jumps.
The faint dashed camera lane is not a guaranteed traversable path.
Start, checkpoints, crystal, bonus entrance and finish retain world positions.
Checkpoint dots are respawn feet positions. Fruit, enemies and crates retain
their runtime positions; small icons exaggerate size for legibility.
Cups finish through scoring rules. Crab Chief finishes through the encounter;
its logical gate, fully extended tongue and formed ramp are separately named.

ACCURACY AND SNAPSHOT
The exporter constructs the real Level with the public level pack loaded
through the normal levelList() resolver, then projects transformed collision
mesh TRIANGLES into X/Z and unions them at 1 mm coordinate precision. Curves,
holes, rotations and banks therefore come from the runtime geometry rather
than centre/size approximations. Pit polygons retain their actual narrow
shape instead of only their enclosing bounding rectangle.
It uses the current WORKING TREE snapshot, which can differ from the deployed
game. Each title has a snapshot ID; each manifest records the Git HEAD and
source hashes. It never adopts another browser's private local edits.
The visual SVG's scenery is rendered using the real Level in a browser after
all art assets load, with an orthographic camera at 4 raster pixels per metre.
The collision vector layer remains 8 pixels per metre. Scenery is registered
to the same world coordinates without perspective. All 26 captures reported
zero failed assets and the same ground-mesh counts as the vector extraction.
Scenery pixels and portrait images are raster references, not individually
editable 3D objects. Annotate scenery changes using an arrow and a note; the
manifest also stores named scenery placements from the source snapshot.
The map shows
the initial world state plus explicit motion/conditional overlays, not every
animation state. Collision bounds beyond the framed playable region are
clipped visually and retained in the JSON. Bonus sublevels are not expanded.
Native levels are mapped directly from their live meshes. Their captured
source JSON is reference evidence and can be lossy for bespoke mechanics;
it must NEVER be blindly imported over a native level to apply annotations.

FILES AND IDENTITIES
Level Atlas.sketch       Complete Figma import: images + vectors + labels.
NN-level.svg             Visual drawing with embedded art; keep a baseline.
NN-level.plan.svg        Clean engineering vectors without scenery pixels.
art/icon-*.png           Reusable transparent PNG model cutouts.
NN-level.json            Object geometry, source IDs, heights and registration.
NN-level.source.json.gz  Exact captured authoring snapshot for this export.
inventory.json           Complete campaign coverage and map metadata.
figma.json               Completed Figma file/page links and verified archive hash.
index.html               Local/published preview with layer controls and coordinates.

C#### is a 1-based source component reference within this snapshot; its
componentIndex is 0-based in JSON. Component hash and authored name/position
allow matching after source insertions. G#### refers to a native runtime
ground mesh. R/K/CP/W/P/E/F are rails, crates, checkpoints, wall bounds, pits,
enemies and fruit. IDs are stable within the recorded snapshot, not a promise
that array positions will never change. Resolve against the baseline hash.

COORDINATE RETURN (FOR CODEX)
Original map-local coordinates:
  X = minX + (svgX - offsetX) / pixelsPerMetre
  Z = minZ + (svgY - offsetY) / pixelsPerMetre
Use the three non-collinear reference crosses A/B/C to solve the affine
mapping after a Figma frame or screenshot transform. D checks consistency.
Read the centres of the cross strokes, not the bounding boxes of their text.
The repository's tools/level-atlas-return.mjs converts a point using these
references and lists nearby object IDs and height ranges. Interpret freehand
annotations alongside their written intent; do not turn every drawn stroke
into geometry. Compare baseline to current source before making edits.

Regenerate vectors with: node tools/level-atlas.mjs
Capture art with: node tools/serve-level-atlas.mjs, then open the printed URL
and click Capture all 26 levels. Existing matching scenery tiles are reused.
Compose visual maps with: node tools/style-level-atlas.mjs
Package for Figma with: python3 tools/package-level-atlas.py (requires Pillow)
Validate with: node tools/test-level-atlas.mjs
