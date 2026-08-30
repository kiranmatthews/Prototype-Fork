# Unity Coastal Street Run web port

Coastal Street Run is a source-owned `CustomLevelData` reconstruction of the
current Unity scene. Gameplay geometry remains editor-native; the town, road
paint, sand and ocean are presentation layers around that same deterministic
route.

## Source authority

The measurements and saved material values come from:

- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Editor/SourceLevelPortSceneBuilder.CoastalStreetRun.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Editor/SourceLevelPortSceneBuilder.CoastalStreetRun.Threats.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Scenes/CoastalStreetRun.unity`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Data/SourceLevelPorts/CoastalStreet_*.mat`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Editor/Tests/CoastalStreetRunSceneEditorTests.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Tests/PlayMode/CoastalLevelRuntimeSmokePlayModeTests.cs`

Unity's `+Z` course is reflected to the browser's `-Z` corridor without
mirroring X. Houses therefore remain on negative X/screen left and the coast
remains on positive X/screen right.

## Route and street structure

The web level retains all 23 source road intervals from Unity Z `-30` through
`3030`, including the full 13m vertical range and the four open gaps at
`430-441`, `900-912`, `1810-1823` and `2680-2694`. The road is 12m wide and
0.85m thick. Each interval has two 1.3m shoulders centered at `x = ±6.55m`,
for 46 shoulders total, and shoulders stop at every gap.

Town and canal walls follow every grade at `x = ±7.2m`. The town wall rises
1.05m above the road. The canal wall meets the road top and extends toward the
source `-3.36m` base. Ten continuous boundary grind paths replace Unity's 46
per-slab rail objects while preserving the same five gap-separated blocks;
their source heights are road `+1.22m` on the town side and `+0.95m` on the
water side.

The saved source road and shoulder materials are plain lit colors, not an
asphalt image. A reusable `solid` surface kind supplies a neutral white map so
the saved palette can light normally without generated cracks, aggregate or
repeating lane stripes. Source-yellow route paint is separate: 99 graded,
three-piece arrows plus the start stripe. START and seven district labels are
retained as source metadata for a future world-text presentation, but are not
currently rendered.

All ten stair sets keep the source smooth 12m approach bank, raised 4m
terrace, seven descending steps and centered handrail. Crates vacate the side
reserved by nearby stairs, climbs and box ledges, and route fruit uses Unity's
gap-safe spacing rule.

## Left-side town

`src/coastalStreetKit.ts` is a Three-free descriptor generator in Unity source
coordinates. It records the seven district palettes, 46 shoulders, route
paint, and all 64 houses. Every house keeps the source formula for district,
height, depth and lateral setback, and describes these visual-only pieces:

- one colored body;
- one alternating `±3.5deg` roof;
- three dark unlit facade windows;
- one `-6deg` colored awning;
- one warm trim door.

The level exposes houses and arrows as ordinary `decor` components, so they
survive validation, capture and editor round trips. During play the runtime
merges geometry by semantic role and palette; the editor leaves components
individually selectable. Those role/palette descriptors are also the intended
replacement seam if textured house meshes are introduced later.

## Actors and optional lines

The rebuilt data carries the source 52 ordinary crates, 160 fruit, 36 climb
platforms, six checkpoints, eleven speed pads and sixteen enemies. Gap ramp,
rail and fruit alternatives retain their authored side switching. Camera nodes
now include every road-grade boundary in addition to the compact regular
spine, preventing long interpolation from overlooking a grade transition.

## Screen-right coast

The former generic sand strip, blue metal water slab and broad submerged pit
have been removed. `CustomLevelData.ocean` now instantiates the shared
MatrixRex renderer with the exact reflected Coastal source values:

| Value | Coastal Street |
| --- | ---: |
| shoreline midpoint | `[9.2, -0.36, -1500]` |
| length | `3400m` |
| open-water side | `+X` / screen right |
| width | `180m` |
| land overlap | `4m` |
| subdivisions | `160×128` |

The sand preserves Unity's `DistantBeach` footprint at
`[55, -0.78, -1500]`, size `[70, 0.8, 3300]`, but intentionally uses the nice
MatrixRex Beachfront material treatment requested for this port.
`src/unitySandMaterial.ts` is shared with that presentation and owns the same
color, normal and mask maps, 5.4m metric UV repeat, 0.5 normal scale and
MatrixRex green-channel AO lookup.
The sand is visual-only. The graded canal wall and `killY = -6m` retain course
containment without inventing water gameplay.

## Deliberate reductions

The runtime still combines repeated boundary rails and omits the source's small
lamps, palms, planters, surfboards, docks, cloud banks and district landmarks.
These omissions do not replace or reduce the road, stairs, house rhythm, actor
counts or coast treatment.

## Verification contracts

- `tools/test-coastal-street-kit.mjs` checks descriptor counts, source formulas,
  grade-aligned arrows, house pieces and palette values.
- `tools/test-unity-sand-material.mjs` checks the three registered maps, color
  spaces, 5.4m metric UVs, AO swizzle and lifecycle ownership.
- `tools/test-unity-level-ports.mjs` checks source counts, exact ocean/sand data,
  flat road treatment and removal of the fake water slab.
- `tools/validate-editor-roundtrip.mjs` checks editor persistence, runtime sand,
  batched facade roles, water geometry and crate seating.
- Final browser review covers spawn and checkpoint views in full and `?lite`
  modes, screen-left houses, screen-right animated coast, road legibility,
  console output and repeated level switching.
