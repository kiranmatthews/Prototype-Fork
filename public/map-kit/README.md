# Modular island-map landscape kit

Three original Meshy T2 rock modules, generated and textured individually from
original built-in image-generation concepts. No whole-island model is used.

| Module | Near triangles | Far triangles |
| --- | ---: | ---: |
| Cliff buttress | 6,494 | 1,428 |
| Ridge spine | 6,709 | 1,475 |
| Sea arch | 6,630 | 1,657 |

Each asset is below the requested 15,000-triangle ceiling, including both LODs.
The three GLBs total 5.19 MiB. They have shared near/far materials, 2048² KTX2
albedo with mipmaps, 1024² JPEG fallback, 512² normals and 256² roughness.
The manifest records sizes, triangle counts and SHA-256 hashes. They reuse the
existing renderer, texture transcoder, spatially culled instancing and loading
transition. The assets are also available through the existing scenery catalog.

The noisy rainforest-tree experiment was rejected by the user. It is absent
from this directory and the runtime/catalog. The map instead reuses the game's
established clean canopy and palm assets, with restrained density, root embedding
on slopes and the existing wind deformation/shadow system. No replacement tree
generation was charged.

Meshy spending for this brief: **60 / 300 credits**—45 for the three selected
rocks and 15 for the rejected tree. Account balance was verified at 2,211 before
submissions and 2,151 afterward. There were no retries or additional Meshy calls.
The budget ledger includes rejected work rather than hiding its cost.

Authoring sources and full prompts:

- `tools/map-kit/brief.json`: original concept prompt set and invariants.
- `tools/map-kit/cliff-texture-prompt.json`: built-in image-generation prompt for
  the low-contrast painted cliff albedo (1024² JPEG runtime copy).
- `tools/map-kit/references/`: selected original concept images.
- `tools/map-kit/tasks.json`: provider task IDs and credit accounting.
- `tools/map-kit/module-specs.json`: fitted dimensions, LOD ratios and rejection.

The small map adapter reuses `tools/jungle-kit/generate.py` and its official
Meshy CLI fetching workflow. Blender fitting uses the existing
`bake_modular.py -- --spec tools/map-kit/module-specs.json` with
`JUNGLE_ASSET_WORK` pointing to the local `.img2threejs/map-kit` directory.
`tools/map-kit/pack.py` reuses the original KTX2/fallback packer. Raw signed
responses and rejected binaries remain local/ignored, never in the game bundle.

Island landforms are procedural: a closed caldera, ridged flanks, valleys,
terraces, slope-coloured/tiled cliffs and sand edges. First-island dry width was
measured at 201.56 m, approximately **2.75 screen widths** at the normal 16:9 map
camera. The camera pans with the selected node without widening its normal zoom.
The ocean shader and all ocean/outline tuner values are unchanged; its existing
surface was extended laterally to cover the enlarged world without an edge gap.

Validation includes per-asset budgets/hashes/LODs, rejection exclusion, renderer
lifecycle, actual terrain support below routes, closed shoreline samples, graph
navigation/return focus, editor migration and desktop/touch screenshots.
