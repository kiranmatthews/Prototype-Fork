# Treehouse fitted trunk collision

Local subtask based on `8b8fc220`. Add 42 invisible filled polygon walls around 14 reachable trees after the final level assembly. Three vertical bands follow the measured central trunks of `host.glb`, `tree-a.glb`, and `tree-b.glb`, including their offset pivots, nonuniform size and yaw. The 147 distant trees remain behind the existing course perimeter. Broad canopies and the spaces between projecting roots do not acquire blanket blockers.

The original 1,826 level components are preserved. There are no changes to art, house placement, shore/water, movement tuning, or shared collision code. The new helper wraps the final component pipeline once. The supplied opening/shore and later hut screenshots informed the two review areas; the supplied replay is an input-only 2,027-frame recording rather than a geometry snapshot.

Validation on 25 October 2026:

- `test-treehouse-tree-collision.mjs`: 168 continuous capsule sweeps across all 42 bands, nine native walking/skating/jump contact cases, six nearby route traversals. No penetration or deaths. Deliberate jump impacts can use the existing bail behavior.
- `test-treehouse-surface-restoration.mjs`: all 20 walking/skating surface cases and eight airborne/walking boundary probes pass.
- `test-treehouse-stair-guide.mjs`: 17 native stair travel, jump, reversal and stop cases pass.
- `test-treehouse-tree-collision-browser.mjs`: the same nine contact and six route cases pass independently in real Chrome, lite and full rendering. No console errors or failed assets; tuning unchanged.
- `test-treehouse-stair-browser.mjs`: real keyboard stairs, reversal, stopping and charged jumps pass in lite and full rendering. Full-render checkpoint activation, fall respawn and finish gate pass.
- `tsc --noEmit` and `git diff --check` pass.

JSON reports and three reviewed full-render images are adjacent. Native tests place the player once before each independent case, then consume ordinary input. Browser tests use the normal fixed-step loop. This is a local handoff; the coordinator owns combined `check:levels`, production build and deployment. No `check:all` or publishing ran for this subtask.

Reproduce with a local dev server and:

```sh
node tools/test-treehouse-tree-collision.mjs
node tools/test-treehouse-tree-collision-browser.mjs http://127.0.0.1:5442/
node tools/test-treehouse-tree-collision-browser.mjs http://127.0.0.1:5442/ --full
node tools/test-treehouse-stair-browser.mjs http://127.0.0.1:5442/ --full --lifecycle
```
