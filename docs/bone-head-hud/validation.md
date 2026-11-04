# Bone Head HUD validation

## Preserved after the 5 November 2026 host restart

The implementation and all ImageGen artwork survived in the isolated `codex/bone-head-hud-hero` worktree, based on `46b2f4cf`. The runtime portrait is a 72,987-byte 256 × 256 PNG with alpha; the unchanged ImageGen source is 1280 × 1280.

Completed before the restart:

- `node tools/test-modern-life-hud.mjs` passed Modern text placement and Classic number formatting.
- `node tools/test-hud-visibility.mjs` passed regular/Bonus visibility, fruit timer, earned-only relics and L2 behavior.
- `git diff --check` passed, including another inspection after recovery.
- `npm run build` passed its TypeScript stage and entered Vite's production transformation, but did not produce a confirmed completed build before the restart. The partial `dist/` is not validation evidence.
- `node tools/test-game-hud-pipeline.mjs` hit an existing source-pattern assertion at line 278. It expects `fruitCollectionRevision++` immediately after `collectFruit()` opens, but the unchanged base already has a race guard and `lockTrialClock()` before the increment. The same assertion was checked against `git show HEAD:src/player.ts` and failed there too. No player or unrelated test changes were made.

Recovery inspection confirmed old build process IDs 79613/79615 are gone; old preview/build tool sessions are unavailable. The temporary build log and temporary browser-review script were lost. The browser smoke had not started: the shared two-job guard returned exit 75 while the task build and the separate particle task occupied both slots.

Pending at recovery: the required complete production build and real Chrome lite/full/MAX portrait switching, reload persistence, desktop/compact alignment and console review. Per the coordinator's recovery instruction, do not restart heavy work until capacity is explicitly released.
