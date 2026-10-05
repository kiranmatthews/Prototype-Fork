# Painted menu material pass

Five built-in ImageGen studies preserve the existing screen compositions and explore a Crash 4-inspired material finish:

- [Pause](concepts/pause.webp)
- [Map Level Stats](concepts/level-stats.webp)
- [Map Options](concepts/options.webp)
- [Map Save / Load](concepts/save-load.webp)
- [Map Quit Game](concepts/quit.webp)

The [complete prompt set](prompts.json) records the built-in tool prompts, screenshot edit targets and constraints. The concepts are visual references, not flattened menu backgrounds. Their generated lettering and reward illustrations are not used in the game.

The runtime uses [painted-panel.webp](../../public/ui/menu/painted-panel.webp) (474,406 bytes) and [stone-backdrop.webp](../../public/ui/menu/stone-backdrop.webp) (47,738 bytes), generated separately as empty material assets. WebP encoding preserves their dimensions and the panel's transparent corner pixels. The pair adds approximately 510 KiB and is included in the normal offline manifest. Original PNGs remain in the generating thread's ImageGen library.

The panel is sliced at 12% on each axis. Fixed corner caps remain square as cards resize; the same image and sizing policy serve the DOM and both pre-CRT painters. Thin preview frames, engraved rules, restrained list edges and a quiet collectible grid translate the studies into responsive details. The more elaborate concept borders were reduced to protect the existing text and previews.

The existing Roo PNG atlases, glyph geometry, lighting and focus calibration are unchanged. Earned rewards still use `Level.crystalMesh()`, `Level.gemMesh()`, the medal and Cup factories through the shared renderer. Missing rewards use recessed silhouettes. The authored Home vortex, fixed TV sections, save layout, controls and movement are retained.

Validation evidence is in [verification](verification/): the 26-screen catalogue across eight viewport profiles (286 lite/full layouts, 77 navigation checks), PNG reference-frame verification, and production menu interactions. No full test suite was run. Screenshots in [review](review/) show the actual production rendering, including earned 3D rewards and touch Level Stats.

First browser-rendered playable menu pass: 16m44s after the brief (2026-10-05 12:19:01–12:35:45 UTC). Responsive, font, interaction and deployment review followed.
