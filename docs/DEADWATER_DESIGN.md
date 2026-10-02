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

The course starts at a 130 m admission tower. A 60 m drop enters the left lane
of one 88 m-wide, 32 m-high quarterpipe. An angled air carries the rider right;
the right-hand descent feeds a broad receiving chute that turns around the
entry structure and joins the downhill line at 60 m. From there, the course
progresses along negative Z through the existing pools and three final loops.
This is one continuous route, with no hub or optional return leg.

| Segment | Playable purpose | Spatial character |
| --- | --- | --- |
| Giant vert | Drop from 130 to 70 m into the left lane; carry across one broad wall, then descend on the right into the receiving chute | A 32 m tiled wall, exposed supports, coping and a broad mouth narrowing into the next ride |
| Wave Pools | Three forward spine transfers, with each receiving rim 2 m lower | Four sunken concrete pools; radii 8/12/10/11 m, rims at 60/58/56/54 m, varied depths and widths |
| Mid-slope terrace | The final bowl curves into a spillway jump onto the 48 m catch deck; first checkpoint, then a long descent to 34 m | CYCLONE tower, a small dry fountain and closed arcade alongside the route |
| Dual Boomerang | Two forward spine transfers, then an integrated curved spillway jump | Three elevated orange fiberglass basins; radii 12/12/8 m, rims at 34/32/30 m, exposed curved steel supports |
| Dry Flume | Descend through the blue chute, launch across the open splash gap, then reach the coaster summit checkpoint | A continuous supported ride with a shaped receiving deck |
| Triple Deathloop | Earn speed on steep ramps, complete three 52 m inversions, and jump a 32 m ravine before the last loop | Braced loops descending into the valley, broad base crossings, fatal ground below and an enclosed finish court |

The hillside and retaining courts descend with the route. The surrounding ground
is lethal on contact, including below the loops and missed ravine jump. Scenic-only
spiral, funnel and overhead slides are removed; every remaining flume is a ride.
The finish has low visible parapets backed by 10 m invisible side and rear barriers,
with the supported floor extending beyond those barriers.

There is no start checkpoint. The first comes after the Wave Pools and first
large jump; the second comes after the flume, before the first coaster drop.
Supplies and checkpoints sit off the fast line. There are no speed pads. The
70 m first drop and 65 m final drop build real approach speed; the shorter
connecting descents preserve the flow between loops. All four coaster ramps
can be skated back uphill. A missed ravine jump now causes a death on the ground;
the former recovery court and bank are removed. The final drop can still rebuild
loop speed from rest when approached from its supported summit.

## Camera and implementation

The giant quarterpipe and its flat approach/receiving chute use the existing
competition `SkateChaseCamera`, including its calibrated wall swing and look
back down the wall during vert air. Surface metadata selects that rig through
takeoff and landing. A presentation overlay restores the underlying course
camera before each update, preserving movement and the course's input heading.
Frame-for-frame comparison against the competition rig verifies this reuse.
The steep entry drop retains its surface-following road shot. Returning from
vert air uses the wall's downhill input frame across its full width. This prevents
a left-side landing from selecting the nearby uphill camera lane. The receiving
chute reseeds the ordinary lane, and respawn clears the local return frame.

The distant 28 m follow and static loop overview volumes are removed. Ordered
camera nodes follow the real route and all launch headings. The normal lens
and 5.05 m trailing offset remain. Deadwater opts into full vertical follow for
its unusually large airs. That mode follows the rendered body through transfer poses and uses only the presentation pitch correction needed to keep it framed. During loop contact the same close framing rotates
with the actual tangent and inward normal; it remains separate from gameplay
controls and eases back on exit. Losing loop pressure throws the board and keeps
the body whole: a short loss-of-footing beat leads into a slower tumble. The camera
moves to the open side of the ribbon, tracks the rendered torso, and levels the
horizon. Carried momentum and gravity still determine where the rider lands; a
real lower ride can catch the fall, while terrain contact kills. The same close frame follows the steep
coaster roads so the camera stays above their surfaces, including while
re-climbing. Intermediate loop banners do not obstruct the next fast approach.

`waterpark-route.ts` owns core ride surfaces and measured route metadata.
`waterpark-art.ts` owns reusable architectural meshes and original sign lettering.
`waterpark.ts` composes those with the descending hillside, retaining terraces,
collectibles and an ordered camera lane through the opening turn and downhill route. Flat-colour scenery omits regenerable normals
and unused UVs to remain within the existing editor/import budget.

Explicit solid ride meshes and vert components may set `gravityTrack: true`. Gravity, ordinary
charge, friction and drag still supply the motion; the tag removes the normal
road-speed cap from that surface and its outgoing air. It never adds speed.
On tagged vertical surfaces, the rider heading is transported through the surface
frame so an angled climb preserves lateral carry rather than collapsing into a
sideways skid. Other surfaces retain their existing rules. The finish requires all three
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
- The giant wall must launch from its left lane, catch on its right and feed the
  next ride without bailing. Every connecting descent remains mounted; the
  checkpoint variant activates both saved points through normal input.
- Missing a service-well jump must recover at spawn before any checkpoint,
  and at the mid-slope terrace checkpoint afterward.
- Insufficient loop pressure must cause a real fall; crossing the exit lane
  after only two loops must not grant a finish.
- Each coaster ramp must be climbable from its lower end using normal input.
  A stationary retry must clear the final loop after descending its approach.
  With gravity disabled in the fixture, tagged roads must not create speed.
- A missed final gap must die on terrain. Full-speed approaches to the three
  exposed finish edges must stay inside the supported court. Camera-to-rider
  rays must stay clear on the steep roads.
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

## Recovered competition

The most recent pre-linear layout is separately available as `waterpark-cup`,
Deadwater Cup. Its source provenance and competition adaptation are recorded in
[DEADWATER_CUP.md](DEADWATER_CUP.md). The linear course retains its `waterpark`
identity, progress and original map position.
