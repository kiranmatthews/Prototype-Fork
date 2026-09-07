# Shared level JSON format

A level file contains data for the app's existing level builders. It cannot add scripts, HTML, URLs, shaders, asset paths, or new component implementations. Treat every imported file, published pack, and browser-storage entry as untrusted input. The authoritative contract is `CustomLevelData` / `CustomComponent` in `src/level.ts`; validation is implemented there alongside the builders.

## File shapes and versions

The editor exports a bare version-1 level:

```json
{
  "v": 1,
  "name": "My shared course",
  "spawn": [0, 1, 8],
  "killY": -20,
  "components": [
    { "t": "platform", "p": [0, 0, 0], "s": [20, 1, 30] },
    { "t": "gate", "p": [0, 0.5, -10] }
  ]
}
```

A single-file import also accepts `{ "id": "u1", "name": "My course", "data": <level> }`. Only `data` is required in this wrapper. The optional name overrides the level name; the imported ID does not replace an existing local level. Normal menu import assigns a fresh local ID. The editor also creates a new library entry and switches to it; the previous level remains available in the menu. Import starts a fresh undo history for the new level.

Published packs use `{ "v": 2, "levels": [<entry>, ...] }`; each entry requires a unique `id`, `name`, and version-1 `data`. A pack version is distinct from a level version. Unknown versions and unknown fields are rejected, including nested fields. Introduce a new field by updating the contract, validation, editor controls, runtime capture/build behavior, and regression fixtures together. A breaking format change needs explicit versioning and migration. Newer unsupported files should fail visibly rather than silently lose content.

## Authored values

Coordinates use metres in Three.js's right-handed, Y-up world. The normal corridor travels toward negative Z. Component `p` is its authored anchor; anchors vary by primitive, so consult the comments on `CustomComponent` before generating files. For a box platform, `p` is its centre and the supported top is `p[1] + s[1] / 2`.

Every component has an allowlisted `t` and a three-number `p`. Optional fields are validated with their declared types. Numbers must be finite; strings are not coerced into numbers, and booleans must be JSON `true`/`false`. Surface `color` is exactly `#rrggbb`; `tex`, `dkind`, crate/enemy/trick types, axes, curves, and directions use built-in enums. Palette fields are bounded identifiers for existing fitted-mesh selection, with no URL fetching or executable behavior.

Path points use `[dx, dz, radius?, dy?, bankDegrees?]` relative to `p`. Per-node woodpath widths use `widths`; omitted widths inherit `w`. Polygon platforms, walls and pits require a simple, nonzero-area boundary. Crossing edges, repeated adjacent points, and collapsed polygons are rejected. A repeated final point closing the first point is accepted. Open and closed paths include their actual closing segment in the work budget.

Optional level metadata includes atmosphere/sky, ocean, sand blocks and shoreline foam, medal targets, ledge assist, and HUD mode. Shoreline foam direction vectors must be approximately orthonormal. An ocean may retain its authored `shore` as 2–4,096 local `[x,z,normalX,normalZ]` samples with bounded nonzero normals; `extendTails` preserves source shoreline tails. The full shoreline, including 400 m tails at each end when enabled, shares the 20,000 m path limit. Runtime-authored `allBalanceCrates`, `perfectGrindBoost`, and `keepPlayFog` flags survive editing. `bonusplatform` describes a movable bonus-stage entrance with an optional `to` return point. `worldmap` owns a movable campaign map and its ocean; it cannot coexist with a separate level ocean. Its optional points correspond to the fixed campaign hub order, so files cannot introduce arbitrary navigation targets. Hub local X/Z coordinates are limited to ±256 and height to ±128, and hubs must remain at least 0.05 m apart. At most one bonus platform and one world map are accepted. `tumblezone` retains a movable roadside death/recovery volume; `coastwall` retains an editable coastal boundary using bounded swept-path data. One `vertramp` may set `trafficRoad: true` to retain its authored traffic path and car behavior. A bounded `mesh` stores native ground that cannot be represented exactly by other primitives: local XYZ `vertices`, optional triangle `indices`, and optional matching `normals`, `uvs`, and RGB `colors`. It uses existing materials and collision behavior; it cannot carry external asset references. `doubleSided` and `beachSand` preserve the corresponding surface flags.

Legacy `outline` and `pipe` primitives migrate to modern crate/vertramp data before building. Legacy layers migrate into named groups while preserving locks. Group duplicates, dangling parents, and cycles are normalized safely; nesting beyond 64 levels is rejected. Migration preserves component data and is idempotent. Ordinary courses gain missing finish/run-mode objects; bonus and hub HUD modes omit run-mode activators, and hubs do not gain an automatic finish gate.

## Resource limits

These are upper ceilings; combined work limits can reject a file below an individual ceiling. They are defensive bounds, not a promise of smooth performance on every device.

| Input | Limit |
| --- | ---: |
| Single file, UTF-8 bytes before parsing | 5 MiB |
| Published pack / local store | 16 MiB |
| Levels in a pack | 128 |
| Components in one level | 10,000 |
| Dynamic hazard/enemy components combined | 1,024 |
| Cars projected onto an authored traffic road | 128 |
| Crates / legacy outlines / metal crates combined | 2,048 |
| Checkpoints | 128 |
| Crate × checkpoint snapshots | 250,000 entries |
| Points or widths on one component | 4,096 |
| Points and widths across the level | 50,000 |
| Polygon points | 512 (4,096 for pit footprints) |
| Combined triangulation work estimate | 20,000,000 squared filleted points |
| Generated geometry/collision/decor work estimate | 500,000 units |
| Vertices / triangles on one native mesh component | 4,096 / 4,096 |
| Native mesh vertices / triangles across the level | 100,000 / 100,000 |
| Terrain-support ray probes × component count | 2,000,000 |
| Authored path length, including closure | 20,000 m |
| Coordinate, size and ordinary numeric magnitude | 100,000 |
| Box dimension minimum | 0.0001 m |
| Combined groups and legacy layers | 512 |
| Group/layer IDs | Integer, 0–1,000,000 |
| Level/component/group/layer labels | 120 UTF-16 code units |
| Pack/import IDs | 1–80 ASCII letters, digits, `_`, `-` |
| Palette strings | 80 code units |
| Ocean longitudinal/lateral segments | 1,024 / 512, also limited by their product |
| Sand blocks / shoreline foam ovals | 256 / 512 |
| Vine strands per component | 64 |

Additional primitive-specific minima prevent invalid geometry and zero/negative timing periods. Spline estimates allow for overshoot; fallback paths, both terrain berms, scaffold planks/supports/rails, wall collision subdivisions and ocean vertex products contribute to the combined budget. A lexical preflight rejects nesting deeper than 12 (14 for packs), more than 100,000 containers or 800,000 separators, and raw string bodies beyond 1,536 characters before parser allocation. Braces and escaped quotes inside strings do not affect nesting counts. The plain-data copier separately bounds depth (12), visited values (400,000), object fields (128), and estimated memory (16 MiB), followed by an exact serialized 5 MiB limit. Names in the menu are trimmed and limited to 28 characters after validation.

## Trust boundaries and failure behavior

`parseCustomLevelJson` is the single-file parsing entry point. It checks encoded byte size and lexically bounds nesting, container count, separators and string length before `JSON.parse`, then makes a bounded plain-data copy and validates the schema before migration or geometry construction. Reserved keys `__proto__`, `prototype`, and `constructor` are rejected anywhere. Non-plain objects, accessors, `toJSON` functions, cycles, sparse arrays, hidden properties and arbitrary metadata are rejected by the object-level API. Validation does not evaluate imported code or fetch imported URLs.

`normalizeUserLevelEntries` validates a complete pack before replacement. Invalid entries, duplicate IDs or oversized packs reject the entire operation and keep existing local work. Startup recovery can salvage individually valid entries from an older/corrupt local store. Legacy single-slot adoption uses the same parser and retains invalid or unpersisted source slots for recovery. A browser storage quota failure retains the validated session copy so it can still be exported; it must be surfaced as unsaved by the UI.

Published pack downloads are streamed with a byte cap, a timeout and strict UTF-8 decoding before parsing. Restore applies only a completely validated version-2 pack. Single-file UI reads also check `File.size` before loading the file into memory. Level names and labels remain text: display them through `textContent` or escaped markup, never as raw HTML.

These checks cover the format and resource-expansion paths exercised by the regression suite; they do not constitute a guarantee against every browser, renderer, or dependency vulnerability. Keep Three.js/browser dependencies reviewed, and update work accounting when adding any builder that expands authored input into meshes, colliders, lights, particles, paths, or network requests.

## Editor audit and conversion limits

The editor exposes native components, indexed mesh vertices, path knots and level-owned ocean/sand/foam controls. Moving an owner also moves its portal return point, timber support floor and shelf waterline. Search, persistent save/error feedback, bounded history and canonical working data keep editing state aligned with the preview and export. Numeric edits commit on change, blur or Enter; Escape and pointer interruption cancel unfinished gestures.

The audit adds gameplay-preserving representations for campaign maps, bonus entrances, traffic roads, continuous coast blockers, tumble volumes, irregular ground triangles and curved oceans. Runtime tests cover collisions, gaps, transforms and the supported gameplay relationships. The diagnostic `--strict-hand-built` object comparison still reports differences for legacy hand-coded scenes: some custom material/theme effects and manually emitted visual-only scenery do not have complete capture parity. Opening and closing without editing retains the original built level exactly. Do not interpret the ordinary round-trip suite as proof of pixel-identical conversion of every legacy scene.

## Validation

Run `npm run check:editor-security`, `npm run check:editor-roundtrip`, and the full `npm run build` before publishing. `tools/test-level-security.mjs` exercises malicious keys, schema/type errors, numerical extremes, geometric work amplification, self-intersecting polygons, executable object hooks, malformed wrappers, pack replacement atomicity, streamed remote size/UTF-8/version failures, quota recovery, and compatibility with all source-authored and published level data. The editor roundtrip suite builds accepted data and compares gameplay/capture contracts in both lite and full modes. Finish with a real-browser editor/import smoke test and a console-error check.
