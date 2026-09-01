# Stretchable cartoon limb bone

`src/character/stretchableBone.ts` owns the reusable visual factory used by
the character's upper/lower arms and legs.

## Geometry contract

- Local proximal joint is at Y=0; the distal joint lies along local -Y.
- The shaft is a 24-ring × 32-side revolved waist profile.
- Each knobble is one continuous 28-ring × 32-side double-lobe surface, not a
  pair of intersecting spheres.
- Geometry and the smooth clay material are immutable and shared across all
  eight instances. The current production character renders 35,072 limb-bone
  triangles in 20 meshes.

## Deformation contract

`PlayerAnimationBridge` and `CharacterProportionLayer` resolve the same
serializable `stretchableBoneRuntime` metadata.

- Shaft position/scale follows the length control.
- Distal knobble and distal socket translate to the new endpoint.
- Proximal and distal knobble scale/quaternion are invariant under length.
- Procedural animation may preserve shaft volume; persistent Character Lab
  proportions change only length.
- Thickness controls scale knobbles uniformly and the shaft transversely.
- No `THREE.Bone` is introduced, so humanoid mapping, IK, sockets, authored
  clips and gameplay collision keep their existing identities.
- In production chains, upper segments own the shared elbow/knee knobble;
  lower segments omit their duplicate proximal mass and retain a fixed distal
  knobble at the wrist/ankle end.

The authored animation range is 0.55–1.75×. Composition with Character Lab is
verified from 0.319× through 2.765×. Shaft scale is driven by the complete
endpoint distance; its capped visible surface occupies the inner 90% so both
ends remain embedded at every supported length.
