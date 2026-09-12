# Skate-park movement and camera tuning

Jungle Cup already uses separate movement rules, selected by `level.skatepark`. This flag also applies the same controls to future skate-only freecam levels; competition state and the current level ID do not select the profile. Enabling the optional chase camera on an ordinary platforming level does not opt into park physics or park framing.

Comparison at factory settings (world units ≈ metres):

| Setting | Platform-level skating | Skate park |
| --- | --- | --- |
| Cruise target | 12 m/s | 11.303 m/s |
| Charged target | 23 m/s | 15.3289 m/s |
| Tap / charged ollie launch | 6.5 / 11 m/s | 8.89 / 10.9728 m/s |
| Full charge duration | 0.4 s | 0.2 s |
| Flat board gravity | 33 rise / 70 fall, with apex float | Symmetric 34.29 |
| Full flat ollie, measured at 60 Hz | ~1.78 m, ~0.60 s | ~1.76 m, ~0.65 s |
| Ordinary jump camera follow | Ground anchored (0) | Follows the rider (1) |

The charged park speed was genuinely lower, while full ollie height was nearly identical. A camera following all the rider's vertical rise makes an otherwise similar jump read smaller. The park's six-degree speed zoom also used the platform's 12–23 m/s range, giving only about 1.32 degrees at park charged speed. It now uses the effective park cruise/charged targets and reaches all six degrees.

Open **M → TUNER**. The two **SKATE PARK** sections are at the top. Controls use the existing live number fields, sliders, save/reset and replay recording paths.

| Control | Default | What changes |
| --- | --- | --- |
| Cruise Speed × | 1 | Standing speed target |
| Charged Speed × | 1 | Crouched target; never below cruise |
| Acceleration × | 1 | Standing/crouched push acceleration |
| Ollie Height × | 1 | Height of non-vert board ollies, retaining airtime |
| Ollie Hangtime × | 1 | Airtime of those ollies, retaining height |
| Ollie Charge (s) | 0.2 | Hold duration for a full ordinary ollie |
| Camera Height (m) | 5.1 | Height of the flat follow shot |
| Camera Distance (m) | 5.05 | Flat trailing distance |
| Camera Tilt (°) | 25.35 | Flat angle below the horizon |
| Camera FOV (°) | 49 | Flat base vertical lens angle |
| Speed FOV (+°) | 6 | Extra lens angle from cruise to charged speed |
| Ollie Camera Follow | 1 | 1 follows vertical rise; 0 holds takeoff height |

A starting experiment: **Cruise 1.1×, Charged 1.5×, Height 1.3×, Hangtime 1.15×, Camera Follow 0.4**. That gives targets of ~12.43 and ~22.99 m/s. These are suggestions, not new defaults. Existing platforming tuning is unchanged.

Speed ceilings scale up with raised targets so the old reference cap cannot silently defeat the slider, retaining space for downhill momentum. Speed edits naturally affect the momentum brought into a ramp. The vert integrator, pop, gravity, wall tracking and camera swing are unchanged. Flat framing fades out completely on steep transitions. The ordinary-ollie multipliers do not affect vert launches, passive ramp exits, rail pops or wall kicks.

Ollie height H and duration T scale the vertical launch by H/T and gravity by H/T². Both are captured at takeoff: editing a slider while airborne cannot kink the current arc. The longer charge slider also extends the ground/coyote charging capacity beyond the old platforming timer. Older replays which lack park keys start from the reference park defaults instead of inheriting live park tweaks; replay end restores the prior tuning.

Validation: `npm run check:park-tuning` covers the live motor and airborne trajectories on a new non-competition skatepark, platforming isolation, charge durations above 0.4 s, replay restoration, exact slider steps, full speed zoom, unchanged steep/vert framing, four real Jungle Cup vert approaches and frame-rate camera parity. Factory defaults and the existing camera-speed check also pass, plus a production build and lite/full browser review. The camera-speed test's lighting fixture now supplies the competition state introduced by the earlier heat-lighting change. No full suite was run.
