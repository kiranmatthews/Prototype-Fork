# Kite Indy — 5 November 2026

Circle / Q starts one kite-only airborne grab. The leading hand hangs from the
wooden bar while the trailing hand holds the Indy contact between the feet.
Left/right rotates the rider. Releasing rewinds the entire accumulated angle,
including whole turns, crosses the starting orientation, and settles finitely.
Touching ground or catching a rail while held or returning causes a wipeout.

A clean landing adds 3 m/s, stacking up to 12 m/s. Each successful landing
refreshes a five-second hold, after which the bonus decays at 3 m/s per second.
The bonus adds to charging, kite tension, perfect-grind and speed-pad speeds;
it does not replace existing momentum. Death, respawn and final kite release
clear the move and reward. Ordinary levels retain their directional grabs.

The return takes 0.48 seconds plus one second per 720 degrees of stored twist.
Its opposite overshoot is capped at 0.32 radians. The hand stays attached
through that rebound, then the second hand returns as the pose settles.
Independent arm/torso elasticity, actual grip IK and planted board contacts
preserve the character's existing stretch-and-rebound animation style.

## Focused validation

Passed:

```sh
node tools/test-kite-grab.mjs
BEACH_OUTPUT=docs/kite-indy/controls node tools/test-kite-controls.mjs
BEACH_OUTPUT=docs/kite-indy/spring node tools/test-kite-motion.mjs
BEACH_OUTPUT=docs/kite-indy/spring node tools/test-kite-spring.mjs
node tools/test-skate-tricks.mjs
npm run build
npm run check:release
git diff --check
```

The grab test covers both spin directions at 30/60/120 Hz, full-turn retention,
immediate reversal, overshoot, finite settle, early-landing failures, single
payouts, boost stacking/expiry and non-kite isolation. It checks both stances
through a full rotation, every unwind frame, the bar hand, Indy hand and feet.
It also checks that only the held wrist remains tethered during a failed grab.
Existing kite controls, spring physics and ordinary skating regression checks
pass without changing their expected results.

Actual Chrome review used `review.html` with the real game entrypoint and the
existing development-only launch-review hooks. The test controls submit fixed
input frames; they do not substitute a separate character or simulation.
Full rendering was reviewed at native MAX (3024 × 1612 / 1724) and normal 720p.
The visible journey confirms a 90-degree grab returns through a negative
overshoot, reaches `ready` before touchdown and lands with a 3 m/s boost.
At overshoot the hanging grip error was 0.00231 m; held Indy error was under
0.001 m. Warning/error logs are empty. The new guide page and keyboard paging
were checked through Pause → Options → Trick Guide in Chrome. The separate
legacy Playwright controller harness was unavailable because its dependency
is not installed; no automated controller-guide result is claimed.

`kite-indy-native.jpg` is the final unobstructed pose. JSON files beside the
screenshots record held, turning, overshoot, settled and landed states.
The fixture and evidence are authoring-only and are not release entrypoints.

First playable implementation: 06:38 UTC, approximately 13 minutes after the
06:25 UTC brief start. Contact refinements and native review followed. The
task uses the published kite art; no new models, level data or tuning changes.
