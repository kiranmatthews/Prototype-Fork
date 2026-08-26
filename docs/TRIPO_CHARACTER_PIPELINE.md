# Tripo → img2threejs CharacterIR-style pipeline

## What is installed

- `vendor/img2threejs` pins the official v1.5.1 toolchain at commit `d37b6de4920621b0091a351042b9bb89e9708b33`.
- `vendor/img2threejs-showcase` pins the companion Three.js/CharacterIR runtime at commit `a62ba87487e97a0c8cca90063bc0e85487e8894f`.
- `tools/tripo-character` pins the official Tripo CLI `0.2.1` and adds a provenance/rig-payload adapter.
- The official img2threejs Codex skill is installed in the user skill directory and becomes available to Codex on the next turn.

Upstream img2threejs currently documents Tripo as an opt-in external adapter but does not implement a Tripo provider. The Warrior `CharacterIR` is not a standard interchange format and is not in the main toolchain; it is a renderer-agnostic TypeScript schema plus Three.js compiler/runtime in the showcase.

## The two supported lanes

### Fast external lane

Use the final rigged/animated Tripo GLB directly in Three.js or a game engine. Label it `generative-assist` with Tripo model/task provenance. This is not a procedural img2threejs factory.

### Warrior-equivalent code-native lane

1. Generate an unrigged surface GLB with Tripo P1 or H3.1.
2. Run Tripo rig-check, humanoid Mixamo rig, and selected animation retargeting.
3. Use the **unrigged** GLB as the measurement instrument for `GLB_CHARACTER_PROMPT.md` and `GLB_CHARACTER_POLISH_PROMPT.md`.
4. Use the rigged/animated GLB only as skeleton and motion evidence.
5. Extract `rig-payload.json` and a CharacterIR authoring seed; explicitly map Mixamo names to semantic joints.
6. Derive/model-specific weights, secondary joints, props, cloth/hair/tail systems, and local animation corrections.
7. Gate the result with `GLB_CHARACTER_ANIMATION_PROMPT.md`, including payload validation, rest-pose preservation, joint loops, motion-phase penetration, and multi-angle browser review.
8. Embed accepted surfaces and keyframes as code if the final runtime must fetch no GLB/BIN.

The Warrior is far beyond an auto-rig: it uses 47 embedded Surface Nets regions, 53 model-specific bones, custom rigid/articulated/cloth/whisker/tail weighting, dual-quaternion skinning, a code-native staff attack, visibility preludes, and measured clearance corrections. The public showcase still marks its deformation review as conditional. Treat it as an implementation reference, not a generic one-click result.

## Run the prepared workflow

See [the tool README](../tools/tripo-character/README.md). The short form is:

```sh
python3 tools/tripo-character/tripo_character.py login --region ov
python3 tools/tripo-character/tripo_character.py doctor
python3 tools/tripo-character/tripo_character.py generate \
  --image /absolute/path/to/front.png \
  --name hero-character \
  --out tools/tripo-character/work/hero-character
```

Run `--dry-run` first when tuning model, face budget, rig version, or motion selection.

## Continue through img2threejs

Read these pinned references in order:

1. `vendor/img2threejs/docs/GLB_CHARACTER_PROMPT.md`
2. `vendor/img2threejs/docs/GLB_CHARACTER_POLISH_PROMPT.md`
3. `vendor/img2threejs/docs/GLB_CHARACTER_ANIMATION_PROMPT.md`

The GLB surface integration also needs the companion showcase and NumPy/Pillow:

```sh
uv sync --project vendor/img2threejs/integrations/glb_character_pipeline
export IMG2THREEJS_SHOWCASE_ROOT="$PWD/vendor/img2threejs-showcase"
export IMG2THREEJS_GLB_PIPELINE_PYTHON="uv run --project vendor/img2threejs/integrations/glb_character_pipeline python3"
```

On this Codex desktop runtime, `tripo_character.py doctor` reports a bundled Python 3.12 with compatible NumPy/Pillow, which can be supplied as `IMG2THREEJS_GLB_PIPELINE_PYTHON` when `uv` is unavailable.

## Verification

```sh
python3 -m unittest discover -s tools/tripo-character/tests -p 'test_*.py'
python3 tools/tripo-character/tripo_character.py generate \
  --image public/roo.png --name dry-run --out /tmp/tripo-dry-run --dry-run
npm run build
```

For a real generated result, also run:

```sh
python3 vendor/img2threejs/forge/stage5_rig/validate_rig_payload.py \
  --payload <output>/img2threejs/characterir-seed/rig-payload.json
```

Then review animation at front, 40°, and 90° through its entire cycle. A rest pose or a strip of still frames is not motion evidence.

## Security and deployment

Tripo says API keys must remain server-side. This GitHub Pages app must never call Tripo directly with a bundled key. Use the local CLI/device profile for asset production; a future web UI needs a Worker/function/backend proxy with `TRIPO_API_KEY` stored as a server secret.

Generated URLs are short-lived, so the CLI downloads outputs immediately. Do not commit expiring URLs, API keys, local Tripo profiles, generated GLBs, or baseline measurement binaries.
