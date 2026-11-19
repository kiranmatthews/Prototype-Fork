# Cargo Roo

Open **Cargo Roo.blend** in Blender. The selected armature, **Cargo Roo • Bone Man**, uses the measured player joints. The 23 skinned meshes contain 74,328 quads. The game draws 148,656 triangles. Both 2048 × 2048 images are packed into the Blender file and the GLB.

## Animate

In Object Properties, open the armature’s **Custom Properties**. Its 19 facial controls are keyable from zero to one. Each eyelid, squint, wide eye and eyebrow has left and right controls. The eyes can look in four directions. The mouth has jaw opening, a pucker, a shared smile and independent smile corners. Two additional sliders swing the ponytails. The editable mesh shape keys carry the surface deformation and the lashes follow the lids through closure.

Select the armature in the Action Editor to preview **Face | Glance, wink and grin** at 24 fps. The same file has five sampled player actions for idle, run, jump, crawl and ollie. The browser GLB holds the rest skin and morph targets. Its player obtains the current pose directly from the live Bone Man hierarchy, including finger curls and segment stretch.

In the game, open **Character Lab → Character appearance → Cargo Roo**. Wink, Smile and Surprise preview the controls. Closing the lab restores live expressions. The character choice persists across reloads.

## Art construction

The supplied illustration sets the silhouette, palette, facial proportions and costume. The supplied Kling loop and three related facial clips informed the wink, asymmetric brows, side glance and opening smile. Two built-in ImageGen edits provided construction views. The head study requested a neutral front and right profile on the same scale, retaining the violet eyes, eyeliner, cream muzzle, gold hair and pointed ears. The turnaround requested a front and rear orthographic with the same proportions, lilac cargo pants, pockets, trimmed tank, sneakers and jewelry. Those retained images are inputs to the pigment bake.

The quad forms, jaw seam, corneal surfaces, lash strips, layered hair locks, pockets, shoes, hands and skin weights are authored in the accompanying scripts. Normal relief and surface roughness distinguish the hair, cornea, cloth, jewelry, sole and leather. Individual construction islands are named vertex groups in Blender.

## Rebuild and verify

Run these from the repository root with Node dependencies installed, Python with NumPy and Pillow, Blender 5.2 and Chrome. Use a scratch directory for intermediate geometry, sampled actions and review images.

1. Run `node tools/cargo-rider/measure-rig.mjs` to regenerate the bind measurements from the current player.
2. Run `python3 tools/cargo-rider/sculpt.py /tmp/cargo-roo` to make the quad surfaces and two texture atlases.
3. Start the project’s Vite dev server. Run `node tools/cargo-rider/audit.mjs http://localhost:5173 /tmp/cargo-roo` against the checked-in GLB to capture the current native actions. The runner uses the Playwright package or the module in `PLAYWRIGHT_MODULE`.
4. Run `blender --background --factory-startup --python-exit-code 1 --python tools/cargo-rider/blender_export.py -- /tmp/cargo-roo /tmp/cargo-roo/renders`. This writes the packed source, game GLB and HUD portrait and renders five views.
5. Rerun the motion audit on the export. It samples the gameplay, starter and Studio clips, both skating stances, a two-metre detached wrist and a full-geometry spin capture. To exercise the real picker, reload persistence and three render modes against a running game, run `node tools/cargo-rider/playtest.mjs http://localhost:5173 /tmp/cargo-roo/playtest`.
