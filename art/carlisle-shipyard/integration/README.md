# Carlisle Coast — playable shipyard integration

Local only. Play `http://127.0.0.1:5483/?playtest&level=carlisle-coast`. The comparison gallery at `/docs/carlisle-relay/shipyard-polish/index.html` now switches between concept, integrated game and original greybox.

## Built

All eighteen main sections and Springtide Skippers use the approved navy/orange kit. The main course has 1,838 full-detail prop instances, 56 fitted open rope beds and 28 dressed native movers; the bonus has 70 props, five small spring beds and four moving boat hulls. The earlier 78 animated cone characters remain in place.

Act I has close receiving wharves, boathouses, moorings and rigged fishing boats. Act II uses winches, pumps, rotary hubs and counterweight assemblies. Act III leaves water around the high net/cable challenges, with beacon and crane silhouettes at their landings. Metric weathered timber and riveted steel replace the greybox finishes; icy surfaces retain a distinct wet blue finish. Orange fittings, painted-glass emission, a bounded six-light pool, and animated navy water carry the early-night palette.

The geometry, spawn, kill height, camera nodes, motion, traction, crates, hazards, gates and checkpoints are byte-for-byte identical at the source-data level to local checkpoint `2fa773bd70a7f8677667c6acf60afbca22a64200`. Only the two atmosphere definitions changed in level data. `src/player.ts`, `src/tuning.ts` and camera code were not changed.

## Ownership and rendering

`src/carlisleShipyard.ts` owns presentation and loading; `src/carlisleShipyardMaterials.ts` owns metric finishes, sky and water. `src/level.ts` only adds construction, update, readiness, diagnostics and disposal hooks, plus omission of obsolete non-solid greybox massing. The editor still exposes the original course geometry.

Generated model bytes are copied intact into `public/props/carlisle-shipyard/`. All 43,646 original triangles and embedded PBR maps are retained. Static props use instancing by spatial cell; moving fittings are children of the existing native mesh. Cell culling never substitutes geometry. Cache leases, decoded textures, instanced buffers and native material restoration are released on level changes.

The visual water follows the descending course elevation; it does not supply swimming, support or collision. Its wave and lamp-reflection shader is a stylized presentation, not a planar scene-reflection capture. Decorative quays and their railings are outside the route; actual grind rails remain the native rails. Net compression is presentation only.

## Evidence

- `source-validation.json`: unchanged complete source-course fingerprints; identical original/runtime bytes and triangle counts for all twelve GLBs. Reproduce with `node tools/test-carlisle-shipyard.mjs`.
- `native-physics.json`: 55 spring transfers, unchanged neutral/held impulse, zero uncommanded drift and rigid moving-platform carry.
- `traversal.json`: all three mandatory late grind routes at phase zero, including moving rebound and finish.
- `native.json`: full boat bonus; all 21 crates, all four skiffs/ferries, no deaths or bails.
- `browser-review.json`: all twenty native 1920×1080 views, 480p/CRT presentation, unchanged 49-degree ground FOV, real arrow-key movement, 4.17 m sideways control in 0.3 game seconds, and the normal Emergency Eject gesture. No console errors. Near-start frame sample: 16.7 ms median, 17.9 ms p95 on this Mac; this is not a worst-case guarantee for the whole course.
- `quick-review.json`: final gallery comparison and closer framing checks.

`npm run check:levels` passed. Production build/type-check passed; final build stamp and pack totals are recorded in `validation.json`. No full suite, deployment, extra generation, API purchase or Max-plan spending was performed for this integration. The existing locally ignored cone GLB is still required as documented in its earlier handoff.
