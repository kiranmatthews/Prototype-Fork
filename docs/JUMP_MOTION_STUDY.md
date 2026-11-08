# Jump motion study — 3 November 2026 NZDT

The local Jak and Daxter study informs the timing and silhouettes of original
Prototype Fork animation curves in B/C. D directly retargets the supplied game
data for comparison. On 8 November 2026 the user authorized merging and publishing
the accepted playtest alongside the current game. The comparison samples,
optional reference model, eco textures and jump sound placeholders are now in
`public/motion-study/`, with hashes in `provenance.json`. The original disc data,
game banks and extraction caches remain outside the repository.

The source's arms trail low at takeoff, spread into bent wings as the knees
gather, and rise during descent. Its compact apex pitches the body forward while
the head counterbalances. The OpenGOAL controller retimes the rising pose toward
authored frame 20 at the physical apex; double jump restarts the same jump family
at frame 5 with a 50 ms blend. We adapt those principles to this character's
proportions and existing controller. This is not a claim of identical game feel:
A and B preserve the existing physics. The later C experiment changes only
normal on-foot flight, retaining the existing release/hold-to-skate input rules.

`src/animation/jumpReferenceMotion.ts` supplies the editable pose changes:

- Jump keeps the large independent torso/limb stretch, begins gathering sooner,
  and reaches an asymmetric knee tuck at the physical apex. Fall begins from
  that same pose and lifts the arms while opening the legs for landing. Fall's
  timeline is normalized downward speed; the recovery spans that interval.
- Double jump replaces the wide split with a second pop, compact asymmetric tuck,
  and descent recovery. A 50 ms presentation blend catches the interrupted pose.
- Landing retains the existing compression, rebound and finite settle. The
  chest, head, elbows and wrists follow through at different times.

The shared elasticity profiles retain ownership rules; segment length curves
remain editable in Animation Studio. A/B introduce no whole-skeleton scale animation, root motion, movement
constants, jump impulses, steering, collisions or jump-input changes. Slide jumps and specialized launch/board clips keep their poses.
Holding jump while running still mounts the board according to the existing rule.

Catalogue 38 upgrades only exact untouched old defaults, including normalized
saved drafts. Edited clips and deliberate deletions remain intact. The old
factory curves are retained for that comparison. The regression fixture
`tools/fixtures/pre-reference-jump-clips.json` contains **Prototype Fork's own
catalogue 37 curves**, generated from `createPlayerStarterClips()` at commit
`1a191907`; it contains no extracted Jak keyframes.

## Review and validation

`jump-review.html?playtest&level=codex-lab&nocrt` starts in **live play** on the
selected level, with normal keyboard/controller input and the regular camera.
Press **1 / 2 / 3 / 4** or click the four visible buttons:

| Variant | Animation | On-foot physics | Sounds |
| --- | --- | --- | --- |
| A · Original | Previous catalogue 37 | Original | Original |
| B · Animation | Revised jump family | Original | Local Jak placeholders |
| C · Jak feel | Earlier gather, deeper body fold, shorter stretch | Experimental Jak fit | Local Jak placeholders |
| D · Direct Jak | Extracted source curves retargeted to Bone Man, native locomotion transitions | Calibrated source jump timing, Bone Man walk/run behavior and existing input gesture | Local Jak placeholders |

Switching does not respawn or reset velocity. An air-physics selection takes effect
at the next ground jump; each in-flight arc retains the profile it launched
with. A's double-jump blend is the original zero-length transition; B/C use
50 ms. Uncheck **Jak sounds in B / C / D** to compare motion without audio changes.
The session uses ephemeral campaign progress and never saves animation drafts.

C uses symmetric 60 m/s² gravity, approximately 1.05–2.8 m first-jump heights,
1.8 m additional second-jump height, 120 ms directional steering and 220 ms
neutral air coasting. The reference has 1.01–3.5 m first-jump and 1–2.5 m
second-jump targets with a 0.7 m collision offset; our values fit those principles
to the existing character and collision controller. The source's animation
time-to-apex calculation uses 245760 GOAL units/s² (60 m/s²). C retains
release-to-jump so the existing held-button skateboard mount stays intact.
This is an experimental feel variant, not a reconstruction of every Jak input
or collision rule. No global tuning is modified. Board, park/vert, slide,
crouch, spring, grind-exit, kite and ragdoll paths retain their normal rules.

Measured on the real controller at 60 Hz: three-frame tap peaks at 1.268 m
with 0.417 s airtime; full jump peaks at 2.799 m with 0.617 s airtime; a second
jump adds 1.799 m. Tests compare both directions of mid-flight profile switching
against an uninterrupted control trajectory. The existing 1,344-frame skating
suite runs with C selected on one rider and default settings on the other;
all movement and contact checks match, as does the 180-frame hold-to-mount test.

**Playtest options → Watch motion** retains the automated tap/full/double/run
sequences, camera angles, slow motion and phase pauses. **Play course** returns
to the previous course position. Add `lite` to the URL for the fast renderer.
The comparison page is a published `/labs/` entry. Opening `jump-review.html`
without parameters also starts the playable comparison on Codex Geometry Lab.
The dated local-only notes below describe the earlier development stages and
are superseded by the 8 November publication request.

## Local sound placeholders

The resident `COMMON.SBK` in the supplied USA NTSC-v1 data contains `jump` and
`jump-double`. The local extractor decodes PS-ADPCM, applies each tone's pitch
and volume, and schedules the second jump's voice at 12 sound ticks (50 ms).
There are three variations for each cue. The resulting WAVs use linear
resampling rather than the original SPU interpolation and mixer. The four pitch
register values match OpenGOAL's table calculation: 1675, 1774, 1880 and 1364.

```sh
python3 tools/extract-jak-jump-audio.py /path/to/SBK/COMMON.SBK /path/to/local-study/audio
JAK_REFERENCE_AUDIO_DIR=/path/to/local-study/audio npm run dev -- --host 127.0.0.1
```

The development server exposes only the six named WAVs and manifest. It loads
them atomically and routes semantic launch cues through the normal SFX bus,
volume controls and unlock policy, avoiding immediate repeated variants. This
also works in the playable level. Missing files retain the project sounds.
Extracted assets stay outside the repository, `public/` and production builds.
The extractor, sound routing and review tools are reproducible source code.

Primary implementation evidence:
[jump controller](https://github.com/open-goal/jak-project/blob/v0.3.9/goal_src/jak1/engine/target/target.gc),
[bank reader](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/loader.cpp),
[grain sequencing](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/sfxgrain.cpp),
[240 Hz sound clock](https://github.com/open-goal/jak-project/blob/v0.3.9/game/sound/989snd/player.cpp).

Focused checks:

- `node tools/test-jump-reference-motion.mjs`: original pose intent, exact and
  normalized saved upgrades, preserved edits/deletions, 1,820 frames across tap,
  full, running and early/apex/late double jumps, exact before/after controller
  position/velocity/steering parity, and finite landing recovery.
- `npm run check:animation`: suite/schema, IK, runtime routing, fixed-length leg
  solve, all four clips' arm clearance, board contact regression, and elasticity.
- `node tools/test-idle-recovery-charge.mjs`: planted charge, tap/full input,
  landing's timely idle recovery, and no second recovery fade.
- `node tools/test-jak-jump-physics.mjs`: C heights/airtime, momentum, finite
  recovery, selection continuity and unchanged hold-to-skate behavior.
- `node tools/test-jump-audio.mjs`: launch fallback, atomic bank installation,
  sound selection and non-repeating variants with no extra pitch jitter.
- `npm run check:audio`: existing loop, replay and footstep behavior.

Review at full render resolution as well as the normal game presentation. The
reference is pose/timing guidance, not an assertion that our motion reconstructs
the original game's renderer, physics, animation blending or effects.

## D — direct source retarget, 3 November 2026 NZDT

D loads the extracted Jak 1 `eichar-lod0` skeleton samples from a local-only
endpoint. `tools/extract-jak-motion.mjs` samples the original curves at 60 Hz;
`tools/jak-direct-motion.ts` maps source world frames onto Bone Man's semantic
rig, calibrating the different arm bind axes and solving local rotations in
hierarchy order. It transfers the waist's compression/translation as a separate
lower-spine motion. The shared editable segment-length controls carry the
source stretch and rebound without scaling the whole skeleton.
The twenty sampled source joints drive the main body; Bone Man retains its own
proportions, procedural fingers and accessory motion.

This includes stance, walk/run, jump and jump-forward, the second jump's restart,
fall, full/short landing recovery, run-squash and weak run-squash. Source jump
frame 20 follows the physical apex; double jump restarts at frame 5. Following
the locomotion-continuity pass below, walking/running use Bone Man's cadence,
analog mixture and turn-aware presentation speed rather than raw foot velocity.
Moving landings retain the source catch/rebound while blending the legs into
a continuing, phase-matched walk/run cycle. The waist and root finish their
bounce separately. Letting go of movement uses Bone Man's momentum-driven
brake and finite settle, with a phase-matched return to the Jak stance. New
input interrupts recovery immediately and matches the incoming stride phase.

**The user's explicit control preference is retained:** release to jump, hold
while running to skate, and tap/release again in the air for double jump. The
project's charge gesture remains intact; D does not switch to Jak's immediate
press/hold input. Following the 4 November movement-polish request, D keeps
60 m/s² flight gravity and the source -15 to +3 m/s double-jump window, but uses
our native walk/run acceleration, turns, inertia and air steering. The new
2.900–3.613 m first-jump targets are calibrated to A's visible skull peaks with
the forward flip enabled. The second boost interpolates 0.5845–0.7915 m by the
first jump's charge, accounting for D's higher first arc. See the measurements
below. Existing collision, camera and special-surface systems still apply.
This is direct motion retargeting and selected controller rules, not a port of
the entire Jak engine.

The page defaults to D when the local bank is available. **Watch motion → Show
original Jak alongside (D)** plays the full original model beside Bone Man at
the same source frame, including walk/run and jump-forward blends. The overlay
labels native transitions explicitly. **Run and stop** includes landing,
braking and settling. **Reverse and restart** demonstrates a full reversal,
an interrupted stop, a perpendicular turn and the return to idle; **Pause at
→ Turn / Restart / Settled** isolates those moments. Use **Hide controls** for
an unobstructed comparison, then **Show controls** to change the view. A/B/C
remain available; selecting a variant does not teleport or reset velocity.

```sh
node tools/extract-jak-motion.mjs /path/to/local-study/eichar-lod0.glb /path/to/local-study/motion.json
JAK_REFERENCE_AUDIO_DIR=/path/to/local-study/audio npm run dev -- --host 127.0.0.1 --port 5188
node tools/test-jak-direct-motion.mjs /path/to/local-study/motion.json
node tools/test-skate-charge-ollie.mjs --direct-jak
```

The motion directory defaults to the audio directory's parent, with an optional
`JAK_REFERENCE_MOTION_DIR` override. Only `motion.json` and `eichar-lod0.glb` are
served there. Neither the retargeted keys nor the original model enter Git or
the production bundle. The source overlay loads only when requested in the
local inspector. Its complete LOD0 geometry is retained.

Initial D validation (before the later height/locomotion changes): 1,025 sampled poses preserve all eight major limb directions to
within 0.0000013 degrees; the actual live apex also matches after runtime
composition. Real-input tap/full peaks are 1.083/2.799 m and the second pop adds
1.799 m. Landing and pacing finish; no supporting-floor penetration was found.
Hold-to-skate/release-to-ollie is exercised in D. The D-enabled 1,344-frame
campaign/park skating regression matches the default controller exactly in
both stances, including contacts and animation ownership. C physics, 1,820
paired A/B frames, runtime checks, strict types, build and release size pass.

### Board reference

Jak II has a dedicated jetboard controller and matching `jakb-board-*` clips:
ride/turn in four directions, duck/pump, airborne lean, get-on/get-on-land,
jump/jump-loop, hit, flips, spins and grinds. Those are suitable source motions
for a future skating retarget. The supplied **Jak 1** bank does not contain
them; direct extraction requires legitimate Jak II game data. Jak 1's ice-skate
motion and zoomer riding are different actions. D leaves current skating intact.

Primary evidence: [Jak 1 flat thrust](https://github.com/open-goal/jak-project/blob/v0.3.9/goal_src/jak1/engine/target/logic-target.gc),
[surface constants](https://github.com/open-goal/jak-project/blob/v0.3.9/goal_src/jak1/engine/collide/surface-h.gc),
[Jak II board source documentation](https://opengoal.dev/docs/source-docs/jak2/packages/engine/target/board/).

## D — ledge suite and restored forward jump flip, 4 November 2026 NZDT

The local extractor now also samples all seven Jak 1 ledge clips:
`falling-to-edge-grab`, `edge-grab-swing-left`, `edge-grab-swing-right`,
`edge-grab-stance0`, `edge-grab-stance1`, `edge-grab-to-jump`, and `edge-grab-off`.
The 1.15-second catch selects its swing from incoming lateral velocity, then
alternates the complete 0.667- and 2.767-second hold poses. Climb input can
interrupt the catch immediately after the existing grip settle. The source
20-frame pull-up follows the existing mantle progress; the release plays over
the existing drop. Collision, reach, grip timeout, climb path and input remain
owned by the ledge controller.

Retarget the hanging poses relative to the hands instead of the feet. Adapt
Bone Man's glove sockets to the actual world lip after source elasticity and
editable proportions. The contact solve eases out during pull-up. Existing
shimmy movement uses alternating planted hands and short reaches; Jak's left
and right swing clips are directional catches, not invented source shimmy
animations. Moving platforms carry the contact origin with the ledge.

**Jak forward flip in D** defaults on. The source `wheel-flip` (roll jump) supplies
the full rotation, tuck and unfurl; `wheel-flip-land` supplies stationary
recovery. The pose rotates about Bone Man's hips without adding source root
travel. Its 39 frames fit the normal jump's flight, finishing before touchdown;
double jump and ledge catch interrupt it. Running landings keep the existing
Jak run-squash and subsequent run-to-stance pacing. Switching the checkbox off
restores D's upright source jump. A/B/C remain unchanged.

Under **Playtest options**, **Ledge playground** opens a local two-height block
fixture with normal controls. **Watch motion → Motion** selects the three
catches, holds, climb, release, shimmy, or the jump examples. View, slow motion,
freeze and pause-at controls support inspection. **Show original Jak alongside
(D)** uses the same source frame with contact/hip placement normalized for the
comparison; it retains the complete original geometry. This is source motion
adapted to Bone Man's proportions and our controller, not a replacement for
Jak's entire ledge or rolling-jump physics.

Source implementation evidence is the locally available OpenGOAL v0.3.9
`goal_src/jak1/engine/target/target2.gc` (`target-edge-grab`,
`target-edge-grab-jump`, `target-edge-grab-off`) and `target.gc`
(`target-wheel-flip`, `target-wheel-flip-land`). Source keys and the original
model remain in the external study directory, served only by the local dev
middleware. They are absent from Git and the production release.

Validation adds `node tools/test-jak-ledge-flip.mjs /path/to/motion.json`:
2,485 native frames cover all catches, both hold poses, climb, release,
planted shimmy contacts, exact flip-off/on movement parity for tap/full/running
and double jumps, and hold-to-skate. Maximum settled/catch grip error is
0.000193 m on the default Bone Man. The raw retarget test now checks 1,599 poses,
preserving major limb directions within 0.0000013 degrees. Strict playtest types,
production build and release-size checks are also required before handoff.

## D — ledge traversal polish, 4 November 2026 NZDT

The initial short, reduced-input shimmy check missed full-speed reversals.
Distance-quantised hand targets dragged the visual torso sideways and could
rewind during a direction change. The local playground also displayed an
inspection camera while movement could still read the course camera.

D now uses a timed alternating reach with one fixed world-space plant. A
reversal redirects the lifted hand from its current position; releasing the
stick finishes the reach and settles the displaced grips once. The torso
follows the ledge independently of the contact midpoint. A small bounded visual
path and facing transition handle corner clearance changes. Hand destinations
are projected onto the actual top boundary, including narrow supports, and a
shoulder adjustment fits the edited arm lengths after the IK solve. Moving
platforms carry the stored contacts and visual centre. Switching away from D
clears those contacts before returning to it.

Traversal uses the source's quiet hanging pose while hands are stepping. The
expressive alternating source holds resume after stopping. These reaches are
an adaptation for our existing shimmy controller; the original swing-left and
swing-right clips remain directional catches. The existing 2.4 m/s traversal,
collision path, climb/drop logic, jump physics and skating gesture are retained.

The playground now resolves input through the displayed camera, including its
frozen diagnostic view. **Watch motion → Shimmy ledge** exercises full-speed
reversals. **Control this ledge** takes over the current hanging pose without
respawning, leaving the same controls available for manual practice.

Validation: `tools/test-ledge-hands.mjs` checks planted contacts, reversals,
finite settling and moving-support carry at 30/60/120 Hz. The external-bank
`tools/test-jak-ledge-traverse.mjs` checks 1,731 native frames: both directions,
multiple reversals, stopping, both corner routes and switching back to D.
Straight traversal's worst hip displacement fell from 0.133 to 0.052 m/frame
at 60 Hz, with no backwards steps against held input. Default-rig hand residual
stays below 1 mm in the straight/corner fixture. The existing 2,485-frame
ledge/flip/skate regression, strict playtest types and production build pass.
Manual browser reversals, an actual corner traverse and normal/native views
are saved in the external `ledge-shimmy-review` directory. No console errors.

## D — movement, proportions and height polish, 4 November 2026 NZDT

The run's source waist could extend to more than twice its stance length.
Bone Man already has a separate lower-spine segment, so that translation made
the pelvis and legs appear detached from the upper body. Walk/run, run-stop
and moving-land clips now retain 25% of that length variation, bounded to
0.85–1.18 times the resting waist. Source bending, limb directions and the
independent editable segment deformation controls remain. This correction is
local to D's generated suite.

D now follows the game's native walk/run controller, including analog walking,
the 9 m/s run cap, acceleration ramp, committed turns, stopping inertia and air
steering. A 240-frame walk/accelerate/turn/coast sequence produces exactly the
same positions, speeds and turnaround flags as A. The inspector adds **Walk,
run and turn** for viewing this without repeated manual setup.

Jump heights are matched using the highest world-space vertex of Bone Man's
actual skull mesh during flight, rather than just the collision root. These
measurements use default Bone Man proportions, the restored flip enabled, and
the same charge durations; double jumps are released at each variant's apex.
The highest error across 12 tap/partial/full/running/double comparisons is
0.0152 m. Representative peaks above the common floor:

| Jump | A skull peak | D skull peak |
| --- | ---: | ---: |
| Tap, 1 frame | 5.0475 m | 5.0491 m |
| Half charge, 12 frames | 5.3521 m | 5.3672 m |
| Full charge, 24 frames | 5.7154 m | 5.7159 m |
| Tap + double | 6.6634 m | 6.6638 m |
| Full + double | 7.4345 m | 7.4359 m |

The higher first arc compensates for the flip lowering the visible head. Its
charge-dependent second boost compensates for that higher starting point.
Changing the presentation-only flip toggle still leaves controller movement
identical; the height comparison above specifically describes flip-on D.

Moving landings now resume the distance-driven walk/run stride under the source
rebound. Legs recover first; the torso/root keep their finite bounce, and the
incoming loop continues from the same sampled phase. Starting to run during a
standing landing also uses this path. The measured head displacement at the
final landing-to-locomotion handoff is zero in the comparison fixtures. After
independent leg/torso blending, a D-only sole correction lifts any downward
floor penetration without suppressing the upward rebound or moving collision.

Ledge grips widen from 0.60 to 0.70 m; D traverses at 2.0 instead of 2.4 m/s,
retaining the 0.12 s alternating reaches so the wider trailing grip stays in
reach around corners. Its pull-up takes 0.475 instead of 0.38 s.
Corner contact projection is bounded to the planned reach radius; a support
probe on the next face must shorten the reach instead of extending it.
The source root changes from hand-relative to foot-relative during the latter
half, then a 0.20 s pose settle blends into the requested movement. The validated
deck becomes ground support immediately, preventing an extra air step, speed
spike or landing one-shot. Controls resume during that settle. The default-rig
late climb head step is below 0.060 m/frame at 60 Hz, including running away.

`tools/test-jak-d-polish.mjs /path/to/motion.json` exercises 6,620 native frames
for skull peaks, exact A/D locomotion parity, waist range, landing handoff and
stationary/moving pull-up recovery. `--calibrate` additionally solves height
targets against A and prints the measurements without changing source files.
The focused source-retarget, ledge/flip, corner/reversal and skateboard checks
also pass: 1,599 source poses, 2,485 ledge/flip frames, 1,731 traversal frames
and the campaign/park board comparison. Worst straight/corner grip residual
is 0.000273 m, with no backwards torso steps during traversal. Strict playtest
types, runtime routing, production build and release-size checks pass (803,510,039
bytes). Browser evidence in the external `d-movement-polish/` directory
shows normal/native rendering, the source comparison, running rebound, a manual
corner traverse and a pull-up into movement. No browser errors. The final scene
switch emitted 44 texture-without-image warnings within 0.4 s; no later warnings
were recorded during the remaining review. The earlier browser passes were
warning-free. Both console captures are retained with the evidence.

This remains a local A/B/C/D comparison. A/B/C, level data, global tuning, source
assets and production entrypoints are unchanged; no publication is authorized.

## D — Bone Man locomotion continuity, 4 November 2026 NZDT

The native controller was already restored, but D still sampled animation
from raw foot velocity. During a committed reversal, that velocity crosses
zero while Bone Man deliberately keeps his running gait alive. D therefore
slowed/froze the source cycle and mixed in walking at precisely the wrong time.

D now uses the shared walk/run blend and normalized cycle clock. Source run
and walk poses retain their original keyframes, with playback rates derived
from Bone Man's corresponding cycle lengths and saved speeds. Starts and stops
use the existing whole-pose phase matching and moving outgoing fades. A quick
restart during braking also matches the incoming D stride before its fade.
The raw-speed special case is retained only for the jump-forward pose mixture.

Bone Man's native run-stop animation replaces the 8.17-second source pacing
sequence. Its brake phase follows remaining momentum; its final 0.25-second
settle blends into the Jak idle at the same phase. Renewed movement interrupts
it immediately. D's landing/climb recovery uses turn-aware presentation speed
for the continuing strides, retaining the independent waist/root rebound.
Jump physics, calibration, input gestures, ledge contacts and board clips are
unchanged. The source overlay labels native transitions rather than pretending
they are sampled Jak frames.

Validation: the new `tools/test-jak-locomotion.mjs` compares 1,360 real-controller
frames through analog walking, a 180-degree reversal, a perpendicular turn,
coasting, interrupted braking and idle. Position, velocity, facing and selected
clips match A exactly. All 463 consecutive gait frames match native normalized
cadence within 3.34e-15; nine low-speed reversal frames keep full run weight.
Maximum start/stop head-height step is 0.0291 m. The existing 6,620-frame polish
check passes: twelve jump-height comparisons remain within 0.0151 m of A and
landing handoffs have no measurable head-position discontinuity. All 1,108
remaining direct-source poses preserve major limb directions; source-flight
and board-mount checks pass. Campaign/park ollies retain exact motion parity
over 1,344 frames. Runtime routing, strict review types, build and release-size
checks pass (803,509,782 bytes); review HTML/source assets remain local.

Browser review covered lite/full rendering, normal 720p and native resolution,
side/oblique views, reversal/restart/settle and A-to-D switching. Original Chrome
render settings were restored and its temporary test tab closed. The in-app
browser automation connection disconnected during review, so Chrome completed
the visual checks. No game JavaScript errors appeared; Chrome logged two
startup audio-gesture warnings and an unrelated missing `favicon.ico` request.
Evidence is external in `d-locomotion-continuity/`, beside the source bank.

Approximately 22 minutes prompt-to-validated playable (03:09–03:31 UTC).
Local comparison only; no integration or publication.


## D — double-jump continuity and upward accent, 4 November 2026 NZDT

The second impulse already moved the controller upward, but its presentation
crossfaded from a frozen airborne pose in 0.05 seconds. Interrupting the flip
could turn the hips 85.6 degrees in one 60 Hz step. The reused first-jump source
also gathered too early for the short second arc, obscuring its upward motion.

D now keeps the outgoing airborne source moving through a 0.14-second blend.
Its double-jump source clock follows the actual remaining rise, with the apex
pose adapted to the captured first-jump charge. The extension reads as a second
lift and the gather flows into descent. Original source poses and independent
segment deformation remain intact. Player supplies the current flight gravity
and captured charge to presentation; no velocity, height, eligibility or input
rule changes. The source overlay follows the retimed pose clock. Watch motion
adds Running double jump and a Second boost pause point.

`tools/test-jak-double-jump.mjs /path/to/motion.json` covers eighteen real-player
cases: short/partial/full charge, standing/running, flip on/off, and three second
jump timings near/below the apex. It checks a positive initial head/hip rise and
bounded interrupted-flip rotation. `--baseline /path/to/before.json` additionally
compares every physical position and velocity sample; all 3,600 frames match the
pre-change recording exactly. The weakest three-frame head rise improves from
0.0126 to 0.4749 m, and worst per-frame hip rotation drops from 85.6 to 31.5 degrees.
Every tested first-four-frame head step remains upward (minimum 0.1189 m).

The existing 6,620-frame polish regression passes unchanged: twelve A/D head
peak comparisons remain within 0.0151 m; double-jump errors are below 0.0086 m,
landing handoffs stay continuous, and movement/climb checks pass. Campaign/park
board parity passes over 1,344 frames. Runtime routing, strict review types,
production build and release-size check pass (803,510,877 bytes). Source assets
and the local review entry remain excluded from release.

Browser review covers standing/running double jumps, interrupted flip, native
resolution and normal 720p presentation, A/D switching, and running landing
rebound. Evidence is external in `d-double-jump/` beside the source bank, including
before/after physical traces, height checks, build log, screenshots and console
capture. No console errors or warnings were recorded in the final browser pass.
Original render settings are restored. This is a local A/B/C/D follow-up;
no integration or publication. Approximately 23 minutes prompt-to-validated
playable (03:54–04:17 UTC), followed by the local commit and handoff.


## D — source idle and recovery continuity, 4 November 2026 NZDT

Confirmed the idle against the locally available OpenGOAL v0.3.9 controller:
`target.gc` lines 356–373 use `eichar-stance-loop` for normal grounded stance.
D was already sampling that clip. Its final appearance layer additionally
applied Bone Man's default 19-degree neutral-arm offset, distorting both source
arm directions. D's source landing/climb recovery did not carry that offset,
so changing to idle switched it on in one frame: about 19 degrees of visible
hand rotation and up to 0.1794 m of hand displacement.

When the idle is direct-source motion, the runtime now leaves resting shoulder
angles under the authored pose's control. The existing moving recovery and
phase-matched handoff remain intact. Native Bone Man idle, its editable rest
angle, other variants, motion clocks, source keyframes, physics, skating and
independent segment elasticity are unchanged.

Watch motion adds Idle and Idle and stops. The latter runs, brakes, settles,
walks and settles again. A jump's Settled pause now waits for actual locomotion
ownership and the completed blend; the former fixed 40-frame pause could stop
partway through the longer flip landing and mislabel that pose as settled.

`tools/test-jak-idle.mjs /path/to/motion.json` exercises 2,940 real-controller
frames across seven cases: idle, run stop, walk stop, tap landing, flip landing,
double-jump landing and ledge get-up. It measures final hierarchy rotations,
hand/foot positions and source arm directions after the appearance layer.
Angular discontinuity at all idle handoffs is below 6e-8 radians; the maximum
joint displacement is 0.00056 m during walk coasting. Steady idle arm directions
match the sampled source within 0.00118 radians (0.068 degrees, including source
frame rounding). `--measure` records pre-fix evidence without enforcing the
continuity limits.

Existing native idle/charge recovery, runtime routing and 1,360-frame locomotion
parity checks pass. The 6,620-frame D polish regression keeps all twelve A/D head
peaks within 0.0151 m and landing-to-locomotion head displacement at numerical
zero. Strict review types, production build and release-size checks pass
(803,510,988 bytes). No source assets or local review entry ship in release.

Browser review covers the original stance alongside Bone Man, completed flip
landing into idle, run/walk stops, front/side/oblique views, full rendering and
normal/native resolution. Original 720p/2× settings restored; D left in live
play. No console errors or warnings. Evidence is external in `d-idle-continuity/`, beside the source bank.
Approximately 12 minutes prompt-to-validated playable (04:59–05:11 UTC).
Local A/B/C/D comparison only; no integration or publication.

## D — native idle and hybrid run, 4 November 2026 NZDT

D now retains the exact Bone Man idle from A/B/C, including its playback speed,
elasticity and editable resting arm pose. The Jak stance remains the retargeting
calibration reference, so changing idle does not alter jump or ledge keyframes.
Source landing and climb recovery gradually restore the native arm-rest layer
with the upper-body pose and hand off at the same idle phase. D's floor correction
continues during this recovery even though its movement hint now names a native
idle. This prevents a roughly 1.9 cm shoe penetration found in the first pass.

The run is a 50/50 blend of A's Quaternius jog and D's retargeted Jak run. A
whole-cycle comparison of hips, knees and ankles aligns their strides before
mixing: the native cycle is offset by 7/64 of a cycle. Rotations, root/waist motion
and independent segment elasticity all blend. Both sources keep the same native
cadence, and the existing analog walk blend, reversal, braking and phase-matched
restart continue to apply. The pure source tracks remain available for retarget
verification; a local native reference clip supplies the other half at runtime.
The review calls this option **D · Jak hybrid** and labels the source overlay
accurately when viewing the mixed run or native idle.

Checks cover eight idle cases / 3,360 controller frames, including the native A
baseline, walk/run stops, tap/flip/double landings and ledge get-up. Steady rendered
A/D idle joint positions match within floating-point precision; pose rotations
differ by less than 6e-8 radians. Idle handoff joint steps remain below 0.00056 m.
The 1,360-frame locomotion regression verifies exact A/D movement and turn parity,
463 matching cadence frames, continuous strides through nine low-speed reversal
frames, and the actual halfway blend. Matching stride phases halves the aggregate
leg-angle mismatch compared with opposite phases. Start/stop head steps stay
below 0.030 m.

The existing 6,620-frame polish regression passes: twelve paired A/D skull peaks
remain within 0.0151 m, landing handoffs have no measurable head discontinuity,
and stationary/moving climb recovery remains smooth. Pure source retargeting
passes across 1,026 frames; planted soles stay at least 0.006 m above the floor.
The jump/skate gesture and 1,344-frame campaign/park skating parity pass, alongside
native idle/charge recovery, runtime routing and strict review types.

Browser review covers A/D front idle comparison, the hybrid stride during a
reversal, walk/run stops and the complete flip landing into idle. Full rendering
was checked at normal 720p and native resolution. No console warnings or errors;
original 720p/2× settings restored and D left in live play. Evidence is external
in `d-hybrid-locomotion/` beside the source bank. Jump physics, source jump/ledge
motion, A/B/C and level data are unchanged. This remains a local comparison.

Production build and release-size check pass (803,511,584 bytes); local review
entry and source assets remain excluded. Approximately 15 minutes from prompt
to validated playable (05:59–06:14 UTC), followed by local commit and handoff.
No integration or publication.

## D — upright precision jumps, 4 November 2026 NZDT

The roll is now selected at takeoff only when the player has both running
momentum (above 45% of native run speed) and committed movement input (above
45%). Vertical jumps, analog walking hops, short nudges and releases after
braking use the upright Jak jump. The choice remains fixed through the first
flight; air steering cannot start a roll halfway through it. Running jumps in
forward, sideways and diagonal directions retain the roll. The optional flip
checkbox still disables it entirely. Landing selection follows the captured
choice, so upright hops do not play a roll landing.

The upright first-jump root gathers and releases smoothly around the apex to
retain the previous visible head-height calibration. It does not change the
physical arc or scale the skeleton; source limb motion and segment elasticity
remain intact. An upright-to-double-jump transition uses a 0.10-second moving
blend and slightly shallower gather; an interrupted roll retains 0.14 seconds.
This preserves the immediate second-jump lift after the pose change. Watch
motion adds Precision jump, and the checkbox is labeled Running jump flip in D.

Validation: eleven launch cases over 4,840 real-controller frames, with exact
physics parity between roll enabled/disabled. The 0.45 m nudge, 1.23 m precision
hop and 2.46 m walking hop remain upright; running/strafe/diagonal jumps roll.
Late steering does not change the decision. All 3,600 double-jump physical
samples also exactly match the prior validated implementation. The weakest
three-frame head lift is 0.500 m; interrupted-rotation steps remain below
0.550 radians. The existing 6,620-frame height/recovery regression passes with
all twelve A/D head peaks within 0.023 m. Idle/landing recovery (3,360 frames),
pure-source retargeting, jump/skate gestures, 1,344-frame skating parity, runtime
routing, strict review types, build and release-size check pass (803,512,107 bytes).

Browser review confirms vertical and precision hops use `player.jump` while
running jumps use `player.jak-flip`, at normal 720p and native resolution. No
console warnings/errors; original 720p/2× settings restored and D left in live
play. Evidence is external in `d-precision-jumps/` beside the source bank.
Approximately 15 minutes prompt-to-validated playable (21:34–21:49 NZDT), followed
by local commit/handoff. No integration or publication; A/B/C and level data
are unchanged.

## D — rubbery roll, double jump and recovery, 4 November 2026 NZDT

The roll and second jump now use shared, editable `jak-flip` and
`jak-double-jump` elasticity profiles. Finite compression, extension and recoil
beats multiply the original segment lengths rather than replacing them. Torso,
upper arms, forearms, thighs and shins deform independently, with the existing
volume compensation; the whole rider and skeleton are never scaled. The source
double jump already stretches the torso, so the extra accent is stronger in the
limbs. Uninterrupted rolls now compress the shins to about 0.82 and extend them
to 1.15, compared with the previous almost rigid 0.97–1.00.

A critically damped pose spring carries joint momentum through D's airborne
motion and landing recovery. The body follows quickly while distal segments
trail slightly. Roll entry and fall blends are 0.10 seconds; an interrupted roll
has a 0.18-second moving transition into double jump. Limb stretch blends over
0.06 seconds independently of that rotation, keeping the second impulse visible.
Upright double transitions retain 0.10 seconds. The upright first-jump root
gather has a small presentation adjustment to retain A's visible head reach.
The spring also smooths a sharp internal splice in the source landing, then
fades out over the final 30% to hand off exactly to the existing run/idle phase.
Skating, ledges and steady locomotion retain their existing presentation owners.

The new six-case regression records 1,440 real-controller/rendered-pose frames
and compares every physical sample with the pre-change baseline: all match
exactly. The worst measured roll joint step fell from 62.1 to 27.4 degrees per
frame; the short landing's 83.6-degree step fell to 30.0. The interrupted roll
keeps rotating on the first double-jump frame rather than freezing. All segment
values remain finite and the whole-rider scale remains one.

The 3,600-frame double-jump regression passes, with at least 0.420 m of rendered
head rise in the first three boost frames. The 6,620-frame height/recovery
regression keeps all twelve A/D head peaks within 0.050 m and the final landing
handoffs have no measurable head discontinuity. Precision hops (4,840 frames),
native idle/recovery (3,360 frames), pure-source retargeting (1,026 samples),
jump/skate gesture, D skating parity, animation runtime, shared elasticity,
strict review types, production build and release-size check pass. Production
output is 803,514,472 bytes; the local review and extracted assets stay excluded.
No full-suite run.

Full-render browser review covers the running roll/double jump, upright boost
and running rebound in side/front/oblique views, at normal 720p and native
resolution. Console warnings/errors are empty. Original 720p/2× settings were
restored, with D in live play and real-time speed. Evidence is external in
`d-rubber-motion/` beside the source bank. Approximately 28 minutes from prompt
to validated playable (22:38–23:06 NZDT), followed by local commit/handoff.
The user allowed slight D tuning changes, but the animation changes needed no
physics retune. A/B/C, precision-hop selection, skating and level data remain
unchanged. Local comparison only; no integration or publication.

## D — live UI tuning and complete somersaults, 5 November 2026 NZDT

D now opts into presentation only. Normal jump min/max velocity, charge time,
rise/fall gravity, double-jump velocity/window/toggle/horizontal retention and
movement all use the existing live TUNER path. Its former calibrated height and
constant-gravity profile has been removed. The earlier skull-height compensation
is bypassed, and the calibration solver has been retired: physical movement now
matches A rather than altering the arc to compensate for different poses. C
retains its separate experiment. Jump/skate input and board physics are unchanged.

The source wheel-flip finishes about 23 degrees short of upright and expects
its ground recovery to finish the rotation. D now completes that final turn
in the airborne clip. Its presentation clock fits the UI-tuned rise/fall arc,
leaving a brief open-pose settle before falling/landing. An early double jump
applies the native impulse immediately while the hips continue the committed
forward somersault; a quaternion blend cannot reverse the unfinished turn.
Vertical/precision hops remain upright, including extremely short tuned arcs
with less than 0.30 seconds available for the full roll.

First- and second-jump descent timing now opens the legs before contact under
native asymmetric gravity. The moving source's bent trailing leg fades out at
the end instead of staying tucked. The shared roll stretch pulse has a slightly
longer crest to retain its rubbery extension during the shorter animation.
Independent segment deformation, source articulation, native idle, hybrid run,
ledge contacts and finite landing handoffs remain intact. Watch motion adds a
Roll complete pause point; the playtest labels D as following live UI tuning.

Validation: a new twelve-scenario, 7,200-frame A/D regression compares all
physical samples exactly, including altered rise/fall gravity, low/high launch
strength, early double jumps, disabled/expired double windows, horizontal
retention, and tuning edits during flight. Every started test roll completes
forward (at least 358.4 degrees measured with elastic lag) and opens before
landing. Short arcs/vertical jumps do not roll. The 1,440-frame rubber regression
passes with maximum motion steps below 31.1 degrees and roll shin lengths around
0.82–1.18. Existing direct-retarget, double-jump, precision, landing/climb,
skating, C-physics, runtime and strict review-type checks pass. The landing test
now checks exact physical peak/airtime parity instead of calibrated skull peaks.
Build and release-size check pass (803,516,367 bytes); no full-suite run.

In the actual browser, changing `jumpVelocity` from 14 to 18 moved D's paused
full-jump apex from 2.849 m to 4.757 m; A also measured 4.757 m at 18. The original
14 setting was restored. The completed roll was inspected in full rendering at
normal 720p and native resolution, still airborne with straightening legs; the
double-jump continuation was also reviewed. No console warnings/errors. Normal
720p/2× rendering and real-time live play were restored, with D selected. Evidence
is external in `d-ui-tuning-roll/` beside the source bank. Approximately 28 minutes
prompt-to-validated playable (00:18–00:46 NZDT), followed by local commit/handoff.
Source assets remain outside Git/production. No integration or publication.
