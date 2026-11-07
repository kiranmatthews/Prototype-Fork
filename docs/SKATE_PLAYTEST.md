# Local Skate → Bone Man playable study

This separate playtest starts from rollback `48e60aa4`. It does not restore the
rejected procedural carry, push or mount experiments. Nothing is authorized for
publication; the Jump A/B/C/D entry remains unchanged.

Run `npm run lab:skate-playtest` with these environment variables:

- `SKATE_REFERENCE_DATA_ROOT`: the private `lab-data` directory containing
  `motion.json` from the approved Skate reference lab.
- `JAK_REFERENCE_MOTION_DIR`: the existing private Jak study directory.
- `JAK_REFERENCE_AUDIO_DIR`: its `audio` directory (enables the local data middleware).

Open `http://127.0.0.1:5199/skate-playtest.html`. The server binds to loopback.
Port 5198 is occupied by a different checkout; use this dedicated port. The
same server hosts `/labs/`, the adopted 218-clip `skate-reference-lab.html`,
and `jump-review.html?playtest&level=codex-lab&nocrt&lite` with its private Jak
middleware. `/labs` discovers every local HTML entry and always uses the
current development origin instead of an obsolete saved port.
The data file stays outside the repository and `public/`; this entry is absent
from `tools/site-entries.mjs`. Its optional isolated build goes to the ignored
`.skate-playtest-build/` directory and does not copy public assets.

## Controls and comparison

- WASD/arrows: native movement. Hold Space with forward movement to mount and
  accelerate; release Space to jump. Hold Q to brake and step off. R resets.
- Motion selector: new extracted Skate presentation or original D skating.
- Compare selector / **1** and **2**: **A · Pre-scribble** restores the accepted
  Skate presentation and board fades from `22cebbe2`; **B · Scribble** adds ink
  over the same mount/dismount. Switching also works while paused, without
  advancing or restarting the source clip. **B** triggers a native test bail.
- Riding style: relaxed, loose or aggressive source stance; Loose also selects
  the longer loose landing.
- Run control demo performs real input through the same Player controller.
  Take control exits it. Pause, frame step, slow motion, four camera views and
  Pause at make every phase reviewable. MAX/native retains full geometry.

The new animation layer only observes gameplay. Acceleration, jump velocity,
turning, braking, collisions and UI tuning remain native. D's earlier Jak jump,
roll, idle and hybrid run document is retained for on-foot movement. Specialized
tricks, grinds, bails, wall rides and ledges retain their existing pose owners.

## Motion and contact mapping

`retarget.ts` is adopted from the approved reference lab commits `b967f838` and
`c00bc86e`. The 218-clip dataset has SHA-256
`2adbfff0bf1b0eac08aa8a994d3e1beba36c9cddba574d9296757e05c412f04b`.
Its extraction provenance and Blender validation remain with that lab; no
external extraction toolkit or disc data is copied here.

The playable subset uses standing/running mounts, stand/run dismounts, slow/fast
push entry/cycle/recovery, three riding stances, high ollie crouch, low ollie air,
and aggressive/loose landings. Source rotations and native sample timing are
preserved. Off-board clips remove their trajectory from rider and board together.

Finite transitions crossfade from the displayed animation-space pose. Persistent
Character Lab proportions are applied once, after blending. A started push
finishes before high-speed coasting. Actual support loss/landing owns air/impact;
descending air blends toward the source catch pose. On-foot jumps and other
actions can interrupt equipment handling. Board visibility is limited to skating
and finite mount/dismount; short fades cover the source clips' carried endpoints.

## Punk board scribbles

The default board effect uses thirty-two independently drawn thin-ink PNG frames.
Mounts and running dismounts play at **60 fps**, lasting 0.533 seconds; standing
dismounts fit the same drawings into 0.4 seconds (80 fps). Eight rapid full-size
redraws have a long,
slim deck silhouette; subsequent drawings use fewer, shorter strokes with the
same pen weight. A single fixed-size billboard swaps atlas cells, never scales
down the artwork or fades it. Its long axis follows the board in the camera.
The appearance switches under the full-size ink. Disappearance follows the
source prop's pickup path, clearing at the first stable hand catch: source frame
26 / 0.433 seconds for standing, 56 / 0.933 seconds for running. The effect starts
at 0.033 / 0.400 seconds respectively. The vanished board stays hidden through
the remaining source carry/settle, including after the ink has finished.

Only a normal mount or dismount can start ink; arbitrary changes in board
visibility cannot. Bails, death, jumps, grinds and other pose owners cancel any
active ink immediately. No dismount ink continues into the on-foot settle.
The source animations, transitions, timing and controller are
unchanged in both comparisons.

Pause at **Board appears** or **Board disappears**, then Step frame to inspect
the sequence and press **1 / 2** to compare the same pose with its original
board fade. Slow motion slows the simulation and ink together. Reset, brief
gestures and remounts clear/restart the effect without retaining a carried board.
Original D skating remains a separate unmodified motion comparison.

Asset and final generation prompt: `src/skateReferenceLab/assets/README.md`.
The PNG and the source-motion viewer are local entry dependencies only; the
production build does not include either motion study or private source data.

Ground/deck contacts use source contact weights and the actual authored deck
surface, with shared two-bone IK and a pelvis translation. Brief carry contact
fits the source hand-relative board transform to Bone Man's arm proportions.
Source limb extensions and the shared editable elasticity profile remain
independent segment deformations. Physics never reads these corrections.

This is an initial gameplay assembly of approved raw graph leaves, not Skate's
original animation graph or physics. It is intended for local visual iteration.

## Validation

1,980 paired native simulation frames preserve movement exactly and cover
complete sequences, short gestures and remounts. Overlay ownership, restoration,
preview and exception tests pass. Level checks, production type-check/build and
the isolated local build pass; normal dist contains neither this entry nor
private motion JSON. Real browser review covers normal/native rendering, three
consecutive keyboard mounts, release-to-jump, the source sequence and comparison
controls, with no console warnings/errors. Visual acceptance remains with the user.

`tools/test-board-scribble-ownership.mjs <private-motion.json>` also replays 660
frames against the actual accepted pre-scribble source at `22cebbe2`, comparing
every animation node's position, rotation and scale, source timing, movement,
and A's board visibility/opacity. It checks paused A/B, native bails during
mount/ride/dismount and recovery, arbitrary visibility changes, eight other
pose owners, death and reset. The temporary historical module is removed on
exit; run this check separately from builds. Browser A/B and native bail review
pass at normal and MAX/native resolution. Both dismount clips also verify the
last ink frame precedes the catch, the board stays gone through the settle, and
paused A/B after the burst restores only A's original carried board.
