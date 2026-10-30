# Carlisle late-course rigging

Local presentation pass on the four required grind cables in the final 650m.
The previous bare chrome polylines now carry seven-strand steel rope, 39 orange
collars and eight compact roller fairleads. The existing winch props and support
posts remain. The ropes follow the native rounded polylines exactly in X/Z;
the centre lowers slightly on descending sections to keep the circular rope and
sleeve crowns below the original rail top. There is no new collision, rail,
travel assist, physics, camera behavior or change to the required catches.

Native rail dressing finishes before the cable art is installed. This ordering
is necessary: the shared rail pass otherwise restores chrome and repaints the
authored materials. The browser check verifies both hidden native batches and
retained Standard materials/orange collar color.

The complete mesh is used at every distance and in reflections. Geometry is
built once: 402.687m of cable, 28 full strands, 397,600 placed triangles, nine
geometries and four materials. Roller parts and collars share their geometry.
The eight fairleads use chamfered navy brackets, grooved orange rollers and
bearing caps/hex bolts; deterministic salt wear is shaded on their materials.
No texture download, model generation, Tripo charge or other paid service.

`src/carlisleRigging.ts` owns mesh creation and disposal. Carlisle's presentation
integration locates the existing static rail groups by their component/source
tags after ordinary rail dressing, hides only their final old batches, and
attaches the new visual group. Disposal
removes the dressing and restores the original materials. Shared `level.ts`,
`rails.ts`, `pathNodes.ts`, player, camera and course sources remain exact.

## Evidence

- `before/`: compiled baseline views of all four visual cases, plus native rail
  point arrays and lengths from commit 50171244's compiled build.
- `geometry.json`: finite geometry; all 191,464 strand vertices checked against
  native grind paths; 528 vertical contact probes; unchanged rail points;
  shared geometry/material disposal.
- `protected-source.json`: 24 exact source hashes against the preceding commit.
- `development-lite/`: initial visuals and first catch; the external steering
  loop bailed while an awaited screenshot delayed its balance correction.
- `initial-lite/`: passing compiled input route before the material correction.
  An attempted between-frame canvas capture returned a cleared WebGL buffer;
  `diagnostic-cleared-buffer.png` is not visual evidence.
- `initial-review/`: native views exposed the rail-styling overwrite and the
  overlapping chrome line. Passive screenshots also delayed external CDP
  feedback, so the same ordinary-key pilot now runs once per browser frame.
  It emits key events through Input and writes no movement/balance state.
- `input-target-review/`: material fix and route passed, but a synthetic
  Window-target key event triggered an unrelated shortcut handler expecting
  an HTMLElement. The harness now dispatches from document.body and bubbles
  through the same Input listeners. These console errors were test-originated.
- `lite/`, `review/`: final corrected compiled browser evidence. All four
  native catches, both charged exits, five launches and the gate pass with
  no deaths or console errors. Bonus/main disposal and restoration pass.
- `normal/`: a separate passing cable catch, charged exit and rebound in
  full rendering at normal 480p/CRT, with an actual player grind screenshot.
- `validation.json`: final checks, scope, timing and limits for this increment.

Run `tools/test-carlisle-rigging.mjs` and `tools/carlisle-rigging-review.mjs`
through the shared heavy-job lease. The browser test supports `--baseline`,
`--lite`, `--normal`, `CARLISLE_BASE` and `RIGGING_OUT`. It places the player only at each
existing beat entry, then uses normal arrow/Space/E input through native bounce
catches, charged rail exits, rebound catches and the finish gate. It does not
write rider velocity, balance, rail state or machine time.

Initial checks caught a 0.0967m sleeve crown on the descending return cable
(native visual crown is 0.09m); slope-aware fitting corrected it. The first
build also caught Array.at against the repository's older TypeScript target;
ordinary indexed access fixed that without changing compiler settings. A
floating-point length comparison and lite-resolution assertion were corrected
in the review harness. No gameplay rules were changed to make a test pass.

The fixed geometry and simulation are unchanged across the material-timing
correction. Shared gameplay sources remain exact; screenshot feedback fixes
exist only in the review tool.

The broader polish goal remains active. This is a local checkpoint and must
not be integrated or published while the user's testing hold is in force.
