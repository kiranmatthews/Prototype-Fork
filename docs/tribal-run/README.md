# Tribal Run

A 2,320-metre platform/skating course across a lagoon of giant drum terraces. There is no pursuer or forced chase. Broad skating curves alternate with short, controlled platform sequences; four optional grinds and two crossing woven routes give repeat runs different lines. Nine checkpoints and a low recovery court keep the required route at medium difficulty.

The eight chapters are Gathering Ground, Offbeat Steps, Crescent Basins, Great Drum Court, Canopy Loom, Sunken Stair, Echo Bowls and Last Chorus. The route is comparable in extent to Uga Ambush. The tested deliberate main line takes about 171 seconds without the bonus; a first exploration will take longer.

The Resonance Vault is a twenty-crate side-view bonus. A large bounce drum leads to a high gallery, a switch reveals the next stepping stones, and a short breakaway lip asks for commitment. Its real jump-pad entrance and return are in Great Drum Court.

## Source and integration

- `src/levels/tribal-run.ts` owns the main geometry and route metadata; `tribal-run-route.ts` supplies its metre-based swept surfaces.
- `src/levels/tribal-run-bonus.ts` owns the bonus. `tribal-run-art.ts` dresses both without adding gameplay collision.
- The existing campaign slot becomes playable after Sunset Safari. `src/level.ts` registers the level and three image-backed surface materials; `src/levels/themed-bonuses.ts` connects the bonus. No player or tuning code changes.
- The shared published `public/levels.json` is unchanged. The level is a source-owned builtin, available through the campaign and playtest ID `tribal-run`; the standalone bonus ID is `bonus-tribal-run`.
- Existing Meshy stone, pavilion and plant geometry is reused at full fidelity. The three new raster assets were generated with the built-in imagegen tool after the greybox phase. Exact prompts are in `imagegen-prompts.json`; dimensions, hashes and encoding provenance are in `public/tribal-run/provenance.json`.

## Reproduction

Use a local Vite server, set `TRIBAL_URL` if its port differs from 5247, and set `PLAYWRIGHT_MODULE` if Playwright is supplied outside the project. Full-render/browser and native tests run under the shared `run_heavy.py` host-capacity guard described in `docs/RELEASE_COORDINATION.md`.

`node tools/tribal-run-review.mjs --art` runs serial native-resolution views, recovery and grind scenarios, the upper Loom, a continuous main run, the linked bonus, normal presentation, and the actual campaign-thumbnail/menu check. `--static` limits it to visual viewpoints. Set `TRIBAL_OUTPUT` to select the evidence directory.

`node tools/tribal-run-gameplay-fingerprint.mjs` checks the art against the completed greybox contract. `node tools/tribal-run-native.mjs --audit` combines runtime support, seam, crate and camera-heading probes with the input pilot. `node tools/tribal-run-bonus-physics.mjs` checks a native all-crate bonus clear. Native jobs use a bounded Node heap on this shared Mac.

Focused campaign checks are `tools/test-six-island-campaign.mjs`, `tools/test-level-select.mjs`, `tools/test-save-slot-previews.mjs` and `tools/test-warp-room-return.mjs`. Run `npm run check:levels` and `npm run build` before handoff. The release coordinator owns integration and publication.

Final browser evidence and check results are retained in the adjacent `art/evidence/` and `validation/` directories. Greybox decisions and timing are recorded in `greybox/playtest-notes.md`.

Committed browser reports contain readable results and action boundaries; their complete sampled traces, frame timings and tuning snapshots are in adjacent `.trace.json.gz` files with SHA-256 references. Supplementary captures and historical raw traces remain in this worktree's ignored `.release-queue/tribal-run-evidence/raw/` archive, indexed by `local-evidence-archive.json`.
