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

The main route runs straight down a hillside from an 80 m admission tower
to a ground-level finale, progressing along negative Z. The researched
architecture is retained on successive terraces. There is no hub, return leg or
carving turn between attractions; the vertical loop is the final challenge.

| Segment | Playable purpose | Spatial character |
| --- | --- | --- |
| Admission | Mount on the high deck, then descend from 80 to 60 m | Closed ticket buildings, lockers, ride signage and an overhead orange flume |
| Wave Pools | Three forward spine transfers, with each receiving rim 2 m lower | Four sunken concrete pools; radii 8/12/10/14 m, rims at 60/58/56/54 m, varied depths and widths |
| Mid-slope terrace | Charged vault onto a 48 m catch deck; first checkpoint, then a long descent to 34 m | CYCLONE tower, a small dry fountain and closed arcade alongside the route |
| Dual Boomerang | Two forward spine transfers, then another charged vault | Three elevated orange fiberglass basins; radii 12/16/10 m, rims at 34/32/30 m, exposed curved steel supports |
| Dry Flume | Descend through the blue chute, launch across the open splash gap, then roll down to ground level | A continuous supported ride with a shaped receiving deck |
| Deathloop | Maintain speed/charge through a 52 m inversion, then continue forward to the finish | A braced coaster at the foot of the hill, loading station and separate exit lane |

The hillside and retaining courts descend with the route. Side terraces support
the closed slide towers and give each attraction a recognizable setting without
requiring a detour. Local waterlogged service wells mark failed-jump hazards.

There is no start checkpoint. The first comes after the Wave Pools and first
large jump; the second comes after the flume, before the loop. Supplies and
checkpoints sit off the fast line. All five spines and three jumps use gravity
and the existing skating/charge physics. The only authored boost is the final
loop launch motor.

## Camera and implementation

The distant 28 m follow and static loop overview volumes are removed. Ordered
camera nodes follow the real route and all launch headings. The normal lens
and 5.05 m trailing offset remain. Deadwater opts into full vertical follow for
its unusually large airs. That mode follows the rendered body through transfer poses and uses only the presentation pitch correction needed to keep it framed. During loop contact the same close framing rotates
with the actual tangent and inward normal; it remains separate from gameplay
controls and eases back on release/exit.

`waterpark-route.ts` owns core ride surfaces and measured route metadata.
`waterpark-art.ts` owns reusable architectural meshes and original sign lettering.
`waterpark.ts` composes those with the descending hillside, retaining terraces,
collectibles and straight camera lane. Flat-colour scenery omits regenerable normals
and unused UVs to remain within the existing editor/import budget.

## Acceptance

- Adaptive controller tests must cross all five spines and all three gaps,
  complete the loop, and reach the actual gate with no bails/deaths/resets.
- Every connecting descent must remain rideable while mounted; a checkpoint
  variant must activate both saved points through normal input. No steering
  reversal is required before the loop.
- Missing a service-well jump must recover at spawn before any checkpoint,
  and at the mid-slope terrace checkpoint afterward.
- Insufficient loop pressure must cause a real fall; crossing the exit lane
  directly must not grant a finish.
- Browser review uses the actual loaded character, normal fixed-step/render
  loop, visible rider geometry and console. Screenshots must show a close
  rider, readable landing surfaces and recognizable waterpark structures.
- Serialization, focused movement/camera checks, level checks and build must
  pass before publication. Global movement tuning is unchanged.
