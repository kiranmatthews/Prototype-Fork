# Custard Creek · sunset river valley

The visual rebuild keeps the independently authored 2,430 m folded river and
its eight gameplay chapters. The course climbs through the lockyard, split
millrace and high mill, descends around the return spillway, crosses the sluices
and ferry basin, and finishes through the quarry and backwater crown.

`src/levels/custard-terrain.ts` replaces the former flat-sided ribbons with
closed curved stone volumes. Native caps retain the supported route heights;
irregular rims, broad recessed courses and tapered roots form the exposed
silhouette. Landing faces have real cross-section subdivisions and relief,
with separate metre-scaled UVs. Collinear rim subdivisions are retained in
the end caps, so UV seams weld into closed, consistently wound geometry.
Coarser closed shoulders provide the distant valley mass at lower cost.

`src/levels/custard-creek-art.ts` reuses the Carlisle sandstone masses, deep
ledge roots, carved piers and fine grass, Beachside Stonecliff forms, and
Treehouse cave rock, earth banks, trees, ferns, crowns and porch houses.
Different compositions, proportions, rotations and warm tints suit the
winding river. Meadow roots are placed on the actual triangulated shoulders.
Imported scenery stays outside collision queries and the established gaps.
No new Meshy generation or credits were required.

Sunset is actual lighting as well as sky colour. The level authors a bounded
world-space sun direction at **17.41° elevation**, with a warm key, cool fill,
soft rose haze and restrained soil bounce. The optional atmosphere direction
is validated and preserved by native capture; other levels retain their
existing sun policy. The runtime browser checks the rendered light vector.

The curved 310 m spillway uses metric arc/along UVs at 3.1 m per tile. Its ride
geometry is unchanged; closed stone backing sits below the actual outer
decks. Outside the original deck the backing falls away steeply, so it does
not advertise an unsupported flat walking shelf. The support audit checks real intersections throughout the bend.

The fifteen collapsing sections and both movers use the existing worn timber
kit. The ferry's three hewn floats and transverse ties follow its native
moving parent, and its sheltered basin meets the floats at the waterline.
The original deck collider and motion remain authoritative. Gallows use
fitted hewn members. Mill houses and carved piers have planted stone footings,
and the optional mill roof has a deep buttress foundation.

Corrections made during the pass include landing-face texture stretching,
black visual pit plates covering the water, spillway backing intruding into
the ride, floating scenery footings and the ferry's former separation from
its visible water. Collision authoring along the banks was simplified while
retaining the measured top and outward-side contacts. River reset volumes now follow the visible water, so ordinary falls do not
continue far underneath it. Every playable lane is tested against those
volumes. Encounter ordering and native movement tuning remain intact. The release
incorporates the independently published grind-input fix.

## Verification

- The current source and complete published pack pass the existing bounded
  editor/import contracts. Exact v1, v2, v3 and current snapshot recognition
  preserves authored local edits.
- The geometry proof covers 61 native stone solids and 125 scenic stone
  volumes, welded edge closure and orientation, finite unit normals, 684
  actual spillway-clearance samples, 360 planted meadow roots and the three
  actual ferry pontoons.
- The independent audit covers every road, pipe, gap, enemy patrol, boulder
  footprint, rail clearance and camera segment, plus 126 top and 126 outward
  side-contact probes.
- All eleven production-Player input pilots pass, including both split-bank
  routes, aqueduct, spillway, sluices, ferry, quarry, final rail/finish and mill
  lift. The continuous 940 m chapter clears both jumping spans, the crown
  rail and the descending spillway, breaking 42 crates without a bail/death.
- The browser harness captures 18 actual gameplay-camera locations. Static
  captures use silent hazard grace; real input/replay checks do not. The
  keyboard smoke activates a checkpoint, walks off into the river, loses a
  life, respawns grounded at the earned checkpoint and reaches the finish.
- Atmosphere runtime/security/history checks, renderer frame checks, required
  `check:levels` and the production type-check/build pass. The full suite was
  not requested or run.

Final hardware, framebuffer, draw/triangle counts and resource measurements
are recorded in `docs/performance/custard-sunset-{full,portrait,lite}.json`.
Portrait testing is a viewport test on the recorded desktop GPU, not a
physical-phone benchmark. The review and thumbnail use actual game renders.

Final source: **4,409 components**, **52,194 mesh vertices / 81,550 triangles**,
**6,077,859 UTF-8 bytes**. The complete shared pack remains below 16 MiB;
all other published level rows are unchanged. Geometry workload limits were
retained. The final invisible river volumes pass **3,354 dry-body probes**.

| Profile | Actual framebuffer | Scene median | Worst scene p95 | Peak full-frame calls / triangles |
| --- | --- | --- | --- | --- |
| Desktop full | 1280 × 720 | 16.6–16.8 ms | 18.4 ms | 424 / 973,406 |
| Portrait viewport | 720 × 1558 | 16.6–16.7 ms | 17.6 ms | 305 / 751,152 |
| Lite | 1280 × 720 | 16.6–16.7 ms | 17.6 ms | 178 / 519,886 |

Chrome 154 on Apple M1 Pro, 30 warmup and 60 measured frames per view.
The portrait viewport is 390 × 844. Compressed streamed-texture estimates peak
at 39.67 MiB full / 28 MiB lite; resident scenery peaks at 462 / 1,337 cells
in full rendering. Idle geometry, texture, program and cell counts are stable.
The full and portrait composites retain raw report hashes and the four fresh
crown/spillway samples after the last non-colliding cliff-edge adjustment.

All 54 route captures have clean consoles and supported fixtures. Production
browser input replays pass ferry, sluices, the continuous chapter and the full
finish. The exact-build keyboard smoke records the missed-bank death at
Y = 2.50 m with the local visible water at Y = 2.96 m, then a grounded earned
checkpoint respawn and successful finish. See `custard-sunset-smoke.json` and
`custard-sunset-browser-traversal.json` for those actual outcomes.

The preview is `docs/custard-sunset-review.png`; raw measurements and native
support/traversal summaries are retained under `docs/performance/`. No
movement tuning was changed by this visual rebuild.

Reproduction:

```sh
node tools/sync-custard-creek.mjs --write
node tools/test-custard-creek.mjs
node tools/custard-audit-geometry.mjs
node tools/test-custard-sunset.mjs
node tools/test-custard-creek-cache.mjs
node tools/test-custard-traversal.mjs
npm run check:levels
npm run build
node tools/custard-sunset-browser.mjs http://127.0.0.1:5247 --lite --smoke
node tools/custard-sunset-browser.mjs http://127.0.0.1:5247
node tools/custard-sunset-browser.mjs http://127.0.0.1:5247 --portrait
```

`CUSTARD_REVIEW_OUTPUT`, `CUSTARD_REVIEW_SCENES` and
`CUSTARD_REVIEW_FRAMES` select captured evidence. Native input traces use
`CUSTARD_TRAVERSAL_OUTPUT`; `tools/custard-traversal-browser.mjs` replays them
through the production game loop on either a local build or GitHub Pages.
