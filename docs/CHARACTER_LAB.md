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

The first schema includes overall scale/height/build, large-range head size and
axes, head gap/overlap and fore-aft placement, torso dimensions, shoulder/hip
width, a mirrored resting upper-arm angle, separate upper/lower limb lengths,
limb thickness, independent arm/leg knob size, shorts width/height/depth, hand/foot size and animal-tail
visibility. Hand-rest pitch, yaw and roll are also persistent: pitch is linked
while yaw and roll mirror anatomically across the two wrists. These values live
on presentation mounts below the wrist bones, so a rest-orientation adjustment
does not alter authored wrist keyframes. Three rest-relative Glove X controls
move both dorsal marks together: the across-hand offset mirrors, while
along-hand and dorsal lift match. Left/right anatomy remains linked and
mirrored in version 1 so a single slider cannot silently create a broken
asymmetric rig.

The six head/neck controls—size, width, depth, gap/overlap, forward/back and
neutral tilt—are stored as independent **Skull** and **BoolieRoo** profiles.
Changing Head shape swaps only those six values; torso, limbs, clothing, hands
and the Idle arm angle remain shared. Legacy saves seed both profiles from the
former shared values. Copy JSON includes both profiles, while Reset all resets
both and returns to Skull.

The shipped silhouette is an authored defaults-revision-5 pose rather than the
all-ones rig identity. **Reset all** restores that authored pose. The identity
map remains available to animation/rig tests as the canonical no-op proportion
layer. Browser saves retain the defaults they were authored against: untouched
legacy identity values adopt the new silhouette, while values the user actually
changed remain deliberate overrides.

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
presented in the character's glove white, including the authored rolled cuff.
Each production hand also carries a mirrored code-native black dorsal X under
the rigid artist-hand root, so it follows wrist/hand-size changes without being
pulled or sheared by finger animation. Character Lab's across/along/lift
sliders are applied after animation and work on the synchronous procedural
fallback as well as the artist surface.

The Limb Bone Preview frames visible bones, arms, or legs. Upper-leg surface
roots remain live but are intentionally hidden beneath the shorts to prevent
pose clipping; hip/knee joints and thigh-length animation are unchanged.
Lower legs combine the Ivory Bone shoulder-style proximal knob with the Ivory
Rattle shaft and knobless sock insertion. The existing upper-arm, forearm,
thigh and shin length sliders exercise the production deformation path: only
each measured shaft changes length while authored knobs and knobless insertion
tips remain locally rigid. Thickness
changes the plain shaft cross-section through a boundary-safe taper. Arm/leg
knob-size sliders then scale the true knob regions uniformly for cohesive fat
bones. Their 1.00–1.62 range grows into the shaft seam without opening gaps;
Rattle's knobless glove/sock insertion tips remain byte-stable. At the most
compressed hybrid-shin extreme, only proximal-knob Y growth is capped before
the ankle endpoint; its full X/Z knob thickness remains available.
**Upper-arm inward angle** adds a mirrored local-Z shoulder rotation only to
rest/Idle presentation: positive values slope both arms medially toward the
torso while the clavicles, shoulder pivots, elbow offsets, and authored limb
lengths stay fixed. Run and every other authored action receive zero weight, so
their existing upper-arm keys and silhouette are unchanged.

The **Torso** view frames the attributed Meshy skeleton tank-top surface. It is
not a foreign replacement rig: code-native weights bind it to the existing
torso-root, spine, chest, neck, and clavicle controls. Torso length therefore
bends and stretches through semantic endpoint motion, while width/depth and
animation volume correction remain reversible presentation layers. These three
torso controls target the imported torso surface only; shorts and butt/pelvis
surfaces remain under whole-body and hip controls. The former
procedural heart tank and bare-waist meshes are no longer present.

The **Head** view frames the attributed Meshy Crowned Inferno Skull. It is a
rigid child of a non-semantic `head-presentation` mount below the existing head
bone, so authored and procedural `head` keys remain unchanged. Head size spans
`0.4–4.0×`; independent width and depth span `0.4–3.0×`. **Neck gap / overlap**
moves only that presentation mount in the neck's Y axis:
the shipped default `0` closes the air gap, `1` gives the 0.095m reference gap,
and negative values down to `-4` sink the base as far as 0.38m below the neck
pivot for intentional overlap. **Head forward / back** adds `-0.5…+0.5m` along
the neck's Z axis (positive is rider-forward), independent of animated head
look rotation. **Neutral head tilt** adds `-60…+60°` around presentation-local
X; positive tips the face down and negative raises it. The mount composes all
three transforms after every animation, so Run, jumps and action poses inherit
the chosen head profile without baking it into animation keys. None moves the
semantic neck/head bones, pulls torso skin, or changes collision. The former visible kangaroo face,
eyes, ears, hair, ponytail, neck cylinder, necklace, and pendant are retired;
empty ear/ponytail nodes stay only for saved-animation compatibility.

The **Head shape** buttons switch that production skull against the second,
owner-supplied Meshy **BoolieRoo** head for quick silhouette evaluation. Both are
rigid children of the same presentation mount and use their own saved head/neck
profiles; the option changes no skeleton, animation,
socket or collision data. The owner confirms BoolieRoo is an original design;
the unrelated character name that Meshy auto-assigned to its downloaded files
has been removed from every production identifier. Its losslessly indexed mesh chunk and compact
textures are loaded only after **BoolieRoo** is selected; the skull stays visible
during a cold load.

BoolieRoo now uses the cleaned colour atlas and a painted blink in game. Each
player independently waits 2–6 seconds between blinks and chooses a 0.2–0.4
second blink length. The lid closes quickly, briefly holds, and reopens more
slowly. It follows the existing UVs with a reusable 256² paint layer in the
same material, so the 15,634 triangles, skeleton, collisions and draw count
are unchanged. Holding a pose causes no texture uploads; game pause freezes
the clock and the inactive Skull selection suppresses paint work. This is a
texture illusion: the original raised lash silhouette remains fixed. Runtime
state is exposed under `getAlternateHeadDiagnostics().blink`.

Character colour maps are authored straight from their original 2K/4K sources
as bicubic-sharpened 512² images, then stored as pixel-lossless WebP. Roughness
and the shorts' meaningful metal mask remain as 256² lossless data textures.
Near-neutral normal maps and effectively empty metallic maps are omitted. Mesh
repacking only indexes byte-identical attribute tuples; it does not quantize
positions, UVs, weights, morph inputs, or animation data.

The **Shorts** view frames the attributed Meshy Midnight Chain Denim garment.
Its waistband/seat stay hips-dominant while each lower cloth leg follows only
its matching upper-leg bone; chain links and belt hardware are rigid islands so
they cannot melt under skinning. Clothing controls independently set shorts
width, top-pinned height, and depth. `Leg thickness` never targets the shorts.
At the default fit, the waistband overlaps inside the torso and the lower-leg
bone surfaces enter slightly inside both frayed hems. The former procedural
pelvis, belt, cargo legs, pockets, and chain are retired.

The **Shoes** view frames the restored procedural footwear on both feet. It
uses the original sock cylinder, shoe ellipsoid, two chunky lace bars, and
capsule outsole envelope, restyled from the attributed Meshy reference: black
upper, brick-red sock and darker cuff, warm-white sole/laces/side stripe, and a
thin black foxing band. `Foot size` continues to scale the semantic
ankle/toe/socket branch. `Leg thickness` and shin length act on the knee-owned
sock/cuff without resizing the ankle-owned shoe. The sole remains exactly at
Y `-0.05` with heel/toe Z `-0.07…0.20`, so all planting sockets are unchanged.
No Meshy footwear mesh or texture is loaded by the character runtime.

Double-clicking a slider label restores that one value. **Reset all** restores
the complete default silhouette, and **Copy JSON** exports the current
versioned settings for source review.

## Removed comparison assets

The Quaternius mannequin, Violet Vixen FBX, their runtime adapters, and the old
hidden imported fox/roo comparison routes are intentionally retired. The CC0
Quaternius Walk_Loop and Jog_Fwd motions remain the procedural player’s
editable Walk and Run clips. They share one source skeleton; their independent
source records live in `public/animations/quaternius-walk/` and
`public/animations/quaternius-jog-fwd/`.
