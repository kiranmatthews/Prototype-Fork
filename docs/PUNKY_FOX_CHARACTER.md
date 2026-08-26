# Punky Fox production character

This fork ships the supplied female bandicoot reference as a smooth-skinned,
animation-ready Three.js character at `public/models/punky-fox.glb`.

## Result

- 85,503 triangles; the hard ceiling is 100,000.
- One connected, UV-mapped `SkinnedMesh` and one PBR material.
- 28-joint skin with at most four normalized influences per rendered vertex.
- 22 body joints, four ponytail joints, and two ear joints.
- 2K base-color and renormalized tangent-space normal maps; 1K metallic and
  roughness maps. The channels remain independent.
- Ten embedded, root-motion-free clips at 30 Hz: `idle`, `walk`, `run`,
  `jump`, `spin`, `slide`, `crawl`, `fall`, `bail`, and `death`.
- The game remains authoritative for translation, board alignment, live spin,
  grind/manual balance, wallride alignment, grabs, and landing outcome.
- The original browser tail remains an eight-link procedural chain. The source
  FBX did not contain a trustworthy tail rig.

The web asset is about 14.1 MB. Its animation samples add only about 316 KB;
most of the payload is the 85K-triangle surface and embedded texture tier.

## Provenance and release boundary

The exact-match source is the owner-supplied Meshy `PunkyFox.fbx` from the
companion Unity project, not a new Tripo approximation:

```text
<companion-unity-checkout>/
  Assets/Game/Art/Characters/PunkyFox/Source/PunkyFox.fbx
SHA-256 af08188cdead944dbe9c4d21dda73d445bc56d646b72cad50e7bde232d5693d0
```

The source delivery says it came from Meshy but contains no separate licence
file. The repository owner requested that this asset be imported and published
here. That authorization does not create a general-purpose redistribution
licence; confirm the owner/Meshy terms before reusing the GLB outside this demo.

Animation FBXs are also owner-supplied Meshy/ActorCore evidence from that Unity
project. `extract_punky_animations.py` pins every selected source by SHA-256 and
fails if a source changes silently.

## Deterministic build

The scripts require Blender 5.2+ and Python 3.11–3.12 with NumPy and Pillow.
On the Codex desktop runtime, the compatible Python is:

```sh
PIPELINE_PYTHON=/absolute/path/to/python3
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
UNITY_ROOT="/absolute/path/to/Board Platformer Unity"
SOURCE_DIR="$UNITY_ROOT/Assets/Game/Art/Characters/PunkyFox/Source"
WORK_DIR=work/roo-character

"$PIPELINE_PYTHON" tools/character-pipeline/prepare_punky_textures.py \
  --source-dir "$SOURCE_DIR" \
  --out-dir "$WORK_DIR/web-textures"

"$BLENDER" --background \
  --python tools/character-pipeline/build_punky_glb.py -- \
  "$SOURCE_DIR/PunkyFox.fbx" \
  "$WORK_DIR/web-textures" \
  "$WORK_DIR/punky-fox-web.glb" \
  "$WORK_DIR/punky-fox-build-report.json"

"$BLENDER" --background \
  --python tools/character-pipeline/extract_punky_animations.py -- \
  --base-glb "$WORK_DIR/punky-fox-web.glb" \
  --character-root "$UNITY_ROOT/Assets/Game/Art/Characters/PunkyFox" \
  --meshy-root "$UNITY_ROOT/Assets/MeshyImports" \
  --out-glb "$WORK_DIR/punky-fox-animated.glb" \
  --report "$WORK_DIR/punky-animation-report.json"
```

The last successful build was repeated byte-for-byte and produced SHA-256
`a70c1f013e8fdfacde7ba5867a8531d887889a6c536db26bd9ebc73638388dbc`.

## Rig corrections

The raw source had 24 bones, up to nine influences per vertex, and an
arbitrarily weighted `head_end` helper. The build:

1. folds `head_end` into `Head` and removes `head_end`/`headfront`;
2. adds two-bone chains for each ponytail plus one joint per ear;
3. derives continuous geometric secondary fields from texture-confirmed seed
   regions with KD-tree falloff, avoiding UV-seam tears;
4. prunes each vertex to its strongest four weights and renormalizes;
5. retains the original body bind matrices and strips the base rest action;
6. exports the surface once, then appends animation-only accessors without
   copying source meshes.

The source has no finger, jaw, eye, or facial blend-shape controls. Expressive
readability therefore comes from head/neck posing, body silhouette, ear/hair
follow-through, and the existing game effects. Those limits are explicit; the
asset is not represented as a complete facial rig.

## Animation direction

The authored controller uses original animation and game-state overlays. It
does not copy proprietary Crash or Tony Hawk animation curves, skeletons, or
assets.

Crash-style guidance comes from Toys for Bob's public animation talk and
official Coco gameplay: immediate input response, compact readable poses,
elastic appendage follow-through, and longer holds only for idles, landings,
and failure gags. THPS-style guidance comes from official trailers and control
documentation: simulation-owned board/root motion, fast rail lock, live spin,
hand-to-board grab contact, weight over the active manual truck, and reopening
the silhouette before landing.

Primary public references:

- [Toys for Bob: The Art and Animation of Crash Bandicoot 4](https://www.youtube.com/watch?v=FwjW10ADGnE)
- [Official Crash 4 Coco gameplay](https://www.youtube.com/watch?v=WCJZwqQ6Nls)
- [Official THPS 3 + 4 reveal trailer](https://www.youtube.com/watch?v=D-PedsiljOc)
- [Official THPS 3 + 4 launch gameplay trailer](https://www.youtube.com/watch?v=_wZXzuCNSBw)
- [Official Activision controls and tricks](https://support.activision.com/tony-hawks-pro-skater-1-2/articles/controls-and-tricks-in-tony-hawks-pro-skater-1-2)

The full state/timing brief is in
[PUNKY_FOX_MOTION_SPEC.md](PUNKY_FOX_MOTION_SPEC.md).

## Validation and review

Run the structural checks before browser review:

```sh
python3 tools/character-pipeline/validate_punky_skin.py \
  work/roo-character/punky-fox-animated.glb \
  --out work/roo-character/punky-animated-skin-validation.json

python3 tools/tripo-character/glb_rig_to_characterir.py \
  work/roo-character/punky-fox-animated.glb \
  --out-dir work/roo-character/rig-evidence-animated

python3 vendor/img2threejs/forge/stage5_rig/validate_rig_payload.py \
  --payload work/roo-character/rig-evidence-animated/rig-payload.json
```

The accepted build has:

- zero coincident-point weight mismatches;
- zero sharp short-edge weight discontinuities;
- no scale tracks or scene-root animation channels;
- finite unit-quaternion samples;
- a passing 28-joint CharacterIR evidence payload;
- deformation captures at neutral, shoulder/elbow extremes, deep squat, torso
  twist, realistic ear/ponytail limits, and a skate silhouette, each at front,
  40°, and 90°;
- forty representative stills across all ten clips. These are supporting
  evidence, not a substitute for browser transition and gameplay review;
- a real-browser pass covering idle, locomotion release, charged jump,
  double-jump, air grab, spin, landing, crouch, full rendering, lite rendering,
  and front/side/rear studio orbits with zero console warnings or errors.

The deterministic photo-vs-render silhouette gate is recorded but not treated
as a likeness authority here: the supplied reference is posed, tilted, and
asymmetric while the bind review is frontal and symmetric. Its best 2D affine
fit remains well below the gate despite the model being the canonical source.
The side-by-side visual review and multi-angle geometry checks therefore remain
the meaningful likeness evidence.

## Runtime contract

`src/punkyCharacter.ts` preserves the imported skin and exposes typed bones,
clip playback/crossfading, deterministic sampling, root-motion locking,
additive bone poses, capped ear/ponytail springs, transform sync, and complete
GPU disposal. `src/player.ts` owns state selection and overlays. Gameplay
physics and `src/tuning.ts` remain unchanged.

The character root publishes `root.userData.sculptRuntime`, 28 stable bone
pivots, six sockets (hips, head, hands, and feet), a gameplay-owned capsule
collider description, and the embedded action list. Part coverage has zero
errors and 20 explicit warnings for the modeled-but-unjointed finger segments;
the source's single continuous skin is not misrepresented as an explodable
costume/anatomy assembly.
