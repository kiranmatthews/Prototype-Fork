# Crate rebuild validation — 5 November 2026

This replaces the rejected procedural art direction. Earlier technical PASS
records in `docs/crate-art-production` do not establish acceptance of that art.
The current live version remains until the coordinator publishes this increment.

## Asset and motion review

- Actual Tripo exports, including lower faces, were inspected in the local studio
  at MAX/native. `metal-six-sides-native.png`, `checkpoint-six-sides-native.png`,
  `nitro-six-sides-native.png` and `family-native.png` record the final shapes.
- `metal-native-three-quarter.png` is the independent steel model, not a wood
  recolour. Bottom fasteners were added from its own source geometry.
- `wood-debris-native.png` and `metal-debris-native.png` show actual surface
  fragments with distinct fresh-cut materials. Closed Blender authoring meshes
  and exact source exterior area are checked by `test-crate-assets.mjs`.
- Native rendered-vertex contact checks advance 360 fixed steps and inspect the
  actual skinned vertices. Wood and steel both reach minimum Y -1.017 above the
  floor at -1.02, remain finite, and fully retire. Results are saved in
  `wood-contact-check.json` and `metal-contact-check.json`.
- `tnt-crate-motion.webm` contains the complete 5.6-second simulation sequence:
  intact bundle, burning braid, detonation, torn canvas and cleanup.
  `nitro-crate-motion.webm` shows the separate green blast, short-lived paper
  pieces, fluttering wraps and cleanup. These were reviewed as moving clips.
- No distance-dependent mesh replacement, decimation or reflection substitute
  was introduced. Asset triangle counts are in `asset-check.json` and AUTHORING.

## Real game browser checks

Chrome used `crate-game-review.html?playtest&level=bonus-easy&lite`, then the
same URL without `lite`. This session-only fixture adds a supported apron and
uses real Level and Player methods. It waits for normal startup warm-up before
adding its test objects. Selecting a type respawns/reset the fixture; it does
not edit the published level pack. The large codex-lab scenery startup was
replaced by this lightweight course for focused checks.

Observed in the actual game:

- Supported player placement; ordinary metal survives a stomp with no effects.
- Wood spin and stomp consume the crate and emit 22 source pieces, one VFX
  burst and three draw calls. Five-hit stomps display 4, 3, 2, 1, then break
  into fourteen pieces. Metal bounce remains intact after top collision.
- TNT begins with approximately three seconds on its gameplay fuse, remains
  visually unlabelled, detonates and fully cleans up. Nitro has blank marks,
  no fuse, luminous green paper, and emits 28 pieces in two draw calls.
- The metal switch becomes used and reveals the outline crate without breaking.
- Checkpoint activation hides the crate after its brief scale-pop with zero
  shards, bursts or residual world marker. Soft restore keeps the checkpoint
  banked and hidden. A pit death returns the player to the checkpoint position
  on supported ground. Hard reset restores its intact visible state.
- Full rendering was inspected at 3024 x 1612 native and 900 x 480 with CRT.
  Wood smash and metal bounce also ran at 480p/CRT. Checkpoint activation/reset
  was repeated at native resolution. See the `*-game-full-*.png` proof files.
- The final full-game console had no errors or warnings; presentation readiness
  reported no pending or failed assets.

## Focused automated checks

`node tools/test-crate-assets.mjs`, `node tools/test-crate-art.mjs`, and
`node tools/test-explosive-bundles.mjs` pass. The asset test reads the actual GLB
geometry and textures. The headless behavior tests use fallback presentation
geometry, so their counts are not claimed as the exported-asset counts.
The full audit suite was not run; no authored level data or movement tuning
changed. Production `npm run build` passes (typecheck, Vite bundle and complete release
asset preparation). The first attempt exposed a browser-only Image constructor
in headless release export; the guard now checks Image availability, and the
complete build succeeded on the second attempt. Standard existing bundle-size
warnings remain. No final game-console warnings were observed.

## Reproduction

Run Vite with `tools/crate-review-vite.config.ts` so its dependency cache is
isolated from other worktrees. Open `crate-art-review.html` for six-side,
lighting, fuse, fracture, motion-recording and actual-vertex-contact controls.
Open the explicit playtest URL above for collisions, switches and checkpoint
lifecycle checks. The harnesses are local development pages, not game menus.
