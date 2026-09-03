# Meshy shoe and sock footwear

This owner-supplied Meshy shoe-and-sock surface is retained as an attributed
authoring reference. Production footwear has returned to the original
procedural sock cylinders, shoe sphere, lace bars, and capsule sole, restyled
with this asset's black, brick-red, and warm-white palette. The live character
does not instantiate this mesh or request these textures.

**Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-footwear.mjs` remains the reproducible archive validator:
it validates the exact FBX and four PBR texture sources, bakes source axes into
ankle-local rider space, and records all seven connected surface islands. Its
generated module is no longer imported by `Player`. The archived colour and
roughness references are compact lossless WebPs; unused normal and metallic
maps are no longer deployed.

The archived fit proves why the rollback is safe: both surfaces use the same
sole plane and heel, foot-center, and toe socket positions. The original FBX
and archive are not redistributed.

See `provenance.json` for exact source/derived hashes, upload ID, topology,
rest fit, skinning rules, and contact mapping.
