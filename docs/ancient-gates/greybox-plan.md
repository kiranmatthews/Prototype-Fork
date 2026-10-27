# Ancient Gates — gameplay notebook

Started: 2026-10-27 03:04:25 UTC. Keep the first two hours for geometry,
enemy placement, traversal, bonus design and playtesting. Begin the art pass
no earlier than 05:04:25 UTC. Following the Mac crash and access downtime,
the coordinator added 2h30 of greybox time: the revised earliest art start is
07:34:25 UTC / 20:34:25 NZDT. Productive work resumed at 06:01:20 UTC.

The former route runs from x=-20 to x=428 (448 m) and repeats three obstacle
ideas. The replacement is a 1,396 m main journey with twelve distinct
sections. Keep the east-facing side view, generous visual depth, readable
landing silhouettes and ordinary edge grinding. Preserve player tuning.

Design pillars:

- Difficult choices and precise execution, with safe places to read cycles.
- Alternate gap geometry, enemy rules, vertical movement and timing.
- Checkpoints between major sequences; no checkpoint inside a damage volume.
- Returning from the optional bonus must preserve the main run.
- Art must respect every takeoff, landing, hazard tell and camera sightline.

Planned sections: Root Steps, Split Gate, Mossback Stair, Counterweight Court,
Hammer Gallery, Broken Aqueduct, Bristle Orchard, Lantern Crossing, Wind Bells,
Sunken Switchyard, Crown Ascent, Last Gate. Each must earn its place through
a different traversal problem; do not duplicate a module to reach the length.

Bonus: a 209 m reliquary with a revealed upper gallery, conserved launchers,
a restoration switch, a steel-and-wood relay, a finite-bounce treasury and an
all-crate return. Steel anchors and restored masonry remain after their rewards
are collected; the two ordinary launch crates require upper rewards first.

Iteration evidence and measured route timings will be appended as tests run.

## Gameplay iterations

- The first five sections passed one continuous 10,527-frame input-only run
  through the production Player/Level, with zero deaths and actual checkpoint
  activations. This is preliminary evidence, before the final full-route run.
- A clock on the mandatory opening line accidentally started time trials and
  disabled checkpoints. Moved it into an optional opening alcove. The main lane
  narrows only after that choice, preserving side-view enemy encounters.
- The bonus entrance now occupies a deliberate depth detour at the reliquary.
  Ordinary forward travel does not overlap its landing catch; return is on the
  main supported court beyond the alcove.
- The aqueduct reaches its receiver with the authored skateboard physics.
  Correct committed flight releases directional trick input in the air; the
  successful pilot then brakes before continuing to the descending rail.
- Moved the aqueduct checkpoint from x=703 to x=709 to retain enough braking
  space after the rail rolls onto the final arch. No tuning change was needed.
- The lantern stair uses a 10-second repeating wave, 6.5-second solid windows,
  and 2.8-second forward offsets. It is a sequence to read and execute, with a
  permanent observation ledge before the first step and refuge after the third.
- Full native journey: 22,782 fixed frames (379.7 simulated seconds), authored
  spawn to real finish, zero deaths, zero masks spent, no accidental trial or
  bonus entry, every checkpoint active and all main-route boxes collected.
- Bonus native journey: 5,621 fixed frames (93.68 simulated seconds), 28/28
  boxes and zero deaths. Preserved both launchers until the upper rewards,
  retained all five steel relay anchors, and earned the treasury crown before
  exhausting its finite support crates.
- Real Chrome lite bonus session: reached the stone through the restored
  sunken steps; deliberately failed; returned to the same parent and retried;
  cleared 28/28 boxes; returned to x=1137 on solid ground. Parent deaths stayed
  zero, restored masonry stayed active, and the console had no errors.
- Full real-Chrome lite main journey: 22,497 fixed frames (374.95 simulated
  seconds), real spawn to finish, zero deaths or masks spent, all 26 main boxes
  and all eleven checkpoints. The exact published source was loaded; no
  console errors. The pilot supplies ordinary device samples to the existing
  fixed-step player and does not teleport or alter gameplay state during a run.
- Deliberate missed-gap recovery: after banking x=105, walked back over the
  deployed timber bridge and fell into the actual pit. One death returned to
  x=105, y=3 with four boxes, one mask and the deployed bridge preserved.
- First complete native main route was recorded at 06:48:44 UTC, approximately
  74 minutes after the prompt with the coordinator's 150-minute crash credit.
  The complete Chrome route followed at 06:57:11 UTC (approximately 83 minutes
  adjusted). Gameplay work continues through the full requested two hours.
- The expanded level inherited an unsuitable 60-second gold target. Authored
  gold/silver/bronze targets are now 330/390/450 seconds; a real clock-contact
  run is being checked. This metadata change does not alter the frozen gameplay
  geometry or invalidate the earlier normal-route evidence.

## Greybox handoff contract

The art pass must preserve the gameplay fingerprints in
`evidence/greybox/layout.json`. These cover spawn, kill plane, physical decks,
hazards, enemy placement, pickups, progression, camera and travel zones. Only
visual properties and non-colliding scenery may change. The source-to-published
comparison must still pass for the two owned level IDs.

The pre-art audit was tightened at 07:23 UTC to retain group IDs, because those
IDs also wire the restoration switches. It also excludes decorative additions
only when they explicitly declare `solid: false`. The baseline was recaptured
from the same validated greybox; no physical placement or circuit was changed.

The conservative Chrome route takes 18–40 seconds between checkpoints, with
the aqueduct providing the fastest change of pace. Timed crossings begin from
permanent observation pockets. The final 0.65-second crumble warning leaves
roughly 0.2 seconds beyond the pilot's full jump charge: intentionally severe,
but proven without masks or hidden resets. The wind-bell teeth leave a stable
read before each next gap; their crossing pilot was corrected to stop on the
short receivers instead of walking off their edges.

The original source contains no enemies. The replacement introduces eight
distinct rules across sixteen encounters, alternating stomps, vulnerable attack
windows, aerial spins and the bull's recovery. The route does not use enemy
damage as a traversal shortcut. New art must keep these attack tells and the
centres of every landing visible, and visually explain the narrow 2.5D lane.

## Encounter and pacing review

| Section | Distinct demand | Read and recovery |
| --- | --- | --- |
| Root Steps | Gaps vary in width and height; crab then Bristleback changes the attack rule; spin a bridge into place. | Stable arrival and broad enemy landings; checkpoint after the bridge. |
| Split Gate | The mine punishes the preceding spin habit; an arrow climb leads into three falling lintels. | Visible mine on a permanent court; high parapet before committing to the collapse. |
| Mossback Stair | Rising turtle stomps alternate with a hopping foe and an aerial spin on the descent. | Each enemy owns a landing with room to read its motion; refuge beyond the final gap. |
| Counterweight Court | Ride a horizontal ferry, transfer on solid ground, then catch a rising lift. | Returning motion is visible from the two permanent waiting ledges. |
| Hammer Gallery | Three different crusher periods and a swinging weight interrupt broken, descending floors. | The pilot waits outside each actual damage lane; receivers do not require a blind charge. |
| Broken Aqueduct | A single long skate commitment, braking on the receiver, then a descending balanced grind. | Runway before the kicker and a full braking receiver before checkpoint 6. |
| Bristle Orchard | Five enemy rules on staggered islands, ending with a charging bull's recovery window. | Opponents stay on supported patrols; the long final arena has a refuge beyond the bull. |
| Lantern Crossing | Cool fire-mouth window followed by three staggered disappearing steps. | Permanent launch ledge shows the whole advancing wave; the exit is permanent. |
| Wind Bells | Cross-depth swing timing on progressively higher, narrow teeth. | Each swing can be read from a stable approach; crossing stops remain on the short deck. |
| Sunken Switchyard | Restore a three-step descent, choose the bonus detour, then intercept another ferry. | Restoration is permanent; bonus return is supported and preserves the same parent session. |
| Crown Ascent | Two arrow-plus-double-jump ascents, an aerial guardian, and exposed summit gaps. | Steel arrows survive mistakes; the last checkpoint sits before the final collapse. |
| Last Gate | Tighter crumble timing into a whirler read, isolated keystone and the final mine-clear switch. | A permanent whirler landing separates the collapse from the final precise jumps. |

Repetition check: the new route has only one committed skate kicker and one
grind sequence, versus two of each in the much shorter original. The falling
steps return only as a tighter descending finale. Ferries serve different jobs:
the first transfers to a lift, while the second exits the restored switchyard.
The bonus contributes conservation and return-order puzzles instead of another
enemy corridor. Its upper prizes remain reachable by the proven order, and its
steel relay anchors remain after all five wooden caps have been collected.

Compact reports are in `evidence/greybox/`; full fixed-frame traces and browser
screenshots remain in the task-specific `/private/tmp/ancient-gates-*` folders.
Final validation will include a full-render journey through the main route,
failed bonus attempt, retry, all 28 bonus boxes, parent return and the 54-box gem,
plus native/MAX visual views. No movement or animation tuning was changed.

## Native art review

Native/MAX review resumed at 08:49:38 UTC after the coordinator reserved host
capacity. The initial twelve main and eight bonus views loaded all scenery
without console/asset errors. The review exposed visible red pit trays beneath
the ravine and the top edge of the bonus painting. The final art pass hides only
the pit pool/rim through the existing invisible flag, keeps their identical kill
volumes, enlarges the bonus matte proportionately, and adds fitted stone paving.
The corrected 20-view MAX tour passes at 2560×1440 with grounded receivers and
clean assets/console. The frozen gameplay hashes remain unchanged.

The production type-check/build passes. Final production journey and clock
checks follow without source edits; unchanged greybox traversal/recovery proofs
remain reusable through the protected gameplay fingerprints.

Production full-render evidence now includes the complete main route, actual
bonus entry, deliberate bonus failure, unchanged parent state, retry and all
28 bonus boxes, supported return, and the final 54-box gem. Main-course deaths
and masks spent remain zero; the console is clean. The clock trial scores
370.35 seconds (silver). Its initial fresh-save fixture had not unlocked trials;
a completed-save prerequisite fixes that test without altering game behavior.
The final native asset check required the new image-directory name in its
existing DOM load-event whitelist; runtime loading was already verified.

Final validation completed: all 20 level checks pass, retaining the three
successful prefix checks and resuming the corrected asset check plus the
remaining sixteen. Build and production/native browser proofs pass. The older
standalone release is 231,306 bytes over 1GB; the coordinator accepted a combined
size dependency on its validated 993,305,628-byte base. No asset-quality or
geometry reductions were made to compensate for obsolete-base packaging.
