# Local Skate → Bone Man playable study

This separate playtest starts from rollback `48e60aa4`. It does not restore the
rejected procedural carry, push or mount experiments. Nothing is authorized for
publication; the Jump A/B/C/D entry remains unchanged.

Run `npm run lab:skate-playtest` with these environment variables:

- `SKATE_REFERENCE_DATA_ROOT`: the private `lab-data` directory containing
  `motion.json` from the approved Skate reference lab.
- `JAK_REFERENCE_MOTION_DIR`: the existing private Jak study directory.
- `JAK_REFERENCE_AUDIO_DIR`: its `audio` directory (enables the local data middleware).

Open `http://127.0.0.1:5198/skate-playtest.html`. The server binds to loopback.
The data file stays outside the repository and `public/`; this entry is absent
from `tools/site-entries.mjs`. Its optional isolated build goes to the ignored
`.skate-playtest-build/` directory and does not copy public assets.

## Controls and comparison

- WASD/arrows: native movement. Hold Space with forward movement to mount and
  accelerate; release Space to jump. Hold Q to brake and step off. R resets.
- Motion selector: new extracted Skate presentation or original D skating.
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
