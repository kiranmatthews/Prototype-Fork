# Waterfall Climb authoring record

> Historical first-design record. The user rejected this layout for repeated river modules and climbing rows. The replacement design and its current evidence are in [REDESIGN.md](REDESIGN.md) and [REDESIGN_PLAYTEST.md](REDESIGN_PLAYTEST.md); the numbers and images below describe the superseded version.

Prompt start: 2026-10-27 03:00:54 UTC (16:00:54 NZDT).
The original gameplay-only block ended at 05:00:54 UTC (18:00:54 NZDT).
The release coordinator recorded 2h30 of crash/access downtime in the shared
`.release-queue/timing-adjustments.json`. The adjusted earliest art time is
**07:30:54 UTC (20:30:54 NZDT)**. Productive work resumed at 06:01 UTC.

## Intended journey

Follow the river upstream through seven chapters, then turn into a side view
and climb nine traverses across a towering waterfall. The finish stands at the
source pool. A raised entrance at the foot of the falls leads to **The Hidden
Spillway**, a separate bonus with three timed waterwheels, a high bell cache,
and a switch that reveals the last stepping stones.

The final measured main path is 2,291 metres, comparable to Uga Ambush's
approximately 2.3-kilometre route. The validated layout has 140 authored crossings,
16 checkpoints, 13 timed bridges, and a 163.15-metre summit. The summit stands 152.4 metres above the waterfall basin. Movement tuning is unchanged.

## Greybox findings

- 03:19 UTC: timed bridge state tests pass at 30, 60 and 120 Hz. Default permanent
  latches retain their original behavior. A held spin cannot extend an already
  open timer. Soft checkpoint restores close timed leaves.
- 03:22 UTC: the first input-only route exposed an overlong diagonal opening
  jump. The native movement model reduces diagonal air travel. The banks now
  share axial takeoff/landing lines and ordinary river gaps have more margin.
  No player tuning changed.
- 03:24 UTC: Chrome lite smoke confirms the real source-owned level loads,
  spawn is supported, keyboard running works, the stamp says `Codex/sol fork`,
  and the console is clean. Evidence: `/private/tmp/waterfall-climb/browser/`.
- 06:01 UTC: resumed after the recorded Mac watchdog crash. Source and branch
  survived; temporary test output and processes did not. Subsequent evidence
  goes under this worktree's `docs/waterfall-climb/runs/` so it survives a reboot.

- 06:18 UTC: all **140/140** individually isolated crossings pass using the
  production Player, including seven rising jump-spin leaves and every return
  corner. This fixture places the player only before each independently tested
  crossing; it is not claimed as continuous-run evidence.
- The standalone Hidden Spillway completes **22/22** boxes with zero deaths in
  3,770 input frames (62.83 simulation seconds). The high bell cache is collected
  before breaking its bounce launcher; all three revealed stones are reachable.
- The continuous river run exposed a 0.25 m unsupported hinge seam (now overlaps
  the bank), crumbles that collapsed during a normal crossing (shake increased
  from 1.6 to 3 seconds), and rising-chapter hazards above early low terraces
  (hazards now reference each chapter's starting height).
- The river uses an explicit forward control zone; the broad foot-of-falls
  terrace begins the side-view zone. This prevents the ordered camera spine
  from rotating movement while walking toward the bonus entrance.

- 06:34 UTC: uninterrupted source-spawn-to-summit production-physics run passes:
  **74/74 main-stage boxes, 16/16 checkpoints, zero deaths**, 39,805 fixed frames
  (663.42 simulation seconds including collection detours and deliberate stops).
  The linked bonus contributes the other 22 boxes to the 96-box total.
- 06:35 UTC: real Chrome lite journey reaches the summit with zero deaths and
  no console errors, 38,784 fixed frames. This earlier browser pilot collected
  67 boxes; its stacked checkpoint lookup was corrected to include height in
  the all-box native run. It proves the continuous visual journey, not all-box
  collection. The camera reads forward on the river and sideways on the falls.
- Timed-floor contact fixture passes expiry under a real player, removal from
  native ground collision, pit death, checkpoint recovery, and repeat opening.

- Actual Chrome bonus lifecycle passes: jumping onto the raised pad enters
  the authored room; deliberately jumping off the arrival returns safely with
  no lost parent life; retry clears all 22 boxes and pays them into the same
  suspended parent object. Parent crates remain intact, no bonus-local gem is
  invented, and the supported return point becomes the bonus checkpoint.
- A direct walking route with incidental spin clears (no optional collection
  detours) takes 31,519 frames / 525.32 seconds. Medal targets are now 480 / 570 /
  690 seconds, allowing a deliberate clear while reserving gold for cleaner
  movement. The initial 300-second placeholder was not evidence based.

- 06:59 UTC: full-render Chrome at **MAX, native 1920×1080** matches the native
  all-box run exactly: 39,805 fixed frames, 74/74 main boxes, 16/16 checkpoints,
  summit finish, no dead/bailing frames and no console errors. Render buffer
  dimensions are recorded explicitly; the earlier lite pass uses 960×540.
- All 140 isolated crossings also pass with takeoff **0.4 m earlier** and a
  22-frame charge. This checks landing margin rather than only exact takeoffs.
- The basin now carries a continuous fruit ribbon to the left-hand first
  foothold, passing behind the optional raised bonus entrance. This addresses
  the close side camera's limited view across the 116 m breathing terrace.

- Timer-margin review of the continuous full-render input trace leaves at least
  **2.38 seconds** on the shortest river-lock crossing, 3.70 seconds on the
  teaching locks, and at least 2.71 seconds on the later jump-spin leaves. These
  are conservative margins measured from visible opening/crossing actions.

## Greybox review and the validation plan

The fixed side camera keeps both the takeoff and receiving ledge visible on
all nine traverses. Three rising hops reverse each row; the middle hop moves
six metres toward the cliff, with a fruit arc and a broad return balcony. The
side camera does not reverse with direction. The basin camera transition is
on the broad approach to this climb, followed by a fruit ribbon to the left
foothold. Timed leaves give four visible countdown segments and amber warning;
new players meet two separated locks before the three-lock relay.

The protected gameplay snapshot includes every collision surface, jump,
checkpoint, reward, timer, travel zone and camera. Appearance-only additions
must remain non-colliding. Ordinary platform and timber rims remain grindable.

Completed: continuous native and real-browser main routes, every turn, all-box
main and bonus, failed-bonus return, parent payout, expiry under the player,
repeat activation, checkpoint recovery, and production type-check/build.
The required `check:levels` script completed successfully at 07:25 UTC. The
production build completed with 1,739 release files / 950.5 MiB.

At the end of the greybox block, the remaining plan was scenery and generated
artwork, normal presentation and MAX/native rendering, a combined river → bonus
→ climb journey with the actual 96-box clear gem, final focused checks/build,
and local commits/handoff. The final fixture repeat would add explicit grind-rim
removal assertions to the already passing physical-expiry test. Completed
results follow below.

## Scenery phase

- 07:31 UTC: began after the complete two-hour gameplay block and approved
  downtime adjustment. Two separate built-in imagegen runs produced the actual
  basalt and sluice-timber surface textures; prompts are in
  `imagegen-prompts.json`. The selected 1024-square WebPs total 554,662 bytes.
- The authored gorge combines existing Meshy shoreline stones, willows, ferns,
  cliffs and trailing vegetation with source-owned basalt supports, banks,
  full-height columns and carved sluice mechanisms. Existing animated river,
  cascade and measured-foam shaders provide the moving water. No new models
  were downloaded and existing model geometry is unchanged.
- Main and bonus gameplay fingerprints still exactly match the greybox lock.
  Added scenery is explicitly non-colliding. The main art has 31,600 authored
  mesh triangles and the bonus 17,084, with no degenerate/nonfinite triangles;
  these figures exclude the reused full Meshy geometry.
- Plant bases are fitted to the authored riverbank triangles. The waterfall
  turns over a rounded crest and flares into a lower plunge pool. Its summit
  source pool sits above the middle cliff shoulders, with the finish at its rim.
- Full-render review is queued through the shared two-slot heavy-job guard.
  No art validation is claimed before that review completes.

- The source-camera audit found riverbank occlusion at the wide basin and deep
  decorative supports hanging into returning climbs. The gorge mouth now
  flares outward before the basin, plants follow the widened bank, and the
  overlapping upper turn slabs retain shallow undersides. Exact triangle and
  conservative prop-bound checks now clear all 332 sampled camera-to-body rays.
  The final authored scenery has 31,600 main / 17,084 bonus mesh triangles,
  excluding unchanged Meshy source models.

- 08:19 UTC: first full decorated review passes the 16 supported checkpoint
  views, native 1920×1080, normal 720-line CRT presentation, and actual bonus
  entry/failure/retry/all-box payout. No console or asset errors. Visual review
  found the broad fall too uniform, so the next pass replaced it with four
  separated streams, native Meshy cliff strata and sculpted rock undersides.
- 08:27 UTC: a third built-in imagegen run produced a tiled aquamarine and ivory
  foam texture. A small level-scoped material animates two drifting samples;
  waterfall folds, crests and flared toes are still authored mesh geometry.
- 08:33 UTC: refined full-render camera tour and type-check pass. All 16
  checkpoint views are supported; generated materials compile without console
  errors. MAX/native and normal CRT images were inspected. The camera audit
  again clears all 332 sampled camera-to-body rays. Final source mesh counts are
  23,948 main / 17,084 bonus triangles, excluding unchanged Meshy models.
- Final art, all three textures, provenance and the actual-render 640×360 level
  preview add 878,158 shipped asset bytes. The source models add zero new bytes.
  Both protected gameplay hashes remain identical to the greybox lock.
- The small timer-state check passes again at 30/60/120 Hz, including no timer
  refresh, reuse, long updates, checkpoint resets and the original permanent latch.
- The shared guard deferred the final combined river → bonus → climb run while
  capacity was reserved for other release work. The input pilot now routes
  checkpoint collection around the raised bonus stone as well as ordinary boxes;
  this changes only test navigation, not game geometry or player behavior.

## Complete decorated journey

- 09:06:54 UTC: resumed the consolidated final batch in the coordinator's
  reserved slot. Actual capacity idle was 08:55:37–09:06:54 (11m17s), excluded
  from productive work. No additional broad review or greybox rerun was needed.
- The full-render Chrome journey passes from the actual source spawn, through
  the real bonus entry and return, to the summit: **74 main + 22 bonus = 96/96
  boxes**, **16/16 checkpoints**, **actual clear gem**, and finish. No position
  writes or checkpoint warps occur during this journey. It uses 44,207 fixed
  input frames / 736.78 simulation seconds, with zero deaths, bails, console
  errors, or tuning changes. The raw browser report is hashed in
  `complete-journey.json`; final bonus and finish images are retained here.
- Final production-Player timer test passes all four rim states (closed,
  deployed, expired, reopened), removes the expired floor and grind edges,
  falls into the pit, restores the safe checkpoint, and opens again (602 frames).
  The original permanently latched bridge passes physical crossing, banked
  checkpoint restore, hard reset, and airborne spin contact (1,311-frame fixture
  plus the returning-plank fixture).

## Final handoff validation

The final required `check:levels` sequence passes (244.35 s), followed by the
production type-check and Vite build (73.64 s). No `check:all` was run. Build
output contains all new textures and the preview byte-for-byte. Source and
log hashes, exact commands, timings and the release dependency are recorded
in `final-validation.json`.

The old-base package measures 1,000,365,544 bytes / 1,843 files, 365,544 bytes
above the 1 GB cap. The coordinator explicitly accepts the increment with this
integration-size dependency: the newly verified shared release `7c1d733e` is
992,401,777 bytes with 7,598,223 bytes remaining. This level adds 878,158 public
asset bytes; the definitive cap check belongs to the combined current build.
No authored assets or geometry were pruned to fit the old base.

All feature work is complete locally. Publication remains with the coordinator.
The complete final guarded batch released its slot and closed its test browser.
