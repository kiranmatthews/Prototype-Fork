# Reference-faithful Treehouse Trials V2 scenery

Twenty-five independently generated Meshy T2 models form a reusable production
kit for the existing level. Built-in imagegen took the actual supplied pack
images as inputs to extract isolated modular forms; exact input references,
prompts, dimensions, triangle targets and runtime kind names are in `specs.json`
and `prompts.json`. Generated PNG references are retained beside the pack images.

The kit contains two ancient umbrella trees, two detached drooping crowns, two
leafy groundcover banks, two fern/red-leaf clumps, two mossy earth-bank shelves,
three flat river stones, two continuous cave walls, two roof overhangs, two
natural rock-step rows, one open halfpipe scaffold end, a plank, a beam, a
thatch porch hut, a thatch crab shack and one separate frayed cloth awning.
`trialsv2*` kinds are registered by the shared scenery runtime. See `specs.json`
for precise file names and default placement sizes.

Only the two trees and two huts use 2048px albedo / 1024px normal atlases; all
other models use 1024px / 512px. Every model has one atlas material and merged
near/far meshes. UASTC quality 2 textures have full mip chains, lossless Zstd
storage and retained JPEG fallbacks. Meshy's source geometry, UVs and painterly
color regions remain editable in the ignored authoring area. The runtime uses
shared instancing and actual indirect-only AO and rooted wind attributes.

The new 25-model pass consumed exactly **375 existing credits**, taking the
Meshy balance from **861 to 486**. The prior eight-model pass remains separate;
no credits were purchased. Every billable model has one recorded task handle.
Task IDs, source/reference hashes, exact billing, mesh budgets and final GPU
texture hashes are in `public/treehouse-trials-v2/provenance.json`.

## Geometry and shading contracts

All assets are bottom anchored and fronts face +Z after shared normalization.
Planks/beams run along local X. `uniformScaleSizeAtDefaultWidth` records each
source's true proportions so authoring can avoid arbitrary stretching.

River stones B/C have fitted contact tops at normalized Y=1.0. Stone A retains
its original nearly planar surface because a tested flattened edit produced
coplanar bevel triangles; that edit was rejected. Its measured contact median
and small natural deviation are in the manifest and contact grid. `contact-surfaces.json`
contains 41×41 measured height/normal samples and front-to-rear centerlines for
all three river stones and both rock-step rows. Source bounds and cave roof/wall
profiles are in each model manifest. Collision remains explicit level data.

`_JUNGLE_AO` is a float 0.8–1.0 from five measured hemisphere rays per vertex,
with radius 0.14 and origin offset 0.0018 of the largest source span. It affects
indirect diffuse only, preserving direct sunlight and painted albedo. No extra
render pass is needed. `_WIND_FLEX` is a finite rooted float 0–1 based on UV color
classification; tree roots/wood stay fixed, and red plant accents can move.
The separate awning instead fixes the rear -Z edge and four corners, allowing
the front +Z hem to billow vertically in local Y. It does not deform huts/roofs.

The seamless painted loam surface was independently extracted from the master
and jungle-exit references. `loam-albedo.webp` remains the portable fallback;
the exact-size KTX2 sibling uses lower-left physical orientation to match the
ordinary Three.js image texture. Its source/hash/GPU audit is `loam-manifest.json`.

## Reproduction and review

1. Use the official Meshy CLI with existing local OAuth; set `MESHY_NODE` and
   `MESHY_CLI` when the temporary installation path differs. Never put credentials
   in command arguments, public files, browser state, logs or screenshots.
2. `meshy_jobs.py submit NAME` reserves a name before submission and records a
   stable operation ID. `download NAME` retrieves that existing task handle.
3. Run Blender `--background --python-exit-code 1 --python tools/treehouse-trials-assets-v2/prepare.py -- NAME`
   to fit source contact surfaces, normalize timber axes, create far geometry,
   measure AO/contact profiles and render front/rear reviews.
4. `pack.py NAME` produces one-material web GLBs and explicit custom float
   accessors. `compress_gpu.py` uses verified Khronos `toktx` 4.4.2 through
   `TREEHOUSE_TOKTX`, retaining original fallback image and geometry bytes.
5. `meshy_jobs.py balance`, then `provenance.py` records exact billing and final
   packed hashes. `validate.py` checks finite geometry, LODs, shader attributes,
   mip chains, fallbacks, budgets and the exact 25-task credit total.

Source GLBs, signed responses, AO evidence and all two-angle model reviews stay
in ignored `.img2threejs/treehouse-trials-v2/`. No generative credentials or signed
download URLs are published. Source/reference atlas quality is reviewed before
integration; the final level still requires all-scene browser composition QA.

## October contact and matte repair

`node tools/bake-treehouse-contacts.mjs` now bakes exact upward/vertical LOD0
triangles for the three river stones and the accepted rock stair B. The
normalized frame is identical to JungleAssetKit. Runtime level data applies
placement scale/yaw and 2cm sole clearance, replacing the earlier coarse grids.
`contact-bake.json` records the accepted GLB hashes and triangle counts.

`repair-mattes/` retains three original-alpha built-in ImageGen sources and
exact prompts. Runtime KTX2/WebP outputs and hashes are in
`public/treehouse-repair/`. No additional Meshy credits were used in this repair.
