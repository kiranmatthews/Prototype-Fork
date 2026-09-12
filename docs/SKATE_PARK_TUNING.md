# Skate-park tuning: preserve the park model

The broad platform-motor change in `db1a374` is rolled back. Park skating again uses its established player-relative turn rates, braking, surface projection, slope gravity, ballistic ollies, vert pop, wall tracking and landing behavior. The chase-camera implementation is restored exactly to the pre-tuning version; ordinary airs follow the rider again, and vert retains its original swing.

Only the park motor's speed/acceleration targets and no-input rollout change. Compared with `3d78c24`, `player.ts` differs only by its tuning-helper import and this small motor block. Platforming code and values remain unchanged.

**M → TUNER** has two compact park sections, with nine absolute controls:

| Control | Default |
| --- | --- |
| Cruise speed | 12 m/s |
| Charged speed | 23 m/s |
| Cruise pickup acceleration | 10 m/s² |
| Charged acceleration | 9 m/s² |
| Camera height | 5.1 m |
| Camera distance | 5.05 m |
| Camera tilt | 25.35° |
| Camera FOV | 49° |
| Speed FOV | +6° |

The four drive defaults match the platforming targets. They do not replace the park motor or change its control response. A direction requests cruise pickup; holding X requests charged acceleration. Releasing both movement and X removes motor drive. On flat/gentle ground the existing platform rollout friction then brings the board to a stop, where it remains mounted. Transitions retain the park's gravity and drag, avoiding the rejected change's new wall friction and pumping rules. Holding a direction or X starts rolling again.

Camera settings affect the flat/ordinary-air shot and fade out through steep transitions. The full six-degree speed push uses the actual park cruise/charge endpoints. There are no park ollie, gravity, friction, steering-curve or air-follow sliders. The original 0.2-second park ollie charge, 8.89–10.9728 m/s pop and symmetric 34.29 m/s² ordinary-air gravity remain. Defaults describe factory values; existing deliberate edits to retained controls still load through the normal tuner save flow. Removed park keys are ignored in saved tuning and filtered from replay state.

Scope follows `level.skatepark`, so future skate-only freecam levels receive the same profile. The ordinary platforming chase toggle does not opt into it.

Focused validation covers nine controls and slider steps, drive targets/rates, the platform no-input decay curve, a mounted stop and restart, original park turn/brake response, the restored ballistic ollie, platforming isolation and retired-key filtering. Camera checks cover 163 protected steep/vert samples and four actual perimeter return routes. Build and lite/full browser review check the integrated result; no full suite is run for this correction.
