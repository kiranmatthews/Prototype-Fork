# Meshy cartoon moa and steaming roast

The visible bird and cooked chicken are Meshy T2 Smart Topology surfaces. The
bird is 7,672 triangles, five material draws, clean vertex colours and a
lossless 1,024 px face atlas; the
chicken is 2,202 triangles with a 512 px atlas. The living bird remains about
4.3 m tall. Provider task IDs, reference hashes and packed-file hashes are in
`tasks.json`, `prepared.json` and `public/enemies/manifest.json`.

Both references were made with the built-in **image_gen** tool, in generate
mode. Final reference files are `references/moa.png` and
`references/roast-chicken.png`; their complete prompts are in
`design-prompts.json`. The Meshy jobs consumed 15 credits each, 30 total.

The original moa controls remain the animation driver, with the refined
`MOA_BOUNCE` layer adding volume-preserving footfall compression, extension,
delayed head/rump follow, a stronger peck anticipation and finite rebound.
`pre-bounce-contact.json` locks all 429 foot-path samples and the active peck
targets; the actor root, patrol speed, damage window and contacts are unchanged.
`original-motion.json` retains the historical pre-polish control capture. The new skin uses 22 independent
bindings, including eight neck stations. Shared elasticity and the actual sole
contacts remain active. The lower bill is split from the generated mesh along
its anatomical seam, closed with an interior material, and follows the original
jaw hinge. The hooked upper tip stays on the head. The old guide surfaces are
hidden and never substitute for failed Meshy loading.

`prepare.py` retains generated UVs and detail, fits each anatomical region to the
existing controls, writes normalized skin weights, and packs the final GLBs.
Run it through Blender after downloading the original provider files. Those raw
files and signed API responses remain in ignored `.img2threejs/moa/`. No new auto
walk or humanoid retargeting is used. `capture-motion.mjs` is an authoring capture,
not a command to regenerate the baseline when a regression fails.

```sh
python3 tools/moa-assets/meshy_jobs.py status moa
python3 tools/moa-assets/meshy_jobs.py download moa
python3 tools/moa-assets/meshy_jobs.py download roast-chicken
Blender --background --python tools/moa-assets/prepare.py -- --moa-only
node tools/test-moa.mjs
node tools/test-moa-browser.mjs http://127.0.0.1:5291/
```

The recording is **Caw.ogg** by egomassive, derived from **crow.wav** by Nigel
Coop, both CC0. The public preview is trimmed into two calls matching the existing
1.14 s audio window, plus a short peck croak. `prepare-caw.py` consumes a decoded
mono WAV of that recording. The shipped files are `public/sfx/moa-caw.wav` and
`public/sfx/moa-caw-peck.wav`; their source links, changes and hashes are in
`public/sfx/moa-caw-license.json`. The normal SFX volume, mute, pitch variance and
distance attenuation apply. New filenames avoid cached synthetic audio. The
new editor thumbnail is `public/enemies/icons/moa-clean.png`.

A defeated moa turns into a harmless roast at its current location. It has a
short finite settling motion and continuously emits the existing steam effect.
The killing spin is identified by its existing attack token, so it cannot erase
the roast. A later spin removes the food and stops the emitter. Touching it does
not collect it; it does not add a second takedown score. Normal level resets
restore the moa, and disposal releases shared surfaces, textures and skeletons.

## Living-moa material refinement

`clean_materials.py` gives the feathers, neck and legs broad, stable vertex
colours, preserving the claws and warm chest tones. Original 2k face detail is
repacked into a dense 1k atlas with 12 px padding and saved losslessly. It uses
anisotropic filtering in game. This removes the reduced JPEG's softness and
keeps neck/feather colour from smearing when stretched. The GLB writer explicitly
writes linear `COLOR_0` values for the coloured primitive because the mixed
textured/vertex-colour Blender export otherwise lost the palette. Validation
also removes three duplicate inner-bill triangles.

The active living asset is `public/enemies/moa-clean.glb`; the earlier Meshy
asset remains available to old builds. The cooked chicken GLB, texture, settling
motion, steam and spin-away behavior are unchanged. Use `--moa-only` when
regenerating this refinement. No new Meshy jobs or reference images are needed.
