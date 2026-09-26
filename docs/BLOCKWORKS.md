# Blockworks · Greybox

Source: `src/levels/codex-lab.ts`, with curved solids in
`src/levels/blockworks-geometry.ts`. The level ID remains `codex-lab` and its
map position remains **Island Hopper → Blockworks → Jungle Gate**.

## Route and controls

The course now follows a 2.38 km continuous physical curve through eight
connected districts. Its station coordinate is northward progress, not
arclength: a ten-station gap on a diagonal bend can be considerably longer
than ten world metres. Distances and jumps are verified in the complete world.

The ordinary camera follows the rider's position but keeps a north-facing
control chord. It does not turn the controls along the road. The skater must
carve the visible bends; holding forward alone leaves the opening road.
There are no travel zones or camera-framing volumes and no right-angle course
junctions. Puzzle exploration retains that same stable frame. Live crate lids participate
in the presentation floor probe so the camera and landing marker use the
steel deck height instead of the buried ground beneath it; the movement
ground probe and teeter rules are unchanged.

Closed sampled mesh ribbons give the road its actual curved footprint,
variable width, ramps and retaining mass down to the shared -12 m ground.
Invisible wallpath shells use those same edges for side and end collision.
Roof buildings use a solid collision volume beneath visible 2.4 m modules.
Adjacent mesh chunks share binary-grid vertices and smooth top normals.

## Gameplay progression

| District | Main sequence |
| --- | --- |
| Sweeping entry | Real carving, inside bank and stepped roof option, turtle/outer-line choice, charged gap or outside rail |
| Terrace canyon | Four offset roof bays, high curved roof, spiker/parapet choice, a natural rail landing, long curved descent |
| Frozen bends | Short low-grip carries separated by dry bends, then a committed launch into the aqueduct approach |
| Curved aqueduct | Swept transition wall, bank-to-coping carry, raised departure and curved rail-to-rail transfer |
| Switch foundry | Read two visible choices: lower reward/bonus branch or access stair; the upper switch constructs the main crossing |
| Rail and machinery | Curved approach, returning freight deck, short loading lift and upper roof; an early high grind offers a faster route |
| Roof relay | Spend elevation through a descending bend, ice, a gap, grunt line choice, kicker, turtle and parapet |
| Crown sweep | Last sustained curve and ice launch, three roof climbs, a returning finish grind and gate |

The key puzzle uses three independent groups. The right key builds a safe
lower reward perch with a mask and optional bonus entrance; it does not open
the main crossing. The left key builds the stair to the upper key. The upper
key builds the curved high crossing. Each steel deck materializes together
with supporting legs on permanent footings below the hazard surface.

## Checkpoints

There are six checkpoints, after meaningful completed sequences:

| Station | Sequence completed |
| ---: | --- |
| 422 | Opening and courtyard roofs |
| 750 | Frozen bends and charged gap |
| 1030 | Aqueduct wall/coping and rail transfer |
| 1280 | Foundry construction puzzle |
| 1550 | Machinery and upper-roof approach |
| 1910 | Roof relay |

Consecutive checkpoints are approximately 253–371 m apart in world space,
beyond the 230 m fog limit. Structural checks also verify intervening mandatory
challenges and reject a direct walkable ground connection; distance alone is
not the design criterion. The final checkpoint precedes an entire finale,
not another nearby checkpoint.

## Movement envelope

Global movement tuning remains the authored campaign tuning. Measurements at
60 Hz give a charged foot rise of 2.854 m and charged board rise of 1.779 m.
At 23 m/s a flat charged board ollie covers about 13.8 world metres. The current
input/controller combination gives a smaller foot-air range when both axes
are used; the roof and crate routes therefore use real normalized input and
supported edge positioning, not measurements from rotated straight fixtures.

`iceGrip: .08` retains the stronger full-vector inertia. These short patches
occupy gentle parts of the curve, with dry approach and recovery space. The
65 m dry link after the Terrace descent naturally spends its overspeed before
the first ice patch; it still carries 23 m/s through the sequence. The later
roof descent reaches its ice patch above 24 m/s.

## Verification

`npm run check:blockworks` is the focused course command. Tests use the
production Player and complete source Level. `tools/blockworks-runner.mjs`
submits full normalized device samples and records controls, poses, contacts
and checkpoint progress. Positive journey pilots never set player position,
velocity or state after their initial start.

The core acceptance test is `tools/test-blockworks-journey.mjs`: one player
from spawn to gate, retaining world time, inventory and puzzle state across
all district transitions. Its 17,482 recorded steps match exactly before and
after the crate-presentation correction, including position, velocity, contacts
and checkpoint timing. Two full-render browser runs reach Course Clear with
zero deaths. Standalone tests also exercise the optional reward
return, real checkpoint death/respawn, mover arrival phases, ice overspeed,
enemy responses and the hold-forward negative control.

For local review use `/blockworks-review.html?lite&playtest&level=codex-lab`,
then omit `lite` for full rendering. The **Replay full route** button plays
the saved 291-second continuous input take from `tools/fixtures/blockworks-journey.json`. The authoring overview is temporary and
never changes the production camera. The normal game remains reachable from
the campaign map and the published playtest link.
