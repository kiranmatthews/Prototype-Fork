# Meshy alternate bandicoot head

This is an owner-supplied Meshy static mesh used only as an alternate head-shape
evaluation option in Character Lab. It is attached rigidly to the existing
semantic `head` bone, so the production skeleton and animations do not change.

The source archive contains no licence notice. This repository therefore makes
no claim that the generated asset or its character likeness is cleared for
third-party commercial use. Keep or replace it according to the owner's rights
assessment after the visual test.

`tools/import-meshy-coco-head.mjs` pins the exact FBX/texture hashes, converts
the Meshy axes to the runtime convention, rebases the lowest point to head-local
Y=0, and emits synchronous position/UV buffers. The original FBX is not
redistributed. Browser textures are resized to 1024×1024 PNGs.
