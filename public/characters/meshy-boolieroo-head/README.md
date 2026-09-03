# Meshy BoolieRoo alternate head

This is the owner-supplied original **BoolieRoo** design, used as an alternate
head-shape evaluation option in Character Lab. It is attached rigidly through
the non-rig `head-presentation` mount below the semantic `head` bone, so the
production skeleton and animations do not change. It shares the skull's expanded size/axis ranges, negative
gap/overlap, neck-aligned forward/back placement and animation-wide neutral
pitch, while remembering all six values in its own Roo profile.

Meshy had auto-assigned an unrelated character name to the downloaded output.
That label did not describe the design or its source and has been removed from
the production path, code identifiers, generated metadata, and provenance.

`tools/import-meshy-boolieroo-head.mjs` pins the exact FBX/texture hashes, converts
the Meshy axes to the runtime convention, rebases the lowest point to head-local
Y=0, and emits synchronous position/UV buffers. The original FBX is not
redistributed. Repeated attribute tuples are indexed without changing triangle
order. Base colour is rebuilt directly from the 4K source as a
bicubic-sharpened 512² lossless WebP, with a 256² roughness mask. Near-neutral
normal and effectively-zero metallic maps are omitted. The mesh chunk and both
textures load only when **BoolieRoo** is first selected.
