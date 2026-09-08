# Solid clay island-map kit

The map no longer renders the perforated imported canopy trees, the original
three rock GLBs, the painted cliff pattern, or any waterfall strips/pools.
The ocean shader/tuning and crater lake are unchanged. Other levels' scenery
has not been replaced.

## Rock modules

Two new individual Meshy T2 cliff pieces were generated from original clay-style
reference images using the built-in image-generation workflow. Their raw meshes
were **not** considered shippable: the buttress had 69 boundary edges and the
terrace had 181. Offline voxel union, bounded morphological closing, removal of
tiny disconnected repair fragments, and a colour bake produce closed solids.

| Module | Near triangles | Far triangles | Topology at both levels |
| --- | ---: | ---: | --- |
| Clay buttress | 6,500 | 1,950 | One component, no boundary edges, genus zero |
| Clay terrace | 6,494 | 1,948 | One component, no boundary edges, genus zero |

Both assets together transfer about 400 KiB. Their broad clay colours are baked
to vertices; there are no runtime image textures or alpha masks. The actual
exported GLB buffers are independently checked for duplicate/degenerate faces,
edge counts, opposite winding, connectivity, Euler characteristic and positive
volume. Materials use opaque front-face rendering, not double-sided camouflage.
The modules are seated into the island surface and kept clear of foliage.

## Foliage

`src/mapClayGeometry.ts` creates the map's trees, palms, banana plants and
understory directly in code. Each plant has **3–9 large, thick, closed leaves**,
plus closed trunks/branches and roots. Palm crowns have three solid coconuts.
The lower-detail versions preserve all leaf silhouettes and thickness instead
of decimating them into cutouts. Leaf flex weights keep trunks and attachments
stable; the established renderer applies gentle movement to the leaf bodies.

All components pass the same closed-edge/winding/volume tests at both detail
levels. Existing instancing, spatial culling, loading and disposal are reused.
The native arch remains an optional closed scenery asset; the old damaged sea
arches in the default map were replaced by the new rock outcrops.

## Landscape

The mainland shape uses large rounded polygonal cliff planes and deliberate
terraces, rather than smooth Gaussian mounds with a rock image pasted on.
Terrain around navigation is graded, including its centre triangle fan; an
uncut centre vertex must never form a spike through a route. Map size, stable
progress keys, Left/Right traversal and vertical branches are preserved.

Waterfalls and their pool pieces have been removed as requested. No substitute
waterfalls, source streams or new pools have been added.

## Authoring and costs

This revision used **30 Meshy credits**, bringing this map brief to **90/300**
including the earlier 60 credits of rejected work. No new tree generation was
charged. Raw provider responses and retired binaries remain local/ignored;
historical shipped files are recoverable through Git.

- `tools/map-kit/clay-brief.json`: complete built-in image-generation prompts.
- `tools/map-kit/references/clay-buttress.png` and `clay-terrace.png`: references.
- `tools/map-kit/tasks.json`: task IDs and cumulative credit accounting.
- `tools/map-kit/repair_clay.py`: closed-solid repair and colour bake.
- `tools/map-kit/clay-geometry-audit.json`: before/after topology measurements.
- `tools/map-kit/pack.py`: validates the repaired outputs and records their hashes.
- `tools/map-kit/clay-review.html`: close-up browser review of individual pieces.
- `tools/mesh-topology.mjs`: independent audit of render buffers.

Rebuild the models with Blender in background mode running `repair_clay.py`,
then run `pack.py`. The existing official Meshy CLI adapter submits/fetches only
the recorded tasks. Regeneration is never implicit.
