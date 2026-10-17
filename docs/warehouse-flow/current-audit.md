# Warehouse flow audit before the rebuild

Audited source: `2ecd11dab83aed499808b25c341866d41146ef72`, 17 October 2026. This describes the old course, not acceptance evidence for the replacement. Source inspection covers `src/levels/codex-lab.ts`, `warehouse-geometry.ts`, `warehouse-dressing.ts`, shared movement/collectathon code, and the existing native/browser pilots. The existing native warehouse harness was rerun successfully; detailed output is in `/private/tmp/warehouse-flow-audit-baseline.json` during this session.

## Concrete failures

### The skateable space has far more travel than decisions

The enclosing floor is 176 by 252 metres, or 44,352 square metres. Its three main central islands are around Z −28, −91 and −143: their centres are 63 and 52 metres apart. At the authored 12 m/s cruise speed those centre-to-centre separations alone are 5.25 and 4.33 seconds. There are smaller connectors, but the majority of the room is empty flat travel around isolated objects rather than sequences of usable obstacles.

The continuous perimeter quarter-pipe is a useful circulation device, but its 136 by 204 metre outline is too remote to act as a frequent return into the central session. The east service ramp occupies a great deal of the right side while supplying only one principal destination. The course has floor connectivity but weak action connectivity.

The saved normal arrival frame (`docs/art-reviews/warehouse-wall-bays-arrival.png`) visibly supports this diagnosis: most of the lower two-thirds of the view is featureless balcony surface, the arrow communicates only forward travel, and the useful obstacles are small and stacked near the horizon. This is a geometry/framing relationship to fix while retaining the shared competition camera. A cutaway (`warehouse-tall-cutaway.png`) shows the long service ramp, sparse floor islands and upper routes concentrated toward the back half of the room.

### Three rewards are one long expedition

The lower goals are a loading-dock gap and gallery grind. The other three occupy the service loft at 18 m, gantry at 28 m and roof shelf at 32 m. There is no logical requirement to collect them in sequence, but their principal spatial arrangement is serial: long east ascent, loft transfer, lift or rising service rail, transverse gantry, narrow roof catwalk. Going to the highest area largely repeats the setup for the preceding two. The crane rail is an alternate to the lift, so the lift must not be described as strictly mandatory.

The roof return only returns to the gantry. It does not immediately reconnect to a new floor session; the player must choose another descent. The exit sits on the arrival balcony, and existing tests never demonstrate a continuous all-goals-to-exit run. These are topology problems, not collectible-count bugs.

### Elevated traversal repeatedly stops the action

The existing successful input pilot measured the following native timings. They are proof of traversal and pacing cost, not a judgment inferred from names:

| Upper stage | Seconds | Speed at stage end |
|---|---:|---:|
| Service ascent | 9.52 | 0.05 m/s |
| Loft launch staging | 2.38 | 0 |
| Loft transfer | 2.03 | 12.00 m/s |
| Lift staging | 0.85 | 0 |
| Waiting for the lift | 4.23 | 0 |
| Boarding lift | 1.98 | 12.11 m/s |
| Lift ascent | 3.80 | 0 |
| Gantry arrival | 2.93 | 12.62 m/s |
| Gantry grind | 4.32 | 10.80 m/s |
| Leaving rail | 0.18 | 12.45 m/s |
| Roof catwalk | 2.77 | 12.93 m/s |
| Roof transfer | 0.67 | 12.93 m/s |

This upper itinerary totals 35.67 seconds, excluding some stopping/steering operations outside the stage records. The separate roof return takes 7.43 seconds and ends at rest. The arrival drop takes 5.98 seconds and also ends at rest because the test requests a stop. These measurements show both the old course's transport burden and the pilot's habit of braking rather than testing momentum handoffs.

### More detail did not provide a readable hierarchy

Most low riding surfaces share similar concrete values, rounded silhouettes and height ranges. Long rails and suspended ribbons overlap in the moving view. The existing wall assets are appropriate fixed constraints, but uniformly distributed architecture, 25 light fixtures, repetitive pillars and many slim hanging members do not identify the route to the five different feats. Surface material contrast alone cannot distinguish approach, launch, receiver and continuation.

The halfpipe is visually distinct in plywood, but its lengthwise openings do not align into a deliberate vert-to-street trick sequence in existing validation. The gallery's climbing rail begins behind the pipe via a small perimeter discovery bank. That is physically reachable; the test supplies its exact points and cannot establish that an unfamiliar player would see the setup.

## Native constraints the new geometry must accommodate

No movement tuning changes are needed or proposed. `parkCruiseSpeed` is 12 m/s and charged target speed is 23 m/s. Warehouse selects `Player.stepParkGroundMotor`: its native `SKATE_PARK.turnRate` is 1.8 radians/second (about 103.1 degrees/second), with a sharper 3.6 radians/second while braking. The general `carveGripAtSpeed` curve applies to non-park movement and must not be used to infer this park's turning space. A first-order constant-speed, full-steering radius is therefore:

| Speed | Steering rate | Approximate minimum radius |
|---|---:|---:|
| 12 m/s | 103.1°/s | 6.67 m |
| 18 m/s | 103.1°/s | 10.00 m |
| 23 m/s | 103.1°/s | 12.78 m |
| 30.5 m/s (illustrative fast entry) | 103.1°/s | 16.94 m |

These are kinematic estimates from code, not measured guarantees: slope, grip, rail capture and input frame affect actual traversal. They explain why a compact six-metre ribbon turn can pass an auto-braking pilot but fail as a fast momentum line. Fast bends need generous radii, a deliberate bank/transition, or a grind capture. A low-speed exploration branch may be tighter if its setup clearly invites slowing down.

Combos are also much more demanding than simple waypoint circulation. `CONST.comboWindow` is 0.15 seconds; clean landings/reverts refresh `TUNING.manualLandGrace`, currently 0.65 seconds. At cruise the latter represents about 7.8 metres, and at 23 m/s about 15 metres, before a manual or next trick must connect. Air, grind and active manual states hold the combo clock. A meaningful cross-area combo test must exercise these mechanics. A statement such as “obstacle every three seconds” is not itself proof that the obstacles link into one combo.

Park ollies also have their own native charged/tap velocities in `skateParkPhysics.ts` (350–432 inches/second converted to metres) and 0.2-second full charge. Do not infer their trajectory from the non-park ollie tuning. Do not replace challenge design with impossibly tall flat-ground jumps or change jump values to force a route through. Ramp launch, vert pumping and grind departures are existing higher-reach verbs.

`warehouseRibbon` is a closed solid ribbon with grindable top boundaries. It samples a Catmull-Rom path approximately every 1.4 m and clamps its Y extent to author control-point minima/maxima. Horizontal turns can still be tighter than the board can follow; clamping Y does not establish safe slope or curvature. `warehouseIsland` is a centre fan with a flat top, surrounding bank and skirt. Its all-around approach is valuable when the next action is actually placed around it.

## A compatible replacement arrangement

The following is a proposal, not a universal THPS measurement or a requirement to copy exact coordinates. Start with roughly a 110–125 m wide by 150–170 m deep skateable room, then validate against real full-speed turns and the competition camera. This is approximately half or less of the current floor. Retain the tall industrial ceiling if required by the existing architecture, while bringing the main skating layers into 0–8 m and reserving one exceptional higher route. Refit the original Meshy wall section geometry/materials when changing the shell; do not generate replacement wall texture tiles.

Build a visible central cross-link rather than placing all low islands on one north/south axis. Put a four-way hip or low stepped funbox under the crane landmark. One diagonal should connect the arrival/dock session to the far bank; the other should connect halfpipe exit to workshop street. Keep at least two ways around the centre and two ways through it. Use the wider perimeter bends for charging, with local loops inside for precision and retrials.

Make each destination a local session with a readable setup and useful return:

1. **Dock gap:** A 2.5–4 m dock with a deliberate 5–7 m gap, broad receiver, adjacent grind option and sloped return toward the central hip. Failure falls onto ordinary floor, outside a closed slot. Gap dimensions must be confirmed with measured takeoff speed.
2. **Vert gallery:** Shorten/reposition the pipe so an open end faces a useful street landing/rail. Place the reward on a clearly visible side gallery reached by a local pump or climbing grind, with a separate low approach and a return toward the other pipe end.
3. **Workshop roof:** A 5–7 m roof with two opposed banks, one more direct charged gap and a low deck that can be re-entered from either direction. This is a skating spot, not an 18 m destination reached by a long road.
4. **Crane line:** A central elevated grind/transfer sequence about 8–10 m high, approached from a local rising rail or bank. It should visually cross the central action without making a solid lid over it, then feed a bank in a different district.
5. **High maintenance route:** One exceptional narrow route about 12–16 m high with a distinct approach off the ground circulation network. It may link to the crane line for expert combination, but must have its own normal entry and a legible descent/catch beneath it. Reserve the biggest setup and height for this one challenge.

Those suggested heights deliberately reduce travel burden; final authored dimensions must follow actual native tests. If a higher roof destination remains necessary, it needs a short credible ramp/grind/vert setup and a fast local retry rather than another long serial climb.

The main circuit should not resemble a race track with five exits. Each local spot needs at least two different actions and a cash-out, and at least two cross-links should let the player change which local loop they are in. A missed challenge should become a lower option rather than a stop between scenery and a deck underside. Keep props/supports outside both the skater landing envelope and camera corridor.

## What the current tests actually prove

`test-warehouse.mjs` proves the old source normalizes, its selected routes are reachable using the pilot, one pipe air returns, one curved S-rail plus spin scores, tokens reset correctly, one checkpoint works and the exit state can trigger. It explicitly requires the old expansion: at least 2.4 times the original floor, 48 m ceiling, exact old token heights, exact 42 m pipe, minimum ten curved rails and thirty supports. Those are historical implementation constraints, not quality criteria, and should be replaced where the new brief changes the geometry.

`warehouse-pilot.mjs` calls `place()` independently for the dock, gallery, upper route, pipe and combo. It resets position/heading directly. `follow()` obtains the next authored coordinate, uses feedback steering, applies automatic brakes for turns, and usually stops at the endpoint. `rideRibbon()` reads the mesh's exact generated centreline. This is valuable mechanical coverage but supplies information and control an unfamiliar player does not have.

`warehouse-flow.mjs` follows an eleven-waypoint circuit around open ground and returns up the spawn drop. It proves connected clear floor, not chained tricks, route choice or readability. The 13 m/s speed cap and feedback brakes exclude a fast approach to many turns.

`test-warehouse-browser.mjs` additionally proves real keyboard walking, mounting and braking; full/lite runtime state; production-shaped rendering and clean console. Its main challenge functions run many synchronous fixed simulation steps inside `page.evaluate`. There is no rendered camera view between those simulation steps. It therefore does not prove moving-camera readability, even though it uses the same native player simulation. Its finish check teleports to the exit.

`test-warehouse-art.mjs` appropriately checks styled versus unstyled triangle support, boundaries, material-side semantics and recorded movement invariance. It currently assumes `movers[0]` is an 0.8 m freight lift. If the lift is removed, preserve the generic primitive-dimension invariant instead of requiring the old feature. Art should remain mechanically neutral; layout does not have to remain identical to this old design.

`test-warehouse-collision.mjs` protects a real historical side-exit failure. Its replay frames, coordinates, three ribbon names and low-rim sampling belong to the old arrangement. Preserve the underlying bug as a fixture-level regression, then add new authored-rim coverage. Do not force new geometry to match the old route merely to keep its old positional assertions green.

## Acceptance evidence for actual flow and independent access

- Run from the normal spawn through each of the five challenge entries with zero position/heading mutation after initial spawn. Record pickup order, time, speeds, bails, stops, support names, meaningful action events and return to central circulation. Reset between runs so no prior collectible or checkpoint access is silently required.
- Complete all five in at least two materially different orders and return to the real gate continuously. Token collection cannot happen from underside/adjacent geometry. Demonstrate every reward's exit, not just the moment its box is touched.
- Test at least three closed local sessions, two cross-area shortcuts and both main circulation directions. Each session should include useful approach, commitment, landing, continuation and local retry, rather than just a polygonal route.
- Demonstrate at least three real combos crossing spot boundaries. Include vert/revert/manual-to-street and raised-route-to-ground continuation. Inspect native combo identity/timer/score events to ensure the combo did not bank in the middle. Distinguish one long grind from a varied multi-action sequence.
- Test ordinary cruise and full charged approaches; inspect input braking and minimum speed. A route that only works through a full stop is an exploration route, not a claimed momentum link.
- Deliberately miss every major transfer short, long, left and right, then recover and retry with real controls. Probe under decks and across their low rims at walking and board speeds. Keep the previous collision fix and optional walking behavior.
- Run browser pilots on rendered frames with the actual competition camera. Save a continuous gameplay recording or sequential frames through spawn, junctions and commitments. Verify the next receiver before takeoff, an obvious place to go after landing and camera clearance during a miss. Do not rely on teleport-and-settle hero screenshots or editor cutaways.
- Review the moving footage without waypoint overlays. Record specific ambiguous choices and fix them. A bot following exact vertices cannot establish first-time comprehension.
- Keep five collectibles, ordinary grindable edges, the shared competition camera, optional walking and original Meshy wall materials. Retain source normalization, checkpoint/recovery/gate checks, full/lite rendering, bounded resource/performance checks and clean console. None substitutes for the separate qualitative review.

This baseline audit is complete. The rebuilt course remains unproven until new geometry and current-state evidence meet those requirements.
