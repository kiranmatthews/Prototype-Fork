# Challenges 1–25

[Open the phone playtest](https://kiranmatthews.github.io/Prototype-Fork/challenge-playtest.html?touch) · [Open the course in Prototype Fork](https://kiranmatthews.github.io/Prototype-Fork/?playtest&level=crystal-trials)

Choose a number to practice one spot, or select **Whole course** to travel through all 25. Every number has a starting checkpoint and a single crystal. The whole-course exit opens when you have all 25. **From checkpoint** keeps the crystals you earned.

You start on foot. Move to walk, hold Jump while moving to mount, release to ollie, and hold Grab to brake back to walking. The phone page uses the main game's touch controls, keyboard and gamepad bindings. Its canvas follows the device's display resolution and orientation. The picker loads first. A cache-disabled test of the published phone page transferred 36 KB for the picker, 20.1 MB through the first challenge and 38.3 MB after opening the whole course, the rejects archive and the original grid.

The fast line and the lower walking route meet on the same crystal terrace. You can switch between them or carry a line across the architecture above the corridor. Fruit arcs mark transfers and striped lips mark receiving banks. At a pulsing dock, the narrow side lip gives you a takeoff when the first sill goes dark. Marked pits sit beneath selected gaps. The flat floor sits eight metres below the entrance. Starts are at least 512 metres apart.

| Number | Brief description |
|---|---|
| 1 | Cross a hip onto a bent rail, then cut inside the split plaza. |
| 2 | Carve the drainage channel, clear the stair hip and land on the ferry. |
| 3 | Grind down the stair flight, switch rails above the trench and bank out. |
| 4 | Choose a crescent ledge, outrun two falling tongues and catch the cable. |
| 5 | Pump the linked bowls, cross the hip and land a kickflip off the high lip. |
| 6 | Drop past the swing, board the cross-ferry and pop onto the stair rail. |
| 7 | Catch a pulsing quay, cut across the split and grind the rising seawall. |
| 8 | Hit the switch for an inside grind, then carve the sluice into a rebound. |
| 9 | Thread two pendulums, cut behind the patrol and kickflip the return hip. |
| 10 | Drop onto a sagging cable, air into a landing bowl and split the far ledge. |
| 11 | Transfer between offset rails, cut inside the switch and clear the stairwell. |
| 12 | Rebound onto the high apron, catch the crest rail and dive onto a moving dock. |
| 13 | Ride the cable across the cut, beat the falling shelf and hip onto the upper fork. |
| 14 | Read the dock lights, transfer between rails and exit through the swinging bay. |
| 15 | Skirt the patrol, open the inside ledge and pop a kickflip over the stair cut. |
| 16 | Cross the bowl diagonally, take the ferry and spring onto the cable terrace. |
| 17 | Drop down the spillway, cut behind the patrol and carry the hip into offset rails. |
| 18 | Grind the curved parapet, land in the bowl, then clear the moving quay and hip. |
| 19 | Carry speed over two breakaways, open the short bridge and rebound uphill. |
| 20 | Choose the rail chord, cross two pendulums and kickflip from the inside ledge. |
| 21 | Hip onto the high line, change rails, carve below the patrol and cross the sluice. |
| 22 | Catch the moving dock, clear the lighted sills and thread a cable into the stairs. |
| 23 | Open the crate bridge, carve the falling tongue, then take the rail to a rebound. |
| 24 | Carve the bowl, dodge the sweep, transfer above the stairwell and flip the last hip. |
| 25 | Link a switch shortcut, pulsing dock, cable transfer, two spring beds and a kickflip. |

**Rejects** opens 100 earlier layouts, including the last published series as `01-l` through `25-l`. The original eight-station grid is the separate **0** choice. [Rejects index](rejects/README.md)

## Verification

Run the individual controller routes on foot and on the board, then walk the uninterrupted course from its actual start to its unlocked exit.

```sh
node tools/test-crystal-streets.mjs
node tools/test-crystal-street-course.mjs
```

To check one spot, for example the rail and springs in 25, run `node tools/test-crystal-streets.mjs 25 skate`. Set `CRYSTAL_STREET_OUT` to a directory to save the individual position traces. With the development server running, the browser pilot uses the same controller samples inside the phone playtest. The phone smoke test exercises actual touch presses, screen rotation, high-density output, checkpoint retry, archive selection and the transfer budget.

```sh
CRYSTAL_PHONE_TRIALS=25 python3 tools/crystal-trials-phone.py
CRYSTAL_PHONE_URL='http://localhost:4173/challenge-playtest.html?touch' python3 tools/test-challenge-phone.py
```

The existing numbered evidence directories and progress files describe previous releases. The historical skating pilots can be run against their matching [November 17 source revision](https://github.com/kiranmatthews/Prototype-Fork/tree/c1524e29). [Previous skating series](sequences/README.md) · [Previous platforming series](platforming-version/progress.json)

The layout review used the measured transitions, hazard timings and recovery rules in the [Gameplay Design Bible](../GAMEPLAY_DESIGN_BIBLE.md) and the [THPS level-design research](../warehouse-flow/research-principles.md).
