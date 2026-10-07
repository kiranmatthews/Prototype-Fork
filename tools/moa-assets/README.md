# Meshy cartoon moa and steaming roast

The visible bird and cooked chicken are Meshy T2 Smart Topology surfaces. The
bird is 7,675 triangles, four material draws and a 768 px painted atlas; the
chicken is 2,202 triangles with a 512 px atlas. The living bird remains about
4.3 m tall. Provider task IDs, reference hashes and packed-file hashes are in
`tasks.json`, `prepared.json` and `public/enemies/manifest.json`.

Both references were made with the built-in **image_gen** tool, in generate
mode. Final reference files are `references/moa.png` and
`references/roast-chicken.png`; their complete prompts are in
`design-prompts.json`. The Meshy jobs consumed 15 credits each, 30 total.

The original moa controls remain the animation driver. `original-motion.json`
locks all 429 sampled frames of the walk, idle, squawk, wind-up, peck and recovery
using the original seven main control matrices. The new skin uses 22 independent
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
Blender --background --python tools/moa-assets/prepare.py
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
new editor thumbnail is `public/enemies/icons/moa-meshy.png`.

A defeated moa turns into a harmless roast at its current location. It has a
short finite settling motion and continuously emits the existing steam effect.
The killing spin is identified by its existing attack token, so it cannot erase
the roast. A later spin removes the food and stops the emitter. Touching it does
not collect it; it does not add a second takedown score. Normal level resets
restore the moa, and disposal releases shared surfaces, textures and skeletons.
