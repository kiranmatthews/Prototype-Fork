# Whole-game Jak inspection lab

The objective is the complete game's novel particle effects, objects and items,
inspectable in an explorable lab with originals and a Gouraud alternative for
each. **In progress; not ready for publication.** Source counts are coverage
evidence, not proof of visual fidelity or complete host behavior.

This is an independent Three.js entry point at `jak-lab.html`. It imports no game
player/runtime code and has its own Vite configuration. The held jump-animation
experiment is not a delivery dependency. Its Git ancestor must not be merged as
part of the lab; integrate only the lab's scoped commits when they are ready.

## Current evidence

The pinned source is the official OpenGOAL v0.3.9 release, and the game data is the
user-supplied USA SCUS-97124 NTSC-v1 disc. The restored macOS ARM release archive
matches the release's SHA-256:
`613d7b2b2171fd1840c71b2928e1352ee1b5f2ec8df5a4ec76c1bfe91b926d42`.

The source inventory scans every Jak 1 `.gc` file, preserving file hashes and line
locations. Current evidence is 533 parsed files, zero parse failures, 2,515
particle definitions in 104 files and 675 named effect groups. All 79 referenced
birth/update callbacks have source definitions. The audit additionally found 98
direct launch sites, 70 direct particle roots, 394 runtime particle patch sites
and 350 procedural draw/render candidates requiring review. The named group
graphs reach 2,344 particle definitions; another 171 are outside those graphs.
Following direct launch roots reduces the unresolved set to 87. Those 87 are
not automatically classified as unused: computed IDs, host launch paths and
unused source variants still need distinguishing.

The initial official full export completed with 605 highest-detail GLBs,
including 24 backgrounds, and 4,002 source PNGs. All 458 expected highest-detail
joint geometries were present. **Those exports were lost in the restart** and
must be restored and revalidated. The source code and supplied ISO survived.
Recovered tools, future raw exports and generated manifests now belong in the
ignored, durable `.jak-lab-data/` folder, not `/private/tmp`.

The lab supports walking/flying between exhibits, search by area/type/name,
original/Gouraud/both views, matched animation playback, scrubbing, pause,
restart, source scale and normal/native render resolution. Direct launchers
are included separately and explicitly repeat once per second for inspection;
that frequency is a lab control, not a reconstructed host object's update rate.

## Fidelity and delivery

Models retain the complete source geometry, skin weights, morphs and animation
keys. Gouraud models sample source textures into vertex colors and use vertex
lighting. No camera-dependent LOD or mesh decimation is used. Streaming disposes
complete exhibits outside the nearby set. Original GLBs remain the authoritative
export, with hashes recorded alongside the packed assets.

The packer removes only unreferenced vertex/accessor storage, externalizes exact
image bytes and applies lossless gzip transport. Before accepting each model it
compares the complete rendered draw-order attribute/morph streams, every skin's
inverse-bind matrices, animation inputs/outputs/interpolation/channel targets,
scene/material metadata and original image bytes. It verifies gzip round trips
as well. It adds correct bounds to POSITION accessors. Sparse/compressed source
layouts without an explicit implementation fail instead of being approximated.

One retained original Jak GLB has been checked through this path: 14,524,956
source bytes become 1,211,786 stored asset bytes, including its 21 source images,
with identical semantic fingerprints. This is a pilot, not a whole-catalogue
size result. Measure the full pack before promising it fits the shared Pages
budget. If necessary, the standalone frontend can read a separately hosted
catalogue/assets origin through `?catalogue=<URL>` with that host's CORS support.
Never put the ISO, extraction installation or unfiltered archives in a public
asset directory. The complete asset scope must not be reduced to fit a budget.

Particle simulation preserves source units, field types/random rules, launch
bindings, 300 Hz clocks at 60 Hz steps, relaunch fields, orbital motion and 2D/3D
orientation. Current corrections include native XYZ launch/ZXY quaternion order
(converted to Three's conventions), live position aliases during relaunch,
3D relaunch multiplication, integer 2D rotation wrap, period recovery, hour masks,
distance attenuation and source alpha/depth modes. The original and Gouraud
sprite renderers consume the same simulated particle state. RNG is a local
seeded generator, not the game's global VU RNG stream.

**Unfinished fidelity requirements:**

- Restore and verify the complete export; inspect every source model and its
  Gouraud counterpart, all animations/material classes, and large scenes.
- Port and exercise host-dependent callbacks, runtime particle patches, dynamic
  texture assignments, screen-space HUD effects and auxiliary sprite geometry.
  The inspector reports known gaps instead of presenting them as faithful ports.
- Trace the remaining 87 particle definitions and computed launch references.
- Inventory and expose the static TIE/shrub prototypes within backgrounds, not
  just joint geometry. The pinned exporter groups static prototypes by node;
  some groups include all level instances. Individual-instance reconstruction
  needs explicit source evidence, not arbitrary connected-component splitting.
- Audit procedural renderers, texture animation, weather/time-of-day variants
  and host object states; a named-group count is not whole-game completeness.
- Verify source group duration/linger lifecycle and host placement. The raw
  group metadata is normalized to source ticks, but host lifecycle is not yet
  inferred universally from it.
- Verify blended-particle sorting, source color/alpha conventions and Gouraud
  visual fidelity across the catalogue at native and normal resolution.
- Finish standalone packaging, production build, full catalogue checks and
  browser review with no errors; measure final hosted bytes and hand off a
  coherent READY increment to the coordinator.

## Reproduce locally

All heavyweight commands must run through the shared `run_heavy.py` helper
documented in `RELEASE_COORDINATION.md`. Exit 75 means defer the command and
record the needed job in the handoff; do not poll in a retry loop.

Restore the official release tools into `.jak-lab-data/installation` after
verifying the release hash. With the supplied ISO available:

```sh
python3 tools/jak-lab/extract_assets.py \
  --installation .jak-lab-data/installation \
  --iso '/path/to/the/supplied/USA.iso' \
  --output .jak-lab-data/export

python3 tools/jak-lab/catalogue.py \
  --project .jak-lab-data/export/opengoal \
  --output .jak-lab-data/export/catalogue.json

python3 tools/jak-lab/pack_assets.py \
  --catalogue .jak-lab-data/export/catalogue.json \
  --exported .jak-lab-data/export/opengoal/decompiler_out/jak1 \
  --output .jak-lab-data/export/packed

JAK_LAB_DIR="$PWD/.jak-lab-data/export/packed" \
  npx vite --config tools/jak-lab/vite.config.ts --host 127.0.0.1 --port 5193
```

Open `http://127.0.0.1:5193/jak-lab.html`. The local asset middleware serves only
the exact catalogue allowlist, with resolved-path containment checks. It never
exposes the supplied archive or arbitrary workspace files.

The independent frontend build is
`npx vite build --config tools/jak-lab/vite.config.ts`, writing only to
`.jak-lab-data/site`. It does not copy the main game's `public/` assets. Keep
generated data and delivery packages out of Git. The normal repository build
and the standalone build remain pending the coordinator's resource capacity.

Focused checks currently pass:

```sh
python3 -m unittest discover -s tools/jak-lab -p 'test_*.py' -v
node tools/jak-lab/test-particle-motion.mjs
npx tsc --noEmit
```

The packing tests exercise interleaved buffers, index remapping, exact draw
streams, normalized attributes, skin/morph/animation preservation, unindexed
geometry, corrupt-content detection and explicit unsupported-layout failure.
Source inventory tests cover direct launches, runtime patches, callback lookup,
graph reachability and reporting malformed source. Pure particle checks cover
coordinate order, relaunch aliases/quaternions, blending/depth flags, scheduling,
hour/distance gates and fixed-step replay. These are focused implementation
checks; complete browser/source fidelity is still required.

## Recovery checkpoint — 5 November 2026 NZDT

The restarted host cleared the temporary installation and full exports; all lab
source files survived. The common restart downtime allowance is 5m05s. Additional
reconstruction and capacity-deferred validation are recorded separately in the
shared WORKING handoff. The original prompt-to-validated-playable interval is
still open; this checkpoint does not claim a completed whole-game brief.

The initial browser pass found an unused source vertex referencing another
skeleton in a shared export buffer. Bounds now use only drawn vertices, and the
packer removes unreachable records. Earlier TypeScript checks passed and the
post-recovery focused checks pass. New full-render sessions and builds have not
run while capacity is deferred. The previously validated jump playtest was
restored independently; its evidence is not lab validation.
