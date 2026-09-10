# Procedural milk pickups

All milk uses one upright, rotationally symmetric teardrop with a rounded reservoir and soft tip, following the user's idle-shape reference. There are no slanted or separately shaped base variants. The six gallery examples select different pulse phases and timings on the same geometry. Resting scale remains approximately 0.7 m.

Six relative morph targets provide extension, compression, two tail bends and two travelling-wave components. Their geometry and normal data are shared; each orb owns its own weights, spring state and clock. Release begins compressed and rebounds vertically while remaining upright. Measured world or HUD travel drives extension and a trailing orientation, while acceleration excites ripples. Motion settles back to the upright idle form; idle bobbing does not rotate the droplet. Integration uses bounded substeps and is checked at 30, 60 and 120 Hz.

The opaque, texture-free shader retains creamy wrapped shading and wet highlights. It reads the morphed normals; Three.js applies the same morph targets in the shadow pass. Conservative visual culling accommodates extension beyond the resting envelope. Pickup contact, score, attraction range and reward timing are unchanged. Native pickup-to-pool handoffs copy motion state; retirement/reset clears it. HUD travel is measured in overlay coordinates, avoiding a false velocity spike from a world/screen position change.

`milk-review.html` shows Idle, Crate release and HUD flight modes. `interaction-review.html?playtest&level=jungle-cup` includes Release milk and frame-step controls for the actual pool/collection path. Focused checks are `npm run check:milk` and `node tools/test-character-interactions.mjs`; the full suite remains opt-in.

The live attraction threshold is **TUNER → MILK → Magnet distance (m)** (`milkMagnetRange`): 0–8 m in 0.05 m increments, default 1.75 m. It measures from the current character bounds to the orb centre. Zero disables proximity attraction while retaining contact pickup, including drops from the other player. Already-attracted orbs finish their flight when the value changes. The normal tuner Save/Reset/Defaults paths apply.

The HUD now uses the user's 0–100 milk-bottle PNG frames, with a visual drink animation on rollover (see `MILK_BOTTLE_HUD.md`). Wooden crates remain temporary, awaiting the carton assets.

## Low-altitude material isolation

Milk opts out of level-specific depth fading with `material.userData.levelDepthFade = false`. Jungle’s scenery pass respects that flag. Its pit effect multiplies colour by a world-height fade between Y=-4.2 and Y=-10; attaching that effect to the global milk material made later low-altitude pickups fully black, including Test Course’s row at Z=-1101/Y=-20.7 and drops near its end. This was a shared-material effect leaking across levels, not a missing texture or distance LOD.

The guard covers placed orbs, crate drops, material clones and HUD flights while preserving ordinary fog and the existing milk optics. Scenery retains the pit fade. `tools/test-milk-depth-isolation.mjs` exercises Jungle → Test Course → disposal, including all 69 authored pickups below Y=-10. The local `/milk-distance-review.html?playtest&level=jungle` reproduces that load order and provides lower-section/end warps; it is excluded from the production build.
