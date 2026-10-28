# Verified live Beach release

Published commit: `0a10f2c662b850e62f92e5b3702c1dd7f5975239`.
[Pages run 40661426694](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/40661426694)
succeeded. The actual [Beach Street page](https://kiranmatthews.github.io/Prototype-Fork/?playtest&level=coastal-street-run)
serves `Codex/sol fork · build 10-28 09:08 UTC`, offline version
`d903410add66df0e7822`, entry `assets/index-D_Cii4Xl.js`. Both entry and version
match that exact CI run. The hosted package is 1,847 files / 997,048,726 bytes.

Fresh Chrome verifies the delivered level pack without restoring a built-in
copy. Its complete 3 km run passes all 13 jumps, ten physical checkpoints,
24/24 main-course boxes and the crystal. The gem correctly remains unavailable
without the 36 linked bonus boxes. The rider releases the kite, stops, walks
sideways and backwards, then finishes with a fresh jump. All captured stamps
match the deployed build. Zero crashes, console/asset errors, failed responses,
canopy clips or reduced scenery meshes; maximum hand attachment error is
0.053 mm. MAX/native 1600×1000 and normal CRT views are retained and reviewed.
The run completed at 09:21:53 UTC on 28 October 2026.

## Pilot correction during verification

The first run is preserved in `first-attempt/`. It died at the planter after
the optional bonus pad (z=1506.587, x=1.679). The browser pilot had held its left
bypass until one metre beyond the pad's visual centre. The tilted contact plane
is actually 1.516 m before that centre, so the pilot unnecessarily delayed its
right turn by 2.516 m. This was a test-route correction; no deployed game code
changed after publication.

The pilot now turns toward x=3.8 immediately after crossing the actual contact
plane and records that segment. The passing live run clears the planter at
x=2.499 near z=1506.128 despite sustained opposing wind of -0.848 to -0.860.
It uses ordinary keyboard events throughout, with no teleport, invulnerability
or velocity writes during the journey. The first failed attempt is retained
alongside the passing result rather than overwritten.

`deployment.json` contains CI/public identity evidence; `browser-full.json`
contains the input journey and checks. `verification.json` binds this evidence
to the published source and corrected test runner. The post-deployment commit
contains only the test correction and verification records; the live game is
the published commit above.
