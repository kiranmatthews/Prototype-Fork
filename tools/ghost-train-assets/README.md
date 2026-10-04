# Haunted castle ghost train assets

These five original models were requested for the browser prototype's indoor
haunted castle ghost train. They are Meshy T2 Smart Topology text generations,
with authored game-specific geometry and texture prompts in `prompts.json`.
They evoke a theatrical haunted attraction without copying a film asset.

The official Meshy CLI owns authentication, transport and task journaling.
`meshy_jobs.py` uses the existing adapter in `tools/enemies/meshy_assets.py`;
`tasks.json` reserves a stable operation before each submission, records task
IDs and final provider credit usage, and never contains an API key. All
expiring signed URLs and full authoring outputs stay in ignored
`.img2threejs/ghost-train/`.

```sh
python3 tools/ghost-train-assets/meshy_jobs.py preview castle-arch
python3 tools/ghost-train-assets/meshy_jobs.py status castle-arch
python3 tools/ghost-train-assets/meshy_jobs.py refine castle-arch
python3 tools/ghost-train-assets/meshy_jobs.py download castle-arch-textured
python3 tools/ghost-train-assets/pack_assets.py all
python3 tools/ghost-train-assets/segment_knight.py
```

The initial five preview/texture pairs consumed 75 existing credits in total.
A corrected roofless cart pair adds 15 credits, for 90 credits total. No
purchases, upgrades, paid subscriptions, or new authentication were required.
The selected preview face targets sum to 17,200 triangles. Shipping texture packing
uses one 512 px JPEG base-color atlas per asset with scalar material values.
`asset-manifest.json` records measured counts, bounds and SHA-256 hashes.

Geometry is normalized to Y-up and +Z-forward, ground Y=0, centered X/Z, with
the largest dimension equal to one. The GLB assets are visuals; source-owned
level primitives and runtime obstacles provide collision and movement.

`segment_knight.py` partitions the measured static armor into twelve rigid
named mesh regions while preserving every textured triangle and the entire
rest silhouette. The glTF root extras contain `ghostTrainRig.pivots` and
measured region bounds in normalized source coordinates. Region POSITION
attributes remain in source world coordinates; animation wrappers subtract
their model-specific joint pivot before parenting to the joint hierarchy.
The cape stays with the breastplate/backplate segment.
