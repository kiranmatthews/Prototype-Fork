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

## Immediate entry restart follow-up — 21 September 2026

The physical-device report remained an immediate crash/restart when Cup loaded.
The earlier desktop checks did not reproduce it and did not adequately inspect
the first displayed frame. This follow-up found two additional problems in that
specific path. It does not establish the precise OS-level cause without a device
crash log.

The loading gate prepared the **player camera**, player-centred shadows and a
hidden competition panel. On reveal, Cup switched to its existing overview
camera, enabled the competition panel and allocated its frozen scene snapshot.
A map → Cup allocation trace found **98 GPU allocation/upload calls and two new
program links (four shader compiles)** after the loading screen ended, adding
about **12.89 MiB** of buffer/texture storage. This was outside the intended
covered warm-up and GPU-completion gate.

The destination now uses the actual overview camera and shadow focus during
preparation. Competition UI is laid out and painted while the curtain is opaque,
with input explicitly blocked. Its frozen world snapshot is prepared there too.
Direct Cup playtest starts/reloads go through the same covered preparation,
instead of freezing an incomplete park while assets are still arriving. Camera
coordinates, authored level data, physics, competition timing and graphical
settings are unchanged. Existing spatial prefetch now starts at the correct
camera, avoiding cells loaded only for the wrong initial view.

The native competition root also used a fullscreen `filter:opacity(0)` to hide
its duplicate presentation. It contained **270 SVG atlas images** despite the
visible letters already being drawn in Canvas. The competition root now uses
ordinary opacity, preserving layout and input without asking the browser for a
filter surface. Composited Roo labels retain their exact SVG layout boxes and
semantics but omit the invisible atlas-image children; those children are
restored automatically when native DOM ink is needed. Prompt opacity handling
preserves the Canvas version. The observed Chrome compositor content-layer count
fell from nine to seven. This is hidden-UI cleanup, not a CRT/filter-quality test.

After these changes, the first displayed intro performs **zero new GPU
allocations/uploads, shader compiles or program links** in the same trace. The
hidden atlas-image count is zero. Canvas pixel comparison with the native glyph
tree present versus omitted is exact (zero differing channels), and the label
and hit-target rectangles are unchanged. This removes a load-time burst and
hidden browser work; it does **not** materially reduce the park's steady WebGL
resource budget. No total device-RAM reduction is claimed from DOM counts.

`stability-report.html` now shows the last three local sessions without loading
the game. Each retains at most 48 stage records: build, viewport/render sizes,
level/competition phase, renderer resource counts, font/decoder state, specific
warm-up boundaries, JavaScript errors and graphics-context loss/restoration.
The record survives a process restart, has a bounded input size, and tolerates
corrupt/unavailable/full storage. It is never sent anywhere automatically and
never writes game saves. A session ending without `page-exit` is evidence of an
abrupt stop, not proof of an OS memory kill.

Validation: Chrome and WebKit touch profiles pass cold Cup loading, the real
level-menu transition, repeated map → Cup entry, Start Run input, all three heats
through final standings, zero exposed-frame allocations/compiles, and report
recovery with clean consoles. The isolated production build also passes WebKit.
Focused loading, frozen-scene ownership, competition controls, prompt handling,
level-switch transactions, results assertions and journal lifetime checks pass.
No full suite or graphics-setting ablation was run. The physical iPhone/iPad
restart rate remains unverified. Reproduce with
`tools/test-cup-entry-browser.mjs <preview-url>`; set `CUP_BROWSER=webkit` for the
WebKit path. The existing menu-focus script's whole-file identity assertion
against the old PNG renderer is not a valid test of the new lazy markup; the
pixel/layout parity check exercises the behavior directly.
