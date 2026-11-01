# Natural airborne grind landings — 2 November 2026

An eligible grind request no longer ends a flight early when its existing
trajectory will land on the rail. The skater keeps ordinary movement and
gravity until the board reaches the rail, then completes the remaining
fraction of that physics tick along it. Approaches that would miss retain the
existing proximity assistance. No movement tuning, capture radius, authored
level data, or visible geometry changed.

The forecast uses the flight gravity function and carried lateral momentum,
with the park integrator and kite gravity where applicable. It examines the
finite authored polyline, including slopes and curves, with a maximum of 180
fixed samples (three seconds). It only runs after the existing capture guards
accept a candidate and rechecks the trajectory each tick. Actual contact uses
a downward swept sole crossing, so a fast fall cannot skip over the rail.
An accepted tap stays armed for that rail until its predicted landing plus two
ticks; entry, respawn, bail, and invalid targets retire it. Scripted tongue
assistance and ordinary ground catches retain their existing path.

Validation:

- `test-natural-grind-landings.mjs`: 220 real Player flights, covering campaign,
  park and native reference controls, both directions/yaws, taps/holds,
  rising/falling/fast approaches, slopes, curves, transfers and slide momentum.
  Kite cases cover wind during a short descent and a calm high arc lasting 96
  flight frames. Every pre-contact position and velocity matches a control
  player without a grind request. Four misses retain immediate assistance;
  contact height, finite endpoints, upward sweeps, disappearing rails and
  respawn are also checked. The old entry path reproduces the early catch.
- Catch-buffer regression: all three recorded released-button approaches
  succeed, including catches on the original impact frame; 44 input cases pass.
  Fixture-only initial catches now start at the actual rail riding height.
- Trick-speed regression: 40 cases / 7,893 controller frames pass, preserving
  scoring, speed rewards, failures, balance and replay behavior.
- Rail-air transfer, moving-solid support, platform-edge grinding, kite controls
  and the nearest-rail query regression pass (5,169 exact samples).
- Production Chrome checks exercise 16 real keyboard flights/catches on authored
  Jungle Cup and Sky Bridge rails in lite and full rendering. Normal and native
  1280×720 stills show approach/contact; paused side views make the feet and
  rail visible. Gameplay flight checks use the ordinary camera. Console, page
  errors and failed responses must all be empty.
- TypeScript/build and release-size checks pass: 999,171,569 bytes. No full suite
  was requested or run.

The optional original-C++ rail-query oracle could not run because its external
`/private/tmp/mall-recreation/research` source cache is absent. Its production
query is unchanged; 72 native-reference Player cases and the separate current
nearest-rail regression pass.

`runtime.json` contains the numeric landing evidence. `browser/review.json`
records the production build stamp, paths, contact points and error inventory.
The initial browser script used an obsolete Slipstream fixture that is now a
race; its player does not use that harness's step hook. The final check uses
the current campaign Sky Bridge rails. No game change was needed for that
test setup correction.

Approximately 30 minutes from the brief to the first validated playable build.
Direct publication remains authorized by the user's instruction that the
release coordinator is inactive. The release handoff records the immutable
commit, matching Pages run and final public verification.
