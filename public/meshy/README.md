# Ancient Stone Courtyard web bake

`ancient-stone-courtyard.glb` is an aggressively compressed presentation-only
bake of the owner-supplied Meshy model used by Unity's `MeshyLookDev` scene.
The project owner explicitly requested this asset in the browser level.

The archived handoff does not record whether it came from a paid/private,
free-plan, or Community generation. This public web copy therefore uses the
conservative free-plan attribution: **Model created with
[Meshy](https://www.meshy.ai/) — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**
That notice can be relaxed if the owner later records paid/private ownership
or Community CC0 provenance.

| Item | SHA-256 |
| --- | --- |
| Unity source `AncientStoneCourtyard.fbx` | `eb26ea6dc5d0ea33a76f064b11033ae825dbead0fa0586ff73d5abf3c6fb48bc` |
| Unity source `AncientStoneCourtyard_BaseColor.png` | `064ca37082d0e08df2aaaec7b1f493946337d9b024538416d359d7bbee6703bd` |
| Web GLB | `820899ca1d314fb56cccc7eeb49caa15d9e9f05fe3e16e5a42ae97ea53b01ebb` |

The bake reduces the source from a 14 MB FBX plus roughly 27 MB of relevant
textures to a 127 KB core-glTF GLB: 1,065 triangles and one embedded 512 px
JPEG base-color map. The GLB is canonicalized to a stable texture name and
single-sided rendering. Normal, metallic and roughness maps are intentionally
replaced with scalar material values. Runtime collision remains in the
source-owned level primitives; this Meshy asset is visual only.

Rebuild with `tools/bake-meshy-courtyard.py` under Blender.
