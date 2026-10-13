# Custard Creek — the approved pool rebuilt in 3D

The approved `waterfall-pool-v4.webp` composition is now represented by two
closed sandstone banks, nine cliff instances, a curved pool and river bend,
a submerged bed, shoreline stones, rooted willows and trailing foliage.
The finale contains no scenery cards or mist. The reference image remains
available as concept art; its level placement has been removed.

The playable bank still ends at station 2438, seven metres before the waterfall
crest. The cascade now physically meets the downstream water at Y = −28.
The pool uses the existing animated stream material, with transparent water,
moving normals, stone-contact ripples, Fresnel and a cached reflection probe.
All added banks and props are background scenery, with no new walkable route.

Two new assets were generated with the official Meshy CLI from built-in
OpenAI imagegen references, using **30 of the 150 approved credits**:

| Asset | Near / far triangles | Web size | Reference and prompt |
| --- | --- | --- | --- |
| `public/custard-creek/gorge-cliff.glb` | 6,452 / 1,800 | 1,390,944 bytes | `tools/custard-assets/gorge-cliff-prompt.json` |
| `public/custard-creek/cliff-foliage.glb` | 5,873 / 1,761 | 1,695,124 bytes | `tools/custard-assets/cliff-foliage-prompt.json` |

The original Meshy geometry and UVs are retained, with shared 2K albedo and
1K normal maps. The foliage has authored wind weights that pin the upper
attachment. Both assets use the existing instanced, streamed scenery/LOD
pipeline. Source references, public task ledgers and hashes are retained in
`tools/custard-assets`; no private API responses or signed URLs are published.

Validation includes level checks, a production build, source/snapshot and
gameplay-preservation audits, closed-bank winding/volume checks, and full
render player/side views. A real browser pool fall entered water at −28,
sank to −30.72 and respawned with one death. The lite finish-pad test reached
the Custard Creek course-clear screen. See `verification.json`.

- `player.jpg`: actual full-render player camera at the brink.
- `left.jpg`, `right.jpg`: developer camera views demonstrating the geometry.
- `finish.jpg`: lite-render finish-pad smoke test.

Implementation: `src/levels/custard-finale.ts`, integrated by
`src/levels/custard-valley.ts`. No movement tuning was changed.
