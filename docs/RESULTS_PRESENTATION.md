# Live end-of-run scene

Normal and time-trial finishes share a live shot of the skater at the level end. Gameplay remains stopped: only the results pose, reward bob/spin, water and rendering use the presentation clock.

- No new rewards: a slightly folded, looping catching-breath idle.
- Rewards earned: arms open, gaze raised, with the actual crystal, clear box gem, green combo gem or blue time relic floating overhead. Normal clears can show any combination of the three collectibles.
- The fiery finish pad and its foreground systemic Nitro switch are hidden for the shot, without destroying props or changing crate totals. The skater is placed on supported floor near the finish approach.
- Box totals remain UI in both modes. Trial results emphasize the run time, authored relic target and top three local times, including the active campaign's saved personal best when available.

The campaign currently has one relic target per course: **1:00.00**. This change does not invent Sapphire/Gold/Platinum thresholds. Matching the existing target exactly still earns the relic.

`ResultsPresentation` owns the temporary award meshes and camera framing. It fits visible character surfaces and rewards beside the results card on wide screens or above it on portrait screens. Retry, Continue and level switches dispose owned resources, restore prop visibility and clear the camera's off-axis projection. Shared game textures and sprite geometry are not disposed.

The Player's results layer runs after authored Idle and before character proportions/sole planting. It has its own clock and never calls the gameplay step. Ordinary pause menus retain their single-frame background cache.

Validation lives in `tools/test-results-presentation.mjs` and `tools/test-game-flow-results.mjs`, both included in `npm run check:campaign` and the full build. Coverage includes reward combinations, looping poses, frozen run state, floor support across all nine campaign courses, portrait/landscape framing, reversible prop visibility and resource ownership.
