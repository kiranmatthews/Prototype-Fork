# Tribal Run gameplay iteration notes

Art was held until **2026-10-27 07:28:41 UTC**, including the coordinator's crash/access compensation. The visual phase began at 07:29:01 UTC. This file records the gameplay iterations; final delivery status belongs in the release handoff.

The course uses 2,320 metres of authored route, eight chapters and nine checkpoint boxes. Uga Ambush is the length reference. The required rhythm alternates skating jumps with low rising drum terraces. The two woven lanes and four raised grind lines give repeat runs different routes. The bonus is a separate 20-crate side-view room with a real trampoline, reveal switch and breakaway lip.

## What the tests changed

- The first offbeat jump passed from a fast approach but was too tight after a careful stop with small steering corrections. The required terrace gaps are now 2–2.2 metres, with 1.1–1.2 metre rises and broad landing aprons. Movement tuning is unchanged.
- The offbeat rail initially intersected the third crown and the descending reunion. Its height now clears those surfaces through the whole line.
- Several crates used approximate slope heights. They now use the authored height functions; runtime support probes check their actual seated positions.
- Tiny separations between bonus breakaway pads stopped an on-foot approach. The pads now overlap slightly and allow 1.7 seconds of warning before dropping. Two recovery steps make the drum approachable after a miss.
- The offbeat recovery exit ended before the high route descended to it. It now continues to the reunion, with a widening/merging apron through station 508.
- The court widens before the optional crowns. Its low line stays outside the platforms and bonus stone; choosing the upper crowns remains optional.
- The main drum crowns now have curved, swelling shoulders while retaining the nine-metre takeoff and landing aprons. These are authored collision surfaces, not decoration over invisible boxes.

## Early evidence

The native main journey reached the real gate in **10,593 fixed steps / 176.55 seconds**, with all nine checkpoints, the crystal, no bails/deaths and a largest movement step of 0.84 metres. A normal-loop Chrome lite run also reached the finish with all nine checkpoints, no bails/deaths and a clean console. These precede the final crown-shoulder widening; they establish the core route, and the current geometry still needs its final full-render run.

The upper woven line passed a separate native traversal. A runtime geometry audit checked 2,721 supported road/seam positions, all five deliberately open skating gaps, 580 camera headings, all 59 ordinary crate seats, and retained 928 grindable surface edges. These counts change as the greybox is refined.

The bonus passed a continuous native all-crate journey and a Chrome lite journey: **20/20 crates**, a standalone-room gem, real finish, no deaths and no console errors. The linked parent entry/return is a separate outstanding check: a real bonus detour must bank its boxes to the parent rather than award a local gem.

The widened recovery lane and lower court line passed input-only native scenarios. The checkpoint fall/return reached the correct banked location, but the test initially asserted the endless-mode death counter in classic mode; the corrected check observes the real death state, lost life and supported return. A code-137 process exit interrupted subsequent grind cases. Each scenario now saves its result immediately.

Full traces and browser captures were retained in the worktree. Pre-crash temporary reports were lost and are not used as current handoff evidence. The findings in this section predate the final greybox run below.

## Final greybox refinements

Both upper and lower woven routes passed full-render Chrome at MAX on source hash `98d7dbac18d00949c12665f2aae3ffbd077a5938ddb88801924ae4825fd05a05`. The linked bonus also passed: actual jump-pad entry, all twenty crates, no local gem in detour mode, the original parent level retained, twenty bonus crates banked, and the authored supported court return.

The optional Crescent and Echo rails passed. The Offbeat test started only fourteen metres before takeoff and entered too slowly for its climb; its scenario now starts on the full approach after the checkpoint. The Loom grind finished above the steepening return and caught a second surface edge, so its authored rail now continues through the descent to the flat reunion.

A geometry replay of the recorded lower camera trace found six blocked sightlines under the initial 4.8-metre flyover. The deck now rises to 7.2 metres, leaving 6.4 metres underneath and clearing all 52 recorded sightlines through that region. This is geometry evidence, not a substitute for the next live traversal. The raised approach retains its separation from the lower route, and neither camera controls nor movement tuning changed. Short fruit arcs mark all four optional rail entries.

The shared host guard returned exit 75 for the next full/native static review at 07:16 UTC. The requested slot is recorded in the handoff; geometry and camera analysis continued productively while validation capacity was occupied.

## Completed greybox gate

The final greybox batch completed at 07:45:51 UTC, after the art-generation phase had begun but before the first art integration. All checks used the unchanged greybox loaded in Chrome at 1440×900 native resolution. The main and optional-route reports identify source SHA-256 `abfdee8d9dca83c71d1f2bc3d310f12cc1b6c4af9768df3a41e9ef13970e2bde`.

- One continuous 10,263-frame main run (171.05 seconds): all nine checkpoint boxes, crystal and real finish; no bail or death. The input pilot does not teleport or alter movement tuning.
- All seven separate recovery/optional scenarios passed: missed Offbeat crown → recovery floor → reunion; Court low line; banked checkpoint → deliberate pit death → supported return; complete Offbeat, Crescent, Loom and Echo grinds with safe dismounts.
- The raised upper Loom passed in 2,079 frames. The regular lower route also passed continuously. Sixteen static restart/feature views were supported, including both sides of the crossover.
- The linked bonus passed real keyboard entry, all twenty crates, the reveal switch, breakaway lip and real return. Twenty bonus boxes were banked to the parent, no standalone gem was granted in detour mode, and the parent crate state was preserved.
- Every final greybox browser report has an empty console-error and failed-request list.

The retained first native main clear finished at 06:23:35 UTC: 3 h 27 m 22 s after the prompt, or 54 m 54 s after deducting the recorded 2 h 32 m 28 s crash/access interruption. It is the earliest surviving full-course proof, not a reconstruction of lost pre-crash work. The completed greybox window provided two productive hours before image generation.

The frozen gameplay fingerprint is in `gameplay-fingerprint.json`. The subsequent visual pass checks against it; surface UVs and colours may change, while gameplay components, collision and movement remain fixed.
