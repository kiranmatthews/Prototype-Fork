# Tribal Run guardian

The user explicitly replaced the pending Meshy request with **Tripo web plan
credits** on 4 November 2026. No Meshy task was submitted. The old empty Meshy
journal is historical; it is not the production pipeline for this character.

The imagegen reference in `references/guardian.png` is the production input.
Its saved prompt explicitly applies the Crash 4 aesthetic and Bone Man-like
proportions before modelling: an adult Pacific island guardian with woven
clothing, readable hands/feet and separated limbs for rigging.

## Generation

- [Tripo web model](https://studio.tripo3d.ai/workspace/generate/76caae3a-d78c-41f5-ae02-baa31743b900)
- **Smart Mesh P2.0**, triangular topology, **15,000 triangle target inspected
  before submission**. Export verified at **16,132 triangles**; absolute cap 30,000.
- Web credits: 100 mesh + 30 reference texturing + 20 humanoid rig = **150**.
  Preset motions did not debit additional credits. No API generation was used.
- 2k colour texture, 65-joint Mixamo-compatible humanoid skin. All final mesh
  geometry remains at every distance and in reflections; no LOD or decimation.
- Provenance lane: **generative-assist**, using the external GLB directly. This
  is not a procedural CharacterIR factory or a claim of code-authored geometry.

`tripo-web.json` records the source/export hashes. Raw unrigged, walk-only and
four-clip exports are preserved in the ignored `.img2threejs/enemies/tribal-guardian-tripo-web/`
working folder. The source reference and final GLB are committed.

## Motion preparation

```sh
node tools/tribal-guardian/prepare.mjs .img2threejs/enemies/tribal-guardian-tripo-web/motion.glb
```

The preparation script preserves every source mesh/skin accessor, vertex,
triangle, UV, weight and texture. It removes only the walk's linear travel,
retaining its hip sway and joint motion. The source walk has two complete
strides in 2.333 seconds, measured at 0.564 metres/second before display scale.
The oversized feet needed up to 6.25 cm of ankle correction in the one-metre
source; analytic hip/knee correction keeps their soles above the ground.

The production asset includes the corrected walk, a three-second breathing idle
and a 0.84-second sideways fall. The fall's contact height is fitted per frame
and checked against the deformed body during the runtime's per-segment rebound. Runtime elasticity
uses an editable guardian profile, preserves both animated ankle trajectories,
and never animates the actor's or complete skeleton's scale. Hands never receive
foot pins. Stomp falls settle before disappearing; spin retains the game fling.

`preparation.json` records mesh budget, source/output hashes, sampled clearance,
clip timing and the mapping derived from this actual rig. `review.html` displays
production runtime from front, 40° and 90°, with native and normal resolution.

## Runtime scope and verification

Only `appearance: 'tribal'` grunts select the new model. Crab accessories,
clacking, the widened crab stomp and carcass behavior no longer apply to them.
Their measured body uses a 2.43 m tall, 1.15 m wide combat box; hair and swinging
hands are artwork. Patrol ends have a short planted turn. Ordinary grunts,
Nightworks goblins and other species keep their existing behavior.

Run `node tools/test-tribal-guardian.mjs` for the actual GLB, weights, independent
skins, floor clearance, planted ankle preservation, finite defeat/reset,
35 authored enemy assignments and real Player spin/stomp collisions. The shared
runtime regression remains `node tools/test-enemy-runtime.mjs`.
