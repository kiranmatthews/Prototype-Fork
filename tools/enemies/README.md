# Enemy asset authoring

`meshy_assets.py` composes the official Meshy CLI 0.3.1 on Node 24+. It uses the
existing local OAuth profile or `MESHY_API_KEY` environment variable. Credentials
never enter level data, public files, or this directory. Set `ENEMY_MESHY_CLI` to
the installed CLI's `dist/index.js` and `ENEMY_NODE` if Node is not on PATH.

The generated design reference for each enemy lives in `references/<kind>.png`.
The initial roster is grunt, spiker, hopper, charger, turtle, floater, sentry and
spinner. Each image is submitted as one Meshy T2 Smart Topology textured model,
with 7,500 target triangles and a 2k PBR texture by default. Runtime packing is a
separate step; authoring GLBs are not the final shipping payload.

```sh
python3 tools/enemies/meshy_assets.py doctor
python3 tools/enemies/meshy_assets.py balance
python3 tools/enemies/meshy_assets.py create grunt --triangles 7500 --dry-run
python3 tools/enemies/meshy_assets.py create grunt --triangles 7500
python3 tools/enemies/meshy_assets.py status grunt
python3 tools/enemies/meshy_assets.py wait grunt --seconds 50
python3 tools/enemies/meshy_assets.py download grunt
```

`tasks.json` records a reservation and stable operation ID **before** calling the
billable create command. The official CLI also journals the operation locally.
Re-running a named job never submits a second request, including if its first
response was uncertain. Reconcile an uncertain submission against the official
CLI's operation journal and provider task listing before updating its ledger
record. A wait timeout does not cancel, delete, or restart the provider task.

Raw responses with expiring asset URLs live under ignored
`.img2threejs/enemies/<kind>/`. Downloads have SHA-256 hashes recorded in the
ledger. The model is also copied to `.img2threejs/enemies/<kind>.glb` for the
packing stage. The task ledger records the user-authorized account budget (1,691 credits at
submission). Each model cost 15 credits; all eight consumed 120 credits total.
Actual provider consumption is recorded by `status`.

## Rigging and animation

The [documented Rigging API](https://docs.meshy.ai/en/api/rigging) currently
supports clearly structured textured humanoids, not quadrupeds. Do not submit
the four-legged enemies to that API as though they were humanoids. The
[official Auto Rigging help](https://help.meshy.ai/en/articles/16231707-how-to-create-3d-animation-with-auto-rigging)
documents a web-app Quadruped rig with walking as its only supported clip. Smart
Rig results cannot use the preset animation library. The official CLI has no
quadruped selection flag at version 0.3.1.

`rig` and `animate` commands wrap the supported API for any suitable humanoid
asset; they are not an implicit quadruped fallback:

```sh
python3 tools/enemies/meshy_assets.py rig humanoid-rig --source humanoid --height 1.5 --dry-run
python3 tools/enemies/meshy_assets.py animate humanoid-walk --source humanoid-rig --action 123 --dry-run
```

Choose real action IDs from the current official `meshy animation-catalog list`
output. The arbitrary `123` above is an example placeholder, not a chosen clip.
The API routes are `POST /openapi/v1/image-to-3d`,
`POST /openapi/v1/rigging`, and `POST /openapi/v1/animations`, with matching
`GET <route>/<task_id>` retrieval. Quadruped UI rigging and custom segment rigs
must record their actual provenance separately from API model generation.

## Current roster workflow

The final quadrupeds use model-specific skins authored by `bake_assets.py` and
`glb_rig.py`, with actual Meshy Walking motion extracted from an existing
user-owned export. `motion-sources.json` records archive and FBX hashes.
`extract_meshy_motion.py` samples the original motion; `retarget_meshy_walk.py`
fits its foot trajectories to each new rig with IK, source contact timing,
flat stance feet and measured stride speed. No generic sine gait is used as
an authored walking clip. See `BAKING.md` for anatomical specs and cleanup.

The frog, drone, sentry and spinner use custom state poses in
`src/enemies/runtime.ts`. All variants share editable segment elasticity
profiles. Run `npm run check:enemies` for shipping-file, runtime and gameplay
checks. The separate `test-meshy-walk-retarget.mjs` authoring test additionally
needs local sampled-motion reports and compares 61 actual skin poses against
source-driven IK targets.

Open `/tools/enemies/motion-review.html` on the Vite development server for
multi-angle, full-cycle browser review. `write_manifest.py` refreshes the
public inventory only when all final files match their rig-spec hashes.
