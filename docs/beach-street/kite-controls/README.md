# Beach Street — kite controls and contact

The kite pulls forward after a fresh face-button press. Spawn and death retries
wait in place with the kite aloft; controls held through death cannot restart it.
No menu or new HUD is added.

- **X / Space:** hold to charge normal skating speed and jump power, release to
  jump. The live normal tuning supplies acceleration, charge duration, the ollie
  curve and rail exits. Kite gravity supplies the longer float.
- **Left / right:** steer continuously against changing wind. Gust strength,
  direction and duration vary each run, ease smoothly, and move/roll the canopy.
- **Down / back:** slow to a forward crawl and store the removed kinetic energy.
  Releasing repays it smoothly. Repeated pulls cannot manufacture extra speed.
- **Square / F:** normal spin on the ground and board flips in the air.
- **Triangle / E:** normal grind catches, balance, tricks and charged exits.
  Grabs, board abandonment and specials remain disabled while towing.

Both arms face forward and hold separate ends of the bar. The final hand pass
uses the existing glove grip sockets, after the editable elastic skate pose and
foot planting. Full authored character and kite geometry is retained.

The optional bonus stone faces the camera at 72 degrees. A low straight approach
plants both actual soles against its face in a squat, keeps both hands on the
bar, then enters through the existing bonus transition. Steering around it or
jumping above the contact band continues the run. The ordinary horizontal pad
and deliberate-jump entry rules remain unchanged on other levels.

Most fatal kite impacts collapse the existing semantic body pieces onto the
floor. Both hands, sometimes with an arm fragment, stay on the bar and follow
the kite away. Water retains its existing drowning presentation. Life loss,
checkpoint restoration and the normal death timer remain authoritative.

Reward wood and checkpoints cannot become walls when a player is coasting or
braking. Solid hazards, dangerous crates, enemies and missed gaps retain their
normal contact rules and fatal kite bails. Five small spacing changes give the
wind-sensitive cutbacks more room: the cliff planter moves beyond the stairs,
the last-overlook cue starts sooner, the Surf/Lighthouse second planters move
five metres farther along, and
the Festival landing checkpoint moves four metres beyond its old station.
The approved coral ramps, teal barriers, cream edges and solid islands remain.

## Evidence

- `motion.json`: normal charge acceleration/duration, release edges, waiting,
  smooth stored-speed repayment, repeated-pull bound and two 60-second wind seeds.
- `native-controls.json`: native jump powers, spins/flips/grinds, no grabs or
  specials, planted soles, pad avoidance, trial/editor round-trip isolation,
  tethered collapse and fresh-input respawns.
- `native.json`: connected three-kilometre journey, 13 jumps, ten checkpoints,
  24/24 main crates, crystal/gem in the isolated progression fixture, fatal
  planter/hurdle/canal and checkpoint retry. The registered course keeps its
  linked bonus-box requirement for the gem. The guide clears retained stair
  footprints by at least 30 cm beyond the player's collision width.
- `pacing-review.json`: 42 reversals at 23 m/s with sustained maximum adverse
  wind; at least 0.319 s steering margin and 1.033 s from landing to next approach.
- `browser-controls.json`: real Chrome DOM-key controls, MAX grip/pad/death
  views, actual optional bonus entry and return, normal CRT presentation.
- `browser-full.json`: complete production traversal using DOM keys, with
  MAX/native captures, normal 480-line CRT play, full-canopy bounds and errors.
  The bypass route must collect all 24 main boxes; its skipped bonus boxes do
  not earn a gem.
- `release-checks.json`: exact `check:levels` script and production build.
- `verification.json`: final source/report hashes, validation scope and build.

Reproduce with the focused `tools/test-kite-motion.mjs`,
`tools/test-kite-controls.mjs`, `tools/test-beach-kite.mjs`,
`tools/review-beach-kite-pacing.mjs`, `tools/kite-controls-browser.mjs` and
`tools/beach-kite-browser.mjs` entrypoints. `BEACH_BASE` selects the local server;
`BEACH_OUTPUT` selects an evidence folder for browser/route checks.
`tools/validate-beach-kite.mjs --release-only` runs level checks and build;
`--build-only` records a later build. Run heavy jobs through the shared release
queue's `run_heavy.py` guard. Do not run `check:all` for this increment.

The feature branch is local. The appointed coordinator owns integration and
publishing. No global tuning or published level-pack snapshot is changed.

The independent review after handoff passes seven input-edge cases: coyote
release, single consumption, landing buffer, expired buffer, cancellation
overriding release, reset discarding pending charge, and each fresh face-button
start. This extends `motion.json` without changing gameplay or invalidating the
production build/browser evidence.
