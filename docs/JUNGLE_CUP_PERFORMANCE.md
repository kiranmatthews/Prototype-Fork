# Jungle Cup frame-work audit — 20 September 2026

The phone report was approximately 4 FPS after the first two levels improved.
This audit used the real competition flow, 540p touch presentation and CRT-off
desktop instrumentation to isolate rendering, UI and simulation costs. Desktop
FPS is not a prediction of physical iPhone performance.

## Waste removed

1. **The small run timer forced full-screen UI work.** Competition painted a
   full-screen canvas, copied it into the touch-control canvas, then uploaded
   that full canvas every frame. A visible competition host also bypassed the
   existing touch cache. Competition now owns a separate pre-CRT texture. During
   play it contains only the clock plus its shadow, at unchanged pixel density;
   touch controls can reuse their existing texture. Hidden duplicate SVG letters
   receive the same composition flag as the other game UI.
2. **Every short coping segment submitted a separate draw.** Rails now batch
   their visual pieces by material and 16 m cell within each independently
   movable rail. Source vertices, normals, UVs, materials and grind polylines
   remain unchanged. Editor builds retain separate visual pieces. This also
   preserves moving, hidden and trick-gated rail groups.
3. **Frozen competition screens kept redrawing the park and its shadows.**
   Intro, judges, standings and final screens now reuse a full-resolution HDR
   scene snapshot. Their world simulation was already frozen. UI, post effects
   and CRT still update normally. Countdown and skating render live. The snapshot
   is invalidated for a new level/phase/heat or size and released for gameplay,
   other menus, graphics recovery and renderer disposal. Developer/editor views
   keep live rendering. At 960×540 the temporary color-only target is 3.96 MiB.

## Same-view measurements

Actual GL draw calls include shadows, post effects and UI. These are steady-state
samples; startup shader work is excluded.

| At 960×540, CRT off | Before | After |
| --- | ---: | ---: |
| Intro draw calls per frame | 870 | 9 |
| Intro world renders per frame | 1 | 0 after capture |
| Skating draw calls per frame | 605 | 408 |
| Skating world submission CPU | 2.54 ms | approximately 2.0–2.1 ms |
| Skating canvas/texture upload pixels per frame | approximately 550,594 | approximately 34,000–42,000 |
| Competition timer texture | 960×540 combined layer | 179–181×63 separate layer |

The park retains all 855 scenery placements, 709,918 scenery triangles and the
same textures. No quality preset, resolution, frame cap, movement tuning,
competition duration or scoring rules changed. Fine rail batching can submit a
few more offscreen triangles at cell boundaries while removing many draw calls;
the source geometry is identical. GPU timer readings varied too much between
samples to support a reliable GPU-millisecond claim.

## Checks

- Rail geometry/material/position parity, parent movement, hidden rails and
  unchanged grind paths; a 101-piece sample becomes 14 draws.
- Snapshot HDR format, phase/resize invalidation, live rendering and disposal.
- Competition selection/focus/UI semantics, 16 real grind catches, 553 grind
  frames, 14 exits, 42 editor motion checks, Treehouse traversal, render pipeline
  and graphics-memory regressions pass.
- Browser checks complete all three heats through judging and final standings
  in landscape with CRT off and 393×852 portrait with CRT on. Timer pixels match
  the full-canvas reference exactly in all six heats. A sampled HDR snapshot
  region also matches the original scene exactly. No console errors.
- Four existing Cup tests still fail identically on untouched `1ab9dab`:
  `test-jungle-cup.mjs:83` (old unlock route),
  `test-jungle-cup-runtime.mjs:70` (old map point count),
  `test-jungle-cup-skating.mjs:46` (charged-speed expectation), and
  `test-jungle-cup-overtime.mjs:112` (old vert-entry fixture). These were not
  treated as passing or used to justify changing movement/scoring.
- Isolated production type-check/build passes; unrelated local character work
  is excluded. No full suite was run.

Local reproduction: `cup-performance-review.html?touch&playtest&level=jungle-cup`.
Add `&crt` for the CRT presentation check. Diagnostic comparison modes temporarily
hide shadows, point lights, temples or interface, then restore them; none of
those quality reductions are in the shipped runtime.
