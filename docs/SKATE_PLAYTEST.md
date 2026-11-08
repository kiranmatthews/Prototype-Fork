# Skate → Bone Man playable study

This separate playtest starts from rollback `48e60aa4`. It does not restore the
rejected procedural carry, push or mount experiments. On 8 November 2026 the user
authorized merging and publishing this accepted increment alongside the current
game. The accepted motions are also available in D of the Jump A/B/C/D entry,
with an additional finite transition-continuity pass. Both playtests and the
218-clip source viewer are published entries in `/labs/`.

Run `npm run lab:skate-playtest`. It uses the checked-in `public/motion-study/`
samples by default. These environment variables optionally select private exports:

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
The published samples, optional reference model, eco textures and six sound
placeholders are recorded in `public/motion-study/provenance.json`. Original
game banks and extraction caches remain outside the repository. The optional
isolated development build goes to the ignored `.skate-playtest-build/`
directory and does not copy public assets; use the regular production build
to validate the deployable entries and their assets together.
That build now checks both local entry points. The server uses an isolated
`.skate-playtest-cache/` so other worktrees/native checks cannot invalidate its
dependency hashes while it is running.

## A/B/C/D integration

Open `http://127.0.0.1:5199/jump-review.html?playtest&level=codex-lab&nocrt&lite`.
D defaults to the new skate presentation. Playtest options offer **New Skate
motion in D** (off restores previous D skating) and **Board scribbles** (off
keeps the source motions and restores their original fades). A/B/C retain their
own animation documents, and switching removes the skate overlay completely.
No respawn, input reset or velocity change accompanies a version switch.
Joining D while already skating enters its riding blend without a fake mount
or ink burst. Restart/respawn retires the old source pose before placement.

Watch motion adds **Skate flow** and **Mount cancel**, using real native input
on the existing review floor. Pause at exposes the hold, unwind, board appearance,
board disappearance, mount and dismount. Render offers normal and MAX/native.
The full course, on-foot Jak/Bone Man blend, live TUNER values, ledges and eco
remain available in the same playtest.

D's transition pass briefly continues the outgoing joint velocity while the
incoming source clip blends in. The continuation decays to a finite limit;
the existing 180 ms blend (70 ms for landing) still finishes completely.
This removes the frozen first frame at each handoff without retiming the
source clips, whole-skeleton scaling, or changing gameplay. Native ledges,
grinds, bails and other specialized poses take ownership immediately. Final
render interpolation also rechecks board support: two clear, differently
tilted fixed poses can otherwise penetrate the floor between ticks. The
correction changes only the displayed board/contact joints and is restored
with the game's usual render-pose boundary. Repeated render passes are stable.
The standalone skate lab retains its accepted transition baseline for comparison.

## Controls and comparison

- WASD/arrows: native movement. Hold Space (controller X / Cross) with a
  direction to mount and accelerate; release to jump. Hold Q to brake and step
  off. R resets. The native hold threshold and tuning are unchanged.
- Motion selector: new extracted Skate presentation or original D skating.
- Compare selector / **1** and **2**: **A · Pre-scribble** restores the accepted
  Skate board fades from `22cebbe2`; **B · Scribble** adds ink over the same
  mount/dismount. Both versions share the corrected board/floor contacts. Switching also works while paused, without
  advancing or restarting the source clip. **B** triggers a native test bail.
- Riding style: relaxed, loose or aggressive source stance; Loose also selects
  the longer loose landing.
- Ride demo performs real input through the same Player controller. Hold /
  cancel demonstrates a standing preparation, brief direction cancellation,
  and re-hold before committing. Take control exits either demo. Pause, frame
  step, slow motion, four views and Pause at make every phase reviewable.
  Mount hold and Cancel / unwind stops expose the reversible preparation.
  MAX/native retains full geometry.

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

Mount and dismount now have a final board support constraint after crossfading.
It measures every visible deck, wheel and truck vertex against the native
support plane, including hardware that loads later and live board-size edits.
The smallest translation along the surface normal clears the floor by 2 mm;
a 12 mm smooth contact region avoids a hard onset. The source board rotation,
dimensions, clip timing and gameplay position remain unchanged. A tilted deck
rests on its actual tip or wheel instead of the corner of an approximate box.
Existing hand/deck-foot contacts follow the correction with the shared two-bone
IK solve, preserving wrist/ankle orientation. The other planted foot, torso and
independent segment elasticity retain their authored motion. This correction
is shared by A and B and applies only to grounded equipment handling.

## Punk board scribbles

The atlas contains 32 independently drawn thin-ink PNG frames. Playback now
uses **one full-board drawing for one 60 Hz tick**, with the emphasis on growing
in and drawing back out. Eighteen smaller drawings (atlas indices 14–31) run
backwards for growth and forwards for clearing. The larger intermediate atlas
images are skipped because they also cover the full deck at the fitted size.
Every drawing uses the same fixed-size card and pixel density: no scale tween,
stroke-width change or opacity fade. Its long axis follows the source board.

Mount growth starts during native X / Space + direction anticipation, following
the UI's `skateHoldTime` (default 0.55 seconds). Withdrawing the gesture reverses
from the currently displayed size; a full-range unwind takes 0.18 seconds.
Re-holding during that unwind grows from the current size without restarting.
Only native gameplay can commit the mount. Until then the preview cannot show
the full-board drawing or reveal a carried board, even if the speed gate delays
entry. At commitment, one full-board tick hides the switch, then all 18 smaller
drawings clear over 0.300 seconds. Entry without a preceding hold uses an
8-tick growth, one-tick apex, and clearing tail (0.533 seconds total).

Both dismounts still start at source frame 24 / 0.400 seconds, after both feet
clear the deck. Standing grows for two ticks and hides the board at its hand
catch, frame 26 / 0.433 seconds; small marks finish at frame 36 / 0.600 seconds.
Running grows for eight ticks, hides the board at frame 32, and finishes its
small marks at the hand catch, frame 56 / 0.933 seconds. Each has just one
full-board tick. The deck stays visible during growth, then stays gone through
the remaining source carry/settle. The source clock and ink cues are unchanged
by the board support correction.

The ink draws in the late pass without alpha blending or depth writes. The
floor grid no longer writes depth, so the ink can draw over the floor/grid.
Foreground limbs and other geometry still occlude it through normal depth
testing; this is not an always-on-top overlay. Pixels that would fall below the player's current support surface
project onto that surface along the viewing ray, with a 0.5 mm clearance.
This removes the straight floor cut without shifting the drawing off the deck
or changing its screen size, UVs or stroke width. It follows the actual support
normal/height, including raised ramps; above-ground pixels retain board depth.
The card splits at the contact line into at most four triangles. Hardware
depth interpolation keeps the strokes solid under multisample antialiasing;
there is no per-pixel depth override or screen-space overlay.
The flat PNG drawings, fixed dimensions and board attachment remain.

Only mount anticipation and normal equipment transitions can start ink;
arbitrary board visibility changes cannot. Bails, death, grinds and other pose
owners clear it immediately. Releasing a pending hold still performs the native
on-foot jump: the existing small preview unwinds at its last world/ground
attachment instead of following the rider into the air. A preparation that was
never rendered cannot appear for the first time during cancellation. No new
jump or bail burst is triggered. The source animations, transitions, timing and
controller remain identical in both comparisons.

Pause at **Mount hold**, **Cancel / unwind**, **Board appears** or **Board
disappears**, then Step frame to inspect growth, reversal and the single apex.
Press **1 / 2** to compare the same pose with its original board fade. Slow
motion slows simulation and ink together. Reset clears the preview and commits;
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

`tools/test-board-scribble-ownership.mjs <private-motion.json>` also replays 860
frames comparing every A/B animation transform, source timing, movement, and
board visibility/opacity. The historical `22cebbe2` comparison excludes only
the authorized board-position and contact-chain rotation corrections; all other
transforms, scales, source clocks and A's original fades still match. It includes held anticipation, direction cancellation and re-hold, short
release-to-jump, no stationary-jump preview, and exactly one committed apex.
It checks paused A/B, native bails during
mount/ride/dismount and recovery, arbitrary visibility changes, eight other
pose owners, death and reset. The temporary historical module is removed on
exit; run this check separately from builds. Browser A/B and native bail review
pass at normal and MAX/native resolution. Both dismount clips also verify the
ink finishes at its expected deadline, the board stays gone through the settle, and
paused A/B after the burst restores only A's original carried board.
The feet-clear review keeps the board visible and ink inactive through source
frame 23. A browser GPU probe also checks foreground occlusion at three depths:
all 21,248 foreground pixels remain intact, while ink still covers the surface
behind it. Disabling depth testing reproduces the original overlap failure.

Visibility regression review uses the unpaused full-render playtest and its
native input demos at normal and MAX/native resolution. Growth/reversal and
clearing remain readable across multiple rendered frames despite the one-tick
full-board apex. The board's foreground limbs and ground occlusion remain.

The floor regression samples 32 playback ticks against flat/sloped support
planes at four heights (256 cases): unchanged UVs/size, full rectangle
coverage, and no triangle crossing the depth discontinuity. The cancellation
check moves the rider/board after release and verifies that the ink keeps its
last world attachment and ground plane, then follows the board on re-hold.
The previous four-sample GPU review checked 48 frame/view/surface combinations
against the same ink with the floor hidden: zero missing ink pixels and zero
overwritten foreground pixels. Disabling the ground correction reproduced the
floor cut (up to 1,309 missing pixels). This iteration preserves that shader.

`tools/test-skate-equipment-ground.mjs <private-motion.json>` samples all four
mount/dismount clips at 120 Hz on flat, raised uphill and downhill support
planes, with different headings. All 1,620 poses clear the floor by at least
2 mm, compared with up to 0.789 m penetration before correction. An independent
world-vertex measurement verifies the support calculation; board angle/scale,
head position and gameplay position are unchanged. Late-arriving geometry is
included and hidden alternatives are excluded. The native movement replay also
checks 202 equipment/crossfade frames against the actual support plane.

The updated floor/grid GPU probe passes 48 four-sample MSAA camera/surface/
frame cases: zero lost ink pixels and zero overwritten foreground pixels.
The floor-contact shader is preserved; only the ink's late pass and the grid's
non-occluding depth policy change. Production and isolated local builds pass.

`tools/test-jump-skate-integration.mjs <private-skate-motion.json> <private-jak-motion.json>`
replays 1,091 frames through the actual D animation runtime. It compares native
movement with an untouched player, checks exact native foot poses, source/ink
timing, six overlay switches, paused restoration, respawn and other pose owners.
Across the moving clip handoffs, summed head-position second differences fall
from 0.3046 to 0.0507 (83% less abrupt change in this replay). This is a continuity
measurement, not a substitute for visual acceptance. Fixed poses and three
interpolated samples per equipment frame all clear support by at least 2 mm;
the uncorrected interpolation reproduced a 3.48 mm penetration.
Browser review covers the real A/B/C/D URL in lite/full and normal/MAX rendering,
one-tick apex, cancel/unwind, pickup, ledge pull-up, live keyboard mounting and
1–4 switching without changing course/position. The complete unpaused sequence
was recorded from the real game canvas and reviewed as captured frames. Both
builds pass; no console warnings/errors or private motion assets in production.
