# Gem and crystal specular rendering

## What the historical sources establish

- At approximately 1:41 in the original **PlayStation Underground Vol. 1,
  Issue 4** making-of, Jason Rubin explicitly describes a custom specular
  renderer for Crash 2's gems and contrasts it with flat-shaded rotating
  objects. [Original interview, archived video](https://www.youtube.com/watch?v=EBgo9EkzcQ0&t=101s).
- The PS1 GPU accepts per-vertex RGB on Gouraud-shaded polygons; its GTE
  provides normal/colour matrix operations and fixed-point vector arithmetic.
  This is the cheap shading substrate, not proof of which particular specular
  equation Naughty Dog used. [GPU specification](https://psx-spx.consoledev.net/graphicsprocessingunitgpu/),
  [GTE specification](https://psx-spx.consoledev.net/geometrytransformationenginegte/).
- Gavin and Stephen White describe moving suitable work into preprocessing
  and using a lean runtime, including the extensive Crash 2 engine rewrite.
  [Their 1999 technical retrospective](https://all-things-andy-gavin.com/2011/03/28/crash-bandicoot-teaching-an-old-dog-new-bits-part-3/).

The interview does **not** disclose the highlight equation, lookup tables,
normal treatment, or blend-pass layout. The sources inspected do not establish
those implementation details separately for Crash 3. This is an independently
authored, PS1-budget-inspired approximation, **not a bit-exact reconstruction
of Naughty Dog's renderer**. No original game code, meshes or textures ship.

## Geometry-first reconstruction

The July 11 crystal recording was decoded into 375 frames at 60 Hz. The
earlier clear-gem clip and the supplied clear-gem still were reviewed separately.
The still resolved crown cuts that the small recording obscured. These are
independent low-poly reconstructions, not recovered original game meshes.

The old crystal was two five-sided pyramids: ten triangular faces subdivided
through synthetic face centres. The replacement has four staggered shoulder
sectors: four upper quadrilaterals, four long pentagons and a small quadrilateral
foot. It uses radius 0.40, shoulder-radius ratio 1.15 and preserves the original
Y extent (-1.5 to 0.72). A bounded fit of visible junctions in frame 94 favoured
four sectors over three/five (about 8.5 px RMS versus about 20 px in that frame).
This supports the chosen reconstruction; it does not prove hidden source topology.

The gem keeps an eight-sided table but replaces the simple octagonal frustum
with a brilliant-style cut: eight star triangles, eight bezel quadrilaterals,
sixteen upper-girdle triangles, eight pavilion quadrilaterals and sixteen
lower-girdle triangles. The girdle radius is 0.72, table radius 0.46, crown height
0.28 and pavilion depth 0.45. This is a wider/shallower profile with real
alternating cut planes, rather than the old deep, sparsely faceted pyramid.

`collectiblePolygons()` owns physical face boundaries. Every rendered vertex is
a real perimeter corner; no centre vertices or smoothed optical normals remain.
The GPU still receives triangles, but all triangles within one cut share a
single plane normal and affine face coordinates.

## Highlight reconstruction

`src/collectibleSpecular.ts` retains one front-facing shell per collectible.
Camera-space light incidence, highlight strength/width/position and body
lighting are evaluated per vertex using fixed directions and multiply-based
power lobes. The fragment shader evaluates a small one-dimensional strip
envelope in affine face space. It does **not** calculate per-pixel normals,
reflection vectors, texture lookups or additional render passes.

The crystal has two distinct responses observed in the recording: a narrow
lower-edge sliver and a broader strip that crosses and floods a long face.
Its short crown is subdued independently. Body lighting uses an affine
longitudinal gradient, not a three-way gradient converging at a centre vertex.
The gem uses broader reflections across its physical crown cuts plus small
girdle glints; it does not use a separate narrow stripe on every tiny facet.

The broad crystal light was phase-aligned against the recorded face sweep.
The diagnostic comparison uses matched orientations, not a claim that the
reference camera, bobbing and playback timing were recovered exactly.
Existing game/HUD spin and bob rates are unchanged.

Untinted white/cool highlights are added after body colour, so coloured rewards
can flash white. Body coverage starts at **86%**, rising to **100% for white
highlights**. Native material opacity still scales the whole icon for reveals
and fades. Coverage is clamped after interpolation; white face interiors cannot
inherit translucent alpha from darker corners. The shell remains front-side,
depth-tested and depth-writing, without a rear shell or refraction pass.
Material clones retain their crystal/gem profile and distinct shader cache key.

World halo sprites, collection bursts, pickup rules, map presentation and
run-local HUD inventory are unchanged. No reference pixels ship as textures.

## Measured cost

Isolated Chrome render of one crystal, one clear gem and one green gem,
without their world-only halos:

| | Original matcaps | First vertex version | Reconstructed cuts |
| --- | ---: | ---: | ---: |
| Draw calls | 10 | 3 | 3 |
| Triangles | 188 | 158 | 178 |
| Specular textures | Yes | No | No |
| Inner meshes | 4 | 0 | 0 |

The new crystal is 22 triangles; each gem is 78. Extra gem triangles represent
physical cut planes, not shading tessellation. There are no per-frame vertex
uploads or generated textures. This is not a PS1 cycle-cost claim, nor a claim
that alpha blending and fragment envelopes cost nothing.

## Validation and limitations

- Closed/manifold, convex shells; outward winding, planar cuts, expected polygon
  side counts, correct scale/extents and no synthetic interior vertices.
- Affine U/V fields across each physical face. A GPU test re-triangulates the
  crystal from different perimeter corners: over six poses the largest channel
  difference is 1/255, with no pixels differing by more than 2/255.
- A 123-frame matched-orientation phase sequence, reference frame measurements
  across all 375 decoded frames, multi-angle renders and source/before/after
  comparisons. CRT noise, halo and unknown source camera remain limitations.
- RGBA readback confirms body alpha 219/255, white highlights 255/255 and whole
  fades at 0.35 producing alpha 77–89/255.
- Real pickup/HUD and map views on desktop/touch, lite/full and CRT paths; shader
  compilation, clone/fade isolation and the production build suite.

The img2threejs geometry-first review discipline guided the separate shape and
lighting passes. Its generic factory does not expose explicit polyhedron faces,
so the existing repository mesh factory was used instead. Its whole-frame
silhouette admission also rejects the crystal's busy background; those pixels
were not treated as an automatic fidelity score. The isolated gem reference
passes admission. No completed generic Forge pipeline or exact original shader
reconstruction is claimed.
