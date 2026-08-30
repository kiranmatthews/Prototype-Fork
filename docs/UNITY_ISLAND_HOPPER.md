# Island Hopper web reconstruction

This document records the measured contracts used to reconstruct
`IslandHopper.unity` and
`SourceLevelPortSceneBuilder.IslandHopper.cs`. Gameplay geometry stays
source-owned `CustomLevelData`; presentation systems consume that data without
becoming collision authority.

## Course authority

The browser retains the source's five platform runs, four joined walks and two
ramp launches. All eleven are `woodpath` components following the 384 m
analytic S-curve. Platform/walk joins overlap by 0.8 m; each walk/ramp join
overlaps by 0.45 m. The two launches rise 1.7 m and preserve the 4.9 m and
5.93 m landing gaps. Two snapping rope crossings, 20 crates, three checkpoints
and 49 fruit retain the source distances and lateral rhythm.

The dense Unity camera spine has 129 points. The web level uses 17 ordered
24 m knots over the same analytic curve, the one deliberate route-data
reduction.

## Semantic timber construction

`src/woodPathKit.ts` is a pure layout kernel. Given a distance-addressed path
sampler, it emits:

- fitted plank envelopes with deterministic variant and tonal indices;
- scaffold bents and semantic pole envelopes;
- dense balustrade barriers; and
- left/right grind polylines.

It does not create Three.js meshes or collision. `Level` renders fallback
boards and seven-sided poles as instanced batches and constructs collision
from the independent swept deck, support posts and balustrade barriers. The
swept deck writes no colour or depth; only midpoint-spaced boards present its
top. This is the source separation and removes the previous coplanar aliasing.

Every Island path uses these source values:

| Contract | Value |
| --- | ---: |
| Deck thickness | 0.42 m |
| Path sampling target | 0.35 m |
| Plank pitch | 0.68 m |
| Plank gap | 0.038 m |
| Plank thickness | 0.135 m |
| Plank overhang | 0.10 m per side |
| Yaw jitter | ±1.65° |
| Scale jitter | ±5.5% |
| Vertical jitter | ±0.014 m |
| Bent spacing | 4.5 m nominal |
| Deck-side inset | 0.34 m |
| Crossbeam overhang | 0.48 m |
| Post / crossbeam radius | 0.115 / 0.09 m |
| Ledger / brace radius | 0.072 / 0.055 m |
| Handrail height | 1.05 m |

Plank count is `ceil(pathLength / 0.68)`. The actual pitch divides the whole
path evenly and each board is sampled at `(index + 0.5) * actualPitch`, never
at an endpoint. Its visible depth is `actualPitch - 0.038`, adjusted by the
same small seeded scale variation as Unity.

For each scaffold bent, the structural top is below the deck by
`deckThickness + crossbeamRadius`. Two posts meet that underside, one
crossbeam spans them with 0.48 m overhang, and two handrail posts rise from the
outer deck edges. Each bay adds left/right longitudinal ledgers, alternating
same-side diagonal braces, and two cross-path braces running between the 30%
and 70% heights of opposing posts. This last pair is intentionally
three-dimensional; joining only the four post tops was the vertically
collapsed web approximation.

Top-rail artwork is segmented at no more than 1.15 m. Balustrade collision is
separate, 1 m high and 0.14 m thick, with 0.08 m overlap at no more than 0.7 m
spacing. Both full sampled top edges remain grindable.

The Island support probe begins below the under-deck structure, matching the
Unity ray origin. If it finds no lower ground, feet use absolute world
`y = -3.6`. This embeds full-height supports through shallow shelves rather
than stopping every post at the nearby 0.68 m sand ring.

### Future textured parts

`plankPalette` and `polePalette` currently identify the fallback batches.
Every semantic piece already carries a fitted center, orientation, size, role,
seeded variant index and tonal bucket. A future palette loader should normalize
each candidate mesh's pivot, native axes and local bounds, then fit it into that
envelope. It must not add colliders or recalculate topology: mesh selection is
presentation-only, while the swept deck, barriers and support proxies remain
the stable gameplay authority.

## Four-ring sand shelves

Each island uses one center vertex and four 48-segment radial rings. The center
is at `y = 0.72`. Ring radius scales are `0.46`, `0.78`, `1.0` and `1.2`; base
heights are `0.68`, `0.48`, `seaLevel + 0.08` and `-1.12`. Island phase is
`islandIndex * 1.73`.

For angle `a`, the radial outline multiplier is:

```text
1 + 0.055 sin(3a + phase) + 0.032 sin(7a - 0.6 phase)
```

The inner three ring heights also add:

```text
0.055 sin(5a + phase) + 0.025 cos(9a - phase)
```

The outer submerged skirt remains exactly `y = -1.12`. One shared mesh owns
the visible sloping sand and ground raycasts, so the artwork and playable shelf
cannot drift apart.

## MatrixRex ocean and shore foam

The level's `ocean` data instantiates the existing MatrixRex-derived
`UnityOcean` renderer rather than a flat coloured block. The source contract is
sea level `-0.36`, shoreline midpoint `(106, -0.36, 168)` before the web Z
reflection, 500 m length, 220 m width, 6 m shore overlap and 128 × 128 source
subdivision targets. The source ocean is visual-only—falling below the level's
`killY = -2.65` owns death—while reflection, refraction, Gerstner displacement,
caustics and depth intersection remain presentation-only.

Five 72-segment shoreline ovals are combined into one indexed geometry and one
transparent shader draw. For each angle `a` and foam phase
`islandIndex * 2.19`:

```text
wave = 1 + 0.045 sin(4a + phase) + 0.022 sin(9a - phase)
inner radius = 1.01 * wave, y = seaLevel + 0.035
outer radius = 1.105 * wave, y = seaLevel + 0.040
```

The source look is RGBA `(0.88, 0.98, 1.0, 0.78)`, pulse speed `0.58`, pulse
amount `0.42`, detail frequency `4.8` and edge power `0.62`. The shader animates
opacity and brightness without rebuilding geometry. Lite/full modes retain a
single foam draw.

The Unity scene also places foam around 18 distant sea stacks. Those rings are
intentionally omitted with the web port's reduced distant rock dressing; the
five playable island shorelines are the required traversal read.

## Crate seating

Crates are authored at the timber base height `y = 1.05`. A downward query can
see both that deck and the sand beneath it. Seating therefore chooses the
highest eligible surface at or no more than 0.05 m above the authored base,
within the normal 0.6 m drop band. Only when no ordinary support exists does it
choose the lowest eligible upward repair, capped at 4 m for legacy flattened
captures. Thus the 1.05 m wood deck wins over 0.68 m sand, while the historical
editor-repair behavior remains available.

## Regression coverage

- `tools/test-wood-path-kit.mjs` locks source profiles, seeded jitter,
  topology/member counts, non-collapsed cross braces, support probes,
  balustrades and palette-invariant transforms.
- `tools/test-island-shelf.mjs` locks all four radial rings and perturbations.
- `tools/test-island-shore-foam.mjs` locks the five-ring one-draw batch,
  animation values and disposal.
- `tools/test-crate-rest-surface.mjs` locks the elevated-deck-over-sand case.
- `tools/test-unity-level-ports.mjs` locks the level data, ocean, foam and
  source construction profile.
