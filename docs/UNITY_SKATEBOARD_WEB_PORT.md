# Surf Cruiser skateboard web port

The browser uses the approved Surf Cruiser presentation in normal play and
exposes its shape lab at `skateboard-lab.html` (or through the
in-game **BOARD** tab). This is a presentation-only port: movement, tricks,
grinds, collision, replay state, and the fixed-step simulation were not
retuned.

## Board authority

The canonical tuning is the approved version-1 Board Lab export at
`public/skateboard/surf-cruiser-board.json`, mirrored exactly by
`DEFAULT_SKATEBOARD_SETTINGS`. It supersedes the older browser defaults while
retaining the same schema and storage key. Existing deliberately saved boards
continue to override the shipped preset; a new browser or **Reset approved
board** uses this JSON. Older version-1 files with one `artworkScale` value
remain valid and migrate that value to both artwork axes.

The procedural deck topology and material implementation remain measured from
Unity commit `3da0720`, specifically:

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
- Overall scale: `1` by default. One internal uniform assembly scales the deck,
  trucks, wheels, hardware, clearances, and semantic sockets together; the
  authored dimensions and contact heights below are multiplied by this value.
- Length: `1.982568383216858 m` at scale 1
- Width: `0.4752296209335327 m` at scale 1
- Grip centreline: `0.234 m` above the root at scale 1
- Deck mesh: 3,148 vertices, 6,292 triangles, seven material groups
- Materials: grip, orange-sun underside, then five alternating plywood bands
- Wheels: radius `0.071m`, width `0.101m`, centres at X `±0.202m`, touching Y=0
- Trucks: normalized source mesh/UVs, local X trim `+90°`, effective imported
  scale `4.85 / 2.2098000049591066 = 2.1947687524282324`
- Artwork crop scale X (width) and Y (length): independently adjustable and
  both `1.37` by default (`0.7299270072992701` tiling and
  `0.13503649635036497` centred offset on each axis)
- Rendering: opaque, unlit, shadowless; underside perimeter wear is evaluated
  from the same silhouette-relative UV channel and shader equations as Unity

`src/player.ts` only swaps the old cosmetic box/cylinder hierarchy for this
complete cloneable presentation. It retains all existing mounted, loose,
flip, grab, manual, grind, wallride, under-rail, and replay transforms. The
rider's non-uniform presentation scale is cancelled on the board so the Unity
metre dimensions remain exact in world space. Foot planting reads the live
grip height. Discarded boards use their full visible bounds when settling,
including artwork-up decks and fractured pieces.

## Discarded board pile

Every bail, board abandonment and traversal detach creates a separate board
owned by the current `Level`. Remounting releases its ownership by the player
and brings out a fresh deck. Grounded leftovers remain through same-level
respawns and resets; unloading that Level clears the collection. A suspended
parent level retains its pile across a bonus detour. Debris falling out of the
playable world is removed below the kill plane.

A separate cosmetic random stream chooses occasional first-impact breakage:
16% split into two independently bouncing halves, and 9% fold into a taco.
The fractured deck retains its griptape/artwork UVs, plywood, wheels and trucks,
with raw wood at the split. This never consumes gameplay RNG or adds collision.

Awake pieces share fixed-step physics and render interpolation; sleeping pieces
become mesh/material instances grouped into 32 m cells. This preserves the pile
without per-board sleeping physics or unbounded per-board draw calls. The custom
deck shader supports instance transforms. Fracture geometry is cached per source
deck, and level cleanup disposes only owned fracture/instance resources, never
the live skateboard's borrowed geometry, textures or materials.

## Shape lab

The lab reproduces Unity's persistent hero board and enlarged X/Y/Z plus 1×
actual-size gallery. The enlarged Y tile explicitly faces the underside toward
the camera so the orange-sun artwork is visible without orbiting below the
scene. Its right-side panel covers deck plan, curve, topology, wheels, per-end
truck placement and local XYZ rotation, uniform overall scale, placement,
independent artwork X/Y crop, wear, plywood colors, JSON import, JSON export,
reset, and copy. Changes rebuild every lab view and every player board live,
then autosave under the fork-isolated browser key
`solProtoSkateboardTuning.v1`.

The owner-supplied photo remains a labeled visual-reference card in the lab;
it is never sampled by the production deck. The orange-sun art remains a
separate project-generated base artwork.

## Web assets and provenance

Only web delivery derivatives are committed:

| Asset | SHA-256 |
| --- | --- |
| `surf-cruiser-board.json` | `9767e03ba2fd951e46924477cd762ee3565ff3ac563b586fdd20c170fefaa040` |
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
the exact Board JSON, legacy migration, vertex/triangle/submesh bounds, kick
direction, independent artwork crop axes, true uniform assembly scaling,
imported-truck calibration/bounds, wheel alignment, integration, lab entry,
and baked-asset hashes.
