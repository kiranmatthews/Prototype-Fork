# Procedural milk pickups

All milk uses one upright, rotationally symmetric teardrop with a rounded reservoir and soft tip, following the user's idle-shape reference. There are no slanted or separately shaped base variants. The six gallery examples select different pulse phases and timings on the same geometry. Resting scale remains approximately 0.7 m.

Six relative morph targets provide extension, compression, two tail bends and two travelling-wave components. Their geometry and normal data are shared; each orb owns its own weights, spring state and clock. Release begins compressed and rebounds vertically while remaining upright. Measured world or HUD travel drives extension and a trailing orientation, while acceleration excites ripples. Motion settles back to the upright idle form; idle bobbing does not rotate the droplet. Integration uses bounded substeps and is checked at 30, 60 and 120 Hz.

The opaque, texture-free shader retains creamy wrapped shading and wet highlights. It reads the morphed normals; Three.js applies the same morph targets in the shadow pass. Conservative visual culling accommodates extension beyond the resting envelope. Pickup contact, score, attraction range and reward timing are unchanged. Native pickup-to-pool handoffs copy motion state; retirement/reset clears it. HUD travel is measured in overlay coordinates, avoiding a false velocity spike from a world/screen position change.

`milk-review.html` shows Idle, Crate release and HUD flight modes. `interaction-review.html?playtest&level=jungle-cup` includes Release milk and frame-step controls for the actual pool/collection path. Focused checks are `npm run check:milk` and `node tools/test-character-interactions.mjs`; the full suite remains opt-in.

The live attraction threshold is **TUNER → MILK → Magnet distance (m)** (`milkMagnetRange`): 0–8 m in 0.05 m increments, default 1.75 m. It measures from the current character bounds to the orb centre. Zero disables proximity attraction while retaining contact pickup, including drops from the other player. Already-attracted orbs finish their flight when the value changes. The normal tuner Save/Reset/Defaults paths apply.

The current fruit HUD icon and wooden crates remain temporary, awaiting the user's bottle and carton assets.
