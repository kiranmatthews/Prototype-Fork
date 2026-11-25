# Character elasticity

Stretch, compression and rebound are a baseline animation principle across the
player, including new work. They are action-specific rather than one perpetual
whole-character wobble.

## Shared, editable layers

`src/animation/elasticity.ts` supplies profiles for all 30 current player clips.
Looping clips get named **Elasticity** procedural drivers, with exact loop seams.
One-shots get scalar keyframes for load, rebound and settle, ending neutral.
Existing authored length keys/drivers keep ownership of their channels, including
the strong Jump/Fall/Land, double-jump, charge and forward-roll deformation.
No existing joint key, speed or user-authored length track is replaced.

| Family | Treatment |
| --- | --- |
| Idle / crouch | Restrained breathing and weight transfer |
| Walk / run / crawl | Step-synchronized compression and extension; no replacement gait rotations |
| Swim | Stroke-sized torso/limb length changes |
| Jump / fall / land | Existing long-rise, apex-catch and cushion/rebound curves |
| Skate / ollie | Contact-owned stance plus the recovered large elastic arc |
| Grind / grab / rope / ledge | Modest elastic load; grip-sensitive arm channels protected |
| Slide / slam / bail / spin | Action-sized compression and release |
| Death / transitions | Finite load and settle, not a continuing bounce after the action ends |

Catalogue 31 adds these layers to saved player clips without overwriting existing
channels. The upgrade is idempotent; later edits or disabled drivers remain saved.
New Animation, initial empty documents and missing-active-clip recovery in the
Studio all use the same factory. Unsupported rigs without the independent length
controls are left alone rather than receiving invalid driver targets.

## Recovered ollie

`src/skateOllieMotion.ts` adapts the independent scalar curves present at repository
snapshot `91cf126` (11 September 2026, before the skating-contact rewrite).
It does not restore that version's on-foot hip/knee keys or overhead arm poses.
The reference includes 1.42× torso and 1.65× shin stretch, followed by apex
compression and a landing rebound. Eased real-control playback reaches roughly
0.73–1.58× shin length. A small delayed spine/arm/wrist follow-through restores
the loose motion, without a body rotation or a change to the physical jump.

Normal skate idle/charge/ollie foot spacing is reduced 25% (1.00 m to 0.75 m in
the default deck). Grinds, grabs, manuals and flips retain their contact-specific
widths. The narrower pose blends into those wider contacts rather than switching
foot targets instantaneously.

The previous shallow charge and proportion-aware knee spring remain. True length
deformation now sits alongside that knee motion; foot IK runs after both. The
bridge composes the elastic multiplier with any authored scalar pose, restores
it before the next frame and does not accumulate transformations.

## Vert air and spine transfer

`src/vertSkateMotion.ts` holds both. They are drawn only: no position, speed,
timer, contact or input window reads them.

**A vert air nobody is steering** (`VertAirMotion`) is not a held pose. Its
phases follow the rider's vertical speed as a share of the speed he left the lip
with, so a small air and a big one go through the same motion at their own pace:

| Phase | What moves |
| --- | --- |
| Rise | Trunk and head hang back down the wall behind the deck (the trail is worst at the lip and gone well before the top), the arms are pulled back off the launch, the hips lag the deck |
| Top | Everything comes level; he folds over his toes and tucks his knees, the arms stand off the body, the head has already found the lip |
| Fall | Trunk and arms trail up the wall, the legs reach for it, the up-wall arm is carried forward |
| Brace | From about half the lip's speed the arms come back down and forward, the elbows fold and the trunk squares up to the wall |

Every part follows its target on a spring of its own (`AIR_SPRINGS`: the trunk
firm, the head firmer, the arms loose and unlike each other), stepped exactly so
the motion does not depend on the frame rate. Loose springs swing past and come
back: that is the rebound. On top of the springs the arms and the deck keep
working for balance on two beats that never line up, seeded per air, so no
quarter second is a held pose and no two airs are the same; nothing uses a random
number. Amounts are in `VERT_AIR`. The `vert-air` profile shortens the trunk into
the tuck, lengthens it into the reach, and lengthens each arm as it is thrown;
deck contact owns the feet, so the legs keep their lengths. A grab, a flip, a lip
trick or a bail fades the idle out by its own weight; it is over within a second
of the air ending and the next one starts from rest.

**A spine transfer** (`sampleSpineTransfer`) is thrown, not turned. The gather,
reach and rebound that the knees and the `spine-transfer` profile read are
unchanged. Added to them, per transfer and seeded per transfer:

- the drawn turn winds up against itself, is driven late and about half again
  as fast as an even turn, runs 5–12° past the far wall and is caught. The
  hardest moment (the catch) is near three times an even turn's at any length;
  a short transfer winds up and overshoots less and starts its drive sooner;
- the chest and head go over ahead of the deck and are held back at the end,
  the deck drags behind the feet and whips through, the body rocks a little out
  of the plane of the turn and the shoulders come round;
- the arms have different jobs: the leading one goes up and over and forward of
  the chest, the trailing one half as far and behind, both folding at the elbow.

The simulation's own turn (`spineTransferNormal`, which eases `alignNormal` and
which a skate camera reads) stays the even one. The uneven turn is one extra
rotation of the drawn rider (`spineTransferTurnOffset`), zero at both ends.

Two rules that both layers depend on:

1. **Turn a joint in its parent, never through a world quaternion.** Under the
   rider's cartoon proportions (1.18 × 1.36 × 1.18) a bone's world matrix is
   sheared, and a sheared matrix has no single rotation to give back: the answer
   depends on which branch of the decomposition is taken. A side-on hang (a
   quarter turn, then a quarter turn) sits exactly on the branch point, so
   reading a world quaternion there pops a joint by up to 0.28 rad from one
   frame to the next. Neither the skate pose nor the shared two-bone IK reads
   one for a joint below the body. There are three cases, and a tool for each:
   - *a turn about a world axis* (the trunk, head and arms of a hang, the
     spine's lean on a rail): `turnJoint` in `src/skateAnimation.ts` carries the
     axis into the joint's parent with the parent's inverse matrix and turns the
     joint there;
   - *an aim* (a thigh pointed at where its knee must be): `solveTwoBoneIk` in
     `src/animation/ik.ts` carries both directions into the parent the same way
     and takes the shortest turn between them. Every caller gets this;
     `accountForParentScale` is kept for them and no longer changes anything;
   - *a whole attitude* (a sole on the deck, a palm on a rail): the joint is set
     against the rotation its own joints give it, every turn from the root down
     multiplied out (`rotationOf` in `src/skateAnimation.ts`). Where nothing is
     sheared that is exactly what the world matrix holds.

   The branch points are not only in a pipe: a rider turning on the flat crosses
   them too. Reading rotations back out of sheared matrices, one settled pose
   drawn facing other ways moved a leg joint by up to 14 mm in his own frame and
   turned a sole by up to 0.18 rad (a grabbing wrist by 0.31) against the deck.
   On Side Pipe Lab's course a sole jumped by more than 0.05 rad against the
   deck between two frames on 76 of 2,187 frames on the board, and where the two
   attitudes would not settle the leg was left unsolved: a sole 13 mm off the
   deck for one frame of the cascade's first transfer, 10 and 11 mm for one
   frame of two hangs. A pose no longer depends on which way he faces, no joint
   changes hemisphere from one frame of a hang to the next, and on that course
   the soles sit flatter on the deck (0.6° out of its plane at the median, from
   1.8°) and square across it.
2. **Nothing is switched.** The idle's weight follows how much "up the wall"
   still means as the body comes upright, and a transfer takes the upper body
   off the idle over its first quarter; the way his chest faces is a direction
   that goes round with him in a spin, not a sign.

`npm run check:vert-air` (`tools/test-vert-air-motion.mjs`) pins the curves,
then the real rig in real pipes: head 0.36 m under the hips' line going up and
0.19 m over it coming down, the up-wall arm lower on the rise than on the fall,
neither arm ever held (the old pose froze for its last 14 frames), soles within 3 mm, one instant drawn five
times giving one pose, no part's pace changing by more than 0.02 rad from one
frame to the next in a hang, and in a transfer the drawn body behind the even
turn, then ahead of it, then 0.20 rad past the far wall and on it at the end.
The cascade's transfers are drawn once more at eight instants a frame: both
soles within 3 mm of the deck at all 720, and neither turning against it by
more than 0.02 rad between two of them (0.002 measured; 0.11 before). They are
then drawn the way the game draws them, through its authored animation
runtime, where the centimetre was: within 3 mm on all 90 frames (1.00 mm
measured; 13.13 mm on frame 22 of the first before).
A test steps the Player with `step()` alone: the step draws the pose itself,
and a second `syncVisual` runs every spring at twice its speed.

## Garment and contact ownership

Shorts now have two garment-only length bones underneath the real upper-leg
joints. These extend the existing three-bone skin with each elongated thigh, so
the lower legs remain inserted. During compression knees nest inside the original
hem, avoiding a pinched crotch from shrinking only the leg-weighted vertices.
The waist follows the pelvis. Actual leg joints remain unscaled, source geometry,
UVs and weights are unchanged, and Shorts Width/Height/Depth remain independent
Character Lab settings. Bone knobs, gloves, shoes and the head do not inherit
whole-rig scale.

Order: legacy pose → authored keys/procedural drivers → independent elasticity →
character proportions/garment response → final foot/palm contacts → render
interpolation. Gameplay movement and normalized collision stature are unchanged.

## Vert run-up

`player.vert-climb`, `player.vert-leap` and `player.vert-miss` (`src/animation/vertRunUp.ts`; the rule and
the plan they are scrubbed by are in `docs/VERT_RUN_UP.md`) each have a profile of their own, keyed to the
clip's own beats so the deformation lands with the pose and not near it.

| Clip | Profile (torso, upper arm, forearm, thigh, shin) | Where it squashes and stretches |
|---|---|---|
| `vert-climb` | .12 .06 .09 .10 .13 | squash into the wall step, stretch up the wall reaching, squash folded over the coping, stretch through between the arms, squash onto the leading foot, stretch in the first stride |
| `vert-leap` | .15 .09 .14 .14 .18 | a gather, the full squash of the load, full stretch off the toes, and full stretch again as his hands take the lip, let out to neutral as his weight comes onto his arms (the hang's own profile takes it from there) |
| `vert-miss` | .15 .09 .14 .12 .16 | the same leap; full stretch at the top with the lip still above his fingers; a squash as the transition takes his knees; the hardest squash where his seat hits; stretch as his legs go over; a squash sat down; a last stretch standing up |

The hands and feet these clips hold (coping, wall, ground) are solved after the segment lengths, so a
stretched arm still has its palm on the coping. The pelvis is placed by gameplay and is not scaled.

## Focused verification

- `npm run check:animation`: core suite/migrations, IK, runtime routing, fixed-length
  leg solve, arm clearance, charged ollies and all-clip elasticity coverage. The
  IK test turns a leg under a (1.18, 1.36, 1.18) body as one piece through the
  side-on hang (3,603 orientations, a thousandth of a radian apart): the solved
  hip and knee do not change and the foot turns with the rig, to 1e-6 rad.
- `npm run check:vert-air`: the vert-air idle and the spine transfer, as curves
  and on the real rig in Side Pipe Lab's pipes (see above).
- `npm run check:vert-run-up`: the three vert run-up clips on the real rig on
  eleven fixture walls: hands on the coping, pelvis on its path, nothing popping.
- `tools/test-skate-contacts.mjs`: 13,382 contact/trick frames; 1.99 mm maximum
  sole and 1.00 mm palm error in the fixture. 552 of them are settled poses
  (air, ride, charge, manual and every grab, in both stances) turned on the
  spot through 24 headings and drawn again: leg joints within 0.2 mm of where
  they were in his own frame and soles within 0.001 rad of how they sat on the
  deck (0.02 mm and 0 measured), a grabbing palm and wrist likewise.
- `tools/test-skate-charge-ollie.mjs`: 1,344 campaign/park tap/full ollie frames in
  both stances; exact controller position/speed/state parity, roughly 1.48 mm
  maximum sole error, no deep two-legged squat.
- Shorts geometry/rig, on-foot idle/charge recovery and recorded world-map
  locomotion checks pass. The map remains free of gameplay skid poses.
- Local review entries: `skate-charge-review.html` (including phase pauses and
  slow motion) and `idle-review.html` (real idle/walk/run/crouch/crawl inputs).
  Keep `nocrt` during review. These do not save settings or animation drafts.

Numerical checks cover the fixture, not arbitrary extreme character proportions.
Future clips still need motion review for their actual poses and contact needs.
