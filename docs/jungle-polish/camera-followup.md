# Jungle Ruins side-camera clearance

The local preview exposed a missed placement problem in the Sunward ascent:
the aqueduct's final right-hand background canopy at `[56,-8,-1340]` occupied
the side camera's corridor. Its trunk and leaves could hide the player and the
next landing on the lower climb. The earlier art review sampled ledge 6, after
the worst obstruction.

The complete canopy now sits at `[56,-8,-1418]`, behind the ascent. This is one
decorative position change. All 1,347 finale components remain, including every
tree, rock, platform and all 164 non-decor gameplay components. Asset geometry,
camera settings, collision, checkpoints, movement and grind policy are unchanged.

## Focused regression

`tools/jungle-ascent-camera-browser.mjs` uses the ordinary game camera with no
camera override. It visits the turning court, all twelve ledges and the summit
at the centre and both edges of the 9-metre path: 42 supported viewpoints per
render mode. It ray-tests native foliage against the player body, head, next
on-screen landing and a grid across the main foreground. Screenshots supplement
the geometric checks, including shader-driven foliage motion.

The old production build reproduces 19 blocked player/landing rays and 119
foreground intersections across eight viewpoints. Every obstruction identifies
the same `junglebackdrop` placement. The neighbouring ancient tree is clear and
remains in place.

The final validation passes all 126 viewpoints with zero blocked player/landing
rays, zero foreground foliage hits and no console, asset or WebGL errors. Full
rendering uses MAX/native (1440×900) and 720p (1152×720); lite uses the 720
setting with its 720×450 internal buffer. Each mode uses a fresh renderer.
The existing input-driven finale route and pit
recovery evidence from `71ed93df` remain applicable because gameplay components
are byte-for-byte unchanged. The separate pre-existing live resolution-switch
issue documented in [the original review](README.md#existing-renderer-issue)
is outside this placement correction.

Run the browser regression against the local production preview, under the
shared `run_heavy.py` guard during release coordination:

```sh
node tools/jungle-ascent-camera-browser.mjs http://127.0.0.1:5418/
```

`PLAYWRIGHT_MODULE` can identify the installed Playwright module.
`JUNGLE_CAMERA_OUT` selects the evidence directory; `JUNGLE_CAMERA_MODES` selects
comma-separated `full-max`, `full-720` or `lite-720`. The optional
`JUNGLE_CAMERA_BASELINE=1` records a known failing placement without requiring
clear sightlines; it still requires clean rendering and supported viewpoints.

`npm run check:levels` and `npm run build` pass. The guarded serial batch
released slot 0 with exit 0 and closed its test browser. The local production
stamp is `Codex/sol fork · build 10-27 10:50 UTC`, offline version
`83ccf851d23941374699`. No new public assets or shared runtime changes.

Prompt-to-playable elapsed time: 23.6 minutes; all local validation completed
in approximately 28 minutes, including the initial capacity deferral.

Evidence: [validation and exact source blobs](camera-validation.json),
[baseline camera sweep](camera-before.json), [corrected camera sweep](camera-after.json),
[component preservation](camera-preservation.json), [before](camera-before.png),
[after at MAX/native](camera-after.png), and [after at 720p](camera-after-720.png).
Raw captures remain ignored in `.work/camera-*`.
