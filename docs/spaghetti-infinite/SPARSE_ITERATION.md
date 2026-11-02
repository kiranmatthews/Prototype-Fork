# Smaller islands, connected rails and visible falls — 2 November 2026

Both Spaghetti courses now spread smaller catch islands across four height
tiers. Five broad decision decks become three separate islands each; the start,
midpoint and finish retain generous shared platforms. Average platform area is
474 m² in the race and 491 m² in the platformer, down from 882 m² and 918 m²
(about 46% smaller). Catch islands are approximately 24 × 18 m. This increases
the number of individual pieces while opening more space at each height.

Each course has 40 authored rails. Four continuous descending recovery threads
visit every lower island, four drop links join the upper start to these threads,
and decision crosslinks, spring returns and final descents connect the remaining
platforms. All 230 race platforms and 170 platformer platforms belong to one
connected rail network. Every rounded rail still advances toward negative Z.
The full corridor retains catch coverage; misses cost travel time without
requiring a reset. The original springs, kicker jumps and spine transfers remain.

One forward travel zone removes branch-dependent camera and control turns.
The levels use the normal camera settings and omit the spring cinematic camera.
The fall camera rebases its remembered departure height across vertical wraps.
A small presentation layer lowers a blocked trailing eye beneath a platform
underside, then restores it; the existing minimal pose framing continues through
touchdown. It preserves heading and lens and uses the level's existing ground
raycasting. Both player views use the same correction. Movement tuning is unchanged.

## Checks and evidence

- `test-spaghetti-infinite.mjs`: 661,218 half-metre coverage probes, strict forward
  rails, every platform connected, ten wrapped physical landings and unchanged tuning.
- `test-spaghetti-connections.mjs`: all four recovery rails in each level ridden
  with production inputs from an explicit initial placement through their final
  approach, with enemies active and no deaths or resets. The rail routes pass
  beside the platformer's inner-edge patrols.
- `test-spaghetti-features.mjs`: two spring rewards, all three intended kicker
  receivers, both complete spine cascades, walls, checkpoint and crystal/finish.
- `test-camera-rig.mjs` and `test-camera-sightline.mjs`: repeated seam rebasing,
  underside clearance, landing framing, base-camera restoration and preserved yaw/lens.
- `test-spaghetti-sparse-browser.mjs`: Chrome lite and full/native 1440×900,
  ledge drops, platform undersides, deep wraps and crossed rails in both levels.
  Across 2,406 sampled frames, no live body centre left the screen or was hidden
  behind a ground surface. Automatic yaw remained zero. Consoles were clean.
- `spaghetti-infinite-browser.mjs --full`: normal input traversal, continuous
  rendered camera/rider seam motion, supported catches and actual platformer finish.
- Live editor height/radius edit, rebuilt rail navigation, exact undo and TEST.
- Required `npm run check:levels`, `npm run build` and `npm run check:release`.

The eight-rider native race completes in 36.03–41.57 seconds with no
resets. The full/native platformer sample averages 16.73 ms (p95 18.40 ms). The
race sample averaged 35.35 ms while native validation was running concurrently;
these are local measurements, not a frame-rate guarantee. Geometry retains its
full authored silhouette at every viewing distance.

Compact reports and inspected native-resolution images are in
[sparse-evidence/](sparse-evidence/). Browser placements isolate specific fall
and finish cases; they are not presented as an unassisted complete playthrough.
The earlier [validation](VALIDATION.md) describes the preceding broad-deck
iteration. No full suite was requested or run. Prompt to playable and confirmed
feature traversal: approximately **31 minutes** (01:59–02:30 UTC).

The final production build and release-size check passed: 803,486,314 bytes,
offline version `929adf41b0eb5ba0c2f2`. The final eight-rider rerun uses the
completed finish approach; its exact results are in `sparse-evidence/race.json`.
