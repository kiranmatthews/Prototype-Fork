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
and hundreds of procedural draw/render candidates requiring review. The named group
graphs, including callback-launched children, reach 2,369 particle definitions;
another 146 are outside those graphs.
Following direct launch roots reduces the unresolved set to 87. Those 87 are
not automatically classified as unused: computed IDs, host launch paths and
unused source variants still need distinguishing.

The restored official full export completed with 605 highest-detail GLBs,
including 24 backgrounds, and 4,002 source PNGs. All 458 expected highest-detail
joint geometries are present, with no missing joint geometries. Recovery is
complete. Tools, raw exports, packed assets, manifests and browser evidence are
now in the ignored, durable `.jak-lab-data/` folder, not `/private/tmp`.

The lab supports walking/flying between exhibits, search by area/type/name,
original/Gouraud/both views, matched animation playback, scrubbing, pause,
restart, source scale and normal/native render resolution. Direct launchers
are included separately and explicitly repeat once per second for inspection;
that frequency is a lab control, not a reconstructed host object's update rate.
The current catalogue contains 1,350 exhibits: 605 models/scenes, 675 named
particle groups and 70 direct launcher exhibits. Relevant effects expose root
height, heading, surface slope, water level and fade controls. These are explicit
inspection inputs until the actual host object's states have been ported.
The 24 level scenes also expose 2,936 named source parts through a searchable
Scene parts inspector; these remain inside their parent scene, not duplicate
asset downloads or guessed standalone objects.

## Fidelity and delivery

Models retain the complete source geometry, skin weights, morphs and animation
keys. Gouraud models sample source textures into vertex colors and use vertex
lighting, including the albedo multiplication before interpolation. The custom
material is necessary because Three r166's stock Lambert material calculates
lighting per fragment. Skinning, morphs, two-sided lighting and source alpha
settings remain supported. Per-draw vertex compaction avoids multiplying large
background buffers for every material while preserving every triangle and
attribute value. No camera-dependent LOD or mesh decimation is used. Streaming disposes
complete exhibits outside the nearby set. Original GLBs remain the authoritative
export, with hashes recorded alongside the packed assets.

The packer removes only unreferenced vertex/accessor storage, externalizes exact
image bytes and applies lossless gzip transport. Before accepting each model it
compares the complete rendered draw-order attribute/morph streams, every skin's
inverse-bind matrices, animation inputs/outputs/interpolation/channel targets,
scene/material metadata and original image bytes. It verifies gzip round trips
as well. It adds correct bounds to POSITION accessors. Sparse/compressed source
layouts without an explicit implementation fail instead of being approximated.

The complete 605-model pack passed semantic and gzip verification. Its size is:

| Content | Bytes |
| --- | ---: |
| Raw source models | 3,665,798,144 |
| Unique packed model files | 143,019,250 |
| Unique original image files | 79,944,784 |
| Catalogue | 8,816,274 |
| Packed assets and catalogue | **231,780,308** |

The standalone frontend adds approximately 671 KB before HTTP compression.
This needs a separate delivery origin rather than the main game's remaining
Pages allowance. The release coordinator owns hosting and deployment setup.
The frontend accepts `?catalogue=<URL>` with that host's CORS support.
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

All 20 source height-contact callbacks compile to checked, ordered descriptors.
They retain the exact strict/inclusive height tests, descending requirements,
contact/current launch positions, 2D/3D system selection and sound-event chance
draws. Secondary launches enter the native 32-entry shared queue after all
particle updates; callback kills retire the particle on the following step.
Fractional launch credit remains attached to the source launcher. Sound events
are recorded but are not yet connected to playback.

The runtime implements all 11 referenced birth callback names, plus 33 update
callback names (including the 20 contact callbacks). Parent-relative births,
root/primitive following, bird motion, eco fade and target/surface orientation
have focused checks. Some implementations require typed host data such as a
joint, parent particle, normal or HUD money value. The inspector reports missing
inputs. The other 35 callback names, mostly HUD behavior and sun tracking, remain
unported; name coverage does not prove complete host reconstruction.

**Unfinished fidelity requirements:**

- Inspect every source model and its
  Gouraud counterpart, all animations/material classes, and large scenes.
- Port and exercise host-dependent callbacks, runtime particle patches, dynamic
  texture assignments and screen-space HUD effects. Auxiliary distortion now
  has both renderers; two declared emitters still need host activation tracing.
  The inspector reports known gaps instead of presenting them as faithful ports.
- Trace the remaining 87 particle definitions and computed launch references.
- Static TIE/shrub prototype nodes are inventoried and inspectable. Some contain
  all level placements. Reconstruct individual instances from source metadata,
  not arbitrary connected-component splitting. Restore wind animation beyond
  the static wind-draw placement matrices retained by the exporter.
- Audit procedural renderers, texture animation, weather/time-of-day variants
  and host object states; a named-group count is not whole-game completeness.
- Verify source group duration/linger lifecycle and host placement. The raw
  group metadata is normalized to source ticks, but host lifecycle is not yet
  inferred universally from it.
- Verify blended-particle sorting, source color/alpha conventions and Gouraud
  visual fidelity across the catalogue at native and normal resolution.
  Close vegetation inspection shows that sampling cutout alpha only at vertices
  can change its visible silhouette; that material limitation remains to fix.
- Finish standalone packaging, full catalogue visual checks and
  browser review with no errors; verify final hosted behavior and hand off a
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
generated data and delivery packages out of Git. Both the normal repository
build and standalone frontend build pass. The latter includes the current
vertex-lighting, buffer-compaction and native-scene framing changes.

Focused checks currently pass:

```sh
python3 -m unittest discover -s tools/jak-lab -p 'test_*.py' -v
node tools/jak-lab/test-particle-motion.mjs
node tools/jak-lab/test-model-geometry.mjs
node tools/jak-lab/test-background-parts.mjs
node tools/jak-lab/test-distortion.mjs
npx tsc --noEmit

# Run this whole-catalogue simulation through the shared heavy-job guard.
node tools/jak-lab/audit_particles.mjs \
  --catalogue .jak-lab-data/export/catalogue.json --seconds 3 \
  --output .jak-lab-data/export/particle-audit.json
```

The packing tests exercise interleaved buffers, index remapping, exact draw
streams, normalized attributes, skin/morph/animation preservation, unindexed
geometry, corrupt-content detection and explicit unsupported-layout failure.
Source inventory tests cover direct launches, runtime patches, callback lookup,
graph reachability and reporting malformed source. Pure particle checks cover
coordinate order, relaunch aliases/quaternions, blending/depth flags, scheduling,
hour/distance gates, contact/birth callbacks, queue limits and fixed-step replay.
Eighteen Python tests, the focused Node checks, TypeScript and diff checks pass.

The whole-particle audit exercises all 745 group/direct exhibits for three
seconds each: 30,479,063 particle-state samples, no non-finite values or invalid
quaternions, and 2,428 definitions reached through their source graphs. Actual
simulation observes 2,320 current definitions, including continuation changes;
graph reach is not the same as executing a definition. It also
records 29 zero-emission exhibits and two held emitters with capacity drops.
Some have zero source rates until a host updates them; the robot-boss splash is
normally enabled for only four animation frames. These remain fidelity work,
not audit successes. The report is `.jak-lab-data/export/particle-audit.json`.

Packed browser checks cover Jak's skinned run with matched playback/scrubbing,
the buzzer, and the entire Fire Canyon background. Native-scale background
copies are separated and framed without gallery fog or a clipped far plane.
The latest normal/native passes have no console warnings or errors. Earlier
effect checks cover fountain contact/ripple launches and eco root-height/fade
controls in both renderers. Evidence is in `.jak-lab-data/evidence/`, including
`packed-browser-review.json`, `fire-canyon-packed-native.jpg`, and
`jak-packed-gouraud-{native,720p}.jpg`. These samples do not replace the remaining
whole-catalogue visual/source audit.

## Recovery checkpoint — 5 November 2026 NZDT

The restarted host cleared the temporary installation and full exports; all lab
source files survived. The common restart downtime allowance is 5m05s. Additional
reconstruction and capacity-deferred validation are recorded separately in the
shared WORKING handoff. Full extraction, packing, builds and the browser checks
above have now completed. The original prompt-to-validated-playable interval is
still open; this checkpoint does not claim a completed whole-game brief.

The initial browser pass found an unused source vertex referencing another
skeleton in a shared export buffer. Bounds now use only drawn vertices, and the
packer removes unreachable records. Shared-accessor row caching also eliminated
repeated decoding of the same 817,914-vertex background data across hundreds of
draws; full packing then completed with exact verification. The previously
validated jump playtest was restored independently; its evidence is not lab
validation. No lab or animation changes have been integrated or published.

## Source tracker timing — verified local increment

The inspector supports explicit `part-tracker` replay timing from the source
initializer and process loop. State bodies now retain their owner/context in
the inventory, increasing recorded group uses from 290 to 399. The latest scan
contains 113 tracker launch sites: 82 have known timing without custom callback,
userdata or tracked-target dependencies. They cover 64 groups and 65 distinct
duration/linger combinations. The remaining 31 sites retain their source forms
and reasons instead of receiving guessed replay behavior. The latest procedural
candidate count is 338 (the previous generated catalogue had 335); these are
review candidates, not a count of completed effects.

The inspector can choose held emission or a source burst. Source mode emits for
the initializer's positive duration override, otherwise the group's duration;
then it runs the source linger and final notify/suspend interval. Cleanup kills
only particles owned by the launch control. Unkeyed callback splashes remain in
the shared simulation. Each suspended phase rounds independently to fixed
frames. Launch placement is normalized to the exhibit origin; this does not
claim reconstruction of the full host scene or later external state changes.

Eighteen focused Python tests, the particle lifecycle regression and TypeScript
pass. The guarded packed-metadata refresh, full replay audit, builds and browser
review have completed. The authoritative raw catalogue and packed catalogue now
contain the same source replay metadata. Model and image bytes are unchanged.
All 65 replay configurations across 64 groups pass 26,599 fixed frames and
2,183,690 particle samples, with no non-finite states, zero-emission cases or
capacity drops. This source-burst audit is separate from the held-emission audit.

The browser review exercised crate group 71's five-tick burst and its twenty-tick
Misty Island override, 1,500-tick linger, final cleanup and restart. The first
frame contains 30 particles; cleanup reaches zero, and restart restores 30.
Normal 720p and native 2560×1440 views have no console warnings/errors. Evidence:
`.jak-lab-data/evidence/host-replay-browser.json` and the two `tracker-crate-*`
images. The earlier capacity deferral is resolved, not an outstanding job.

Source analysis can now be refreshed without re-reading multi-GB model files,
but only when all 533 source-file hashes match the previous inventory:

```sh
python3 tools/jak-lab/catalogue.py \
  --project .jak-lab-data/export/opengoal \
  --refresh-inventory-from .jak-lab-data/export/catalogue.json \
  --output .jak-lab-data/export/catalogue.next.json
```

The packer also supports a metadata-only refresh. It checks every source asset
identity against the verified pack, every prior semantic report entry, and every
stored asset's bytes/hash before atomically replacing the catalogue. Changed
assets fail and require full packing. For future source-only changes, run these
through the shared resource guard before the standalone build/browser review:

```sh
python3 tools/jak-lab/pack_assets.py \
  --catalogue .jak-lab-data/export/catalogue.next.json \
  --output .jak-lab-data/export/packed --refresh-metadata

node tools/jak-lab/audit_host_replays.mjs \
  --catalogue .jak-lab-data/export/catalogue.next.json \
  --output .jak-lab-data/export/host-replay-audit.json
```

After those checks pass, promote `catalogue.next.json` to the raw catalogue and
refresh the delivery byte/hash evidence. This promotion is complete for the
tracker increment. The remaining 87 unassigned definitions
include 69 with declared birth counts and 18 continuation-only definitions;
tracing their computed/unused host paths is still required.

## Auxiliary distortion — source geometry and Gouraud alternative

The auxiliary sprite list is a framebuffer-distortion pass, not an ordinary
textured puff. Its port follows the local `sprite-distort.gc` and particle
launcher sources plus the renderer pinned to OpenGOAL commit
`b6c8430c0b0a5cb139b939bcf0ffd25285b896c7`:
[Sprite3_Distort.cpp](https://github.com/open-goal/jak-project/blob/b6c8430c0b0a5cb139b939bcf0ffd25285b896c7/game/graphics/opengl_renderer/sprite/Sprite3_Distort.cpp).
Six renderer/shader source hashes are recorded in the ignored
`.jak-lab-data/native-source/distortion-provenance.json`.

The source reuses `rot-x` for a 3–11 slice count and the RGB fields for outer,
inner-geometry and inner-sampling radii. The lab preserves its continuous
five-vertices-per-wedge triangle strip, including joins. Launch/relaunch installs
the implicit auxiliary callback, clears alpha-death and zeros alpha/fade-alpha;
the queued sprite remains a live reference to the post-integration values.
Initial launch clamps slices, while relaunch retains the draw-time fallback.
The source's 256-entry auxiliary capacity applies independently to each lab
exhibit simulation; the mirrored comparison does not consume a second slot.

Rendering retains the scene depth buffer and source order: scene, frozen
framebuffer copy, auxiliary distorters, ordinary sprites. Original samples the
frozen image per fragment. Gouraud samples it at the same mesh's vertices and
interpolates their colors, with no framebuffer lookup in its fragment shader.
The Gouraud variant is deliberately a color approximation of refraction, not
pixel-identical distortion. A vertex displacement-strength mask leaves the
outer ring/center untouched and makes a zero warp disappear exactly. The
inspection camera adapts the source NTSC projection/radius cap; reconstruction
of the original host camera and scene is still separate fidelity work.

The complete particle audit observes 644,749 auxiliary samples and 134 of 136
declared auxiliary emitters, with no auxiliary-capacity drops. Definition 1730
starts disabled in the steam-cap plume; its inspected host update spawns the
plume but contains no activation for that item. Definition 1433 has no literal launch
path found yet. Neither is silently labeled unused. Observed auxiliary IDs also
include continuation definitions that inherit the callback.

Focused checks cover initial/relaunch flags, alpha-zero lifetime, live sprite
references, the source capacity, all slice topologies, shared comparison meshes,
draw order, resizing and restoration after renderer exceptions. The dev-only
`tools/jak-lab/distortion-review.html` fixture also compares actual GPU pixels at
960×540, 1920×1080 and 640×360. Original zero-warp color differs by at most one
byte (the source's 256/255 multiplier); Gouraud zero warp differs by zero bytes.
Foreground depth and later-sprite errors are zero at all sizes. Actual warps
change the framebuffer, and original/Gouraud visibly differ as intended.
The report is `.jak-lab-data/evidence/distortion-gpu-checks.json`.

Full-render checks cover Fire Canyon group 250 and sunken heatpipe group 332 in
both views, normal/native resolution and original world scale. Inspection
placement keeps the bounded particles above their pedestal and separates the
comparison copies at native scale. No console warnings/errors. Images and the
combined report are under `.jak-lab-data/evidence/distortion-*`. These checked
examples do not claim whole-catalogue visual verification.

## Background props and vegetation — source part inspection

The pinned
[background exporter](https://github.com/open-goal/jak-project/blob/b6c8430c0b0a5cb139b939bcf0ffd25285b896c7/decompiler/level_extractor/fr3_to_gltf.cpp)
groups TIE draw ranges by prototype index and shrub draws by prototype index.
Each exported child node contains that prototype's complete level placements.
Wind children instead identify draw/instance-group pairs and retain their
original placement matrices. These boundaries are authoritative; disconnected
mesh components are not being guessed to be separate objects. The fetched
exporter matched Git blob `acf73dc5de073a679967f0119b3ed126747e1b44` and SHA-256
`744b4d5255dfff32f61ed65e3053715864239b81e9049487bd8abfe67a420f21`.

A JSON-header audit across all 24 raw background GLBs finds **2,936 parts**:
1,175 TIE prototype groups, 299 shrub/detail groups and 1,462 wind draw groups.
Shrub groups include plants, rocks and other details; they are not all vegetation.
The report preserves source node IDs, tree names, triangle counts and matrix
presence at `.jak-lab-data/export/background-parts.json`. Reproduce with:

```sh
python3 tools/jak-lab/inventory_backgrounds.py \
  --catalogue .jak-lab-data/export/catalogue.json \
  --exported .jak-lab-data/export/opengoal/decompiler_out/jak1 \
  --output .jak-lab-data/export/background-parts.json
```

Open any level scene and expand **Scene parts**. Search the original source name,
select a prop/detail/wind draw, and switch Original/Gouraud/Both as usual.
Selection changes visibility in both hierarchies, without replacing geometry,
transforming individual placements, changing material groups or decoding another
asset. Complete level scene restores every original visibility value. Node IDs
are retained before Three sanitizes names; `?exhibit=model:beach/beach-background&part=node:54`
reopens the Sentinel Beach eco-valve prototype directly.

Repeated props may be spread over hundreds of metres. **Close view** frames the
first actual source triangle; double-clicking another rendered surface moves the
camera there. This is camera inspection, not instance extraction. Focus exhibit
restores the fitted view. Close inspection adjusts the camera's near plane and
minimum orbit distance to the display scale. Source bounds ignore the gallery's
placement/scale and measure only visible, referenced vertices; wind matrices and
skinned bind transforms remain included.

Focused checks verify source identities with duplicate display names, complete
multi-mesh placements, mirrored isolation/restoration, preserved hidden nodes,
unchanged matrices/geometry, unknown-selection rejection, bounds under a scaled
and rotated gallery parent, wind matrices and articulated skin bounds. Existing
exact geometry-compaction checks, TypeScript, the required normal build and the
final standalone build pass. No full-suite run or generated-asset changes.

Browser checks find the same 295 source parts in Sentinel Beach as the header
audit. They exercise the eco valve (node 54, 840 triangles), idol dome (67, 864),
wind draw (76, 80) and exotic plant (328, 740), direct links, filtering, separate
render modes, close views, normal/native resolution and native world scale.
Restoring the complete scene gives its original 501.86 × 171.85 × 520.66 m bounds.
Console warnings/errors are empty. Evidence is
`.jak-lab-data/evidence/background-parts-browser-review.json` and the
`background-part*` / `background-plant*` images. The close plant view revealed the
Gouraud cutout-alpha limitation noted above; individual-instance recovery and
full scene/material fidelity remain unfinished.
