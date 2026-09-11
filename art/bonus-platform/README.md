# Stone circle bonus platform

`concept.png` was generated with the built-in image_gen tool using `concept-prompt.txt`, then submitted to Meshy's official authenticated CLI. Meshy task `01a08f91-2a3b-7289-bdac-5aaac05bcb34` completed successfully with smart topology and texturing enabled.

The original GLB is retained in the ignored `.img2threejs/bonus-platform/stone-circle.glb` authoring directory. `tools/bonus-platform/pack.py` reuses the established Meshy packer, retaining mesh topology, UVs and normals while packing one 1024 px base-colour map. The 2,511-triangle runtime model is `public/props/bonus-platform/stone-circle.glb` (512,060 bytes). Its provenance JSON records task, source and packed hashes.

The runtime scales the mesh to 3.2 m diameter and 1.05 m height. The raised top and circular side collision are independent of the decorative stone mesh. See `docs/BONUS_FLOW.md` for jump-entry rules and `tools/bonus-platform/review.html` for the asset preview.
