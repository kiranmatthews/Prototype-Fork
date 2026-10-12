# Shared crusher and pendulum models

Every `crusher` now uses the existing textured [Meshy boulder](../../public/custard-creek/moss-boulder.glb). Explicit authored scenery skins still work. Every generic `pendulum` uses the new [iron weight](../../public/hazards/iron-weight.glb) and [chain link](../../public/hazards/iron-link.glb). Ghost Train's Meshy execution axes keep their own skin.

The weight is 3,600 triangles nearby and 900 at distance. Each instanced chain link is 320 / 96 triangles. The original 2K weight albedo and 1K normal map retain the detail; links use a 1K albedo. Typical chains have 9–10 links; the pirate level's 16 m pendulum has 38. Each chain takes one draw call, with a separate draw for the weight. Hitboxes, phase, speed, amplitude, pivot and crusher timing are unchanged.

Original built-in ImageGen references: [weight](references/iron-weight.png), [link](references/iron-link.png). The complete final prompts and saved output paths are in [prompts.json](prompts.json). Meshy task IDs, source hashes and costs are in the two `*-task.json` ledgers. Two models cost 30 Meshy credits total; the crusher reuses the already-generated asset.

Reproduce with the official Meshy CLI selected by `MESHY_CLI`: run `generate.py iron-weight iron-link`, then Blender in background mode with `prepare.py -- iron-weight iron-link`, then `pack.py iron-weight iron-link`. The operation ledger prevents duplicate generation on resume. Raw downloads and signed responses stay in ignored `.img2threejs/hazards/`.

Runtime: [hazardVisuals.ts](../../src/hazardVisuals.ts). Assets share the established scenery cache, use automatic near/far LODs, keep visible fallbacks during loading and release their leases with the level. Their meshes explicitly opt out of scenery collision.

Verification: `review.mjs` checks all source-authored hazard variants, collider alignment at four swing phases/yaws, separate axe skins and asset disposal in Chrome. `smoke.mjs` runs full-render player-camera checks in Carlisle Coast, Custard Creek and Drowned Crown. Evidence is in [docs/hazard-review](../../docs/hazard-review/).
