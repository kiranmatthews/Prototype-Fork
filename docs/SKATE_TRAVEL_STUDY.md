# D board travel study

Local A/B/C/D exploration; do not integrate or publish this branch. D owns the
new skate presentation. A/B/C, live UI tuning, hold-to-skate/release-to-jump
controls and the physical movement model retain their existing behavior.

## Corrective direction — 5 November 2026

The user rejected the previous always-visible back carry, stretched-arm grab,
board placement and pickup. Those routes have been removed. The prior contact
checks passed but did not establish acceptable motion or silhouette quality.
The user's spin-smear suggestion was misread in that implementation.

The board is now stowed while on foot, including preparation and cancellation.
A committed mount or grounded dismount uses the existing current-character
spin smear for 0.20 seconds to cover the inventory swap. This is presentation
only: it does not trigger a spin attack, change movement, add a boost, consume
an input or alter spin cooldown/scoring. The normal mounting hop continues.
There is no carried-board pose or hand-to-board reach.

The rear foot pushes outside the toe edge in both stances. The prior sign put
it on the heel side and crossed the legs. The front shoe stays on the deck;
the rear shoe rotates toward travel, briefly plants against the ground, lifts
and returns. The pelvis stays over the supporting truck. The rider opens the
support leg during a kick instead of combining the ground reach with a full
charge squat. Low, bent balance arms replace the raised on-foot charge wind-up
while riding. Turn lean follows actual heading changes.

A held full charge finishes the current push, plants both feet and visibly
lowers the knees and torso. Shared elasticity profiles deform the torso and
arms independently; planted leg lengths and whole-rider scale are unchanged.
Tricks, grinds, vert, bails and separate loose boards keep their normal owners.

## Review

Watch motion includes mount/stop, cruise/charge, cancellation, early ollie,
carving and remount. Pause points expose preparation, mount smear, native hop,
planted push, recovery, cruise, full charge, dismount smear and stowed walking.
Review both stances from the front, side and oblique angles at normal and native
resolution. Diagnostics expose the real spin presentation, knee angles, charge
and foot contacts. The inspection floor/gate keep long takes in the review.

Validation is in progress for this correction. The earlier proof directory
`skate-travel/` belongs to the rejected increment and is not evidence for this
revision. New evidence belongs to `skate-correction/` under
`/Users/kiki/.codex/visualizations/2026/11/02/01a19bb4-0de7-79a1-9881-c7c1b3dd3dec/`.

The task worktree serves the review on port 5189. Existing port 5188 is preserved.
Extracted Jak assets stay outside Git and the release. No level-pack changes.

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
