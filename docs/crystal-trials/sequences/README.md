# Linked skating sequence evidence

These results concern the skating revision, not the superseded platforming collection.

- `01-native.json`–`25-native.json`: all 25 input-only routes pass, with the exact source-data SHA-256 recorded in each report. The player stays on the board, collects the final crystal and reaches the unlocked exit without deaths. Movement tuning remains unchanged; soft and hard resets retain and clear crystals respectively.
- The runs contain 3–5 linked sections and 4–13 recorded skill events, taking 18.1–47.5 seconds including their exits. Median speeds range from 22.9 to 24.6 m/s. These are successful automated controller routes, not estimates of a first-time player's completion time.
- `recovery/2.json`: an ordinary miss lands on the flat floor; braking, carving and the return bank reach the start while skating.
- `recovery/3.json`: a deliberate missed rail dies in its marked pit, respawns at the checkpoint, then completes the sequence and verifies a fresh reset.

`course/native.json` records one uninterrupted 53,218-step run through all 25 challenges and every gap between them, with zero deaths and no teleports after its initial reset. The locked exit, final unlocked exit, and crystal resets pass. Level validation, build and release-size checks pass. The local production phone audit transfers 36,489,355 bytes (36.5 MB), including all 75 rejected attempts and the original grid; its picker transfers 26,537 bytes before Play. Touch movement, pause, retry and both screen orientations pass. All 25 native-resolution approach and final-goal fixtures have been manually reviewed; `full/visual-review.json` records their scope and limitations. The full-render controller route through 5 passes. The remaining browser route reports and public deployment evidence are added when complete. The collection uses the production Player and Level without position, velocity or reward mutations during successful routes. Pre-run failure fixtures and staged visual poses are explicitly separate.


The phone controller suite uses the regular 844 × 390 touch viewport. Runs 1–14 use render scale 1; later headless runs use scale 0.5 during the controller route to reduce software rendering cost, with scale 1 restored for each approach screenshot. This changes only the test renderer resolution, not the shipped app, source geometry, physics or input cadence. The separate full-render fixtures use native 1280 × 720 output.
