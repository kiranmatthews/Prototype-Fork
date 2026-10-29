# Carlisle shipyard prop library

Open the local workshop at <http://127.0.0.1:5483/art/carlisle-shipyard/viewer.html>.

Completed: **12 textured GLBs**, 1,644–5,807 triangles each (43,646 total), plus the procedural net and fitted assembly. All 12 generation tasks billed 50 credits each: **600 API credits total**, with **180 remaining**. Native browser and export round-trip checks pass with no console or resource errors.

The library uses navy painted steel, orange fittings and rope, salt-worn timber and broad platformer silhouettes. It is outside `public/` and the published game pack. The original greybox, physics and cameras are unchanged.

- `models.json` indexes the generated assets, actual triangle counts, bounding dimensions, embedded 2048-pixel PBR textures, task IDs, billed credits and preview review records.
- `tripo-out/` preserves the official CLI's original GLBs and previews. Each `models/<id>/result.json` records the exact command and completed result.
- `CREDIT_LEDGER.md` lists every paid task and its actual charge. `tripo-plan.json` preserves the validated batch plan; `approval.json` records the user's authorization.
- `marine-net.mjs` creates an open diamond rope bed with fixed perimeter and a named `compression` morph on both diagonal rope meshes. This is a visual asset, with no physics or collision code.
- `procedural-marine-net.glb` is the standalone 6 × 4 metre rope bed, including compression morphs (4,152 triangles).
- `net-housing-assembly.glb` combines the original generated housing with a fitted procedural rope bed. Housing geometry and textures are preserved; this is a separate assembly export (3,376 triangles).
- `review/` contains native front/back renders and browser QA. The workshop also provides wireframe, studio/early-night lighting and compression controls.

The standalone procedural net uses three meshes/materials: two rope directions and one fixed perimeter. The fitted housing assembly uses the generated housing plus these three meshes. `setCompression(0..1)` changes only the visual bed; drive it from the existing trampoline event when integrating later, without replacing bounce physics.

Imagegen references and the 20 area paintovers are in `docs/carlisle-relay/shipyard-polish/`. The art-direction README there maps this kit to every course area and records integration constraints.
