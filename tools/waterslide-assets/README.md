# Waterpark scenery assets

The packed GLBs keep the approved Meshy surfaces, UVs and texture maps. Tropical
groves and planted cliffs also contain a distant mesh. The existing scenery kit
crossfades between the two from 160–200 m in Slipstream's fog and uses the distant
mesh in water reflections. Close-up geometry and collision are unchanged.

Regenerate from the retained local source downloads with an installed Python
containing NumPy/Pillow and an installed Blender (set `BLENDER` if it is not on
PATH or in the usual macOS application location):

```sh
python3 tools/waterslide-assets/pack_assets.py tropical-grove planted-cliff
node tools/test-waterslide-scenery-lod.mjs
node tools/test-jungle-assets.mjs
```

`pack_assets.py` fits and packs the source first, then `add_lods.py` appends reduced
geometry without re-exporting the approved near model or its images. Both details
share one material and atlas. Blender repairs duplicate/degenerate faces after
collapse. The provenance records near-buffer hashes and far triangle counts.
The checks lock the approved near bytes, test eight projected silhouettes per
asset, and exercise real runtime loading, shared maps and reflection restoration.
No generation service, download or upload is needed.

For a running local production preview:

```sh
node tools/waterslide-island/profile-browser.mjs http://127.0.0.1:5348
```

The profiler captures eight supported rider views and measures 120 ordinary
rendered frames per view. Optional `ISLAND_GPU=1` adds one GPU timer per complete
render frame; those instrumented timings are separate from normal frame pacing.
Use `ISLAND_BASELINE_DIR` to serve older copies of just the two GLBs for a paired
comparison. `ISLAND_VIEWS`, `ISLAND_LITE` and `ISLAND_PROFILE_OUTPUT` select views,
presentation and local output. Set `PLAYWRIGHT_MODULE` to an existing installed
Playwright module when it is not available on the normal module path.


## Worn flumes and shallow slide pools

The pool/ribbon paintovers in `docs/waterslide-island/concepts/` guide this pass.
The existing `public/waterslide/fiberglass.webp` supplies all painted chips and
mineral wear. Swept flumes use 5 m surface-distance UVs, and the same map also
supplies broad stain variation. Box landings use cream coping and aqua tile
sides; moving platforms now honour their authored fiberglass finish.

Seven horizontal rainwater pockets occupy measured low points in the unchanged
ride. They are 11–22 cm deep at their deepest points, clipped against actual
support triangles, and below each trough's outlet. Together they add 554
triangles and no textures or reflection passes. They are visual water, with
normal skating traction; the eight deeper catch pools retain swimming.

`waterslide-shallows` is an editable `mesh` with `materialStyle: 'water'` and
`solid: false`. UV.x records the vertical distance to the floor in metres;
zero depth fades the water into its shoreline. Ripples only change shading.
The saved water geometry is deliberately separate from ride collision. If the
track changes, regenerate it and run the support/shoreline checks locally:

```sh
node tools/waterslide-island/bake-shallow-pools.mjs
node tools/test-waterslide-shallows.mjs
node tools/test-waterpark-decks.mjs
```

The review tool includes `ribbon-shallows`, `reservoir-shallows`,
`sluice-shallows`, `spillway-shallows`, `garden-shallows`, `upper-shallows` and
`skyfall-shallows`. Use `ISLAND_VIEWS` to select them, with `ISLAND_LITE=1` for
an initial check and an ordinary full-render pass afterward. These are real
local gameplay captures, separate from the concept images.
