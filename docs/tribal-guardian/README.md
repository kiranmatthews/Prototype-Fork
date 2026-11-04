# Tribal guardian review — 4 November 2026

Replaces the 35 decorated crabs in Tribal Run with the Pacific-inspired guardian
from the prepared Crash 4 aesthetic imagegen reference. Generated through Tripo
web plan credits: Smart Mesh P2.0, 15,000-triangle target, **16,132 actual triangles**,
65-joint humanoid rig and 2k texture. Total web debit 150 credits; no API credits.

The imported walk retains its hip sway, has oversized-foot clearance corrections,
and receives shared per-segment elasticity. The three-second idle, gradual patrol
turn and finite sideways fall are visible from front, 40° and 90°. Both hands
remain arm joints. All final geometry is retained at every viewing distance.

- [Budget selected before submission](smart-mesh-budget.png)
- [Textured Smart Mesh in Tripo](tripo-textured.png)
- [Native-resolution walk, three views](walk-native.png)
- [Native-resolution falling pose](fall-mid-native.png)
- [Finite grounded settle](fall-settled-native.png)
- [Full-render Tribal Run beside Bone Man](tribal-run-native.png)
- [Measured checks](checks.json)

The actual-asset regression validates all skin weights, independent instances,
walk and fall clearance, unchanged gameplay-root scale, planted ankle preservation,
finite fall/reset and all 35 source assignments. Actual Player collision checks
cover spin kills and stomp/bounce, while ordinary crabs retain their stomped model.
The shared enemy runtime regression also passes. Browser review covers normal and
native presentation, the full course renderer, walking, turning, falls, contact
hurt and respawn, with no browser warnings/errors. No full suite was run.

Preparation and provenance: [asset README](../../tools/tribal-guardian/README.md),
[web journal](../../tools/tribal-guardian/tripo-web.json),
[GLB preparation report](../../tools/tribal-guardian/preparation.json).

The sky restoration commit remains the parent of this work; no sky, level pack,
platform geometry or movement tuning was changed by the guardian replacement.

Production build/type-check and release-size check pass: 814,174,039 bytes
against the 1,000,000,000-byte budget. The packaged GLB still has 16,132 triangles,
65 joints, three animation clips and the complete semantic rig metadata.
