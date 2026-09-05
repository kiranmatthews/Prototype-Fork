# Codex/sol level-geometry experiment

This repository is the isolated browser prototype used to compare Codex/sol level-authoring speed with Unity. Keep changes focused on playable demo levels and the minimum runtime support they need.

## Fast path

1. Use `src/levels/codex-lab.ts` for timed geometry briefs. It is a small source-owned data level, hot reloads cleanly, and uses the same component pipeline as the in-game editor.
2. Read the `CustomComponent` contract in `src/level.ts` before introducing a component shape. Prefer existing primitives (`platform`, `ramp`, `terrain`, `vertramp`, `rail`, `wall`, `pit`, `crate`, `checkpoint`, `gate`, `camnode`, and `decor`) over new engine systems.
3. Put geometry in level data when possible. Change `src/level.ts` only when the shared toolkit cannot express the brief. `public/levels.json` is the synced, published editor snapshot; update it only when a lab result should join that shared level pack.
4. Run `npm run check:levels` after editing level data and `npm run build` before handoff. Smoke-test the affected level in a real browser and check the console for errors.
5. Record each completed brief in `docs/LEVEL_ITERATIONS.md`, including elapsed prompt-to-playable time. Do not include unrelated cleanup in a timed iteration.
6. By default, commit and publish completed, validated changes through `origin/main` and the existing GitHub Pages workflow. Verify the deployment before handoff. Stage only task-owned changes and preserve unrelated work; follow any explicit request to keep a change local or use a different delivery workflow.

## Guardrails

- World units are approximately metres; Three.js is right-handed, Y-up, and the normal corridor direction is negative Z.
- `platform.p` is its centre; its top is `p.y + s.y / 2`. Spawn slightly above supported ground. Ramps rise from +Z toward -Z before yaw, and a rail at yaw `0` runs along Z.
- Every published level needs one `gate`, a reachable spawn, and `killY` below its playable geometry.
- Courses that turn or cross themselves need ordered `camnode` components or explicit travel `zone`s.
- Preserve the authored movement model. Level-geometry tasks should not retune `src/tuning.ts` unless the brief explicitly asks for feel changes.
- The fork uses `solProto*` browser-storage keys so it cannot overwrite the original demo's saved levels or tuning.
- Deployment is automatic from `main`; the build stamp must say `Codex/sol fork` when verifying the public page.
- Blender is permitted whenever useful for this project; it is optional, not required. Any earlier project-wide prohibition on Blender is superseded. Existing licensing, security, and character-pipeline safeguards still apply.

## Smoke test

- Use `/?lite` for fast checks and finish with one full-render pass.
- Open the MENU and select `Codex Geometry Lab`; `K` and `L` warp between checkpoints during play.
- If an in-browser edit masks the source version, use the PROJECT panel's restore-original action before judging a code change.
- Verify supported spawn, intended traversal, collision, pit respawn, checkpoint, and finish-gate behaviour with no console errors.

## Character asset pipeline

- Read `docs/TRIPO_CHARACTER_PIPELINE.md` before character generation or rig work.
- Use `tools/tripo-character/tripo_character.py`; it composes the official blocking Tripo CLI and must not be replaced by a second polling implementation.
- Never place `TRIPO_API_KEY` in frontend code, browser storage, logs, screenshots, committed files, or GitHub Pages. Prefer `tripo login` device authorization.
- The unrigged Tripo GLB is the img2threejs surface measurement instrument. A rigged or animated Tripo GLB is skeleton/motion evidence, not a code-only factory.
- `characterir-authoring-seed.json` is an authoring seed, not a complete CharacterIR or a validated deformation rig. Model-specific semantic mapping, weights, secondary joints, clearance corrections, and multi-angle motion review remain required.
- Do not copy `vendor/img2threejs-showcase/src/character` into this Apache-licensed repository; the showcase has no license file. Use the pinned companion checkout until the owner clarifies reuse terms.
