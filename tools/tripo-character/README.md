# Tripo character adapter

This directory pins the official `tripo-cli` and composes its documented character workflow for img2threejs:

```text
image
  → Tripo P1/H3.1 model
  → rig-check
  → v1 humanoid Mixamo rig
  → selected in-place biped motions
  → downloaded GLB
  → img2threejs GLB probe + rig-payload validator
  → CharacterIR authoring seed
```

The Tripo CLI owns authentication, task polling, retries, credit handling, and downloads. `tripo_character.py` does not duplicate that logic; it feeds each successful CLI JSON result into the next official CLI command and records hashes/provenance.

## One-time setup

From the repository root:

```sh
git submodule update --init --recursive
cd tools/tripo-character
pnpm install --frozen-lockfile
cd ../..
python3 tools/tripo-character/tripo_character.py login --region ov
python3 tools/tripo-character/tripo_character.py doctor
```

The login command prints a Tripo verification URL and one-time code. The human must sign in, confirm that the browser code matches the terminal, and authorize it. Never paste an API key into chat or commit one. China-mainland accounts use `--region cn`.

`doctor` checks the official CLI authentication/network/balance plus the two pinned submodules and a Python 3.11–3.12 runtime with NumPy/Pillow for img2threejs's GLB surface pipeline.

## Plan without spending credits

```sh
python3 tools/tripo-character/tripo_character.py generate \
  --image /absolute/path/to/front.png \
  --name hero-character \
  --out tools/tripo-character/work/hero-character \
  --dry-run
```

## Generate, rig, and prepare evidence

```sh
python3 tools/tripo-character/tripo_character.py generate \
  --image /absolute/path/to/front.png \
  --name hero-character \
  --out tools/tripo-character/work/hero-character \
  --model tripo-p1 \
  --face-limit 5000 \
  --animation preset:biped:idle \
  --animation preset:biped:walk \
  --animation preset:biped:victory_celebration
```

The default rig is `v1.0-20240301`, `biped`, Mixamo naming, GLB output. That humanoid rig exposes the 90+ biped preset family used for Warrior-like authored actions. Use `tripo-v3.1` only when the higher surface fidelity justifies a much heavier reference mesh. Tripo accepts at most five animations in one retarget batch.

The command is blocking and can take several minutes. Do not stop it after seeing a task ID. On success the output contains:

- `workflow-manifest.json` — source hash, sanitized commands, task results, local file hashes, and provenance boundary;
- `img2threejs/surface-glb-probe.json` — unrigged surface inventory;
- `img2threejs/rigged-glb-probe.json` — skin/animation inventory;
- `img2threejs/characterir-seed/rig-payload.json` — img2threejs structural gate payload;
- `img2threejs/characterir-seed/characterir-authoring-seed.json` — semantic skeleton/action evidence seed;
- `img2threejs/characterir-seed/glb-rig-report.json` — mappings, unsupported channels, and remaining authoring work.

All generated work and credentials are gitignored.

## Important boundary

A Tripo GLB can be shipped directly as an external generative asset, or used as evidence for a code-native img2threejs character. Those are different deliverables. The latter still requires the GLB build, polish, and animation gates documented in `vendor/img2threejs/docs/GLB_CHARACTER_*.md`; a generated seed is not a completed CharacterIR rig.
