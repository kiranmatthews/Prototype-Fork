# Meshy skeleton tank-top torso

The production rider torso uses the owner-supplied **Skeleton Tank Top** Meshy
surface. It replaces the former procedural heart tank and bare-waist meshes;
the conventional gameplay/animation skeleton remains unchanged.

**Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-torso.mjs` validates the exact FBX and texture revisions,
bakes the source `+Z`-up mesh into the character's `+Y`-up convention, and
emits exact indexed position and UV buffers. The importer validates the supplied
faceted normals; runtime derivative face normals replace that redundant buffer
so lighting follows width/depth morphs while reducing initial JS weight. The
original FBX is not redistributed. Base colour is rebuilt directly from the
2K source as a bicubic-sharpened 512² lossless WebP; meaningful roughness stays
as a 256² lossless mask. The near-neutral normal and effectively-zero metallic
maps are not shipped or requested.

The source contains no rig. Runtime code assigns smooth weights across the
existing `torso-root → spine → chest → neck` chain and both clavicles. Moved
semantic bones therefore provide bending and longitudinal squash/stretch; a
pair of independent pre-skin width/depth morphs handles editor sizing and
volume correction without scaling a joint, disturbing the shorts, or altering
collision.

See `provenance.json` for source hashes, the Meshy upload ID, conversion
measurements, derived texture hashes, and the exact runtime mapping.
