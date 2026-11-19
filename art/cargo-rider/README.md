# Cargo Roo

Open **Cargo Roo.blend** in Blender 5.2. The character opens in the frontal neutral bind, with a centered gaze, relaxed mouth and zero facial controls. Select **Cargo Roo • Bone Man** for the action library and the individual sculpt sliders. The packed source includes 30 skinned meshes, 19 materials and 13 images. The game asset draws 146,465 triangles on the player's 72-bone hierarchy.

## Animate the face

In front orthographic view, the twelve labelled pads beside the character control gaze, jaw, lids, brows, mouth corners, lips, tongue, pupils and cheeks. Select a circular handle and move it along local X or Z. Clear its location to return it to its neutral position. The handles combine with keyed facial sliders. The eyelids wrap over separate globes, each iris can track or constrict, and the upper teeth, lower arch, mouth lining and tongue have independent geometry.

The Action Editor contains 17 facial takes at 24 fps. **Face | Kling 1910** follows the supplied 15.04-second performance. Its timeline markers locate the first blink, gaze reversal, laugh, lowered eyes and final grin. Frame 1 and frame 362 share the neutral bind. The head and neck area turns with the recorded look through a keyed head rotation. The other facial takes layer onto the player's body animation.

**Attentive idle**, **Wink**, **Smile** and **Surprise** provide the quieter performances. **Cackle**, **Yikes**, **Snarl**, **Smug**, **Puffer**, **Splat**, **Howl**, **Sour**, **Raspberry**, **Gasp**, **Dazed** and **Suspicious** each have their own anticipation, hold and release. **Portrait | Reference smile** stages the shoulders and the asymmetric expression for the supplied three-quarter drawing. **Portrait | Profile glance** gives the side portrait its own eyeline. Five Bone Man body actions are also available in the source.

In the game, open **Character Lab → Cargo Roo**. The four quick buttons and the expression selector hold individual poses. **Play take** plays the complete selected performance. **Kling reference loop** repeats the source-matched take. Closing the lab restores normal gameplay acting. In a standalone GLB viewer, select clips by their lowercase names, including `kling1910`.

## Surfaces and rig

The head uses the front-facing neutral Smart Mesh draft. Its open orbit and lip boundaries supply the deformation topology. Blender sculpts control the mandibular hinge, lip seal, unilateral corners, cheek compression and lift, brow angles, curved blink and gaze. The closed-lid driver fades the eyelid angle as the upper and lower lids meet. The upper teeth stay attached to the cranium while the lower arch follows the jaw. The cheek undertone is authored as an editable material response and a game vertex-colour morph.

The blonde cap fits the nape of the replacement head. The elastics and ear bases align across the skull, with independent tips, ponytail sway and ear motion. Twelve incised cowries wrap the neck. A skinned jersey panel joins the shoulders across the upper back. Its scoop and armholes use a narrow pink binding. The 2048-pixel base-colour maps, 1536-pixel tangent normals and roughness maps, 1024-pixel iris and separate jersey textures are packed into the source. The runtime includes the PBR textures and the full facial clip library.

The private Tripo Smart Mesh inputs are recorded on the export armature.

| Input | Tripo task | Generated triangles |
| --- | --- | ---: |
| Neutral head | `8476f9bd-b5b0-4b33-9c99-5ce1dcef8a0d` | 26,917 |
| Coiffure and ears | `d5924dc5-8b39-4f70-8d31-974e1a02af90` | 28,705 |
| Body and wardrobe | `5fead724-66d0-4511-9591-63125916b590` | 28,658 |

## Rebuild and verify

The artist file and the standalone GLB are self-contained. To rebuild from the generated drafts, place the original private files named `neutral.glb`, `bust.glb` and `body.glb` in one directory. The delivered **Components** folder has this layout. From the repository root, run the following commands with that directory substituted for `/path/to/Components`.

```sh
python3 tools/cargo-rider/studio/prepare.py /path/to/Components /tmp/cargo-maps
blender --background 'art/cargo-rider/Cargo Roo.blend' --python-exit-code 1 \
  --python tools/cargo-rider/studio/assemble.py -- /tmp/cargo-maps /tmp/cargo-out asset
blender --background '/tmp/cargo-out/Cargo Roo.blend' --python-exit-code 1 \
  --python tools/cargo-rider/verify_source.py
```

The preparation step uses NumPy and Pillow. `src/character/cargoRiderTakes.json` contains the original frame-level acting curves, event markers and reference head angles. `src/character/cargoRiderExpressions.json` contains the still-pose controls. Blender writes editable F-curves and exports sampled glTF weights with a separate clock for each take. The game reads the same score and adds the reference head rotation to the skin palette when that take is selected.

The native audit checks weights and bind matrices, packed images, lid and jaw geometry, dorsal coverage, shoulder corrections, picker drivers, every facial key and neutral endpoints. Against a running development server, `node tools/cargo-rider/audit.mjs http://127.0.0.1:5173 /tmp/cargo-review` evaluates the 193 player-animation entries, both skating stances, skin separation and the final GLB's facial playback. `tools/cargo-rider/playtest.mjs` accepts the same arguments and exercises the actual Character Lab buttons, hands and gameplay at three render settings.

[Supplied turnaround and Blender renders](likeness/comparison.webp) · [In-game facial poses](performance/game-expressions.webp) · [Body animation frames](performance/game-proportions.webp)
