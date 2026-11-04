# Crate material, multihit and Life portrait follow-up

The user requested natural material on Life, Mask, Bounce, Metal Bounce and
Bang; full Nitro-green coverage on Nitro Bang; a Crash 3/4-style multihit; and
the HUD's Bone Man face on Life when that head is selected.

## Materials and portrait

The five requested body stains are removed. Wooden variants retain the
approved timber surface; metal variants retain the independent Tripo steel
mesh and PBR material. Nitro Bang uses full-strength green over panels, frame,
gussets, underside and fasteners. Its cream gameplay marks remain readable.
TNT/Nitro geometry, Nitro glow, TNT-only fuse and checkpoint behavior are
unchanged.

`src/lifePortrait.ts` owns the shared head-to-image mapping. The HUD publishes
the active head through this service. Existing Life crate canvas textures are
repainted when the head changes, and newly created crates share the current
texture. Both `bone-head.png` and `roo.png` are the existing HUD artwork.

## Multihit reference and construction

The source is the open Wumpa cage in the user's
[Crash 4 reference](https://www.artstation.com/artwork/9mPL0a), specifically
the three vertical slats per face, bowed posts, heavy top/bottom frame and
solid plank caps. The source image was reviewed directly; it is not a
horizontal-slat crate.

Two ImageGen passes produced `multihit-cage-reference.png` and
`multihit-wood-albedo.png`. The cage consists of simple timber members authored
in Blender by `tools/build-multihit-cage.py`, following the project rule to
model simple frames manually. No new Tripo generation or credits were used
for this follow-up. An attempted Tripo web session was unavailable while the
Mac was locked; the already completed Tripo metal asset remains unchanged.

The cage has 30 closed members: four bowed posts, eight mitered rails, twelve
vertical slats and six cap planks. Sixteen dark nail heads stay attached to
their posts when broken. All four side openings are actual empty geometry,
with modeled inner faces. The finished lid and underside retain their full
geometry at every viewing distance and in reflections.

Five instances of the game's complete Round ripe fruit variant represent
remaining hits. Each bounce removes one and gives the contents a small finite
rebound. The gameplay rewards and collider are unchanged. The cage is 6,120
triangles; with the five 4,400-triangle fruit in this checkout it totals 28,120
triangles in two draws. The shared fruit generator remains the authority for
its geometry; the asset test recalculates the full count during integration.

The twelve narrow slats split on paired oblique planes, yielding 42 closed
fragments and 6,880 triangles. Original exterior triangles, UVs and surface
area are retained. Fresh cut ends use the existing timber fracture material.
Simultaneous fracture effects remain capped at 168 live bodies by retiring
complete older effects; no individual mesh is reduced or swapped.

## ImageGen prompts

Reference brief: one isolated empty wood cage, front-right three-quarter view,
slightly above; match the reference's open Wumpa cage and the existing warm
orange/golden family. One-metre cube; closed plank lid/underside; four chunky
bowed corner posts; broad top/bottom rails; three slender vertical bowed slats
on each of four sides; wide true gaps with visible inner faces/back slats.
Warm chestnut/honey highlights, restrained grain, modest dark nails, sparse
chips and broad facets. No fruit, symbols, dots, writing, X braces, straps,
extra props or collage. Neutral studio, minimal contact shadow, no baked cast
shadows. Runtime fruit are added separately.

Albedo brief: a flat square diffuse atlas matching the reference's warm orange
timber. Upper 92% continuous evenly lit vertical grain; broad flowing tapered
painterly strokes, subtle knots and long shallow grain lines; restrained color
variation. No perspective, object, board seams, bevel highlights, ambient
occlusion, shadows, screws, border or text. Lower 8% is a uniform dark neutral
gunmetal-grey nail swatch, separated by a straight edge. This replaces the
initial rejected UV mapping, whose reused bright rail highlights stretched
visibly along the new slats.

Rebuild with Blender's background mode and the script above, passing
`public/props/crate-family` as its output directory. Use the shared heavy-job
helper. Both GLBs embed the albedo; the production pipeline packs geometry
losslessly and resolves any extracted shared texture normally.
