# Full-suite repairs — 8 November 2026

**Final validation: all 205 commands in all 44 `check:all` groups pass, with no commands skipped or timed out.** The complete rerun took 45 minutes 31 seconds; its four remaining harness failures were repaired and passed fresh-process rechecks (the flaky head replay twice). Production runtime files stayed identical throughout that rerun and those rechecks. [Complete results and revision provenance](full-suite-results.json).

The requested full run at `2417121f` completed all 205 commands in the 44 groups of `check:all`: 183 passed and 22 failed. Repairs start from published `c4619852`. The user's subsequent instruction explicitly authorized fixing defects, updating obsolete expectations after deliberate feature changes, and reading related Codex chats for context.

## Runtime fixes

- **Assisted ledge grabs:** the broadphase only tested the compact body collider plus near-miss padding. It could reject an authored hand reach before `tryLedgeGrab` ran. Extend only the search box's upper edge to the configured reach; retain the actual resolver, movement tuning, horizontal limits and eligibility guards. The real Arrow/Perfect Boing approaches now catch both Ancient Gates terraces, including the 15 m lip at x=1198. Existing default/assisted reach, mesh, board-detach, mover carry and blocked-mantle tests pass.
- **Untouched old Test Course saves:** recognize the exact stock snapshot after combo retirement and the 20% crate-size migration. Keep exact fingerprints so even a small authored edit remains a custom save. The existing stock/mutated-save regression passes.

## Deliberate changes reflected in tests

| Tests | Updated contract |
| --- | --- |
| Eight grind/camera/balance fixtures | Begin already-contacting setups at `CONST.railRideHeight`. Airborne natural approaches intentionally preserve their flight until sole contact (`aa5fe946`); the independent 220-flight regression also passes. |
| Waterpark disposal | Level-owned textures dispose once; shared textures survive level disposal. |
| Campaign/results/map return | 39 levels including Dusty Road; Ripcord River before Jungle Ruins; cloud sanctuary routes use independent supported hub pads; horizontal progression taps and resident-skater preparation match `c4c10ecb`. |
| Jungle Cup module fixture | Bundle the real campaign dependencies with the existing test helper, including coloured gems. |
| Map skateboard rewards | Check two-, three- and four-socket layouts, including optional coloured gems and courses without crystals, before and after board edits. |
| Camera speed/shadow harness | Supply the actual desert-lighting dependencies introduced by published `c4619852`; retain ordinary shadow coverage and add desert/bonus coverage plus restoration on level change. |
| SPECIAL death reset | Assert reset occurs before entering the dead state without imposing a count on unrelated cleanup statements. |
| Halfpipe safety | Source-owned Flats intentionally has the same one rejected pool back as the published snapshot; retain intersection safety assertions. |
| Unity port and editor round-trip | Assert the authored continuous Beach Street sand/shoreline, retained exposed road rails and deliberately ungrindable buried seam; enlarged crate migration and settling; restored loose fruit clusters. |
| Locomotion and fall-camera recordings | Freeze original crate dimensions only in historical recordings. Original trajectory hashes and camera windows are preserved, not regenerated. |
| Landing indicator | Direct rising/falling approaches to the real Nightworks lift replace a historical route that now dies before the target. Check rendered marker height, actual support, gameplay contact height and fixed-loop ordering. |

Related chat context confirmed the authored crate changes, restored loose fruit and Beach Street seam behavior. Current source, focused feature regressions and commit history provide the remaining contracts. No movement tuning, level layout or asset geometry is changed by these repairs.

## Verification

Focused repaired cases pass, including both original locomotion trajectory hashes and the camera-fall replay's original four deaths and hold windows. Focused editor checks cover enlarged crate stacks, Coastal Street in lite/full modes and Beachfront capture. The landing-marker negative control (moving the commit before the mover update) fails on a stale ground probe at frame 0, confirming that the replacement catches the original timing defect.

The full rerun at `a98da611` completed with 201 passing commands and four harness failures. Rechecks through `3c4c0b77` resolve all four. The report preserves those original outcomes alongside each final result instead of rewriting the run history. The production build and 974,153,616-byte release-size check pass. Normal Pages publishing remains build → release-size check → deploy; the full suite is not added to the normal publish path.

Browser review at `a98da611` passes in lite, full 720p and MAX/native 1080p. Both real Arrow approaches catch their receiving lips and mantle onto supported terraces. Held jump continues through the catch into the authored climb. Pit death returns to supported spawn; the normalized stock snapshot is recognized and a 0.01 m edit is preserved. The browser console has no errors or warnings. The native drawing buffer was independently measured at 1920×1080; the stored fixed-resolution settings remain 1280×720 when MAX bypasses them.

Evidence: [browser measurements](browser-review.json), [lite catch](ledge-lite.png), [full 720p climb](climb-720.png), [native climb](climb-native.png).

The complete rerun exposed an additional intermittent branch of the existing grind-head test: varied bail poses could make its old input-only approach miss the later grind. Commit `41115fca` pins only that historical fixture's cosmetic seed. Both fresh-process rechecks produce exactly the same 97 grind frames and 15.66° maximum head turn; the existing ≥50-frame and <30° limits, all 40 direct native cases and production randomness are unchanged. See [the rechecks](head-rechecks.json).

The new desert-lighting dependency was absent from the camera test’s extracted-function harness. Commit `ad5d3fb5` supplies the real imports and current level, with extra desert/bonus and return-to-normal assertions. The [focused recheck](camera-recheck.json) passes.

The same recent desert changes required two editor harness dependencies: `desertHeat.release` for the level-switch transaction and `isDesertCanyonLevel` / `setDesertSun` for the atmosphere renderer. Commit `3c4c0b77` supplies them and adds success-only release and sun-override cleanup assertions. All [10 level-switch cases](level-switch-recheck.json) and [429 atmosphere assertions](atmosphere-recheck.json) pass. The latter retains every previous numerical baseline unchanged. The full editor round-trip command also passes all its source, published-pack, sparse-component, bonus and native capture cases.
