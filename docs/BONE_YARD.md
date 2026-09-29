# Modular wipeouts

Bone Man now loses existing modular body parts during recoverable bails and fatal hits:

- **Head pop:** a fast frontal high-wall or clothesline hit knocks the skull away while the body rebounds.
- **Waist split:** low walls, crate trips and crossbar trips send the upper body forward. The lower body and discarded board stay near the trip.
- **Loose limbs:** sideways wipeouts scatter the head, arms and lower legs around the existing tumble.
- **Yard sale:** fatal hits and some airborne wipeouts separate nine groups, including the hands. A fatal hit during an existing breakup keeps the pieces already in flight.

Each incident varies launch, spin and rebound using a separate cosmetic random stream. The existing editable Bail/Death elasticity and flailing continue beneath the detached joints. Parts bounce, slow down and sleep. Recoverable pieces arc back to the current animated pose in a staggered 0.24–0.58 second sequence; the head docks last. Deaths keep their pieces until respawn. Existing lives, checkpoints, collision envelopes, movement, mash recovery, rescue behavior and gameplay RNG remain authoritative.

Open **Bone Yard · Wipeout Playground** from the level list, or use `?playtest&level=bone-yard`. Hold the ordinary skate charge to get rolling. The left run-up feeds a high wall; the right feeds a shin-height trip. Crossbars follow. The centre lane bypasses those obstacles, and the yellow bridge on the left bypasses the fatal pit. There are two checkpoints and a finish gate. This is an optional source-owned level, not a new campaign requirement.

## Cost and ownership

`src/character/breakApart.ts` temporarily transforms the existing semantic joints after the complete gameplay step. It restores the exact local pose before the next step. It does not clone geometry, materials or skeletons, add draw calls, reparent bones, run a constraint solver, or change the shared movement tuning. Existing render interpolation and rigid-mesh palettes continue to work.

Nine groups is the maximum. One impact broadphase retains at most 32 nearby ground meshes and 48 wall boxes. At most two downward rays run per tick for the whole effect. Floor contacts are cached between probes, with support invalidation for removed/crumbling surfaces and periodic checks for sleeping pieces. Fragment collision uses approximate spheres and wall faces; it never becomes player collision. No per-frame vertex or skin scans are added. The initial head/foot/hand envelope comes from cached visible geometry bounds, including character proportions.

In the local desktop Chrome review, measured effect work averaged approximately **0.07–0.17 ms per fixed step** across the four styles in lite/full rendering. These are local samples, not a device-independent FPS guarantee. The renderer retained all eight character batches / 42 sources (34 saved draws per pass).

## Validation and review

`check:bail-recovery` includes `tools/test-break-apart.mjs`. It exercises real high/low impacts, frame-exact movement and gameplay RNG parity, finite reassembly, slow scrapes, fatal sleeping, support removal, reset cleanup and a continuous 833-frame playground bypass through both checkpoints and the finish. It also checks fatal-pit respawn. Existing recovery, rescue, death-performance/life-accounting, elasticity, batching and interpolation checks pass.

The local-only `bone-yard-review.html?playtest&level=bone-yard&lite` provides reproducible collision starts, freeze/step controls, front/side/quarter views and measured effect cost. Repeat without `lite` for the full pipeline. `tools/test-break-apart-browser.mjs` checks all four styles, records reassembly midpoints and checks the console in both rendering modes. The review page is excluded from the production build.
