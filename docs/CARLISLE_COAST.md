# Carlisle Coast: sculpted canyon revision

This revision responds to the failure of the first temple-ravine presentation:
the road still read as textured rectangles with thin moss overlays and flat
side sheets. The supplied [Tiki Pits reference](https://www.youtube.com/watch?v=nvXvJ9M8haI)
calls for broad rounded stone masses, thick fractured landings, tapered roots
and quieter grass. A palette change alone could not supply those silhouettes.

The source replaces **54 static platforms and ramps with visible sculpted
solids**, including all nine slopes. Ground shape is intentionally rebuilt;
preservation of the retired rectangular footprint is not the goal. Central
route heights, important joins and actor footholds are protected. The 28
enemies, 73 authored rails, 14 checkpoints, two movers, 14 crumble pads, pit
intervals, side-scroll frame, finish trigger and fixed encounter timing remain
independently checked against the retained course. Crate encounters and the
existing hill-rail height correction remain. Movement tuning is unchanged.

## Terrain and composition

`src/levels/carlisle-rock-terrain.ts` authors one actual closed support per
native deck. Narrower ribbons widen locally around crates, patrols and the
checkpoint respawn offset. Their complete outlines have rounded corners,
concave erosion and chipped scallops. Three broad sandstone courses descend
through recessed seams into deep roots; thin repeated masonry tiers are avoided.

Contiguous ends retain supported joining strips. Free ends keep their narrower
width and exact central jump height, with three or four broad recessed lobes
below the crest and a lower cross-section taper to 40% of the cap width. Both
camera turns retain their primary and secondary joins, including the offset
north approach to the landing centred at world X = 4 m. No original rectangular
collider remains invisibly beneath these meshes.

Cap UVs use local X/Z metres. The wall begins on coincident crest vertices with
perimeter/Y UVs and matching smooth normals. This prevents the old cap-to-wall
coordinate jump from stretching many tiles across a short front face. The body
has actual depth and silhouette; texture is not a substitute for geometry.
First-pit, ramp and final E-landing faces must be inspected from their real
gameplay cameras, as well as from above.

`coast-terrain` renders turf and stone on the **same solid in one draw**. Baked
vertex pigment selects turf albedo inside the cap and stone on exposed rims
and strata. The previous flat paint planes are removed; only torn overhanging
turf tongues remain as separate scenery. The material hooks live in
`src/carlislePresentation.ts` and the mesh path in `src/level.ts`.

`src/levels/carlisle-coast-art.ts` composes asymmetric canyon masses, measured
rock fingers, sparse carved remnants and reused Beachside/Treehouse forms.
**492 deep backing placements**—about 500—connect cliffs to their basements and
mist. They explicitly skip shadow casting. Foreground cliffs still cast shadows:
distinct caster/non-caster buckets share material and texture ownership. The E
crossing cuts away foreground art without changing moving encounters or rear
geology.

## Grass and the carved channel

Fine grass is real opaque blade geometry, not alpha cards. Each code-authored
tuft has 72 curved blades and **672 near / 160 far triangles**, one double-sided
material, no textures and a 58,300-byte GLB. Olive/straw vertex colours, four
bend segments and folded near-blade cross-sections provide depth. Rooted wind
masks are zero at the planted base and one at the tip.

Tufts are sampled by actual cap triangle area, with greater weight at the
eroded verge, so density stays independent of support tessellation. Revised
blades are 1.5× wider and have linear olive root minima of
`[0.35, 0.45, 0.14]`, avoiding the earlier dark dotted-hair appearance.
World-distance shrink fades them into turf from 20 to 48 m without alpha
overdraw. Grass does not cast shadows. Editable source and separate Apache-2.0
manifests are in `tools/carlisle-coast-fidelity-assets/make-grass.mjs` and
`public/carlisle-coast-fidelity/grass-tuft-{a,b}-manifest.json`.

Native component 95 remains the mature analytical halfpipe, with an explicitly
redesigned **R = 4.5 m, flat half-width F = 3 m and length L = 120 m**. Its bank
geometry is not identical to the old R = 7 m channel. Analytical contact,
ride normals, coping, catches and drop-in still use the existing halfpipe
system; coping presentation is muted.

The analytical banks and floor use signed arc-length/along-length UVs at
**3.1 metres per stone tile**. UVs compensate the shared texture sampler's
repeat, so the 120 m channel no longer stretches a single stone pattern into
long streaks. The floor alone uses a depth offset behind the coplanar grass. Steep banks
remain unbiased so their skin cannot be pushed behind the foundation. Neither
riding geometry nor texture allocation changes.

`src/levels/carlisle-channel-rock.ts` adds one coherent **1,496-triangle** stone
foundation beneath the complete U, including its flat middle. Three broad
non-planar courses, recessed ends and a deep tapered base ground the former
detached ribbon. The foundation is `solid: false`, skips shadow casting and
adds no contact geometry. Adaptive samples and upper vertical walls stay below
the true riding curve: the independent audit used **10,005 actual mesh ray
probes and 8,976 triangle-interior samples**, with at least **2.457 cm** clearance.
Circular normal sagitta alone would not prove vertical bank safety.

## Timber structure

`src/carlisleTimber.ts` fits the existing rustic boardwalk kit to **19 native
timber decks**: three static bridges, fourteen crumble pads and two movers.
Individual chipped boards, crossbeams, ledgers and braces replace their visible
box shells. Static bridges have 9–12 m piers; moving and collapsing platforms
carry short structural stubs. Six gallows members use fitted hewn/split beams.
The shared `boardwalk/rustic-atlas.webp` and geometry templates remain reusable.

Native timber colliders retain their dimensions and timing. Only their cloned
materials are hidden; the visible boards remain children of the native object,
following motion, shaking and collapse. Deck crest measurements protect foot
placement. No handrails or new collision volumes narrow the lane. Instance
buffers and hidden materials are released before normal level disposal, while
shared kit resources survive. Adaptive sampling bounds direct callers and
the normalizer charges timber generation against its aggregate work allowance.

## Models, reuse and accounting

Two new original Meshy masses use their measured natural proportions:

| Alias | Model | Natural dimensions at default width | Near / far triangles |
| --- | --- | --- | ---: |
| `coastv2ledge` | `ledge-root.glb` | 10 × 10.115 × 8.597 m | 8,717 / 1,800 |
| `coastv2buttress` | `canyon-buttress.glb` | 14 × 12.975 × 14 m | 10,720 / 2,200 |

Each model has one matte atlas material, a 2,048 px albedo and 1,024 px normal
map, UASTC textures with complete mip chains, and JPEG fallbacks. Combined
transfer is 16,991,476 bytes; their estimated ASTC 4×4 texture allocation is
13.33 MiB. These are asset totals, not whole-scene resident memory figures.
Original geometry, UVs and measured aspect ratios remain; models are not
stretched back to their initial prompt dimensions.

The registry also reuses Treehouse's `cavewall-b`, `earthbank-b`, ferns,
groundcover, canopy and tree, plus Beachside's Stonecliff Bastion. Placement,
rotation and Carlisle's scoped palette distinguish them. Generated models are
bottom anchored, front +Z, with normalized X/Z bounds of −0.5…+0.5 and Y of
0…1. Contact grids describe actual surfaces rather than treating irregular
tops as flat collision slabs.

The new tasks consumed **30 existing Meshy credits: 396 → 366**. The preceding
six-model kit consumed 90 credits, so the recorded Carlisle total is **120
credits**, with **366 remaining**. No credits were purchased. Procedural terrain,
the channel foundation and grass use no provider credits.

Provider handles, credit evidence, hashes, natural dimensions, contact grids
and texture budgets are recorded in:

- `public/carlisle-coast-fidelity/provenance.json`, the two model manifests and
  `contact-surfaces.json`;
- `tools/carlisle-coast-fidelity-assets/{specs,prompts,tasks}.json`, retained
  references and [the editable pipeline](../tools/carlisle-coast-fidelity-assets/README.md);
- `public/carlisle-coast/provenance.json` for the earlier 90-credit kit.

The new Meshy models retain attribution in
`public/carlisle-coast-fidelity/LICENSE.txt`; code-authored grass has a separate
Apache-2.0 record. Beachside attribution remains in `public/beachfront/README.md`.
Credentials and signed responses remain in ignored authoring directories and
are not published. Recorded jobs are retrieved by their existing handles.

## Interchange and validation

The detailed source remains ordinary editor-compatible level data. Interchange
accepts an 8 MiB level file, at most 1.8 million decoded nodes and a conservative
64 MiB clone-allocation estimate. These allowances match the retained aggregate
work limits of **100,000 mesh vertices and 100,000 mesh triangles**, rather than
discarding detail. Pack size remains 16 MiB. Depth, field/prototype, array,
per-component geometry and 500,000 generated-sample limits remain active.

`tools/test-carlisle-interchange.mjs` independently exercises oversized input,
excess nesting, getters, cycles, opaque prototypes, unsafe/unknown fields,
invalid shadow flags and aggregate/per-component mesh overflows. Its positive
fixture reparses and normalizes actual detailed data without changing serialized
geometry. `tools/test-carlisle-fidelity.mjs` measures actual actor footholds,
central slopes, both turns, eroded borders, open physical/visible gaps,
analytical bank clearance, editor capture, motion timing and streaming ownership.
See [the geometry audit](../tools/carlisle-coast-fidelity-assets/geometry-audit.md)
for the scope and limits of numerical evidence.

Focused release commands:

```sh
node tools/carlisle-coast/sync.mjs --write
node tools/test-carlisle-fidelity.mjs
node tools/test-carlisle-interchange.mjs
node tools/test-carlisle-boxes.mjs
node tools/test-carlisle-beam-contact.mjs
python3 tools/carlisle-coast-fidelity-assets/validate.py
npm run check:levels
npm run build
```

Against the current Vite preview, restore source before judging saved edits,
then exercise actual input and the full rendering path:

```sh
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5242 --lite --smoke-only
node tools/carlisle-bank-browser.mjs http://127.0.0.1:5242
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5242 --visual
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5242 --portrait --visual
```

The harness covers 24 gameplay-camera locations, including all 14 checkpoints
and explicit pit-front, landing, ramp and E-crossing views. Static captures use
recorded hazard grace; keyboard traversal and bank tests do not. The bank test
uses real input to commit, climb, catch coping and drop back into analytical
contact without losing a life. General smoke covers spawn, the charged
first-pit jump, checkpoint activation, pit respawn and finish.
`CARLISLE_REVIEW_OUTPUT`, `CARLISLE_REVIEW_SCENES`,
`CARLISLE_REVIEW_WARMUP_FRAMES` and `CARLISLE_REVIEW_FRAMES` control saved evidence.

## Current release evidence

The final source is **6,609,368 UTF-8 bytes**, with **4,098 components** and
**55,400 authored mesh vertices / 97,548 triangles**. Closed native terrain,
protected footholds and the foundation remain under the retained work limits.
The actual runtime proof includes 19 timber decks, six gallows beams, 617,870
transformed vertex checks, 1,004 modeled instances and 1,043 motion/follower
checks, including triggered crumble disappearance and resource disposal.

All 24 gameplay-camera locations passed in full desktop, portrait and lite
rendering, with zero console/page errors. After the final floor-only offset
and fallback bank UV fix, the approach, channel and exit views were refreshed
in both full and portrait rendering. The saved composite reports explicitly
retain the original measurements, refresh hashes, build stamps and scope.
Independent visual review accepts the sculpted pits/ramps/turns, timber
structure and continuous stone channel. The review image and level thumbnail
are actual gameplay captures.

| Profile | Actual framebuffer | Scene median intervals | Worst scene p95 | Peak full-frame calls / triangles |
| --- | --- | --- | --- | --- |
| Full desktop | 1280 × 720 | 16.6–16.8 ms | 20.3 ms | 443 / 1,586,314 |
| Portrait viewport | 720 × 1558 | 16.6–16.8 ms | 18.5 ms | 432 / 1,557,593 |
| Lite | 1280 × 720 | 16.6–16.8 ms | 18.3 ms | 299 / 977,680 |

Measurements use Chrome 154 on Apple M1 Pro, 30 warmup and 60 measured frames
per view. Portrait uses a 390 × 844 viewport on the same desktop GPU; it is
not a physical-phone benchmark. Chrome reports a 31.33 MiB compressed scenery
texture estimate (19.67 MiB in lite), with peak 336 / 1,329 resident cells.
Idle ownership is stable. The headless test's 101.33 MiB fallback estimate is
not the compressed Chrome figure.

Actual input passes the charged first gap, checkpoint contact/banking,
life-losing pit death with grounded respawn, and the finish gate. The bank
pilot rides to the redesigned coping at [7.5, −9, −814], drops inward and
recovers mounted at 11.2 m/s without losing a life. Capture-only hazard grace
is excluded from these input checks.

Required `check:levels` and the production type-check/bundle pass on the final
isolated release. The 184 security cases, 22 detailed interchange rejection
cases, asset/credit proof and actual source/collision/UV/bias/timber checks
pass. The published pack reopens through its distinct bounded lexical budget.
Current pristine cache fingerprints follow the source; edited copies remain
owned by their author. No movement tuning or full-suite run was introduced.

Saved evidence: `docs/performance/carlisle-coast-{full,portrait,lite,bank}.json`,
`docs/carlisle-coast-review.png`, and the retained raw report hashes in the
composites. The release preserves all other latest-main levels and Treehouse,
stream, cloth and menu changes. Publishing uses the normal `origin/main`
GitHub Pages workflow, followed by a live fork-stamp and gameplay check.
