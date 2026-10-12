# After Hours volcano

The main course uses one 1,700 × 850 × 1,500 m volcanic landmark beyond its existing route. The bonus uses the same model at a different world-space scale. Its three broad, winding red lava channels are authored in the material, so their continuity and animated glow do not depend on generated texture details. The river and lagoon use a separate painted magma tile. No scenery participates in collision.

`public/nightworks-kit/volcano.glb` is an original Meshy smart-topology model with 12,484 near triangles, a 2,920-triangle alternate mesh, one shared material, a mipmapped 2K KTX2 albedo, and a 1K JPEG fallback. The game currently renders the authored near silhouette at every distance. The roughly 1.8 MiB download is shared through the existing asset cache. The emission, current and ash clocks use the native level update; there are no additional animation loops, shadow lights or per-frame geometry updates.

The final reference is `reference.png`. It and `public/nightworks-kit/magma-albedo.webp` were made with the built-in ImageGen tool; their complete prompts and original Library filenames are in `prompts.json`. The final Meshy task is recorded in `tasks.json`, and shipped geometry/texture hashes are in `public/nightworks-kit/volcano.provenance.json`. One earlier model was superseded during art review. Provider task replies, signed URLs and raw source exports remain in the ignored `.img2threejs/nightworks-volcano` directory. No credentials are needed by the game.

To rebuild after retrieving that source GLB as `.img2threejs/nightworks-volcano/volcano.glb`:

```sh
JUNGLE_ASSET_WORK="$PWD/.img2threejs/nightworks-volcano" blender --background --python tools/nightworks-kit/bake.py -- --spec tools/nightworks-volcano/module-specs.json
JUNGLE_TOKTX=/path/to/toktx python3 tools/nightworks-volcano/pack.py
```

The packer requires Pillow and Khronos `toktx`. It reuses the first Nightworks kit's Blender fitting/LOD and texture packaging tools. Run the Vite server and open `/tools/nightworks-volcano/review.html` for the four-angle material review; `?fallback` uses the portable JPEG texture.

Focused checks:

```sh
node tools/test-nightworks-volcano.mjs
node tools/test-nightworks-after-hours.mjs
node tools/test-themed-bonus-puzzles.mjs --courses-only --id=nightworks-after-hours
node tools/test-nightworks-volcano-browser.mjs http://127.0.0.1:5236/
```

Supply `PLAYWRIGHT_MODULE` when Playwright lives outside this repository. The browser check verifies visible lava animation, draw cost, graphics-resource stability across repeated transitions and clean console output. The existing complete-route, checkpoint recovery and themed-bonus flow checks cover the playable structure and inventory return separately.
