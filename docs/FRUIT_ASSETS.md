# Wumpa fruit collection

Six source-owned variants replace the former orange milk-drop art in world pickups, crate rewards, attraction and HUD flights: Classic, Golden pear, Ruby cheek, Round ripe, Long mango and Wild gold. The legacy `milk.ts` entry points remain compatible with the pickup pool, editor and saves.

## Art direction and provenance

[Simona Sanin's Crash Bandicoot 4 Wumpa study](https://www.artstation.com/artwork/Aq6bKo) is the visual reference: rounded asymmetric fruit, red shoulders, a broad orange/golden-yellow body, a restrained green blush at the base, and broad folded leaves around a curved stalk. The game meshes, vertex colours and procedural skin/vein patterns are authored here; no reference mesh or texture is copied.

`src/fruitAssets.ts` owns the six sculpt profiles, leaf volumes and stalks. The complete three-leaf variants use 4,952 triangles and two-leaf variants use 4,400. Every viewing distance, shadow and reflection retains the complete authored geometry. Six cached geometries and one shared material avoid per-pickup assets. Geometry includes the crown in the same mesh, so native deformation and instanced morph rendering cannot leave detached leaves or stalks.

## Surface and motion

The fruit uses scene-lit dielectric shading with high roughness, subtle filtered pores, low-contrast skin mottling and a soft peach sheen. Leaves have their own satin roughness and fine veins; stalks have a drier response. There is no wet clearcoat or fixed painted highlight. Fine surface detail is filtered at small screen sizes without changing geometry. Ordinary scene fog is retained, and the shared material opts out of Jungle's scenery-only depth blackening.

The six existing relative morph targets still provide squash, rebound, stretch and trailing motion. Their extent is adapted to firm fruit rather than liquid. Normals deform with the surface; source-to-magnet-to-HUD handoff copies the selected sculpt and current motion. Pickup contact, attraction settings, accounting and reward timing retain their existing contracts.

## Loose clusters

`src/levels/fruit-clusters.ts` authors open six-fruit handfuls from ordinary `wumpa` components. Four clusters return to Jungle Ruins and five to Banana Bay. Their crowns have visible space between them. All members retain ordinary collection, trial hiding, checkpoint/respawn and editor behavior. Crate handfuls also gain enough spacing for the new crowns.

The interactive collection at `milk-review.html` provides studio/shade/sunset lighting, full-collection and detail views, front/back/top views, turntable, idle/release/collection motion and MAX/720p presentation. It uses the same game assets.

## Validation

Asset-only checks: `node tools/test-milk.mjs`. Runtime checks: `npm run check:milk`, `node tools/test-character-interactions.mjs`, and the cluster placement check. Level-data changes require `npm run check:levels`, followed by `npm run build`. Full/native browser validation and final results are recorded in the iteration log and release handoff.

The pre-crash source was recovered into a durable worktree on 5 November 2026. No lost or interrupted test is reported as passing.
