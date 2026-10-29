# Mayfield Mall circulation repair

This pass repairs the complete four-source course after the parking-garage
addition. The three original garage storeys and both quarters remain the start.
The main route is now 2,228.82 m, with normal controls, ten checkpoints, the
crystal, finish and After Hours bonus. The imported assemblies contain 71,045
mesh triangles; the course still uses actual ground from all four source levels.

## Geometry changes

- Fitted landing meshes follow the actual source cut edges. Closed deck sides,
  overlaps and physical parapets replace the old point-to-point seams. The
  courtyard and exit use continuous broad floors without overlapping finish
  slabs or uncovered diagonal corners.
- Separate stairs reach the galleria sculpture mezzanine and front balcony.
  The high and low galleria lanes reconnect to the gym roof and food court.
- The food-court tables sit on a complete plaza. The retained pavilion/glazed
  passage is repositioned beside it. Both gym doorways match the circulation
  width; glazing closes the skylight, a lintel supports the exit windows, and
  roof stairs connect the relocated blue canopy back to the arcade.
- Both original arcade terraces have lower and upper access. The loading
  roll-in is wider and meets a continuous warehouse floor. Wall bays extend
  to the floor with real openings, and the suspended office and its roof have
  access routes around the retained kickers, Big Rail, halfpipe and taxis.
- The Kona minis and timber decks have approaches from a common court. The
  intact snake assembly moves 60 m farther along the course, clearing those
  approaches. A ramp enters its raised head deck and follows its actual descent.
  The lower garden has a return bank.
- The final atrium retains its scale, angled architecture and great descent.
  A framed doorway through the existing upper facade connects a new gallery
  stair. Its main descent follows the open side of the original angled wall.

The 40-image concept atlas is unchanged. These are circulation and collision
repairs, not the later art replacement pass. No movement tuning, shared player
physics or published level-pack snapshot was edited by this repair.

## Verification

The evidence files in this folder are generated from real level construction
and controller inputs. Fixture placement establishes each local test's start;
it is not used to advance along a tested route.

- `access.json`: 18 named routes, forward and reverse, connected to the main
  route or a documented main-route exit. Ordinary foot movement, no jumping.
- `joins.json`: nine main joins, five lanes across each width, both directions.
  Downward support samples plus actual traversal check approaches and departures.
  The isolated seam test suppresses the finish event while retaining its physical
  pad; complete runs separately verify the real finish event.
- `foot.json` / `skate.json`: complete start-to-finish browser runs, all ten
  checkpoints, the crystal, source-ground contact, unchanged tuning and console.
- `transitions.json` / `parking-contact.json`: native Warehouse/Kona and garage
  quarter ascent, launch, return and side-wall containment.
- `bonus.json`: actual bonus entrance, failed return, retry, eight-crate clear,
  reward banking and supported parent return.
- `recovery.json`: keyboard checkpoint warps and intentional below-course respawn.
- `packaged.json`: production build at MAX/native resolution, real menu selection,
  garage descent without jumping, checkpoint controls and pit recovery.
- `validation.json`: source hashes, required level/build/release checks, display
  settings, counts and release evidence.

The surface inventory tool is only an investigation aid: its coarse adjacency
graph ignores walls and jump mechanics. Passing that graph is not used as proof
of reachability. The controller checks and native-resolution review supply the
playability evidence.

## Reproduction

Run the repository's `check:levels` and `build` package scripts. Focused commands:

```sh
node tools/test-mayfield-mall.mjs --no-jump
node tools/test-mayfield-mall.mjs --skate
node tools/test-mayfield-access.mjs
node tools/test-mayfield-joins.mjs
node tools/test-mayfield-transitions.mjs
node tools/test-mayfield-parking.mjs
node tools/test-mayfield-bonus.mjs
node tools/mayfield-browser.mjs http://127.0.0.1:5278 --foot --no-jump
node tools/mayfield-browser.mjs http://127.0.0.1:5278 --native
node tools/mayfield-browser.mjs http://127.0.0.1:5278 --full --tour
node tools/mayfield-bonus-browser.mjs http://127.0.0.1:5278
node tools/review-mayfield-layout.mjs
```

Use `MAYFIELD_OUTPUT` for external reports, `MAYFIELD_BONUS_OUTPUT` for bonus
reports, and `MAYFIELD_URL` for the native layout review. Browser checks require
Chrome and Playwright. Use the shared heavy-job helper where coordination
capacity limits apply.
