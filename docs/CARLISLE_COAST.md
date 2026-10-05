# Carlisle Coast temple ravine

Carlisle Coast presents the existing Test Course as a mossy sandstone temple
ravine, following the broad rounded cliffs, dark seams, carved ruins and rich
foliage of the supplied [Tiki Pits reference video](https://www.youtube.com/watch?v=nvXvJ9M8haI).
The reference guides composition and colour; the new models and surface maps
are original generations.

The source level contains **2,297 components**: 287 retained non-box originals,
162 authored boxes and 1,848 explicitly non-colliding art components. The
original support, walls, pit volumes, 73 rails, 14 checkpoints, finish gate and
timed obstacles remain the gameplay authority. The existing hill-rail
clearance correction is retained. Movement tuning is unchanged. Boxes retain
20 encounters, all 12 crate kinds, supported stacks, two switch staircases and
TNT/Nitro choices.

## Source and presentation

- `src/levels/carlisle-coast.ts` retains the original course and box layout.
- `src/levels/carlisle-coast-art.ts` authors the canyon, verges, thresholds and
  exact-footprint surface overlays as ordinary editor-compatible level data.
- `src/carlisleAssets.ts` registers the shared scenery aliases and their
  measured natural proportions.
- `src/carlislePresentation.ts` adds a texture-aware moss/ochre tint only to
  Carlisle materials, without texture copies or additional rendering passes.

Sandstone bays, fractured spires and Beachside rocks create two canyon tiers;
carved gateways mark changes in course rhythm. Guardians and ruin bases sit
outside the supporting pads. Gateway aperture was measured with front-to-rear
rays through the actual model: 11.588 m clear width through an 8 m high passage
at an 18 m authoring width. Each placed gateway uses
`max(22, (supportWidth + 1) * 18 / 11.588)` metres, leaving at least one metre
beyond the full playable support width. The registry preserves the model's
natural aspect ratio when scaling the complete gateway.

Moss overlays stay inside each original platform footprint, 3 mm above its
surface. Negative polygon offset prevents distant coplanar shimmer without
moving collision. Fractured side skirts descend below support; they never
bridge a gap. The E crossing leaves the original lift and moving crossing
clear. Foreground cutaways occupy separate instance buckets and hide both near
and far meshes; rear scenery and collision stay active.

## Original kit and reuse

Six new Meshy T2 smart-topology models use one shared atlas material per model:

| Kind | Model | Near triangles | Far triangles |
| --- | --- | ---: | ---: |
| `coastcliff` | `cliff-bay.glb` | 6,587 | 1,300 |
| `coastspire` | `canyon-spire.glb` | 6,303 | 1,300 |
| `coastshelf` | `moss-shelf.glb` | 3,936 | 800 |
| `coastpillar` | `tiki-pillar.glb` | 5,455 | 1,000 |
| `coastarch` | `temple-lintel.glb` | 6,330 | 1,400 |
| `coastfoliage` | `red-foliage.glb` | 2,186 | 600 |
| **Total** | **Six models** | **30,797** | **6,400** |

The kit transfers **14.15 MiB** of GLBs, including 1024 px albedo/512 px normal
atlases, UASTC textures with complete mip chains, and JPEG fallbacks. Its twelve
compressed atlases occupy **10.00 MiB** when transcoded to ASTC 4×4; this is an
asset estimate, not whole-game GPU memory. Packed geometry is bottom anchored,
front-facing +Z, with X/Z normalized to −0.5…+0.5 and Y to 0…1. Source UVs,
authored normals and broad painted regions remain intact.

Actual far meshes reduce the geometry budget. Distance switching is scoped to
Carlisle aliases, with hysteresis; Treehouse's authored distance behaviour
remains intact. The loader retains the normal-map Y sign required by glTF's
derivative tangent path for these models. Measured `_JUNGLE_AO` affects indirect
light only. `_WIND_FLEX` preserves planted roots and green/red leaf motion,
with the same deformation in colour and depth shaders.

Beachside's `stonecliff-bastion.glb` supplies `coastbeachrock`: 2,270 triangles,
one 512 px albedo and a 161,696 byte GLB. Four Treehouse Trials V2 models supply
additional Carlisle aliases without replacing the Treehouse originals:

| Alias | Existing source | Natural dimensions at default width (m) |
| --- | --- | --- |
| `coastbeachrock` | Beachside Stonecliff Bastion | 10 × 5.56641 × 5.48829 |
| `coastfern` | `fern-a.glb` | 3 × 1.601 × 2.798 |
| `coastcarpet` | `groundcover-a.glb` | 5 × 1.043 × 2.581 |
| `coastcrown` | `crown-b.glb` | 26 × 9.405 × 26 |
| `coasttree` | `tree-b.glb` | 26 × 16.741 × 17.709 |

Their source proportions, placement, rotation and scoped palette make the
reused forms fit Carlisle. The active level does not request the historical
city buildings or machinery; city authoring tools and assets remain available
for history and editor use.

## Provenance and accounting

The six recorded billable tasks consumed **90 existing Meshy credits**, with
verified balance **486 → 396**. No credits were purchased. Each local
reservation and stable operation ID preceded submission through the official
Meshy CLI. Source models, signed responses and two-angle model reviews remain
in ignored `.img2threejs/carlisle-coast/`; credentials and signed URLs are never
published.

`public/carlisle-coast/provenance.json` records task handles, exact consumed
credits, reference/source hashes, model budgets and final texture hashes.
`LICENSE.txt` preserves conservative Meshy CC BY 4.0 attribution while account
plan evidence is absent. Beachside's attribution remains in
`public/beachfront/README.md`.

Authoring records live in `tools/carlisle-coast-assets/`: `specs.json`,
`prompts.json`, the exact pillar/arch/foliage prompt supplement
`reference-prompts-supplement.json`, retained reference PNGs, and
`surface-prompts.json` for the independently generated moss/stone maps.
The original pipeline remains editable and reproducible. Follow
[the asset pipeline README](../tools/carlisle-coast-assets/README.md) to retrieve
recorded tasks, bake two-view geometry reviews, pack atlases and regenerate
compressed textures. Never resubmit a recorded unknown outcome.

## Validation and release

The presentation proof covers all fifteen spawn/checkpoint camera locations,
source collision parity, editor capture, actual near/far meshes, cutaway
restoration, idle resource ownership and disposal. The authored scenery forms
**1,184 streaming cells**, with a measured peak of **261 resident cells** across
those camera locations. Templates, textures and materials share ownership;
incoming cells acquire leases before outgoing cells retire.

Three final Chrome154/M1Pro browser profiles passed all19 source review
locations, including all14 checkpoints, with zero page/console errors:

| Profile | Actual framebuffer | Median frame | Worst scene p95 | Resident scenery textures |
| --- | --- | --- | --- | --- |
| Full desktop | 1280 × 720 | 16.6–16.7 ms | 18.2 ms | 23.00 MiB |
| Lite desktop | 1280 × 720 | 16.6–16.7 ms | 22.5 ms | 9.67 MiB |
| Full portrait viewport | 720 × 1558 | 16.6–16.7 ms | 18.0 ms | 23.00 MiB |

Desktop complete-frame counts include world, shadow, post and HUD passes:
217–427 calls and1.07–1.38million triangles. The portrait viewport is390×844
on the same desktop GPU, not a physical-phone hardware benchmark. Captures
settle incoming cells before timing; these numbers do not measure cold network
startup. Full-render camera travel peaks at259/1184 resident cells (headless
ownership proof261); lite peaks127. Whole-course return and90 idle rendered
frames preserve stable geometry, texture and residency ownership.

Actual keyboard smoke clears the original first9m pit with a committed board
and0.4s charged ollie at16.05m/s, with no life lost. Keyboard spin banks the
first checkpoint; a pit death spends one reserve life and returns there.
Keyboard traversal reaches the actual gate with state `finished`. Capture-only
hazard grace is separate from that input smoke. Evidence is saved in
`docs/performance/carlisle-coast-{baseline,full,lite,portrait}.json`; all timing
outliers are retained. `docs/carlisle-coast-review.png` and the level-select
thumbnail are actual gameplay-camera captures with HUD hidden.

Pristine previous restored-course caches and the new published snapshot follow
the builtin source. The cache proof covers a one-centimetre edit, a renamed
copy and an in-place edit; authored copies remain local. Run
`node tools/carlisle-coast/cache-signature.mjs working --check` to verify the
current pack, or pass an available published Git revision.

Run the focused checks and normal release build:

```sh
node tools/test-carlisle-layout.mjs
node tools/test-carlisle-boxes.mjs
node tools/test-carlisle-beam-contact.mjs
node tools/test-carlisle-presentation.mjs
python3 tools/carlisle-coast-assets/validate.py
npm run check:levels
npm run build
```

Against the running Vite preview, start with a lite input smoke, then capture a
full render pass and a portrait pass:

```sh
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --lite --smoke-only
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --visual
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --portrait --visual
```

The harness restores the source `test` entry and verifies the `Codex/sol fork`
build stamp. Input smoke covers supported spawn, the original charged skating
jump, checkpoint activation, pit respawn and finish. Capture-only hazard grace
is recorded separately from gameplay smoke. `CARLISLE_REVIEW_OUTPUT` selects
the output directory; `CARLISLE_REVIEW_FRAMES` controls captured frames.

Use `node tools/carlisle-coast/sync.mjs --write` to update only `test` in
`public/levels.json`. Campaign progress retains the `test-course` key. Publish
validated task-owned changes through `origin/main` and verify GitHub Pages and
the fork build stamp. The full suite is run only on explicit request.
