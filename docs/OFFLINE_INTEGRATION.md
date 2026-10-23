# Consolidated offline build

The combined local working branch is **`main`** in `/Users/kiki/Documents/ChatGPT/Prototype Fork`. Use this checkout for further work on the combined game. The earlier `codex/offline-integration` branch has been merged; its six-island worktree is a historical checkpoint.

Current local preview: http://127.0.0.1:5417/?playtest&level=country-club. It serves the clean `codex/merge-current-20261023` checkout at `/private/tmp/prototype-merge-20261023/work`, kept in sync with `main`. Port 5419 serves the primary checkout for development. The older 6264/6265 previews belong to the earlier consolidation. Loopback playtest unlocks every map destination for inspection; it does not fabricate earned crystals, medals or completed saves. Normal progression still hides locked names.

## 24 October follow-up audit

Checked 97 local branches, 26 worktree heads and working trees, all six stashes, and detached/replaced commits in the reflog. All completed feature branches and every worktree head were already ancestors of `main` at `1fc48236`. The country-art checkout's eleven untracked review/reference files are byte-identical to files already tracked in `main`. No additional playable feature was missing.

Country Club includes the eighteen-hole downhill course and art, deep sand and boost approaches, eight-rider races, race items and models, scored time trials gated by the earned crystal, live finish arrivals, and ten double-sized modular carts with Meshy accessories. The latest cart behavior is independent roaming across the fairways. `src/golf-cart` matches the final `b4be1399` feature branch; the later lazy source-level construction preserves the authored course. The older downhill integration stash is represented by completed commit `5743bf80` and subsequent shared runtime improvements.

The five unmerged local refs are retained recovery/cleanup snapshots, the superseded Nightworks roundoff assertion, and unfinished Roo character studies. The cached remote Haunted Hassle branch is also covered: all 323 task files match merged replacement `0d476fec` apart from the cumulative iteration log. Stash-only splat assets were deliberately retired in `fccf04e9`; two older Tidebreak diagnostic scripts are temporary probes. None should overwrite the completed game. All stashes and recovery refs remain available.

Updated the integration fixtures that predated the crystal gate: cart-contact, optional solo-course and live-finish tests now authorize trials explicitly, and the browser race test verifies the earned result before offering a trial. Its cart check verifies all ten carts move instead of imposing contact/knockdown quotas on independent roaming. Gameplay and tuning are unchanged.

Evidence and current validation: [offline-merge-audit.json](performance/offline-merge-audit.json). The earlier consolidation details below are historical.

## Included work

All 24 worktree heads present at the original consolidation became ancestors of the integration branch, including the then-current primary `main` checkout and detached course checkouts. The merge series incorporates Crown rendering and quartz, the latest Slipstream, Rooftop Odyssey, Grove minefields, modular Meshy carts and Country Club traffic, frog and moa updates, intact bails/trip recovery, secured-crystal trial gates and uniform bonus cameras. The six-island map and full Meshy map assets remain in place. The subsequent roster update assigns Sky Bridge, Temple of Embers and The Ancient Gates to secret slots 1–3, removes The Descent, and restores ordinary skating to ollie → second-release abandon. See `CAMPAIGN_ISLANDS.md` and `performance/secret-course-roster.json` for the current state.

The original consolidation merge was `da05117d`. It added 108 reachable commits beyond the prior map branch tip `6f432218`, including merged feature histories. The later `56609ef0` consolidation brought this work, subsequent feature branches and primary recovery work into `main`.

## Recovery points

- `codex/six-island-campaign` at `6f432218`: the prior completed map build.
- `codex/offline-primary-snapshot-20261020` at `72e9b89c`: every tracked edit and nonignored untracked file from the primary working tree, saved with a separate Git index.
- `codex/offline-country-art-snapshot-20261020` at `785cb088`: the country-art checkout's untracked review work.

At the original consolidation, the primary checkout remained at `79cdcdc0` and its files matched the recovery snapshot. It has since advanced to the combined `main`; the original files remain recoverable from `72e9b89c`, `codex/pre-merge-snapshot-20261023` and the retained pre-integration stash. Original course worktrees and branch references remain available.

Historical backup/cleanup refs and `drafts/roo-character-studies` are retained separately. The old `codex/nightworks-floating-rocks-20260908` ref contains a renderer roundoff-test adjustment already represented by the current, stronger assertions. These old refs were not used to restore superseded gameplay or drafts.

## Integration decisions

- Keep the newest combined versions when primary edits duplicate or predate an already merged branch. Retain thirteen additional review JSON files from the primary snapshot, and preserve every original version in the recovery commit.
- Retain the primary supported-floor bonus-camera behavior with the shared 26 m / 49° camera. Update bonus metadata and tests to the current fifteen bonus routes and the six-island placeholder catalogue.
- Preserve both shore-field regression sets, scored time-trial freeze clocks, physical finish rollout, eight-rider races and ten independent Country Club carts.
- Remove the obsolete release-texture conversion for the replaced frog GLB. The current frog ships its own original embedded textures and geometry; its source asset is unchanged.
- Allow bounded world-map hub heights up to 256 m so the existing secret-island hubs at 129 m remain saveable. Verify JSON round-trip and out-of-range rejection.

## Validation

All 20 required `check:levels` commands pass, as does the TypeScript/Vite production build. 54 distinct recorded checks pass, including the build, focused movement, race, reward, camera, enemy and asset checks. The complete Country Club simulation reaches the finish with its human driver and seven opponents.

Production Chrome passes all six islands and 38 local inspection destinations, seven affected course launches, both eight-rider race starts, all ten Country Club carts, normal locked-name concealment and the actual keyboard jump sequence. Screenshots and canvases are native 3840 × 2160 with the fixed-render checkbox off. No browser console or loading errors were recorded.

The extra legacy `test-editor-atmosphere.mjs` diagnostic remains failing. Its Beachfront fog baseline (190 versus the current 160) was already documented before this merge; its headless fixture also reports an asset-owner-release rejection during disposal. The map-save issue it exposed is fixed and independently verified. This is not a claim that the full test suite passes; `check:all` was not run.

Machine-readable evidence: [offline-integration.json](performance/offline-integration.json). Full-resolution review images remain in `/private/tmp/offline-integration-browser/`, with jump evidence in `/private/tmp/board-double-jump-browser.json` and `/private/tmp/board-third-jump.png`.

All work and commits remain local. No push, upload, generated asset purchase or deployment was performed.
