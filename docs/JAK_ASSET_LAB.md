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
birth/update callbacks have source definitions. The audit additionally found 97
direct launch sites, 126 referenced direct particle IDs (101 defined), 393 runtime
particle patch sites and hundreds of procedural draw/render candidates requiring
review. The named group
graphs, including callback-launched children, reach 2,369 particle definitions;
another 146 are outside those graphs.
Following direct launch roots leaves 56 definitions outside those graphs.
The mesh-disappearance path now accounts for three of those (41–43), leaving
53 to distinguish between computed/host launch paths and unused source variants.
The inventory's group/direct-only coverage remains explicitly scoped to those
two launcher families.

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
The current catalogue contains 1,426 exhibits: 605 models/scenes, 675 named
particle groups, 98 direct launcher exhibits, two source draw assemblies,
two complete screen-HUD assemblies and 44 mesh-disappearance exhibits.
Three explicitly empty direct definitions stay in the source audit without
blank visual exhibits; 25 referenced IDs have no source definition and remain
flagged for review. Relevant effects expose root height, heading, surface slope, water level and fade controls. These are explicit
inspection inputs until the actual host object's states have been ported.
The 24 level scenes also expose 2,936 named source parts through a searchable
Scene parts inspector; these remain inside their parent scene, not duplicate
asset downloads or guessed standalone objects.

## Fidelity and delivery

Models retain the complete source geometry, skin weights, morphs and animation
keys. Gouraud models sample source textures into vertex colors and use vertex
lighting, including the albedo multiplication before interpolation. The custom
material is necessary because Three r166's stock Lambert material calculates
lighting per fragment. Source cutout/transparency masks remain per fragment;
sampling only their corner values would change leaf and hole silhouettes. The
Gouraud fragment shader samples only opacity, not diffuse RGB. Opaque materials
omit the diffuse map. Skinning, morphs, two-sided lighting and source alpha
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
| Mesh-disappearance emission streams | 3,969,540 |
| Catalogue | 9,340,163 |
| Packed assets and catalogue | **236,273,737** |

The standalone frontend adds 729,976 bytes before HTTP compression.
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

The runtime implements all 11 referenced birth callback names, plus 52 update
callback names (including the 20 contact callbacks). Parent-relative births,
root/primitive following, bird motion, eco fade and target/surface orientation
have focused checks. Some implementations require typed host data such as a
joint, parent particle, normal or HUD money value. The inspector reports missing
inputs. Five Zoomer speed/heat callbacks now use explicit inspection inputs.
Sun tracking now uses the source orbits, colour selectors and host lifecycle.
The four power-cell HUD callbacks use the actual animated source joints and
screen-space host, including arrival, timeout and cleanup.
Nine health, eco-timer and scout-fly callbacks now use source screen placement,
live inspection values and the original host lifecycle.
The other 16 callback names, all HUD behavior, remain
unported; name coverage does not prove complete host reconstruction.

**Unfinished fidelity requirements:**

- Inspect every source model and its
  Gouraud counterpart, all animations/material classes, and large scenes.
- Port and exercise host-dependent callbacks, runtime particle patches, dynamic
  texture assignments and screen-space HUD effects. Auxiliary distortion now
  has both renderers; two declared emitters still need host activation tracing.
  The inspector reports known gaps instead of presenting them as faithful ports.
- Trace the remaining 53 particle definitions and computed launch references.
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
  Source cutout coverage is now retained in Gouraud models; the wider material
  and lighting review remains open.
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
node tools/jak-lab/test-racer-hud.mjs --catalogue .jak-lab-data/export/catalogue.json
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
`background-part*` / `background-plant*` images. Those plant images predate the
opacity correction below. Individual-instance recovery and full scene/material
fidelity remain unfinished.

## Gouraud opacity coverage

Close inspection exposed a real silhouette error: baking texture alpha at only
triangle corners could erase whole leaves. Gouraud materials now preserve the
source texture's alpha at fragments while still computing RGB and lighting at
vertices. Existing UV channels/transforms, separate green-channel alpha maps,
vertex alpha, alpha test, opacity and blend modes remain in their original
pipeline. Texture alpha is no longer also baked into vertex alpha, avoiding
double multiplication. Opaque materials retain no diffuse texture map. No
triangles, UVs, transforms, images or source asset bytes change.

The real WebGL fixture at `tools/jak-lab/material-review.html` compares framebuffer
alpha for opaque, cutout, blended and separate-alpha/UV1 materials. Across
320×240 and 640×480, all eight cases have zero alpha error and zero coverage
mismatches, including transformed UVs and partially transparent vertex colors.
Both texture masks and vertex alpha are exercised. The fixture also rejects an
empty render or an unnecessary opaque diffuse map. Strict fixture TypeScript
passes after explicitly typing its interchangeable material slot.

Sentinel Beach's `bch-exotic-plant.mb` (node 328, three draws / 740 triangles) was
reviewed with matching close views in Original and Gouraud at native 2560×1440,
then Gouraud at 1280×720. Leaf openings and outlines remain intact; lighting and
RGB are intentionally the vertex approximation. Console warnings/errors are
empty. Evidence: `.jak-lab-data/evidence/material-opacity-gpu.json`,
`material-plant-browser.json` and `material-plant-*.png`. Earlier screenshots
must not be used as evidence of this correction. Full-catalogue material review
and the original whole-brief elapsed interval remain open.

The guarded normal build and standalone build pass, as do root TypeScript,
strict fixture TypeScript and diff checks. No whole-catalogue simulation rerun
was needed for a material-only change. Current frontend: 670,731 bytes; combined
with the unchanged packed assets/catalogue: 232,451,039 bytes before hosting
metadata. Hashes and logs are in `material-opacity-delivery.json` and
`material-opacity-build.log` under the evidence directory.

## Zoomer speed and heat callbacks

The five referenced racer HUD callbacks now follow
`levels/racer_common/racer-part.gc:11–137` from the pinned source. The speed dial
uses its eight nonlinear calibration points, clamped interpolation, asymmetric
seek rates, signed integer angle wrapping and the immediate-needle branch while
the HUD offset is at least ten. Native `deg-seek`'s exact half-turn case is
preserved. Heat drives the dial and three pie slices, including the two lower
angle clamps, separate 60%/80% color thresholds and eight-frame flashing. The
dial flashes strictly above 80%; pie slices flash at 80%. Overheat extrapolation
is preserved. These are source state rules, not inferred target acceleration.

Effect inputs expose Zoomer speed (metres/second), normalized heat (percent),
and HUD entering. Updates preserve the current needle so its source seek can
play. Restart retains the inputs and replays the initial pose. Original and
Gouraud share the same state and blink clock. Flash phase uses the lab's 60 Hz
clock; it is not synchronized to an unported running game's global frame count.
The HUD layer is framed from its actual sprite size, since the source's 100 m
pie-group sphere is a culling bound. Source dimensions/positions and world-scale
inspection remain intact.

The UI still explicitly reports **Screen-space host layout**. These are isolated
layers in the gallery; the complete speed/heat instrument layout, HVDF transforms,
HUD entrance positions and their underlying gameplay host are not yet recreated.
Source texture/Gouraud edge approximation and blended-layer sorting remain part
of the wider rendering audit.

Focused regression checks cover the calibration landmarks, clamping, signed
seek rates, exact half-turn, HUD entry boundary, heat angles/colors/flash
thresholds, overheat, restart and 30/60/120 Hz fixed-step parity. Fifteen cases
exercise the actual source groups 108, 112 and 114 for 480 frames, observing all
five callbacks with finite values and no capacity drops. Existing particle
motion/lifecycle and auxiliary-distortion regressions pass. The catalogue and
source asset bytes are unchanged; no whole-catalogue extraction or audit rerun
was needed for these scoped callbacks.

Browser review covers the 30 m/s needle at 151°, immediate 42 m/s at 275°, the
80% heat needle at 127°, 70% orange pie slices and both red/pale 95% flash phases.
Paired Original/Gouraud views, native 2560×1440 and normal 1280×720 rendering
pass with an empty warning/error log. The pale-phase capture uses the visible
source clock at 45 ticks to verify the shared blink state. Evidence:
`.jak-lab-data/evidence/racer-hud-{checks,browser,provenance}.json` and
`racer-*.png`. The original whole-game brief remains in progress.

Root TypeScript, the required normal build and the standalone build pass under
the shared resource guard. The new frontend is 674,390 bytes; combined with the
unchanged asset/catalogue pack it is 232,454,698 bytes before host metadata.
Current hashes and logs: `racer-hud-delivery.json` and `racer-hud-build.log`.
No shared game runtime, level data, package configuration or held D animation
code changes. All test tabs and guarded servers are closed after review.

## Source eco beam, sage-cage bars and sprite geometry

Two additional exhibits now execute the source host draw calls that assemble
these effects. `effect:30001` follows `draw-eco-beam` in
`engine/common-obs/generic-obs.gc:1483`: three 3D planes at the endpoint midpoint,
successive 60-degree local rolls, and the source length patched into particle
2528. Inspection controls set length, slope and heading without changing the
source launcher's random ranges or shared fractional emission credit.
`effect:30002` follows `citb-sagecage-draw-bars` in
`levels/citadel/citadel-sages.gc:34`: twelve exact authored bar positions, the
source joint/camera rotation and direct particle 2473 emission. Both renew at
60 Hz and retain the source five-tick lifetime; disabling emission clears them
on the next simulation frame. Original and Gouraud share one simulation.

These are host-driven assemblies, not extra source defpartgroups. The catalogue
still contains 675 original groups; the viewer has 1,352 exhibits including the
two derived assemblies. Their provenance identifies the host function and
particle. The beam's inspection endpoints replace its gameplay targets; Jungle
camera gating/collision/blue-eco collection remain unported. The isolated cage
bars use an inspection joint heading. Its mesh, skeleton animation, sound and
cloning behavior remain separate or unassembled. Neither exhibit closes those
remaining whole-game fidelity gaps.

The pinned renderer's `sprite3_3d.vert` and source `sprite.gc:292–307` also expose
two shared geometry errors. 3D sprites use the local XZ plane, with Y as its
normal axis. Two-dimensional corner mode 4 anchors the left edge, rather than
centering the quad. Both rendering variants now use those conventions; 99
reachable non-distortion 2D definitions specify that anchor. The shader and
renderer downloads are Git-blob verified against the pinned OpenGOAL tree;
hashes and URLs are in `.jak-lab-data/native-source/sprite-provenance.json`.

The focused source-catalogue regression verifies beam endpoints, plane angles,
cage positions/heights, camera rotation, per-call quaternion/field isolation,
shared fractional credit, source retirement, enable/restart and 30/60/120 Hz
parity. The actual SpriteBatch GPU fixture compares both variants with independent
CPU source-corner geometry in seven configurations and two resolutions: all
28 comparisons pass, with at most one edge pixel difference. Negative controls
reject the old XY plane and centered anchor. This verifies geometry coverage,
not every source texture/projection/fog behavior.

Browser review covers beam length 20 m, slope 30 degrees and heading 40 degrees,
cage heading 45 degrees, emission off/on/restart, Original/Gouraud/Both, native
2560×1440 and normal 1280×720. Existing exit-chamber ripples now lie on the source
plane; the Zoomer needle retains its 151-degree pose at 30 m/s with the corrected
pivot. No console warnings/errors or capacity drops. Evidence is
`.jak-lab-data/evidence/source-assemblies-{checks,browser}.json`,
`sprite-geometry-gpu.json` and the `source-beam-*`, `source-cage-*`,
`source-ripple-*` and `source-needle-*` images. Those selected checks do not
constitute whole-catalogue visual approval.

Root and strict fixture TypeScript, focused particle/source-assembly checks,
the required normal build and standalone build pass. Frontend size is 681,357
bytes; the combined unchanged asset pack plus frontend is 232,461,665 bytes
before hosting metadata. Hashes/logs are in `source-assembly-delivery.json` and
`source-assembly-build.log`. Test tabs and the guarded server are closed; the
user's D playtest remains open. No shared game runtime, level data, extracted
asset bytes or held D code changed. No publication; the whole-game goal is open.


## Lexical launch recovery — material variants and eco powerups

The source inventory now follows local launcher/system aliases through parallel
`let`, sequential `let*`, casts, conditional return values and finite integer
index choices. This recovers the cage's aliased 3D launcher, ordinary/jump debris
selected by foot-contact material, Zoomer surface/wall effects, and the two-way
eco-powerup sprite selections. A branch's incidental table reads are not treated
as its returned launcher. Shadowed locals, argument evaluation order, assignment
and unknown mutations are tracked; loop-carried mutations remain conservative.
Quoted forms and macro templates are not runtime launch/patch sites. Callback
graph edges use actual resolved launch arguments and exclude nested function
definitions. Existing callback graphs/programs are unchanged on the real source.

There are **28 new emitting direct exhibits**, bringing the lab to **1,380**.
Particles 97, 98 and 99 are explicitly empty `defpart` declarations, so they stay
in source coverage without fabricated visual exhibits. The same branch analysis
finds 25 table IDs without source definitions; they remain explicitly unresolved
rather than being replaced with nearby effects. Five computed launcher sites and
one computed system site still require host/dispatcher analysis. The remaining
56 definitions outside group/direct reachability are not declared unused.

All 533 source file hashes match the previously inventoried tree. The source
particle/group/model/texture definitions and compiled contact programs are exact
matches; only source-analysis metadata changes. The verified metadata refresh
rehashes every existing packed asset and changes no geometry, images, animation
or material data. The refreshed raw catalogue is promoted only after the new
emitters pass simulation and selected browser checks; the previous raw catalogue
is retained as `catalogue.before-aliases.json`.

Twenty-two focused inventory/compiler/replay tests cover real lookup semantics
and negative cases: shadowing, parallel/sequential binding, conditional values,
non-returned table reads, partial unknown IDs, unknown systems, quoted code,
callback edges, mutation and empty definitions. The audit's new `--exhibits`
option rejects unknown IDs and labels scoped reports explicitly. All 28 added
emitters pass 5,040 fixed steps with 7,392 finite particle samples, zero capacity
or auxiliary drops and no zero-emission cases. This supplements the previous
whole-catalogue audit; it does not relabel that older run as current full coverage.

Browser checks confirm catalogue search and paired Original/Gouraud rendering
for yellow eco 269, snow debris 2250, water puff 2208 and metal sparks 2226. Eco
and snow are captured at native 2560×1440 and 720p; all four are checked at native
resolution with no console warnings/errors. The UI retains the time-of-day color
and host emission-patch gaps. Evidence: `source-alias-resolution.json`,
`source-alias-particle-audit.json`, `source-alias-browser.json`,
`source-alias-validation.log` and `recovered-*.png` under `.jak-lab-data/evidence/`.

The normal/standalone builds from `947b2475` remain applicable: frontend and
runtime sources are unchanged. The new packed catalogue is 8,818,828 bytes, SHA-256
`363fdb1bb2d461fa15eb59397bf5451cda30c7207273d3ee63b0ba3d2d1d9eb7`;
packed assets/catalogue total 231,782,862 bytes. With the unchanged 681,357-byte
frontend the deliverable is 232,464,219 bytes before hosting metadata. Updated
hashes are in `source-alias-delivery.json`. No redundant build or full simulation
audit; no publication. The original whole-game objective remains incomplete.

## Source particle lighting and isolated inspection

The lab now extracts all 17 light tables, seven hourly interpolation tables and
25 mood contexts from the pinned `mood-tables.gc`, with level ownership from
`level-info.gc`. Its 26 selectable presets correspond to actual
`update-mood-palette` / `update-mood-quick` call sites, including fixed cave and
boss snapshots. Unspecified vector components remain zero; unused snapshots
are not assigned invented hours. Each record retains source lines and hashes.
This adds metadata only: the 605 models, 4,002 images and 1,380 exhibits are
unchanged, and every stored asset hash passes the packing refresh.

`particleLighting.ts` follows the original hourly snapshot/morph selection and
RGB interpolation. Only an all-zero interpolated particle colour falls back to
the source ambient/directional-light formula. `ParticleMotion` applies that
colour to RGB and RGB fade at birth, after birth callbacks, with the source
pre-callback 255 RGB clamp. Alpha is untouched. Auxiliary sprite RGB stores
distortion radii and bypasses both clamp and tint. Relaunch uses the old flags
and the source 99999 sentinel: unspecified fields retain their already lit live
values, while replacement fields use the current lighting. Live particles are
not multiplied again each frame. The translated native launcher is Git-blob
verified at `d6f0d33d310c854fc227568d1be366fac34de599` in the pinned OpenGOAL
commit; `sparticle-launcher.gc:456` supplies the relaunch rules.

Effect inputs exposes base particle lighting and time of day, with source
provenance. Changing either restarts the selected simulation; both render
variants still read the same particles. The hour also drives existing source
emission masks. These are **immutable base palettes**, not reconstructed local
lightning/flames, quest-driven table changes, target/camera state, cross-level
blends or complete scene lighting. The UI states that limitation. There are 360
definitions explicitly requesting this lighting without the auxiliary flag;
that count does not prove all their host behavior is complete.

Browser review also revealed neighbouring large effects washing over the selected
exhibit. Focus now streams and renders only the selected complete exhibit.
Explore restores nearby exhibits; no geometry, animation or particle silhouette
is reduced. This makes isolated colour comparisons readable while preserving
the explorable collection. Gallery spacing/placement and whole-catalogue visual
review remain open work.

Validation includes 24 Python inventory/compiler/replay tests, source birth and
partial-relaunch cases in 2D/3D, callback ordering, alpha/auxiliary exclusions,
palette fallback/precedence, hour wrapping and 2,496 palette samples. Four real
source groups at three hours produce 762,012 paired particle samples: lighting
changes RGB while positions, orientations, alpha and lifetimes match exactly;
all values remain finite and no capacity/auxiliary drops occur. Existing
particle, distortion, Zoomer HUD and source-assembly checks pass. These are
focused checks, not a rerun or replacement of the full catalogue audit.

Native 2560×1440 and normal 1280×720 browser checks compare the same 60-particle,
5-tick snow burst. Sentinel Beach noon gives RGB multipliers
`0.6825 / 0.6710 / 0.6782`; midnight gives `0.3082 / 0.4115 / 0.7335` in both
variants. Spider Cave's fixed snapshot stays `0.1750 / 0.3000 / 0.3750` across
those hours. Original/Gouraud switching, input edits, restart and Focus/Explore
pass, with seven nearby exhibits restored in Explore and one in Focus. Console
warnings/errors are empty. The actual final production bundle independently
loads the packed archive and passes the native midnight check without errors.

Normal build, final root TypeScript and standalone build pass. The final lab-only
UI corrections do not change the normal game's bundle inputs. Frontend size is
686,185 bytes; packed catalogue is 8,859,177 bytes and the combined deliverable
is 232,509,396 bytes before host metadata. The raw catalogue is promoted after
validation, with `catalogue.before-lighting.json` retained. Evidence and exact
hashes are in `.jak-lab-data/evidence/particle-lighting-{checks,provenance,browser,
production,delivery}.json`, the validation/final-build logs and corresponding
PNG captures. Test tabs and guarded servers are closed; the user's jump tab is
preserved. Local only, with no shared game runtime or level-pack edits and no
publication. The whole-game objective remains incomplete.


## Source mesh-disappearance effects

The lab now includes 44 disappearance exhibits: 42 source models with 48
compatible animation markers, plus inspection entries for Jak and the Sunken
City button warp profiles. Five `death-info` definitions retain their exact
vertex skip, timer, mesh overlap, particle ID and sound name. The puppy's actual
animation requests `death-default`; the separately authored
`death-beach-puppy` profile is available without substituting it for that marker.

`extract_art_data.py` runs the official extractor on all 360 art groups in its
NTSC-v1 extraction configuration, with level/text/image processing disabled.
Every dumped object was matched byte-for-byte to the supplied disc archives;
its manifest retains archive paths, object offsets and raw/assembly hashes.
`merc_death.py` resolves linked assembly labels and unpacks the merc input
vertices and alternating fragment buffers. Same-fragment copies alias existing
positions; cross-fragment copies append additional emission vertices. Each
complete input domain matches exactly one region of its source GLB, including
vertices not referenced by any triangle. All 581 foreground models match:
669,831 input vertices, 58,972 cross-fragment copies and 168 input vertices
absent from the rendered triangle stream. Their exact source skin weights and
morph positions are retained. All 360 assembly hashes still match the final
extraction after decoding.

`attach_merc_death.py` filters art-group effect markers to clips actually present
on each model and writes 418 unique, content-addressed gzip sidecars (3,969,540
bytes). The packer verifies both compressed and decoded hashes and lengths.
Both raw and packed local-serving allowlists include these declared sidecars;
focused checks retain undeclared-file and resolved-symlink containment.
The existing 605 model files and 4,002 source images are unchanged. The raw
catalogue now includes `meshDeaths`; all its other sections exactly match the
previous lighting catalogue. Reproduction, using the same guarded heavy-job
workflow as the other extraction steps:

```sh
python3 tools/jak-lab/extract_art_data.py --installation .jak-lab-data/installation --game-data .jak-lab-data/export/iso-data/jak1 --output .jak-lab-data/mesh-death-source
python3 tools/jak-lab/merc_death.py --assembly-directory .jak-lab-data/mesh-death-source/opengoal/decompiler_out/jak1 --source-models .jak-lab-data/export/opengoal/decompiler_out/jak1/levels --catalogue .jak-lab-data/export/catalogue.json --output .jak-lab-data/mesh-death-source/all-topology
python3 tools/jak-lab/attach_merc_death.py --catalogue .jak-lab-data/export/catalogue.json --topology .jak-lab-data/mesh-death-source/all-topology --project .jak-lab-data/export/opengoal --asset-output .jak-lab-data/export/opengoal/decompiler_out/jak1 --output .jak-lab-data/export/catalogue.death.json
python3 tools/jak-lab/pack_assets.py --catalogue .jak-lab-data/export/catalogue.death.json --exported .jak-lab-data/export/opengoal/decompiler_out/jak1 --output .jak-lab-data/export/packed --refresh-metadata
```

The runtime samples the complete animated source vertex stream, including
morphing, and sends the same particles to the original and texture-free Gouraud
sprite batches. It ports the dedicated death launcher: one unkeyed additive
sprite per selected vertex, source RGB clamp/tint, no ordinary birth/cone/count
processing, and cached alpha restored on the next particle update. Emission
keeps the source per-effect offset, fragment residual and appended-copy order.
The original `falls-particle` texture and 41 → 42 → 43 lifecycle are retained.
Source markers, overlap and timers run at 60 Hz with normal frame load. The
inspection uses the area's base noon palette; world movement, collision,
gameplay host transitions, sound playback and the original global random stream
are not reconstructed by these cards. Manual profile choices are labeled
inspection controls, not claimed as original gameplay sequences.

Replay is one-shot, with a bounded settling tail and a timeline that remains
at the end. Restart/backward scrub reset the pose, RNG, emission and mesh
visibility; Animation only clears disappearance state. The initial animated
pose determines framing, so the snake's long straight bind pose no longer
moves its coiled animation out of the view. Focus hides the redundant gallery
caption; Explore restores labels and nearby complete exhibits.

Validation includes ten focused Python tests, all 581 streams across all five
profiles and source ages (7,667,361 selected vertices), and an independent
skinned/morphed/world-transform fixture. The fixture checks delayed alpha,
trigger/overlap boundaries, end/restart, deterministic backward scrub and off
reset. Puppy, snake and button lifecycles cover 633,207 finite particle samples,
all three stages and zero capacity drops; all particles expire. The native
translated merc renderer, exporter and structure code used for the port are
Git-blob verified against pinned OpenGOAL commit
`b6c8430c0b0a5cb139b939bcf0ffd25285b896c7`; their provenance records remain beside
the local evidence.

Browser checks cover puppy/snake animation overlap and disappearance, Jak/button
inspection warps, original/Gouraud/both, source scale, normal 720p and native
2560×1440 rendering, one-shot completion, restart, backward scrub and disabling
the effect. These are representative visual checks, not a visual audit of all
581 models or all 48 markers. Console warnings/errors are empty. The normal
build passes; final lab-only UI changes pass root TypeScript and the independent
production build without changing the normal game bundle inputs. No full suite
or publication. Evidence is in `.jak-lab-data/evidence/mesh-death-*`, including
browser snapshots, PNGs, numerical checks, build logs and the delivery manifest.

The packed catalogue is 9,310,863 bytes; assets plus catalogue total 236,244,437
bytes. The final frontend is 695,691 bytes, for 236,940,128 bytes before hosting
metadata. The previous raw catalogue is retained as
`catalogue.before-mesh-death.json`. This is a validated local increment; the
whole-game objective and final delivery remain open. Remaining work includes
53 definitions outside the resolved group/direct/death paths, unresolved host
launches, 30 callbacks, dynamic texture/lighting state, full source assemblies,
procedural renderers, individual prop-instance recovery and broad visual review.

## Sun and green-sun host behaviour — 5 November 2026 NZDT

Groups 35 and 36 now use `sparticle-track-sun` and the actual
`time-of-day-update` spawn/kill conditions. They spawn once while their source
window is active, retain their infinite-lifetime particles, and free the keyed
group when the hour or fade makes it inactive. The normal sun has three live
layers. The green sun's authored zero-alpha core dies under its original bit2
flag, leaving two flares; it is not replaced with a fabricated centre.

The catalogue records the literal sky orbit setup, visibility predicates and
six source-file hashes. The two solar orbits use the source float32 arithmetic,
signed-angle truncation and sine/cosine polynomial approximations. The callback
positions sprites at source-camera + sky-position × 4096, updates nonzero alpha
from sun-fade, and replaces RGB only for the normal sun's core and two quarter-
intensity flares. Green flares retain their authored RGB. Opposing rotation,
textures, sprite dimensions and additive blending remain source-owned.

Fourteen sun tables, their eight snapshots each, 26 actual cycle/quick selectors
and 27 level fade records are now extracted. Sun cycles read
`sky-texture-interp`, independently of particle `palette-interp`; quick updates
read their distinct sun snapshot argument. The final-boss sun's snapshot 3 is
therefore not confused with its particle-lighting snapshot 5. Inputs allow hour,
source sun preset and fade inspection. Selecting a preset restores the first
associated level's authored initial fade; contexts without a directly associated
level use an explicit isolated-inspection fade of one. Dynamic mood mutations,
area transitions and full sky/terrain occlusion remain unfinished.

The gallery recentres each complete sun for inspection. Simulation retains its
original camera-relative position and 9,950 m orbit-distance parameter; the
source camera is the origin in this isolated view. Framing uses the full rotating
sprite dimensions instead of the unrelated 70 m source culling sphere. Original
world-scale viewing remains available. Both representations share the same
particles, with source texture sampling in Original and the existing adaptive
vertex-colour mesh in Gouraud. No geometry reduction or asset-byte changes.

Validation:

- Five parser/selector fixtures pass, including rejection of unsupported gates,
  computed thresholds and wrong group bindings. An independent evaluator of the
  pinned GOAL function AST produces 1,290 orbit samples; the TypeScript result
  matches every component exactly.
- The sun regression covers 6,192 frames and 9,567 particle samples: strict and
  inclusive hour boundaries, camera translation, persistent identity, opposing
  rotations, source alpha behaviour, cleanup/reactivation, all 26 presets and
  deterministic restart, with no capacity drops or source-data mutations.
- Existing particle-motion and lighting checks pass. Root TypeScript, required
  normal build and final independent production build pass. Normal output has
  1,750 files / 765.2 MiB, offline version `aac7e093c7ad5a8e334e`. No full suite.
- Twenty-three browser observations cover original/Gouraud/both, 1280×720 and
  native 2560×1440, original world scale, palette/fade/hour controls, live rotation,
  restart and source-window cleanup. The final green sun remains at two live
  particles after 69.9 source seconds. Console warnings/errors are empty.

Evidence is `.jak-lab-data/evidence/sun-{checks,orbit-oracle,browser,delivery}.json`,
the sun build logs and `sun-*.png` / `green-sun-*.png`. The packed catalogue is
9,332,184 bytes; unchanged assets are 226,933,574 bytes. The final frontend is
702,936 bytes, for 236,968,694 bytes before hosting metadata. The old raw catalogue
is preserved as `catalogue.before-sun.json`; the new catalogue was promoted only
after validation. This is a local progress increment, not completion of the
whole-game fidelity audit. All 1,424 exhibits remain; the remaining 29 callbacks,
53 unresolved definitions, scene/host reconstruction and broad visual audit are
still open. No integration or publication.


## Assembled power-cell HUD — 5 November 2026 NZDT

Group 80 now runs as a complete animated HUD effect in the Original/Gouraud
comparison. It uses the exported `fuelcell-naked-idle` motion and stable source
joint IDs 3–7 and 9, rather than placing the orbit particles at guessed offsets.
Four callbacks retain the source float32 joint deltas, centre scale, and two
starburst dimensions. Both views share one simulation and preserve the original
textures, sprite geometry, blending, depth, rotation and particle lifetimes;
Gouraud uses the existing adaptive mesh with interpolated vertex colours.

The `fuelcell-naked` asset is an animation driver, not the visible world power
cell. Its four mesh vertices occupy an extent of about 1e-12 metres; all ten
nodes and the 21-track idle remain intact. The visible HUD is its centre, joint
orbits and flare particles. The otherwise blank rig card now explains this and
links directly to the assembled effect. The separate visible `fuel-cell-lod0`
model still loads and animates in both renderers. No substitute geometry was
introduced, and no original asset bytes changed.

The host retains the source initial yaw and half-degree-per-frame turn, updates
joint animation even while hidden, and supplies the user HVDF screen origin.
The composite applies the original screen-coordinate and depth projection,
independently of the gallery camera. A close inspection crop and full screen
frame expose the same source placement. Both source NTSC formats, 4:3 and 16:9,
have their authored icon/centre/starburst scales. PAL positioning is not ported.
The offscreen targets follow the selected render resolution; the full source
rig/geometry and particle meshes remain present at every viewing distance.

Restart replays the nine-frame arrival. Hold visible is an explicit inspection
condition; turning it off restores the two-second timeout and five-pixel-per-
frame departure. Hide uses the source ten-pixel departure. Hidden state removes
the keyed particles; show/restart rebuilds the eight permanent layers without
accumulation. Pickup-count text, tally audio and progress-menu variants are not
replayed by this exhibit. This does not claim a complete game HUD reconstruction.

Validation:

- Two Python fixtures plus actual-source binding and mutation-rejection checks.
  An independent evaluator of the four pinned GOAL callback bodies supplies
  800 exact numerical comparisons across random joints and both formats.
- 2,092 host frames, 41,530 finite particle samples and 120 samples of the actual
  source rig. Checks cover joint mapping, projection-independent cspace,
  permanent layer identity, bounded transients, arrival/both exits, exact timeout,
  hidden animation, cleanup/reactivation, restart and immutable source data.
- Existing particle-motion checks pass. The normal build passes with 1,750 files,
  765.2 MiB, offline version `e2563cac673633ac6854`. Final lab-only description/link
  changes pass root TypeScript and the independent production build. No full
  suite or repeated unrelated build was run.
- Sixteen browser observations cover Original/Gouraud/Both, native 2560×1440 and
  normal 1280×720, both display formats, close/full frame, timed and explicit hide,
  zero particles when hidden, show, restart and the rig-to-assembly link. The
  ordinary world power-cell model also renders and animates. Console warnings
  and errors are empty. The final page serves `jak-lab-BwtmKWXw.js`.

Evidence is `.jak-lab-data/evidence/hud-{callback-oracle,checks,browser,delivery}.json`,
`hud-normal-build.log` and the `hud-*.png` captures. The packed catalogue is
9,334,700 bytes. Unchanged packed assets total 226,933,574 bytes; the final
frontend is 718,683 bytes, for 236,986,957 bytes before hosting metadata. The raw
catalogue was promoted after validation, retaining `catalogue.before-hud.json`;
its only new section is `fuelCellHud`. Source provenance includes eleven hashes.

This improves one existing exhibit; the catalogue remains at 1,424. The whole-
game goal remains open: 25 update callbacks, 53 unresolved definitions, source
host assemblies, dynamic texture/lighting state, procedural rendering,
individual scene instances and the broad visual audit still require work.
Final hosted verification belongs to the coordinator. No integration or publication.

## Health, eco timer and scout-fly HUDs — 5 November 2026 NZDT

The three health layers and the eco timer's backing, three rotating slices and
frame now have complete source-screen assemblies. Two new cards expose these
composites, bringing the catalogue to 1,426 exhibits. Their existing group cards
retain the individual layers at their authored positions and link to the full
assembly. The scout-fly HUD uses its invisible anchor and orbiting child. The
power-cell HUD shares the same compositor and retains its source animation rig.

The extractor records the actual per-layer launch origins, independent depth
values and 4:3/16:9 NTSC scale tables, with seven source hashes and ten callback
or helper form hashes. Both renderers receive the same source projection and
simulation. Close inspection crops the screen without moving its layers. The
Gouraud version uses the existing texture-free adaptive vertex-colour mesh; its
interpolated edges remain visually distinct from the original sprite sampling.
No original model, animation, image or emission asset bytes changed.

Nine callbacks restore health thresholds and the low-health brightness cycle,
four eco colours, piecewise slice rotation, the low-charge flash and source icon
dimensions. Health tally changes use the source integer conversion and preserve
the previous tally when no target exists. The inspection controls expose health,
eco colour and starting charge, including the source overcharge branch. Optional
draining uses the original 6,000-tick / 20-second duration. A changing charge keeps
the HUD visible; after it reaches zero, the two-second timeout and departure run.
Explicit Hide stops the inspection drain and uses the faster source exit.
Hidden particles are removed and show/restart recreates the persistent layers.

These exhibits port particle hosts, not the entire game HUD. Tally text/audio,
PAL placement, first-person/progress HUDs, pickup events and the full gameplay
fact/state owner still require work. Timer controls use non-negative live values;
expired unsigned-timer underflow is not claimed as reconstructed behavior.

Validation:

- Two Python fixtures plus actual-source extraction and mutation rejection.
  Independent evaluation of the pinned GOAL bodies covers 1,298 input contexts
  and supplies 5,330 exact callback comparisons, including float32 operations,
  short-circuit conditions and assignments through nested lexical scopes.
- Host checks cover 5,874 counted frames and 11,998 finite particle samples:
  both formats, per-layer positions/depth, health and eco boundaries, stable
  particle identity, scout-fly orbit, source entry/timeout/exits, cleanup/show,
  full twenty-second drain, restart, frame-rate independence and immutability.
  Individual and assembled layer states agree. Power-cell regression also
  passes its 800 comparisons, 2,092 frames, 41,530 samples and 120 rig samples.
- Existing particle-motion tests pass. Required normal build passes with 1,750
  files / 765.2 MiB, offline version `97ea612fc265977f5078`. The final lab-only
  tally correction passes root TypeScript and the independent production build.
  No full suite or unrelated level audit was run.
- Twenty-eight browser observations cover original/Gouraud/both, normal
  1280×720 and native 2560×1440, close/full screen, both formats, health states,
  four eco colours, empty/partial/full/overcharge, the scout-fly orbit and the
  existing power-cell assembly. A ten-percent charge drains for two source
  seconds, times out and cleans up; explicit hide also stops the drain. Restart
  and the health-layer assembly link work. Console warnings/errors are empty.
  Final runtime: `jak-lab-wCMhO-6_.js`.

Evidence is `.jak-lab-data/evidence/screen-hud-{oracle,checks,browser,delivery}.json`,
the power-cell regression report, normal build log and health/eco/scout-fly HUD
PNGs. The validated raw catalogue replaces only `screenHud`, preserving
`catalogue.before-screen-hud.json`. Packed asset identities were rechecked during
metadata refresh. Packed assets are 226,933,574 bytes, catalogue 9,340,163 bytes
and frontend 729,976 bytes: 237,003,713 bytes before hosting metadata.

The whole-game goal remains open: sixteen update callback names, 53 unresolved
particle definitions, host assemblies, procedural rendering, dynamic texture
and lighting state, individual scene instances and broad visual review remain.
The release coordinator owns final integration and hosted validation. The
completed review tab and guarded job are closed; a lightweight local static
server keeps port 5193 available for the user's testing without a heavy lease.
