# Live end-of-run scene

Normal and time-trial finishes share a live shot of the skater at the level end. Gameplay remains stopped: only the results pose, reward bob/spin, water and rendering use the presentation clock.

The completed run now fades directly through black into this shot, without an intervening loading vortex. Asset readiness and hidden-frame preparation are retained.

- No new rewards: a slightly folded, looping catching-breath idle.
- Rewards earned: arms open, gaze raised, with the actual crystal, clear box gem, green combo gem or blue time relic floating overhead. Normal clears can show any combination of the three collectibles.
- The fiery finish pad and its foreground systemic Nitro switch are hidden for the shot, without destroying props or changing crate totals. The skater is placed on supported floor near the finish approach.
- Box totals remain UI in both modes. Trial results emphasize the run time, authored relic target and top three local times, including the active campaign's saved personal best when available.

There is one relic target per course, defaulting to **1:00.00**. In the editor,
PROJECT → LEVEL → **relic time (s)** authors a per-level benchmark. It is stored
as optional `CustomLevelData.relicTime` in seconds and survives local saves,
export/import, duplication and undo/redo. “Use default relic time” removes the
override; opening the editor does not write the default into old data. The
accepted range is 0.01–86400 seconds. The same resolved target feeds relic
awards, normal-clear/trial results, the map race card and the progress ledger.
Matching it exactly earns the relic; no additional relic tiers are introduced.

Bonus entrances are unavailable throughout time-trial mode, even after the
player-side clock flag stops. Their presentation and platform collision are
removed for the trial and restored on cancellation without clearing an existing
bonus-completion lock. Both the platform query and direct bonus-entry function
reject trial entry. Normal bonuses and their reward banking are unchanged.

`ResultsPresentation` owns the temporary award meshes and camera framing. It fits visible character surfaces and rewards beside the results card on wide screens or above it on portrait screens. Retry, Continue and level switches dispose owned resources, restore prop visibility and clear the camera's off-axis projection. Shared game textures and sprite geometry are not disposed.

The Player's results layer runs after authored Idle and before character proportions/sole planting. It has its own clock and never calls the gameplay step. Ordinary pause menus retain their single-frame background cache.

Validation lives in `tools/test-results-presentation.mjs` and `tools/test-game-flow-results.mjs`, both included in `npm run check:campaign` and the full build. Coverage includes reward combinations, looping poses, frozen run state, floor support across all nine campaign courses, portrait/landscape framing, reversible prop visibility and resource ownership.
