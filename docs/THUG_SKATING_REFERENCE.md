# Jungle Cup skating reference audit — September 8, 2026

This audit records the reference actually read for the correction after the first Jungle Cup overhaul was rejected in playtesting. Source inspection establishes the behavior to reproduce; it does not establish that this prototype feels identical to THPS. No external game implementation or comments were imported into this repository.

## Sources read

- THUG core physics, pinned at [`d8eb714`](https://github.com/thug1src/thug/blob/d8eb7147663d28c5cff3249a6df7d98e692741cb/Code/Sk/Components/SkaterCorePhysicsComponent.cpp): ground integration, `new_normal`, `maybe_straight_up`, `maybe_break_vert`, `do_in_air`, `handle_air_rotation`, and `do_jump`.
- THUG camera, same revision: [`SkaterCameraComponent.cpp`](https://github.com/thug1src/thug/blob/d8eb7147663d28c5cff3249a6df7d98e692741cb/Code/Gel/Components/SkaterCameraComponent.cpp), especially the target-frame construction and vert/landing interpolation.
- Original script parameters added in [`98b4e249`](https://github.com/SwagSoftware/kisak-thug/blob/98b4e24921446ccd4b157453e25697f9574f0053/Scripts/game/skater/physics.q): gravity, stat ranges, jump charge, wall feelers, air rotation, and medium camera.
- Claude's upstream implementation history: [`c1470ad`](https://github.com/kiranmatthews/Game-prototype/commit/c1470adbb52cd6a34a4900b7a3ebb2b6ccb28e15), [`d6cdb53`](https://github.com/kiranmatthews/Game-prototype/commit/d6cdb53d3a6c12fb0abb20dfe702b242c1f979a3), [`a11cb71`](https://github.com/kiranmatthews/Game-prototype/commit/a11cb71167da6635d4f23b661bee736dba9137ee), and [`0665d60`](https://github.com/kiranmatthews/Game-prototype/commit/0665d601578e7ef0257e3d3311107784a4182e1e). Both commit descriptions and relevant implementation diffs were inspected. No standalone audit document was found in the checked-out history; the linked Claude sessions were not accessed.

OpenEmu's THPS2 demo and keyboard settings were inspected: S is Cross, X is Triangle, Z is Circle, A is Square, and arrows are the D-pad. Automated key presses did not produce a dependable controlled skating run. The emulator was left paused. Do not describe that as a completed gameplay comparison.

## What the old implementation got wrong

The previous flat-heading projection changed an angled approach as the ramp steepened. At a vertical wall the projected uphill direction became degenerate. Later code repaired the missing climb by manufacturing vertical launch speed. Combined with automatic lip pop, steepness-dependent pumping and an early launch threshold, this made the resulting height unrelated to a readable approach and release.

Claude's earlier curved-wall implementation followed the coping, but `0665d60` subsequently removed position tracking under a ballistic interpretation. THUG combines ballistic vertical motion with horizontal wall tracking. These are compatible, and neither requires a continuous shove toward the bowl centre.

The first fork overhaul also flattened the rider at apex and swung a yaw-only camera toward the return heading. THUG holds a wall-aligned rider frame during vert, targets a downward camera direction, and uses the wall normal as camera up. World-up under that view makes the skater and scene appear inverted.

## Numerical calibration

The reference uses inches for physics distances. Conversion is 0.0254 metres per inch. These are the middle, stat-5 values where the scripts provide stat ranges. Camera behind/above values are feet.

| Quantity | Reference value | Prototype SI value |
| --- | ---: | ---: |
| Ground gravity magnitude | 1000 in/s² | 25.4 m/s² |
| Ordinary air gravity | 1350 in/s² | 34.29 m/s² |
| Vert gravity | air / 1.1 | 31.172727 m/s² |
| Standing kick target | 445 in/s | 11.303 m/s |
| Crouched kick target | 603.5 in/s | 15.3289 m/s |
| Standing acceleration | 664.5 in/s² | 16.8783 m/s² |
| Crouched acceleration | 1128.5 in/s² | 28.6639 m/s² |
| Soft/hard speed limits | 828.5 / 1028.5 in/s | 21.0439 / 26.1239 m/s |
| Brake | 900 in/s² | 22.86 m/s² |
| Ordinary jump impulse | 350–432 in/s | 8.89–10.9728 m/s |
| Vert jump impulse | 100–275 in/s | 2.54–6.985 m/s |
| Full jump charge | 200 ms | 0.2 s |
| Vert clearance | 3 in | 0.0762 m |
| Tracking feeler reach each way | 30 in | 0.762 m |
| Initial upward tracking probe | 6 in | 0.1524 m |
| Downward recovery increment | 3 in | 0.0762 m |
| Ground / sharp turn | 1.8 / 3.6 rad/s | unchanged |
| Air rotation | 7.3 rad/s | unchanged |
| Automatic angled-vert turn | 3 rad/s | unchanged |

## Implementation rules

Ground velocity is a full surface tangent. On a new ground plane it redirects while preserving magnitude. Gravity is projected onto that plane. Normalized XZ direction is only a control-frame representation; it is never mistaken for the complete velocity. Slow steep riding turns toward the downhill direction so the board can recover instead of welding to the wall.

Neutral input keeps kicking toward the standing target; holding Jump crouches and increases the target. Down brakes; left/right steer in the rider's frame. Up can break vert during the short launch window only after a foot-normal feeler clears the wall. The park's additional Grab brake is a compatibility control. Ordinary course controls and tuning remain separate.

A natural vert air begins when support actually ends. It carries the current velocity and receives no free jump impulse. Releasing a charged jump adds the appropriate impulse. Once airborne, vertical position uses `y += vy * dt - gravity * dt² / 2` and velocity uses `vy -= gravity * dt`. There is no apex float. Curved coping tracking follows the actual mesh with source-sized feelers and a small clearance; losing the feeler does not abruptly change the active air's gravity.

Head-on vert does not automatically turn the board. Angled vert turns within the wall plane toward its descent direction. Held manual rotation can cancel this assistance. Directional rotation has a short input delay, and release does not silently finish a half-turn. Landing alignment compares the board with the incoming tangent on the real landing surface.

The camera uses a full orientation frame and quaternion interpolation. Vert targets down with the wall normal as screen-up; touchdown briefly accelerates orientation recovery. The medium reference uses 72° horizontal FOV, 12 ft behind, 4.3 ft above, 0.18 rad tilt, orientation interpolation 0.04 per 60 Hz frame, landing 0.375, position XZ 0.25/Y 0.75, and immediate position follow in vert. Here distance/height are multiplied by 1.25 for the larger character, and the reference 4:3 vertical framing is retained on wide screens. Those art/framing adaptations are explicit, not claimed source parity. Trick-specific zoom and the original animation library are not reproduced.

## Verification boundaries

The regression suite checks the measured gravity/impulse ranges, actual lip exit, ballistic height over time, approach-angle preservation, curved contact, rider-relative controls, no automatic spin completion, complete rider framing, camera frame-rate equivalence, floor/containment safety, and the supplied replay. These checks reject the previous implementation; they do not substitute for evaluating live motion. Browser review must cover the climb, apex, descent, angled landing, street traversal, bail recovery and final-combo overtime in both lite and full rendering.
