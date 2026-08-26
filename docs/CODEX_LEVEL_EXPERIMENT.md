# Codex/sol level-geometry experiment

## Objective

Measure how quickly Codex/sol can turn a level brief into a publicly playable browser build, and compare that loop with authoring equivalent greybox geometry in Unity.

This repository is a history-preserving copy of `kiranmatthews/Game-prototype` at source commit `ee24275fc11092e91ec30eabd6161611c2cffdd9`. GitHub cannot create a network fork under the same account as the source, so the experiment uses a separate repository and Pages deployment instead.

- Original demo: <https://kiranmatthews.github.io/Game-prototype/>
- Experiment demo: <https://kiranmatthews.github.io/Prototype-Fork/>
- Experiment repository: <https://github.com/kiranmatthews/Prototype-Fork>

## Timed iteration protocol

Start the clock when the level brief is complete enough to act on. Stop it when the requested geometry is playable in the local production build. Record public deployment time separately so GitHub queue time does not get attributed to authoring.

For each iteration, capture:

1. Prompt-to-local-playable minutes.
2. Local-playable-to-Pages-live minutes.
3. Number of clarification turns.
4. Files changed and whether shared engine code was required.
5. Build result, browser console result, and a short playtest verdict.
6. Equivalent Unity authoring time, measured from the same brief and stopping condition.

Use `docs/LEVEL_ITERATIONS.md` for the log. Keep one brief per commit where practical so Git history remains a second timing record.

## Authoring routes

The quickest route is the source-owned data level in `src/levels/codex-lab.ts`. It stays small enough to edit directly, hot reloads through Vite, and uses the same component pipeline as the in-game editor. The component contract is documented directly above `CustomComponent` in `src/level.ts`. Use the shared runtime only when the level needs a primitive the format cannot express.

Useful entry points:

- `src/levels/codex-lab.ts` — default surface for timed geometry briefs.
- `public/levels.json` — synced published editor snapshot and established levels.
- `src/level.ts` — component schema, builders, collision surfaces, built-in courses.
- `src/editor.ts` — in-browser geometry editor.
- `src/rails.ts`, `src/props.ts`, `src/prop-data.ts` — reusable level pieces.
- `src/tuning.ts` — movement feel; outside the geometry benchmark unless requested.
- `docs/UNITY_PORT.md` — units and engine-behaviour comparison notes.

## Verification loop

```sh
npm ci
npm run check:levels
npm run build
npm run preview
```

Open the preview, load the changed level, play from spawn through its finish gate, and confirm there are no browser console errors. A push to `main` then builds and deploys `dist` through GitHub Actions.
