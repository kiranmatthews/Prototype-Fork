# Bone Head HUD validation

The life portrait now sits 10% of its own height lower in Classic mode: about 8px at 720p and 11px at 1080p. The actual selected player head chooses the artwork in both the direct DOM HUD and the pre-CRT Canvas HUD. Bone Head uses the new transparent ImageGen portrait; BoolieRoo retains `roo.png`. Modern and Bonus keep their existing composition.

## Checks

- `node tools/test-modern-life-hud.mjs`: passed Modern text placement and Classic number formatting.
- `node tools/test-hud-visibility.mjs`: passed regular/Bonus visibility, fruit timer, earned-only relics and L2 behavior.
- `git diff --check`: passed.
- `npm run build`: passed after recovery through the shared heavy-job guard, including TypeScript, production bundling and release-asset preparation. Runtime source and assets match `cfb292b2cd039f30fd9767a45341660a8df25b94` (implementation commit `2ff0fa858f32c5710e665ddf0066a8c5c7e02e58`). Output: 1,763 files, 775.5 MiB, offline version `f589694cbb24a49eecd4`.
- Production Chrome review: 13 settled gameplay captures cover both heads, changing back, Roo persistence after reload, 1920×1080, 1280×720, 1024×768, 390×844, 844×390, Modern readout, ordinary full rendering at 720p, and MAX/native rendering at 1080p. The selected image matches the DOM and Canvas source; the life number remains readable. Console/page errors: zero. Image responses: successful 200 or cache-validated 304.

`report.json` records the measured layouts and image state. `review.mjs` reproduces the review; set `PLAYWRIGHT_MODULE` to an installed Playwright module and optionally `HUD_REVIEW_OUTPUT` to a durable evidence directory. Use the shared `run_heavy.py` guard for the browser run.

The first review started too early and captured the loading curtain; those captures were replaced after correcting the startup gate. The settled run exercised all 13 cases but its final harness assertion rejected valid cached HTTP 304 responses. The assertion is corrected; the saved report was then rechecked for all 13 cases, nonempty number bounds, selected portraits, rendering paths, valid response statuses and zero errors. Case names were restored from the recorded execution order after separating the accessibility label from the case label. No additional game changes or broad reruns were needed.

The existing `tools/test-game-hud-pipeline.mjs` fails its source-pattern assertion at line 278. It expects `fruitCollectionRevision++` immediately after `collectFruit()` opens, but the unchanged base already has a race guard and `lockTrialClock()` first. The same assertion failed against `git show 46b2f4cf:src/player.ts`; this task does not change player behavior or that unrelated assertion.

## Evidence and recovery

Full screenshots and build/browser logs are preserved in the local shared inbox at `.release-queue/evidence/01a1a688-5ba2-7733-bde4-b15a00c3f970/bone-head-hud/` under the primary checkout. This keeps 26 MiB of review captures out of the shipped source change. Key captures: `full-skull-1080.png`, `full-roo-1080.png`, `full-native-skull-1080.png`, `full-native-skull-modern.png`, and `lite-skull-390x844.png`.

The host restarted during the first production build. All source and ImageGen files survived in this durable worktree; old build/preview processes were confirmed gone before restarting. Temporary logs and the unstarted review script were lost and the latter was reconstructed. The complete build and browser review then ran sequentially through the recovery guard. The coordinator's 5m05s common outage allowance plus about six minutes of additional reconstruction/capacity hold are excluded from active iteration time without overlap. No publication or GitHub polling was performed by this feature chat.
