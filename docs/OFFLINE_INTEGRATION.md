# Consolidated offline build

The combined local working branch is `codex/offline-integration` in `/Users/kiki/.codex/worktrees/six-island-campaign/Prototype Fork`. Use this checkout for further work on the combined game.

Production preview: http://127.0.0.1:6265/?playtest&level=warproom. The development server uses port 6264. Both serve this checkout. Loopback playtest unlocks every map destination for inspection; it does not fabricate earned crystals, medals or completed saves. Normal progression still hides locked names.

## Included work

All 24 existing Git worktree heads are ancestors of the integration branch, including the primary `main` checkout and detached course checkouts. The merge series incorporates Crown rendering and quartz, the latest Slipstream, Rooftop Odyssey, Grove minefields, modular Meshy carts and Country Club traffic, frog and moa updates, intact bails/trip recovery, secured-crystal trial gates and uniform bonus cameras. The six-island map and full Meshy map assets remain in place. The subsequent roster update assigns Sky Bridge, Temple of Embers and The Ancient Gates to secret slots 1–3, removes The Descent, and restores ordinary skating to ollie → second-release abandon. See `CAMPAIGN_ISLANDS.md` and `performance/secret-course-roster.json` for the current state.

The last consolidation merge is `da05117d`. There are 108 commits reachable from that combined tree beyond the prior map branch tip `6f432218`, including merged feature histories.

## Recovery points

- `codex/six-island-campaign` at `6f432218`: the prior completed map build.
- `codex/offline-primary-snapshot-20261020` at `72e9b89c`: every tracked edit and nonignored untracked file from the primary working tree, saved with a separate Git index.
- `codex/offline-country-art-snapshot-20261020` at `785cb088`: the country-art checkout's untracked review work.

The original primary checkout remains at `79cdcdc0`; its files and normal Git index were not reset or cleaned. Its files still match the recovery snapshot when compared through the separate snapshot index. Original course worktrees and branch references remain available.

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
