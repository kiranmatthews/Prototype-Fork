# Warehouse / Five Lines art production

The image target is [arrival-target.png](../../docs/warehouse-art/arrival-target.png).
It preserves the existing skate layout while combining the industrial wear and
daylight of Tony Hawk's Pro Skater 1+2 with Crash Bandicoot 4's readable shapes
and controlled color. It is concept art, not a gameplay screenshot.

The built-in ImageGen tool produced that target, eleven isolated model
references, and the original four-piece graffiti atlas. All final prompts are
in [image-prompts.json](image-prompts.json); the input images are in `references/`.

## Meshy budget and source geometry

Eleven textured Meshy T2 jobs consumed **165 of the authorized 200 credits**.
No credits were purchased. [tasks.json](tasks.json) records each provider task,
actual charge, reference hash and downloaded source hash. Temporary provider
responses and signed URLs stay in the ignored `.img2threejs/warehouse-art`
authoring cache. Authentication remains with the existing official Meshy CLI.

The kit contains broken factory windows, a crane hoist, fluorescent fixtures,
utility pipes, loading shutters, cabinets, dumpsters, ventilation fans,
collectible medals, crumbling plaster and bell-shade work lights. The runtime
also reuses the existing Meshy bathhouse rubbish and boiler, classic wooden
crate, and Blockworks hanging ivy.

`pack_assets.py` fits the actual meshes into metres and preserves their original
surfaces and UVs. `bake_contacts.py` derives texture-independent contacts from
the accepted geometry and regenerates the measured asset sizes. Each solid
decor component owns both its model and contact transform; moving or resizing
it cannot strand a separate collision box. The existing exact scenery contact
and camera-clearance system handles those contacts.

## Materials and GPU format

Large surfaces use downloaded Poly Haven CC0 scans. No generated or
procedurally painted texture tiles are used for the warehouse's large surfaces.

- [Concrete Floor Worn 001](https://polyhaven.com/a/concrete_floor_worn_001)
- [Red Brick 03](https://polyhaven.com/a/red_brick_03)
- [Rusty Metal 04](https://polyhaven.com/a/rusty_metal_04)
- [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate)
- [Plywood](https://polyhaven.com/a/plywood)
- [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02), used for localized staining

Source URLs, licenses and hashes are retained in
`public/warehouse/materials/provenance.json`. Surface color maps retain 2K
resolution, model color maps use 1K, and normal/packed data maps use 512 pixels.
`compress_gpu.py` uses the project's Khronos pipeline: high-quality ETC1S for
opaque color/data, UASTC for normal maps and transparent graffiti, with complete
mip chains. Standalone maps use lower-left orientation; glTF maps preserve
their source orientation. The original maps and uncompressed GLBs remain in
the ignored authoring cache. Runtime files require the shared KTX2 decoder,
which uses one worker and retires its idle WASM heap.

The art owner shares active model leases and releases model GPU resources when
the final owner leaves. Puddles share one 512×384 planar reflection for the
visible floor height; other heights retain the bounded static environment
probe. Four local lights serve the fixtures. Native collision, camera input,
movement tuning and the five-token objective remain authoritative.

## Reproduction and validation

Use the existing authenticated adapter, never a second submission/polling loop:

```sh
python3 tools/warehouse-assets/meshy_jobs.py status
python3 tools/warehouse-assets/meshy_jobs.py download
python3 tools/warehouse-assets/pack_assets.py
python3 tools/warehouse-assets/fetch_materials.py
python3 tools/warehouse-assets/compress_gpu.py
python3 tools/warehouse-assets/bake_contacts.py
```

`WAREHOUSE_TOKTX` may select the installed Khronos `toktx` binary. Existing task
names are idempotent reservations; do not create replacement jobs merely
because a status request times out.

Focused checks are `test-warehouse-art.mjs`, `test-warehouse-collision.mjs`,
`test-warehouse.mjs`, `warehouse-flow.mjs`, `test-warehouse-art-browser.mjs`,
`test-warehouse-browser.mjs`, and `test-warehouse-replay-browser.mjs`.
`profile-warehouse-art.mjs` captures six real gameplay views and frame timing;
set `WAREHOUSE_NATIVE=1` for native device resolution. The normal repository
requirements also include `check:levels`, `build`, and live deployment review.
Do not substitute the generated reference images for rendered game evidence.

Provider references: [Meshy API pricing](https://docs.meshy.ai/en/api/pricing),
[Meshy image-to-3D](https://docs.meshy.ai/en/api/image-to-3d), and
[Poly Haven's CC0 license](https://polyhaven.com/license).
