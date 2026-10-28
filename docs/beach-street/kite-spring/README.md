# Faster kite handling, manuals and finished course boundaries

Local goal started 2026-10-28 07:17 UTC. The connected native course passed at
07:44 UTC; the playable production preview was rebuilt and opened at 07:58 UTC
(about 41 minutes from prompt to browser-playable). The user's subsequent
corrections restore the original lateral steering, slow the gust cadence, and
shorten the brake threshold to one second; their production preview opened at
08:20 UTC. Integration and publication
belong to **Coordinate local work and releases**.

## Behavior and intent

- Gust targets change every 3.5–6.5 seconds, usually reversing, with stronger
  lateral wind force and a smooth response. Player steering retains its
  previous 9 m/s speed and response; the requested speed increase is forward.
- Coast speeds are 16.2 / 18.225 / 20.25 m/s through the three districts; full
  charge is 31.05 m/s. Down slows to 7.5 m/s. These are kite-only changes;
  ordinary movement and live jump tuning are unchanged.
- Down loads a spring for at most one second. Letting go unwinds the counter
  and returns energy together; repressing resumes the remaining counter.
  Reaching the limit releases the load in 0.16 seconds, with a bounded maximum
  speed of 37.26 m/s. Holding Down after that cannot immediately reload it.
- Normal up/down and down/up manual flicks, balancing, score, landing buffer,
  jumping out and fatal balance bails work while towing. Balance input does not
  simultaneously brake. A bonus pad ends the manual before seating the rider.
- The actual eye socket faces down the course. Cruise/slow-speed body sway is
  reduced, with the original amount available at maximum charge. Both hands
  retain the bar and the correct wheels support each manual.
- The complete kite flies 28 m ahead and 8.5 m above the rider, with more line
  length in narrow views. Full asset geometry is retained at every distance.
- An invisible wall closes the starting terrace. A stone end wall, cream
  coping, railing and complete closing pavilion finish the final overlook.
  The existing release 20 m before the gate, free walking and deliberate foot
  jump to finish are preserved.
- Three reward boxes move beyond their new faster landing points. Chicanes
  receive longer turns and a 3 m lane guide; the narrower freight passes use
  1.7 m guides instead of unnecessary full-width crossings. Canal approaches
  and landing checkpoints leave time to align against a sustained gust. The
  first complete stair set moves 35 m down the same flat slab so its side does
  not intersect the opening chicane's exit. Jump guide arcs follow the longer
  flights. The approved contrasting surfaces and solid islands remain.

## Validation

`motion.json` covers faster speeds, partial release/repress, automatic burst,
bounded repeated pulls, slow-start tension, two seeded minute-long wind samples
and seven jump/reset/input edge cases.

`native-spring.json` covers both manuals, scoring, wheel support, hand/foot
contacts, jump exit, buffered landing, fatal balance loss, the exact 60-frame
brake limit, gaze and sway at three speeds, and actual start/end collision.
Measured eye-direction dot product exceeds 0.999; low/cruise yaw ranges are
less than half the maximum-speed range. Start containment stops the feet at
z=23.47; the finish stops them at z=-3027.77, including a jump attempt.

`native-controls.json` covers normal charge power, ground spin, flip, grind,
rail exit, break-apart hand tethers, fresh-input respawn, braking through a
reward box, automatic bonus entry, manual-to-pad contact, bypass and trial /
editor lifecycle. The existing `test-balance-reentry.mjs` also passed after
extracting the shared manual handlers without changing their behavior.

`native.json` completes all 3 km with 13 jumps, ten checkpoints, all 24 main
boxes and the crystal, then waits on foot and deliberately jumps to finish.
Separate deliberate obstacle/canal failures and checkpoint retry pass.
`pacing-review.json` measures at least 0.307 s steering margin under sustained
adverse wind and 0.523 s of landing space before the next turn approach, at
31.05 m/s. Optional spring overspeed is a player-chosen additional challenge.

`release-checks.json` records the required `check:levels` command and production
build. Both passed. No `check:all` was run. The build stamp is
**Codex/sol fork · build 10-28 08:18 UTC**.

`browser-lite.json` and `browser-full.json` both complete the corrected build
through real DOM keyboard events and live, unmodified wind. Each run collects
24/24 main-course boxes and the crystal, clears all 13 jumps and ten checkpoints,
stops after the kite release, walks sideways and backwards, then jumps to
finish. The linked 36 bonus boxes correctly withhold the all-boxes gem. There
are no crashes, console errors, failed requests, asset errors, reduced scenery
meshes or clipped canopy samples. Maximum measured hand-to-bar error is below
0.06 mm. Full resolution and the normal CRT presentation were both reviewed.

`browser-controls.json` passes real keyboard partial-release/repress and forced
spring, both manuals with score and jump exits, native charge/flip/grind,
automatic bonus contact, retry bypass, fatal tethered collapse, stationary
respawn, normal finish release and the invisible start boundary. The sampled
counter moves 0.85 → 0.417 → 0.617 → 0 seconds; the forced spring reaches
34.85 m/s. Both manual gaze samples have dot product 1.

`browser-framing.json` passes all 16 combinations of maximum wind and steering
across 1600×1000, 815×850, 480×900 and 900×480. This explicit stationary render
fixture includes wind drift in maximum lateral velocity and projects every
vertex of the complete canopy. It does not claim input-only traversal.

`bonus-retry/browser-full.json` passes two actual kill-plane failures, unchanged
lives/inventory, a supported stationary return 16 m before the pad, actual
second entry, optional bypass and the completed-return branch. The latter is
an explicit transition fixture, not a claim to have cleared all bonus boxes.
All focused browser checks have zero console errors or failed requests.

The final production build version is `b6a2099c3d6e8c1a0474`. Source, tools,
reports and captures are hashed in `verification.json`. No runtime or level
changes were made after that build.

The finish overview and close view show a complete pavilion, end wall and
balustrade. The skater can stop and choose the final jump. Manual side views
show the appropriate wheel support, with both hands held on the control bar;
the front view confirms forward gaze. No asset silhouette was simplified.

Current repository coordination is retired; this chat's explicit local-only
instruction remains in force. The immutable source commit and evidence are
handed off through the shared inbox without waiting for a release.
