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

The simulated tail remains an auxiliary chain. Empty ear and ponytail nodes are
still declared to the animation suite for saved-track compatibility, but no
longer own visible surfaces and are not humanoid retarget bones.

The visible head is the attributed static Meshy **Crowned Inferno Skull**,
rigidly attached beneath the existing semantic `head` bone. Its source bottom
is rebased to local Y=0, making the head bone a stable base pivot.
Character Lab neck height changes only `head.position.y`: the `neck` bone,
torso skin, and head scale remain invariant, so the value is literal air space.
The gap is an additive offset over live animation, preserving procedural or
keyframed head translation.
Head size/width/depth still scale the head bone around that attachment point.
The look and mask-center sockets are rebased to the imported face while empty
ear/ponytail nodes preserve old animation IDs.

The visible shorts are the attributed static Meshy **Midnight Chain Denim**
surface. Runtime code binds its main cloth to `hips`, `hip-left`, and
`hip-right`; it never adds bones or gives knee/shin rotation authority over the
hems. The waistband and central crotch remain pelvis-dominant, each cloth leg
follows only its matching upper-leg bone, and every detached chain/hardware
island is rigidly assigned. Independent pre-skin width/height/depth morphs own
clothing fit, so `legThickness` affects limb bones but never the shorts. The
waistband overlaps the torso and exposed lower legs insert inside the hems.

Visible footwear uses the attributed static Meshy shoe-and-sock surface. The
source contains no rig, so deterministic runtime geometry separates its sock
island from the shoe and five lace/detail islands. Each rigid shoe is an
`ankle-left/right` descendant, preserving outsole discovery and the existing
planting contract. Each sock is skinned only to its matching knee and ankle:
the hidden base follows the ankle while the cuff remains with the shin. The
opposite foot is a lateral geometry mirror with corrected winding and normals.
`footSize` still scales the ankle, toe and all three contact sockets together;
`legThickness` widens the exposed sock through a tapered morph without scaling
the shoe. `socket-foot-*`, `socket-heel-*`, and `socket-toe-*` retain their
original transforms and animation identities.

The visible torso is the attributed Meshy **Skeleton Tank Top** surface. Its
source FBX is static and unrigged, so runtime code generates smooth weights for
the existing torso-root, spine, chest, neck, and both clavicles; it does not add
or rename a semantic joint. The mesh is mounted beside the skeleton beneath
`procedural-rider`, avoiding doubled parent/bone transforms. Torso endpoint
translation drives longitudinal skin deformation. Two relative pre-skin morph
channels independently own width and depth, and animation volume correction
composes through both. They target the torso surface only—never the shorts or
pelvis. The old procedural heart tank and bare-waist surfaces are
retired, while gameplay collision remains unchanged.

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

Arm and leg joint chains carry reusable `stretchable-cartoon-limb-bone` visual
components without adding skeleton joints. Both upper arms use the attributed
Meshy **Ivory Bone** surface. Forearms, thighs, and shins use **Ivory Rattle**;
its distal region is the authored knobless insertion tip that enters gloves,
socks, or the following joint silhouette. Left/right instances share immutable
generated geometry and mirror only at the component root.

Each source mesh is split at measured cylindrical boundaries into a rigid
proximal region, a deformable shaft, and a rigid distal region. Length changes
scale the rebased shaft from its proximal boundary and translate the distal
piece to the new endpoint; neither rigid piece changes local scale or shape.
At extreme squash values the rigid ends may overlap while the shaft clamps to a
small positive span—there is never an inverted mesh. Thickness uses a shared
relative shaft morph that tapers to zero at both clipped boundary rings, so
knobs and insertion tips remain exact and no seam opens. Source-derived length
animation can apply the same tapered morph for volume compensation calculated
from the changing shaft span rather than the unchanged rigid ends. Production
solves the importer-derived quadratic shaft-volume equation across animation
and authored thickness, with a non-inversion guard for impossible combined
extremes. It uses derivative flat normals so lighting follows those faces. The eight
production segments share six source-derived part geometries and one smooth
clay material.

Character Lab may separately enlarge arm and leg knobs from 1.00–1.62×. That
authoring layer scales each actual knob region uniformly in XYZ; it does not
change shaft thickness or the length-animation contract. Ivory Bone's distal
knob stays pinned to the semantic elbow socket, while every Ivory Rattle
knobless insertion tip remains unchanged for glove, joint, and sock fit.

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
