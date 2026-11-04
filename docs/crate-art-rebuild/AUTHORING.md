# Crate family rebuild — authoring record

The user rejected the first procedural family as a visual downgrade. Technical
checks on that version are not evidence of acceptable art quality. The user
requested keeping the current published version live until this replacement is ready.

## Reference and direction

[Crash Bandicoot 4: Crates](https://www.artstation.com/artwork/9mPL0a)
provides the sculptural starting point: bowed posts, broad unequal boards,
strong joinery, restrained grain, deeply recessed panels and purposeful wear.
Use unique broad forms rather than dense repeating linework. No visible face
may be a blank cube, including the lid, underside and reverse.

### User correction: explosive identity

TNT and Nitro are wrapped upright stick bundles, not wooden crates. Neither
bundle may carry lettering, labels, or TNT/NITRO writing. TNT alone has a
chunky animated fuse. Nitro has NO fuse and its green parts glow. Preserve the
earlier red/plain-canvas and acid-green/hazard-wrap identity while refining
the sculpt, crimped ends, wrap tension and animation. The first paired concept
contained unwanted writing and a Nitro fuse; it is superseded by
`explosive-bundles-reference.png`.

## Image generation

Mode: built-in ImageGen. Reference: the linked ArtStation crate study.
Saved output: `wood-sculpt-reference.png`.

### Final wood reference prompt

Create one exceptional production 3D game prop reference image: a single CLOSED WOODEN CRATE, entirely visible in a front-right three-quarter view, eye level just above its top. Use the supplied Crash Bandicoot 4 crate study as a reference for the sculptural language, but design a new crate with no logos, text, characters, or decals. This image will be reconstructed as a real-time mesh. The crate is a one-metre cube with an animated, hand-sculpted silhouette: thick outward-flared corners, subtly pinched concave sides, jaunty uneven rails, chunky chisel-cut bevels. Four deep corner posts and bold perimeter rails surround THREE broad wooden infill planks per face. All six faces including the closed lid and underside must be solid, paneled and consistently constructed. NO X braces anywhere: keep the recessed central panel area of each face clear so gameplay markings can be added later. Infill boards have wide irregular seams, individual gentle bows and slightly different widths. Each frame member has a deliberate broad taper, a few chisel dents and 2 or 3 characteristic carved wood grooves; avoid dense repeating grain. Details are sculpted and painted, never photographic noise. Rounded blackened steel nail heads sit in small recessed sockets at the major joins. Warm orange chestnut planks, golden honey edge highlights, deep warm burgundy-brown joinery shadows, a few pale fresh-cut chips. Rich hand-painted color variation from brush-shaped patches and broad grain curves; convincing satin-matte wood, subtle roughness differences, soft sculpted normal detail. AAA stylized platform game art, Crash 4 aesthetic, clear chunky angular shape language, excellent broad form and material definition. The wood should feel thick, handmade and lively, neither straight machine-cut slats nor soft melted clay. Balanced neutral studio lighting to reveal surface forms, soft key and gentle fill, no dramatic shadows baked on surfaces, no glow, no vignette. Plain light grey background, minimal contact shadow only. Exactly one isolated crate, centered and large, no platform, no scene, no extra props, no labels, no watermark, no exploded view, no collage. Crisp high-resolution game asset presentation.

## Tripo

Web application / existing plan credits only. SMART MESH, triangle topology,
8,000 triangle generation budget for the wooden foundation. Verify the actual
export and six sides before accepting. No HD Model, Ultra Mesh, or distance LOD.

Web asset `81412a71-2be6-437f-a849-c959b49ad467`: Smart Mesh P2.0,
8,000 requested / 8,052 exported triangles. Geometry 100 credits, texture
30 credits, GLB 2K export 0 additional credits observed. Total 130 credits;
balance before 23,230, after 23,100. Export ID
`720d0bea-d295-4752-8072-f6b2e04e513b`. The source GLB is retained in the
ignored authoring folder; production geometry is normalized and fractured
locally without decimation.

## Painted effects atlas

Built-in ImageGen; final saved runtime path:
`public/props/crate-family/crate-vfx-atlas.png`.

Initial prompt:

A production-ready hand-painted VFX sprite atlas for a colourful AAA stylized platform game in the Crash Bandicoot 4 aesthetic. Exact square 2 by 2 grid, four equally sized cells, no visible grid lines, completely transparent background. Each sprite is centered in its own quadrant, fully contained inside it with at least 12% empty transparent margin. Absolutely no text, labels, numbers or borders. TOP LEFT: a single soft warm ivory-and-ochre dust puff, clustered irregular rounded lobes, richer ochre shading at bottom, pale ivory lit top, tapering translucent wisps, broad painterly shading and a crisp but soft irregular silhouette, no hard outline. TOP RIGHT: a single cool charcoal-purple smoke puff with billowing clustered lobes, cool pale grey highlights on top left and deeper purple undersides, transparent feathered outer wisps, no sparks or fire. BOTTOM LEFT: a single compact orange fireburst with a pale butter-yellow core, rounded flame lobes and a few sharp short curled licking tongues at the edge, saturated burnt orange edge shading, explosive energy, no star icon, no smoke, no glow outside its quadrant. BOTTOM RIGHT: a single tapered curved ivory impact slash, a broad painterly crescent sweeping from bottom-left toward top-right, a bright pale centre and warm golden edge, a few tiny short parallel brush trails attached, no star, no smoke. All four sprites face the camera. Vivid hand-painted game VFX, sculptural light and shade within each puff, designed to be animated as overlapping particles, excellent readability at small size, no photorealism, no photographic noise, no pixel art, no drop shadows on the background. Preserve exact quadrant placement and generous transparent padding so each quadrant can be sampled independently.

Final padding correction prompt (same built-in tool):

Edit this VFX atlas without changing the four sprites' designs or painterly style. Keep exactly a square 2 x 2 atlas on fully transparent background. Make EACH of the four sprites appreciably smaller inside its own quadrant: each complete sprite including every faint wisp must fit within the central 72% of its quadrant, leaving a fully transparent border of at least 14% on every side of each cell. No sprite may touch the image edge or another cell. Keep their existing ordering: ivory dust top-left, purple smoke top-right, orange fire bottom-left, ivory crescent bottom-right. Restore any clipped puff edges smoothly. Preserve true transparent background, no checkerboard, no white rectangle, no grid lines, no labels. The usable sprites should be rounded, fully isolated shapes with zero clipping and empty transparent gutters.

## Review evidence

Actual mesh, all-angle, motion and gameplay evidence is recorded in
`VALIDATION.md`. Generated reference images are direction only; they are not
proof of the runtime result. Publication remains the release coordinator's responsibility.

## Explosive component generation

Corrected paired reference: `explosive-bundles-reference.png`. Single-stick
modeling reference: `explosive-stick-reference.png`; exact built-in ImageGen
prompts are saved beside them. Tripo web SMART MESH P2.0, triangle topology,
2,000-triangle budget inspected before submission. Asset
`05bcf415-6f74-4f76-9157-65b41c824440`, export
`c490ba14-a3c6-46d5-bf1a-1a0f9f4e9016`, actual GLB 1,970 triangles,
537,724 bytes. Geometry 100 credits + texture 30 credits. Session total
260 credits; balance now 22,970. Nine varied sticks are assembled manually,
with authored wrap geometry and a separate flexible TNT fuse. No lettering.
Nitro has no fuse. The whole assembled prop stays below 30,000 triangles.

## Checkpoint correction from the user

Checkpoint crates do not explode and must not leave a 3D symbol. The earlier
medallion proposal is rejected and removed. Preserve the original short
scale-pop and existing banking/respawn behavior. No checkpoint debris, VFX
blast, pedestal, floating medallion, or persistent world marker. The intact
checkpoint uses the shared wood sculpt and painted C marking.

## Metal correction from the user

The user requires an independent Tripo metal asset and ImageGen reference.
The first metal concept was rejected as ugly and insufficiently like Crash 4;
it was never submitted to Tripo. `metal-crash4-reference.png` is the revised
built-in ImageGen reference, based directly on Felipe Sanin's actual
[Crash 4 metal crate reference](https://cdna.artstation.com/p/assets/images/images/032/045/122/large/felipe-sanin-crash4-metalcrate-01.jpg).
The exact prompt is `metal-crash4-reference-prompt.txt`.

The clean construction uses smooth recessed steel panels, gently pinched
perimeter rails, thin triangular gussets, modest rivets and broad highlights.
No wood repaint, oversized corner blocks, rust, noisy scratches or grain.
Tripo Smart Mesh P2.0 / triangle topology / 8,000 budget inspected before
submission; asset `875ab542-7148-4791-8eee-ef989a7e90dd`, 7,197 reported faces.
Geometry 100 credits + texture 30 credits + PBR 5 credits. Export
`1acbae5e-015b-4998-835b-73679555f213`: 7,197 triangles with separate base-color,
normal and metalness/roughness maps. The six-face review caught missing bottom
fasteners. `tools/finish-metal-crate.py` copies eight disconnected top fasteners
with their original UVs/material, rotates them and seats them on the actual
underside. All original triangles remain. The completed runtime asset has
7,661 triangles and is 1,939,624 bytes. Runtime material calibration reduces
excess violet saturation and bounds roughness for broad stylized highlights.
Rebuild total: 395 plan credits; remaining balance 22,835.

## Final geometry and fracture construction

| Asset | Intact triangles | Fracture triangles | Pieces |
| --- | ---: | ---: | ---: |
| Shared timber sculpt | 8,052 | 24,864 | 14 |
| Braced wood / empty | 12,804 | 29,616 | 22 |
| Independent steel | 7,661 | 19,812 | 14 |
| Nine-stick Nitro with wraps | 23,242 | source-derived | 28 |
| Nine-stick TNT, wraps and fuse | 25,244 | source-derived | 28 |

`tools/build-crate-fracture.py` clips the approved exterior against fourteen
Voronoi cells in Blender. Original surface triangles are split at boundaries,
with source UVs and interpolated corner normals retained. Open surface islands
receive inward shells and joined cut walls, preserving a closed authoring mesh
without exporting cutter geometry. Only newly generated interior wood faces
are simplified; no source silhouette or painted exterior is decimated. Thin
steel fragments use a separate 0.018-unit interior shell. Wood uses 0.045 units.
Eight 594-triangle braces are extracted from the same wood source, rather than
replacing its painterly grain with a procedural imitation.

The runtime batches each complete break into rigid-bone geometry, preserving
material paint on each fragment. Fresh wood and steel have distinct cut-face
materials. Actual convex surface hulls drive contact against world solids and
ground; they do not replace visible geometry. Fracture geometry and contact
hulls are prepared during asset loading. Six concurrent assemblies bound
resource use; full meshes remain at every viewing distance and in reflections.

Paper fragments shrink and disappear through the fire; torn wraps flutter
briefly before consumption. TNT's separate thick braided fuse burns toward
the bundle and rebounds after impact. Nitro has no fuse geometry or lettering;
only its green paper surfaces emit light. Checkpoint keeps the original 0.12s
scale-pop, banking and reset semantics, with no persistent symbol or debris.
