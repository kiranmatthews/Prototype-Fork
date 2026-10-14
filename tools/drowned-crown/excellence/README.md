# Drowned Crown asset production

The user directly approved **up to 400 additional Meshy credits**. This continuation consumed **105**, leaving **295 unused**. The earlier 435-credit pass is recorded separately in `../tasks.json`; no credit purchase or plan change was made.

| Job | Credits | Result |
| --- | ---: | --- |
| Smart Topology headland | 15 | Rejected on visual inspection; not shipped |
| Meshy 7 headland | 30 | Fitted to the coast, mine and grotto |
| Meshy 7 cavern buttress | 30 | Used for sea-gate shoulders, alcove rockwork and foundations |
| Meshy 7 royal hull | 30 | Fitted to the decks with real passage openings |

`tasks.json` records provider task IDs, actual consumed credits, reference hashes and the direct approval. The first unsupported-parameter request was rejected without a task or charge; its official CLI journal was reconciled before a corrected submission. No jobs remain in flight.

## Saved assets and prompts

The built-in **imagegen** tool produced the reference images; no API/CLI imagegen fallback was used. The headland reference was reused for both Meshy attempts. Exact prompts and original storyboard references are in [imagegen-prompts.json](imagegen-prompts.json).

- [Headland reference](references/headland.png)
- [Cavern reference](references/cavern-buttress.png)
- [Royal hull reference](references/galleon-hull.png)
- [Runtime headland](../../../public/drowned-crown/excellence/headland.glb)
- [Runtime cave rock](../../../public/drowned-crown/excellence/cavern-buttress.glb)
- [Runtime hull](../../../public/drowned-crown/excellence/galleon-hull.glb)
- [Measured asset manifest](asset-manifest.json) and [geometry audit](model-audit.json)

Each accepted model keeps its original UV atlas, 4K base colour and near/far meshes. The official Meshy CLI owns authentication, submission journaling and provider status. The wrapper reserves credit before submitting and refuses duplicate named jobs. Uncertain submissions must be reconciled by operation ID.

## Local fitting

`prepare_models.py` reduces the source meshes in Blender. `fit_headland.py` shapes the headland, measures the fort footprints and clears the mine and grotto. `fit_royal_hull.py` aligns the galleon with the actual decks, retains the hold ceiling and opens the boarding, descent, bow and powder-room passages. `clip_tunnel.py` interpolates UVs and normals while removing triangles; it avoids invented caps from Boolean operations on scanned geometry. `pack_models.py` writes the selected models and their measured registrations.

Source downloads and unfitted authoring meshes remain in the attached worktree’s ignored `.img2threejs/drowned-crown/excellence/` directory. Keep that directory when archiving the worktree. The original paid assets remain available; the local derived models did not incur provider charges.

## Native 4K repair

The review harness explicitly selects Max and verifies a 3840 × 2160 world target and drawing buffer. Gallery images retain that size. Imported UV-seam vertices are welded before reduction; loop UVs remain intact. `audit_models.py` catches disconnected reduction by checking both uncut cavern LODs remain closed, alongside finite geometry and valid texture coordinates. `fit_vault_floor.py` and `reuse_plank.py` reuse existing repository assets without provider charges. The upper hull is clipped around actual deck and cabin volumes as well as the five traversal passages.

## Cargo, grotto and cavern staging

The hull-panel derivative now reaches the bilge and uses UV-preserving passage cuts; both shell faces are rendered. The powder crosswalk has a measured transverse doorway instead of an entire missing longitudinal wall. `fit_grotto_floor.py` reuses the same existing riverstone source as the vault and emits matching support triangles. These changes, the broad cave shelves and the grouped cargo use no new provider jobs. The additional-credit ledger remains 105 / 400.
