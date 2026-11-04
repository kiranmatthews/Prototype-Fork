# Wumpa fruit collection

Six source-owned variants replace the former orange milk-drop art in world pickups, crate rewards, attraction and HUD flights: Classic, Golden pear, Ruby cheek, Round ripe, Long mango and Wild gold. The legacy `milk.ts` entry points remain compatible with the pickup pool, editor and saves.

## Art direction and provenance

[Simona Sanin's Crash Bandicoot 4 Wumpa study](https://www.artstation.com/artwork/Aq6bKo) is the visual reference: taller asymmetric mango/peach bodies, red shoulders, warm orange/golden-yellow cheeks, fresh green climbing from the base, and broad folded leaves around a curved stalk. The game meshes, vertex colours and procedural skin/vein patterns are authored here; no reference mesh or texture is copied.

`src/fruitAssets.ts` owns the six sculpt profiles, leaf volumes and stalks. The complete three-leaf variants use 4,904 triangles and two-leaf variants use 4,352. Every viewing distance, shadow and reflection retains the complete authored geometry. Six cached geometries and one shared material avoid per-pickup assets. Geometry includes the crown in the same mesh, so native deformation and instanced morph rendering cannot leave detached leaves or stalks.

## Surface and motion

The revised fruit uses scene-lit dielectric shading with a broad soft highlight, filtered pores, low-contrast skin mottling and a soft peach sheen. Warm light wrapping approximates shallow flesh scattering at the terminator; thin leaf backlighting follows actual scene lights and their shadows. Leaves have independently authored folds, curls, thin closed edges, satin roughness, a raised midrib and two scales of fine veins. Tapered stalks have longitudinal bark grain, a flat end-grain cut and sealed rims. The underside has a small blossom scar. There is no wet clearcoat or fixed painted highlight. Fine surface detail is filtered at small screen sizes without changing geometry. Ordinary scene fog is retained, and the shared material opts out of Jungle's scenery-only depth blackening.

The six existing relative morph targets still provide squash, rebound, stretch and trailing motion. Their extent is adapted to firm fruit. A tissue flex weight lets leaf tips trail and flutter while their roots remain attached; the stalk has a gentler response. The bark UV seam remains smooth in every normal target. Normals deform with the surface; source-to-magnet-to-HUD handoff copies the selected sculpt and current motion. Pickup contact, attraction settings, accounting and reward timing retain their existing contracts.

## Loose clusters

`src/levels/fruit-clusters.ts` authors open six-fruit handfuls from ordinary `wumpa` components. Four clusters return to Jungle Ruins and five to Banana Bay. Their crowns have visible space between them. All members retain ordinary collection, trial hiding, checkpoint/respawn and editor behavior. Crate handfuls also gain enough spacing for the new crowns.

The interactive collection at `milk-review.html` provides studio/shade/sunset lighting, full-collection and detail views, front/three-quarter/back/top views, per-variant close-ups, drag orbit, turntable, idle/release/collection motion and MAX/720p presentation. It uses the same game assets.

## Initial integration validation

Passed: `npm run check:milk`, `node tools/test-character-interactions.mjs`, `node tools/test-fruit-clusters.mjs`, `npm run check:levels` and `npm run build`. The native placement fixture checks all 54 new fruits against actual ground, crates, neighbouring crowns, trial hiding, soft respawn and editor capture.

Real-browser review covers studio/shade/sunset, front/back/top, idle/release/flight, Jungle lite and full 720p, and Banana Bay full MAX/native (2560 × 1440 drawing buffer). Three ordinary-input walks each collected a complete six-fruit cluster with exactly six credits and zero deaths. Crate release, trial hiding/restoration and supported respawn also pass; all four browser warning/error logs are empty. See [saved evidence](fruit-assets/validation/README.md). The local-only `fruit-runtime-review.html` provides repeatable visible controls without adding cheats or test controls to the shipped game.

The pre-crash source was recovered into a durable worktree on 5 November 2026. No lost or interrupted test is reported as passing.

## Reference-quality revision

The first pass was rejected as flat and basic. The follow-up rebuild gives the variants fuller shoulders, narrower and uneven bases, a deeper stem socket and a shallow suture. Ripeness follows the cheeks instead of forming uniform horizontal bands. New crowns are individually posed; all their geometry remains present during release, attraction and HUD flight. The gallery uses a stronger studio key and broad fill so the surface response can be judged, and runtime review still uses the game lighting. [Revision evidence](fruit-assets/reference-polish/README.md) includes fresh normal/native browser review and focused source checks; the earlier validation folder remains as the first-pass record.

The revised runtime is `37dedc7a0cb0788180551410934a757b6205035c`. Fresh `check:milk`, Player interaction checks and the complete production build pass. Browser walks in Jungle lite, Jungle full 720p and Banana Bay full native each collect six fruits for six credits with zero deaths; crate collection also works. All four warning/error logs are empty. The unchanged level data and cluster placements retain their original native placement validation. Release integration and public deployment verification belong to the active coordinator.

## Long mango proportion correction

The user subsequently found Long mango too stretched. Its body now has fuller
shoulders, less lean and a height/width ratio of 1.084 instead of 1.352. The crown
is shorter and broader, with the folds fitted clear of the wider cheeks. The
other five complete geometries are byte-identical. [Correction and evidence](fruit-assets/mango-proportions/README.md)
includes current close-ups and the updated collection view; the earlier
reference-polish images retain the previous, narrower mango.
