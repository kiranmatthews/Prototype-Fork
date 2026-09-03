# Meshy Midnight Chain Denim shorts

The production rider shorts use the owner-supplied **Midnight Chain Denim**
Meshy surface. It replaces the former procedural pelvis, belt, buckle, chain,
cargo cylinders, pockets, and flaps while retaining the conventional hips,
upper-leg bones, knees, and all limb animation controls.

**Model created with [Meshy](https://www.meshy.ai/) —
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).**

`tools/import-meshy-shorts.mjs` validates the FBX and four PBR texture sources,
bakes the source axes to the runtime convention, losslessly indexes repeated
attribute tuples, and records all 45 connected surface islands. Runtime code
smoothly binds the main garment to hips and its matching upper-leg bone; each
detached chain/loop/button detail is rigidly assigned by island so it cannot
shear. Base colour is a bicubic-sharpened 512² lossless WebP. Roughness and the
meaningful chain/hardware metallic mask remain at 256²; the near-neutral normal
map is not shipped or requested.

Independent pre-skin width, height, and depth morphs size only the shorts.
`Leg thickness` does not affect them. The default fit overlaps the torso at the
waistband and lets both lower-leg surfaces insert slightly inside the frayed
hems. The original FBX and archive are not redistributed.

See `provenance.json` for exact source/derived hashes, upload ID, bounds,
topology, rest fit, skinning rules, and control mapping.
