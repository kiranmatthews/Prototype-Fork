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

World-map rail travel has a separate `world-map` presentation context. Map
direction taps select destinations; they never feed the gameplay run-release
detector. Gameplay transient poses and cached outgoing blends are cleared
when entering/leaving that context, and map walk/boardslide/idle updates do
not start gameplay skid, landing or crouch one-shots. Ordinary gameplay skids
remain enabled after returning. `tools/test-world-map-locomotion.mjs` covers
the supplied 1,144-frame input pattern, inherited skids, board-route endings
and map/gameplay re-entry; its replay fixture retains only navigation pulses.

Catalog 26 replaces boardless `player.idle` with Quaternius `Idle_Loop`.
Catalog 30 slows its 2.5-second loop to **2×**; Run remains independently at 1.6×.
Both the dense body tracks and speed remain editable. Existing idle keys are
preserved when the speed changes. Historical pre-Quaternius copies remain under
`player.idle.pre-quaternius`; deleted idle slots stay deleted.

Run/Walk ↔ Idle matches an incoming phase and uses 0.26-second stop and
0.18-second start fades. The outgoing loop keeps advancing with its captured
Walk/Run mixture. Reversing a fade starts from the last mixed pose, while
the idle-only upper-arm rest adjustment fades in both directions. Movement
and board-mounted poses remain governed by the existing Player controller.
Use `tools/test-locomotion-idle.mjs` for real-controller stop/start and
movement-parity checks, or `/idle-review.html?playtest&level=codex-lab&nocrt`
locally for the cycling visual review.

`player.walk` is Quaternius' CC0 `Walk_Loop`, imported from the exact same
`UAL1_Standard.glb`, skeleton, and 22-joint retargeting path as the approved
`Jog_Fwd_Loop` Run. Gameplay keeps one `player.run` route and phase-blends Walk
over Jog: full Walk through 3/9 normalized speed, then a continuous blend to
full Jog at run speed. The shared gait phase keeps corresponding legs aligned,
while the runtime eases between each clip's native cycle duration so the
1.333-second Walk is not accelerated to the 0.933-second Jog cadence. Gentle walk stops
crossfade directly into Quaternius Idle; the retired pacing-stop interlude remains removed.
Grounded gait speed and facing come from the
character's own walk velocity, so a stationary rider carried by a Nightworks
platform remains in Idle.

Catalog 29 adds `player.run-stop` (**Run Stop — Skid and Settle**) for released
running input above 45% pace. Its editable 0–0.4 s brace section follows actual
remaining foot momentum; the final 0.25 s compress/rebound uses saved playback
speed. The runtime blends in over 0.1 s, with immediate
movement/action interruption. Slow analogue walking does not trigger it.
The clip is added to saved suites without replacing existing authored tracks.

Landing and skid recovery now blend the arms/legs **into the live Idle phase
during their existing bounce/settle**. Landing limbs arrive by 0.30 s, inside
its 0.45 s rebound; skid limbs arrive by 0.60 s, before its 0.65 s ending.
Root motion and squash remain until the last part of the recovery, then all
channels hand off to the same Idle sample without a second fade. Upper-arm
rest offsets use this same weight. Late Run/Idle input changes start from the
last mixed pose, preserving the continuing-run landing behavior.

`player.jump-charge` (**Jump Charge — Preload and Wind-up**) is newly authored
for this rig. It retains the control concepts checked against `4401518`,
`d2f8438` and `7457284`: eased immediate 35% preload, deeper held charge,
rearward arm loading, lowered gaze, fixed-length knees and flat planted soles.
It does not copy the old joint positions. Gameplay scrubs the editable clip
from `chargePose`; tap/full power and release-to-jump are still controller-owned.
Moving charges retain their gait and board charging stays a separate pose.
`tools/test-idle-recovery-charge.mjs` verifies both recoveries, exact handoff,
preload/hold/release behavior, foot clearance and saved-data migration.
`/idle-polish-review.html?playtest&level=codex-lab&nocrt` is a local multi-angle
review with real input and a pause-at-recovered-limbs option.

Hard direction changes now finish their visual pivot in four 60 Hz frames
(about 67 ms), well before the existing movement-inertia envelope. The authored
gait follows committed intent through zero physical velocity, avoiding a
mid-reversal Walk/Idle flash. The motor, friction, coast time and slide distance
are unchanged. `tools/test-run-inertia-presentation.mjs` checks these separate
facing/momentum clocks, stop/restart/jump behavior and movement parity.

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

## Quaternius crouch and crawl (catalog 24)

The live low poses use four real takes from the Universal Animation Library
**Source** pack: `Crouch_Enter`, `Crouch_Idle_Loop`, `Crouch_Exit`, and
`Crawl_Fwd_Loop`. All source poses remain editable. Entry and exit are retimed
to the previous five-frame handoff (5/60 seconds); the two loops keep their
native clocks. The palm-only orientation constraint runs after wrist-rest and
body-proportion settings, keeping both palms flat down throughout Crawl in
gameplay and Studio. It does not move the wrists or change the arm/body gait.
Saved v23 drafts gain these corrections with their authored keys and speeds retained.
Direction input interrupts entry into crawl and exit into run immediately.
Jumping, falling and other actions also interrupt the transitions.

Revision 23 replaces existing `player.crouch` / `player.crawl` routes, preserving
their saved speeds and backing up the old clips under `.pre-quaternius` IDs.
Deleted routes remain deleted and subsequent edits to the new clips survive.
Quaternius clips own the complete low pose without the old Unity hand-plant,
arm-stretch or wrist-half-turn corrections. Source/license details live in
`public/animations/quaternius-crouch/`. `tools/test-quaternius-crouch.mjs` covers
source identity, real-player routing/interruption, sampled joint clearance,
and saved draft migration. The historical tests below retain coverage for old
Unity drafts that can still be imported or restored.

### Historical Unity crouch and crawl (catalog 12–22)

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

Catalog revision 22 corrects Crouch's converging thigh directions for the live
procedural rider. Each complete leg turns about pelvis-local up until the knee
points at least 14 degrees outward. Only the two hip quaternion tracks change;
source thigh elevation, knee/ankle articulation, hips translation and upper-body
motion remain. This is baked into ordinary editable keys, shared by Studio and
gameplay. The rejected local-Z hip/knee offsets left only 0.004 rig units between
knee centres; the corrected default rig retains at least 0.364 between knees and
0.399 between ankles over the entire loop.

Saved untouched Crouch clips upgrade automatically, including normalized
quaternions with reversed signs and reordered browser drafts. The comparison
allows normalization noise and retains saved playback speed; authored key edits
and intentional deletions survive. `tools/test-crouch-stance.mjs` checks 2,103
preview samples, four full gameplay loops in different headings, crawl handoffs,
and migration. For visual comparison, open
`/crouch-review.html?lite&playtest&level=codex-lab`, then repeat without `lite`.
The local review has Source / Previous guess / Fixed and 0° / 40° / 90° views;
its animation overrides do not save to browser storage.

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

Catalog 27 adds `player.slide-jump`, an independent editable split-legged
air clip using the high-jump silhouette through rise and descent. It is selected
by `slideJumpAir` before any lingering slide pose can hide it, and it uses the
actual launch velocity for its phase. It never sets `doubleJumpAir` or starts a
forward roll. The `slideJumpHeight` tuning is a rise-height multiplier, converted
to velocity with a square root and applied once; slide-to-crawl grace no longer
stacks the crouch boost. `tools/test-slide-jump.mjs` checks active-slide and grace
launches, travel direction, split legs and foot landings, with optional replay input.

Catalog 25 corrects the Jump/Fall/Land arm chain: shoulders remain outward,
arms lower continuously through the apex, and keyed elbows/wrists prevent
the legacy arm layer from changing those joints underneath. Takeoff and air
route changes blend over 0.1 seconds; stationary landing settles into Idle
over the existing locomotion blend. Saved drafts retain all non-arm tracks,
deformation drivers and speeds, with their previous clips backed up under
`.pre-arm-clearance` IDs. `tools/test-jump-arms.mjs` samples the styled rig's
arm clearance and checks a complete jump/descent/landing sequence.

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

That ownership includes ordinary board flight and its exact landing frame:
on-foot Jump/Fall/Land no longer layer over the mounted ollie. A shared
proportion-aware spring (`src/skateBodyMotion.ts`) supplies moderate charge,
takeoff extension, apex gather and a cushioned return to relaxed ride. The
separate grab/flip/grind routes and manually selected Studio clips are unchanged.

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

### Rope limb mapping (catalog v28)

The Unity rope source has a relaxed, bent A-pose, not the Quaternius T-pose.
The importer now reflects Unity X into the player's handedness and calibrates
each upper/lower arm and leg to its measured bind child direction. All four
rope clips retain the resulting source rotations; the old placeholder arm
tracks no longer override hang/climb. Live grip IK runs afterward, using the
complete scaled parent transform and the lower shoulder's reach during pulls.
Other IK consumers retain their existing behavior.

Saved Unity rope clips upgrade with their playback speeds retained and exact
`pre-limb-mapping` recovery copies. Custom non-Unity clips are not replaced.
Run `npm run check:rope` for independent source-direction fixtures, live
hang/climb/descend checks, scaled-parent contacts and saved-draft migration.
The local-only `/rope-review.html?playtest&level=codex-lab&nocrt` review provides
front/oblique/side views and normal/charged release controls without saving data.

Run:

```sh
npm run check:animation
npm run build
```

Browser handoff requires a lite pass and one full-render pass. Check neutral,
joint and IK stress, jump stretch, landing compression, procedural scrubbing,
context response, baking, loop seams, speed changes, mirror behavior, draft
round-trip, and clean close-to-gameplay restoration.
