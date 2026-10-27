# Motu Beach Invitational polish

The source-owned `jungle-cup` course now has a 180 × 248 m foundation (2.16 times
the former 120 × 172 m area), a wider continuous perimeter, and the original
central street lines. A 42 m timber halfpipe, asymmetric kidney bowl, coral
volcano and low street terrace occupy the added space. The new transitions use
40 profile segments; the kidney uses 96 plan stations. Concrete and plywood
reuse the licensed Warehouse reconstruction maps with metre-scaled seams and
wear. Coping and ordinary exposed edges remain grindable.

Thirty existing Meshy cliffs, 22 palms, 16 rock placements and seven hibiscus
plants surround a sand shelf and the sunny ocean. Four stepped grandstands
hold 774 animated Coconut Cup spectators; three have canvas shades. Existing
sponsor atlas artwork supplies 16 stand boards, four large billboards and
pasted stickers. The venue title uses a small generated canvas. Warm coastal
light, an HDR sun disc and depth-occluded lens flare use the existing renderer.
No downloaded assets, mesh simplification or distance-based geometry swaps
were added.

The timed three-run competition, recovery, scoring and movement tuning remain
unchanged. This event intentionally has no checkpoint or finish gate: its
60-second heats and competition results own progression.

## Implementation ownership

- `src/levels/jungle-cup.ts` and `src/levels/motu-beach-art.ts`: level data.
- `src/motuBeachPresentation.ts`: scoped PBR surfaces, crowd and sun resources.
- `src/golf-cart/stadiumCrowd.ts`: optional seat layout; the default rally
  transforms, colours, vertex/index data and shader are unchanged.
- `src/level.ts`: construction, update, view and disposal hooks, activated by
  the source apron marker. Editor capture/rebuild retains that marker.
- `src/main.ts`: respect Motu's authored sun/sky across all three heats.
- No `public/levels.json`, asset, tuning, or movement-system edits.

## Reproduce the review

Run `npm run dev -- --host 127.0.0.1 --port 5518`, then open
`http://127.0.0.1:5518/tools/motu-beach-review.html?playtest&level=jungle-cup`.
Add `&lite` for the lightweight pass. The local-only review page provides
camera views, native and normal resolution, diagnostics and six scripted
rides through the actual browser Player. It freezes the competition clock
for inspection and is not imported or packaged by the production game.

For ordinary play, open `/?playtest&level=jungle-cup` and start the heat.

## Evidence

- [Final verification](verification.json), [packaged keyboard skating](production-play.png) and empty [production console](production-console.json).
- [Native crowd and sponsor view](crowd-native.png).
- [Six full-render browser ride results](browser-full-rides.txt): both halfpipe
  walls, both kidney bowl sides, south perimeter and beach flatbar pass.
- Final [full-render rides](full-rides.json), [lite rides](lite-rides.json),
  [loaded assets and native rendering](native-diagnostics.json),
  [native traversal and recovery](native-validation.json), and empty
  [full](full-console.json) / [lite](lite-console.json) warning/error logs.
- Final [matte concrete bowl](bowl-native.png), [normal-resolution park](beach-normal.png),
  and [sun bloom / flare](sun-native.png).
- [Coconut Cup crowd preservation](motu-crowd-regression.json): all 32,958
  original spectators retain identical transforms, colours, meshes and shader.

Focused regression tools live in `tools/test-motu-beach.mjs` and
`tools/test-motu-crowd.mjs`. Existing Motu test fixtures follow the expanded
perimeter. The layout fixture uses authored rails rather than overlapping
systemic floor edges, and gives the unattended rhythm grind balance assistance;
the baseline loses unattended balance at the same frame without it. Competition
campaign assertions now follow the existing six-island progression. The old
unrelated twelve-entry map migration assertion is covered by the dedicated
campaign/map checks instead.

The older speed measurement also ran into the former north transition. A
clear-flat fixture produces identical positions and speeds in the immutable
baseline and Motu ([comparison](speed-baseline.jsonl)); its tolerance allows
one existing integration step. The full skating check passes 24 vert returns,
24 terminal contacts, 3,117 replay frames and 19,200 stress frames, including
camera framing and continuous corner tracking. No movement code changed.

All twenty `check:levels` commands pass. The earlier layout, recovery and event
checks pass, including 26 authored rail catches and 49 lip-recovery cases.
No full `check:all` suite was run. The final production build and release size
are recorded in the release handoff. Public deployment belongs to the coordinator.
