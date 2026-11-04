# D board travel study

Local A/B/C/D exploration; do not publish this branch. D owns the new board
presentation. A/B/C retain their existing skating presentation. The live UI
tuning, hold-to-skate/release-to-jump gesture and physical movement are shared.

## Source inspection

Read the THUG source/script reconstruction at revision
`98b4e24921446ccd4b157453e25697f9574f0053` in a temporary research directory:

- [Walking control](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/walking_control.q),
  especially `WalkingRunToSkating`, `SkateToRunState`, `SkateToStandState`,
  `PlayWalkAnim` and `CycleSpeedChosenAnim`. Reversing a transition preserves
  animation progress; braking and moving exits choose different animations;
  speed changes preserve gait phase. Missing boards use partial animations.
- [Walk component](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Code/Gel/Components/WalkComponent.cpp),
  `smooth_anim_speed` and `update_anim_speeds`. It smooths animation speed at
  state changes and scales animation from effective movement speed.
- [Ground tricks](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/groundtricks.q):
  the kick-enabled branch chooses a push cycle, with separate standing and
  crouching idle fallbacks. Also inspected `skater_procanim.q`, `anim.q` and
  `switch_control.q` for board-bone/transition ownership.

These informed state continuity and contact ownership. No external code,
comments, proprietary clips, game assets or timing constants were copied.
This is an original procedural Bone Man interpretation, not a claim of exact
Tony Hawk animation parity. In particular, our input must remain cancellable
and the physics switch cannot wait for a cosmetic mount animation.

## Motion and ownership

The complete deck remains visible on Bone Man's back while on foot. During
the existing hold interval, one hand brings it around the hip. Releasing
before the controller commits returns it to carry while the ordinary jump
continues. Commitment places the wheels, lifts and turns the body, catches
the front foot, then finishes with two foot pushes. Acceleration below cruise
speed can continue the push cycle. Ground contact is brief and world anchored;
the front shoe remains on the deck while the rear shoe reaches the ground.

Braking loads the body and brings the rear foot out. A halt steps off, tips
the board into the hand and returns it to the visible carried pose. An early
remount starts from the currently displayed route/stance. Neither a spear
spin nor a replacement deck hides the handoff. Ordinary bails, loose boards,
grabs, grinds, vert and competition finishes retain their existing ownership.

`SkateTravelMotion` writes presentation only. `SkateAnimation` consumes its
pose after appearance/deformation and solves contacts against the actual deck.
Shared elasticity profiles control independent chest/arm compression and
rebound; planted leg lengths and whole-rider scale remain unchanged. Turn lean
comes from changes in actual heading, not an absolute sideways input value.

The local Watch motion selector contains mount/stop, cancellation, early ollie,
carving and remount sequences, with phase pauses from preparation to carry.
Review both stances and front/side/oblique views at normal and native resolution.

## Validation

- The 6,360-frame paired native-controller probe covers mount/stop, cancellation,
  an early ollie, remount during pickup, carving and standing preparation in both
  stances. Position, speed, vertical velocity, grounded state and skate state
  match A exactly. The deck remains visible in every sampled frame.
- Worst locked hand error: 0.996 mm; transfer sole error: 4.093 mm; push sole
  error: 1.000 mm. The probe observes 56 planted-push frames and checks hip
  clearance, route continuity and interrupted pickup. Twelve state timelines
  cover reversals and finite settles at 30/60/120 Hz.
- D's charge/ollie regression passes 1,344 controller frames with exact physical
  parity, including campaign/park and both stances. The existing contact matrix
  passes 11,246 poses in D and again in A: 64 grinds, 32 grabs/releases, 12
  manuals, Darkslides, lip stalls, flip cycles, Backflip and live revert.
- The first boarding lean must not become the grab solver's rest pose. Contact
  rest joints are captured before the travel layer; travel rotations are
  restored before the next authored pose. The contact matrix exercises this
  without an animation overlay as well as the source-backed boarding probe.
- The 7,200-frame live-UI tuning regression, animation runtime, shared elasticity,
  strict review TypeScript, production build and release-size check pass. No
  full-suite run. Extracted Jak assets and temporary THUG research stay outside
  Git and the release.
- Browser review covers full rendering at normal 720p and native resolution,
  both stances and front/side/oblique views. Preparation, placement, hop, push,
  pickup, cancellation, early ollie and remount are exposed through Watch motion.
  The enlarged inspection floor and off-path gate let long skate takes loop
  without opening the real course's results screen. A/B/C/D switches preserve
  position and velocity; no browser warnings/errors. Restored the observed
  720p/1× settings and hidden debug menus, then returned D to live play.

Evidence and test logs are local in
`/Users/kiki/.codex/visualizations/2026/11/02/01a19bb4-0de7-79a1-9881-c7c1b3dd3dec/skate-travel/`.
The task worktree serves the updated review on port 5189; the existing port
5188 playtest is preserved. This increment remains local-only.
