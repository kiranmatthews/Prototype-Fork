# Carlisle launch jump — observation and adaptation

## Evidence recorded before implementation

Primary: [Kouteshi, final boss](https://www.youtube.com/watch?v=0uwxoIOpFcg&t=327s), inspected at normal speed, quarter speed and individual 60 fps steps. Repetitions at 327, 375 and 422 seconds. Times below are approximate video times, not extracted animation key times.

| Beat | Second launch | Pose and camera evidence | Roo adaptation |
| --- | --- | --- | --- |
| Load | 378.5–378.8 | Brief crouch on the pad; pelvis lowers, knees fold, torso inclines. | Short compression at the existing contact impulse; no delayed physics. |
| Extension | 379.0–379.3 | Long upright silhouette, feet trail together; camera climbs very rapidly. | Straightening legs, extended torso, arms trailing with wrists delayed. |
| Opening | 379.5–380.3 | Face opens upward, arms spread and bend unevenly, one reaches higher. Camera elevation changes substantially. | A bounded backward arch followed by forward pitch; do not invent a repeated somersault from the changing viewpoint. |
| Float / apex | 380.7–381.3 | Broad bent arms, loose hands, uneven knee bends; head/chest lead the small corrections. Similar silhouette at 425.5–426.5 in the third jump. | Asymmetric airborne loop, alternating shoulder/elbow/hand arcs and staggered knees. Slow torso and head counter-motion. |
| Descent | 381.5 onward; 427 onward | Character rapidly shrinks while arena framing changes less. Belly-down silhouette continues; this is largely camera lag, not a body scale change. | Retain the loop through actual descent, then bring feet underneath before supported contact. Camera lingers above the apex with a bounded separation. |
| Contact | End of flight | Source returns to the ordinary landing path; impact effects can obscure precise foot timing in the boss footage. | Existing ground contact owns timing; a finite compression/rebound returns to locomotion. |

The first clear frontal view near 332 seconds is particularly useful for the arm spread and head attitude. The overhead views do not justify copying screen-space rotation into root yaw. These are reconstructed poses, not original animation curves or motion capture.

## Source confirmation

Pinned OpenGOAL revision: `94684e32f60008d3d9617621e7c3a478c9e2af56`.

- [generic-obs.gc](https://github.com/open-goal/jak-project/blob/94684e32f60008d3d9617621e7c3a478c9e2af56/goal_src/jak1/engine/common-obs/generic-obs.gc): `launcher-active` passes height, camera, destination and seek time. Entity mode low byte 1 selects longfall, 2 omits the dedicated camera, default selects shortfall. Default height is 40 m, **not established as the boss pad height**. GOAL uses 4096 distance units/m, 65536 angle units/revolution and 300 internal time ticks/s. Entity `alt-vector.xyz` supplies destination and `.w` seek seconds.
- `cam-launcher-longfall` starts about 7 m above and 1 m horizontally from the target, rises promptly, damps descent velocity by .975 per frame and has a 5 m vertical deadband. Horizontal stick rotates its horizontal viewing vector. It retains FOV and returns to the base mode over .5 s after supported contact and a minimum one-second state duration. Shortfall instead follows height directly.
- [robotboss.gc](https://github.com/open-goal/jak-project/blob/94684e32f60008d3d9617621e7c3a478c9e2af56/goal_src/jak1/levels/finalboss/robotboss.gc): boss handling explicitly recognizes `cam-launcher-longfall`. The exact boss launcher height/destination/seek values reside in entity data not established by these source files. Do not claim the generic defaults are those values.
- [target2.gc](https://github.com/open-goal/jak-project/blob/94684e32f60008d3d9617621e7c3a478c9e2af56/goal_src/jak1/engine/target/target2.gc): `target-launch` prepares duck stance, blends the camera over .6 s, then enters the high jump. Destination guidance is conditional on a nonzero seek time. Carlisle keeps its authored air steering and ballistic launch.
- [target.gc](https://github.com/open-goal/jak-project/blob/94684e32f60008d3d9617621e7c3a478c9e2af56/goal_src/jak1/engine/target/target.gc): selects `eichar-launch-jump-ja`, starts at frame 16, advances toward frame 110 in relation to vertical velocity/time to apex, then plays `eichar-launch-jump-loop-ja`. The landing path recognizes these launch clips. The referenced asset curves are separate from the code.
- [cam-master.gc](https://github.com/open-goal/jak-project/blob/94684e32f60008d3d9617621e7c3a478c9e2af56/goal_src/jak1/engine/camera/cam-master.gc): ordinary jump tracking excludes `launch-jump`; a dedicated presentation owner avoids competing vertical tracking.

## Existing rig and implementation plan

Roo uses a Bone/transform hierarchy with stable semantic bindings: outer gameplay body → animation `root` → `hips` → legs and torsoRoot/spine/chest/neck/head; clavicles, shoulders, elbows, wrists and finger chains; separate simulated tail and secondary ears/hair. Local +X is left, +Z is forward, Y is up. Limbs descend local Y in the bind stance. Positive knee X folds the feet back; negative elbow X folds the forearm forward; opposite shoulder Z signs spread the arms. The stylized broad head, long shoes and short legs require smaller torso rotations than Jak. Static character proportions remain unchanged.

The authored clip runtime samples editable quaternion/position/scalar tracks over the procedural pose, crossfades state changes and applies independent segment deformation controls. Physics owns world translation once; pose root offsets are small waist-pivot offsets only. Board contact and tricks must retain foot/deck ownership. Tail simulation supplies secondary lag. New segment elasticity uses the shared profiles, with no whole-skeleton scaling.

Plan: trajectory-driven launch one-shot into a real-time asymmetric air loop, late-descent gathering and contact recovery; distinct upper-body-only board variants. A dedicated camera overlay follows the actual launch, lingers vertically through descent, allows horizontal stick orbit and releases smoothly. A local review trigger will replay authored pads without changing production level data.

## Supplemental footage

- [Sentinel Beach, 35 s](https://www.youtube.com/watch?v=U56bHFV7jpg&t=35s): launch around 36 s, backward opening around 37.2 s, pronounced reduction in screen size on descent around 38.5 s, then another pad around 39.7 s. This corroborates the open pose and vertical lag, but its camera framing is not substituted for the boss shot.
- [Spider Cave, 65 s](https://www.youtube.com/watch?v=VTgS0epJmZA&t=65s): approach at 66–69 s, launch at 70–71 s, elevated view toward the poles around 72 s. The shorter route has less of the boss arena's extended high view.
- [Original clip](https://www.youtube.com/watch?v=03pQ4QwDb5M): launch around 7.6 s and overhead open pose around 10.1 s agree with the primary silhouette. The final boss remains the main timing and camera reference.

## Implemented adaptation

Six editable catalog clips cover load/extension/opening, sustained float and landing gather, with separate board variants. The first .19 s contains a brief load and extension; the remaining rise progress follows the measured vertical speed relative to launch speed. The float begins shortly before the actual apex and continues into descent. Its 1.36 s loop staggers shoulders, elbows, wrists and fingers; head and chest counter the torso. The on-foot legs bicycle half a cycle apart, with delayed knee, ankle and toe motion making each shoe sweep an oval. The loop is seamless. Independent shared torso and limb elasticity supplies compression, stretch and rebound. Physics still applies the native launch impulse, gravity and steering once.

The requested follow-up adds one slow somersault to fast directional trampoline launches, on foot or board. Actual planar travel must reach .8 times walking speed (currently 7.2 m/s) before rise progress .55. The turn starts no earlier than .22, follows the remaining measured rising arc with smooth acceleration/deceleration, and ends upright before the apex. The mounted rider and board rotate together around the posed hips after deck contact solving. Neutral vertical bounces, ordinary running jumps and ollies do not acquire this turn. This is a user-directed addition, not a claim about the reference footage.

Ground distance and downward velocity drive the last .38 s of preparation. Actual supported contact starts the existing finite `player.land` recovery; a second spring restarts the launch instead. Board variants animate the torso, head and arms while the existing deck/contact solve keeps both feet attached. The ordinary run/charge root offset and forward-roll presentation yield to the on-foot launch keys. Death, slam, a double jump and other higher-priority controller states can interrupt the move. New starters omit unavailable optional joints on simpler rigs and preserve aliases; saved edited clips retain their established migration protections.

Abandon Ship / Emergency Eject explicitly ends the spring presentation, so its existing airborne flip and supported roll landing retain ownership. The native momentum carry, return to run/idle and genuine excessive-drop behavior are unchanged. Catalog revision 36 updates only the saved float's leg rotation channels and retains the exact previous clip under `player.launch-float.pre-bicycle`; other authored channels and playback speed remain intact.

The camera is a reversible overlay in the existing camera stack, for both players, with Carlisle scenery collision applied afterward. It inherits the current viewing direction, enters over approximately .6 s, follows the rise immediately, lingers above the falling character, and releases over approximately .5 s. Horizontal right-stick input orbits the shot. A 9 m maximum separation and reduced lag near supported landing keep the receiving platform legible. The overlay does not change FOV: the old launch-specific 72° zoom is removed. Ordinary speed-dependent lens behavior remains part of the base camera.

The source confirms the boss's **longfall mode**, launch-to-loop sequencing, trajectory-dependent animation advance, joystick orbit and camera handoff. Its generic 7 m/1 m framing and 5 m deadband are reference values, not an exact fit for this rig and course. Exact boss entity height/seek parameters and original animation curves were not established. The pose curves, joint amplitudes and modified camera distances here are authored reconstructions from the footage. No original game animation assets were copied.

## Main tuning points

| File | Controls |
| --- | --- |
| `src/animation/launchJump.ts` | `LAUNCH_JUMP`: .19 s push, .88 rise-to-loop threshold, 1.36 s float cycle, .38 s gather, .78 m visual waist pivot. Bicycle hip/knee swings .48/.62 radians, knee delay .13 cycles. Somersault speed ratio .8, earliest/latest start .22/.55 rise progress. `PHASE` and per-joint `beat` curves control pose angles and overlap. |
| `src/animation/elasticity.ts` | Six `launch-*` shared profiles: torso, upper/lower arms, upper/lower legs; board leg amplitudes stay zero. One-shot beat keys set compression/extension/rebound. |
| `src/launchCamera.ts` | `LAUNCH_CAMERA`: .6/.5 s entry/exit, 10.5 m elevation, 4.6 m distance, 1.25 m aim height, 1.4 m look-ahead, 3.2 m descent deadband, 2.4/s catch rate, 9 m maximum extra height, 1.05 rad/s orbit, .16 stick deadzone. |
| `src/player.ts` | `launchPresentation` derives trajectory/contact progress and preserves the existing 12–55 m launch-strength ramp. No tuning or movement constants changed. |
| `src/characterAnimationRuntime.ts` | Launch entry .045 s, float/gather .14 s, interruption .12 s, existing contact crossfade .06 s. All six clips are available through the normal animation catalog. |

## Local review and validation

Start the usual Vite server, then open `/launch-review.html?playtest&level=carlisle-coast&launchReview`. Add `&lite` for a quick check. This development-only entry is excluded from production HTML entries. The panel provides all 55 native pad setups, foot/board selection, replay, pause, individual 1/60 s steps, quarter/tenth speed, apex pause, gameplay/front/side/three-quarter views and 720p/MAX rendering. Abandon Ship sends the native airborne jump press/release; the diagnostic line reports somersault progress. Its optional input pilot steers one transfer toward the authored landing; it ends on contact or a chained launch. Gameplay itself has no added destination guidance.

Focused validation:

- `node tools/test-launch-jump.mjs`: finite poses, independent deformation bounds, seamless moving air loops, board foot ownership, monotonic trajectory progress, four actual transfers (Foam steps 1 foot/board, Beacon chimney 1, Scissor approach springs 3), unchanged physics during pose application, gather, supported `land` recovery and finite return to idle, death interruption and respawn. Camera checks cover reversible composition, unchanged FOV, bounded lag, orbit/deadzone and equivalent 30/60/120 Hz arcs.
- Follow-up launch checks: opposed leg cycles and nonzero oval shoe paths; exact saved-pose backup and idempotent migration; sustained slow turns on all four transfers; neutral vertical exclusion; native Abandon Ship input releases the spring pose and restores the visual flip.
- `node tools/test-board-roll-landing.mjs`: 14 native dismount cases covering momentum carry, supported roll clearance, stop/idle, run speed, screen-direction stability, jump/reset and genuine excessive drops.
- `node tools/test-animation-suite.mjs`: catalog validation, alias/missing-joint compatibility, schema round trips, authored editing and saved-suite migration.
- `node tools/test-character-animation-runtime.mjs` and `node tools/test-character-elasticity.mjs`: gameplay routing/crossfades, all 39 starter clips, independent segment behavior, finite settles and migration preservation.
- `npm run build`: type-check, bundle and release asset preparation. No level data or `src/tuning.ts` changed; no unrelated full-suite run.

Browser review uses the real Carlisle level and existing character skin, with normal and slow playback, multiple rig angles, lite, full 720p and MAX/native rendering. The long on-foot launch reaches its receiving deck with zero deaths and returns to the normal camera. The launch camera and floating pose are reviewed at native resolution; board feet retain their deck placement. All complete authored scenery geometry and reflections remain in use.

Native review captures: [gameplay camera](carlisle-launch-review/gameplay-native.jpg) and [side silhouette](carlisle-launch-review/float-side-native.jpg). Final browser errors and warnings were empty.

Follow-up native captures: [bicycle float](carlisle-launch-review/bicycle-native.jpg), [mounted somersault](carlisle-launch-review/board-somersault-native.jpg), and [restored Abandon Ship flip](carlisle-launch-review/abandon-ship-flip-native.jpg). Reviewed on foot and board, in slow motion and individual steps, at lite/720p and full MAX/native. The normal-speed full-render flight finished with `launch-gather → land → idle`, zero deaths and no console errors or warnings. The follow-up launch, catalog and board-roll suites plus the production build pass.

This work is an isolated local checkpoint based on `a9e3d4e`; it does not incorporate another chat's later uncommitted Carlisle artwork. Nothing is integrated, pushed or published.
