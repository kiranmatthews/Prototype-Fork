# Deadwater Park — rebuilt layout

The first version was a repeated ramp test with an excessively distant camera.
This rebuild treats the space as an abandoned waterpark and keeps the rider at
the ordinary gameplay scale.

## Reference checked

Activision's [official Waterpark guide](https://www.tonyhawkthegame.com/blog/2025/03/tony-hawk-pro-skater-three-plus-four-launch-map-guide-waterpark)
and its actual screenshots were inspected before authoring. The useful spatial
ideas are the drained river around a courtyard, connected pedestrian decks,
bridges, and giant perimeter rides supported by towers and exposed structure.
The [river view](https://www.tonyhawkthegame.com/content/dam/atvi/tony-hawk/blog/chicago/launch-map-guide-watermark/THPS-WATERPARK-002.jpg)
and [ride view](https://www.tonyhawkthegame.com/content/dam/atvi/tony-hawk/blog/chicago/launch-map-guide-watermark/THPS-WATERPARK-006.jpg)
are the main references. These are editorial overview images; they were not
used as gameplay camera settings. The new waterpark architecture is original source-owned
mesh geometry.

## Route and decisions

The main route runs around three sides of a shared courtyard and returns near
the entrance. Each segment has an architectural role and a different silhouette.

| Segment | Playable purpose | Spatial character |
| --- | --- | --- |
| Admission | Supported approach, room to mount and align | Closed ticket buildings, lockers, a low ride sign and an overhead orange flume |
| Wave Pools | Three forward spine transfers | Four sunken concrete pools; radii 8/12/10/14 m, common 12 m coping, varied depths and widths |
| Concourse | First 18 m gap, broad 25 m carving turn, optional checkpoint/arcade | Catch terrace connecting the west promenade to the north side of the courtyard |
| Dual Boomerang | Two eastward spine transfers and an unpowered 14 m gap | Three elevated orange fiberglass basins, radii 12/16/10 m, common 18 m coping and exposed curved steel supports |
| Dry Flume | Descending blue chute, powered kicker and 20 m splash jump | A continuous supported ride, with its launch gap visibly open |
| Deathloop | Maintain speed/charge through a 52 m inversion | A braced coaster structure with a loading station, separate exit lane and required-loop finish |

The central lazy river is rideable secondary space. Its bridges have raised
spans and ramped approaches so a rider and close camera can pass underneath.
The island contains a dry fountain, banks, palms, planters and closed slide
towers. Local waterlogged service wells mark failed-jump hazards; the park sits
on actual ground rather than a rectangular death carpet.

There is no start checkpoint. The first comes after the Wave Pools and first
large jump; the second comes after the flume, before the loop. Supplies and
checkpoints sit off the fast line. Only two big-jump launch rollers and the
loop launch motor provide authored boosts; ordinary basins use the existing
skating/charge physics.

## Camera and implementation

The distant 28 m follow and static loop overview volumes are removed. Ordered
camera nodes follow the real route and all launch headings. The normal lens
and 5.05 m trailing offset remain. Deadwater opts into full vertical follow for
its unusually large airs. That mode follows the rendered body through transfer poses and uses only the presentation pitch correction needed to keep it framed. During loop contact the same close framing rotates
with the actual tangent and inward normal; it remains separate from gameplay
controls and eases back on release/exit.

`waterpark-route.ts` owns core ride surfaces and measured route metadata.
`waterpark-art.ts` owns reusable architectural meshes and original sign lettering.
`waterpark.ts` composes those with terrain, the courtyard, river, bridges,
collectibles and camera lane. Flat-colour scenery omits regenerable normals
and unused UVs to remain within the existing editor/import budget.

## Acceptance

- Adaptive controller tests must cross all five spines and all three gaps,
  complete the loop, and reach the actual gate with no bails/deaths/resets.
- A fast variant must remain mounted through both broad turns; a checkpoint
  variant must activate both saved points through normal input.
- Missing a service-well jump must recover at spawn before any checkpoint,
  and at the banked concourse checkpoint afterward.
- Insufficient loop pressure must cause a real fall; crossing the exit lane
  directly must not grant a finish.
- Browser review uses the actual loaded character, normal fixed-step/render
  loop, visible rider geometry and console. Screenshots must show a close
  rider, readable landing surfaces and recognizable waterpark structures.
- Serialization, focused movement/camera checks, level checks and build must
  pass before publication. Global movement tuning is unchanged.
