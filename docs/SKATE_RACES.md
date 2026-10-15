# Skate race levels

`CustomLevelData.skateRace` selects the reusable controller in `src/race/runtime.ts`. The player and seven rivals share the normal movement, ground contact, jump, collision and recovery implementation. Race authoring does not change `src/tuning.ts`.

Author one supported spawn and one broad finish gate, with a supported run-out. Omit checkpoint crates, fruit, world crystals, trial clocks and bonus entrances. Ordinary road edges remain grindable. Steep racing roads should declare `vert: false`; do not give them coaster momentum or a uniform cross-slope that deflects normal forward movement. The current finale keeps its steep coils, with level racing lanes across the width and raised shoulders.

The save/editor contract is in `src/race/types.ts` and `src/race/schema.ts`:

- `v: 1`, `racers: 8` and an integer `seed` define the event.
- Optional `stages` retains authoring labels for diagnostics. Player text only explains the race.
- `line` contains ordered `[x, floorY, z, rideableWidth]` samples. Accurate heights distinguish stacked road sections.
- `jumps` contains supported takeoff and landing points. Preserve a normal charge/run-up on both initial approaches and retries.
- `finishWidth` covers the complete timing line.
- `originalLength` records an authoring measurement; it does not drive movement.

The grid offers Race and Time Trial. Space / Cross confirms or charges a jump, Q / Circle brakes, F / Square spins, and I / L2 uses the held item. Touch has a persistent item button. Item pictures use the same models as their world effects, painted by the existing menu model renderer; names remain accessible labels/tooltips rather than HUD text.

| Item | Behaviour |
| --- | --- |
| Banana peel | Drops behind the rider and trips an opponent |
| Green shell | Travels straight and ricochets from road edges |
| Red shell | Seeks the next racer ahead |
| Blue shell | Chases the leader, then bursts near that rider |
| Shock shell | Hits every other active racer |
| Mushroom | Gives a short boost without chopping existing momentum |
| Bubble shield | Blocks the next hit |

Item rolls favour defensive tools at the front and catch-up tools behind. Solo trial item boxes consistently provide mushrooms. Input replay channels remain append-only.

Question crates are four-wide item rows. In a race they are 1.92 m cubes, twice the normal crate size, hovering clear of the road. They do not form crate-grind ledges or contribute to the box gem. Empty crates, TNT and Nitro do count. Each rider owns a set of unique broken boxes, so AI breaks and repeated respawns cannot credit or inflate the player's gem tally. Blasts retain their initiating rider; a hard retry clears that ownership. Item boxes return after four seconds; ordinary race boxes return after seven.

Uncaught falls use the normal player fall, fade and recovery timing. A race changes the return destination and suppresses life loss, death statistics and trial cancellation. Return to the last supported road centre, reserving a 30 m run-up near an unfinished jump. The player returns from rest with ordinary controls. A live fall can land on lower road geometry: only that actual landing adopts the new route branch and resets the camera/input cursor. There is no near-road rescue cutoff or custom floating return animation.

Rivals use delayed steering, varied lanes, native charge/brake inputs, nearby spin attacks and items. They brake on straights rather than locking their steering through a bend. The lighter rival surfaces retain the same semantic rig, sockets, movement, hand skins, optimized limb bones and shared elasticity; Bone Man keeps his full presentation. All riders' assets prepare before play. Conservative view culling affects rendering only. Distant rival one-shots are attenuated separately from the player's sounds.

The shared frame loop captures the player's render pose once per fixed step. The race captures its extra riders after the same completed step. Markers follow interpolated poses. Nearby opponent pose samples run at 30 Hz and distant samples at 10 Hz, while movement and contact remain fixed-step.

Only winning a race grants a new crystal. A completed race can grant the box gem; solo trials record existing time medals. Existing awards remain owned. The interface reuses the competition layouts, Roo lettering, button hint pack, portraits, reward slots and models. The finish sign uses `Level.worldRooLabel`. No separate race stylesheet or text painter is needed.

Untouched saved copies of the previous shipped race adopt the current source without rewriting storage. Edited courses remain authored overrides.

Run `npm run check:race:rules` for the focused systems regression and `npm run check:race` for the full native race checks, including all riders finishing. Use `tools/skate-race-full-browser.mjs`, `tools/skate-race-ui-browser.mjs` and `tools/skate-race-rival-motion.mjs` for production rendering, touch/item pictures and multi-angle motion. `RACE_FROM` is an explicitly placed segment fixture, not evidence of a complete run. The development-only `?fullRivals` flag supports presentation comparisons.
