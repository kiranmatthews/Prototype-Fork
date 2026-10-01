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
to a valley-floor finale, progressing along negative Z. The researched
architecture is retained on successive terraces. There is no hub, return leg or
carving turn between attractions; three vertical loops form the final challenge.

| Segment | Playable purpose | Spatial character |
| --- | --- | --- |
| Admission | Mount on the high deck, then descend from 80 to 60 m | Closed ticket buildings, lockers, ride signage and an overhead orange flume |
| Wave Pools | Three forward spine transfers, with each receiving rim 2 m lower | Four sunken concrete pools; radii 8/12/10/11 m, rims at 60/58/56/54 m, varied depths and widths |
| Mid-slope terrace | The final bowl curves into a spillway jump onto the 48 m catch deck; first checkpoint, then a long descent to 34 m | CYCLONE tower, a small dry fountain and closed arcade alongside the route |
| Dual Boomerang | Two forward spine transfers, then an integrated curved spillway jump | Three elevated orange fiberglass basins; radii 12/12/8 m, rims at 34/32/30 m, exposed curved steel supports |
| Dry Flume | Descend through the blue chute, launch across the open splash gap, then reach the coaster summit checkpoint | A continuous supported ride with a shaped receiving deck |
| Triple Deathloop | Earn speed on steep ramps, complete three 52 m inversions, and jump a 32 m ravine before the last loop | Braced loops descending into the valley, broad base crossings, a service return bank and a separate finish lane |

The hillside and retaining courts descend with the route. Side terraces support
the closed slide towers and give each attraction a recognizable setting without
requiring a detour. Local waterlogged service wells mark failed-jump hazards.

There is no start checkpoint. The first comes after the Wave Pools and first
large jump; the second comes after the flume, before the first coaster drop.
Supplies and checkpoints sit off the fast line. There are no speed pads. The
70 m first drop and 65 m final drop build real approach speed; the shorter
connecting descents preserve the flow between loops. All four coaster ramps
can be skated back uphill. A missed ravine jump lands on a service court with
a bank back to the launch, and the final drop can rebuild loop speed from rest.

## Camera and implementation

The distant 28 m follow and static loop overview volumes are removed. Ordered
camera nodes follow the real route and all launch headings. The normal lens
and 5.05 m trailing offset remain. Deadwater opts into full vertical follow for
its unusually large airs. That mode follows the rendered body through transfer poses and uses only the presentation pitch correction needed to keep it framed. During loop contact the same close framing rotates
with the actual tangent and inward normal; it remains separate from gameplay
controls and eases back on release/exit. The same close frame follows the steep
coaster roads so the camera stays above their surfaces, including while
re-climbing. Intermediate loop banners do not obstruct the next fast approach.

`waterpark-route.ts` owns core ride surfaces and measured route metadata.
`waterpark-art.ts` owns reusable architectural meshes and original sign lettering.
`waterpark.ts` composes those with the descending hillside, retaining terraces,
collectibles and straight camera lane. Flat-colour scenery omits regenerable normals
and unused UVs to remain within the existing editor/import budget.

Explicit solid road meshes may set `gravityTrack: true`. Gravity, ordinary
charge, friction and drag still supply the motion; the tag removes the normal
road-speed cap from that surface and its outgoing air. It never adds speed.
Other surfaces retain their existing rules. The finish requires all three
distinct loops, and death/checkpoint respawn clears that progress.

Analytic halfpipes own their opaque flat floors as well as their curved walls.
The final bowl in each set has a smooth, matching-colour exit built into its
profile, replacing the detached orange kickers. The second set's deepest bowl
is 12 m rather than 16 m, so charge can build useful clearance over the coping.

An air-owned X release cannot fire an immediate jump on landing, but holding X
now resumes the pump and crouch on pipe contact. A full new ground load rearms
the deliberate next ollie. Vert charge visibly folds the knees while keeping
both soles planted. A spine transfer gathers, rolls through wheels-down and
extends toward the receiving wall; rotation interpolation avoids the old
opposite-normal stall/snap. Shared per-segment elasticity supplies compression
and a finite rebound without altering the skeleton scale or movement tuning.

## Acceptance

- Adaptive controller tests must cross all five spines and all four gaps,
  complete all three loops, and reach the actual gate with no bails/deaths/resets.
- Every connecting descent must remain rideable while mounted; a checkpoint
  variant must activate both saved points through normal input. No steering
  reversal is required before the loop.
- Missing a service-well jump must recover at spawn before any checkpoint,
  and at the mid-slope terrace checkpoint afterward.
- Insufficient loop pressure must cause a real fall; crossing the exit lane
  after only two loops must not grant a finish.
- Each coaster ramp must be climbable from its lower end using normal input.
  A stationary retry must clear the final loop after descending its approach.
  With gravity disabled in the fixture, tagged roads must not create speed.
- A missed final gap must return via the service court and bank without death
  or checkpoint warping. Camera-to-rider rays must stay clear on the steep roads.
- A held-X run must cross all five spines without releasing to rearm the pump
  after landing. Charge-versus-coast trials from identical starting momentum
  must show greater height and repeated second-set coping clearance.
- Deep charge and transfer poses must preserve sole contact, remain visible
  in the close camera, and roll continuously through the transfer midpoint.
- Browser review uses the actual loaded character, normal fixed-step/render
  loop, visible rider geometry and console. Screenshots must show a close
  rider, readable landing surfaces and recognizable waterpark structures.
- Serialization, focused movement/camera checks, level checks and build must
  pass before publication. Global movement tuning is unchanged.
