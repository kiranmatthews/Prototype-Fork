# Custard Creek · uneven sunset ledges

Custard keeps its independently authored 2,430 m folded river and eight
gameplay chapters. The course climbs through the lockyard, split millrace and
high mill, descends around the return spillway, crosses the sluices and ferry
basin, and finishes through the quarry and backwater crown.

## Sky and scenery visibility · 8 October 2026

Custard explicitly selects the existing **painted sunset sky**, independently
of its painterly terrain shading. The camera-centred dome stays inside its
230 m far plane. An angular haze blend joins the painting to the world's fog,
avoiding hard silhouettes against the distant mountains. The painting renders
before the opaque world, so its dome cannot cover distant editor geometry. The new backdrop
choice survives editing, capture and import and keeps its procedural fallback.
Lite still intentionally omits the dome. Camera, movement tuning and playable
geometry are unchanged; no new Meshy assets or credits were needed.

Single-LOD Stonecliff rocks were receiving a fragment fade and visibility
cutoff despite having no distant model. They now retain their only visible
representation. Fine grass was scaled to zero between 20 and 48 m; that shader
is removed. Plants retain their authored size and wind, with genuine paired-LOD
changes moved into the distant atmospheric band.

Streaming uses the authored fog horizon instead of the inherited jungle fog.
Here, visibility ends at 190 m, paired detail blends from 152 to 180.5 m, and
residency begins at 318 m: **128 m before visibility**. The existing retirement
margin and shared-template ownership keep residency bounded.

Independent GPU coverage checks at equal projected scale retain grass at
20/35/48/65/100 m and single-mesh rock at 20/110/220 m. Desktop and portrait
production runs each traverse 940 m using 2,366 native input frames without
corrections, bails or deaths. Model downloads are delayed by 650 ms. Across
484 fresh cell activations, readiness leads visibility by at least **123.20 m**,
with **zero missing visible cells** and clean consoles. The checkpoint,
river-death, grounded-respawn and finish smoke also passes.

| Moving profile | Median / p95 | Peak complete-frame calls / triangles |
| --- | --- | --- |
| Desktop full, 1280 × 720 | 16.7 / 18.2 ms | 573 / 1,729,467 |
| Portrait, 720 × 1558 render | 16.7 / 16.8 ms | 346 / 1,327,419 |

Chrome 154 on Apple M1 Pro; the portrait viewport is 390 × 844, not a physical-phone
benchmark. Streamed textures peak at 41.33 MiB and resident cells at 1,028. Frame
samples are taken after rendering. Earlier static ledge-release numbers below
are historical comparisons.

Required level checks and production build pass, alongside 454 atmosphere
runtime/security/history cases, actual asset ownership and exact cache
migration through v5/current. The measured Chrome rounding variant is pinned
by its full fingerprint; edited copies are still preserved exactly. Only
Custard's backdrop field changes in the shared pack.

Evidence: `performance/custard-horizon-{full,portrait,smoke}.json`,
`custard-scenery-moving.jpg` and `custard-sunset-horizon.jpg`. The horizon image
is an in-level inspection from the player's camera position; the moving image
uses the normal gameplay camera and HUD.

```sh
CUSTARD_TRAVERSAL_OUTPUT=/private/tmp/custard-horizon-traversal node tools/test-custard-traversal.mjs continuous-chapter
node tools/custard-horizon-browser.mjs http://127.0.0.1:5253
node tools/custard-horizon-browser.mjs http://127.0.0.1:5253 --portrait
```

## Sculpted banks and measured contact

`src/levels/custard-ledge-profile.ts` applies Carlisle's broad eroded bays,
smaller chips, asymmetric widths and rounded exposed ends to Custard's curved
route. The outlines vary around a practical core, with generous pockets for
patrols, reward lines, checkpoints, hazard bypasses and ferry/lift transfers.
Joined chunks retain a continuous border. The outer collar rolls downward;
the level does not hide the new shape with rectangular support floors.

`custard-terrain.ts` builds closed stone volumes with three recessed strata,
tapered roots, metre-scaled UVs and subdivided free faces. Interior caps no
longer contaminate top normals with arbitrary transverse dark bands. Low
scenic shoulders have varying widths and offsets. Invisible side curtains
follow the actual collar and stop below its walking surface.

Fourteen exposed Carlisle ledge-root models now have collision baked from
their actual upward LOD0 triangles. `tools/custard-ledges/bake-contact.py`
retains the source hash and attribution. The 913-vertex / 874-triangle cap is
transformed to each instance, with 2 cm sole clearance. Independent rays
against the shipped GLB measure 1.99847–2.00074 cm clearance. The challenge
gaps remain open; only a few visible rail-bank caps extend less than 0.9 m
into their original endpoints.

The native-Player side audit exposed overlapping broadphase wall slices at a
concave bend. `Player.pushOutOfWallPath` now leaves a farther adjacent slice
to the nearer contact at the same height. This narrowly scoped collision
selection fix preserves movement tuning, jumping, rail controls and camera
behavior. All 132 actual bank-side probes resolve outward.

## Repairs made during the pass

- Replace coincident inner/outer millrace endings with one reunion shelf.
- Integrate all three quarry courts into the descending bank, with smoothly
  approached level patrol areas and bare stone pigment instead of stacked pads.
- Remove the repeated clipped rock blobs along the old rectangular edges.
- Root 1,324 verge tufts and 360 meadow placements on actual triangles; attach
  isolated leaf crowns more closely to trees and plant the lower fern gardens.
- Add a grounded timber hoist around the optional mill lift, with four river
  piles, knee braces and overhead members outside its moving deck envelope.
- Preserve the sunset pass's planted mill houses, Beachside cliff variants,
  stone footings, curved spillway foundation and waterline-matched ferry floats.

The reused library includes Carlisle sandstone, ledges, piers and fine grass,
Beachside Stonecliff forms, and Treehouse rock, foliage, houses and timber.
Different proportions, rotations and warm tints suit the winding river.
No new Meshy generation or credits were required.

Sunset uses an actual **17.41°** sun, warm key, cool fill and rose haze. The
310 m spillway retains its native ride and 3.1 m metric texture scale; its
closed backing stays below the actual curved surface. The ferry's three
timber floats follow its existing moving parent and meet the raised basin.
River resets follow visible water. None intersects the 3,294 dry-body probes.

## Geometry and earlier ledge-release verification

- 58 native and 125 scenic closed stone volumes pass welded edge closure,
  outward orientation and unit-normal checks; 684 spillway clearance samples
  and the actual ferry floats pass.
- Independent geometry checks cover 6,364 road, 930 pipe, 1,746 gap and 3,648
  camera samples, every patrol/boulder/rail, and 132 top plus 132 side contacts.
- The ledge proof measures actual native width variation, 588 independent
  GLB/contact rays, planted verges, nonoverlapping millrace surfaces and 81
  quarry-floor samples.
- All eleven production-Player pilots pass. The continuous 940 m chapter
  crosses both inner-bank gaps, the aqueduct and spillway, breaking 42 crates
  with no bail or death. The ferry, optional lift and final grind/finish pass.
- Exact published v1–v4 and current cache recognition preserves edited copies.
  The complete pack remains inside its existing import/work limits, with all
  other latest-main rows preserved.
- The collision regression also passes 360 wallride direction/facing cases,
  144 permitted entries and 2,880 native wallride frames. The unrelated
  `test-jungle-cup-skating.mjs:46` charge-speed assertion fails identically
  with the unchanged pre-task Player; no tuning change was made to mask it.
- Required `check:levels`, latest-main placement checks and the production
  type-check/build pass. The full suite was not requested or run.

Current source: **3,574 components**, **63,586 mesh vertices / 91,470 triangles**,
**6,217,105 UTF-8 bytes**. The exact cap contacts account for 12,236 triangles
and are invisible to the renderer. Author-time planting uses a spatial grid;
there is no additional per-frame planting work.

Final browser measurements, input outcomes and actual review images are
recorded in `docs/performance/custard-ledges-*.json` and
`docs/custard-ledges-review.jpg`. Portrait is a viewport test on the recorded
desktop GPU, not a physical-phone benchmark.


| Profile | Actual framebuffer | Scene median | Worst scene p95 | Peak calls / triangles |
| --- | --- | --- | --- | --- |
| Desktop full | 1280 × 720 | 16.7–16.8 ms | 18.4 ms | 423 / 944,673 |
| Portrait viewport | 720 × 1558 | 16.7 ms | 17.6 ms | 297 / 746,031 |
| Lite | 1280 × 720 | 16.6–16.7 ms | 18.0 ms | 182 / 444,120 |

Chrome 154 on Apple M1 Pro; 30 warmup and 60 measured frames per view.
All 69 camera fixtures are supported, stream without errors and retain stable
idle geometry, texture, program and scenery-cell counts. Texture estimates
peak at 41.33 MiB full / 29.67 MiB lite; resident cells at 432 / 147.
The 390 × 844 portrait viewport uses the same desktop GPU.

The keyboard smoke earns a checkpoint, naturally falls into water at
Y = 2.683 m (visible water Y = 2.956 m), loses one life, respawns grounded at
the earned checkpoint and reaches the finish. The complete latest-main pack
is **16,081,082 bytes**, below the existing 16 MiB limit.

Reproduction:

```sh
python3 tools/custard-ledges/bake-contact.py
node tools/sync-custard-creek.mjs --write
node tools/test-custard-creek.mjs
node tools/custard-audit-geometry.mjs
node tools/test-custard-ledges.mjs
node tools/test-custard-sunset.mjs
node tools/test-custard-creek-cache.mjs
node tools/test-custard-traversal.mjs
npm run check:levels
npm run build
node tools/custard-sunset-browser.mjs http://127.0.0.1:5249 --lite --smoke
node tools/custard-sunset-browser.mjs http://127.0.0.1:5249
node tools/custard-sunset-browser.mjs http://127.0.0.1:5249 --portrait
```

The prior release's `custard-sunset-*` evidence is retained as historical data;
the `custard-ledges-*` reports describe the current version.
