# Rumblewater Run

A new source-owned campaign level, `rumblewater-run`, appended after Custard Creek on Island 1. Existing course data and saved map indices remain intact. About **2,802 metres** of curved travel descend through a sandstone gorge while a 16.4-metre mossy boulder pursues the player.

## Playing

Run toward the lens with **Down**; Left/Right stay relative to the screen. Hold **Space** to skate/charge, release to jump, and hold **E** to catch a grind. Normal movement tuning is unchanged.

The course is 3.043 times the original 920.95 m route and develops over three equally long station ranges:

| Act | Character | Traversal and pressure |
| --- | --- | --- |
| Release · 0–892 | Broad sandstone banks and flowing pipes | First jump, two-way bank fork, long introductory grinds, lower snake and raised shelf. |
| Working mills · 892–1784 | Sluice yards, counterweight causeway and broken roofs | Alternating crushers, breakable/solid chicanes, collapsing bridges, offset island jumps, first rail transfer, angled roof takeoffs and shorter receiving pipes. |
| Drowned quarry · 1784–2676 | Quarry locks, shattered aqueduct and falling throat | Nitro lane choices, cross-rolling stone, narrow collapsing banks, a ground double jump or two-air three-rail relay, tighter pipe hazards, twin crushers and the final S-grind/collapse escape. |

The authored obstacle/route decisions rise from **12 → 23 → 34** per act. New mechanics enter separately before the final rooms combine them; the extension is not a duplicated opening. Twelve checkpoints provide a fresh movement-triggered head start. The crystal rewards the late three-rail relay. Jump to the sanctuary while the boulder drops into the intervening gorge. Gold/silver/bronze targets are **118/146/180 seconds**.

## Geometry and camera

`src/levels/rumblewater-run.ts` owns the shared route/grade and opening; `src/levels/rumblewater-downstream.ts` authors the two new acts with the same component helpers. The course has 16 curved pipe sections, 12 explicit grind paths, 28 broken spans, reward lines, checkpoints, and one finish. Closed creek-bank meshes and existing vert/rail primitives provide support; no invisible floor spans a jump. Ordinary surface edges keep the toolkit's grind behavior.

The small `boulderChase` level-data extension retains its ordered floor path through capture/export/import. Pursuit accelerates continuously, slows near the player without making stopping safe, resets behind the current checkpoint, and ends in a finite fall. The existing stone collision/rewards, sound loop, pooled dust, and asset lifecycle are reused.

`BoulderChaseCamera` remains ahead of the route and looks back. Camera anticipation does not steer the player. Ground-oriented aim preserves landing visibility during jumps and raised grinds; portrait framing balances the chosen bank with the pursuing boulder. The existing fatal-fall hold remains outside the rig.

## Art

Reuse the existing commissioned Custard Creek and Carlisle Coast asset catalogue, including layered gorge cliffs, eroded buttresses, willows, ferns, temple remnants, and mill. Scenery preserves model proportions, compressed textures, distance LOD, and shared resource disposal. The pursuing boulder uses a closed spherical shell with shallow weathering, fissures and moss, detailed with the existing Custard sandstone texture. Its centre sits one rolling radius above the route, and its rotation advances by travelled distance divided by that radius. No new paid generation or third-party asset import was needed. Native sandstone/moss surfaces, connected deep shoulders, a submerged riverbed, and the animated creek make the route belong to the same world. Art placements live in `src/levels/rumblewater-art.ts`. The new acts add working-mill landmarks, carved district arches, broken aqueduct piers, cooler quarry walls and sparser planting toward the finale.

`public/level-previews/rumblewater-run.jpg` and `docs/art-reviews/rumblewater-run.png` are real gameplay captures.

## Verification

- `node tools/test-rumblewater.mjs`: all four input-only route combinations (101.93–108.78 seconds), actual early and late water death/checkpoint returns, and an actual boulder catch when the runner stops. Native traces go to `/private/tmp/rumblewater-evidence`.
- `node tools/test-rumblewater-structure.mjs`: source/editor round trip, triple-length measurement, increasing decision density and mechanic variety, 51 actual support probes (including all 12 checkpoints), 28 permanent-floor gap probes, gate, kill plane, and pipe/rail inventory.
- `node tools/test-round-boulder.mjs`: both closed sphere LODs, 360-direction roundness, 600 rolling steps, preserved collision height and resource/late-load disposal.
- `node tools/test-boulder-chase.mjs`: bounded pursuit acceleration, stationary danger, checkpoint grace, finite end fall, and framing at 16:9, 4:3, portrait, and short landscape.
- `tools/rumblewater-review.html?pilot=inner-low` runs the shared input controller against the real browser player in lite mode. `?pilot=outer-high&full` runs the fully rendered grind route; `take=recovery`, `take=late-recovery` and `take=stall` exercise failure behavior. Regenerate these fixtures with `node tools/rumblewater-browser-fixtures.mjs` after native passes. This review page is development-only. It reports framing, assets, deaths, bails, checkpoints and console errors, and captures gameplay frames throughout the three acts. `?station=1460&full` supports isolated scene review without a traversal claim.
- Required `check:levels` commands, production TypeScript/Vite build, camera regression, campaign identity/unlock checks, and actual map travel in both directions. The extracted high-air camera test receives the real current camera dependencies. No full-suite run.

The local runtime has no npm executable; the build and check:levels script contents were executed directly with the bundled Node binary. Native and browser pilots share the same cooperative controller decisions and emit only stick/button inputs. The browser responds to its live player state and moving-hazard phase; fixed `?take=` recordings are retained for short diagnostics, since small timing differences can accumulate over a long course. Browser rendering supplies its live camera. No pose, velocity, hazard, balance, or movement tuning corrections are injected during takes.

## Expanded-course browser evidence

The final responsive controller reaches the finish in Chrome full rendering on the high route (**6,119 frames**) and lite rendering on the low route (**6,545 frames**), with zero deaths, bails, console errors or out-of-frame rider bounds. The full high take loses no masks; the low take absorbs one counterweight contact and continues through the intended route. All three rail transfers and the final S-grind/jump are real player movement. A separate full-render water-death take returns naturally to the quarry checkpoint at station 2016 with the boulder waiting behind it.

See `docs/art-reviews/rumblewater-expanded/validation.json` and the actual full-render aqueduct capture `docs/art-reviews/rumblewater-expanded/aqueduct.png`.
