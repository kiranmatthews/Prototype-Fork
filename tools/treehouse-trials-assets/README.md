# Treehouse Trials modular scenery

Eight independently generated Meshy Smart Topology models extend the existing
Treehouse Trail kit. The pack's style master guides broad silhouettes, painted
material regions, soft shading and controlled greens. Isolated source references
were made with built-in imagegen; exact prompts are in `prompts.json` and their
selected PNGs are in `references/`.

| Model / decor kind | Default metres X/Y/Z | Placement |
| --- | --- | --- |
| cavearch / `treehousecavearch` | 14 / 10 / 5 | Broad walk-through arch; front +Z. |
| cavewall / `treehousecavewall` | 12 / 10 / 6 | Reusable thick cavern wall chunk. |
| rocksteps / `treehouserocksteps` | 6 / 2.5 / 7 | Irregular stone ledges rising from +Z to -Z. |
| porchhut / `treehouseporchhut` | 7 / 5 / 6 | Round plaster/timber hut with porch and cloth awning; front +Z. |
| sugarcane / `treehousesugarcane` | 4 / 5 / 3 | Broad planted cane cluster; bottom anchored wind. |
| bridgeend / `treehousebridgeend` | 7 / 2.5 / 4 | Broken bridge platform; broken edge +Z. |
| boulder / `treehousemossrock` | 5 / 3 / 4 | Broad mossy shoulder rock. |
| crabshack / `treehousecrabshack` | 9 / 7 / 8 | Stilted shack with sculpted crab roof landmark; front +Z. |

Every model has merged near/far geometry and one shared material atlas. Original
Meshy geometry, UVs and painted textures are retained. Blender builds a 32% far
silhouette; the runtime shares geometry/materials across instances. Albedo is
2048px and normal is 1024px for the arch/hut/crab-shack heroes; the five reusable
rock/cane/bridge modules use 1024px color and 512px normal. Khronos UASTC textures
retain both resolution and a JPEG fallback, reducing ASTC/BC7 GPU residency to
6.67 MiB per hero atlas pair and 1.67 MiB per repeated module pair.
Collision stays in level data, independent of visible triangles.

The eight tasks consumed exactly **120 credits**, taking the existing account
balance from **981 to 861**. One initial parameter validation rejection created
no task and consumed zero credits. Task handles, reference hashes, credit evidence,
final asset hashes, triangle counts and texture budgets are in
`public/treehouse-trials/provenance.json`. Signed API responses and source GLBs
remain in ignored `.img2threejs/treehouse-trials/`.

## Reproduction

Use official `@meshy-ai/cli@0.3.1` with its existing local OAuth profile. Install
it in a temporary directory and set `MESHY_NODE` / `MESHY_CLI` when its default
runtime paths differ. No credentials belong in arguments, repository, browser
storage, public assets, or screenshots.

1. `meshy_jobs.py submit NAME` reserves each name before submission and records a
   stable operation ID. Recorded tasks are never blindly resubmitted.
2. `meshy_jobs.py download NAME` queries the existing task and downloads its GLB
   through the official CLI.
3. Run Blender `--background --python tools/treehouse-trials-assets/prepare.py -- NAME`
   to merge source parts, produce far geometry, export, and review front/rear views.
4. Run `pack.py NAME` with Python/Pillow to make the web atlas GLB and manifest.
5. Set `TREEHOUSE_TOKTX` to official Khronos `toktx` 4.4.2 and run `compress_gpu.py`.
   The checked Darwin-arm64 package SHA256 was
   `500bd8f9d63358c3f3a0d83b724c8574436a72c37dc0e4bad90ec1ca38032c3c`.
6. `meshy_jobs.py balance`, then `provenance.py` records exact credit totals and
   final production asset hashes.

`compress_images_gpu.py` encodes only the three scenery matte WebPs and the
timber albedo into sibling KTX2 files. Original WebPs remain byte-identical
fallbacks. Images keep their exact dimensions and full mip chains; their
lower-left physical orientation matches ordinary Three.js image textures.
`public/treehouse-trials/image-gpu.json` records hashes, bytes, dimensions,
orientation, mip counts and GPU residency independently of model provenance.

Asset checks: `python3 tools/treehouse-trials-assets/validate.py` checks finite
geometry, triangle budgets, one atlas material, complete compressed mipmaps,
fallback textures, public-safe metadata and the exact billed task totals.
