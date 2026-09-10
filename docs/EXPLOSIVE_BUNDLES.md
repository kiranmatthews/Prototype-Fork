# TNT and Nitro dynamite bundles

The existing TNT and Nitro crate kinds now use the owner-supplied Meshy bundle models. Both bodies fit the original 0.96 m cube collider. TNT adds a short rope fuse above its centre; the fuse is presentation geometry and does not enlarge the contact/stacking volume. Nitro has no fuse or fuse effects.

TNT lights through the existing stomp/countdown route. Three braided strands remain fixed below a descending burn front, with a charred end, hot ember, glow and a small spark pool. The burn fraction comes directly from the existing three-second `fuse` value, so pause, reset, independent TNT timers and detonation stay synchronized. Only red pigment flashes on the 3/2/1 audio beats. Tan caps and straps stay steady. The old whole-box scaling pulse is replaced by this material pulse. A tiny floating-point tolerance keeps audio boundaries and detonation on their intended fixed-step ticks.

Nitro retains its existing contact explosion and idle bob. Only green pigment continuously pulses; end caps and warning bands stay steady. The two actual strap regions are identified by triangle geometry, then shaded with antialiased yellow/black diagonal stripes around a continuous perimeter coordinate. Old malformed stripe colour, normal and roughness detail is replaced on those surfaces; green stick textures are preserved.

The normal lifecycle handles outlines, checkpoint/restart restoration, force detonations, chain blasts, and run modes. Hidden/dead bundles hide all attached fuse effects. Loading joins the existing destination readiness barrier. Geometry/textures are shared across levels, while countdown and material uniforms remain per bundle; late loads cannot attach to disposed levels.

Owner-provided inputs:

- TNT: `Meshy_AI_Dynamite_Bundle_0910111512_texture.glb`
- Nitro: `Meshy_AI_Dynamite_Bundle_0910112955_texture.glb`
- Supplied PNGs provide the intended red/green bundle appearance and clean warning-band reference.

Each original mesh has 3,304 triangles. `tools/explosive-bundle/prepare_assets.py` reuses the prop texture-sizing helper, retaining mesh/UV data and provenance hashes while reducing the two GLBs from 11.9 MB to 932,168 bytes. Runtime band ownership uses a flat triangle attribute. The fuse adds one shared braid mesh and small local ember/spark draws.

`tools/test-explosive-bundles.mjs` covers real Level updates for independent three-second fuses, fixed collider bounds, pause, reset, outline safety and pulse timing. `/explosive-bundle-review.html?playtest&level=jungle` provides local-only model/timer views and a real stomp trigger without saving campaign or level data. The full test suite remains opt-in.
