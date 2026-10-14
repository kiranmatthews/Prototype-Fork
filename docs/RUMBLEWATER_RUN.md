# Rumblewater Run

A source-owned campaign level, `rumblewater-run`, appended after Custard Creek on Island 1. Existing course data and saved map indices remain intact. About **2,802 metres** of curved travel descend through a sandstone gorge through seven separate chases by 16.4-metre mossy boulders.

## Playing

Run toward the lens with **Down**; Left/Right stay relative to the screen. Hold **Space** to skate/charge, release to jump, and hold **E** to catch a grind. Movement tuning values are unchanged. Reachable pipe-to-pipe gaps now retain the existing vert-air gravity and momentum.

The course is 3.043 times the original 920.95 m route and develops over three equally long station ranges:

| Act | Character | Traversal and pressure |
| --- | --- | --- |
| Release · 0–892 | Broad sandstone banks and flowing pipes | First jump, two-way bank fork, long introductory grinds, lower snake and raised shelf. |
| Working mills · 892–1784 | Sluice yards, counterweight causeway and broken roofs | Alternating crushers, breakable/solid chicanes, collapsing bridges, offset island jumps, first rail transfer, angled roof takeoffs and shorter receiving pipes. |
| Drowned quarry · 1784–2676 | Quarry locks, shattered aqueduct and falling throat | Nitro lane choices, cross-rolling stone, narrow collapsing banks, a ground double jump or two-air three-rail relay, tighter pipe hazards, twin crushers and the final S-grind/collapse escape. |

The authored obstacle/route decisions rise from **12 → 23 → 34** per act. New mechanics enter separately before the final rooms combine them; the extension is not a duplicated opening. Six enclosed checkpoint refuges divide the route into seven chases. The incoming boulder jams in the entrance; the next one waits on an overhead cradle until the player clears the exit. The crystal rewards the late three-rail relay. Jump to the sanctuary while the boulder drops into the intervening gorge. Gold/silver/bronze targets are **118/146/180 seconds**.

## Geometry and camera

`src/levels/rumblewater-run.ts` owns the shared route/grade and opening; `src/levels/rumblewater-downstream.ts` authors the two new acts with the same component helpers. The course has 16 curved pipe sections, 12 explicit grind paths, 28 broken spans, reward lines, checkpoints, and one finish. Closed creek-bank meshes and existing vert/rail primitives provide support; no invisible floor spans a jump. Ordinary surface edges keep the toolkit's grind behavior.

The optional `boulderChase.shelters` entry/exit pairs survive editor capture/export/import. Each run owns a separate physical stone. Entering a refuge retires the pursuer into a harmless, solid jam against the entrance; clearing the far portal releases the next stone from a 13 m overhead cradle. Its roughly 0.85 s fall breaks the cradle, then starts rolling at the authored chase speed. The final stone still falls into the sanctuary gap. Existing stone collision/rewards, sound, dust and crumble behavior supply the interaction; all seven round stones share one texture/material and both LOD geometries.

`BoulderChaseCamera` remains ahead of the route and looks back. Camera anticipation does not steer the player. Ground-oriented aim preserves landing visibility during jumps and raised grinds; portrait framing balances the chosen bank with the pursuing boulder. The camera moves closer and lower through the roofed temple shelters, follows the upcoming doorway’s floor on downhill approaches, then widens to reveal the dropping stone. The existing fatal-fall hold remains outside the rig.

## Art

Reuse the existing commissioned Custard Creek and Carlisle Coast asset catalogue, including layered gorge cliffs, eroded buttresses, willows, ferns, temple remnants, and mill. Scenery retains original model UVs, compressed textures, distance LOD, and shared resource disposal; modular parts fit the authored structures. The pursuing boulder uses a closed spherical shell with shallow weathering, fissures and moss, detailed with the existing Custard sandstone texture. Its centre sits one rolling radius above the route, and its rotation advances by travelled distance divided by that radius. No new paid generation or third-party asset import was needed. Native sandstone/moss surfaces, connected deep shoulders, a submerged riverbed, and the animated creek make the route belong to the same world. Art placements live in `src/levels/rumblewater-art.ts`. The new acts add working-mill landmarks, carved district arches, broken aqueduct piers, cooler quarry walls and sparser planting toward the finale.

`public/level-previews/rumblewater-run.jpg` and `docs/art-reviews/rumblewater-run.png` are real gameplay captures.

## Verification

- `node tools/test-rumblewater.mjs inner-low outer-high recovery late-recovery stall`: current full routes finish in 123.37–128.03 seconds with six deliberate board-ejecting entrance trips, six earned checkpoints and no deaths; also verifies early/late water returns and a stopped-runner boulder death. Native traces go to `/private/tmp/rumblewater-evidence`.
- `node tools/test-rumblewater-structure.mjs`: source/editor round trip, triple-length measurement, increasing decision density and mechanic variety, 45 actual support probes (including all six checkpoints), 28 permanent-floor gap probes, gate, kill plane, and pipe/rail inventory.
- `node tools/test-boulder-shelters.mjs`: six twenty-second safe waits, independent stones, exit-only releases, finite drops, dangerous post-exit stalls, checkpoint re-arming and intro/cave framing.
- `node tools/test-rumblewater-refuges.mjs`: all six actual chambers keep the player supported and supplies untouched for twenty seconds, match their release cradles, preserve editor data and leave the rider visible through physical doorways.
- `node tools/test-round-boulder.mjs`: both closed sphere LODs, 360-direction roundness, 600 rolling steps, preserved collision height, seven-stone shared resources and late-load disposal.
- `node tools/test-boulder-chase.mjs`: bounded pursuit acceleration, stationary danger, checkpoint grace, finite end fall, and framing at 16:9, 4:3, portrait, and short landscape.
- `tools/rumblewater-review.html?pilot=inner-low` runs the shared input controller against the real browser player in lite mode. `?pilot=outer-high&full` runs the fully rendered grind route; `take=recovery`, `take=late-recovery` and `take=stall` exercise failure behavior. Regenerate these fixtures with `node tools/rumblewater-browser-fixtures.mjs` after native passes. This review page is development-only. It reports framing, assets, deaths, bails, checkpoints and console errors, and captures gameplay frames throughout the three acts. `?station=1460&full` supports isolated scene review without a traversal claim.
- Required `check:levels` commands, production TypeScript/Vite build, camera regression, campaign identity/unlock checks, and actual map travel in both directions. The extracted high-air camera test receives the real current camera dependencies. No full-suite run.

The local runtime has no npm executable; the build and check:levels script contents were executed directly with the bundled Node binary. Native and browser pilots share the same cooperative controller decisions and emit only stick/button inputs. The browser responds to its live player state and moving-hazard phase; fixed `?take=` recordings are retained for short diagnostics, since small timing differences can accumulate over a long course. Browser rendering supplies its live camera. No pose, velocity, hazard, balance, or movement tuning corrections are injected during takes.

## Expansion evidence before refuges

The final responsive controller reaches the finish in Chrome full rendering on the high route (**6,119 frames**) and lite rendering on the low route (**6,545 frames**), with zero deaths, bails, console errors or out-of-frame rider bounds. The full high take loses no masks; the low take absorbs one counterweight contact and continues through the intended route. All three rail transfers and the final S-grind/jump are real player movement. A separate full-render water-death take returns naturally to the quarry checkpoint at station 2016 with the boulder waiting behind it.

See `docs/art-reviews/rumblewater-expanded/validation.json` and the actual full-render aqueduct capture `docs/art-reviews/rumblewater-expanded/aqueduct.png`.

## Initial sheltered-checkpoint iteration

`src/levels/rumblewater-refuges.ts` owns the six stone vaults at stations **324, 739, 1178, 1668, 2016 and 2485**, their checkpoints, protected supplies and overhead cradles. These replace the scattered open-air checkpoint layout. The mill bonus entrance and its return point now sit inside the second refuge.

Inside a chamber, the chase rumble stops and there is no countdown: the player can collect crates or pause. Respawn restores the previous rock lodged outside and the next rock waiting above its intact cradle. The release is triggered by clearing the exit, not by breaking the checkpoint box or waiting a set time. The first chase retains its supported opening; later runs visibly begin with a fresh falling stone.

The final full-render high route finishes in **6,111 frames** and the lite ground route in **6,521 frames**. Both show all six gate impacts followed by six releases and six landings, with zero deaths, bails, mask losses, console errors or rider bounds outside the frame. The ground take activates all six checkpoints. A separate full-render missed-jump take respawns naturally at station 324, with the previous stone jammed, the next stone waiting 13 m above the route and the chamber still safe.

Actual gameplay captures and compact evidence are in `docs/art-reviews/rumblewater-refuges/`. The architecture uses indexed meshes to remain inside the unchanged editor work budget. No movement tuning or paid assets changed.


## Meshy temples, committed chases and pipe transfers · 2026-10-14

All six shelters now use the existing Meshy modular kit: carved arches, ashlar walls, engaged columns, paver floors, bracketed lamps and stepped temple roofs. Their short spines are straight and level; hidden collision matches the new architecture. The board-catching stone threshold ejects a skater entering on the ground, in an ollie or on a grind, without spending a mask. The room remains safe while the rider recovers and collects its checkpoint and three supplies.

All seven boulders begin on visible breakaway timber cradles. Stone footings and piers carry heavy cross-bearers and knee braces; the opening camera shows the whole round boulder. Small crusher stones have grounded timber gantries and moving cables. The seven chase paces are fixed at **24.5 / 27 / 27 / 23 / 27 / 23 / 30 m/s**, chosen for each terrain section. Player proximity never applies brakes. Clearing a refuge still sends its old stone into the entrance and releases a different waiting stone outside the exit.

Chase/rolling boulders and falling stone crushers in this course kill through masks and temporary protection. The pursuing sphere’s swept footprint crushes every solid crate family, including metal and partial overlaps, plus smaller rolling stones, crusher heads/frames, counterweights/gallows, enemies and collapsing timber. Reset restores the demolished hazards. Metal and switch demolition does not invent counted-crate rewards; sheltered supplies remain protected.

Halfpipes and explicit grind rails use Haunted Hassle’s real Meshy aqueduct, bronze coping and rail surfaces. The visible pipe profile respects its authored arc, including the lower 70–80 degree sluices. Soil follows the back of each transition down below the creek; Meshy eroded roots cover exposed ends, and planted grass, ferns and vines break the rims. Shoreline rocks, planting shelves, gateway bases and the opening aqueduct piers have connected foundations. Overlapping banks at branch merges and pipe handoffs have been removed. The actual pipe/backfill meshes pass 384 clearance probes, with at least 16.5 cm separation, including the offset and narrowing pipes. Every genuine jump gap remains open.

A hang no longer pins to the exact last coping point or suddenly changes gravity at a reachable gap. An aligned receiver within a bounded forward gap continues the existing coping flight, without changing vertical velocity or tuning values. A continuous-pipe versus nine-metre-gap comparison differs by only **0.00000344 m** in height. The actual curved Serpent gap has **29 airborne gap frames** at the unchanged **31 m/s²** gravity, landing on the next pipe without a bail in native and full-render browser checks.

The second shelter now leads to **Sluicekeeper’s Cache**, an original 21-crate bonus: stepped aqueduct terraces, an arrow-assisted high cache, three switch-revealed river islands on stone piers, a storehouse stack and a collapsing timber crossing. It uses the same Meshy temple kit, gorge roots, creek, foliage and light. Both its standalone all-crate completion and the real browser pad-entry/return flow pass; the detour banks 21 boxes and returns safely to the protected mill room.

Visual inspection uses **Max resolution, 3024 × 1528**, with original PNGs, full materials and clean browser consoles. The current high-route browser take finishes in **7,402 frames**, with six intended entrance trips, zero other bails/deaths/mask losses, all six checkpoints, seven boulder stages and no rider bounds leaving the frame. All six physical shelter/camera probes remain safe for twenty seconds, including backward checkpoint warps. Required level checks and the TypeScript/Vite build pass; the existing 51-case pipe regression also passes. The full suite was not requested or run. **No new Meshy jobs or stone textures were made; 0 of the authorized 200 credits were spent.**

Current evidence: [`art-reviews/rumblewater-polish/validation.json`](art-reviews/rumblewater-polish/validation.json), the original Max-resolution captures beside it, and the full bonus browser receipt. Development-only reproduction pages are `tools/rumblewater-review.html?pilot=outer-high&full`, `?vert&full`, and `tools/rumblewater-bonus-review.html`. The transfer check declares one initial supported 28 m/s approach fixture; after that it uses ordinary inputs, with no mid-flight corrections.


## Opening headwaters · 2026-10-14

The first suspended boulder now sits in front of a roughly 63 m animated waterfall. Three uneven curtains turn over the crest into a real plunge basin feeding the creek. Overlapping Meshy sandstone masses, mossy outcrops, shoreline stones and 32 grounded willow/shrub/trailing-foliage placements frame the opening. The backdrop lives entirely in `rumblewater-waterfall.ts` and editor group 94; no chase, camera or movement settings change. `tools/measure-rumblewater-waterfall.mjs` regenerates plant roots from the actual cliff triangles.

Original Max-resolution opening and release frames, grounding measurements and validation are in [`art-reviews/rumblewater-waterfall/`](art-reviews/rumblewater-waterfall/). The full-render high route still finishes in 7,402 frames with all six checkpoints and seven chase stages, zero deaths or unexpected bails, and a clean console.


## Branch pursuit and checkpoint retries · 2026-10-14

Seven fork definitions now pair the actual low and raised routes. The pursuer chooses from the runner’s position before entering, commits to that route until its merge, and rolls at its authored physical pace along it. Its lethal body, destruction sweep and ground effects follow the selected route; the camera keeps the common spine. Respawn clears the previous route choice.

A runner who lets the whole boulder pass has three seconds to get back ahead before a fatal lightning strike. The rule remains active if the stone reaches its stop or final drop, and never runs inside a shelter. Deaths belong to the actual respawn checkpoint: the first two give no assistance, then the boulder slows by 4% per death up to 20%. Pace changes apply on retry, not during pursuit; entering a new section starts at full speed. A new run clears the counters.

The global skate-trick reward adds 1.25 m/s per clean trick touchdown, stacking to 5 m/s. Each landing refreshes a four-second hold before a gradual fade. Empty hops and failed/sketchy tricks earn nothing, and braking/bailing/dismounting/respawning clears it. The tuning panel exposes the reward, cap and hold. Old replay files default the new reward to zero, preserving their recorded physics.

The lamp-like edge markers now have supported bases: 38 takeoff stones are seated on the actual bank/pipe shape, 64 pipe-end posts and 12 checkpoint sentinels reach the creek bed, and 25 exposed-rail bearings complete the raised routes. Original Max-resolution captures and final validation are in [`art-reviews/rumblewater-chase-rules/`](art-reviews/rumblewater-chase-rules/).
