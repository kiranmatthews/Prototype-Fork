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
valid. Character Lab's neck-height control moves only that head bone's local Y
offset: it creates literal air space without moving the neck bone, deforming
the torso skin, or scaling the skull. The offset composes additively with
future procedural/keyframed head translation.

See `provenance.json` for exact source and derived hashes, topology, upload ID,
axis conversion, bounds, and runtime mapping.
