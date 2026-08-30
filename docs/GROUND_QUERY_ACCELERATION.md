# Universal ground-query acceleration

All standable triangle meshes now keep their existing `THREE.Mesh` identity,
materials, transforms and gameplay metadata while dense geometries receive a
local-space `three-mesh-bvh` acceleration tree.

## Why this exists

Three's stock `Mesh.raycast` linearly tests every triangle after its mesh-level
bounding-box check. The Unity Beachfront sand is one 47,360-triangle mesh. A
stationary grounded player performs a long shadow probe, a normal ground probe
and four Crash-style teeter probes every fixed tick, so the old path could do
roughly 17 million triangle tests per second before rendering.

## Runtime contract

- `src/groundAcceleration.ts` builds a BVH for every ground geometry with at
  least 128 triangles after the complete `Level` build finishes.
- Trees use `indirect: true`; position/index buffers, groups, draw ranges,
  face indices and rendered geometry remain byte-identical.
- `acceleratedRaycast` is assigned per ground mesh rather than globally.
  Non-ground editor/model picking and tiny primitives keep Three's stock path.
- Full-hit raycasts remain enabled. Gameplay intentionally filters stacked,
  height-limited and inactive-crumble intersections, so global
  `firstHitOnly` would be incorrect.
- BVHs live in mesh-local space. Movers and crumble pads update only rigid
  transforms, so their trees do not need rebuilding; their world matrices are
  published immediately after fixed-step motion.
- Phase pads may leave and re-enter `groundMeshes`; the same accelerated mesh
  instance is reused.
- Level disposal releases trees owned by that level unless the geometry is
  shared with the replacement/editor level.

This is universal across built-ins, source-authored data levels, editor
rebuilds and future procedural ground meshes. An object-level broadphase may
still be useful for a future course containing thousands of tiny independent
boxes, but dense-mesh queries no longer scale linearly with triangle count.

## Validation

`npm run check:ground` verifies:

- stock-versus-BVH hit count, object, distance, point, face index, material
  group and normal parity;
- indexed geometry-buffer immutability;
- nested translation, rotation, non-uniform scale and negative scale;
- prewarming of every dense ground mesh across every built-in level;
- bounds-tree disposal over the real Level lifecycle; and
- an adaptive performance gate of at least 8x.

On the development machine, the real Beachfront six-ray idle bundle fell from
roughly 20-35ms to 0.09-0.14ms, over 200x faster. Absolute timings vary by
machine; correctness and the ratio are the build gates.
