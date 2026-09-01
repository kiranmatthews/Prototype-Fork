# Stretchable cartoon limb bones

`src/character/stretchableBone.ts` owns the reusable visual factory used by
the character's upper/lower arms and legs. Production uses two attributed,
owner-supplied Meshy surfaces; the former procedural double-lobe geometry is a
lazy, tested fallback only.

The procedural fallback's shaft-radius, knob-visibility, and knob-depth
options are a separate typed contract. Imported surfaces preserve authored
proportions and both rigid source regions instead of silently accepting them.

## Production geometry

- **Ivory Bone** is used by both upper arms: 1,328 source triangles, baked to
  1,454 triangles after exact boundary clipping.
- **Ivory Rattle** is used whole by forearms and by the registered-but-hidden
  thigh surfaces: 1,536 source triangles, baked to 1,698.
- Each visible shin is a 1,578-triangle composite: Ivory Bone's 674-triangle
  proximal shoulder knob plus Ivory Rattle's 551-triangle shaft and
  353-triangle knobless insertion tip. Shaft deformation, thickness morph and
  volume correction all use the Rattle profile.
- Local proximal joint is at Y=0; the distal joint lies along local -Y.
- Left/right components share six immutable part geometries and mirror only at
  the component root. All eight share one smooth ivory clay material.
- The production character instantiates 12,856 limb-surface triangles. The two
  1,698-triangle thighs remain live but hidden beneath the shorts, leaving
  9,460 visible triangles across six surface roots.
- Generated buffers are synchronous and add no fetch or runtime FBX parser.

Source hashes, Meshy upload IDs, measurements, licensing, and conversion rules
are recorded in `public/characters/meshy-limb-bones/`.

## Deformation contract

`PlayerAnimationBridge` and `CharacterProportionLayer` resolve the same
serializable `stretchableBoneRuntime` schema v3 metadata. Composite metadata
records proximal/shaft/distal sources and the independent deformation source.

- The source surface is clipped into a rigid proximal region, rebased shaft,
  and rigid distal region at measured cylindrical boundaries.
- Length scales only the middle shaft. The distal source region and distal
  socket translate to the new endpoint.
- Both rigid regions retain exact local scale/quaternion under length changes.
- Source-derived length animation applies volume compensation from the actual
  deformable-shaft length ratio—not the full endpoint ratio—through a shared
  relative morph that tapers to zero at both clipped boundary rings.
- The importer derives each shaft's quadratic closed-volume equation from the
  final Float32 triangles. Animation and authored thickness solve it together;
  a `-0.98` non-inversion guard wins only for a physically impossible thin+long
  corner where the fixed collars already exceed the requested volume.
- The supplied face-normal topology renders with derivative flat normals, so
  highlights remain attached to the surface throughout that thickness morph.
- Character Lab thickness composes through the same morph. Rigid source ends
  and every part's longitudinal Y scale remain unchanged.
- Separate arm/leg knob-size controls enlarge real knob regions from
  1.00–1.62×. X/Z always receive the requested thickness. Y normally matches;
  only a hybrid shin at an extreme compressed endpoint caps proximal Y before
  the ankle. Enlarged collars overlap the shaft seam, Ivory Bone's distal knob
  remains pinned, and Rattle insertion tips are excluded entirely.
- At extreme compression, rigid regions may overlap while the shaft clamps to
  a small positive span; no geometry inverts.
- No `THREE.Bone` is introduced, so humanoid mapping, IK, sockets, authored
  clips, and gameplay collision keep their existing identities.

The authored animation range is 0.55–1.75×. Composition with Character Lab is
verified from 0.319× through 2.765× with absolute, non-accumulating writes.
