# Meshy limb-bone surfaces

The character's limb segments use two owner-supplied generated meshes:

- **Ivory Bone** — both upper arms.
- **Ivory Rattle** — both forearms and the live-but-hidden thigh surfaces.
- **Hybrid shins** — Ivory Bone proximal shoulder knob plus Ivory Rattle shaft
  and distal insertion tip. The tip is deliberately knobless so it can enter
  the sock silhouette.

**Models created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-limb-bones.mjs` uses Three.js `FBXLoader`, preserves the
source positions, normals, and silhouettes, and clips triangles only at two
measured axial boundaries. The generated synchronous data lives in
`src/character/meshyLimbBone.generated.ts`; the original FBXs are not
redistributed. Length changes scale only the middle shaft and translate the
rigid distal piece. Character Lab thickness and animation volume compensation
use a shared shaft morph that fades to zero at the clipped boundary rings,
leaving both rigid ends and longitudinal proportions intact.
The importer derives the closed shaft-volume polynomial from the final Float32
geometry, so animation and authored thickness compose exactly throughout the
physical range. If an extreme thin+long combination asks for less volume than
the fixed collars alone contain, a non-inversion guard takes precedence.
Character Lab also exposes independent arm/leg knob sizing. It uniformly
enlarges authored knob regions while preserving semantic sockets; at the
hybrid shin's most compressed extreme, proximal Y alone is capped before the
ankle while X/Z remain fully tunable. The Rattle's knobless insertion tip is
never resized.

See `provenance.json` for source hashes, upload IDs, measurements, and the exact
runtime mapping.
