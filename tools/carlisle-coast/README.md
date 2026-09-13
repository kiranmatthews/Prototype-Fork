# Carlisle Coast authoring

The source level is `src/levels/carlisle-coast.ts`; `node tools/carlisle-coast/sync.mjs --write` updates only its `test` entry in the published level pack. The campaign keeps the `test-course` progress key.

The city uses the owner's CC0 Quaternius Downtown City MegaKit Standard download. `bake_city.py` preserves the kit's original road shapes, UVs and lane decals, and assembles six additional buildings from its façade modules. `compress_city.mjs` produces Meshopt geometry; `pack_city.py` shares KTX2 textures with portable JPEG/PNG fallbacks. Blender, glTF Transform, Meshoptimizer and Khronos `toktx` are authoring dependencies. The runtime loads the baked files under `public/carlisle-kit/`.

`generate.py` uses the official Meshy CLI's existing local OAuth login and records task IDs before polling. Built-in imagegen references and exact prompts are retained here. The final city uses the firmer Jersey barrier and utility pole plus the Crash-inspired excavator. The two clay studies remain authoring references. Total spending is **75 of the authorized 600 credits**, including those studies. `tasks.json` records the completed jobs; signed responses and original GLBs stay in the ignored `.img2threejs/carlisle-coast/` directory.

Geometry and playability checks run with `node tools/test-carlisle-coast.mjs`. They cover real road seams and bends, open pit bottoms, deck ledges, crate support, camera directions, editor capture, and preservation of locally edited Test Course copies. Use the existing `npm run check:levels` and `npm run build` checks before publishing. The full suite is reserved for an explicit request.

The local `review.html` provides positions and input-driven traversal checks in an iframe. Its **Use source** action removes the local `test` override on that preview origin. **Grind crossing** uses ordinary direction/grind input with feedback to balance the needle; it does not change movement tuning. The optional preview-save button uses a temporary localhost receiver and is not part of the published game. `review.json` records the checked build.

All city modules are available in the editor. Ground tiles use the actual mesh footprint for support; raised work decks have continuous tops and side contact. Building colliders cover their footprints. The renderer batches nearby instances, uses distant geometry and rejects distant city blocks, while collision queries reject distant tiles before entering their BVHs.
