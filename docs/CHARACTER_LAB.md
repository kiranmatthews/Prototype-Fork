# Character Lab

Character Lab is the browser authoring surface for the code-built procedural
rider. Open it with the **CHARACTER** presentation tool or append
`#characterlab` to the game URL.

## Ownership

- `src/character/settings.ts` owns the versioned, clamped and persistent design
  values stored under `solProtoCharacterProportions.v1`.
- `src/character/proportionLayer.ts` applies those values as a reversible layer
  over the current pose.
- `src/characterLab.ts` owns only the authoring UI, orbit camera and readouts.
- `src/player.ts` remains the owner of the live semantic skeleton, tail and
  final foot planting.

The lab is deliberately visual-only. Gameplay collision and movement remain
unchanged while the silhouette is being designed.

## Composition order

Each frame restores the prior design layer before procedural or keyframed
animation writes. The new design is then multiplied over the settled pose and
foot planting runs last. This keeps the following independent:

1. canonical humanoid rest pose;
2. procedural and keyed animation deltas;
3. temporary animation squash/stretch;
4. persistent Character Lab proportions;
5. gameplay collision.

The proportion layer scales renderable segment children and translates their
endpoints. It does not replace joint IDs, change hierarchy, or accumulate its
values from one frame to the next.

## Controls

The first schema includes overall scale/height/build, head size and axes, head gap
and torso dimensions, shoulder/hip width, separate upper/lower limb lengths,
limb thickness, independent arm/leg knob size, hand/foot size and animal-tail
visibility. Hand-rest pitch, yaw and roll are also persistent: pitch is linked
while yaw and roll mirror anatomically across the two wrists. These values live
on presentation mounts below the wrist bones, so a rest-orientation adjustment
does not alter authored wrist keyframes. Left/right anatomy remains linked and
mirrored in version 1 so a single slider cannot silently create a broken
asymmetric rig.

The Hand Rig Preview section provides open, relaxed, curl, fist, pinch and grab
poses plus a close-up camera. These are inspection presets over the same 24
digit bones that Animation Studio exposes for keyframing; they are not baked
animation clips.

The visible hand surface is Andy Cuccaro's attributed CC BY 4.0 three-finger
hand. Its source-only Rigify arm is reduced offline to one rigid palm root plus
the existing twelve semantic digit bones per side. The browser never loads the
`.blend`, Rigify controls, drivers, constraints, or embedded script. The
code-built surface remains only until the artist GLB has loaded and bound, then
is removed from the live hierarchy; its synchronous semantic bones and sockets
remain. Rest-relative position, rotation and scale changes on all 24 semantic
digit bones are transferred to the visible skin. The main artist surface is
presented in the character's glove white; its small authored cuff accent remains
separate.

The Limb Bone Preview frames all bones, arms, or legs. The existing upper-arm,
forearm, thigh and shin length sliders exercise the production deformation
path: only each measured Ivory Bone/Rattle shaft changes length while the
authored knobs and knobless insertion tips remain locally rigid. Thickness
changes the plain shaft cross-section through a boundary-safe taper. Arm/leg
knob-size sliders then scale the true knob regions uniformly for cohesive fat
bones. Their 1.00–1.62 range grows into the shaft seam without opening gaps;
Rattle's knobless glove/sock insertion tips remain byte-stable.

The **Torso** view frames the attributed Meshy skeleton tank-top surface. It is
not a foreign replacement rig: code-native weights bind it to the existing
torso-root, spine, chest, neck, and clavicle controls. Torso length therefore
bends and stretches through semantic endpoint motion, while width/depth and
animation volume correction remain reversible presentation layers. These three
torso controls target the imported torso surface only; shorts and butt/pelvis
surfaces remain under whole-body and hip controls. The former
procedural heart tank and bare-waist meshes are no longer present.

The **Head** view frames the attributed Meshy Crowned Inferno Skull. It is a
rigid child of the existing semantic head bone, so authored and procedural head
motion remain unchanged. **Neck height / gap** now translates only the head's
local Y offset: `0` closes the air gap, `1` gives the default 0.095m gap, and
`1.8` gives 0.171m. It never moves the neck bone, pulls the torso skin, or
scales the skull, and it adds over rather than multiplying any authored head
position track. The former visible kangaroo face, eyes, ears, hair, ponytail,
neck cylinder, necklace, and pendant are retired; empty ear/ponytail nodes stay
only for saved-animation compatibility.

Double-clicking a slider label restores that one value. **Reset all** restores
the complete default silhouette, and **Copy JSON** exports the current
versioned settings for source review.

## Removed comparison assets

The Quaternius mannequin, Violet Vixen FBX, their runtime adapters, and the old
hidden imported fox/roo comparison routes are intentionally retired. The CC0
Quaternius Jog_Fwd motion remains the procedural player’s editable Run clip;
its independent source record lives in
`public/animations/quaternius-jog-fwd/`.
