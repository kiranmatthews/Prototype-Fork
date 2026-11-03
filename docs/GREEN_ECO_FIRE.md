# Green eco fire

The local Jump A/B/C/D playtest contains seven large green eco vents. Open
`http://127.0.0.1:5188/jump-review.html?playtest&level=codex-lab&nocrt`.
**Playtest options → Eco rendering** switches between **Gouraud puffs** (the
default) and **Original textures**. **Freeze eco for comparison** holds the same
particle frame while switching. **Next eco vent** tours the seven placements;
**Green eco fire** toggles the complete effect. All four jump variants share it.
The vents are visual dressing; they add no collision or movement forces.

## Source port, then renderer replacement

This revision supersedes the first hand-authored approximation in `05c296de`.
The reference is `group-part-vent-green-active`, used under Sentinel Beach's eco
harvesters. The implementation follows the local OpenGOAL v0.3.9 source:

- [collectables-part.gc, particles 222–227](https://github.com/open-goal/jak-project/blob/master/goal_src/jak1/engine/common-obs/collectables-part.gc): carrier, orbit head, trail, flash, mist and head fade relaunch.
- [sparticle-launcher.gc](https://github.com/open-goal/jak-project/blob/master/goal_src/jak1/engine/gfx/sprite/sparticle/sparticle-launcher.gc): period overlap, fractional spawn credits, reverse group iteration and delayed child launch.
- [sparticle.gc](https://github.com/open-goal/jak-project/blob/master/goal_src/jak1/engine/gfx/sprite/sparticle/sparticle.gc): `sp-orbiter`; the translated `sparticle.cpp` supplies timer/update ordering.
- `sprite.gc` and OpenGOAL's `sprite_3d` shaders supply full-width sprite sizing,
  raw colour/alpha modulation and additive blending.

`src/greenEcoMotion.ts` contains the simulation independently of rendering.
It uses a 300 Hz timer advanced five ticks per 60 Hz simulation frame:

| Source layer | Ported behaviour |
| --- | --- |
| 222 carrier | Five-tick emission window every 48 ticks; rises at 2–3 m/s for 2.5 seconds; fifteen available child bindings |
| 223 head | Random tilted orbit, radius 0.2–0.8 m, 1–2 revolutions/s; full sprite width 0.3–0.6 m; red fades, followed by the 227 half-second alpha fade |
| 224 trail | One hot dot per active head per source frame; full width 0.2 m; source downward acceleration, linear shrink, randomized life and launcher 208 red-fade stop |
| 225 flash | Fractional 0.1–0.4 births/frame; 1.5–1.9 m sprites, rising at 3–6 m/s, source rotation and one-second alpha fade |
| 226 mist | Fractional 0.6–1.2 births/frame; 1.9–3.8 m sprites, rising at 5–10 m/s, source green colour range, signed spin and one-second alpha fade |

The orbiter's initial Y field encodes its tilt angle; it is not a sixteen-metre
spawn height. Acceleration uses the source frame multiplier of one, while
velocity, size, spin and colour changes use five. Trails originate at the
previous head position. There are no invented three-strand helices, separate
floating motes or flat floor-glow disk in this revision.

The source-texture view uses the actual `hotdot`, `starflash` and `bigpuff` PNGs
extracted with the official OpenGOAL extractor from the supplied NTSC-U game
image. The three PNGs and their hash/provenance manifest remain outside Git in
`jak-animation-study/eco/` beneath this chat's visualization directory. The dev
middleware serves only those exact filenames at `/__jak-reference-eco/`.
They are not copied into `public/`, build inputs or release output.

The final Gouraud view substitutes untextured triangle fans with interpolated
vertex RGBA for the sprite quads. The hot-dot profile, irregular soft mist and
eight-point flash have separate geometry. Both views read **the same instance
buffers**: switching changes only geometry/material, never simulation state.
The old approximate Puff Studio layer presets were removed to avoid presenting
them as the port. The complete effect is reusable through `GreenEcoFire`.

This is a port of the source particle rules, not a bit-identical PS2 frame
capture. Random draws use a local deterministic seed instead of Jak's global
VU RNG, and the host camera/colour pipeline differs. Density follows OpenGOAL's
full-particle mode, rather than PS2 distance-dependent emission reduction.
The final Gouraud profiles intentionally approximate the source textures; the
original-texture view remains available to inspect that rendering difference.

## Reuse

```ts
const fire = new GreenEcoFire(scene, [
  {position: [4, 0.03, -10], scale: 1, seed: 101},
]);
// Once per render frame, after settling the camera:
fire.update(dt, camera);
// Optional comparison, with your local extracted study files:
await fire.loadSourceTextures('/__jak-reference-eco');
fire.paused = true;
fire.rendering = 'original'; // or 'gouraud'; does not restart particles
// On removal:
fire.dispose();
```

`enabled = false` clears the complete field. Scale 1 retains source metre units;
most luminous trails occupy the lower six metres, with soft mist rising higher.
The shader faces each actual render camera, including reflections. Updating
simulation again for a reflection pass is unnecessary. The renderer has its own
bounded pool and cannot consume landing/skating dust particles.

`tools/jump-eco-vents.ts` owns the seven local placements and supported approach
positions: entry, first bend, terrace, ice approach, foundry exit, roof relay and
crown approach. Published level data and source course geometry are unchanged.

## Cost and validation

- Three instanced batches/draw calls per view. No per-particle meshes, dynamic
  lights or additional bloom pass. Gouraud rendering uses zero texture samples;
  the optional original view uses three small textures. Loading the comparison
  retains those textures in memory even when Gouraud is selected.
- The full seven-vent 12-second stress run at 30/60/120 Hz peaks at **4,041** live
  visible particles and **162,456** Gouraud triangles per view, without dropped
  particles. All three frame rates produce byte-identical final instance data.
  The original quad view uses two triangles per particle. Gouraud saves texture
  sampling but adds vertices; it is not assumed to be faster on every GPU.
- A full-render browser sample with three visible vents uses 1,625 particles,
  65,360 Gouraud triangles and approximately 0.35 ms smoothed CPU update time on
  this Mac. This measures CPU update, not GPU time; overdraw still depends on
  screen coverage and resolution.
- Whole offscreen emitters stop launching while existing particles retire.
  Geometry/density never reduce with camera distance. Catch-up is capped at
  100 ms after a suspended tab.
- `node tools/test-green-eco-fire.mjs` verifies source velocity/orbit/gravity/
  shrink/fade equations, delayed child launch, finite capacity, equal state at
  30/60/120 Hz, unchanged instance data when switching renderers, offscreen
  retirement, toggles, and disposal of both renderers and loaded textures.
- Existing puff preparation/upload tests, strict source and local-playtest
  typechecks, production build and release-size check pass (803,497,830 bytes).
- Browser: original-texture and Gouraud comparison on the same frozen frame;
  normal 720×816 and native 1506×1706 rendering; effect toggle and A/B/C/D
  continuity; hold-to-skate/release-to-ollie gesture and respawn. No console
  errors/warnings. Normal 720p presentation restored; Gouraud animation resumed.
- The previous increment's real-course probes still cover all seven unchanged
  supported vent mouths/approaches. No movement, animation or input file changed
  in this revision. The earlier D skating regression remains applicable.

Local proof: `green-eco-review/{source-textures-normal.jpg,
gouraud-port-normal.jpg,gouraud-port-native.jpg,gouraud-port-playtest.jpg,
port-browser.json}` beneath the chat's visualization directory. The comparison
page remains development-only. Nothing was published.
