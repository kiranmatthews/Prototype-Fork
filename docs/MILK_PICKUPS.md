# Procedural milk pickups — first asset pass

`src/milk.ts` supplies six original procedural silhouettes: Drip, Hook, Leaning drop, Teardrop, Swoosh and Soft splash. The original egg-like ellipsoids have been reshaped into broad lower bulbs with narrow pulled necks and curved tips. Each is a smooth, closed surface with 1,472 triangles. Geometry and materials are shared across instances. The full animated silhouette fits the existing 0.7 m pickup envelope; the gentle stretch varies in phase between shapes.

The opaque shader uses cool wrapped body shading, a cream-white lit region, broad wet highlights and a soft rim. It needs no textures, environment-map download, transmission pass or external model. Normal correction follows the stretch; directional shadow depth uses the same deformation. Native fog, material opacity and the existing renderer output conversion remain available.

World pickups and crate reward/collection-flight bodies now use milk. Native pickups cycle deterministically through the six shapes. The magnet clone and HUD flight preserve the source shape. Existing collection accounting, attraction, sounds and data IDs are retained for this first visual pass. The fruit HUD icon and wooden crates remain temporary, awaiting the user's bottle and carton assets; the bottle-fill UI is a later task.

Open `milk-review.html` for the six-shape turntable, rotation toggle and dark/light backdrops. It uses the same geometry and material as the game. `npm run check:milk` checks closed topology, smooth normals, distinct surfaces, size including deformation, shared resources and material cloning. In-game magnet/contact/HUD behavior is also covered by the existing character interaction suite.
