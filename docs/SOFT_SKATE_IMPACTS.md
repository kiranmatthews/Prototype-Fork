# Soft skating impacts

Grounded board contacts below the existing bail-speed threshold now separate
the rider from the obstacle and reflect the incoming velocity outward, rather
than setting speed to zero and stepping off the board on the next frame.

`src/skateImpact.ts` supplies a deterministic, energy-losing response. Glancing
contacts retain along-wall travel; square hits gain a small lateral deflection.
Outgoing speed stays between 45% and 97% of incoming speed. No tuning defaults,
bail thresholds, damage rules or walking controls have changed.

The 0.42-second recovery adds a brief brace and decaying balance wobble to the
rider, before deck foot planting. It keeps the board mounted, pauses passive
rollout drag, and ignores held steering back into the impacted surface during
that brief recovery. Steering away and deliberate braking remain available.
Respawn, bail and dismount clear the recovery. There is no popup or camera cut.

The response covers fresh solid-box and curved-wall collisions, slow rail
contacts, closed trick gates, and frontal ocean-boundary contacts. Airborne
traversal, start-inside positional repairs, and high-speed impact paths retain
their existing behavior (including the ocean boundary's non-bailing stop).

## Verification

- `tools/test-ragdoll-recovery.mjs`: outward/energy bounds, head-on and angled
  contacts, pose endpoints, actual Player wall/curved-wall/rail integration,
  held-input rollout, intentional braking, walking exclusion, start-inside
  repair, respawn reset and unchanged high-speed bail.
- The exact-frame 9,551-frame historical `flats` vert replay explicitly uses
  its old contact response. Its first slow wall hit precedes the tested vert
  landing by thousands of frames; applying the new rebound changes that
  input-only recording's route. This exception is test-only and limited to
  that archive. Current collision behavior is tested directly above.
- Real Chrome, lite and full rendering: a supported flat test course with an
  ordinary wall, keyboard-held approach, outward velocity, continuous mounted
  deck, changing brace pose, high-speed bail and clean runtime errors.
- Full production build chain: all 90 commands passed, including level
  validation, traversal/animation regressions, TypeScript and Vite bundling.
