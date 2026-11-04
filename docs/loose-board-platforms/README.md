# Loose skateboard support — 4 November 2026

Loose boards used a floor normal but discarded the supporting mesh. Settled
boards were permanently batched in world coordinates. Both stages therefore
left moving platforms behind.

`src/skateboard/discarded.ts` now retains the supporting mesh and its prior
world transform. Active boards receive that transform once per caller step,
then coast in the surface frame. Leaving the surface restores its current
travel velocity. Sleeping batches live in support-local coordinates and share
the platform render transform; one check per occupied surface keeps retained
hit-test poses current. Removed/falling support wakes its boards. Breakage,
spin hits, reset/disposal and borrowed resource ownership remain intact.
Batches explicitly opt out of scenery collision so a board on a platform
cannot turn into another level collider.

Validation:

- The new regression failed on the old implementation on the first moving
  frame (6.67 cm drift). It passes horizontal, vertical, orbit/rotation,
  coasting, single-step handoff, airborne exclusion, disappearing/falling
  support, spin/breakage, cleanup and 30/60/120 Hz departure-momentum cases.
- All 29 authored Tribal Run movers carried actual procedural skateboard
  assemblies for 30 seconds after settling: maximum local displacement
  4.1e-10 metres, zero lost boards. A static-ground batch also leaves the
  world's collider count unchanged.
- Existing discarded-board tests pass: 120-board batching, snap/fold, spin,
  remount handoff, interpolation, clear/dispose and shared geometry ownership.
- Existing dynamics tests pass 61 trajectories with zero sleeping collision
  queries. Movement tuning and authored level data are unchanged.
- Lite browser: real ferry for 51 seconds and lift for 39 seconds, with zero
  displayed support drift. Full-render MAX/native orbiting drum: over a
  minute, settled, grounded player, zero displayed drift. Normal presentation
  and coasting are also checked. The visible review fixture is local-only.
- Type-check, production build and release-size check pass. No full suite.

Prompt to browser-reviewed fix: approximately 15 minutes (23:50–00:05 UTC).
The release is published through the normal origin/main Pages workflow.
