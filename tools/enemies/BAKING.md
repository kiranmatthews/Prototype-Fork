# Enemy surface and rig baking

`bake_assets.py` runs inside Blender. Raw downloaded Meshy files, review renders,
and intermediate payloads stay in ignored `.img2threejs/enemies/`. It never
submits provider jobs or reads credentials.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/enemies/bake_assets.py -- inspect hopper
```

Inspection emits a geometry/material report and front, quarter, side, back and
top renders in `.img2threejs/enemies/review/hopper/`. These are required evidence
for orientation, limb placement and mechanical seams. A neutral front is game
`+Z`; Blender's equivalent front is `-Y`.

After inspecting a source, author a model-specific JSON bake spec. It must record
`reviewedSource`, the target `maxSize` in game XYZ metres, and optional
`yawDegrees`. The normalizer uniformly fits the model to those bounds without
changing its proportions. Grounded models have their feet at zero. A hovering
model can set `centerY: 0.05`. `maxRadiusXZ` constrains a rotating enemy's swept
extent, which can exceed its static X/Z bounds. Optional `textureSize` and `textureQuality` default
to 1024 and JPEG quality 86.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/enemies/bake_assets.py -- bake hopper \
  --spec tools/enemies/rigs/hopper.json
```

Only create a spec after viewing the actual generated geometry. Authored specs
include `sourceSha256`; the baker refuses to apply those measurements to a
different source model. The first reviewed custom rigs are hopper, floater,
sentry and spinner.

For custom deforming rigs, a spec contains `joints`. Each joint has a unique
`name`, a world-space `position` in the normalized game model, optional `parent`
name, and optional world `yaw` in radians. The glTF writer emits identity local
axes by default, making local X the gait hinge and local Y the segment length.
`enemyRig.mapping` records runtime semantic aliases and axis overrides.

Each joint also has one or more `fields`: capsule `start`/`end` points, `radius`,
optional `strength`, and anatomical `windows`. A window such as
`{"x":[0.18,0.8,0.06]}` gives its lower and upper bounds with a smooth 0.06 m
fade. Optional `islands` restrict a field to measured connected surface pieces.
The report's `geometricIslands` joins duplicate UV seam positions for these
connectivity queries without discarding source UVs. Overlapping fields blend;
the strongest four weights are normalized. A
vertex outside all authored fields aborts the bake. Windowed weights require
model-specific visual review through the complete motion cycle, including
planted feet and segment deformation; a valid rest pose is not a motion pass.
Slanted `planes` can blend across an anatomical boundary using a game-space
normal, scalar `range`, and smooth `fade`; the bull's neck uses complementary
fields so a strong head hinge does not create a sharp shoulder weight boundary.

`glb_rig.py` appends skin data directly to the compact static export. Joint bind
matrices are computed in game coordinates, with matching inverse binds. This
keeps Blender bone conventions from silently rotating runtime control axes.
It requires identity mesh transforms and rejects incomplete GLBs, invalid
weights, or unweighted vertices.

Mechanical models can instead define `parts`, `defaultPart` and optional `cuts`.
Each part has `name`, world `position`, optional `parent`, optional game-Y `yaw`,
and a `select` list. A selection can constrain game XYZ `bounds`, `radiusXZ`, or
`angleXZ` in degrees. `islandBounds` and `islandRadiusXZ` select entire existing
surface pieces, preserving closed bearings and assemblies. The first matching
part owns each source face; remaining
faces belong to `defaultPart`. `ownMaterial: true` gives a lens its own material
so runtime charge glow cannot brighten the whole enemy.

An authored planar seam is `{ "normal": [0,1,0], "offset": 0.3 }`, representing
`normal · gamePosition = offset`. The source is bisected at that plane before
classification; disconnected parts get closed caps with their optional
`seamColor`. UV coordinates on the original surface remain intact. Use cuts at
reviewed bearings and sockets, then review rotation/retraction poses to check
that their closed interiors stay hidden. The tool does not infer seams from an
image or guess mechanical joints.

The charger requires two reviewed source repairs recorded in its spec:
`removeSourceIslands` drops redundant floating muscle wraps over its complete
underlying body, and `sourceAdjustments` shortens only its remote soft tail.
`fitExclude` excludes that tail from solid-body sizing. Original corner-normal
vectors are retained through mesh cleanup and transformed for tail compression.
Its documented 0.25 m tail allowance is checked per vertex against actual tail
weights; the body, horns and hooves receive no collision-fit exception.

`render_pose.py` renders explicit local rotations, translations and scales from
the final GLB. `--plant-feet` applies the same shoulder/hip-origin correction as
the runtime, useful when checking the frog's grounded crouch. Pose renders are
geometry checks, and do not replace a full live motion-cycle review.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/enemies/render_pose.py -- hopper crouch-planted \
  --pose .img2threejs/enemies/hopper-crouch.json --plant-feet
```

Final baking produces `public/enemies/<kind>.glb`, an ignored local bake report,
and five post-export renders. The CLI records `outputSha256` and `outputBytes`
back into the rig spec after a successful bake. Meshy source generation and texture provenance
remain in the companion production manifest. Before publishing, the completed
assets still require multi-angle real-browser motion and gameplay review.
Exports are staged under the ignored authoring directory and replace the public
file only after skin validation and requested renders succeed. Use Blender's
`--python-exit-code 1` in scripted production to propagate Python failures.

`node tools/test-enemy-assets.mjs` requires all eight real shipped GLBs and
loads them through Three.js GLTFLoader and the enemy runtime. It checks source
and output hashes, the ImageGen reference, skin weights/inverse binds, real
semantic joint chains with weighted geometry, PBR texture/transfer budgets,
combat/support bounds, the floater's lowest swoop clearance, actual quadruped
walk deformation, and the spinner's complete extended/retracted sweep. The
temporary `--custom-only` flag checks the four custom rigs while the quadrupeds
are still being produced; it reports the limited scope explicitly.

The file check verifies encoded image dimensions and bytes and supplies a
headless ImageBitmap for loading. It does not replace rendered texture or
full-cycle visual review.
