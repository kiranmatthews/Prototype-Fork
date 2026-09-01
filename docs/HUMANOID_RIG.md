# Procedural Rider Humanoid Rig

The procedural rider uses a conventional, pelvis-rooted humanoid control and
deformation skeleton. The visible character may remain code-built and rigidly
segmented while it is being art-directed; the joint contract is also suitable
for binding a continuously skinned replacement mesh later.

## Hierarchy

`procedural-rider` remains the scene and root-motion control. The
`THREE.Skeleton` starts at `hips` and contains only `THREE.Bone` nodes:

```text
procedural-rider (root-motion control)
└─ hips
   ├─ torso-root
   │  └─ spine
   │     └─ chest
   │        ├─ neck
   │        │  └─ head
   │        ├─ clavicle-left
   │        │  └─ shoulder-left → elbow-left → wrist-left
   │        │     ├─ index / middle / outer finger chains (3 bones each)
   │        │     └─ thumb metacarpal → proximal → distal (3 bones)
   │        └─ clavicle-right
   │           └─ shoulder-right → elbow-right → wrist-right
   │              ├─ index / middle / outer finger chains (3 bones each)
   │              └─ thumb metacarpal → proximal → distal (3 bones)
   ├─ hip-left → knee-left → ankle-left → toe-left
   └─ hip-right → knee-right → ankle-right → toe-right
```

The simulated tail, ears, and ponytail remain auxiliary chains. They are
declared to the animation suite but are not humanoid retarget bones.

Each cartoon glove's semantic controls are constructed by one mirrored
procedural factory. The visible smooth surface is an attributed artist-authored
GLB driven from those controls at runtime. Its source Rigify arm is stripped to
one rigid palm root plus 12 deforming digit bones per side, with no control
bones, constraints, drivers, source scripts, or invented clips. The
conventional wrist remains the humanoid `handLeft`/`handRight` endpoint; the 12
optional semantic digit bones per side extend below it without expanding the
required humanoid role set. Existing clips therefore remain playable while
Animation Studio can key, mirror and onion-skin every finger independently.
The surface adapter transfers each semantic digit's root-space position and
orientation delta plus its local scale ratio, so the visible mesh follows the
complete transform track contract rather than rotation-only poses.

`hand-rest-orientation-left/right` are non-bone presentation mounts below the
conventional wrists. Character Lab writes linked pitch and mirrored yaw/roll to
those mounts after animation. They are deliberately absent from the semantic
skeleton so changing the default palm direction cannot contaminate wrist rest
transforms or saved animation tracks. Their authored base turns both palms
medially and both thumbs rider-forward; Character Lab values are offsets over
that anatomical rest.

Arm and leg joint chains now carry reusable `stretchable-cartoon-limb-bone`
visual components. These add no skeleton joints: each component hangs from an
existing proximal joint and follows its existing child joint. Its high-density
shaft owns longitudinal squash/stretch, while joint knobbles retain their local
scale and shape. Upper segments render both ends; each lower segment reuses the
preceding joint's distal knobble and adds only its own distal end, avoiding
overlap at elbows and knees. All eight segment visuals share one shaft geometry,
one knobble geometry and one smooth clay material.

## Stable animation identity

Animation tracks address semantic IDs, not Three.js UUIDs or display labels.
The existing IDs (`shoulderLeft`, `wristRight`, `hipLeft`, and so on) remain
valid so saved browser drafts and starter clips do not need rewriting.
Humanoid roles and aliases additionally expose conventional names such as
upper arm, hand, upper leg, foot, and toes. Importers should resolve, in order:

1. an exact semantic ID;
2. a declared alias;
3. the humanoid role map;
4. a model-specific mapping supplied by the importer.

Unknown joints are left at rest. Missing optional auxiliary joints must not
invalidate an otherwise usable humanoid clip.

## Bind pose and retarget pose

The runtime publishes two different poses deliberately:

- **Bind/rest pose** preserves the current neutral gameplay silhouette and is
  the immutable basis for rest-local animation tracks and skin inverses.
- **Canonical T-pose** is retargeting metadata. It places the arm chains on the
  horizontal X axis without forcing gameplay or the editor to open in a
  T-pose.

Skeleton inverses are calculated only after the complete rest hierarchy has
updated its world matrices. Retargeting must never overwrite the bind pose.

## Squash and stretch

Joint scale remains uniform. Length controls deform a segment by scaling only
its renderable children and translating its child endpoint; downstream joints
therefore do not inherit non-uniform scale. The torso control spans both lower
spine and chest policies, so a landing can shorten the full torso while the
neck, head, clavicles, and limbs keep their own proportions.

This is the required pattern for future skinning too: a mesh may use smooth
weights around a joint, but segment length still comes from endpoint
translation rather than scaling the entire descendant hierarchy.

## Compatibility rules

- Gameplay owns the outer player transform, collision, and movement.
- Animation Studio edits rest-local deltas and scalar deformation controls.
- Procedural motion and keyed corrections share the same semantic joints.
- Character Lab proportions are a reversible presentation layer over the live
  procedural rig; they never replace or detach semantic bone nodes.
- Adding twist, roll, face, finger, or secondary bones is additive; existing
  IDs, roles, aliases, and parent relationships must remain migratable.
