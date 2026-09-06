# Tropical plant kit

The editor's FOLIAGE palette now includes fan palm, banana tree, sea grape
tree, monstera and bird of paradise. All five use the existing `decor`
component and remain visual scenery. Position, scale, yaw and lean survive
editor capture and reload.

```ts
{ t: "decor", dkind: "monstera", p: [8, 0, -12], w: 1.1, yaw: 35, amp: 0 }
```

`w` is uniform scale, `yaw` is rotation in degrees and `amp` is lean in
degrees for these five species. The old palm and other existing decor kinds
retain their original parameter conventions.

For code-authored scenery, use `TropicalPlantKit` from `src/tropicalPlants.ts`:

```ts
const plants = new TropicalPlantKit(scene);
const tree = plants.create("seagrape");
tree.position.set(8, 0, -12);
scene.add(tree);
// In the level's presentation update:
plants.update(dt);
// On level teardown:
plants.dispose();
```

`batch(kind, transforms)` makes an instanced grove from the same cached
geometry. The map uses this for all five new species. Each level owns a
separate kit and wind clock; paused levels do not advance their leaves.

Leaf veins, light patches, ribs and tip gradients are geometry and vertex
colors. Monstera splits and fenestrations are actual holes in the mesh, with
no alpha-cutout texture. The Gouraud material evaluates diffuse lighting per
vertex, then interpolates the lit colors across triangles. Its key direction,
key tint and ambient strength follow the level's lights.

Flexible leaf vertices receive slow phase-offset sway and vertical bobbing;
attachment vertices stay anchored. The shadow depth material uses the same
wind function and time uniform. Mesh bounds include deformation clearance.
The kit disposes its geometries, materials and custom shadow materials once
and removes the objects it owns.

The map also applies this shading and wind to its original palms, shrubs,
flowers and ground leaves. Other levels' existing legacy plants retain their
current authored presentation until explicitly replaced with these variants.

`tools/test-tropical-plants.mjs` checks geometry validity, real monstera holes,
vertex attributes, model reuse, paused time and teardown. The map regression
also builds these props through level data and checks capture preservation.
