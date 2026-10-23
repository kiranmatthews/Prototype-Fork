# Moonbone Vault Meshy props

Three source-generated Meshy props replace the procedural skulls, jointed rib arches and assembled crypt façades. Ten instances use the existing scenery cache, instancing and editor path. The floating crescent moon is removed. The level keeps its nighttime atmosphere, lift, breakaway crossing, descending route and sixteen crates.

The user corrected the initial realistic/gothic references to the game's **Crash 4 / punk / 90s** direction before any Meshy submission. The selected references use chunky asymmetric forms, broad painted shading, ivory and cobalt, cyan crystal details and magenta graffiti. The first reference set was discarded without spending Meshy credits.

- References: `references/moonbone-skull.png`, `references/moonbone-rib-arch.png`, `references/moonbone-crypt.png`.
- Exact reference prompts and generator: `reference-prompts.json` (built-in imagegen).
- Generation journal: `tasks.json`; official Meshy CLI through the existing project adapter.
- Runtime models and provenance: `public/moonbone-vault/`.
- Runtime registration: `src/moonboneAssets.ts`; placements: `src/levels/rolling-bones-bonus.ts`.
- Review evidence: `docs/performance/moonbone-meshy-props.json` and `docs/art-reviews/moonbone-meshy/`.

## Budget and geometry

The authorized maximum was **50 credits**. Three successful textured Meshy T2 jobs consumed **15 credits each, 45 total**. Balance changed from 716 to 671; no credits were purchased. Pricing was checked against https://docs.meshy.ai/en/api/pricing on 24 October 2026 (Pacific/Auckland).

The models have 10,622, 10,837 and 11,737 triangles. Meshy generated 4K source atlases; the portable runtime pack uses 2K albedo and 1K normal/roughness atlases, about 6.31 MB combined. Geometry, normals, UVs and node transforms are preserved byte for byte. All ten placements remain visual only and behind the playable plane. Skull positions keep their faces visible beside the crypts.

## Reproduction

`meshy_jobs.py` delegates authentication, request journaling and task status to the official CLI. It reserves credits before submission and will not resubmit an already-recorded job. Signed responses and original large models remain in ignored `.img2threejs/moonbone/`; credentials never enter the repository or browser.

Use `python3 tools/moonbone-assets/meshy_jobs.py status <name>` to inspect a recorded task and `download <name>` to recover its source model while the provider retains it. `node tools/moonbone-assets/pack.mjs` rebuilds the portable models. No generation should be repeated for this brief; the task is complete at 45 credits.

Delivery remains local under the slow-network workflow. The user-authorized Meshy generation and downloads were the only external asset transfers; no Git push or deployment is part of this change.
