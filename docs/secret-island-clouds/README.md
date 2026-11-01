# Secret Island cloud shelf — 1 November 2026

Secret Island is built on one continuous 3D cumulus body. Ten large billows
form the perimeter, with a deep cloud underside and a softly shaped crown
beneath the eight hubs. The sandy outer coastline and rock mesa are removed;
a small planted temple clearing settles into the cloud. Hub positions, route
curves, unlocks, sky and other islands retain their authored behavior.

The same seeded density, baked sunlight and 360p feathered renderer used by
Skystream produces the shelf. One 163×96×173 RGBA density texture occupies
10,828,416 bytes. The volume is 7.5 times its authoring scale, with individual
outer billows roughly 44–54 metres across. Their density and sunlight are
baked together, avoiding transparent seams between separate cloud bodies.
All six volume boundaries are empty. Full geometry and density remain in
every viewing distance and reflection; there is no billboard or mesh LOD.

The cloud crown stays beneath every hub and covers the full perimeter. Its
map-specific light multiplier retains highlight detail and pale route markers
under the existing exposure. Cloud course generation and light defaults are
unchanged. The existing 360p pass composes with ocean opaque reuse while
retaining sharp scene colour/depth. Island architecture, characters and UI
keep the selected render resolution.

Resource checks cover cancelled loading, finite animation, hub crown heights,
continuous perimeter, empty density bounds and exactly-once disposal. Real
GPU tests compare direct and reused ocean composition and recover after an
injected draw failure. Native map review covers the Quagmire pan, four hubs,
normal 720p/CRT, portrait and exit, with zero console errors or PNG requests.
One cloud texture and the cloud render targets release on map exit.

Short alternating whole-game pacing samples at native 1600×1000 stayed around
60 fps both with the 360p pass and with native clouds. These samples hit the
display/frame cap on this shared Mac; they do not establish a universal FPS
claim. The default remains the requested fixed 360p cloud rendering.

Evidence: [browser](browser.json), [production](production.json),
[GPU composition](gpu-composition.json), [native](secret-island-native.png),
[normal](secret-island-normal.png), [portrait](secret-island-portrait.png).

Repeatable checks: `tools/test-map-sky-clouds.mjs`,
`tools/map-sky-clouds-browser.mjs`, `tools/test-map-cloud-ocean-browser.mjs`.
Browser tools use `PLAYWRIGHT_MODULE` for the installed Playwright module.
Map movement, production build/typecheck and release size pass (999,248,084
/ 1,000,000,000 bytes). Packaged lite/native, normal and portrait views pass
with zero console errors. Public verification is recorded in the shared handoff. No full-suite run or published level-pack rewrite.
