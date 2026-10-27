# Motu Beach — expanded festival pass

The user requested substantially more after reviewing the first coastal pass.
This increment adds a stronger visual identity and three connected skating
attractions above commit `3949b5f2`.

The Reef Loop is a complete 8.4 metre vertical loop with a separated exit. A
6.3 metre timber roll-in supplies its approach, and a curved elevated boardwalk
can be climbed back to the summit. These use the existing reconstruction ribbon
helper and native loop physics. A 5.2 metre transition radius forms the open
coral wave wall near the northern session. The original bowl, halfpipe, volcano,
street features and large continuous perimeter remain.

Cream, turquoise and coral replace the dark uniform concrete. The sourced
concrete and plywood maps still supply grain, normals and roughness; checker
bands follow the true bowl surfaces and a ceramic floor fills the lagoon.
Painted approach markings and a shaded ground logo distinguish the sessions.
Eight generated graphic designs provide consistent event and zone signage,
including a large truss-mounted north marquee.

The venue contains 38 complete Meshy cliff instances, 24 rocks, 51 palms,
32 hibiscus plants, 16 vines, five circular planted skate ledges, three fitted
surf/crew kiosks, three skate benches, feather flags and striped beach parasols.
The larger headlands and offshore islets break the previous straight skyline.
All 774 spectators, the four stands and supplied sponsorship art remain. No
new downloaded/copied runtime assets, distance-dependent simplification, or
movement tuning changes were introduced.

A kiosk initially blocked a volcano rollout. It was moved to a supported seaside
shop deck outside the competition boundary, preserving the southeast carve as
well. The new wall has a dedicated traversal check; the old north-perimeter
fixture moves to the clear lane beside it and retains its exact lip/physics
expectations. The boardwalk test uses the park's actual board-relative steering,
charge and brake controls.

## Review evidence

- [Tiled lagoon, wave wall and festival skyline](lagoon-native.png)
- [Reef Loop, planted ledges and spectator stands](reef-loop-native.png)
- [Skater-height composition](player-native.png)
- [Normal presentation and elevated boardwalk](park-normal.png)
- [Seaside kiosk outside the competition lines](surf-club-native.png)
- [Authored sun bloom and flare](sun-native.png)
- [Ground logo receiving player shadows](floor-native.png)
- [New native skating routes](new-routes.json)
- [Supported floor, original rides, recovery and editor reconstruction](native-validation.json)
- [Eight full-render browser rides](full-rides.json)
- [Eight final lightweight browser rides](lite-rides.json)
- [Native asset and rendering diagnostics](native-diagnostics.json)
- [Full-render warning/error log](full-console.json)
- [Final full-render warning/error log](final-full-console.json)
- [Packaged-game keyboard skating](production-play.png)
- [Packaged-game warning/error log](production-console.json)
- [Final verification and source fingerprints](verification.json)

These images were reviewed at native 1280 × 720 and normal game presentation.
The source review page is local-only. Start the dev server and open
`/tools/motu-beach-review.html?playtest&level=jungle-cup`; add `&lite` for the fast
pass. It offers named views, an upright inspection camera and eight automated
rides through the real Player. Production play starts at
`/?playtest&level=jungle-cup`.

## Ownership and validation

New level data lives in `src/levels/motu-festival.ts`; the existing Motu data and
presentation modules opt it in. This increment makes no further changes to
`src/level.ts`, `src/main.ts` or the shared Coconut Cup crowd implementation.
`public/levels.json` remains unchanged.

Focused checks: `tools/test-motu-festival.mjs`, `tools/test-motu-beach.mjs`,
`tools/test-jungle-cup-layout.mjs` and `tools/test-jungle-cup-skating.mjs`.
The new loop completes from rest in 295 simulation frames, clears the 8.4 metre
crown and exits without a bail. The boardwalk ascent reaches all four waypoints,
and the wave wall returns an air to supported ground. The original layout check
includes four pocket airs and 28 authored rail catches. Skating regression covers
24 vert returns, 24 terminal contacts, the 3,117-frame replay and 19,200 stress
frames, including camera visibility and 30/60/120 Hz equivalence.

All twenty required level checks, TypeScript/build and the hosting gate pass.
The final package contains 1,838 files and 999,488,149 bytes, leaving 511,851 bytes
under the local hosting limit (offline version `62007f6f9c597cdc42bb`). The
coordinator must recheck the combined release budget.

The full eight-ride run preceded the final kiosk relocation and floor-shadow
change. The final native checks and eight lightweight rides pass after those
changes. A fresh full-render review confirms the exterior kiosk, sun and ground
logo; the packaged game starts Run 1, accepts keyboard skating, advances the
timer and keeps the rider supported. All captured browser error logs are empty.

The first playable visual review was at 06:49:42 UTC, 20 min 15 s after the
follow-up brief. Final verification finished at approximately 07:35 UTC;
intervening shared-capacity waits are not productive authoring time. No
`check:all` run was requested or performed. Final heavy checks used the shared
two-slot guard. The test browser and both owned preview servers are closed,
and the lease is released. The release coordinator owns publication.
