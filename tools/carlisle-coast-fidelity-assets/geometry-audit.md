# Carlisle Coast geometry audit

This records the higher-fidelity rebuild's geometry proof. Numerical validity
alone does not establish a match to Tiki Pits. Visual acceptance requires the
final 24 real gameplay-camera shots, particularly the first-pit front, landing,
ramp, E crossing and analytical channel.

## Authority and shape

`src/levels/carlisle-rock-terrain.ts` replaces 54 static native supports with
visible closed meshes. Each mesh is its own collision authority; no old box
remains invisibly beneath it. The narrower outline and free ends are deliberate
changes. Actor support, central heights, all nine ramp slopes, practical joins
and jump endpoints are protected independently of the retired rectangle borders.

Join metadata uses `near` for the positive authored-axis end (+Z on N legs,
+X on E legs) and `far` for the negative end. Source adjacency determines which
ends connect. Free ends retain their practical central jump strip and narrower
width, with three or four recessed lobes beneath the crest and a lower
cross-section taper to 40% of the cap. The offset N approach to pad 48 and
both axes of pads 48/56 have explicit anchors.

Three broad courses and two inset fissures form the body. Redundant deep rings
were removed to retain the existing work budget; the upper contour, protected
anchors and actual top triangles remain. The terrain authoring audit sampled
**9,102 practical lane/turn intersections** with no missing support or height
failure, including the offset approach. Actual actors, checkpoint respawns,
patrols and gaps are separately tested through `Level` in
`tools/test-carlisle-fidelity.mjs`. Its oracle is the immutable encounter data,
not the old full rectangle shape.

The former cap X/Z UVs were interpolated into perimeter/Y wall UVs, stretching
many tiles across visible fronts. Coincident outer-crest vertices now carry
separate coordinate frames and matching smooth normals. Closed-volume checks
weld positions before counting edges: intentional UV seams duplicate indices
without opening the surface. Every welded boundary edge has two incident faces;
positions, normals, colours and UVs are finite. This accompanies, rather than
replaces, the pit-front silhouette review.

## Complete channel foundation

Native 95 is explicitly redesigned to R = 4.5 m, flat half-width F = 3 m and
length L = 120 m. It retains the mature analytical halfpipe system, including
its actual normals and coping contacts. Its radius is not claimed to match
the old R = 7 m geometry.

`src/levels/carlisle-channel-rock.ts` adds one closed mass beneath the whole U
and flat middle: **1,496 triangles and 954 vertices**, `solid: false`, no shadow
casting and no entry into ground/contact queries. Local bounds are X = ±7.8 m,
Y = −11.16…4.455 m and Z = ±60 m. Three broad non-planar courses, lobed ends and
a tapered base connect the channel to deep geology. Top UVs use along-distance/signed cross-section arc length at 3.1 m per tile;
end UVs use X/Y, and outer side UVs along/Y, with matched normals at their seams.
The analytical floor alone retains a depth offset to resolve coincident grass.
The banks remain unbiased: positive slope bias had exposed the foundation near
the lip, where the earlier X/Z top projection stretched up to 326×. Actual
casting/reception A/B ruled out shadows; removing only bank bias cleared the
rendered artifact. The fallback arc UVs also protect exposed grazing views.

The riding curve is:

```text
y(x) = 0                                      for |x| ≤ 3
y(x) = 4.5 − sqrt(4.5² − (|x| − 3)²)         for 3 < |x| ≤ 7.5
```

Foundation top vertices lie 4.5 cm below it. Sixteen adaptive angular segments
per bank concentrate samples near the vertical tangent. Circular normal
sagitta cannot alone bound vertical clearance there. Positive-Y outer walls
descend vertically; inward taper begins below the flat floor, preventing an
interpolated body face from cutting into the riding curve.

Independent authoring proof used **10,005 real mesh-ray intersections** across
five longitudinal positions and **8,976 triangle-interior samples**. Minimum
clearance was **0.024572 m (2.457 cm)**; no sample protruded above the analytical
ride. Position-welded closure, finite attributes and matched seam normals also
passed. The runtime fidelity test separately samples the loaded foundation's
triangle interiors and rendered intersections against `Halfpipe.surfaceY`.
`tools/carlisle-bank-browser.mjs` exercises real keyboard commitment, analytical
bank riding, coping catch and drop-in, without capture-only hazard grace.

## Bounded editor interchange

| Limit | Retained/current allowance |
| --- | ---: |
| Single level JSON | 8 MiB |
| Published pack JSON | 16 MiB |
| Decoded JSON nodes | 1,800,000 |
| Conservative clone-allocation estimate | 64 MiB |
| Nesting depth | 12 |
| Component count | 10,000 |
| Mesh vertices / triangles per component | 4,096 / 4,096 |
| Aggregate mesh vertices / triangles | 100,000 / 100,000 |
| Generated geometry samples | 500,000 |

The larger interchange allowance carries the existing mesh-work limit's
positions, normals, colours, UVs and indices; it does not enlarge generated
geometry work. Array limits, field whitelists, forbidden prototype keys, plain
object checks, finite numbers and path budgets remain enforced.

`tools/test-carlisle-interchange.mjs` uses the actual detailed source as its
positive fixture. Independent rejection cases cover excessive bytes/nesting,
getters without invocation, cycles, opaque prototypes, unsafe/unknown fields,
invalid shadow flags and separate aggregate/per-component vertex and triangle
overflows. They exercise the public parser and normalizer instead of relying
on an internal registry bypass.

## Review and evidence boundary

Terrain and foundation have no per-frame authoring work. Grass is opaque,
area-weighted instanced geometry with real 672/160-triangle near/far meshes.
492 deep backing placements skip shadow casting; nearby foreground casters
keep their own buckets and share materials/textures. Streaming tests check
loading, retirement, idle ownership and shadow opt-outs. They do not measure
rendered GPU frame time.

Final source: 6,609,368 UTF-8 bytes, 4,098 components, 55,400 authored mesh
vertices and 97,548 triangles. The actual loaded proof includes the 19 timber
decks and six gallows beams, their crest/pose/disposal checks and 14 triggered
crumble transitions. The final bank's curved materials are unbiased; only the
coplanar flat floor retains polygon offset factor/units 1.

All 24 locations pass desktop, portrait and lite rendering with no errors.
The four affected approach/channel/exit views were freshly checked after the
floor-only depth and fallback arc UV corrections, with explicit composite
measurement provenance. Full desktop scene medians are 16.6–16.8 ms; worst
p95 is 20.3 ms, with peak 443 calls / 1,586,314 whole-frame triangles and
31.33 MiB compressed scenery texture estimate. Portrait is a desktop GPU
viewport test. Real gap, checkpoint, death/respawn, bank/coping/drop-in and
finish input pass. See docs/CARLISLE_COAST.md and saved performance reports
for exact scope, framebuffer sizes, asset accounting and hardware limits.
