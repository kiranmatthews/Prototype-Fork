# Skate race levels

`CustomLevelData.skateRace` selects the reusable controller in `src/race/runtime.ts`. The player and seven rivals share the normal movement, ground contact, jump, collision and recovery implementation. Racing retains normal mounting, brake-dismount, board abandonment, walking, running, foot jumps, double jumps, ledge grabs and climbing. A hit can leave the rider on foot; the controller does not force a remount. Race authoring does not change `src/tuning.ts`.

Author one supported spawn and one broad finish gate, with a supported run-out. Omit checkpoint crates, fruit, world crystals, trial clocks and bonus entrances. Ordinary road edges remain grindable. Steep racing roads should declare `vert: false`; do not give them coaster momentum or a uniform cross-slope that deflects normal forward movement. The current finale keeps its steep coils, with level racing lanes across the width and raised shoulders.

The save/editor contract is in `src/race/types.ts` and `src/race/schema.ts`:

- `v: 1`, `racers: 8` and an integer `seed` define the event. The data seed is the fallback for legacy replays; normal starts draw a fresh seed from Web Crypto.
- Optional `stages` retains authoring labels for diagnostics. Player text only explains the race.
- `line` contains ordered `[x, floorY, z, rideableWidth]` samples. Accurate heights distinguish stacked road sections.
- `jumps` contains supported takeoff and landing points. Preserve a normal charge/run-up on both initial approaches and retries.
- `finishWidth` covers the complete timing line.
- `originalLength` records an authoring measurement; it does not drive movement.

The grid offers Race. Time Trial appears only after a winning finish secures that level’s crystal in the active save; merely finishing a race does not unlock it. Results and replay/controller start requests use the same gate. All eight riders begin mounted, including while stationary. A normal brake/dismount releases that starting stance. The 3–2–1 countdown and brief GO appear over the skating view through the existing transparent competition HUD. Space / Cross confirms or charges a jump, Q / Circle brakes, F / Square spins, and I / L2 uses the held item. The item picture and its existing inventory-button icon appear only while an item is held; using it removes both. Race screens omit generic control-hint footers. Touch uses the held item picture as its tap target. Held items and threats use twelve original ImageGen pictures, prepared before the race and drawn by the shared image painter inside existing reward slots. World projectiles retain their small shared models. Names remain accessible labels/tooltips rather than visible item-name text. The 512-pixel transparent WebP files are in `public/race-items`; prompts, original hashes and runtime filenames are in `tools/waterslide-assets/image-prompts.json`.

| Item | Behaviour |
| --- | --- |
| Banana peel | Rear trap; also intercepts red/green shells |
| Green shell | Straight ricochet; hold back while firing to defend behind; shells can intercept one another |
| Red shell | Tracks the next racer, warns, then commits to a straight attack |
| Blue shell | Orbits the leader, marks its predicted impact point, then dives into that fixed area |
| Lightning (`shock-shell` legacy ID) | Distinct storm model; 1.6 s charge before sky-to-ground strikes; a timed hop or shield avoids it |
| Mushroom | Boost preserves existing momentum; its first 0.55 s can dodge a blue-shell impact |
| Bubble shield | Blocks the next hit, with visible break feedback |
| Air horn | Clears nearby shells, including blue, and knocks nearby rivals away |
| Water bomb | Ballistic throw with a marked landing and 0.7 s fuse; a normal jump or movement out of the splash avoids it |
| Boomerang | Sweeps outward, then returns; can hit rivals on either leg and can be spun or blocked away |
| Star | Ultra rare: 6 s of weapon protection, skating boost and contact attacks; ordinary fall recovery still applies |
| Tidal wave | Ultra rare: charges for 1 s, then rolls along the course; a normal jump clears the crest |

Leaders have seven common item types and cannot repeat either of their previous two pickups. Each race starts with fresh entropy; each rider then has an independent weighted item stream, so boxes have no fixed reward. Rank and actual gap weight catch-up tools. Blue shells and lightning have a 20-second opening lockout, shared 25-second spacing, one held/in-flight heavy-item limit and forward-progress eligibility. Tidal waves share that heavy-item limit and impose 45-second spacing. A full slot leaves an item box intact. Solo trials consistently provide mushrooms.

Ultra-rare rolls become eligible after 30 s and are limited to one ultra-rare award per rider per race. Their raw weights are 0.06 for star and 0.04 for tidal wave; the latter additionally needs heavy-item eligibility, fifth place or lower and a deficit above 70 m. A 100,000-draw eligible trailing-rider test produced 96 stars and 59 tidal waves. These observed frequencies include repeat protection; the real race also imposes the eligibility limits above.

Replay V2 adds optional `raceSeeds: [frame, unsignedSeed][]`. The recorder captures the exact seed on each race-start input frame, including subsequent restarts within a take. Playback injects those seeds; older takes without the field use the level's data seed. Input-edge consumption clears the seed so it cannot leak into a later live start. Validation rejects zero, negative, overflowing, duplicate, unsorted or out-of-range seed events.

Up to two incoming weapons appear as the shared item pictures with directional arrows, countdown rings/times and audible ticks. Only the actual homing target is warned; green warnings require a closing trajectory. Red shells have a committed final attack, can hit walls, and are vulnerable to timed normal spins or dropped defenses. Blue shells orbit for 1.1 s, then commit to a marked 3.2 m area over 0.8 s; walking/running out, a shield, horn or timed boost can avoid them. Lightning visibly charges above rivals and strikes once, preserving existing airborne traversal. Race knockdown grace is 2.4 s. See [the research and tuning rationale](RACE_ITEM_RESEARCH.md) for source distinctions and measured counterplay.

The six main jump gaps have bounded catch pools using existing water meshes and swimming. The restored platform runs add twelve real gaps and two lower catch basins, bringing the total to eighteen jump definitions and eight swimming routes. Test fixtures deliberately dismount before walking off an edge; the two short-gap runs use a lateral miss so an ordinary automatic ledge grab does not turn the swimming test into a successful platform recovery. Each pool has a physical bed, side rims and a shallow downstream bank that joins the original landing. A missed jump can swim forward, jump out on foot and keep racing; the normal jump remains available above it. `mesh.swimDepth` opts a non-solid water surface into swimming, preserves exact triangle footprints and prevents water from affecting geometry beneath its bed. The editor exposes the same depth. Pool wall positions use their bottom height; platform positions use their centre height. A fresh jump press works immediately on shore; a held swim stroke still needs its usual release. Rivals follow the downstream bank and remount through ordinary input.

Question crates are four-wide item rows. In a race they are 1.92 m cubes, twice the normal crate size, hovering clear of the road. They do not form crate-grind ledges or contribute to the box gem. Empty crates, TNT and Nitro do count. Each rider owns a set of unique broken boxes, so AI breaks and repeated respawns cannot credit or inflate the player's gem tally. Blasts retain their initiating rider; a hard retry clears that ownership. Item boxes return after four seconds; ordinary race boxes return after seven.

Uncaught falls use the normal player fall, fade and recovery timing. A race changes the return destination and suppresses life loss, death statistics and trial cancellation. Return to the last supported road centre, reserving a 30 m run-up near an unfinished jump. The player returns from rest with ordinary controls. A live fall can land on lower road geometry: only that actual landing adopts the new route branch and resets the camera/input cursor. After a rider descends 30 m below the last supported anchor, a conservative falling-time and steering-reach query checks other route branches against real floor collision. If no lower road remains reachable, enter the ordinary pit death without waiting for the distant world kill plane. Reachable deep drops stay live; there is no custom floating return animation.

Rivals use delayed steering, varied lanes, native charge/brake inputs, nearby spin attacks and items. They brake on straights rather than locking their steering through a bend. The lighter rival surfaces retain the same semantic rig, sockets, movement, hand skins, optimized limb bones and shared elasticity; Bone Man keeps his full presentation. All riders' assets prepare before play. Conservative view culling affects rendering only. Distant rival one-shots are attenuated separately from the player's sounds.

Mounted race presentation applies the complete supported-surface normal. Measured board angles track the roughly 36–39° sampled coil grades within about 1–3°, without changing general movement tuning.

Ordered course projection searches only segments that overlap the requested arc window. Both endpoints remain inclusive, repeated knots retain their order, and equal-distance ties keep the first eligible leg. Unbounded landing queries still inspect the complete course so a genuine lower-road landing can adopt that branch. `node tools/test-skate-race-course.mjs` compares the range search with an exhaustive ordered reference, including stacked/vertical legs and 4,096-knot courses. The source and live-race audit is recorded in `waterslide-island/evidence/course-projection-validation.json`.

Nearest-grind queries reject rails only when a conservative cached box is farther away than the current exact winner. The box covers the baked path, including rounded segment endpoints; ties keep their original rail order. Owned rigid motion uses `Rail.translate()`, shape changes use `rebake()`, and node restores that intentionally retain their bake call `invalidateQueryBounds()`. Moving platforms, ropes and enemy rails keep their ordinary catches and reset behaviour. Exact-query and production-race evidence is recorded in `waterslide-island/evidence/rail-query-bounds-validation.json`.

The shared frame loop captures the player's render pose once per fixed step. The race captures its extra riders after the same completed step. Markers follow interpolated poses. Nearby opponent pose samples run at 30 Hz and distant samples at 10 Hz, while movement and contact remain fixed-step.

Only winning a race grants a new crystal. A completed race can grant the box gem; solo trials record existing time medals. Existing awards remain owned. The interface reuses the competition layouts, Roo lettering, button hint pack, portraits, reward slots and models. The finish sign uses `Level.worldRooLabel`. No separate race stylesheet or text painter is needed.

Untouched saved copies of the previous shipped race adopt the current source without rewriting storage. Edited courses remain authored overrides.

Run `npm run check:race:rules` for the focused systems regression and `npm run check:race` for the full native race checks, including all riders finishing. Use `tools/skate-race-full-browser.mjs`, `tools/skate-race-ui-browser.mjs` and `tools/skate-race-rival-motion.mjs` for production rendering, touch/item pictures and multi-angle motion. `RACE_FROM` is an explicitly placed segment fixture, not evidence of a complete run. The development-only `?fullRivals` flag supports presentation comparisons.
