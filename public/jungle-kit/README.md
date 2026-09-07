# Jungle Ruins — modular Sunstone kit

Twenty-two textured Meshy models created from original references generated
with Codex’s built-in OpenAI image generation tool. The supplied game screenshots
guided the stylized art direction; their model and texture data is not included.

The temple is assembled from sixteen individual stone modules: bonded masonry,
separate column bases/shafts/capitals, carved lintels and accents, cornices,
roof wedges, corner hips, ridge stones, stair treads and paving slabs. There is
no whole-temple or facade GLB in the runtime. Gateways and temples are named
editor groups whose blocks can be picked and edited independently. The reusable
wall, platform, arch and pavilion palette entries expand into the same kit.

The ground is brown dirt, including the path, soil banks and missing-paver
patches. Simplified broadleaf plants, palms and ferns use a small number of
large leaves. A new canopy tree supplies the upper enclosure; foreground
plantings are spaced into larger clusters. Leaves and hanging vines sway in
wind, with matching shadow deformation and animated canopy shade.

| Meshy asset | Near triangles | Far triangles | Base colour |
| --- | ---: | ---: | --- |
| broadleaf | 1,324 | — | 512² JPEG |
| palm | 1,752 | — | 512² JPEG |
| fern | 1,718 | — | 512² JPEG |
| log | 1,655 | — | 1024² JPEG |
| thorns | 1,496 | — | 512² JPEG |
| cut stone block | 708 | 198 | 2048² KTX2 / 1024² JPEG fallback |
| worn stone block | 662 | 198 | 2048² KTX2 / 1024² JPEG fallback |
| fractured stone block | 940 | 282 | 2048² KTX2 / 1024² JPEG fallback |
| stone paving slab | 552 | 154 | 2048² KTX2 / 1024² JPEG fallback |
| column base | 1,139 | 341 | 2048² KTX2 / 1024² JPEG fallback |
| column shaft block | 662 | 264 | 2048² KTX2 / 1024² JPEG fallback |
| column capital | 1,161 | 406 | 2048² KTX2 / 1024² JPEG fallback |
| straight cornice | 919 | 294 | 2048² KTX2 / 1024² JPEG fallback |
| corner cornice | 1,150 | 402 | 2048² KTX2 / 1024² JPEG fallback |
| carved lintel | 1,403 | 561 | 2048² KTX2 / 1024² JPEG fallback |
| spiral relief block | 1,288 | 515 | 2048² KTX2 / 1024² JPEG fallback |
| sloping roof block | 766 | 228 | 2048² KTX2 / 1024² JPEG fallback |
| roof ridge block | 854 | 256 | 2048² KTX2 / 1024² JPEG fallback |
| arch wedge stone | 754 | 226 | 2048² KTX2 / 1024² JPEG fallback |
| stone stair tread | 1,510 | 453 | 2048² KTX2 / 1024² JPEG fallback |
| hip roof corner | 740 | 221 | 2048² KTX2 / 1024² JPEG fallback |
| jungle canopy tree | 2,025 | 546 | 2048² KTX2 / 1024² JPEG fallback |

The twenty-two GLBs total **19.98 MiB**, including fallback textures.
`manifest.json` and `modular/manifest.json` record dimensions, source/packed
SHA-256 hashes, byte sizes and triangle counts. Modular albedo maps use ETC1S
KTX2 with mipmaps; 512² normal and 256² roughness maps remain separate. The
Khronos/Basis transcoder’s Apache notice is retained in `basis/`. `dirt.jpg`
is the new 1024² generated earth texture. Raw authoring PBR models and signed
download records remain local under `.img2threejs/jungle-kit/`.

Runtime templates share geometry and maps. Modular instances use 20 m cells
and near/far geometry with a 32 m stone / 48 m canopy transition; other plants use 32 m cells.
Assets and shaders warm behind the loading transition. The measured full
Jungle kit used 17 compressed albedo textures and approximately 135 MiB of
estimated texture memory on the tested browser/device. This does not include
other level, character, shadow or post-processing resources.

The generation ledger and complete image prompts are in `tools/jungle-kit/`.
The first pass used 150 Meshy credits. This revision used 255 for seventeen
additional T2 generations and 10 for clean roof UVs/texturing: **415 of 650
authorized credits total**. Verified account balance: 676 → 261. Four superseded
whole/facade meshes and one discarded plant study remain listed for honest
accounting but do not ship. Credentials and signed download URLs are not shipped.

Authoring and validation:

1. Generate references with the built-in image tool using the recorded prompts.
2. Submit selected references through `generate.py`, then download with `fetch.py`.
3. Fit modules and create far geometry with Blender: `bake_modular.py`.
4. Pack with `pack_modular.py` (Pillow and Khronos toktx 4.4.2; set `JUNGLE_TOKTX`
   to its executable). `pack.py` handles the five retained original assets.
5. Run `npm run check:levels`, `node tools/jungle-kit/playtest.mjs` and `npm run build`.
6. Review actual gameplay through `/tools/jungle-kit/review.html` and individual
   modules/assemblies through `/tools/jungle-kit/gallery.html` under Vite.

The neutral assembly render in `docs/art-reviews/jungle-ruins-modular-temple.png`
shows the 182-piece pavilion under studio lighting, not the gameplay renderer.
Reproduce it with `node tools/jungle-kit/export_assembly.mjs`, then run Blender
in background mode with `--python tools/jungle-kit/render_assembly.py`.

The regression checks inspect real packed geometry, finite attributes, UVs,
LOD reduction, compression/fallbacks, roof/arch coverage, instancing and wind,
async editor picking, capture/rebuild, dirt terrain and supported traversal.
Original collision surfaces, checkpoints, pits and movement tuning are retained.
