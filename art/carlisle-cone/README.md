# Carlisle cone crew — local character experiment

## Current cone-only revision — 29 October 2026

The runtime now uses the **original literal-cone P1 surface**: its face and arms
attach to the cone, with legs directly under its square base. The humanoid torso
and neck from the first integration are gone. All 4,986 source triangles and
original textures remain intact. `src/carlisleConeRig.ts` supplies a tailored
13-joint skin and three local clips (idle, walk, tantrum), with independent segment
elasticity and IK-controlled planted soles. These are local authored motions,
not new Tripo retargets. No additional credits were spent.

`python3 tools/prepare-carlisle-cone.py` installs the original saved P1 task as
`public/props/carlisle-cone/cone-body.glb` and writes current provenance. The former
humanoid preparation is retained only behind `--legacy-evidence`. The source task
is `9b3cba61-3202-46d7-93a7-fad1eaec23b4`; restore that existing task with the official
CLI if its ignored local source has been removed. Do not generate it again.

Current review: [cone and net repair evidence](../carlisle-shipyard/integration/repair/README.md).
The sections below record the earlier Tripo rig/retarget experiment and its costs;
the separate-body version is no longer the in-game character.

---

The 26 existing triple-cone hazard rows now show 78 animated orange/navy cone
characters. They face the uphill approach, fit the original sloped bases, idle
with separate phases and play a tantrum near the player. Their original contact
volumes remain authoritative. No level layout, player motion, bounce, camera,
checkpoint or tuning data changed. Walk is available in the character viewer;
these hazards do not patrol.

- [Local game](http://127.0.0.1:5483/?playtest&level=carlisle-coast)
- [Motion viewer](http://127.0.0.1:5483/art/carlisle-cone/viewer.html)
- [Native in-level review](review/game-close.png)
- [Motion and viewer evidence](review/viewer-validation.json)
- [Game and lifecycle evidence](review/game-validation.json)
- [Billing ledger](billing.json)

## Generation and rigging

This is the repository's **generative-assist** lane. Both references were made
with built-in imagegen. Tripo P1 (`P1-20260311`), 5,000-face target, texture/PBR/UV,
produced each surface through the existing official CLI adapter.

The first literal cone-bodied character was rejected by the free rig-check.
The revised reference uses a separate cone head and clear humanoid neck,
shoulders and hips. It passed. The v2.5 rig completed, but both a four-clip batch
and a minimal single-idle retarget failed with API code 1004 and were refunded.
The v1.0 Mixamo biped rig succeeded with idle, walk and `preset:biped:angry_01`.
The last clip is displayed as **Tantrum**; its internal alias is `slash`.

The runtime mesh has 4,992 triangles, 3,278 vertices, 23 skin joints, and the
complete original embedded texture maps. There are no distance-dependent
geometry substitutions. Three clips share one mesh/texture payload. Preparation
adds a fixed +X-to-+Z facing wrapper and removes horizontal root travel only.
Runtime elasticity uses the shared character amplitudes on separate torso and
arm segments, cancels inherited scale at child joints, and leaves planted leg
lengths and whole-rig scale alone. The finite gesture pulse settles to zero.

The CLI workflow gained paid-stage review/resume guards, proper retrieval of the
free rig-check result, and the correct original-model input to rigging. Remote
submission, waiting and downloads still belong to the official blocking CLI.

## Cost

| Operation | Credits |
| --- | ---: |
| Two textured P1 surfaces | 100 |
| Two free rig checks | 0 |
| v2.5 and v1.0 rigs | 50 |
| Idle, walk and angry gesture | 30 |
| Two failed retarget attempts, refunded | 0 |
| **Total billed** | **180** |

Final official CLI balance: **0 available / 0 frozen**. No API top-up or purchase.
No Max plan credits were used. Existing spending/upload/download authorization
was reused; individual task IDs and actual costs are in the ledger.

## Validation

Seven focused pipeline tests pass, including no repeated generation on resume,
refusing ambiguous interrupted submissions, and rejecting an unsuccessful rig
check before paid rigging. The pinned img2threejs structural payload validator
passes the legacy bind rig (23 joints, four influences maximum; its non-deforming
source root is the only warning). The CharacterIR motion seed cannot represent
scale channels; imported animation stays native to Three.js, and no complete
CharacterIR/deformation-validation claim is made.

All three complete cycles were rendered and recorded at 0°, 40° and 90°;
31 additional poses per clip/view were checked for finite, changing transforms.
Native, normal-size and mobile viewers pass. Carlisle lite and full/native
1440×900 plus normal 480p/CRT pass with 78 actors, actual hazard death, removal
on level disposal, no cones in the bonus, and correct reload. Browser console
errors are empty. The required final build passed: 1,751 files / 952.2 MiB.
Level data was unchanged, so no full suite or unrelated level audit was run.

Request started 2026-10-29 12:11:43 UTC. First complete animated local preview:
12:49:57 (38m14s). Playable level and lifecycle validated by 12:58:29 (46m46s).

## Local asset recovery

Per `docs/TRIPO_CHARACTER_PIPELINE.md`, generated character GLBs remain local
and ignored. The installed runtime is `public/props/carlisle-cone/cone.glb`.
Raw outputs and seeds are under `tools/tripo-character/work/`. Source references,
provenance, preparation code and review evidence are tracked. This entire
increment remains under the user's local-only hold.

If restoring another checkout, set `TRIPO_CLI` to the current official CLI and
keep its Node runtime on `PATH`, then download the **existing completed tasks**:

```sh
export TRIPO_CLIENT_APP=codex
export TRIPO_DISTRIBUTION_CHANNEL=codex_plugin
python3 tools/carlisle-cone-animate.py rig-v1 --restore
python3 tools/carlisle-cone-animate.py idle --restore
python3 tools/carlisle-cone-animate.py walk --restore
python3 tools/carlisle-cone-animate.py slash --restore
python3 tools/prepare-carlisle-cone.py
```

`--restore` invokes the official `task watch --download`, costs no generation
credits, and uses the recorded immutable task IDs. It does not submit new jobs.
