# After Hours · caldera art direction

The current scene was developed from two **actual gameplay-view paintovers** made with the built-in ImageGen tool. Compare `concepts/main-course-target.png` and `concepts/bonus-target.png` with the real captures in `docs/art-reviews/nightworks-after-hours-volcano.jpg` and `docs/art-reviews/nightworks-caldera-bonus.jpg`. Full prompts and Library source filenames are in `concepts/prompts.json`.

The distant volcano is a generated panorama on a **world-space curved mesh**, not a new 3D volcano model. It has a broad collapsed caldera, individually legible branching lava channels, layered ash, and a low cloud bank. Only hot pixels pulse; the rest of the image keeps a stable exposure. The 3D route, quarry arches, basalt formations, large irregular lake and shoreline provide the nearer depth and parallax. The lake fades into the distant basin rather than filling the horizon with opaque fog.

The slate surface from the first Nightworks bonus now follows the original islands and new ramp caps in metre-scale triplanar coordinates. All original collider triangles, dimensions, ground-array order, automatic edge-grind paths, camera volumes, timings, checkpoints and rewards remain intact. Every new visual component explicitly uses `scenerySolid:false`. Both courses reuse the existing six-light torch pool at a higher authored intensity; no extra dynamic lights or animation loops were introduced.

`public/nightworks-kit/caldera-basalt.glb` is a new authorized Meshy smart-topology model generated from `concepts/basalt-reference.png`. It has 6,631 / 1,242 triangles, one shared 2K ETC1S albedo with mipmaps and a JPEG fallback, plus small normal/roughness maps. Its 1.57 MiB transfer is shared across placements through the existing asset cache. The existing distance-LOD dither blends between the two meshes. Task ID, hashes and exact output sizes are in `caldera-basalt.provenance.json`; the private raw export stays under ignored `.img2threejs/nightworks-caldera`.

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

Supply `PLAYWRIGHT_MODULE` when Playwright lives outside this repository. The browser check measures actual visible lava-pixel changes, loaded compressed basalt, draw cost, clean console output and graphics-resource stability across six main/bonus switches. These checks establish functionality and rendering health; the saved gameplay images are the visual review evidence.
