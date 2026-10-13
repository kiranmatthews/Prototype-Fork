# After Hours · caldera art direction

The selected direction is `concepts/nightworks-approved-target.png`, approved by the user after reviewing actual gameplay paintovers. Its chunky Nightworks geology, warm route and dark scenery guide this version. The user chose a **smoke-free distant render with separately animated Gouraud smoke** to try first. Current prompts and Library filenames are in `concepts/approved-prompts.json`; earlier studies remain in `concepts/prompts.json`. Actual game captures are in `docs/art-reviews/nightworks-after-hours-volcano.jpg` and `docs/art-reviews/nightworks-caldera-bonus.jpg`.

The distant volcano is a generated panorama on a **world-space curved mesh**, not a new 3D volcano model. It has a broad collapsed caldera, individually legible branching lava channels, chunky rising quarry terraces and a clear night sky. There is **no painted smoke or cloud plume** in the image. The painting is split into separate bowl, front-rim and lower-terrace meshes. The smoke originates behind the front rim. Only hot pixels pulse; the rest of the image keeps a stable exposure. The 3D route, quarry arches, basalt formations, large irregular lake and shoreline provide the nearer depth and parallax. The lake fades into the distant basin rather than filling the horizon with opaque fog.

The distant plume is an isolated 96-puff instance of the existing `PuffSystem`, using untextured Gouraud colour/alpha fans in two shared draws. It starts prewarmed, then continuously rises, expands, deforms, drifts and fades. Its update follows the level clock, and both buffers/materials are explicitly released on level disposal. It cannot consume the player's or torches' particle budget.

Playable tops use the original Nightworks quarry surface in metre-scale coordinates, with restrained warm colour and cool original cliff sides. Ramps and banks share the same treatment; nearby scenery keeps cooler slate. All original collider triangles, dimensions, ground-array order, automatic edge-grind paths, camera volumes, timings, checkpoints and rewards remain intact. Every new visual component explicitly uses `scenerySolid:false`. Both courses reuse the existing six-light torch pool at a higher authored intensity; two additional pooled scarlet spill lights mark the authored chasm vents.

`public/nightworks-kit/caldera-basalt.glb` is a new authorized Meshy smart-topology model generated from `concepts/basalt-reference.png`. It has 6,631 / 1,242 triangles, one shared 2K ETC1S albedo with mipmaps and a JPEG fallback, plus small normal/roughness maps. Its 1.57 MiB transfer is shared across placements through the existing asset cache. Distant terraces borrow the smaller mesh through the same asset lease. Opaque stone blends into a live colour capture of the layered backdrop before its streaming boundary. Task ID, hashes and exact output sizes are in `caldera-basalt.provenance.json`; the private raw export stays under ignored `.img2threejs/nightworks-caldera`.

The earlier `volcano.glb`, its reference and its packing script remain available for old editor data. Neither current course places that model. The previously synthesized broad red bands were removed from its material too; the current art follows the generated scene composition.

To rebuild the basalt after retrieving its source as `.img2threejs/nightworks-caldera/caldera-basalt.glb`:

```sh
JUNGLE_ASSET_WORK="$PWD/.img2threejs/nightworks-caldera" blender --background --python tools/nightworks-kit/bake.py -- --spec tools/nightworks-volcano/basalt-spec.json
JUNGLE_TOKTX=/path/to/toktx python3 tools/nightworks-volcano/pack-caldera.py
```

Focused checks:

```sh
node tools/test-nightworks-volcano.mjs
node tools/test-nightworks-after-hours.mjs
node tools/test-nightworks-checkpoint-recovery.mjs
node tools/test-themed-bonus-puzzles.mjs --courses-only --id=nightworks-after-hours
node tools/test-nightworks-volcano-browser.mjs http://127.0.0.1:5236/
```

Supply `PLAYWRIGHT_MODULE` when Playwright lives outside this repository. The browser check measures actual moving Gouraud vertices, vertex colour/alpha, bounded smoke draws, visible lava-pixel changes, loaded compressed basalt, draw cost, clean console output and graphics-resource stability across six main/bonus switches. These checks establish functionality and rendering health; the saved gameplay images are the visual review evidence.

Depth, lighting, renderer-state and fade evidence is in `docs/nightworks-depth-review/README.md`.
