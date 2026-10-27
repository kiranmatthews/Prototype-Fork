# Waterfall Climb — replacement playtest

This is the second design. It supersedes the first published version's repeated chapters and switchbacks, its 140-gap/96-box counts, and its screenshots. The first version remains in Git history and its historical evidence files.

## Timing and scope

Revision prompt: 2026-10-27 10:12:55 UTC. Complete greybox main + actual bonus + summit browser validation: 12:12:42 UTC, **1h59m47s prompt to continuously playable**. Source dressing enabled at 12:21 UTC after the gameplay block. Two new imagegen material runs were prepared while native validation capacity was unavailable; they were not applied to gameplay before the greybox lock.

The river is about 1.1 km long, followed by a side-view climb from 12 to 155.4 m. Long continuous travel is now skating: a curved cedar, a broken millrace and the approach root bank. Twenty-nine deliberately placed gap/spin crossings alternate with two actual authored rail traverses, five moving-platform rides, and four high drum transfers. Ten checkpoints divide the distinct places. The optional Hidden Spillway adds a wheel, a ferry, fragile beams, a high cache and a switch-revealed finish.

## Continuous evidence

- Native main from source spawn: 23,447 fixed frames / 390.78 simulation seconds, all 27 main boxes and all ten checkpoints, no death or bail. It does not enter the bonus.
- Standalone native bonus: 4,264 frames / 71.07 seconds, 22/22 boxes, no death. Its gallery entry is not the detour payout test.
- Actual Chrome lite combined journey: **27,681 frames / 461.35 seconds**, source spawn → river → actual raised bonus pad → 22-box bonus → same suspended parent → waterfall summit. All 49 combined boxes and ten checkpoints, real clear gem, no death/bail/console errors. No player position/velocity/state writes or checkpoint warps during this continuous test; only production controls are supplied to the unchanged Player.
- Main route metrics: **778.6 m of skating, 136.0 m on the two authored rails, five moving-platform rides and four drum launches**. The rail pilot rejects accidental deck-edge captures.
- Final full-render Chrome at MAX/native 1920×1080: **27,667 frames / 461.12 seconds**, all 49 boxes, ten checkpoints, real clear gem, no deaths/bails/errors. The same source-spawn → actual bonus → same parent → summit route passes. Four decorative foliage removals and two corbel clearance adjustments followed; the unchanged gameplay fingerprint and final render review cover them.
- Final visual/lifecycle review: all ten supported checkpoints, river/aqueduct/crown at normal 720 + CRT, native/MAX views, actual free bonus failure, retry, 22-box payout and supported same-parent return. No console or asset errors; native asset triangle counts retained.
- Required level checks and TypeScript/Vite production build pass. Built Chrome smoke confirms supported spawn, keyboard movement, clean console and `Codex/sol fork · build 10-27 12:58 UTC`. The full trace and final source/evidence hashes are in `redesign-final-validation.json`.

## Focused checks

All 29 isolated crossings pass with ordinary charge/jump/spin controls. These isolated fixtures respawn before each crossing and are not continuous-run evidence. Five deliberate misses at checkpoints 0, 4, 6, 8 and 9 cause the expected life loss and supported checkpoint recovery with timed leaves closed. The existing timer runtime is unchanged from the first design's 30/60/120 Hz, expiry, no-refresh, repeat opening and permanent-latch regression evidence.

The art pass preserves the greybox's physical geometry, surface normals, route, cameras, timers, rewards and ordinary edge grinding; the protected hashes are in `redesign-gameplay-baseline.json`. All added scenery is non-colliding. Existing Meshy models retain their full authored geometry at every distance and in reflections. New basalt and cedar bark are generated assets with source prompts and hashes; no downloaded model or movement change was added.

## Useful local review

Open `http://127.0.0.1:5274/?playtest&level=waterfall-climb` (add `&lite` for a fast inspection). In ordinary menu use, select **Waterfall Climb**. If an editor save masks the source, use the PROJECT panel's restore-original action. K/L checkpoint warps are inspection shortcuts, not completion evidence.

Representative manual review: the first drifting leaf, cedar grind dismount, timed sluice and ferry, millrace ollie, the transition at the broad basin, high waterwheel exit, aqueduct underpass/rail, drum transfers, the unstable crown and summit gate. Retry the bonus after a deliberate miss to check that the parent life and box count are preserved.

## Limits

The input pilot establishes physical reachability and lifecycle behavior. It does not establish enjoyment, a first-time player's completion time, or that an exact pilot is the only viable route. The redesign's quality claim comes from replacing repeated chapter generators with different movement problems, reference review, and rendered inspection of the actual journey. Release integration and public deployment belong to the coordinator; this chat only commits and hands off locally.

## Release handoff

Final old-base output: 1,000,868,907 bytes / 1,845 files, 868,907 bytes above the cap. This is 503,363 bytes above the previous task build; new public art/provenance/preview adds 488,159 bytes net. The existing coordinator-owned current-base size dependency remains. No unrelated asset was pruned, and no public deployment is claimed. Local production preview: `http://127.0.0.1:5275/?playtest&level=waterfall-climb`.

Reviewed images: [river](redesign-river.jpg), [skate route](redesign-skate.jpg), [climb](redesign-climb.jpg), [underpass](redesign-underpass.jpg), [crown](redesign-crown.jpg), [bonus](redesign-bonus.jpg), [normal presentation](redesign-normal.jpg), [summit finish](redesign-finish.jpg) and [overview](redesign-overview.jpg).
