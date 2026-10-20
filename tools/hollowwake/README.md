# Hollowwake Descent authoring record

The source-owned course is `src/levels/hollowwake-descent.ts`; its centre lines
and set dressing are in `hollowwake-route.ts` and `hollowwake-art.ts`.

The three concepts and four isolated asset references were made with the built-in
image generator. Four approved Meshy image-to-3D jobs consumed **120 existing
credits**, within the 200-credit ceiling. There were no purchases, upgrades or
separately billed OpenAI API calls. All four jobs succeeded; do not resubmit them.
`tasks.json` records their identifiers and the direct upload/spend approval.

`meshy_jobs.py` uses the repository's official Meshy CLI adapter, including its
submission journal and credit reservation. `prepare_models.py` preserves the
original UVs and produces actual near/far meshes. `pack_models.py` packs the
original atlases and writes the measured registration and provenance files.
The raw downloaded GLBs remain in the ignored `.img2threejs/hollowwake/` directory.
Preserve that directory separately before archiving this worktree.

The original-UV Merchant Wreck slate, grotto floor and skylight sculptures are
reused. `HollowwakeTunnels` fits these imported meshes to the authored curves,
clips the real branch openings, and uses a bounded pool of fungus lights and
roof spotlights. Collision remains explicit, source-owned level data. Movement
tuning is unchanged.

Tunnel collision construction reuses vertex clearance only within a row, where
the projection seed is identical. The next row clears the temporary cache;
clipped edges retain their original bisection. This avoids repeated work when
the shared level module initializes. The exact-geometry regression covers every
authored tunnel and preserves the rounded vertices, normals and triangle order.

Focused validation:

- `node tools/test-hollowwake-tunnel-build.mjs` (approved collision data; included in `check:levels`)
- `node tools/test-hollowwake.mjs left` (also `right`, `alternate`, `support`, `stall`)
- `node tools/test-hollowwake-camera.mjs`
- `node tools/test-hollowwake-assets.mjs` (actual packed models; included in `check:levels`)
- `npm run check:levels`
- `npm run build`

For local browser review, run `node tools/hollowwake/serve.mjs` and
`node tools/hollowwake/save-review.mjs`. The preview has a separate Vite cache,
so other worktree test servers cannot invalidate its dependencies.
`tools/hollowwake/review.html` provides declared stationary inspection fixtures.
`tools/hollowwake/playtest.html?route=right&full` plays the exact recorded inputs
against the real game and checks finish, deaths, checkpoints, fork choices,
framing and errors. The native PNGs use the Max setting at 3840×2160; captures
are saved only to the local review receiver. Browser reports distinguish
stationary fixtures from input-driven traversals.

The four existing pursuit regression checks (forks/retry assistance, shelters,
lightning and camera impact) pass. The older `test-boulder-chase.mjs` still
expects acceleration after a release; its first failure is identical in the
pre-existing `3050ad3e` implementation and this branch: frame 89 changes pace
from 0 to 24.5 as the stone lands. The currently intended behaviour is tested by
the newer fork/retry checks; the new tunnel camera does not change that policy.
