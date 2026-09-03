# Meshy Crowned Inferno Skull head

The production rider head uses the owner-supplied **Crowned Inferno Skull**
Meshy surface. It replaces the former procedural kangaroo face, eyes, ears,
hair, and ponytail artwork while retaining the conventional semantic head
bone, look socket, and compatibility nodes.

**Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-head.mjs` validates the exact FBX and texture revisions,
converts the source `+Z`-up mesh to the character's `+Y`-up convention, and
rebases its lowest point to head-local Y=0. The original FBX is not
redistributed. Runtime uses exact indexed position/UV buffers and derivative
face normals. Base colour is rebuilt directly from the 4K source as a
bicubic-sharpened 512² lossless WebP, with a 256² lossless roughness mask. The
near-neutral normal and exactly-zero metallic maps are not shipped or requested.

The asset is static and unrigged. It is a rigid child of the existing `head`
bone, so every current animation and procedural look/impact response remains
valid. Character Lab's gap/overlap control moves only that head bone's local Y,
including negative overlap, while Head forward/back moves its parent-local Z.
Neither moves the neck bone, deforms the torso skin, or scales the skull. Both
compose additively with procedural/keyframed head translation; independent
overall/width/depth controls provide the intentionally extreme cartoon scale.

See `provenance.json` for exact source and derived hashes, topology, upload ID,
axis conversion, bounds, and runtime mapping.
