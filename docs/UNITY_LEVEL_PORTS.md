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
| Island Hopper | `IslandHopper.unity` / builder | Five sand islands, eleven joined procedural timber paths, exact jump joins, two snapping ropes and the authored actor rhythm. |
| Jungle Gate Run | `JungleGateRun.unity` / builder | Fourteen side-view platforms, two kickers, six thorn gaps, required grind rails, bounce crates and depth containment. |
| MeshyLook Thorn Courtyards | `MeshyLookDev.unity` / `MeshyLookDevSceneBuilder.cs` | Four instances of the actual compressed Meshy stone courtyard, hidden deterministic ride hulls, visible thorn wells, eight ridge rails, a forward-looking +X camera, and code-native pulsing thorns. A web-only finish makes the Unity look-dev row a complete menu level. |

## Shared presentation

The `LOOK` tab owns exposure, contrast, saturation, color filter, local bloom
and vignette in one fullscreen pass. Coast, Bonus and Meshy source presets are
global conveniences, not level-owned saved values; this intentionally leaves
room for per-level persistence later without maintaining multiple render
stacks.

Bonus uses the four owner-supplied, registered 1672×941 layers in
`public/bonus-parallax/`. A camera-aligned compositor preserves the Unity
motion vectors, aspect-cover crop, smooth player-driven offset, warm-window
emission and ambient drift.

## Thorn fairness

The Meshy thorn artwork is procedural and visual-only. Each glowing cluster
keeps the source visual footprint (about `2.14 × 1.01 × 2.26 m`) while its
separate lethal core is only `1.15 × 1.25 m` in XZ and tops out just below the
deck. This removes the Unity version's roughly half-metre early kill on every
side while retaining luminous tips as readable warning.

## Deliberate approximations

- Beach and island water use a blue presentation surface with a submerged
  death volume rather than instantiating another ocean renderer per level.
- Coastal Street keeps every interactive route beat but reduces repeated
  boundary objects and fruit count for browser draw/update budgets.
- Island Hopper downsamples its dense 129-node camera spine to 17 ordered
  knots while retaining the same analytic curve.
- Bonus's direct floating mask uses a mask crate until a standalone custom
  mask-pickup component is introduced.
- The actual Meshy courtyard now ships as a 127 KB visual-only GLB. Hidden
  procedural ride hulls keep browser collision deterministic; thorn geometry
  and its smaller lethal cores remain code-native.
