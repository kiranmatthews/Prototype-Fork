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
   idle, run, pacing stop, jump, fall, land, crouch, crawl, slide, skate,
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

`player.pace-stop` is the authored, in-place bridge from a committed run to
the full resting idle. The runtime owns this clip as an interruptible one-shot:
it remembers the outgoing gait phase and peak speed, blends briefly from the
last run pose, lets the feet shed momentum over progressively smaller steps,
then lands on the exact first pose of `player.idle`. Renewed locomotion or any
action interrupts it immediately; landing has higher priority.

The motion follows the stop shown around 15:15–15:20 in PlayFrame's
[Jak & Daxter animation analysis](https://www.youtube.com/watch?v=BbP6Jsh8M6Y&t=915s):
feet settle first, pelvis and torso follow, arms/clavicles overlap, and the
head and loose secondary parts finish last. The same reference motivates the
restrained torso compression/extension carried through the neck and head in
the run starter. Contrast matters: the final quiet idle makes the larger run
and stop gestures read more clearly.

## Unity body-slam pose

`player.slam` contains the Unity port's semantic procedural-rig pose as eight
ordinary editable quaternion tracks: both shoulders, elbows, hips, and knees.
The tucked anticipation and straight falling/flattened silhouettes come from
`SourceFoxRigPresentation.cs`; model-specific PunkyFox/Meshy bind-space curves
are deliberately not copied onto the browser skeleton. During gameplay the
clip timeline is scrubbed by slam action progress so variable fall height
cannot desynchronize the pose from anticipation, descent, or impact. Manual
Studio preview remains normal speed-controlled playback.

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
