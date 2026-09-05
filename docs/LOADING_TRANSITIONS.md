# Readiness-driven loading transitions

Game-owned transitions now follow this sequence:

1. Fade the departing scene/menu to opaque black.
2. Build and render the Warp vortex behind black, including its real post-processing path.
3. Fade the ready vortex in. Only after that reveal has painted, start loading the destination.
4. Keep the fully revealed vortex visible for at least **two seconds**, and longer while destination assets are pending.
5. Fade back to opaque black, establish the destination camera/pose, compile scene materials and warm the complete world/HUD/post render path.
6. Fade the ready destination in from black. Keep gameplay/input locked until the reveal finishes, then require held controls to return to neutral.

The readiness barrier includes first-run level data, sky art, bonus layers, character attachment/import work, textures and nested GLTF requests, canvas-backed HUD/crate images, saved animation data, fonts and audio fetch/decode. Ocean reflection art is requested before the first visible gameplay frame. Asset owners retain their existing fallback/error behavior: failed optional requests settle rather than creating an endless loading screen.

The two-second dwell also applies to cached loads and reduced-motion mode. Reduced motion keeps the vortex still and shortens the fades; it does not skip asset readiness. Ordinary pause/resume remains immediate and retains its frozen-frame cache.

`src/presentationLoading.ts` owns the sequence and asset barrier. GameFlowUI owns the curtain and input lock; main.ts supplies scene preparation. `window.__game.getLoadingDiagnostics()` exposes the current phase and pending/failed URLs for local debugging. The unit sequence tests use deferred promises and a deterministic clock to verify ordering and both fast/slow paths.
