# Gameplay and loading audit — 9 October 2026

**Global restoration after the user-reported regressions:** The user approved restoring movement and collision globally to the actual pre-session baseline, `bdc5370`. `src/player.ts` now matches it byte for byte, and every level again uses authored native player support, with no Treehouse exception. Loading/render preparation improvements remain. The original Deadwater replay, 51 halfpipe cases, three recorded grind catches and 44 controller cases pass; lite/full keyboard vert checks, all 16 Treehouse cases, and all 55 catalog entries / 145 checkpoint landings pass. Earlier descriptions of the vert and grind failures as pre-existing compared against intermediate in-session collision builds and were incorrect for the start-of-session baseline. Current evidence and precise scope: `performance/global-native-restoration.json`.

The ongoing goal is lossless gameplay/loading performance and smoothness across the game, checking every level individually. The initial baseline is `bdc5370`: **55 levels**, including all bonus rooms, the map, the boss and both competitions. During the audit, shared collision updates landed through `1ae0c10`; these were integrated and all 55 levels were checked again in the combined production build. Work is isolated from the original checkout's unrelated edits.

## Validated changes

- Nightworks collision trees are reused only when local position/index buffers have identical bytes and attribute formats. Dimensions, yaw, winding or vertex changes receive a different tree. Each moving/phase rock keeps independent bounds, motion and enabled state. The level releases the cache when disposed. Nightworks uses **21 trees for 62 solids**; After Hours uses **20 for 29**.
- The rock collision broad phase reuses temporary boxes/vectors, removing seven temporary objects per eligible rock per query. Capsule sweeps, contact order, contact depth, push-out, active phases and motion are unchanged.
- Covered GPU warm-up still draws every eligible mesh in batches of at most 24. Cheap batches share a **4 ms CPU budget** instead of requiring two browser refresh intervals apiece. Expensive batches yield individually. GPU fences, scene/renderer restoration, complete destination preparation, input locking and the authored minimum loader duration remain intact.
- Remove an unnecessary `toNonIndexed()` call on an already non-indexed dodecahedron. Three returned the same geometry; the redundant conversion emitted warnings in affected levels.

The performance patch makes no movement-tuning, geometry, animation, texture-resolution, shadow-quality or render-resolution changes.

## Repeated browser measurements

Three rounds, alternating before/after order against `1ae0c10`, isolated Chrome contexts, Apple M1 Pro / ANGLE Metal, 1280×720 viewport, DPR 1, unchanged 720p/1× fixed-60 preset and full rendering. Loading includes the normal cover/vortex/preparation/reveal sequence. Construction is measured separately; it is not network time. Values are medians and should not be extrapolated to a physical phone.

| Level | Construction before → after | Menu transition before → after |
| --- | ---: | ---: |
| Treehouse Trials | 613 → 623 ms | 6,302 → 5,555 ms |
| The Nightworks | 2,474 → 907 ms | 6,440 → 4,838 ms |
| Nightworks: After Hours | 1,233 → 899 ms | 5,164 → 4,843 ms |

The construction reductions are **63%** for Nightworks and **27%** for After Hours. Treehouse's **12%** transition reduction comes from warm-up scheduling; its small construction difference is measurement variation. Most small levels already meet the authored loader minimum, so this change does not claim faster visible transitions for them. Steady-play frame timings remain at the existing 60 Hz cap.

## Verification and boundaries

- All 55 levels completed both the unchanged lite and full-render load/profile passes, with zero console errors. All **145 checkpoint** positions supported the player in each pass. The same 55-level full-render pass on the optimized source retained supported spawns/checkpoints and a clean error console.
- The initial audit used forward input everywhere; horizontal bonus/puzzle courses need Right/Left. The audit now selects the authored side-scroll direction. Production lifecycle results separately verify native movement, checkpoint respawn and finish behavior. Do not count an incorrect Up-input probe as successful traversal or as a game defect.
- The corrected full-render production lifecycle pass covers all **55 levels**: native controls, normal fall recovery, checkpoint restoration where present, ordinary finish gates, boss reset, competition run entry and the required-loop lock. The final combined build independently passes native input, spawn support, all 145 checkpoints, asset readiness and clean-console checks for every level. Boss victory, completed competition events and complete loop traversal are not claimed by these lifecycle probes.
- Exact collision regression: **634 contacts, 2,182 misses and 96 moving/phase sweeps** match independently built Three.js collision trees without an epsilon. Tests also cover modified vertices, changed winding, changed sizes/yaw and level disposal.
- Loading regressions cover every warmed mesh, fast/expensive batches, GPU completion/loss, exceptions, renderer/scene restoration, loading duration, nested asset readiness and input release. Update the existing callback-shape assertion to recognize the current completion wrapper, which still calls `guardGameplayFromMenu()`.
- The exact `check:levels` commands and production type-check/build passed. npm is absent on this host, so the package script's Node entry points were invoked directly. No full-suite run.

At the first pass, two existing Nightworks checks failed identically on unchanged `bdc5370` and the optimized tree. `test-nightworks.mjs` expects the old zero-height spawn floor, before the raised arrival pad. The After Hours pilot missed the second counterweight at fixed tick **2,096**, ending at `[90.66642352087555, -35.55261672061277, -373.16020697348523]`. The complete before/after failure report was identical. These were retained as open findings; the continuous follow-up below records the subsequent pilot and collision repairs.

## GPU preparation and particle uploads

The next rendering pass fixes two avoidable costs without changing particle output or visual settings. Phase-pad ghost materials now prepare their surface/shadow programs and wireframe indices while the loader covers the destination. The existing 24-object batches, 4 ms budget and GPU fences remain. Hidden proxy-material slots are reused; materials, camera/light layers, culling and renderer state are restored before yielding and on exceptions/context loss. Phase clocks and collision membership are untouched.

Three consumes each `BufferAttribute.updateRanges` array after uploading it. The puff renderer previously updated only the old range objects, so later frames silently uploaded the complete pool buffers. Reinsert the same range objects into the existing arrays each active frame, and avoid dirtying empty batches. No particle counts, geometry, colours, indices, presets, deformation or blend order change. Exact seeded comparisons cover all three quality presets; tests use Three's real upload implementation, skipped draws and context recreation.

The real Chrome dust workload drops from about **20.0 MB to 1.35 MB** of buffer submissions, approximately **93% less**, with zero whole-buffer updates after allocation. Phase wireframe allocations during the first 1.6 seconds fall from **3 to 0** in Nightworks and **4 to 0** in After Hours. Initial phase state and 576 sampled phase updates match the unchanged bundle. Loading remains around **5.2 / 4.8 seconds** for the two courses; this is a transfer/preparation improvement, not a claimed FPS multiplier.

The lifecycle check exposed an existing missing disposal: a pad's unselected material was not visited by the root traversal. Dispose both phase materials once and preserve both materials/textures when a successor owns them. Twelve real level returns keep the settled Sky residency at **214 geometries, 78 textures and 181 shader references**. All retired phase materials release their renderer programs. Three actual WebGL loss/restoration cycles recover with frozen simulation during loss and no GL errors. Twenty collectible disposal cycles preserve the survivor's pixels exactly and grow no GPU geometry or textures.

The final build repeats the full-render catalog checks for all 55 levels and all 145 checkpoints. After Hours's complete eight-chapter browser route also passes in 4,241 ticks. Native Chrome touch checks pass at six portrait/landscape sizes; emulated phone, tablet and 4K presentation, font selection, decoder retirement and repeated returns pass. These host/emulation checks do not claim physical-device FPS. The local touch review fixture now declares the same empty favicon as the game, removing its genuine 404 instead of filtering console errors. Evidence: `performance/gpu-preparation-followup.json`.

The next pass prepares the common alpha-dust and additive-spark buffers and programs behind the loader. The live meshes still appear in their original creation order, and temporary proxies have independent sorting bounds so empty buffers cannot change later transparency order. Exact comparisons cover 888 visible batches at each of three quality settings, including every vertex, colour, index, bound and blend setting. Rare blend styles remain lazy.

Nightworks' first 1.6 seconds previously created three particle buffers, compiled four shaders and linked two programs. All three counts are now zero in full and lite rendering. Lite's direct-screen colour/tone-mapping variants prepare under an empty scissor, preserving the loader's pixels. The existing 24-object batches, 4 ms budget, GPU fences and renderer-state restoration remain. Each default batch's three buffer payloads total 222,080 bytes; their initialization moves earlier. This is removal of first-play work, not an FPS claim or a controlled loading-time comparison.

Twelve level returns retain 215 geometries, 78 textures and 187 shader references in settled Sky, with no stranded preparation proxies. Three real WebGL recoveries preserve the simulation hold and return without errors. Loading regressions cover direct-screen success, exceptions and context loss, including target, scissor, camera and layer restoration. The existing live-range upload savings remain. The final full-render catalog pass again checks all 55 levels and 145 checkpoint landings, with native input, prepared assets and clean consoles. Evidence: `performance/particle-preparation-followup.json`.

## Remaining goal work

The collision follow-up repeats all 55 full-render catalog checks and all 145 supported checkpoints on the combined `142a40b` build plus the momentum/floor fixes. It also completes Deadwater, Crab Chief and both Slipstream 2 browser routes. The subsequent temple clearance fix completes Terraces and Skyline in lite/full rendering and repeats their ground/chasm/checkpoint checks. See `TRAVERSAL_PERFORMANCE_FOLLOWUP.md`, `performance/deadwater-contact-followup.json` and `performance/temple-clearance-followup.json` for route evidence and preserved limitations.

Blockworks now also completes all eight districts in headless, lite-browser and production full-render runs: 20,519 ticks, six checkpoints, the optional crystal and no deaths. Two shared vert fixes preserve authored launch velocity and restore held pumping on curved vert meshes. Geometric sweeps, independent walls, immediate release ownership, tuning and visual settings are preserved. See `performance/blockworks-vert-followup.json` and the continuous follow-up for the focused regressions and remaining isolated vert findings.

The Drowned Crown now completes its main route through the boarding ramp, hold, bow hatch and treasure vault. Source-owned openings remove hull/deck/cave triangles that crossed the existing passages; aligned decorative boards no longer compete with their solid ramp supports. A shared walking-support fix prevents overhead ropes and native floor undersides from pulling an on-foot rider upward, while preserving downward following and imported-scenery conventions. Native and real-browser journeys, all four checkpoints, two jumps, two crawl sections and six separate recovery/optional-room cases pass. The combined full-render catalog again passes all 55 entries and 145 checkpoint landings. See `performance/drowned-clearance-followup.json` for exact scope and evidence.

The goal remains active. Entry/checkpoint/lifecycle probes do **not** prove a complete intended traversal of every course; see the continuous follow-up for current route coverage. Phase-rock wireframe preparation, common particle programs and particle uploads are resolved in the exercised paths. The After Hours trace still finds six shader compilations for three fruit variants, plus a cropped HUD composite texture allocation in full rendering. Those owners need further preparation work without changing when objects appear, their blend order or the HUD's cropped-upload efficiency. The residency, touch/portrait and graphics-recovery checks above cover the exercised scenarios; remaining course-specific validation continues.

## Individual level coverage

Full-render combined production build (`1ae0c10` plus the performance patch). The lifecycle column refers to the separate 55-level production lifecycle pass. Gate tests place the player at the gate; they are not complete-course runs.

| Level | Entry / native input | Supported checkpoints | Lifecycle |
| --- | --- | ---: | --- |
| Treehouse Trials (treehouse-trail) | Pass | 5 | Respawn and finish gate |
| Inside Your Room (inside-your-room) | Pass | 1 | Respawn and finish gate |
| Jungle Ruins (jungle) | Pass | 4 | Respawn and finish gate |
| Temple Terraces (jungle-terraces) | Pass | 3 | Respawn and finish gate |
| Temple Skyline (jungle-skyline) | Pass | 5 | Respawn and finish gate |
| Flats & Pipes (flats) | Pass | 2 | Respawn and finish gate |
| Sky Bridge (sky) | Pass | 3 | Respawn and finish gate |
| The Slipstream (slip) | Pass | 2 | Respawn and finish gate |
| Slipstream 2 (slipstream-2) | Pass | 7 | Respawn and finish gate |
| Carlisle Coast (test) | Pass | 14 | Respawn and finish gate |
| Custard Creek (custard-creek) | Pass | 11 | Respawn and finish gate |
| The Nightworks (dark) | Pass | 11 | Respawn and finish gate |
| Nightworks: After Hours (nightworks-after-hours) | Pass | 7 | Respawn and finish gate |
| Island World Map (warproom) | Pass | 0 | Map movement and safe recovery |
| The Descent (descent) | Pass | 4 | Respawn and finish gate |
| Beachside Run (beachfront) | Pass | 4 | Respawn and finish gate |
| Bonus Level (bonus-level) | Pass | 0 | Respawn and finish gate |
| Coastal Street Run (coastal-street-run) | Pass | 6 | Respawn and finish gate |
| Island Hopper (island-hopper) | Pass | 3 | Respawn and finish gate |
| Jungle Gate Run (jungle-gate-run) | Pass | 3 | Respawn and finish gate |
| MeshyLook Thorn Courtyards (meshylook-thorns) | Pass | 0 | Respawn and finish gate |
| The Drowned Crown (drowned-crown) | Pass | 4 | Respawn and finish gate |
| Bonus: Easy Street (bonus-easy) | Pass | 0 | Respawn and finish gate |
| Bonus: Canopy Cache (bonus-treehouse-trail) | Pass | 0 | Respawn and finish gate |
| Bonus: Fern Reliquary (bonus-jungle) | Pass | 0 | Respawn and finish gate |
| Bonus: Quayside Cargo (bonus-test-course) | Pass | 0 | Respawn and finish gate |
| Bonus: Cloudtop Lockers (bonus-sky-bridge) | Pass | 0 | Respawn and finish gate |
| Bonus: Slipstream Airlocks (bonus-slipstream) | Pass | 0 | Respawn and finish gate |
| Bonus: Nightworks Fuse Store (bonus-nightworks) | Pass | 0 | Respawn and finish gate |
| Bonus: Lifeguard Lockup (bonus-beachside-run) | Pass | 0 | Respawn and finish gate |
| Bonus: Rooftop Deliveries (bonus-coastal) | Pass | 0 | Respawn and finish gate |
| Bonus: Lagoon Relay (bonus-island-hopper) | Pass | 0 | Respawn and finish gate |
| Bonus: Blockworks Reassembly (bonus-codex-switchback) | Pass | 0 | Respawn and finish gate |
| Bonus: Belfry Counterweights (bonus-chimeworks) | Pass | 0 | Respawn and finish gate |
| Bonus: Deadwater Valve House (bonus-waterpark) | Pass | 0 | Respawn and finish gate |
| Bonus: After Hours Dispatch (bonus-nightworks-after-hours) | Pass | 0 | Respawn and finish gate |
| Bonus: Apprentice Storehouse (bonus-crate-primer) | Pass | 0 | Respawn and finish gate |
| Bonus: Signal Cabin (bonus-switchyard) | Pass | 0 | Respawn and finish gate |
| Bonus: Furnace Reserve (bonus-clockwork-gauntlet) | Pass | 0 | Respawn and finish gate |
| Bonus: Jade Reservoir (bonus-jungle-terraces) | Pass | 0 | Respawn and finish gate |
| Bonus: Sun-Crown Treasury (bonus-jungle-skyline) | Pass | 0 | Respawn and finish gate |
| Bonus: The Captain’s Last Ledger (bonus-drowned-crown) | Pass | 0 | Respawn and finish gate |
| Bonus: Ivory Salvage (bonus-bone-yard) | Pass | 0 | Respawn and finish gate |
| Crate Primer (crate-primer) | Pass | 2 | Respawn and finish gate |
| Switchyard (switchyard) | Pass | 2 | Respawn and finish gate |
| Clockwork Gauntlet (clockwork-gauntlet) | Pass | 4 | Respawn and finish gate |
| Tidebreak · Crab Chief (crab-chief) | Pass | 0 | Reset to phase 1, 9 health |
| Haunted Castle · Ghost Train (ghost-train) | Pass | 23 | Respawn and finish gate |
| Blockworks · Greybox (codex-lab) | Pass | 6 | Respawn and finish gate |
| Jungle Cup (jungle-cup) | Pass | 0 | Run start and respawn |
| Bone Yard · Wipeout Playground (bone-yard) | Pass | 2 | Respawn and finish gate |
| Deadwater Park (waterpark) | Pass | 2 | Respawn; loop lock retained |
| Deadwater Cup (waterpark-cup) | Pass | 0 | Run start and respawn |
| The Chimeworks — Astra (astra-chimeworks) | Pass | 4 | Respawn and finish gate |
| Backport Mechanics Lab (backport-lab) | Pass | 1 | Respawn and finish gate |

## Continuous follow-up

See [TRAVERSAL_PERFORMANCE_FOLLOWUP.md](TRAVERSAL_PERFORMANCE_FOLLOWUP.md) for complete bonus, puzzle, After Hours, Deadwater, boss, Slipstream 2, temple, Blockworks and Drowned Crown journeys, plus the preserved camera/replay findings and remaining course coverage. The full goal remains active.
