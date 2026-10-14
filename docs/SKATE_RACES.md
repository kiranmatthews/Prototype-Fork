# Skate race levels

`CustomLevelData.skateRace` selects the reusable race controller in `src/race/runtime.ts`. Slipstream is the first course. The existing player motor, collision system, skateboard and authored character recovery animate the player and seven opponents; race authoring does not change movement tuning.

A race contains one supported spawn and one gate. Its components use the normal level toolkit. Omit checkpoints, fruit, world crystals, trial clocks and bonus entrances. Crates are `mystery` (items), `empty`, `tnt` or `nitro`. Keep gaps within the existing charged jump envelope and provide usable approaches for all racing lines.

The race data contract is in `src/race/types.ts` and its save/editor validator is in `src/race/schema.ts`:

- `v: 1`, `racers: 8` and a fixed integer `seed` define the event.
- Optional `stages` names the connected course sections for the shared competition introduction.
- `line` is an ordered array of `[x, floorY, z, rideableWidth]` knots from the spawn to the finish. Closely spaced knots and correct floor heights are essential at crossings and descending coils. Recovery raycasts the real floor at this guide's centre.
- `jumps` contains supported `takeoff` and `landing` points. The bot pilot charges before takeoff, releases through each gap and brakes on the final descent using the ordinary input controls.
- `finishWidth` covers the complete finish straight. The gate builds a checkerboard timing line and gantry; allow a supported run-out after it.
- `originalLength` records the length before an authored extension. It does not drive rider movement or progression.

The grid offers Race and Time Trial. Space / Cross confirms, Q / Circle brakes, F / Square spins, and I / L2 uses an item. Touch has its own item target. Items are homing bolts, shock rings, bubble shields, spin traps and turbo bursts. The appended replay input bit records item use without changing existing channel positions.

Each rider owns its item, shield, recovery state and set of unique broken boxes. Boxes return for following racers, while repeat breaks never increase one rider's gem tally. Blasts preserve the initiating rider's credit. Hazards and contact attacks use intact knockdown and get-up animations. A fall returns to the last supported centre with a 1.8-second animated delay; it preserves the world, box credit and timer. The rider returns with a capped, charged rollout that can retry every authored gap without advancing their position. Opponent poses sample at 30 Hz nearby and 10 Hz farther away, while every rider keeps the same fixed-step motor, contacts and recovery.

Only a first-place race finish awards a new crystal. A completed race can also award the box gem. Time trial is always available and records time medals through the existing campaign store. Existing adventure awards remain owned; `raceWon` separately records a real race victory. Race screens reuse the competition layouts, portraits and pre-CRT renderer, the shared Roo menu text and button hint pack, and the existing collectible slots/models. The race module only binds event state and plots course positions; it adds no text painter, icon set or stylesheet.

For a second course, author another `CustomLevelData` with this metadata and register its campaign definition with `skateRace: true` and `bonus: false`. No runtime level-name checks are needed. Keep ordinary floor edges grindable.

Validation uses `tools/test-skate-race-rules.mjs` for behavior and `tools/test-skate-race.mjs` for input-driven production physics. `tools/skate-race-browser.mjs` checks the real grid, controls and responsive HUD. `RACE_FROM` and `RACE_SOLO` are isolated segment checks; a completion claim needs a complete start-to-finish run. `RACE_DELAY=35` lets every opponent finish before the human pilot, exercising all seven independently.
