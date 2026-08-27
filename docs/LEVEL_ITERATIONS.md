# Level iteration log

| # | Brief | Prompt → local playable | Pages deployment | Clarifications | Files | Result and playtest notes |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 0 | Fork baseline and publishing setup | Setup phase | Setup phase | 0 | Workflow, fork config, docs, validation | Baseline production build and browser smoke test passed. |
| 1 | Long mixed-flow switchback: winding skate descents, dedicated side-scroll climb, straight ridge, and on-foot uphill platforming | ~33 min | Automatic from `main` | 0 | `src/levels/codex-lab.ts`, `src/level.ts` | 1.28 km longitudinal span; 575 components; 215-node camera spine (8 m maximum spacing); one tightly bounded side-scroll zone; five board-speed gaps; 16-piece foot climb; eight checkpoints. Replaced repeated berm boxes with one spline-driven swept wall per side, continuous UVs and smooth longitudinal normals; collision uses 2 m maximum intervals with adaptive curve subdivision. Lite and full-render browser passes, checkpoint warps, live side-scroll handling, finish approach, console, level validator, type-check and production build passed. |
