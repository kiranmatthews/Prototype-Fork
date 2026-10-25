# World fog and HUD pickup isolation

The height-fog shader ran outside Three.js's USE_FOG guard. Crates and fruit share materials with their world models, so rendering them in a fog-free HUD scene still applied rooftop atmospheric uniforms to coordinates near the origin. They became fully fog-colored.

The custom varying, density function and extinction are now gated by the renderer's per-pass USE_FOG flag. Both a scene without fog and a material opting out bypass height fog. Returning the same material to the world restores normal haze. The authored density, contour, ordinary distance fog and geometry are unchanged.

Validation:

- The GPU test failed before the fix: HUD extinction was 1.0 despite a fog-free scene. It now reads 0.0, while world extinction remains 1.0 in the deliberately buried fixture. Material opt-out and world resume also pass.
- Eight continuous height-fog ray fixtures still match independent numerical volume integration within 0.006.
- The real Player fruit pool was drawn at three points of a HUD flight. Every pixel matches the reference with height fog disabled; orange body highlights remain visible.
- The shared native Meshy wood-crate material also matches its fog-free reference exactly in an icon scene.
- Real roof crates sampled near the start, middle and end retain their painted texture. Their near-view fog differences are below 3% of the fully buried reference.
- Lite and native 2560x1440 Chrome passes and CRT capture have zero console errors. Bonus entry remains dry and has no rooftop height-fog profile.
- The existing shared-material ownership, suspend/resume and disposal regression passes.

The screenshot holds one real collected fruit for inspection. The tests do not change saved player progress or the user's open tab.

Production build/type-check and release-size validation pass: 999,470,763 bytes.
