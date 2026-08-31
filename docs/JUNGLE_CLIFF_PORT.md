# Jungle Cliff authorized layout port

This port is a procedural reconstruction of Kraftpaper's
[Level 1 - Jungle Cliff](https://www.nexusmods.com/crashbandicootnsanetrilogy/mods/164)
for Crash Bandicoot N. Sane Trilogy. On 31 August 2026, the project owner
confirmed that Kraftpaper had explicitly authorized inspection of the mod and
derivation of its level layout. That permission is the authority for this
read-only reverse-engineering pass; it is not treated as permission to
redistribute the mod or assets from the base game.

## Source identity

| Input | Size | SHA-256 |
| --- | ---: | --- |
| `Level 01 - Jungle Cliff 164 1 2026-08-30T20-41Z yvFmbAokd.rar` | 652,221,585 bytes | `ae8d0c89946ab15f9213c035ba1415191f8e888419dad29a2a2b10ed020c60ab` |
| RAR member `level01_jungle_cliff.pak` | 683,258,928 bytes | `c848089cdcffc69efc592d5671e8530583c495e9e1dd4534b8ea72c94a527ce4` |

The PAK is an Alchemy IGA version-11 archive with 2,398 members. Its path table
starts at byte `682764288` and is `494640` bytes long. The level data of
interest is primarily under `maps/Crash1/Custom_Level/`: the world, camera,
crate, custom-platform and custom-collectible IGZ files, plus separately
packaged static collision.

## Clean-room repository boundary

The archive was never installed or executed. A small independent Python
reader in `tools/iga_igz_layout.py` reads the IGA directory and compressed
members, then interprets only the IGZ metadata needed for names, object types,
transforms, splines and crate records. It uses the Python standard library and
emits JSON for inspection. NST Maker was consulted as an external behavioral
reference for the editor's concepts, but none of its source or binaries was
copied into this repository.

The importer preserves raw IGZ values: positions and scales are unconverted,
Euler angles are radians, and quaternions are ordered `x, y, z, w`. The
procedural level was authored from that evidence rather than from imported
render or collision geometry.

## Coordinate mapping and recovered topology

NST data is Z-up and uses a much finer unit than this prototype's metre-scale,
Y-up world. The playable reconstruction anchors horizontal position at the
native `PlayerStart` (`-881.7213, 351.2316`) and puts the first authored crate
deck height (`1429.6956`) at ground zero. For a native point
`(nstX, nstY, nstZ)`, the final mapping is:

```text
webX =  (nstX + 881.7213) / 80
webY =  (nstZ - 1429.6956) / 80
webZ = -(nstY - 351.2316) / 80
```

This changes up from native Z to web Y, makes course-forward negative Z, and
compresses 80 native units to one prototype metre. Camera splines sit above
the playable surface; when they supply terrain height rather than camera
height, about 330 native vertical units are subtracted before calculating
`webY`.

The data establishes a winding 21-sample main camera route, a fixed westward
side-cliff transition, and a 10-sample final corridor ending near local
`(-128, 60.7, -197.7)`. It also establishes the player start and finish
teleporter, the remote `DeathRoute_CameraSpline`, crate/checkpoint/collectible
transforms, time-trial start, and path-platform fade/start markers. The web
level preserves that route order and major elevation changes. Terrain ribbon
widths, individual side-cliff ledges, gap sizes, portal transitions, a
representative supported crate subset, and procedural jungle/temple dressing
are authored adaptations for this game's movement model. The recovered remote
death-route topology is present as a deliberately condensed, portal-linked
six-ledge challenge; it is not claimed as a one-for-one geometry port.

## Re-running the layout dump

Keep the large inputs and full JSON dumps outside the checkout. The following
workflow uses a fresh temporary directory and leaves only the importer and the
hand-authored procedural result eligible for commit:

```sh
port_work="$(mktemp -d /tmp/jungle-cliff-port.XXXXXX)"
rar_path="/Users/kiki/Downloads/Level 01 - Jungle Cliff 164 1 2026-08-30T20-41Z yvFmbAokd.rar"
bsdtar -xf "$rar_path" -C "$port_work"
pak_path="$port_work/level01_jungle_cliff.pak"

shasum -a 256 "$rar_path" "$pak_path"
python3 tools/iga_igz_layout.py inventory "$pak_path" \
  --igz-only --pretty --output "$port_work/inventory.json"
python3 tools/iga_igz_layout.py scan "$pak_path" \
  --contains 'maps/Crash1/Custom_Level/' --pretty \
  --output "$port_work/custom-level-layouts.json"
python3 tools/iga_igz_layout.py dump "$pak_path" \
  'maps/Crash1/Custom_Level/Custom_Level_Camera.igz' --pretty \
  --output "$port_work/camera-layout.json"
```

`dump-file` accepts an already extracted IGZ. `--type-hierarchy <json>` can
add subclass information, and `--crate-prefix crate_` can narrow crate
records. These are diagnostic options; coordinate conversion remains an
explicit authoring step.

## Material intentionally not redistributed

No RAR, PAK, IGZ, HKX/HKA/HKB/HKP, texture, model, animation, audio, script,
NST Maker binary/source, or wholesale extraction JSON is committed or shipped.
In particular, permission from the mod author does not alter the ownership of
Crash/Activision content embedded in the package. The published result is
limited to the independently written reader and a code-native arrangement of
this project's existing primitives, collision, crates and CC0 scenery.
