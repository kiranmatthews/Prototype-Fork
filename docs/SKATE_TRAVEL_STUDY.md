# D board mount and dismount study

Local A/B/C/D exploration. Do not integrate, push or publish. The user's latest
request replaces the spin-covered swaps with better mount/dismount animation,
without a persistent board on the back. A/B/C, live UI tuning and the native
hold-to-skate/release-to-jump gesture remain authoritative.

## Current direction — 5 November 2026

The spin handoff route has been removed from the player; spin effects again
respond only to the real attack. The equipment animation uses the pre-spin
idea of placement and pickup, rebuilt as finite actions. The rejected back
carry, long reaching arms and kick-push are not restored.

The actual hold meter drives a supported load and a short draw beside the
pelvis. The hand reaches before the deck is shown. Cancelling reverses the draw
and crouch; re-pressing continues from the current load. The board is stowed
when the cancellation finishes. Releasing jump still launches immediately.

A committed mount drops the board beside the shoes, releases the grip before
the arm would have to reach the floor, then moves the deck underneath the
airborne feet. The body turns into its stance during a 0.30 m hop and absorbs
the catch. The sequence lasts 0.64 s without delaying or changing the physical
skate state. Feet transfer from the last displayed load pose, with a slight
front/rear stagger. The board starts from its displayed position on a reversal.

Dismounting takes 0.86 s: weight moves toward the stepping foot, the trailing
shoe tips the deck on its rear axle, then the board comes into the near hand
and is stowed. The body keeps
some knee bend through the step-off and blends into the current native stride.
The same hand continues handling the deck if the player remounts mid-pickup.
There is no persistent carry after the action, and no spin or replacement model
covers it. The deck keeps its complete geometry and scale.

The contact layer measures the actual shoulder, soles and pelvis. Lifted stride
feet gather toward supported positions so the load cannot fold heels into the
hips. Torso/arm compression and rebound use the shared editable elasticity
profiles. No whole-skeleton scaling, arm-length cheat or movement retune.
Real ollies, tricks, grinds, bails and other owners can interrupt immediately.

## Review and validation

Watch motion offers running/standing mount, cancel, early ollie, remount,
cruise/charge and carving. Pause points expose draw/load, board placement,
hop/catch, step-off, pickup, stow and stowed walking. Inspect both stances from
front, side and oblique views, at normal and MAX/native resolution.

Final validation for this revision passes:

- 8,480 paired native movement frames across eight scenarios and both stances,
  with exact controller parity. Transfer soles stay within 3.05 mm and fully
  gripping hands within 1 mm. Load soles stay within 1 mm in this matrix;
  the running load no longer folds a heel into the hip. Cancellation, early
  ollie, immediate remount, charge, carving and hidden stowing are covered.
- 1,344 paired ollie/charge frames and the 11,246-pose D contact regression
  pass, including grabs, grinds, manuals, lip stalls, flips and reverts.
- Production build/type-check and release-size check pass (803,535,769 bytes).
  No full-suite run. These checks do not authorize publication.
- Lite, full-render normal 720p and MAX/native browser review covers standing
  load, placement/hop/catch, both stances, step-off, pickup, stow and cancellation.
  Fourteen cancellation frames unwind continuously; observed sole error stays
  below 1.72 mm. Final stowed state has zero draw/grip and a hidden board.
  The console has no warnings or errors. Normal 720p/1× settings are restored.

The first passes drove fixes for running-knee overfold, unreachable tail-tap
and pickup poses, a changing board side, a remount hand switch and a native
turn snap. Visual review caught a diagonal deck path through the shins; the
final placement goes beside the shoes before sliding under the hop. This is a
validated local iteration for user review, not a claim of visual acceptance.

Current evidence directory: `skate-contact-mount/` under
`/Users/kiki/.codex/visualizations/2026/11/02/01a19bb4-0de7-79a1-9881-c7c1b3dd3dec/`.
The task worktree serves port 5189. Extracted Jak assets remain outside Git and
any release. No level-pack changes.

## Earlier source inspection

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

These informed the earlier study of state continuity and contact ownership. No external code,
comments, proprietary clips, game assets or timing constants were copied.
This is an original procedural Bone Man interpretation, not a claim of exact
Tony Hawk animation parity. In particular, our input must remain cancellable
and the physics switch cannot wait for a cosmetic mount animation.
