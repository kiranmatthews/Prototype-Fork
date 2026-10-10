# Treehouse Trail opening correction — 10 October 2026

The user explicitly requires a **full halfpipe**, a camera **parallel to its spine on approach**, a **balcony spawn without a warp pad**, and a camera that **follows the stair descent**. These gameplay requirements take precedence over interpreting the reference photograph. The player-facing level name is Treehouse Trail; `treehouse-trail` remains its stable ID.

The art wrapper now retains the existing halfpipe and original follow composition. The ordered camera lane starts at the balcony, descends the four stair landings, and enters the halfpipe on its negative-Z axis. Planting and painted path clearance follow that same route. The sky gradient is slightly darker. The cabin, animated striped roof, beach, layered vegetation, downstream geometry and native player tuning remain.

`startWarpPad: false` is bounded level data, survives capture/import, and skips both arrival artwork and its collision/arrival animation. Other levels continue using the automatic pad by default.

The existing native surface check covers 16 walking/skating cases plus 8 boundary probes. Both opening walls are approached from a supported point on the opposite transition, with a proper run-up; it retains the original support and bail assertions. The full-render Chrome review walks from the actual spawn down all three stair flights and along 13 route waypoints, then uses real keyboard input to skate through the halfpipe. It verifies the level name, supported 8.4m balcony spawn, zero arrival-pad meshes, parallel camera (horizontal direction X=0), a grounded ride and clean console. This is an opening walkthrough and staged skating check, not a new full-course playthrough. Required level checks, the existing campaign-name check and production build pass; no full suite.

- `start.jpg`: actual first playable view.
- `route-3.jpg`: camera following the stair descent.
- `pipe-approach.jpg`: both transitions aligned with the approach view.
- `pipe-riding.jpg`: native keyboard skating inside the halfpipe.
- `production-review.json`, `native-support.json`: recorded measurements.
