# Procedural green beacon platforms

The final start and finish models are built entirely in `src/beaconPlatform.ts`.
They follow the world map's green deck, white halo and dark foundation. The user
rejected both Meshy versions and requested smooth procedural modelling and glow.
No downloaded models, textures, canvas artwork or point lights are needed.

The body and ceramic crown use closed, smoothly shaded profiles of revolution
with 144 radial segments and rounded bevels. The green deck has a restrained
radial vertex-color gradient, a clear-coated material and a perfectly flat
standing plane. Five shader layers provide feathered ground spill, soft white
rim radiance, a slowly orbiting inset light, a faint rising veil and ten small
light motes. These effects remain visible with bloom disabled. The finish has a
slightly brighter green treatment; both retain the map beacon's silhouette.

Each platform uses 20,310 triangles, 12 draws including the points, and no asset
downloads. The existing reference-counted cache shares geometry and materials;
level-owned collider disposal releases its lease. Context restoration preserves
live resources and late attachment is guarded. Animation updates shader uniforms
only; neither geometry nor collision moves.

The original three collider meshes, footprint, standing height, spawn/finish
flags and movement rules remain authoritative. Measured contact gaps are below
3.34 mm. The existing travel-column effect remains unchanged.

```sh
node tools/test-beacon-platforms.mjs
node tools/test-warp-pad-batching.mjs
node tools/test-level-warp.mjs
node tools/test-beacon-platforms-browser.mjs http://127.0.0.1:5462/
```

Open `tools/beacon-platforms/review.html` through Vite for the animated pair.
Use `?night` for low light, or `?kind=arrival` / `?kind=finish` for one model.
The reviewed day/night and in-game captures are in `docs/beacon-platforms/`.

The earlier generation prompts, references, task ledger and generation scripts
remain as authoring history only. Neither Meshy pair is shipped or loaded.
Original downloads and the rejected packed models are retained in ignored
`.img2threejs/beacon-platforms/`; the prior Git commit also preserves them.
