# Carlisle local wrap-up validation — 30 October 2026

**Full suite is not green: 163 command invocations passed, 40 failed after one test-fixture correction. All 203 invocations across 44 groups were executed.** These counts are command invocations, including repeats prescribed by the package scripts, not individual assertions.

Runtime commit: `402a46f2043abcf1a590e9435f908582c5d4a0ac`. The only subsequent code edit is the startup test fixture. Work remains local; publication and integration are on hold.

## Run and coverage

Requested command: `npm run check:all`, Node v24.19.0. Started 2026-10-30T08:29:56.838666+00:00; all planned commands finished 2026-10-30T08:59:51.513749+00:00 (29.9 minutes elapsed).

The original command exited 1 at Chimeworks after 36 passing invocations. Its shell chain stops at the first failure. Every one of the remaining 166 leaf commands was then executed sequentially, in package order, under the shared heavy-work lease, continuing after failures. No remaining command was skipped and passing checks were not rerun. The continuation wrapper finishing successfully does not make the suite pass.

[summary.json](summary.json) contains all 203 commands, original exit codes, final status, the corrective recheck and failure summaries. [remainder-results.json](remainder-results.json) preserves the original continuation results; [remainder-plan.json](remainder-plan.json) and [run-remainder.py](run-remainder.py) document execution. [logs.tar.gz](logs.tar.gz) contains all 169 raw logs, including the initial run, progress and corrective recheck. Individual logs also remain unpacked locally.

## Corrected fixture

The startup source now includes Vite's module-only `import.meta.env.DEV`. The classic-Function test fixture could not parse it. [test-playtest-level-flow.mjs](../../../tools/test-playtest-level-flow.mjs) now binds that constant explicitly and tests both development and production review behavior. Its corrective rerun passed. No production logic or gameplay tuning changed during this validation.

## Unresolved failures

These are observed failures, not a claim that every failure is new or pre-existing. A prior-commit baseline was not run. Chimeworks specifically still searches the retired `slipstream-continuous` ID while the migration module defines `slipstream-race`; that expectation remains unfixed. Other failures need individual investigation.

| Check | Observed failure | Raw log in archive |
| --- | --- | --- |
| [test-chimeworks.mjs](../../../tools/test-chimeworks.mjs) | AssertionError [ERR_ASSERTION]: Chimeworks must be included in the continuous Slipstream | check-all.log |
| [test-map-archipelago.mjs](../../../tools/test-map-archipelago.mjs) | AssertionError [ERR_ASSERTION]: Tribal Run missing a Meshy scene | 003-test-map-archipelago.log |
| [test-warp-room-return.mjs](../../../tools/test-warp-room-return.mjs) | Camera value 0.18 differs from expected 0.32 (line 471). | 014-test-warp-room-return.log |
| [test-park-tuning.mjs](../../../tools/test-park-tuning.mjs) | Final charge value differs from expected 23 (line 14). | 023-test-park-tuning.log |
| [test-park-camera-framing.mjs](../../../tools/test-park-camera-framing.mjs) | AssertionError [ERR_ASSERTION]: real vert route did not return | 024-test-park-camera-framing.log |
| [test-jungle-cup-runtime.mjs](../../../tools/test-jungle-cup-runtime.mjs) | AssertionError [ERR_ASSERTION]: perimeter transition: 1.5943807580684677 != 1.0544155877284287 | 027-test-jungle-cup-runtime.log |
| [test-jungle-cup-grind-camera.mjs](../../../tools/test-jungle-cup-grind-camera.mjs) | AssertionError [ERR_ASSERTION]: test did not traverse a meaningful coping bend | 030-test-jungle-cup-grind-camera.log |
| [test-skate-tricks.mjs](../../../tools/test-skate-tricks.mjs) | AssertionError [ERR_ASSERTION]: real ramp did not launch | 038-test-skate-tricks.log |
| [test-unity-level-ports.mjs](../../../tools/test-unity-level-ports.mjs) | TypeError [ERR_UNSUPPORTED_RESOLVE_REQUEST]: Failed to resolve module specifier "./coastal-town-art" from "[embedded data URL omitted]": Invalid relative URL or base scheme is not hierarchical. | 045-test-unity-level-ports.log |
| [test-quaternius-crouch.mjs](../../../tools/test-quaternius-crouch.mjs) | Boolean actual true differs from expected false (line 51). | 057-test-quaternius-crouch.log |
| [test-vert-ollie-sequence.mjs](../../../tools/test-vert-ollie-sequence.mjs) | AssertionError [ERR_ASSERTION]: supplied edge case must still land | 061-test-vert-ollie-sequence.log |
| [validate-ledge-traversal.mjs](../../../tools/validate-ledge-traversal.mjs) | AssertionError [ERR_ASSERTION]: missing receiving platform face at x=20.5 | 062-validate-ledge-traversal.log |
| [validate-landing-indicator.mjs](../../../tools/validate-landing-indicator.mjs) | AssertionError [ERR_ASSERTION]: fixed simulation loop was not inspected | 066-validate-landing-indicator.log |
| [test-run-facing.mjs](../../../tools/test-run-facing.mjs) | AssertionError [ERR_ASSERTION]: legacy gait still reads world/platform displacement | 067-test-run-facing.log |
| [test-locomotion-replays.mjs](../../../tools/test-locomotion-replays.mjs) | AssertionError [ERR_ASSERTION]: test-course: replay missed the reported grounded recovery | 068-test-locomotion-replays.log |
| [test-surface-friction.mjs](../../../tools/test-surface-friction.mjs) | AssertionError [ERR_ASSERTION]: The Descent beach sand did not opt into full surface drag | 078-test-surface-friction.log |
| [test-camera-speed-effect.mjs](../../../tools/test-camera-speed-effect.mjs) | ReferenceError: THREE is not defined | 079-test-camera-speed-effect.log |
| [test-camera-look.mjs](../../../tools/test-camera-look.mjs) | AssertionError [ERR_ASSERTION]: touch look does not clear when the app backgrounds | 080-test-camera-look.log |
| [test-camera-level-switch.mjs](../../../tools/test-camera-level-switch.mjs) | ReferenceError: launchCamera2 is not defined | 082-test-camera-level-switch.log |
| [test-camera-fall-replay.mjs](../../../tools/test-camera-fall-replay.mjs) | AssertionError [ERR_ASSERTION]: real fatal falls lost their hold | 085-test-camera-fall-replay.log |
| [test-air-rescue.mjs](../../../tools/test-air-rescue.mjs) | AssertionError [ERR_ASSERTION]: side contact was misclassified as a rescue stomp | 091-test-air-rescue.log |
| [test-nitro-clear-switch.mjs](../../../tools/test-nitro-clear-switch.mjs) | AssertionError [ERR_ASSERTION]: Beachside Run did not preserve its authored-or-derived Nitro switch ownership | 093-test-nitro-clear-switch.log |
| [validate-editor-roundtrip.mjs](../../../tools/validate-editor-roundtrip.mjs) | TypeError: Cannot read properties of null (reading 'position') | 097-validate-editor-roundtrip.log |
| [test-level-security.mjs](../../../tools/test-level-security.mjs) | AssertionError [ERR_ASSERTION]: world-map coordinate exceeded its allocation bound | 098-test-level-security.log |
| [test-terrain-support-budget.mjs](../../../tools/test-terrain-support-budget.mjs) | AssertionError [ERR_ASSERTION]: country-club source rejected | 103-test-terrain-support-budget.log |
| [test-legacy-scenery-capture.mjs](../../../tools/test-legacy-scenery-capture.mjs) | TypeError: Cannot read properties of undefined (reading 'id') | 104-test-legacy-scenery-capture.log |
| [test-level-switch-transactions.mjs](../../../tools/test-level-switch-transactions.mjs) | ReferenceError: cloudPathPass is not defined | 105-test-level-switch-transactions.log |
| [test-editor-material-fidelity.mjs](../../../tools/test-editor-material-fidelity.mjs) | AssertionError [ERR_ASSERTION]: fog changed | 107-test-editor-material-fidelity.log |
| [test-editor-atmosphere.mjs](../../../tools/test-editor-atmosphere.mjs) | TypeError: skyProjection.setCloudRoadSky is not a function | 108-test-editor-atmosphere.log |
| [test-editor-current-components.mjs](../../../tools/test-editor-current-components.mjs) | Mesh ride-flag editing could not find the walkable collision inspector control (line 53). | 110-test-editor-current-components.log |
| [test-editor-runtime-integration.mjs](../../../tools/test-editor-runtime-integration.mjs) | TypeError: this.jungleAssets?.setWeatherWind is not a function | 111-test-editor-runtime-integration.log |
| [test-character-lab.mjs](../../../tools/test-character-lab.mjs) | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /label: "CHARACTER"/. Input: | 121-test-character-lab.log |
| [test-cartoon-glove.mjs](../../../tools/test-cartoon-glove.mjs) | AssertionError [ERR_ASSERTION]: 9.085 is not within 1e-8 of 2.765 | 122-test-cartoon-glove.log |
| [test-stretchable-bone.mjs](../../../tools/test-stretchable-bone.mjs) | AssertionError [ERR_ASSERTION]: The input did not match the regular expression /upperLegBone\.root\.visible = false/. Input: | 124-test-stretchable-bone.log |
| [test-meshy-head.mjs](../../../tools/test-meshy-head.mjs) | Final appearance update does not follow the final overlay at the expected source positions (line 257). | 126-test-meshy-head.log |
| [test-procedural-footwear.mjs](../../../tools/test-procedural-footwear.mjs) | AssertionError [ERR_ASSERTION]: 1.7907269101630572e-8 is not within 1e-8 of 0 | 129-test-procedural-footwear.log |
| [validate-ocean-port.mjs](../../../tools/validate-ocean-port.mjs) | Error: Continuous Unity coast collision missing: coastReviewQuery.has("coastphysics") | 133-validate-ocean-port.log |
| [test-visual-treatment.mjs](../../../tools/test-visual-treatment.mjs) | AssertionError [ERR_ASSERTION]: Sky Bridge still exposes the painted distance dome | 154-test-visual-treatment.log |
| [test-factory-defaults.mjs](../../../tools/test-factory-defaults.mjs) | Reset tuning contains extra grind, launch, pipe, teeter and trampoline settings absent from the expected factory object (line 34). | 155-test-factory-defaults.log |
| [test-special-system.mjs](../../../tools/test-special-system.mjs) | AssertionError [ERR_ASSERTION]: death must revoke the triple-mask SPECIAL override immediately | 159-test-special-system.log |

## Build and Carlisle evidence

The unchanged production code passed typecheck/build immediately before the full suite: **Codex/sol fork · build 10-30 08:18 UTC**, offline `a784ad23740db297329d`. The test-fixture edit does not invalidate that bundle.

[Machinery validation](../../../art/carlisle-shipyard/machinery/validation.json) records 2,090 motion samples, original course/asset checks, nine compiled native 1920×1080 views, three supported moving-platform carry checks, normal presentation, main/bonus/main reload, four bonus boats and zero browser console errors. The machinery evidence predates the full-suite run; this report records the later full-suite result. All eight merged trampoline-animation/camera files remain intact. This is not a whole-course-clear or full-suite-pass claim.

[Local Carlisle playtest](http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour). Nothing was pushed or published. The user requested this wrap-up; broader polish work stops here with the unresolved test results preserved.
