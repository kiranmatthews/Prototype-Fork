# Unity Surf Cruiser skateboard web port

The browser now uses the approved Unity Surf Cruiser presentation in normal
play and exposes the Unity shape lab at `skateboard-lab.html` (or through the
in-game **BOARD** tab). This is a presentation-only port: movement, tricks,
grinds, collision, replay state, and the fixed-step simulation were not
retuned.

## Port authority

The source is Unity commit `3da0720`, specifically:

- `SourceSkateboardSettings.cs` and the saved version-1 tuning JSON
- `SurfCruiserDeckMeshBuilder.cs`
- `SurfCruiserDeck.asset` and `SurfCruiserDeckAsset.cs`
- `FlatDeckSurface.shader` and the seven-material surface set
- `SourceSkateboardPresentation.cs`
- `SkateboardTuning.unity` and its scene builder/runtime panel

Those sources agree on the current production board. A few older Unity editor
tests still describe a superseded 0.82 m deck and are not parity authority.

## Production contract

- X is deck width, Y is up, and local +Z is the nose.
- The root is the ground/wheel-contact pivot.
- Length: `1.982568383216858 m`
- Width: `0.4752296209335327 m`
- Grip centreline: `0.19172483682632447 m` above the root
- Deck mesh: 3,148 vertices, 6,292 triangles, seven material groups
- Materials: grip, orange-sun underside, then five alternating plywood bands
- Wheels: procedural `#756080` cylinders, touching Y=0
- Trucks: normalized Unity truck mesh/UVs with the flat base-colour atlas
- Rendering: opaque, unlit, shadowless; underside perimeter wear is evaluated
  from the same silhouette-relative UV channel and shader equations as Unity

`src/player.ts` only swaps the old cosmetic box/cylinder hierarchy for this
complete cloneable presentation. It retains all existing mounted, loose,
flip, grab, manual, grind, wallride, under-rail, and replay transforms. The
rider's non-uniform presentation scale is cancelled on the board so the Unity
metre dimensions remain exact in world space. Foot planting reads the live
grip height, and an artwork-up loose board receives Unity's bounds-based pivot
lift when it settles.

## Shape lab

The lab reproduces Unity's persistent hero board and enlarged X/Y/Z plus 1×
actual-size gallery. Its right-side panel covers deck plan, curve, topology,
wheels, trucks, placement, artwork crop, wear, plywood colors, JSON import,
JSON export, reset, and copy. Changes rebuild every lab view and every player
board live, then autosave under the fork-isolated browser key
`solProtoSkateboardTuning.v1`.

The owner-supplied photo remains a labeled visual-reference card in the lab;
it is never sampled by the production deck. The orange-sun art remains a
separate project-generated base artwork.

## Web assets and provenance

Only web delivery derivatives are committed:

| Asset | SHA-256 |
| --- | --- |
| `skateboard-truck.glb` | `20d30d6fb2f594549db6ff219bfa8d925540c8dcdbd912f1116bef8e194b05c7` |
| `skateboard-truck.webp` | `eb263b1250367575f5666838e8c30253e5344492d0ec1e474ef5829cd631a905` |
| `surf-cruiser-orange-sun.webp` | `d24e9e704a626fdb7b3e4d26fd35dc9d5760de728c9e8d2e17843cea64ba9ff9` |
| `surf-cruiser-reference.webp` | `67e55cf8ffbb0d202083ea35cfacec8289f27313806ccc659c94e5efa16e3621` |

The source artwork/reference provenance remains documented in Unity's
`Assets/Game/Art/Boards/SOURCE-ASSETS.md`. The truck came from the same
project's recorded Meshy archive; the web build contains only a normalized GLB
and resized base-colour atlas, not the FBX or unused PBR maps. Its project
provenance should remain attached if it is reused outside this game.

The reproducible converters are `tools/skateboard/export_truck.py` and
`tools/skateboard/bake_web_textures.py`.

## Verification

Run:

```sh
npm run check:skateboard
npm run build
```

The skateboard check evaluates the TypeScript mesh builder directly and gates
the exact vertex, triangle, submesh, bounds, kick direction, integration, lab
entry, and baked-asset hashes.
