# Unity level ports

This pass covers six current Unity scenes. Five remain source-owned
`CustomLevelData`; Beachside Run now composes its component-authored gameplay
overlay with the already-audited Unity sand/ocean/post runtime. Imported Unity
meshes never own gameplay collision.

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
| Beachside Run | `BeachfrontRun.unity` / `SourceLevelPortSceneBuilder.BeachfrontRun.cs` | One consolidated level: exact 371×65 sand, curved MatrixRex ocean/post stack and dense camera spine; seven continuous procedural boardwalk runs, source actors, separate coast/cliff collision, and 150 instances of the aggressively compressed Stonecliff Bastion mesh. |
| Bonus Level | `BonusLevel.unity` and partial builders | Seven supports, all 33 puzzle crates, lift, rail crossing, one-line containment and the registered four-layer parallax painting. |
| Coastal Street Run | `CoastalStreetRun.unity` / `SourceLevelPortSceneBuilder.CoastalStreetRun.cs` | Exact 23-grade road, four gaps, 46 shoulders, source-count actors, 64-house left-side town rhythm and painted route arrows. The screen-right coast uses the authored 3.4 km MatrixRex ocean layout and the shared Beachside sand material instead of the former blue slab/procedural-sand approximation. |
| Island Hopper | `IslandHopper.unity` / builder | Five four-ring sand shelves and one-draw animated foam, eleven source-topology timber/scaffold paths, exact jump joins, two snapping ropes, the MatrixRex ocean and authored actor rhythm. |
| Jungle Gate Run | `JungleGateRun.unity` / builder | Fourteen side-view platforms, two kickers, six thorn gaps, required grind rails, bounce crates and depth containment. Its level-local full ledge assist turns all six source-disabled receiving terraces into generous recovery catches without moving the rail/skate gaps; a normal Boing still cannot clear either Arrow climb. |
| MeshyLook Thorn Courtyards | `MeshyLookDev.unity` / `MeshyLookDevSceneBuilder.cs` | Four instances of the actual compressed Meshy stone courtyard, hidden deterministic ride hulls, visible thorn wells, eight ridge rails, a forward-looking +X camera, and code-native pulsing thorns. A web-only finish makes the Unity look-dev row a complete menu level. |

The Unity bonus above is retained as the original challenge/reference. Campaign bonus platforms now use the shorter, easier `src/levels/bonus-easy.ts` course (18 crates and two short gaps); see `docs/BONUS_FLOW.md`.

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

## Beachside consolidation

The former `Unity Beachfront Run` and approximate `Beachside Run` menu rows are
one canonical `beachfront` level now, displayed as **Beachside Run**. Legacy
`beachside-run` selections resolve to that id. The duplicate terrain ribbon,
eleven blue metal ocean slabs, broad pit blocks, seventeen procedural rocks
and coarse camera lane were removed; the level retains the exact 740m Unity
course, 371×65 textured sand/depth surface, 821-row tailed MatrixRex ocean,
149-node camera/control lane, 43° lens and Coast post treatment.

The seven boardwalk sequences are seven continuous `woodpath` components, not
28 independently restarted islands. Each path keeps all sixteen source route
knots but carries collision, plank phase, scaffold bays, braces, balustrades
and both grind rails continuously through the former 3/4/5m holes. Sequence
deck tops use Unity's exact 13×13 footprint probe and sit at 4.58–4.75m; both
ends ease down to exact sand +0.18m. Support rays ignore earlier wood paths and
terminate only on terrain, with the authored four-metre fallback base.

The inland wall uses all 2,270 triangles of the owner-supplied Stonecliff
Bastion, indexed and packed with one 512px JPEG into a 158KB decoder-free GLB.
One shared geometry/material supplies the exact 100 primary and 50 staggered
Unity transforms in fifteen cullable chunks. The mesh is visual-only: a curved
continuous proxy remains collision authority. Full measurements, hashes and
the reproducible bake live in `public/beachfront/README.md`.

## Coastal Street parity

Coastal Street's route remains the 3.06 km Unity source corridor: 23 joined
road grades, four true collision gaps, 46 road-following shoulders, town and
canal containment walls, and boundary rails at the source `x = ±7.2m`
lines. The road now uses the saved Unity concrete/shoulder palette through an
unpatterned `solid` surface mode. This removes the invented black asphalt,
cracks and repeating parking stripe. Ninety-nine three-piece arrows and the
start stripe follow the road grade as visual-only editor components.

The left side now contains all 64 source house modules. Body, pitched roof,
three windows, awning and door remain separately described by semantic role
and palette in `src/coastalStreetKit.ts`, then merge by role/material during
play. This keeps the source variation and future mesh-replacement seams while
avoiding hundreds of scenery draw calls. The route also restores the ten
complete bank/terrace/seven-step stair sets, 36 climb platforms, 52 ordinary
crates and 160 fruit; the six checkpoints, eleven boosts and sixteen enemies
were already present.

The right side no longer uses a blue metal platform or generic procedural
sand. Its straight MatrixRex ocean is authored at `y = -0.36m`, 3,400m long,
180m wide, with 4m shore overlap and a 160×128 grid. The source sand footprint
uses the same registered color, normal and green-channel AO maps as Beachside,
with the same metric 5.4m UV repeat. Exact measurements, remaining reductions
and validation contracts are recorded in `docs/UNITY_COASTAL_STREET.md`.

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

- Beachside deliberately joins Unity's four jump islands in each boardwalk
  sequence into one uninterrupted construction, following the explicit web
  brief. Small huts, palms, benches and route dressing remain omitted.
- Coastal Street combines Unity's 46 per-slab boundary rails into ten
  continuous rails over the same five gap-separated road blocks. Small lamps,
  palms, planters, surfboards, cloud banks and district landmarks remain
  deliberately omitted; source-count stairs, houses, climb platforms, fruit
  and crates are no longer reduced.
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
