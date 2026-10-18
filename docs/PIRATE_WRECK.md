# The Drowned Crown

The level now begins at a Port Royal inspired working waterfront: a customs quay, three broken cargo-jetty spans, an optional salvage spar and a boardwalk beneath the coastal fort. The sea gate joins the original smugglers mine, moonpool, giant wreck and royal vault. The complete route has **five jumps and six checkpoints**. The movement tuning is unchanged; the gold/silver/bronze benchmarks are 210/285/390 seconds.

The current WIP ship interior contains an oversized, 16 m deep skate bowl, two elevated catwalk routes, a floor exit and a long return ramp. The timber enclosure and apron use intact, uniformly scaled modules. The latest release evidence is `docs/drowned-crown/takeover-release-check.json`; `tools/drowned-crown/release-smoke.mjs` verifies loading, recovery and interior views in lite, full or 4K rendering.

The local performance candidate bounds the reflected ocean to the harbour and moonpool. The concealed hold uses the existing sheltered-water painting at the same waterline, eliminating reflection/refraction world passes there. In native 1440 × 900 Chrome, the bowl overlook drops from 1,661 to 797 draw calls and the upper catwalk from 1,320 to 664; both move from a 33.3 ms to a 16.7 ms median frame interval. Full 4K recovery and rendering checks pass without console errors or WebGL context loss. Compact evidence is in `docs/drowned-crown/water-performance-check.json`. This candidate remains local under the temporary slow-network rule.

The treasury follow-on places six working lanterns at the walking level, adds a central jewelled hoard behind the crowned arch, and separates warm gold from cool stone. Removing 244 buried coin clusters preserves the pile outlines while reducing the treasury's submitted triangles by 6.5%; earlier distant detail reduces bowl-floor triangles by 11.1%. Native 1440 × 900 review remains at a 16.7 ms median in both views. The route and native 4K recovery review pass; see `docs/drowned-crown/treasury-polish-check.json` for evidence and the four reproduced, unrelated Beachfront atmosphere baseline mismatches. This follow-on also remains local.

## Layout and traversal

The new harbour has real supported land, waterline pilings, a crane foundation and readable takeoff banks. The mine opens onto a lookout before boarding the galleon. The afterdeck is cut back at the boarding seam, so the ramp reaches an open break instead of passing through a floor. The current-main hull, bow-hatch and grotto clearance cuts remain in place. Thin decorative boards follow their ramps but do not compete with the authored support surface.

The captain’s room has enough height for the gallery and a jumping character. Its camera volume is above the main deck, so it does not turn the camera while boarding. Grotto crystals sit clear of the route and camera. The bow retains its physical stays and the native crawl underneath them. In the vault, the framed skull-and-crown arch remains visible above the path, with a painted Caribbean bay beyond it.

## Storyboard and environment kit

[Open the complete storyboard](../public/drowned-crown/storyboard/index.html). The gallery contains **13 original player-view screenshots, 13 imagegen storyboard redraws, and six final game comparisons**: 19 player-view captures in total. The original PNGs are in `docs/drowned-crown/`; compact gallery proxies are published with the game.

The production kit contains 16 Meshy models: warehouse, fort bastion, cargo lighter, limestone wall, stalactite vault, hull panel, stern gallery, ship ribs, cargo stack, brass lantern, naval cannon, treasure hoard, royal portal, chart instruments, mooring frame and coconut palm. Near geometry totals 82,443 triangles; each model has a real 28% distant mesh, one shared atlas material and measured placement bounds. Original high-mesh UVs are retained. Large architecture keeps 2K albedo; smaller props use 1K, with 512px data maps.

Built-in imagegen also supplied the dusk sky, transparent harbour skyline, cavern-depth matte, exit-bay matte, and timber, limestone, sailcloth and coin surfaces. The scoped water shader uses these local paintings for reflections; it changes shading, not the waterline or collision. The shared scenery loader owns the model cache, distance meshes and physical geometry. The new boardwalk palette preserves the existing aged/frozen palettes for other levels.

The kit consumed **435 existing Meshy credits**, including rejected geometry/material drafts. No credits were purchased and no plan was upgraded. Two unused draft modules are excluded from the game download. Job IDs, prompts, hashes, triangle counts, dimensions and texture sizes are recorded under `tools/drowned-crown/`; runtime model provenance is `public/drowned-crown/provenance.json`. Credentials and signed provider responses remain outside the committed/public files.

## Reproduction and evidence

- `tools/drowned-crown/meshy_jobs.py` uses the existing official Meshy CLI adapter, stable operation IDs and a reservation ledger. Recorded jobs are never blindly resubmitted.
- `prepare_models.py` runs in Blender to preserve materials/UVs and create distance meshes. `pack_models.py` compacts textures and emits the measured model registry.
- `validate_assets.py` checks hashes, finite geometry, indices, UVs, atlas presence, distance-mesh budgets, alpha preservation and exact recorded credits.
- `tools/drowned-crown/profile.mjs <preview-url> --out=<local-directory>` measures seven views, verifies zero hidden-ocean passes inside, checks that exterior water resumes on return, and saves small JPEG previews locally. `--only=bowl-overlook` selects one view; `--treasury` selects five supported treasury viewpoints; `--lite` selects the lightweight renderer. `--levels=<local-pack.json>` provides an isolated snapshot comparison. Set `PLAYWRIGHT_MODULE` when using an external installed Playwright runtime.
- `tools/drowned-crown/check-loading.mjs <preview-url> --out=<local-directory>` measures a cold launch and two covered round trips through the small Sky level. It asserts stable live GL textures/buffers, decoded bitmaps, geometries and shader counts on repeated visits, with no missing assets or context loss. Add `--lite` for the lightweight renderer. `test-asset-lifetime.mjs` verifies exact source-image and material-mapping identity before any shared atlas is allowed.
- `tools/drowned-crown/check-treasury.mjs` verifies that lantern flames clear their posts, treasury lighting stays stable during jumps and restores outside, and the local release snapshot matches the source.
- `check-route.mjs` runs the real Player continuously through the source level, verifies six checkpoints and finish without deaths, and verifies that reflection images retire with the level.
- `pirate-wreck-browser.mjs` runs ordinary movement, jump, spin and crawl inputs in Chrome with the scenery loaded first. Lite and full-render journeys reached the finish with six checkpoints and no deaths or console errors.
- `browser-safety.mjs` separately verifies supported spawn, actual water death and automatic respawn, banked-checkpoint respawn and solid mast collision in Chrome.
- `test-pirate-wreck-safety.mjs` checks the mine cache, captain’s room and powder-room jewel as well as recovery and collision. `test-pirate-clearance.mjs` retains 24 independent body-sweep checks through real openings.
- Required focused level checks and a production build are run before publishing. The full suite is not part of this brief.

First source geometry run from the new harbour through the vault: **7.5 minutes** after the prompt (03:15:35–03:23:03 UTC, 13 October 2026). Storyboard generation, asset production, art review, current-main integration and release validation followed. The original October 3 wreck iteration remains recorded in `docs/LEVEL_ITERATIONS.md`.
