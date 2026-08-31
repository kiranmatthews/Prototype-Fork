# Meshy Violet Vixen comparison surface

This directory contains the user-supplied Meshy Violet Vixen character as a
third animation-evaluation surface. It is loaded directly from the original
FBX by Three.js, retaining its native 24-bone skeleton and smooth skin weights.
It is not the existing low-poly `public/models/fox.glb` and is not segmented
into rigid body chunks.

The source FBX embeds an 8192×8192 base-colour image. The comparison loader
redirects that private embedded image request to the 2048×2048 preview copy in
`Character_output.fbm/texture_0.png`. This keeps the original geometry, rig,
UVs, weights, and colour design while reducing persistent texture memory from
roughly 256 MiB to roughly 16 MiB.

The archive contains no license or terms file. The repository records it as a
user-supplied Meshy asset authorized for this project, not as CC0 or as a
code-native procedural model. See `provenance.json` for hashes and inventory.

FBXLoader reports that 3,911 source control points have more than four skin
weights. Three.js keeps the strongest four and renormalizes them. Most dropped
mass is small, but 203 points lose more than 5%, all in the upper-torso and
shoulder band. This is recorded because it may affect the comparison the asset
was added to perform.
