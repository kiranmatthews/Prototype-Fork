# Temple of Embers tiki asset

A new environment prop for the merged Temple Terraces / Temple Skyline course.
The built-in ImageGen reference is saved in
`tools/temple-night-assets/references/tiki-head.png`; its production prompt is
`tools/temple-night-assets/prompt.txt`.

The official Meshy CLI generated task `01a1332a-aca0-75aa-803b-31669bae593e`
using 15 existing credits. `tiki-head.glb` retains the generated geometry and UVs
(6,024 triangles). The 2K albedo and 1K material atlases use JPEG encoding;
`tiki-head-manifest.json` records source/final SHA-256 and byte budgets.
Runtime normalization fits the static head to 2.8 × 3 × 2.4 metres.

The game supplies the moving flame, warning glow, torch crown, rotation and
collision. This is a static environment prop, with no character rig, animation
retargeting, frontend credentials or signed provider URLs. The original GLB
and provider download responses remain in the ignored authoring directory.

All forest models are existing Treehouse Trails/Trials assets; this task
introduces no additional tree models.
