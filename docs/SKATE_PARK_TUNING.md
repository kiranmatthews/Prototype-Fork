# Skate-park movement and camera tuning

Skate parks now use the platforming movement code for acceleration, cruise pickup, braking, steering response, coasting/friction, overspeed decay, slope drive and ordinary board jumps. `level.skatepark` selects independent absolute tuning values and keeps the board mounted at low speed and at zero. Jungle Cup and future skate-only freecam levels use this flag; the optional chase-camera toggle on a platforming course does not select park tuning.

Open **M → TUNER**. The four **SKATE PARK** sections are at the top: Speed & Control, Friction & Slopes, Ollie & Air, and Camera. There are no reference multipliers. Their factory values and ranges come directly from the corresponding platform settings, so the two default profiles cannot silently diverge.

| Setting | Default in both profiles |
| --- | --- |
| Cruise / charged speed | 12 / 23 m/s |
| Cruise pickup / charge acceleration | 10 / 9 m/s² |
| Brake strength / ramp time | 35 m/s² / 0.4 s |
| Low / high speed steering | 360 / 60 degrees per second |
| Tap / charged ollie launch | 6.5 / 11 m/s |
| Full ordinary ollie charge | 0.4 s |
| Ordinary board rise / fall gravity | 33 / 70 m/s² |
| Ramp fall gravity | 40 m/s² |
| Apex float / speed band | 0.35 / 4.5 m/s |
| Slope gravity | 45 m/s² |
| Rolling friction / wind drag | 3.5 / 0.0015 |
| Overspeed drag / downhill limit | 0.005 / 30.5 m/s |
| Camera height / trailing distance | 5.1 / 5.05 m |
| Camera tilt / base FOV | 25.35 / 49 degrees |
| Speed FOV / ordinary jump follow | 6 degrees / 0 (ground anchored) |

Holding a direction without X picks up toward cruise; above cruise, the ordinary friction model sheds speed. Holding X accelerates toward charged speed. Releasing all input coasts to a complete stop. Circle and pull-back use the same ramp/ease-out brake behavior. In a park, slowing or stopping leaves the board under the rider; another directional push starts rolling again. Genuine bails still play and recall the board through the existing recovery.

The shared steering response resolves through the park's player-relative frame, maintaining the requested behind-the-skater controls. Platforming retains its course/camera frame. The protected vert launch, wall tracking, angled return and camera swing remain. Slope pumping now follows the platforming rules, so approach speed and available vert height reflect those settings. Ordinary park ollies use the same charged pop, downhill coupling, rise/fall gravity and apex treatment as platforming; true vert/lip release retains its calibrated 0.2 second charge and symmetric gravity.

Park movement reads a live, read-only tuning view. It never temporarily changes global platform settings; editing park sliders cannot affect another player or a platforming level. The existing save/reset/readout flow applies. Old multiplier keys are retired rather than interpreted as speeds or gravity. Older replays run under the current shared movement model and must not be used as exact recordings of the retired park motor.

Validation includes fourteen full motor traces across two headings (charge, cruise, coast, steering, Circle, pull-back, overspeed), four charge-length ollie trajectories, idle and both brakes through zero, mounted restart, profile isolation and factory metadata. Existing camera checks cover protected steep/vert framing and real perimeter routes. Coping drop-in, curved-wall/charged-vert skating checks, the production build and lite/full browser review cover the integration. No full suite was run.
