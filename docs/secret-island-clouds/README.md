# Secret Island volumetric clouds — 1 November 2026

Replace the 24 PNG cloud mattes with 18 drifting, sunlit cumulus volumes, using
the existing Skystream bonus density renderer. Three seeded fields share
10,200,960 bytes of voxel storage across all banks. Padding contains every
visible curl; all six volume boundaries have zero density. There is no
camera-facing plane, geometry replacement or distance-dependent detail change.

The existing 360p cloud pass feathers cloud edges while island geometry,
characters and UI keep their selected resolution. It also composes into the
ocean's reused opaque pass without clearing its colour or depth. Reflections
retain the actual cloud geometry and their existing render settings. No changes
to island geometry, hubs, navigation, progression, sky, map lighting or collision.

Native resource checks verify shared textures, drift, cancelled preparation
and exactly-once disposal. A real GPU test matches direct and reused ocean
composition with zero differing pixels, including 12,579 opaque foreground
pixels; nested draw failures restore state and the next frame recovers.
`test-cloud-path-pass.mjs` and `test-ocean-sizing.mjs` pass. The existing
Skystream bonus also passes lite/native, split-screen, context-loss recovery and
exit checks with zero console errors.

Browser review covers lite and native views of four Secret Island hubs, the
actual pan from Quagmire, normal 720p/CRT, portrait and exit. No console errors
or requests for `cloud-bank.png`. The native pan retains ocean opaque reuse
(38 → 153 draws); leaving the map retires all three density textures and the
cloud render targets. Native 1600×1000 alternating pacing samples on this shared
Mac measured 40.3/43.6 fps with the 360p pass and 33.5/27.0 fps with native clouds.
These are short whole-game observations, not a hardware-independent FPS claim.

The final combined production build and release-size check pass (999,247,741 /
1,000,000,000 bytes). Its native/normal/portrait map smoke also passes after the
latest map-navigation and one-skater-per-island update.

Evidence: [browser.json](browser.json), [production](production.json),
[GPU composition](gpu-composition.json),
[native](secret-island-native.png), [normal](secret-island-normal.png),
[portrait](secret-island-portrait.png).

Repeatable tools: `tools/test-map-sky-clouds.mjs`,
`tools/map-sky-clouds-browser.mjs` and `tools/test-map-cloud-ocean-browser.mjs`.
The browser tools use `PLAYWRIGHT_MODULE` for the installed Playwright module.
No full-suite run; final build and publication are recorded in the shared handoff.
