# Validation of the entangled network

The original parallel-strand design is superseded by the eighteen-route network. Historical checkpoint reports under `evidence/validated/` describe that earlier design, not the current level. Its four topology-specific scripts were retired; they remain recoverable in commit `fccd2305a5253ad79efb0d7b1e68b445493fe2a1`.

All native scene, browser and build jobs run through the shared release queue's heavy guard after scheduling. Only one heavy job for this chat may run at once. `SPAGHETTI_OUTPUT` selects each report directory. Full visual runs use a 2560×1440 native drawing buffer. Small viewport menu tests are layout checks, not substitutes for native scene review.

| Tool | Evidence scope |
| --- | --- |
| `survey-spaghetti-network.mjs` | Pure source/native-rail sampling: all endpoints supported, rider envelope clears platform volumes, over/under crossings, eighteen branch camera/progress traces. No scene physics. |
| `survey-spaghetti-momentum.mjs` | Numerical forward-grind estimate; excludes catches, jumps, combat and ground travel. |
| `test-spaghetti-rails.mjs` | Native production-input full course. Default solo; `--race` explicitly enables all eight. `SPAGHETTI_CHOICE=0/1/2` selects human pilot preference. Zero-fall solo and every active racer finishing are asserted. |
| `test-spaghetti-network-transfers.mjs` | Native endpoint collision support and 36 gaps × two speeds × three release offsets. Fixture sets initial position/speed only, then uses normal input. Report all outcomes; nominal timing must pass. |
| `test-spaghetti-recovery.mjs` | Forced pit falls at banked anchors on the chosen route; supported returns and complete native finish. |
| `test-spaghetti-turnbacks.mjs` | Four named current-branch backward-catch fixtures; ordinary-input disengagement, normal pit return and re-entry. |
| `test-spaghetti-keyboard.mjs` | Independent real browser keyboard traversal; never calls the rival drive function or sets player movement/position. `SPAGHETTI_ROUTE=mixed` uses different choices at junctions. Full/MAX must be enabled for visual evidence. |
| `test-spaghetti-editor.mjs` | Real editor node height and curvature edit, live native geometry and branch-navigation update, exact undo, TEST. |
| `spaghetti-network-overview.mjs` | Actual full-render editor camera views at 2560×1440. Composition evidence only, not a playthrough. |
| `spaghetti-rails-browser.mjs` | Seven intro-menu viewport layouts by default; `--inspect` captures the actual supported starting grid. Full/native by default; `SPAGHETTI_FULL=0` is a functional lite-only check. |
| `test-spaghetti-campaign.mjs` | Quagmire stable save key, win-only gem and time-trial unlock behavior. |

The shared ordinary-road race regression is `tools/test-skate-race-rules.mjs`. It must remain green after optional branching runtime changes. Required final repository checks are `npm run check:levels` and `npm run build`; no `check:all` was requested.

The new network's native/browser results are pending at this checkpoint. Do not infer a pass from a prepared test or an older report. Final curated evidence will record immutable commit/source hashes and explicitly distinguish keyboard traversal, automated native controls, fixture setup and visual-only cameras.
