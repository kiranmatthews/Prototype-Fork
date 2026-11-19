# Cargo Roo

Open **Cargo Roo.blend** in Blender. It opens on the editable **Portrait | Three-quarter reference** action. Three reference cameras frame the supplied three-quarter, rear and profile drawings at their original scale. A fourth camera frames the complete character. The selected **Cargo Roo • Bone Man** armature has the player’s 72 measured rig nodes. The source contains 74,544 quads in 34 skinned meshes. The game draws 149,088 triangles. Twelve materials share three packed 4096 × 2048 maps for colour, tangent-space normals and surface roughness/metalness.

## Animate

Select the armature and use the Action Editor. **Face | Twelve performance poses** plays all twelve expressions at 24 fps. Its named timeline markers locate the drawings. Choose an individual **Pose | …** action to edit the constituent controls. **Face | Glance, wink and grin** and five sampled Bone Man actions cover a quieter acting take, idle, run, jump, crawl and ollie.

The armature’s Custom Properties include 45 facial and ear controls, four ponytail controls and two arms-down shoulder correctives. Animate the upper and lower dental exposure, asymmetric mouth corners, cheek volume, jaw offset, iris size, crossed or divergent gaze, tongue extension and curl, ear fold and ear perk. The shape keys are editable. Eighteen regional correctives keep the irises inside the moving lids, fit the upper and lower dental arches to each expression and round the inflated cheeks. Twelve complete pose targets carry normals evaluated on their final sculptures. The motion audit compares these targets with their editable component controls.

In the game, open **Character Lab → Cargo Roo**. The **Performance poses** selector contains Cackle, Yikes, Snarl, Smug, Puffer, Splat, Howl, Sour, Raspberry, Gasp, Dazed and Suspicious. The four quick buttons also preview Live, Wink, Smile and Surprise. Closing the lab restores live expression, gaze and blinking. The existing player hierarchy supplies body motion, individual finger curls, segment stretching and contact sockets.

## Proportion and performance studies

The upper arm, forearm and hand use the original shoulder, elbow, wrist and finger positions. Each arm starts on a welded 44-vertex loop in the torso. The tank and the inner socket follow the chest and clavicle. The deltoid gradually transfers the surface to the humerus. Measured in glove space, the palm spans 0.169 × 0.109 units across and in depth. The stock Bone Man glove spans 0.174 × 0.128.

The ImageGen drawings cover four body views, three action poses and twelve expressions. A front three-quarter, rear and profile study guided the hair sculpt. Its longitudinal pigment comes from a separate blonde strand swatch. [Turnaround](performance/turnaround.webp) · [Movement](performance/movement.webp) · [Expressions 1](performance/expressions-1.webp) · [Expressions 2](performance/expressions-2.webp) · [Hair study](performance/hair-study.webp) · [Strand pigment](performance/hair-pigment.webp) · [Generation prompts](performance/reference-prompts.md) · [Study beside Blender renders](performance/sculpt-comparison.webp)

The three-view portrait supplied for the final sculpt shows the head, necklace and shoulders. The comparison pairs each drawing with the actual Blender render from the corresponding camera. Intersection-over-union measures projected foreground area. It measures the outline only. [Original three-view](likeness/three-view.webp) · [Drawing and Blender comparison](likeness/comparison.webp) · [Silhouette measurements](likeness/measures.json)

The game captures show the same exported mesh in the native player. [Body and movement](performance/game-proportions.webp) · [Facial poses](performance/game-expressions.webp)

## Art construction

The supplied illustration sets the silhouette, palette, facial proportions and costume. The supplied Kling loop and three related facial clips informed the wink, asymmetric brows, side glance and opening smile. Two built-in ImageGen edits provided construction views. The head study requested a neutral front and right profile on the same scale, retaining the violet eyes, eyeliner, cream muzzle, gold hair and pointed ears. The turnaround requested a front and rear orthographic with the same proportions, lilac cargo pants, pockets, trimmed tank, sneakers and jewelry. Those retained images are inputs to the pigment bake.

The cranium, orbital surrounds, cheek tufts and chin share a continuous quad surface around two eye openings and an openable mouth. The whisker pads rise on either side of a central philtrum. Each folded ear has a hollow inner wall. The two ponytails have shaped bundles inside double elastic rings. Their swept sections follow rapid head turns and settle as the head slows. Twelve scored oval shells surround the neck. The pink neckline and armhole bindings are three closed pieces with their own geometry. The shoulder correctives follow the arm in chest space and carry the fabric edge through the pose. Each dental crown has depth behind the lips. The cheek undertone blends into cream during inflation in both the Blender shader and the game mesh. The GLB stores this tint alongside the shape as a vertex-color morph. The swept hair sections, corded pocket flaps, cowries, shoes and hands have named vertex groups in Blender.

## Rebuild and verify

Run these from the repository root with Node dependencies installed, Python with NumPy and Pillow, Blender 5.2 and Chrome. Use a scratch directory for intermediate geometry, sampled actions and review images.

1. Run `node tools/cargo-rider/measure-rig.mjs` to regenerate the bind measurements from the current player.
2. Run `python3 tools/cargo-rider/sculpt.py /tmp/cargo-roo` to construct the quad surfaces and bake the three material maps.
3. Start the project’s Vite dev server. Run `node tools/cargo-rider/audit.mjs http://localhost:5173 /tmp/cargo-roo` against the checked-in GLB to capture the current native actions. The runner uses the Playwright package or the module in `PLAYWRIGHT_MODULE`.
4. Run `blender --background --factory-startup --python-exit-code 1 --python tools/cargo-rider/blender_export.py -- /tmp/cargo-roo`. Render the calibrated UVs and material surfaces with `blender --background 'art/cargo-rider/Cargo Roo.blend' --python-exit-code 1 --python tools/cargo-rider/likeness_review.py -- /tmp/cargo-roo/views --uv`.
5. Create `/tmp/cargo-roo/painted` and copy `surface.pickle`, `surface-response.png` and `player-actions.json` there from the bake. Run `python3 tools/cargo-rider/study_pigment.py /tmp/cargo-roo /tmp/cargo-roo/views /tmp/cargo-roo/painted art/cargo-rider/likeness/registration.json` to transfer the photographed markings and fibre relief to their visible UVs.
6. Run `blender --background --factory-startup --python-exit-code 1 --python tools/cargo-rider/blender_export.py -- /tmp/cargo-roo/painted /tmp/cargo-roo/studio`. This writes the packed source, game GLB, transparent HUD portrait and five studio views. Reopen the packed file with `blender --background 'art/cargo-rider/Cargo Roo.blend' --python-exit-code 1 --python tools/cargo-rider/verify_source.py` to check the rig, maps, expressions, and chest-relative drivers.
7. Rerun the motion audit on the export. It samples the gameplay, starter and Studio clips, both skating stances, a two-metre detached wrist and a full-geometry spin capture. To exercise the real picker, reload persistence and three render modes against a running game, run `node tools/cargo-rider/playtest.mjs http://localhost:5173 /tmp/cargo-roo/playtest`.

The audit also writes `upper-actions.json`. To compare a previous bake with the current chest, run `python3 tools/cargo-rider/measure-performance.py <previous-surface.pickle> <current-surface.pickle> <upper-actions.json>`. It replays the same player matrices and compares edges present in both ribcages. A value of one means an edge kept its bind length.

The three contour cages and the tank pattern in `likeness/` are saved authoring data. To recut the shirt after a body edit, run `garment_review.py` in Blender with the bake directory and an output NPZ. Run `garment_pattern.py` with that same bake directory, the new NPZ and the destination `tank-pattern.npz`. The photo comparison uses a common set of three cameras on both revisions. Run `compare_likeness.py` with the previous render directory, the revised render directory and an output directory to reproduce the board and measurements.
