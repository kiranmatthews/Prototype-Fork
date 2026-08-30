# Unity level ports

This pass ports six current Unity scenes into source-owned `CustomLevelData`.
The browser files remain editable through the same component pipeline as an
in-game authored level; imported Unity meshes do not own gameplay collision.

## Coordinate policy

- Unity courses authored along `+Z` are reflected to browser `-Z` with
  `(x, y, z)web = (x, y, -z)unity`.
- Unity side-view `+X` courses retain their coordinates and use an eastward
  travel zone.
- Finish gates, camera nodes, actors, ramps, rails and hazard volumes follow
  the same transform. World units remain approximately metres.

## Port map

| Browser level | Unity authority | Notes |
| --- | --- | --- |
| Beachside Run | `BeachfrontRun.unity` / `SourceLevelPortSceneBuilder.BeachfrontRun.cs` | Exact 740 m curve, seven four-island procedural boardwalk sequences, sand access joins, actors and deep-water band. |
| Bonus Level | `BonusLevel.unity` and partial builders | Seven supports, all 33 puzzle crates, lift, rail crossing, one-line containment and the registered four-layer parallax painting. |
| Coastal Street Run | `CoastalStreetRun.unity` and partial builders | All 23 road grades and four gaps, interactive street furniture and threats; minor trees, umbrellas and storefront garnish intentionally omitted. Beachside-style coast is placed on screen right. |
| Island Hopper | `IslandHopper.unity` / builder | Five four-ring sand shelves and one-draw animated foam, eleven source-topology timber/scaffold paths, exact jump joins, two snapping ropes, the MatrixRex ocean and authored actor rhythm. |
| Jungle Gate Run | `JungleGateRun.unity` / builder | Fourteen side-view platforms, two kickers, six thorn gaps, required grind rails, bounce crates and depth containment. Its level-local full ledge assist turns all six source-disabled receiving terraces into generous recovery catches without moving the rail/skate gaps; a normal Boing still cannot clear either Arrow climb. |
| MeshyLook Thorn Courtyards | `MeshyLookDev.unity` / `MeshyLookDevSceneBuilder.cs` | Four instances of the actual compressed Meshy stone courtyard, hidden deterministic ride hulls, visible thorn wells, eight ridge rails, a forward-looking +X camera, and code-native pulsing thorns. A web-only finish makes the Unity look-dev row a complete menu level. |

## Shared presentation

The `LOOK` tab owns one shared Unity-shaped presentation stack: an HDR Gaussian
bloom pyramid followed by colored vignette, exposure/tone mapping and a
change-driven 32³ LDR grading LUT. Coast, Bonus and Meshy source presets remain
global conveniences, not level-owned saved values; this intentionally leaves
room for per-level persistence later without maintaining multiple render
stacks. The source values, stage order, performance caps and diagnostics are
recorded in `docs/UNITY_VISUAL_TREATMENT.md`.

Bonus uses the four owner-supplied, registered 1672×941 layers in
`public/bonus-parallax/`. A camera-aligned compositor preserves the Unity
motion vectors, aspect-cover crop, smooth player-driven offset, warm-window
emission and ambient drift.

## Reusable coastal construction

Beachside and Island Hopper now share a palette-ready semantic wood-path kit.
The swept path remains one invisible collision authority while midpoint-spaced
boards own the visible deck. The kit separately describes every post,
crossbeam, ledger, side brace, cross-path brace, handrail post, top rail and
balustrade barrier. Today those descriptors feed one instanced board batch and
one instanced pole batch per path. Later textured board and pole meshes can be
chosen deterministically and fitted into the same envelopes without changing
the authored course or its collision.

Island Hopper uses the exact light-scaffold topology and its source plank
profile: 0.42 m deck, 0.68 m pitch, 0.038 m gap, 0.135 m boards, 0.10 m side
overhang, 1.65° yaw jitter, 5.5% scale jitter and 0.014 m vertical jitter.
Support bents are nominally 4.5 m apart and fall back to the authored
`y = -3.6` base, so shallow island sand no longer collapses the lattice into a
thin strip. The complete measured construction and water contracts are in
`docs/UNITY_ISLAND_HOPPER.md`.

Island Hopper's former flat sand slabs are four-ring radial shelves sharing
their visible and playable surface. Its former blue block is replaced by the
existing MatrixRex ocean renderer at the Unity sea level, and all five island
shore rings are combined into one animated transparent draw. Crates choose the
highest valid support at or immediately below their authored base before using
the legacy upward-repair path, preventing the lower sand shelf from stealing a
crate that belongs on the timber deck.

## Thorn fairness

The Meshy thorn artwork is procedural and visual-only. Each glowing cluster
keeps the source visual footprint (about `2.14 × 1.01 × 2.26 m`) while its
separate lethal core is only `1.15 × 1.25 m` in XZ and tops out just below the
deck. This removes the Unity version's roughly half-metre early kill on every
side while retaining luminous tips as readable warning.

## Deliberate approximations

- Coastal Street keeps every interactive route beat but reduces repeated
  boundary objects and fruit count for browser draw/update budgets.
- Island Hopper downsamples its dense 129-node camera spine to 17 ordered
  knots while retaining the same analytic curve.
- Island Hopper batches the five playable-island foam rings into one draw and
  omits the source's 18 distant sea-stack foam rings with the reduced distant
  rock dressing.
- Bonus's direct floating mask uses a mask crate until a standalone custom
  mask-pickup component is introduced.
- The actual Meshy courtyard now ships as a 127 KB visual-only GLB. Hidden
  procedural ride hulls keep browser collision deterministic; thorn geometry
  and its smaller lethal cores remain code-native.
