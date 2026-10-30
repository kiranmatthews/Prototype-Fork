# Skystream lower-road camera — 29 October 2026

Dropping from a cloud road onto a lower section is an intentional shortcut.
The camera used a 0.6-second ballistic forecast to decide whether to freeze,
while Skystream's gameplay allows longer falls and rescue jumps. Its vertical
anchor also stayed on the departure road, and its ordered camera-path bias
could remain more than 200 metres behind the actual landing along the route.

The camera now follows every air that Skystream's existing fall-recovery policy
still considers playable. Actual pit death holds the shot. This reuses the
fixed-step gameplay decision, with no additional collision queries. The camera
follows the descending height directly and fits the posed rider through
landing. Actual lower-road contact releases the camera's old route selection;
yaw keeps its usual easing. Supported steering also reacquires a lower lane
when the old lane is over eight metres above the contacted road. Airborne
crossings retain their continuity preference.

## Evidence

The supplied 8,168-frame replay is retained, gzip compressed, in
`tools/fixtures/skystream-drop-replay.json.gz`. The native harness runs the real
production camera functions. Chrome plays the reported departure/rescue/landing
and all four input-only shortcut flights, including 350 ms of camera settling
after contact. Full rendering uses 1600×1000 native resolution; the final view
also uses the normal 720p/CRT presentation.

| Shortcut | Old frozen air frames | Old off-screen centre frames | Old landing route error | Fixed |
| --- | ---: | ---: | ---: | --- |
| Pearl halo | 19 | 46 | 224 m | No freeze, framed, correct lower lane |
| Cloud eye | 0 | 41 | 264 m | No freeze, framed, correct lower lane |
| Seraph coil | 23 | 56 | 271 m | No freeze, framed, correct lower lane |
| Last halo | 4 | 40 | 229 m | No freeze, framed, correct lower lane |

The reported native replay window (frames 3701–3741) drops from 40 frozen frames
to zero. Each shortcut has zero off-screen centre frames and its supported
steering agrees with the lower road to within 0.000002 degrees. Browser runs
land all four flights without deaths or errors and verify the complete posed
body remains inside the frame through touchdown.

- `native-summary.json`: baseline and repaired camera results.
- `lite.json`, `full.json`: browser summaries.
- `preserved-source.json`: exact hashes of the course, bonus, movement tuning,
  sky image and cloud renderer, unchanged by this increment.
- PNGs: full-render drop, touchdown and normal presentation.

The framing checks concern the camera projection. Existing cloud bodies still
naturally obscure a rider passing through their volume; this change does not
add an avatar cutout or alter cloud opacity.

## Focused validation

Passed: the new replay/shortcut camera regression; camera-rig tests; landing
forecast tests; Skystream void-fall/checkpoint recovery; loop-camera regression;
Chrome lite and full/native shortcut/replay review. The integrated production
build/typecheck, release-size check (997,265,231 bytes) and packaged Chrome
replay/shortcut check pass. Packaged stamp: `Codex/sol fork · build 10-29 07:52 UTC`.
Public deployment evidence is recorded in the release handoff.

The older `test-camera-fall-replay.mjs` has a pre-existing mismatch in two late
fatal-frame windows. The published baseline fails the same assertion. A
side-by-side comparison confirmed identical hold decisions for all 8,347 frames
between the old and new policies on that ordinary Slipstream fixture. Its three
successful lower catches remain live. The legacy fixture was not rewritten.

No level data changed, so `check:levels` was not needed. No `check:all` ran.

To repeat the focused review, run `node tools/test-skystream-drop-camera.mjs`,
then `node tools/skystream-drop-camera-browser.mjs <preview-url> [--lite]`.
Use `SKYSTREAM_DROP_NATIVE` to point the browser check at the native report and
`SKYSTREAM_DROP_OUTPUT` for its output directory. The native harness can compare
an earlier camera with `SKYSTREAM_DROP_BASELINE=<commit>` and
`SKYSTREAM_DROP_CAPTURE=1`.
