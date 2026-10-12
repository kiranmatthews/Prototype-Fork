# Resuming the Blockworks art job

Read `job.json` and `../../docs/BLOCKWORKS_ART.md`. The user's far-scenery
clarification is binding: match foreground and nearby props; a single coherent
skybox and shared mattes own distant scenery. Do not chase differences between
generated distant castles, islands or rides.

The task checkout is the durable ignored clone at
`/Users/kiki/Documents/ChatGPT/Prototype Fork/.img2threejs/blockworks-haunted-park`.
The branch is `codex/blockworks-haunted-park`. The original checkout's unrelated
uncommitted work must remain untouched.

## Current checkpoint

The user advanced from the accepted 89 reviewed storyboards across all eight
districts into production. Eleven late-crown duplicates are optional. The user
explicitly rejected shader-tiled foreground surfaces: build architecture from
actual Meshy components. The provisional material shader was removed and five
texture studies were archived under docs/blockworks-art/material-studies.

The user requested a higher-fidelity continuation after the first verified
release. The current pass has 24 recorded provider outputs (22 generated Meshy
components and two retextures), with 350/1,000 credits actually consumed. The
runtime uses 18 selected models. See `job.json` for the current validation or
publication checkpoint; do not treat the historical release as this pass's
completion evidence.

The source of truth for each GLB is `asset-manifest.json`. The flagstone v3
component includes built-in ImageGen paint baked by Blender to the original
Meshy UVs; its vertex/index/UV buffers are untouched. Run `pack_assets.py` after
changing a source or approved baked albedo. Keep originals and provider receipts.

## Commands

Use Node from PATH or the bundled executable at
`/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

```sh
node tools/blockworks-art/queue.mjs status
node tools/blockworks-art/queue.mjs next 4
node tools/blockworks-art/queue.mjs gate
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort
```

The local review gallery is `/tools/blockworks-art/review.html` on that server.
Chrome automation may need the bundled Playwright module selected through
`PLAYWRIGHT_MODULE`. The capture script supports `BLOCKWORKS_CAPTURE_START`,
`BLOCKWORKS_CAPTURE_LIMIT`, `BLOCKWORKS_URL` and the `--after` pass.
Capture placements are authoring inspections, never traversal proof.

For every pending prompt: inspect its local capture with `view_image`, invoke
the built-in imagegen tool with that capture and `docs/blockworks-art/style-key.png`,
inspect the output, then register the generated file:

```sh
node tools/blockworks-art/register-storyboard.mjs CAPTURE_ID GENERATED_IMAGE_PATH
```

The imagegen result's `output_hint` supplies its saved PNG path. Registering
copies it into the project and records its hash and prompt hash. Review the
foreground and mark its ledger state `reviewed` with concrete notes. Source
geometry is authoritative where a concept simplifies it. Black source planes are death pits, never solid floors. The user accepted the existing storyboard set and explicitly advanced to Meshy production. The older 100-frame gate is not a production blocker.

The official `@meshy-ai/cli@0.3.1` is installed at
`/private/tmp/blockworks-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js`.
Set `ENEMY_MESHY_CLI` for the existing `tools/enemies/meshy_assets.py` adapter.
Meshy is already authenticated; an authenticated balance check reported 3,426
existing credits. Sandboxed balance checks incorrectly reported auth failure;
the normal network-enabled CLI succeeded. Do not log or copy credentials. If
the temporary CLI disappears, restore the pinned official package, not a new
custom API/polling implementation. Use the established named-task ledger and
packers; do not buy credits. Select the final asset kit only after the complete
storyboard is available.

The production build passed (TypeScript `--noEmit` then Vite build). The local
PNPM runtime tried to reinstall the shared dependency folder when running a
script, so invoke those two repository executables directly when needed. Do
not accept PNPM's purge/install workaround on the shared `node_modules` link.
The updated whole-journey pilot now uses a real outside carving line around the moa. Repeat it after final assembly. Final work
still requires gameplay, visual comparisons, focused checks, a new build,
iteration timing, task-only commits and verified publication through main.

Final live verification: `d9a2769`, Pages workflow `38269188841`, fork stamp `10-12 15:25 UTC`, checked at `2026-10-12T15:33:24.537Z`. All 15 models and shared environment images ready; final attachment data, keyboard movement and zero console errors confirmed. See `docs/blockworks-art/deployment/verification.json`.


Latest fidelity verification: code `8fbca1d`, Pages run `38284510953`, fork stamp
`10-12 17:41 UTC`, checked at `2026-10-12T17:44:08.606Z`. Eighteen selected models
load and the new packed asset hashes match. See `deployment-fidelity/verification.json`
and `fidelity-review.json`; exact 1:1 parity is not claimed.
