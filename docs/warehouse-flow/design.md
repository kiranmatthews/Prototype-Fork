# Warehouse rebuild: session spaces before objectives

## Research decisions

The original room had 44,352 m² of floor and a 35.67-second upper sequence joining three goals through a lift. Its navigation tests stopped at each destination and never evaluated the moving competition camera. The rebuilt room has 18,096 m² of floor (59.2% less), keeps the 48 m architectural shell, and concentrates the main session at 0–6 m. Five reward branches are independently accessible from the floor; no elevator, serial unlock or mandatory roof tour remains.

The research in [map observations](research-maps.md) and [developer principles](research-principles.md) led to these specific decisions:

| Evidence | Layout decision | Acceptance |
| --- | --- | --- |
| Warehouse and Hangar reuse nearby surfaces and return to their central spaces | Manual pad → central hip → north pump; halfpipe west, workshop east; grind links cross the same spaces | Continuous normal-render session, linked native tricks, no forced stop |
| School II routes reconnect; optional goals should not define all circulation | Each goal has its own ground approach and downhill exit | Collect in different orders; safe missed attempt and retry |
| Marseille/Burnside favor repeated local sessions with transitions at the edges | Open-ended standalone halfpipe plus two separated return quarters | Native pumping and re-entry; floor openings remain usable |
| THPS connection moves depend on receiving surfaces and short transitions | Broad aligned receivers, short air gaps, low manual islands and adjacent rails | Actual native ollie/grind/manual timing, not proximity alone |
| Readable landmarks and on-camera receivers precede a commitment | Distinct plywood, blue-grey workshop, loading bay, crane rail, high maintenance silhouette; thin light edge trims | Moving-camera commitment captures without camera overrides |
| Failed attempts should preserve useful play | Continuous solid floor below every optional transfer; no enclosed underside pockets | Native collision checks, intentional misses and continued skating |

## Five branches

| Goal | Approach / action | Receiver / continuation | Miss |
| --- | --- | --- | --- |
| Loading gap | West-to-east 18 m bank, 8 m takeoff, charged ollie over 6 m | 16 m deck, aligned 18 m downhill, open east runout | Floor beneath gap; floor routes around both ends |
| Plywood gallery | Halfpipe transfer or pump bank into a short rising rail from west-north floor | 6×14 m shelf at 5.8 m; forgiving south drop to return bank | Continuous floor beside pipe; rail can be re-entered |
| Workshop roof | 18 m bank, 5 m takeoff, 5 m jump with 0.6 m rise | 16×11 m roof at 4.8 m, 18 m downhill back to floor | Ground beneath gap; exits on both sides |
| Crane rail | East floor run-up, bank into a short rising curved rail clear of workshop | 14×10 m shelf at 8 m; west-facing descent into crossroads | Floor under final transfer; east side clear for retry |
| Maintenance transfer | Independent westbound 28 m climb, charged pop over 5 m | 12×8 m shelf at 9.5 m; carved north descent directly into the loading takeoff | Floor under break; no tall blocking enclosure |

## Preserved constraints

Competition camera remains shared: `skatepark: true`, no `cameraRig`. Walking remains optional: `alwaysSkate: false`. No changes to `src/tuning.ts`. Original Meshy architectural wall sections and their UV atlases remain; no new large-surface texture tiles or paid assets. Riding silhouettes and collision use existing primitives, with muted authored colors for differentiation. All five tokens still gate the ground-level finish.

## Evidence boundaries

Isolated branch probes deliberately respawn per challenge and only check reachability. They do not establish route flow, camera readability, novice discovery or fun. Continuous browser sessions use real Gamepad inputs and the normal rendered loop, with no teleporting, player stepping or camera mutation. Historical replay regressions use their frozen old geometry, rather than forcing the rebuilt layout to match old coordinates. Final session results and remaining limitations belong in validation.md.
