# Bendy wall path

`wallpath` is the editor-native continuous-wall primitive. It is an ordered
centreline, not the closed filled polygon represented by `wall + pts`.

```json
{
  "t": "wallpath",
  "p": [0, 0, 0],
  "pts": [[0, 8], [4, 2, 1.5], [-3, -5, 1.2], [0, -12]],
  "w": 1.2,
  "rise": 5,
  "curve": "spline",
  "color": "#9a8a7a",
  "tex": "stone"
}
```

- `p` is the path's base anchor.
- `pts` are relative `[x, z, cornerRadius?, baseHeightOffset?]` knots.
- `w` is wall thickness and `rise` is visible height.
- `collisionHeight` optionally differs from `rise`; when omitted it follows it.
- `curve: "spline"` makes one centripetal Catmull–Rom sweep. `"corner"`
  preserves straight runs and uses each knot's corner radius.
- `closed` joins three or more distinct knots into an enclosure.
- `solid: false` creates scenery without collision, useful for earth banks and
  distant massing. `invisible: true` does the reverse: collision without a play
  mesh, shown as a ghost only while editing.

The mesh is one capped swept prism with continuous arc-length UVs and separate
top/side normals. Diagonal collision is adaptively subdivided; a cardinal
straight remains one exact collider. Curved wallrides retain the logical path,
sampling its tangent and normal instead of terminating at a hidden collision
slice.

In the editor, add a ready-made **bendy wall** or draw a **bendy wall path**.
Double-click it to edit knots and their base heights/radii. The property panel
controls thickness, visible/collision height, spline versus filleted bends,
open versus closed paths, collision, visibility, tint and texture. Copy/paste,
group transforms, node transforms, undo, import/export and no-op open/close all
use the ordinary component pipeline.

## Jungle Ruins migration

The winding earth-bank shoulders are now 18 visual-only wall paths rather than
rows of seven-metre decor boxes. The temple and finish landing use four solid
wall paths in place of 20 repeated masonry boxes. Their old footprints are
preserved exactly; independent pit-liner faces remain ordinary walls.
