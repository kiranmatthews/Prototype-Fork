# Rumblewater Run

A new source-owned campaign level, `rumblewater-run`, appended after Custard Creek on Island 1. Existing course data and saved map indices remain intact. About 920 metres of curved travel descend through a sandstone gorge while a 16.4-metre mossy boulder pursues the player.

## Playing

Run toward the lens with **Down**; Left/Right stay relative to the screen. Hold **Space** to skate/charge, release to jump, and hold **E** to catch a grind. Normal movement tuning is unchanged.

The opening jump teaches paired stone takeoff markers. The first fork offers two inner-bank jumps or a long exposed aqueduct grind. Two descending halfpipes lead to the second fork: a lower snake pipe and leap, or a raised shelf and grind with the crystal. Both routes merge before the final thunder chute. Jump to the broad sanctuary island while the boulder drops into the intervening gorge. Four checkpoints provide a fresh movement-triggered head start. Gold/silver/bronze targets are 42/55/75 seconds.

## Geometry and camera

`src/levels/rumblewater-run.ts` owns all routes, gaps, five curved halfpipe sections, four additional grind paths, reward lines, checkpoints, and the finish. Closed creek-bank meshes and existing vert/rail primitives provide support; no invisible floor spans a jump. Ordinary surface edges keep the toolkit's grind behavior.

The small `boulderChase` level-data extension retains its ordered floor path through capture/export/import. Pursuit accelerates continuously, slows near the player without making stopping safe, resets behind the current checkpoint, and ends in a finite fall. The existing stone collision/rewards, sound loop, pooled dust, and asset lifecycle are reused.

`BoulderChaseCamera` remains ahead of the route and looks back. Camera anticipation does not steer the player. Ground-oriented aim preserves landing visibility during jumps and raised grinds; portrait framing balances the chosen bank with the pursuing boulder. The existing fatal-fall hold remains outside the rig.

## Art

Reuse the existing commissioned Custard Creek and Carlisle Coast asset catalogue, including the textured moss boulder, layered gorge cliffs, eroded buttresses, willows, ferns, temple remnants, and mill. Preserve model proportions, compressed textures, distance LOD, and shared resource disposal. No new paid generation or third-party asset import was needed. Native sandstone/moss surfaces, connected deep shoulders, a submerged riverbed, and the animated creek make the route belong to the same world. Art placements live in `src/levels/rumblewater-art.ts`.

`public/level-previews/rumblewater-run.jpg` and `docs/art-reviews/rumblewater-run.png` are real gameplay captures.

## Verification

- `node tools/test-rumblewater.mjs`: all four input-only route combinations (35.05–36.68 seconds), actual water death/checkpoint return, and an actual boulder catch when the runner stops. Native traces go to `/private/tmp/rumblewater-evidence`.
- `node tools/test-rumblewater-structure.mjs`: source/editor round trip, preserved new identity, eleven actual support probes, eight open gap probes, gate, kill plane, and pipe/rail inventory.
- `node tools/test-boulder-chase.mjs`: bounded pursuit acceleration, stationary danger, checkpoint grace, finite end fall, and framing at 16:9, 4:3, portrait, and short landscape.
- `tools/rumblewater-review.html?take=inner-low` runs a real browser input replay in lite mode. `?take=outer-high&full` runs the fully rendered grind route; `take=recovery` and `take=stall` exercise failure behavior. This review page is development-only. It reports framing, assets, deaths, bails, checkpoints and console errors, and captures gameplay frames at the four key sections.
- Required `check:levels` commands, production TypeScript/Vite build, camera regression, campaign identity/unlock checks, and actual map travel in both directions. The extracted high-air camera test receives the real current camera dependencies. No full-suite run.

The local runtime has no npm executable; the build and check:levels script contents were executed directly with the bundled Node binary. Replays preserve real inputs; browser rendering supplies its live camera. No pose, velocity, hazard, balance, or movement tuning corrections are injected during takes.
