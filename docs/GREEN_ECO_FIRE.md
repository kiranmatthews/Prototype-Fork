# Green eco fire

The local Jump A/B/C/D playtest contains seven large green eco vents. Open
`http://127.0.0.1:5188/jump-review.html?playtest&level=codex-lab&nocrt`.
**Show controls → Playtest options → Next eco vent** tours the placements;
**Green eco fire** toggles the whole effect. It is available in every variant.
The vents are visual dressing and do not heal, launch, obstruct or slow the rider.

## Reference and reconstruction

The reference is the green vent beneath Sentinel Beach's harvesters. OpenGOAL's
[collectables-part.gc](https://github.com/open-goal/jak-project/blob/master/goal_src/jak1/engine/common-obs/collectables-part.gc)
defines `group-part-vent-green-active` and particles 222–227. Its layers reference
`hotdot`, `starflash` and `bigpuff` textures: the original is not purely
untextured Gouraud geometry. The local v0.3.9 source was inspected alongside
`beach-obs.gc`'s harvester and ecoventrock definitions.

This recreation follows that composition: a luminous mouth, green rising wisps,
curling yellow-green hot-dot trails and isolated motes. It uses the existing
PuffSystem's untextured triangle fans with interpolated vertex RGBA. The paths
and gradient geometry are authored here; this is a reconstruction, not an
extracted particle playback. No J&D image, texture, model or audio is added by
this effect. The earlier optional local jump sounds still work.

## Reuse

`src/greenEcoFire.ts` exports `GreenEcoFire`. Supply positions at the supported
ground surface, an optional uniform effect scale and stable seed:

```ts
const fire = new GreenEcoFire(scene, [
  {position: [4, 0.03, -10], scale: 1, seed: 101},
]);
// Once per render frame, after settling the camera:
fire.update(dt, camera);
// On removal:
fire.dispose();
```

`enabled = false` clears the field immediately. A scale of 1 produces a plume
roughly six metres high. Call update once per frame, not once per reflection.
The four editable layers are also listed in Puff Studio as `greenEcoFire`,
`greenEcoRibbon`, `greenEcoMote` and `greenEcoGlow`. The class supplies the full
compound effect; individual presets preview/edit each layer independently.

`tools/jump-eco-vents.ts` owns the seven local placements and safe approach
positions. They span the entry, first bend, terrace approach, ice approach,
foundry exit, roof relay and crown approach. Neither the published level pack
nor the source course geometry was edited.

## Cost and checks

- All vents share one blend batch, two transparent draw calls per view with
  the current double-sided PuffSystem material. No textures, dynamic lights,
  shadows, bloom pass or per-particle meshes.
- A separate bounded pool of 768 particles protects gameplay dust. Full seven-
  vent stress runs at 30/60/120 Hz peaked at 366/372/377 live particles and
  14,892/15,120/15,372 submitted triangles, including both material passes.
- Entire offscreen emitters are culled. Ring geometry and effect detail do not
  change with camera distance. The emitter clock catches up at most 100 ms.
- Browser samples with two/three visible vents used 104–157 live particles;
  sampled smoothed CPU update cost was approximately 0.17–0.21 ms on this Mac.
  This is CPU timing, not a GPU frame-time benchmark; transparent overdraw still
  depends on screen coverage, resolution and hardware.
- `node tools/test-green-eco-fire.mjs`: finite geometry/colour, capacity, frame
  rates, offscreen retirement, toggle/re-enable and resource disposal pass.
  Existing puff preparation and upload-range checks pass.
- Full source-course collision probes confirmed all seven vent mouths and
  approach points are supported, and the effect adds no collision meshes.
  Movement/animation/input code is unchanged by this increment.
- Strict source and local-playtest typechecks and `npm run build` pass.
  Real-browser review used native 2560×1440 and 1506×1706 presentation, plus
  normal 1280×720 / 720×816 inputs; no console errors. Normal 720p restored.

Local proof: `green-eco-review/{native-playtest.jpg,normal-playtest.jpg,
browser.json,placements.json}` beneath the chat's visualization directory.
The comparison page remains development-only. Nothing was published.
