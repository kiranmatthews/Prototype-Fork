# Haunted castle kit — original Meshy assets

Nine original Meshy T2 Smart Topology geometry/texture pairs were generated for
the haunted castle ghost train rework. The fixed generation prompts and target
dimensions are in `prompts.json`. The official pinned Meshy CLI 0.3.1 owns
authentication and submission journaling; `meshy_jobs.py` records each stable
operation before submitting it. Credentials and expiring URLs remain outside
shipping assets, in the saved CLI profile and ignored authoring responses.

The nine preview requests cost 45 credits and nine texture refinements cost
90 credits. One authorized Meshy Retexture request added the table's burgundy
and gold finish for 10 credits. **Total: 145 existing credits.** No purchases,
upgrades, or new login were needed. The final account balance was 1,226.

`table-retexture-validation.json` verifies identical positions, triangle
indices and UV coordinates before and after the texture-only pass. Normal
differences are at most 1.2e-7 from provider floating-point renormalization.

Shipping GLBs are self-contained, Y-up, +Z-facing, centred in X/Z, with the
bottom at Y=0 and the largest dimension equal to one. Original UVs and Meshy
textures are preserved. Hero wall/window, table, portal and cart atlases are
1024 px; smaller axe, chandelier, trestle and clock atlases are 512 px. The
flagstone atlas is 1024 px for material extraction. `asset-manifest.json` and
adjacent public provenance files record bounds, transformations, hashes and
triangle counts. Generated geometry proportions are authoritative; target
metre dimensions are briefs, not guarantees of the provider's proportions.

`placement.json` records the measured table top, rail support top, chandelier
hook, portal aperture, original cart floor and wheel cap measurements, face
attachment bounds, and mechanical part pivots. The portal's projected clear
floor-based rectangle is 0.37378 wide and 0.49706 high in normalized units;
at scale 9 this is approximately 3.364 × 4.474 metres. Its mouth remains open
through the complete model, including the deep side wings.

The axe's generated grip is removed by dropping triangles whose vertices
cross below source Y=-0.10. The additional rear upright on the generated cart
is removed. The floor panel is rigidly rotated onto the horizontal plane.
These operations retain original selected triangle UVs and material pixels.
The clock's main gear originally faced -X; a rigid quarter turn presents it
toward +Z. Five named rigid regions preserve all 4,478 textured triangles.
Their vertices remain in normalized source world coordinates; pivot wrappers
subtract the root `ghostClockworkRig.pivots` point when parenting each region.

`demon-cart-face-v2.glb` extracts 1,396 actual textured Meshy triangles for the
existing open Meshy cart body. The complete generated cart had locomotive
proportions; its face is reused without stretching that body. The original
open cart's interior floor is at normalized Y=0.221.

The standalone stone, flagstone and oak maps come exclusively from actual
Meshy-generated albedo through original UV coordinates. `measure_assets.py`
reprojects the surfaces and selects plain stone and oak regions; it does not
paint new content. `texture-provenance.json` records source models, UV bounds,
cropping and pixel hashes. The full window projection is retained separately
from the pure stone column crop. Timber comes from the original plain-oak
table underside, before its red tabletop Retexture pass. ImageGen chamber
mockups are visual direction documents; they are not final material maps.

```sh
python3 tools/ghost-train-assets-v2/meshy_jobs.py status all --textured
python3 tools/ghost-train-assets-v2/meshy_jobs.py download all --textured
python3 tools/ghost-train-assets-v2/pack_assets.py all
python3 tools/ghost-train-assets-v2/measure_assets.py
python3 tools/ghost-train-assets-v2/rigid_regions.py
python3 tools/ghost-train-assets-v2/emissive_regions.py
node tools/ghost-train-assets-v2/capture_proof.mjs
```

Use the bundled Python with NumPy/Pillow for packing and measurements. The
packing step chooses the successful texture-only table result when available.
Original authoring GLBs and full-resolution atlases stay in ignored
`.img2threejs/ghost-train-v2/`. `proof/` contains small standalone model images;
these are model review evidence. Actual gameplay camera evidence is produced
by `tools/ghost-train-v2-browser.mjs`.

The window bay has detailed window facades on both +Z and -Z; its ±X side
walls are plain. Wall-mounted bays therefore turn ±90 degrees toward the
aisle. `emissive-regions.json` records the 31 actual dark pane triangles in
`WindowGlass` and 16 painted green iris triangles in `PortalEyes`. The GLBs
give those regions named materials while retaining original albedo and UVs;
runtime emission can affect those surfaces without lighting stone or moss.

Models created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Conservative
attribution is retained because account subscription ownership was not
separately recorded during the authoring task.
