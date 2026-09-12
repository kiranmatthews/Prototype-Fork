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
