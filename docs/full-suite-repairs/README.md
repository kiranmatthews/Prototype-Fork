# Full-suite repairs — 8 November 2026

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
| SPECIAL death reset | Assert reset occurs before entering the dead state without imposing a count on unrelated cleanup statements. |
| Halfpipe safety | Source-owned Flats intentionally has the same one rejected pool back as the published snapshot; retain intersection safety assertions. |
| Unity port and editor round-trip | Assert the authored continuous Beach Street sand/shoreline, retained exposed road rails and deliberately ungrindable buried seam; enlarged crate migration and settling; restored loose fruit clusters. |
| Locomotion and fall-camera recordings | Freeze original crate dimensions only in historical recordings. Original trajectory hashes and camera windows are preserved, not regenerated. |
| Landing indicator | Direct rising/falling approaches to the real Nightworks lift replace a historical route that now dies before the target. Check rendered marker height, actual support, gameplay contact height and fixed-loop ordering. |

Related chat context confirmed the authored crate changes, restored loose fruit and Beach Street seam behavior. Current source, focused feature regressions and commit history provide the remaining contracts. No movement tuning, level layout or asset geometry is changed by these repairs.

## Verification

Focused repaired cases pass, including both original locomotion trajectory hashes and the camera-fall replay's original four deaths and hold windows. Focused editor checks cover enlarged crate stacks, Coastal Street in lite/full modes and Beachfront capture. The landing-marker negative control (omitting the post-mover commit) must fail on a stale ground probe.

The full 205-command rerun, production build and browser review are recorded below when complete. Normal Pages publishing remains build → release-size check → deploy; the full suite is not added to the normal publish path.
