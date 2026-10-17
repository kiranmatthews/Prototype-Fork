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
