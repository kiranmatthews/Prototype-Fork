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
spin smear briefly to cover the inventory swap. This is presentation
only: it does not trigger a spin attack, change movement, add a boost, consume
an input or alter spin cooldown/scoring. The normal mounting hop continues.
There is no carried-board pose or hand-to-board reach.

The user then rejected the kick-push itself. It is removed entirely: ordinary
cruise keeps both feet on the board. Low, bent balance arms and heading-driven
turn lean remain.

D's mount load now starts earlier in the real `skateHoldTime` meter and
converges on a deep supported crouch height measured from Bone Man's legs.
This suppresses the running bounce as the hold fills. The chest folds, the
arms draw back, and independent torso/arm segments compress more strongly.
Planted soles stay fixed; lifted stride feet gather down and underneath the
hips, with reach constrained in their actual parent frame. The solver must
not fold a heel into the hip or demand a longer leg during cancellation.

Releasing direction unwinds over 0.32 seconds with the incoming compression
velocity retained. Re-pressing starts from the current load, and releasing
jump before commitment still invokes the normal release-to-jump behavior.
No board appears during anticipation or cancellation.

D alone uses a 0.40 m visual spring over 0.36 seconds and a 0.16 second soft
catch. Independent torso and arm stretch is visible after the 0.10 second
mount smear ends; the grounded dismount retains its 0.20 second cover. The
board and physical movement keep their native path. A/B/C keep the original
mount timing and pose. Kick-push and hand-fetch routes remain removed.

A held full charge keeps both feet planted and visibly
lowers the knees and torso. Shared elasticity profiles deform the torso and
arms independently; planted leg lengths and whole-rider scale are unchanged.
Tricks, grinds, vert, bails and separate loose boards keep their normal owners.

## Review

Watch motion includes running and standing mounts, cruise/charge, cancellation, early ollie,
carving and remount. Pause points expose preparation, mount smear, native hop,
loaded preparation, cancelling/cancelled preparation, spring/catch, cruise, full charge,
dismount smear and stowed walking.
Review both stances from the front, side and oblique angles at normal and native
resolution. Diagnostics expose the real spin presentation, knee angles, charge
and foot contacts. The inspection floor/gate keep long takes in the review.

Validation of the deeper mount is incomplete. The first 7,420-frame native
pass exposed an overfolded lifted leg; the gather/reach corrections address
that failure and require the expanded 8,480-frame rerun. The current pure
envelope check passes 726 samples across three hold durations and 30/60/120 fps.
Five modified TS modules transpile, the test parses, and whitespace checks pass.
Lite review includes planted standing load, moving gather, exposed spring and
finite cancellation. The corrected 14-frame unwind review has at most 1.33 mm
sole-target error and 19.8 mm unplanted reach correction. The standing load
keeps planted sole error below 0.8 mm; cancellation ends at zero with no board.

The shared heavy-work helper returned 75 again at 21:59 UTC on 4 November
(10:59 NZDT on 5 November), with both slots reserved. No heavy job is running
for this chat. The native movement/contact/ollie rerun, production build and
normal/native full-render review remain pending. This is a local authoring
checkpoint, not validated or READY; older evidence cannot validate this revision.

Current evidence belongs to `skate-mount-rubber/` under
`/Users/kiki/.codex/visualizations/2026/11/02/01a19bb4-0de7-79a1-9881-c7c1b3dd3dec/`.
Earlier `skate-travel/` and `skate-correction/` evidence describe earlier versions.

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
