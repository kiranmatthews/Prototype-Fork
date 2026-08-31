# Quaternius female evaluation mannequin

`mannequin-f.glb` is the female mannequin supplied with the free Standard edition of Quaternius' Universal Animation Library 2. It is used as a neutral, continuously skinned evaluation surface for the project's browser animation tools.

The mannequin intentionally contains no animation clips. Quaternius supplies it on the same 65-joint universal humanoid rig as the animation-library mannequin so motion can be retargeted in the consuming engine.

## Source and license

- Author: Quaternius (`@Quaternius`)
- Pack: Universal Animation Library 2, Standard edition
- Official pack page: <https://quaternius.com/packs/universalanimationlibrary2.html>
- Animation viewer: <https://quaternius.com/animviewer.html>
- License: CC0 1.0 Universal — <https://creativecommons.org/publicdomain/zero/1.0/>
- Source archive path: `Female Mannequin/Unreal-Godot/Mannequin_F.glb`
- Imported: 2026-08-31

The source pack's license notice is preserved in `LICENSE.txt`. See `provenance.json` for hashes and a machine-readable asset inventory.

## Repository copy

- File: `mannequin-f.glb`
- Size: 1,442,824 bytes
- SHA-256: `2ee6cc3fe888d9b144afa8cc4b2ab7bfc5d13a0d5b7548df777f61f64ad65fa6`

The GLB was copied byte-for-byte and renamed for a stable, URL-friendly path. Its geometry, skin weights, inverse bind matrices, skeleton, materials, coordinate transforms, and embedded buffer were not modified. No conversion or external model-authoring step was used.

The asset contains no images or textures, so it has no external runtime dependencies. Source-only project files, alternate engine exports, setup images, and animation-library files were deliberately not imported.

## Imported motion

The browser-editable `player.run` clip is retargeted from `Jog_Fwd_Loop` in the
free Standard edition of Quaternius' original Universal Animation Library. The
non-root-motion source was sampled at its native 30 FPS, converted into the
project's semantic rest-local tracks, and embedded as editable keyframes rather
than shipping the 43-clip source GLB. See
`animations/jog-fwd.provenance.json` for source hashes and conversion policy.

## Technical summary

- glTF 2.0 binary container
- One skinned mesh node with two indexed triangle primitives
- 25,636 primitive vertices and 14,612 triangles in total
- One 65-joint humanoid skin, including complete finger and toe chains
- T-pose bind/rest orientation
- Two neutral PBR materials (`M_Main` and `M_Joints`)
- No textures, animation clips, morph targets, or required glTF extensions
