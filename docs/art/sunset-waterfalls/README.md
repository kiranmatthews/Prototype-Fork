# Sunset Safari waterfall trampoline art

The isolated rope-lashed corner reference was generated with imagegen in the requested Crash Bandicoot 4 aesthetic before modelling. The Tripo Studio web app generated the joint with **Smart Mesh P2.0**, Triangle topology, a **5,000 triangle target** and a measured **5,082 triangles**. It used 100 web-plan credits for geometry and 30 for texture. Export is GLB with 2K base colour, 1,194,148 bytes. No API credits, HD Model, Ultra Mesh, retopology pass, or distance-dependent mesh replacement was used.

[Tripo model](https://studio.tripo3d.ai/workspace/generate/75042cd1-5b82-4448-99cf-9bd5bbffa91a). The original imagegen reference and browser proof are beside this file. Runtime loads `public/props/sunset-waterfalls/rope-corner.glb`, shared by all 48 corner instances. The complete authored geometry remains present at every rendering distance and in shadows/reflections.

The frame beams, piles and diagonal cliff brackets are manually authored native meshes. Carlisle's exact rope net supplies the elastic surface, local weight depression, impact rebound, matched shadow deformation, and rope/rim contact boundary. Only its colours change to old brown rope. The native trampoline and launch-camera mechanics are reused without changing player tuning.

The 614 m extension descends from the old -6 m bank to a -254 m finish shelf.
Twelve springs cross stepped waterfall basins; two checkpoint shelves divide
the run into three groups of four. An additional checkpoint precedes the first
spring. Fruit traces the flight arcs. The original level ID remains
`custard-creek`, displayed in the campaign as Sunset Safari.

Validation: `node tools/test-sunset-waterfalls.mjs` completes all twelve native
bounces and the new gate in 72.77 seconds, without deaths or forced movement.
It checks rope/rim bounds, supporting collision, reset-volume clearance,
launch-camera activation, a missed landing and the exported GLB triangle
count. `node tools/test-tribal-trampoline-art.mjs` checks standing weight and
restoring the valley's original fog on departure/disposal. The existing
`node tools/test-marine-net-weight.mjs`, `npm run check:levels`, `npm run build`
and `npm run check:release` pass. Release output is 806,898,461 bytes.

The visible local review at
`/sunset-waterfall-review.html?playtest&level=custard-creek` exercises the real
game. **Run all twelve** makes one placement at the old finish bank and then
supplies only ordinary player input. The full-render run finishes in 71.8
seconds, with both terrace checkpoints, zero deaths and no console or asset
errors. MAX/native and normal views retain identical authored geometry.
Other buttons isolate weight response, water reset, checkpoints and the gate.
This local fixture is excluded from the production game entry points.

- [Native-resolution overview](waterfall-descent-native.jpg)
- [Normal game-resolution overview](waterfall-descent-normal.jpg)
- [Full-render finish](finish-full-render.jpg)
- [Browser run](browser-run.json)
- [Water miss and supported checkpoint recovery](checkpoint-recovery.json)
- [Native runtime report](runtime-report.json)
- [Imagegen reference](rope-corner-crash4-reference.png)
- [Tripo Smart Mesh export proof](tripo-smart-mesh.jpg)
