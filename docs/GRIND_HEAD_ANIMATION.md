# Grind head animation stability

The supplied `replay-JungleCup-2026-09-12T03-13-13.json` reproduced repeated head flips during a lipslide, starting around frame 592. With the same recorded inputs/tuning and render/overlay restoration, the old pose code reached a 172.92° local head rotation change between adjacent grind frames. Both versions traversed 262 grinding frames.

The procedural head pitch/yaw smoothing read `head.rotation` from the previous pose. Render interpolation and authored-pose restoration copy quaternions back to bones. Near a sideways gaze, that equivalent quaternion can be expressed as XYZ Euler angles with pitch/roll flipped by π. The next procedural step then tried to smooth that artificial pitch back toward its gaze target while separately resetting roll, creating a real orientation flip rather than just a different numeric representation.

Head pitch and yaw now have independent procedural smoothing state, with wrapped yaw deltas. The complete base head rotation is written from that state each step, followed by the existing balance counter-roll and authored overlays. Respawn clears the smoothing state. Authored head tracks still have final authority.

A second issue kept a park rider facing `axisF`, which remains the original catch heading while grinding. Curved grinds now derive body facing from the current rail tangent and travel direction. This preserves the per-trick yaw offsets and prevents the head from twisting around to compensate for stale body facing.

## Verification

- 24 straight/curved, mirrored cross-grind cases cover render interpolation and authored overlays both on and off. After settling, the largest local head turn is 0.751° per step; rendering changes the procedural trajectory by less than 0.001°.
- The full 3,603-step supplied replay retains 262 grinding frames and no repeated flips. Its largest adjacent head turn is 15.58°, including actual trick transitions.
- Authored head overrides remain authoritative and a respawn returns to neutral tracking state.
- Existing grind-input and camera checks pass, including 16 catches, 553 straight/curved grind frames, 14 exits and full rider framing.
- Real-browser comparisons reproduce the old 160° alternating feedback and show stable fixed motion in both directions, with lite and full rendering and no console errors. Build passes; no full suite was run.

`tools/test-grind-head-stability.mjs` owns the regression and supplied replay fixture. `grind-head-review.html?playtest&level=jungle-cup` provides a local visual comparison with balance held constant. Its “Old feedback” button recreates the rejected bone-angle feedback solely for review; it is not part of production gameplay.


## 2026-10-18: mirrored cross-grind gaze

The deck-aligned upright posture can face the hips away from travel in half the Boardslide/Lipslide combinations. The existing 20-degree shoulder opening left the neck pinned at its 1.45-radian limit, with the eyes about 67 degrees off the rail on Boardslide and 87 degrees on Lipslide. The shoulders now share that turn, capped at a quarter turn and blended through the existing cross-grind pose. A consistent turn side across the 80/100-degree deck bias prevents a look-direction flip when switching Lipslide to Boardslide. The neck limit, independent head state and final authored overrides remain intact. Hips, planted feet, movement and tuning are unchanged.

The settled gaze now follows travel on Boardslide and stays within 17 degrees on the backward-facing Lipslide. Actual production character views confirm the independent shoulder turn without disturbing the upright planted stance. The legacy rail-air assertion demanded an older deep squat and board-nose torso alignment; its replacement checks the accepted deck-aligned hips, shallow world-space knee flex, opposing ten-degree slide biases, bounded shoulder/neck turns and gaze in 32 combinations of style, stance, input side, travel direction and deck orientation. The saved original Player fails the new gaze assertion, confirming that the regression detects the actual defect. In eight matched before/after poses, sole heights, foot separation, board direction and knee transforms are identical.

The expanded head test passes 16 native catches through switching, side-hop exits, landings and sixty settled frames (4,976 controller frames). Eight cases exit directly from the cross grind; eight switch Lipslide to Boardslide to normal first. Peak head change is 7.12 degrees per step, shoulder change 11.14 degrees and sole error 2.574 mm. The 24 curved/straight render-restoration cases, recorded replay and camera test also pass. Current movement defaults produce 162 grind frames in that older replay, with a maximum 15.60-degree transition and no repeated flips. Render-restoration divergence is 0.00577 degrees in this run.

The gaze repair alone left catalogue revision 30 unchanged: both saved ordinary grind studies use the forward-facing stance/cross-direction pairing. The isolated baker probes and the legacy posture fixture exposed neutral hops back onto a solid rail. The subsequent revision-31 capture pass repairs their exit inputs, refreshes the nine ordinary/Darkslide studies and verifies native side hops and landings; see `docs/SKATE_REVIEW_SHEET.md`. The gaze regression also uses actual held side-hop intent to land clear of the bar.

The production build, three lite course views and the final 243 metres in full rendering pass without asset or console errors. All eight riders finish with four lives and zero falls/deaths; results-to-solo-trial passes. This is not another complete-course run. Evidence: `docs/waterslide-island/evidence/cross-grind-gaze-validation.json`. Everything remains local under the slow-network hold.
