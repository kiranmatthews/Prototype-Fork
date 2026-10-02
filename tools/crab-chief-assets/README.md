# Tidebreak Meshy assets

The chief, throne pavilion and conch brazier were generated from original OpenAI built-in imagegen references, then submitted once each to the official Meshy CLI. `references/` contains the selected images and `tasks.json` contains safe task IDs, hashes, parameters and consumed credits. Three successful image-to-3D jobs consumed **45 existing credits**. The humanoid auto-rig failed and consumed zero credits; no credit purchase or plan upgrade occurred. The ledger's 50-credit limit is an internal submission guard.

| Asset | Triangles | Delivered bytes | Texture |
| --- | ---: | ---: | --- |
| Chief | 7,667 | 1,138,324 | 1024² diffuse JPEG |
| Pavilion | 2,843 | 483,476 | 1024² diffuse JPEG |
| Brazier | 1,562 | 188,640 | 512² diffuse JPEG |

`rig_chief.py` fits 21 independent semantic bones to the actual generated chief surface. It preserves the source topology/UVs, measures the wide boots through welded surface connectivity, smooths skin boundaries across UV/normal seams and pins the complete boot surfaces. It adds model-specific arms, pincers, head/crown, legs and secondary skirt joints. The runtime uses shared editable elasticity profiles, independent segment deformation and a finite defeat settle. This is a custom fitted skin, not a successful provider auto-rig or a CharacterIR factory.

`pack_models.py` compacts embedded textures and verifies every original accessor remains identical. `public/boss/*.provenance.json` records source/output hashes and measured budgets. Raw provider responses, signed URLs, task journals and full-size authoring models remain under ignored `.img2threejs/crab-chief/`.

Install the official `@meshy-ai/cli` or set `ENEMY_MESHY_CLI` to its `dist/index.js`, then use `meshy_jobs.py` for future task status/downloads. Authentication stays with the official CLI profile. Do not put any provider credential in a browser or published asset.

Reproduction: download the recorded source tasks to the ignored authoring folder; run `rig_chief.py`; run `pack_models.py` for the two props. Validate using `node tools/test-crab-chief-skin.mjs`, the combat unit test and the input-only journey. `chief-skin-review.html` is a local, multi-angle motion inspection tool, excluded from the production build.

The surrounding water, sand shelf, foam, shoreline rocks and tropical plants use existing project systems; they are authored in `src/levels/crab-chief.ts`.
