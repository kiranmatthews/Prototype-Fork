# Treehouse Trail modular art

The original six Meshy Smart Topology modules and two refined hero models were generated from isolated
references derived with the built-in `image_gen` tool from the user's
`image 20.jpg`. The exact prompts are in `prompts.json` and
`foliage-prompts.json`; the six selected reference PNGs are stored beside this
file. The new ancient tree and dense bush match the opening scene; additional
independently generated Meshy plants and logs come from the shared Jungle Kit.
No complete treehouse model is published.

| Module / decor kind | Default metres X/Y/Z | Near / far triangles | Placement contract |
| --- | --- | --- | --- |
| body / `treehousebody` | 7 / 5.2 / 5.5 | 2,989 / 1,135 | Flat bottom; front doorway faces +Z. |
| balcony / `treehousebalcony` | 8 / 1.5 / 3 | 2,050 / 779 | Open edge faces -Z; deck top is 0.25m above bottom. |
| stairs / `treehousestairs` | 3 / 2.25 / 5.5 | 1,880 / 714 | Seven real treads, rising from +Z to -Z; no handrails. |
| landing / `treehouselanding` | 3.5 / 0.35 / 3.5 | 1,181 / 448 | Flat top at 0.35m; no guardrails. |
| tree / `treehousetree` | 22 / 20 / 17 | 2,860 / 1,086 | Independent tree, anchored trunk and upper canopy wind. |
| bush / `treehousebush` | 5 / 2.8 / 4.5 | 961 / 365 | Dense independent leaf cluster, anchored at bottom. |

The shared `JungleAssetKit` normalizes each mesh to its placement size and
loads the authored geometry with one shared material per module. Simplified meshes remain in the GLBs for offline authoring; the runtime keeps the detailed mesh visible. The active opening modules now keep 2048px color atlases and 1024px normal maps. Exact current counts, byte sizes and hashes are in each manifest. Meshy geometry and UVs are retained. Blender fits the balcony
deck and landing top to exact planes and the seven stair tops to equal
normalized rises. Collision remains authored separately in the level.

`public/treehouse-trail/provenance.json` records task ids, source and output
hashes, triangle counts, fitted centerline measurements, reuse provenance,
and credit use. Published modules cost 90 credits. An earlier whole-treehouse
study cost 15 credits before the user requested separate modules; it is
kept only in the ignored authoring folder and is not loaded or published.

## Reproduction

Use the existing official Meshy CLI installation with local OAuth. Set
`MESHY_NODE` and `MESHY_CLI` to override the local runtime paths. No credentials
belong in arguments, the repository, browser storage, or public assets.

1. `generate.py body balcony stairs landing tree bush` submits each missing task once,
   persisting its reservation before submission and using stable operation ids.
2. `fetch.py` queries the recorded handles once and downloads finished GLBs
   with the official CLI. Repeat only to retrieve unfinished existing tasks.
3. Run Blender in background with `--python tools/treehouse-trail/prepare.py
   -- body` (then each other module) to fit surfaces, make the far mesh,
   export GLBs, and render front/rear reviews.
4. Run `pack.py body` (then each other module) using Python with Pillow to
   package the web GLBs and their geometry manifests.
5. Run `provenance.py` to collect the six model manifests and recorded billing
   audit into the public-safe provenance file.

Raw tasks, signed download URLs, full-resolution GLBs, and review renders
stay in `.img2threejs/treehouse-trail/`. Final artwork stays in
`public/treehouse-trail/` and the isolated authoring references stay here.

## Level composition and painted layers

`src/levels/treehouse-trail.ts` owns the opening: a large cabin and balcony on
the left, an open timber halfpipe on the right, then a rounded path into the
existing forward bush route. The landmark assembly uses explicit per-piece
sizes; its stair landings are at 0, 2.8, 5.6 and 8.4 metres. Three short flights turn around the trunk, with shared rotated poses for each model and collider. Separate collision
ramps make the stair flights walkable without changing player tuning.

A `cameraView` component stores `cameraPosition`, `cameraTarget` and `cameraFov`
for the opening composition. Its spatial feather returns to the ordinary
follow camera around the bend. Do not overlap this view with an E travel zone.

The built-in imagegen tool created `public/treehouse-trail/matte-far.png` and
`matte-mid.png`; exact prompts are in `matte-prompts.json`. These are separate
editable scenery cards using cached opaque/cutout materials. The midground
ends outside the walking corridor, and the far layer sits beyond the finish.
The original user JPEG remains untouched at
`public/level-previews/treehouse-trail.jpg` for Level Select and Level Stats.

Local review: `/treehouse-trail-review.html?playtest&level=treehouse-trail`
(add `&lite` for collision checks). The review page is excluded from the
production entry list. Focused gameplay check: `node tools/test-treehouse-trail.mjs`.

## Structural and fidelity pass

The opening now uses the detailed `body-v2` cabin and an independent `host`
trunk with load-bearing forks. `balcony-deck` and `canopy` are fitted parts
extracted from the retained Meshy balcony/tree, so the railing opening, roof
clearance and trunk junction can be authored without stretching the whole
assembly. Rounded beams, braces, posts, rope lashings and enclosed lanterns
are separate source-owned mesh components in `src/levels/treehouse-opening.ts`.

The halfpipe has 4.2m transitions, a 1.8m flat, 5.8m length and a -20-degree
yaw, with a 32-step curved profile. Its surface sits 0.1m above the ground.
The opening ground is one continuous indexed surface split into two adjacent
editor-sized chunks; triangles never overlap. Painted vertex tint blends the
trail and undergrowth. The midground matte feathers all four edges, and the
opening camera preserves its horizontal composition in narrower app panes.

This refinement used two additional Meshy tasks (30 credits). The new trunk
reference was created with built-in imagegen; its exact prompt and the cabin
reconstruction settings are recorded in `refinement-prompts.json`.
