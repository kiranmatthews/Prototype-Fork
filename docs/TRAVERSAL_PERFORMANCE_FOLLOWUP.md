# Continuous traversal audit — 9 October 2026

This continues the full goal in `GAMEPLAY_PERFORMANCE_AUDIT.md`. The first release covered loading, native input, spawns, 145 checkpoint landings and lifecycle checks for all 55 entries. This pass drives complete routes with ordinary device samples, keeping world time, movement tuning, position, inventory and hazards under the game’s control.

## Two reproduced collision bugs

**Accepted rail catches collided with their own support.** In After Hours, the real controller accepted the first counterweight at tick 1,879. During its normal eased attachment, shared collision then hit that same rail’s hanging rock body at tick 1,881 and caused a trip. Treat only the currently caught, explicitly owned rail body as support while grinding. Other components remain solid; releasing or bailing restores the body’s normal collision. Sixteen moving-rail cases cover both directions at four orientations, independent obstructing walls, and airborne collision after release.

**Opening spin bridges retained a retired wall.** Clockwork’s first return bridge was activated, 15.15% through deployment, and its authored `wallBox` was already empty. The shared collider nevertheless hit the opening timber at tick 2,747. Its reported impact speed was 16.94 m/s. Apply the existing collision lifecycle to the shared body too: closed wall, non-blocking deployment, then solid settled support. The visible animation and its timing do not change. Tests cover direct closed/opening/settled queries, a real airborne spin crossing, a normal walking crossing, checkpoint restore and hard reset.

The runtime patch changes no movement constants, authored geometry, animation deformation, render quality or camera settings. The new support filter is absent from ordinary non-grind queries. Bridge lookup is bypassed in levels without spin bridges.

## Continuous route evidence

- **All 20 themed bonus courses:** complete native fixed-step browser journeys in full rendering, every crate and gem earned, no deaths and no console errors. Total: **55,304 fixed steps**. Independent headless journeys also pass.
- **After Hours:** all eight required chapters, both counterweights, phase decks, all-board traversal and the actual finish. Headless completion takes **70.7 seconds**; normal-loop browser runs complete in lite and full rendering. The full run takes **4,256 ticks** (70.93 seconds), with all 29 rock assets and four authored enemies ready and no console errors. No mid-run resets, warps or phase-clock edits.
- **Crate Primer, Switchyard and Clockwork Gauntlet:** full-render browser main-route clears in **4,963 / 7,210 / 8,827 ticks**, respectively, collecting **22 / 26 / 36 main-route crates**, with no deaths or console errors. Their linked bonus crates remain separate; these runs correctly do not award the combined course gem. The corresponding complete headless journeys pass too.
- **Crab Chief:** the existing headless production-player journey completes all nine hits, all three phases and victory in **5,079 ticks**, with no player hits or deaths. Full browser victory remains to be checked in this audit.
- **Slipstream 2:** both existing headless main/high-route journeys pass, including all seven checkpoints, three jumps, nine temple landings and the moving landing. Full browser route validation remains to be checked in this audit.

The bonus browser run used the first-pass production bundle. These levels contain neither affected rail support bodies nor spin bridges, and their pilots never request a grind; this patch leaves their exercised runtime paths unchanged. After Hours and the main puzzle browser runs use the patched source.

## Pilot and fixture corrections

The traversal drivers must follow current controls instead of quietly changing the game to satisfy old recordings. After Hours now commits lateral direction before releasing a rail jump, releases and re-presses Grind for the next catch, waits through ordinary mounted circuits for reachable moving-rail alignments, and uses neutral airborne input when it intends no trick. It begins on the first normal simulation tick, while startup still owns loading, rather than spending uncontrolled ticks importing the pilot. No clock is reset or advanced to obtain a phase window.

The Clockwork bonus pilot reads its authored lowered reward positions rather than attacking an empty upper shelf. Switchyard continues across its admission perch instead of walking through the low underside. Clockwork lands clear of the upper spinner before reading its attack window: the earlier apparent floor failure was an enemy knockback, not a broken floor query. The small spin-bridge fixture now explicitly places its optional clock off its walking line; previously it accidentally entered time-trial mode and therefore could not bank a checkpoint.

The original Nightworks asset smoke compares its enemy count with the current source roster (six), replacing the stale hard-coded count of eight.

## Limits and open findings

- The full browser puzzle tools still fail their final upper-target-preview assertion. The journeys, crate totals, rider framing and console checks succeed; 78 / 141 / 246 sampled upper targets fall outside that assertion’s viewport bounds. The current close camera is preserved. Do not report the entire legacy camera test as green.
- `test-grind-catch-buffer.mjs` still fails its older recorded approach at line 26 (`ride` versus `grind`), identically on the unchanged `1ae0c10` shared-collision baseline. The newly added support cases and the complete After Hours browser route pass. Do not suppress that existing replay mismatch.
- **Deadwater Park is incomplete.** Its current pilot bails at tick 520. The trace shows repeated nonfatal shared contacts during a vert air, while `speed` grows from about −41 to −114 m/s in addition to retained lateral carry. A diagnostic run using the pre-existing native solver without the new shared collider completes the route and three loops at tick 4,345. This diagnostic switch is not a shipped fix. Investigate correct velocity ownership/projection; do not remove general collision or retune movement to make the route pass.
- **Temple traversal is incomplete.** The current continuous pilot fails in Temple Terraces near tick 1,833. Temple Skyline still needs its independent complete run; the initial tool stops at the first failure.
- Remaining named courses still need complete traversal coverage. First-use GPU work, repeated-return residency, touch/portrait and graphics recovery remain under the active goal. The initial 55-level checks do not stand in for this work.

Compact route results and failure evidence are in `docs/performance/traversal-followup.json`. The earlier per-level loading records remain in `docs/performance/all-level-*.json`.
