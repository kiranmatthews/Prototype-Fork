# Jungle Ruins — Sunstone kit

Nine textured models created with [Meshy](https://www.meshy.ai/) from original
references generated with Codex's built-in OpenAI image generation tool.
The supplied game screenshots guided art direction; their model or texture
data is not included. The final plant direction uses five broad leaves/fronds,
simple colour planes, and little surface detail.

| Asset | Triangles | Base colour |
| --- | ---: | ---: |
| Broadleaf | 1,324 | 512² |
| Palm | 1,752 | 512² |
| Fern | 1,718 | 512² |
| Platform | 2,177 | 1024² |
| Wall | 2,057 | 1024² |
| Roofed temple | 6,201 | 1024² |
| Hanging arch | 4,139 | 1024² |
| Fallen log | 1,655 | 1024² |
| Thorn roots | 1,496 | 512² |

`manifest.json` records source and packed SHA-256 hashes, sizes and triangle
counts. The nine GLBs total 3.44 MiB. `sunsoil.jpg` is a separate 1024² generated
trail texture. Packed models use core glTF with one material and one JPEG each;
the full PBR authoring GLBs remain local in `.img2threejs/jungle-kit/`.

The runtime fits models to base-anchored bounds and instances placements in
32 m cells. Plant wind and arch-vine sway share the same deformation in colour
and shadow passes. Stone and leaf surfaces receive animated canopy shade.
The editor builds individual pickable instances and preserves dimensions,
rotation, tint and authored collision settings through save/reload.

The generation ledger and complete prompt sets are in `tools/jungle-kit/`.
Ten Meshy T2 generations at 15 credits each used 150 of the authorized 650
credits: nine selected assets plus one discarded plant study. Verified balance
changed from 676 to 526. Credentials and signed download URLs are not shipped.

Repack: `python3 tools/jungle-kit/pack.py` (Pillow required).
Validate: `npm run check:levels` and `node tools/jungle-kit/playtest.mjs`.
Local browser review: `/tools/jungle-kit/review.html` under Vite.
