# Treehouse Trials

The existing `treehouse-trail` identity now contains the full visual journey.
The user's nine-scene strip takes priority over older pack iterations: treehouse
clearing, steep downhill, coastal settlement, enclosed hut corridor, shallow
river, natural cave climb, cavern halfpipe, broken rope bridge, bright jungle.
Crate and enemy placement remain deferred.

## Reference fidelity

The opening's separate cabin, trunk, balcony, rickety stairs and backyard pipe
remain the benchmark. Its framing now includes the complete roof and supports.
The later scenes use their own compositions and actual generated surface
measurements, with close gameplay views throughout.

| Scene | Authored visual work |
| --- | --- |
| Downhill | Real 14m descent, full-width dirt launches, closed earthen cut faces, planted banks, exposed roots, timber lips and shallow visible beds. |
| Coast | Warm porch hut, cane plot, yellow thatch and red cloth, crab-roof shack, blue inlet and distant island layers. |
| Huts | Clear left-hand doors and rope porches, warm windows, varied mature trunks, dense low verges and a shaded centre lane. |
| River | Rounded generated stone tops with matching measured collision, shelving shores, visible submerged pebbles, green forest reflections, contact ripples and foam. |
| Cave climb | Four overlapping generated rock tread masses with fitted metre-space support, buried foundations, a true enclosing portal and daylight openings. |
| Cavern | Continuous rock walls and a higher roof with western solar openings, a 46m U-shaped pipe, 96 curved timber slats, hand-hewn beams, braces and rope deck fences. |
| Broken bridge | Two partial timber abutments, a single taut grindable rope, closed mossy far-shore mass, warm near soil and a clear river beneath. |
| Exit | Warm dirt, broad pointed leaf skirts, grouped ferns and quiet forest depth after the cave. |

`src/levels/treehouse-trail.ts` owns native traversal, support, gaps and the
ordered camera lane. `treehouse-opening.ts` owns the opening assembly;
`treehouse-trials-scenes-v2.ts` owns the detailed landscape and craft;
`treehouse-trials-art.ts` owns separate painted depth and soft shafts.
A 30m forest transition lets the river composition breathe before the cave.
Movement tuning is unchanged by this task.

## Assets and living surfaces

**33 new Meshy models consumed 495 existing credits (981 → 486).** The first
8 modules cost 120; the subsequent 25 references and models cost 375. The latter
kit contains two ancient trees, detached crowns, groundcover/fern variants,
earthy banks, three flat river stones, cave wall/roof variants, rock stair rows,
timber and scaffold parts, refined huts and separate pinned cloth. Near models
total 80,367 triangles; far models total 25,706. Four hero atlases are 2K, others
1K/512; the complete 25-family texture budget is 61.67 MiB compressed. Distant
V2 foliage uses the reduced silhouettes with hysteresis; nearby forms retain
the accepted source geometry. Actual bytes, ratios, contact grids, hashes,
credit evidence and rejected fitting attempts are recorded in each manifest.

Leaf and cloth masks keep wood, roots, anchors and corners fixed. Animation
uses shared shader clocks and the same deformation in visible/shadow passes.
Measured five-ray self-occlusion affects indirect light. The scoped painterly
look uses cool bounce, warm key light and a fixed 12-sample soft shadow kernel.
The measured shadow-edge width is about 0.39m at both map densities. The stock
floating cloud-sea backdrop is omitted for this style, and the sky remains
inside the authored 185m draw distance.

The clear-stream shader uses one surface draw, analytic ripple normals and
attached thin foam, with one shared 2.01 MiB reflection texture. No live
reflection camera or additional screen passes are used. Face-on views retain
the bed; grazing views receive the painted canopy. Transparent water receives
canopy shade without casting an opaque shadow onto its bed.

Three background mattes remain at their full dimensions using KTX2 plus WebP
fallbacks. Their combined GPU storage is about 6.02 MiB instead of 23.96 MiB.
Built-in imagegen created the isolated model references, three scenery layers,
timber/stone/loam albedo and reflection environment. Prompts and reproductions
are in `tools/treehouse-trials-assets/` and `tools/treehouse-trials-assets-v2/`;
provider credentials and signed responses remain outside published files.

## Review and delivery

The work was judged against actual rendered views, including door visibility,
foliage clearance, supported roots/roof masses, true solar openings, cliff
undersides, stone contact, board grain direction and rope readability. Closed
terrain prevents bright sky from showing through thin bank edges. The hidden
native pipe retains its collision/guide; visible boards sit within millimetres
of it. The legacy low-Y Jungle fade is explicitly disabled for this descent.

Focused checks were limited after the user's request: build, console errors
and practical jumps, stair walking, grinds, respawn and finish. Earlier
support/material checks remain useful evidence, but are not the visual signoff.
No full suite was run. Actual scene images and browser resource reports are
in `docs/treehouse-trials-scene-review.jpg` and `docs/performance/`.
Physical-phone thermal/battery performance remains unmeasured.

Campaign progress retains `treehouse-trail`; menus show “Treehouse Trials.”
Existing local edits are preserved. Use PROJECT → restore original when an
old local snapshot masks the source. The existing GitHub Pages workflow
publishes the validated task-owned changes through main.
