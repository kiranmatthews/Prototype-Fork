# Character Animation Studio

The browser animation suite is the source-owned authoring path for the
procedural rider. Procedural drivers and keyframes are equal first-class
layers: generated motion can remain live and parameterized, while keys polish
silhouettes, contacts, timing, and exceptional poses. The suite deliberately
does not depend on a Humanoid avatar, FBX at runtime, Meshy, Tripo, or the
rejected Unity whole-root squash jump.

## Open the studio

- Open the TUNER panel and choose **ANIMATION**.
- Or load `#animationstudio` directly, for example `/?lite#animationstudio`.
- A harness can call `window.__game.openAnimationStudio()` and inspect
  `window.__game.animationStudio.diagnostics`.

Opening the studio freezes simulation and snapshots the authoritative player
hierarchy. Closing restores position, quaternion, scale, visibility, tail
state, camera state, and render interpolation before play resumes.

## Authoring workflow

1. Select an animation from the clip selector. The starter suite contains
   idle, walk, run, jump, double jump, fall, land, crouch, crawl, slide, skate,
   grind, grab, hang, climb, rope, slam, bail, and spin slots.
2. Set duration, loop range/mode, and **Speed**. Playback speed belongs to the
   selected clip and is exported with it; the slider covers the common range
   and the numeric field accepts the wider validated range.
3. Build procedural motion where it belongs. Drivers support oscillators,
   envelopes/pulses, seeded noise, gameplay-response curves, and registered
   custom gait/IK/look-at/spring evaluators. Edit their source, blend mode,
   amplitude, frequency, phase, bias, seed, clamp, and evaluation order while
   previewing speed, gait phase, vertical velocity, grounded state, and action
   progress.
4. Select a semantic joint in the rig tree. Use the translate, rotate, and
   scale gizmos or exact local values in the inspector.
5. Enable Auto Key or press Set Key at the playhead. Drag keys in the dope
   sheet to retime them. The selected channel's curve view exposes
   interpolation and tangent editing.
6. Use FK or IK authoring. IK supplies draggable end-effector and pole-vector
   handles for inferred or declared three-joint arm/leg chains, then records
   the solved local joint rotations as ordinary editable keys.
7. Key scalar deformation controls independently. Torso, upper/lower arms,
   thighs, and shins each have their own length control; none scales the board,
   gameplay root, or the next limb segment.
8. Add contact ranges, markers, and events for planted feet, grips, impacts,
   SFX, and gameplay-readable action windows.
9. Use mirror and onion-skin tools to compare paired poses and adjacent frames.
10. Bake one driver or the fully composed procedural result to fixed-FPS keys
    whenever direct frame editing is preferable. Baking is a single undoable
    operation and leaves the original procedural clip available until replaced.
11. Export deterministic JSON when a clip is accepted. Drafts autosave under
   the `solProtoAnimationSuite:*` namespace; the core also exposes an
   IndexedDB-preferred draft store for larger imported suites.

## Locomotion transitions

`player.walk` is Quaternius' CC0 `Walk_Loop`, imported from the exact same
`UAL1_Standard.glb`, skeleton, and 22-joint retargeting path as the approved
`Jog_Fwd_Loop` Run. Gameplay keeps one `player.run` route and phase-blends Walk
over Jog: full Walk through 3/9 normalized speed, then a continuous blend to
full Jog at run speed. The shared gait phase keeps corresponding legs aligned,
while the runtime eases between each clip's native cycle duration so the
1.333-second Walk is not accelerated to the 0.933-second Jog cadence. Stopping
crossfades directly into Idle; the retired pacing-stop interlude is no longer
part of the catalog or runtime. Grounded gait speed and facing come from the
character's own walk velocity, so a stationary rider carried by a Nightworks
platform remains in Idle.

## Unity body-slam pose

`player.slam` contains the Unity port's semantic procedural-rig pose as eight
ordinary editable quaternion tracks: both shoulders, elbows, hips, and knees.
The tucked anticipation and straight falling/flattened silhouettes come from
`SourceFoxRigPresentation.cs`; model-specific PunkyFox/Meshy bind-space curves
are deliberately not copied onto the browser skeleton. During gameplay the
clip timeline is scrubbed by slam action progress so variable fall height
cannot desynchronize the pose from anticipation, descent, or impact. Manual
Studio preview remains normal speed-controlled playback.

## Unity rope suite

The rope presentation retargets PunkyFox's Unity `Rope Hang Idle`, `Climb Up
Rope`, `Swing on Rope to Ground`, and charged `Rope Hang Backflip to Crouch`
clips onto all 22 conventional humanoid joints. The reproducible importer uses
the Unity idle bind pose, converts bind-world deltas into player canonical
rest-local rotations, evaluates the source Hermite curves at 60 fps, then
reduces them with a measured maximum angular error of 0.5 degrees. Translation
and root motion are omitted because deterministic gameplay owns the rope and
rider positions.

`player.rope` is the attached idle loop. `player.rope-climb` follows a
phase-preserving 2.533-second cycle, plays forward while climbing and backward
while descending, and crossfades to/from hang over Unity's six-frame attached
blend. `player.rope-release` continuously blends the swing-jump and charged
backflip variants from the fixed-step release charge and uses Unity's trimmed
34-frame/17-frame lead-ins. A final two-bone correction keeps both wrists on
the live rope axis after the authored pose; the pendulum angle never drives or
distorts the body animation.

## Unity crouch and crawl

`player.crouch` retargets PunkyFox's complete 350-frame
`CrouchLookAroundBow` loop. `player.crawl` keeps Unity's clean frames 219–271
without either look-back beat, retimes that reach as one half-cycle, and builds
the opposite diagonal from an X-mirrored second half. Six-frame overlaps at the
internal handoff and outer seam reproduce Unity's Loop Pose behavior; position
and angular velocity now cross both joins continuously instead of copying the
first pose onto the final frame. Both clips carry all 22
humanoid rotation channels plus the one authored hips-position channel needed
for their low silhouettes; child-bone translations and gameplay root motion
remain excluded. Crouch alone strips the source hips' 37–60° yaw while keeping
its pitch, roll, and descendant look-around motion, so gameplay facing remains
the sole N/S/E/W-plus-diagonals authority instead of shifting every direction
onto an angle.

Any measured planar movement above Unity's `0.001` threshold selects Crawl,
including pure lateral movement. Stopping selects Crouch Idle. Entry, exit, and
crouch↔crawl changes use Unity's five-frame smooth crossfade. The source's
separate `+0.225 m` floor correction is included in the hips channel after
accounting for the browser rig scale, while the old outer crawl drop, pitch,
and whole-body compression are disabled so they cannot stack with the imported
pose. Both loops remain directly keyframe-editable and retain the Studio's
saved playback-speed control. Crawl then applies the same procedural contact
pass in gameplay and Studio: the stretchable arms bring both glove grip sockets
forward onto the support plane while palm normals face into the ground. Every
sampled Crawl wrist key also carries the requested 180° local-Y correction;
the contact solve treats local +Z as the dorsal X-mark side and keeps it facing
up, so the actual local -Z palms remain down. Contact annotations use alternating
diagonal plants. Gameplay passes the saved clip's
live timeline into the contact solve—including authored and runtime playback
speed—while Studio passes its preview timeline, so both surfaces show the same
arm beat without phase drift.

## Double-jump pose

`player.double-jump` is a separate authored high-jump clip rather than a second
pass through `player.jump`. It restarts on the mid-air pop, locks both animation
roots upright, drives the hips into a broad mirrored straddle with nearly
straight knees, and throws both arms into a high V. Gameplay also clears the
first jump's somersault clock before this clip is sampled, so a running forward
roll cannot bleed into the double jump.

## Jump deformation arc

The charged crouch is the anticipation, so `player.jump` begins at release in
an already elongated pose instead of replaying another squash. It reaches a
very long whole-limb stretch early in the rise, holds that extension through
most of the ascent, then folds the hips and knees while independently
shortening the torso and limb sections as the feet catch the head at the apex.
`player.fall` begins on that exact apex pose and relaxes every deformation
control back to neutral during descent. The short `player.land` transient then
adds a cushion squash, rebound overshoot, small secondary settle, and exact
neutral finish. When gameplay is already continuing into `player.run`, landing
is a reaction over a phase-matched Run pose rather than an exclusive frozen
base. Both feet begin following the live stride under the impact pose instead
of being locked in world space, including on moving supports. The rebound reaches
Run by 0.28 seconds and hands off at the exact sampled Run phase, so locomotion
stays immediate without a frame-zero restart, floor slide, or release recoil.

Jump, double-jump, and fall opt into gameplay `actionProgress` timing, so their
poses follow launch/apex/descent rather than drifting with frame time or jump
height. Studio/manual preview remains ordinary saved-speed playback. Catalog
upgrades replace only signature-identical older starters; a locally edited
same-ID clip stays time-authored unless it explicitly opts into phase timing.

Running-jump forward rolls add a second procedural layer shared by Jump and
Fall. The existing waist-roll clock publishes `forwardRollTuck`; nine editable
response drivers multiply the authored torso and limb lengths after their base
keys. At the fully inverted ball frame every deformable segment reaches the
rig's hard `0.55` minimum, then expands smoothly as the roll opens. Plain jumps,
board airs, double jumps, slams, and bail recovery do not drive this input. Use
the **Forward-roll curl** motion-context slider to inspect or tune the response
drivers in the Studio without changing gameplay timing.

### Procedural skate ownership

`player.skate` remains a selectable, editable Animation Studio slot, and manual
preview still plays its authored keys. Automatic gameplay routing deliberately
leaves that slot inactive, however. The pre-suite procedural skate presentation
already owns the eased mount, regular/switch side stance, articulated knees,
ankle counter-planting, measured sole centering, arms, head look, and deck
counter-yaw. Layering the looping Skate Push starter over those same channels
made the mount restart at clip frame zero and replaced the proven steady stance.
Live skating therefore preserves the procedural presentation until a future
authored skate clip is explicitly approved to replace it.

Entering skating now plays one short procedural mount hop: 0.30 seconds of
lift with a 0.28 m peak, knee tuck and a small arm lift, followed by 0.14 seconds
of landing compression. Standing/moving charges and automatic momentum or
downhill mounts use the same transition. The hold threshold and physics stay
unchanged. Rider lift is applied after deck planting, and the normal skating
stance is restored exactly at the end. A real jump, dismount, action or respawn
clears the transient. Its source timing lives in `src/skateMount.ts`.

Starter-catalog upgrades are versioned. An older saved suite receives newly
introduced starter clips without replacing any same-ID clip the user has
edited. Once upgraded, intentionally deleting a starter slot does not cause it
to reappear on the next load.

Undo/redo uses committed authoring transactions. Gizmo drags and speed/key
drags preview live, commit once on release, and cancel on Escape.

## Data and runtime contract

Animation data targets stable semantic IDs rather than Three.js UUIDs. Tracks
are rest-relative:

- position is an additive local offset;
- quaternion is composed after the immutable rest rotation;
- scale is a positive multiplicative ratio;
- scalar tracks drive rig controls such as segment length.

Clips also own duration, saved playback speed, loop range/mode, root-motion
policy, procedural drivers and composition order, markers, contacts, events,
tags, and provenance. Position, scale, and scalar curves support step, linear,
and cubic Hermite interpolation. Rotation curves use normalized,
hemisphere-safe quaternion interpolation and SQUAD for cubic sampling.

Built-in procedural drivers are pure functions of timeline time and a copied
motion context, so scrubbing, replay, baking, and fixed-step playback agree.
Custom evaluators use a stable ID plus JSON parameters and must obey the same
pure, deterministic contract. Unknown evaluators safely no-op with a warning.

The rider exposes a real pelvis-rooted humanoid `THREE.Skeleton`, including
spine/chest/neck, clavicles, full arm and leg chains, and toe bones. Its live
gameplay rest remains the familiar relaxed silhouette; a separate canonical
T-pose is published for import and retargeting. Existing clip targets continue
to resolve through stable IDs and aliases. See [HUMANOID_RIG.md](HUMANOID_RIG.md)
for the hierarchy and compatibility contract.

The runtime applies layers in this order:

1. deterministic movement and the existing legacy pose;
2. copied motion inputs such as speed, gait phase, vertical velocity, balance,
   charge, and action progress;
3. procedural base drivers;
4. keyed correction tracks, or the explicitly selected reverse composition;
5. independent segment deformation controls;
6. render-pose capture and interpolation.

Gameplay routes listed as legacy-presentation-owned (currently
`player.skate`) stop after step 2; explicit Studio/manual preview still exercises
their clip data through the remaining authored layers.

Gameplay collision and movement do not read editable transforms. The one
former exception, pipe landing alignment, now has a simulation-owned value.

## Independent squash and stretch

Each deformable segment has an anchor joint, a local length axis, bounded
minimum/maximum scale, volume-compensation policy, and downstream endpoint
joints. Applying a length value:

- scales only direct visual children around that anchor;
- moves the next joint to the new endpoint;
- optionally compensates the transverse axes by `1 / sqrt(lengthScale)`;
- leaves downstream segment scale at one.

This is intentionally different from scaling the character root. A jump can
lengthen selected arm and leg segments independently, while a landing can
shorten only the torso or selected limbs.

## Verification

Run:

```sh
npm run check:animation
npm run build
```

Browser handoff requires a lite pass and one full-render pass. Check neutral,
joint and IK stress, jump stretch, landing compression, procedural scrubbing,
context response, baking, loop seams, speed changes, mirror behavior, draft
round-trip, and clean close-to-gameplay restoration.
