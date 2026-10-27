# Spaghetti Rails validation

The active race is the seven-island layout: 168×112 m decision platforms, 288 m clear gaps, 48 continuous native rails and eight choices per gap. All 96 endpoints sit on supported platforms. Twelve optional transfers create the deliberate 3 → 4 → 6 shortcut. Ordinary platform edges remain grindable; player movement and tuning are unchanged.

`spaghetti-rails-platforming` independently preserves the rejected compact layout: 54 rails, 79 platforms, 41 ordinary checkpoints, fruit, crystal and a normal finish, with no race or rivals. Its complete editor save is `spaghetti-rails-platforming.level.json`. Geometry SHA-256: `1a135128a3c2418d4c51cd8d035e8fb87f90a5cd48a6fc904339d6ba4c031fa8`. The copy imports no geometry from the replacement race.

Complete-race evidence is under `evidence/validated/islands/`; the subsequent camera fix is under `evidence/validated/opening-camera/`. Top-level files in `evidence/validated/` are historical evidence of the superseded parallel-rail design. Exploratory failures stay locally under ignored evidence directories and are not represented as passes.

## Opening camera follow-up — 27 October 2026 UTC

The starting deck previously projected the player onto an outgoing branch before they chose one. A full-render keyboard reproduction holding only forward and jump charge rotated the view **52.124°**, changed the input basis by **61.587° in one sample**, and sent the rider left across the platform.

Seven south-facing travel zones now hold the view and controls steady across the seven decision islands. Each volume matches its platform footprint and uses the existing zone component. Beyond the rim, native rail navigation resumes. This changes only level data: all geometry, rail nodes, art, movement, tuning and the separately saved platformer remain unchanged.

New evidence is in `evidence/validated/opening-camera/`:

- `before.json` preserves the reproduced failure. `browser.json` verifies the actual 2560×1440/MAX drawing buffer and real KeyboardEvents. Forward traversal now has **0° camera rotation and 0° input-basis change**, with no falls. A separate left-choice run catches **Lace into the eye** and rides 110 m through its opening bends, with the camera following that selected rail. Both runs have clean consoles and unchanged tuning; neither uses the rival driver or player placement.
- `native.json` covers 63 deck samples, 20,637 samples across all 48 native rails, and all eight starting entrances with zero falls. Only 1,077 samples on short supported ends enter the deck volumes; no loop on another storey is captured. Rounded leads can start just inside the rim: the largest direction difference at a supported end is 33.044°, and the transition uses the existing camera damping. Curved rail navigation beyond the decks retains a minimum tangent alignment of 0.921.
- `forward-native.png` and `chosen-rail-native.png` are full-render native captures. This focused follow-up verifies the opening and all camera fields; it does not claim a new complete race traversal.
- `normal-browser.json` repeats both KeyboardEvent runs with the actual 1280×720 game buffer: steady forward view, successful chosen-rail entry, no falls and a clean console. `forward-normal.png` records that presentation. Set `SPAGHETTI_MAX=0` to reproduce it.

Reproduce with `tools/test-spaghetti-opening-camera.mjs` and `tools/test-spaghetti-island-entries.mjs`, using the shared heavy-job guard. Source hashes distinguish this increment from the earlier complete-race evidence.

All twenty required `check:levels` commands pass (205.64 s), as does the exact production `build` script, including type-checking (54.12 s). No `check:all` was run. npm is absent in this environment, so the unchanged package scripts ran through `/bin/sh` with the existing local executables on PATH.

## Completed evidence

- Source/native-rail sampling: all 48 routes, 96 supported endpoints, rider clearance from platform slabs, minimum crossing separation 4.698 m, maximum sampled corner turn 38.669°, and 462 actual-thread camera reacquisition cases pass. The source momentum estimate stays above 20 m/s from a 24 m/s entry; native physics remains authoritative.
- All eight first-island entrances pass using ordinary production input. The transfer fixtures pass 72/72 cases: twelve windows, speeds 24 and 30.5 m/s, releases two metres early, nominal and two metres late. Initial placement is a fixture 24 m before each window; all subsequent catches, charging, side input, release and landing use production physics.
- Eight-racer native field, seed 270327: every rider finishes. The reference combo finishes in 96.317 s with zero falls; the rival using the same combo finishes in 108.167 s with one fall. Other rivals finish in 180.233–241.633 s, with one or two falls each. Rivals use sampled, quantized corrections and occasional delayed reactions; no forced falls, balance immunity or tuning changes. This is automated control evidence, not a study of human fall rates.
- Stopped recovery passes at all six banked anchors. After six deliberately injected pit falls, the complete reference run finishes in 132.60 s with no additional falls and no adventure-life loss. Ordinary-road race rules and the stable Quagmire campaign save/unlock regression also pass.
- Independent browser KeyboardEvents complete all twelve deliberate transfers and all eighteen combo threads at native 2560×1440, finishing in 129.817 s with one recovered fall and unchanged tuning. The normal full-render presentation uses its actual 1280×720 buffer. Both browser runs have clean consoles. The keyboard pilot is an automated input test, not a recorded human performance.
- The preserved platformer passes supported spawn, ordinary checkpoint activation, injected pit return, crystal collection and finish fixtures. Its full/native browser shows the correct separate ID, no race, 18 navigation paths and 41 checkpoints, with a 2560×1440 buffer and no console errors. This is not a complete playthrough of that old layout.
- Live editor node Y and curvature changes rebuild both the native rail and navigation; exact undo and TEST return pass. Full/native editor overviews pass actual drawing-buffer assertions and a clean console. Editor views deliberately disable play fog and expose pit/camera guides; gameplay captures are the visual reference for atmosphere.

## Reproduction and evidence boundaries

Run heavy scene/browser/build checks sequentially through `.release-queue/run_heavy.py` in the shared primary inbox. `SPAGHETTI_OUTPUT` chooses the evidence folder. Native visual runs use 2560×1440 and assert the actual drawing buffer, not only the viewport.

| Tool | Scope |
| --- | --- |
| `survey-spaghetti-network.mjs` | Pure source/native-rail endpoint, clearance, crossing and branch-navigation sampling. |
| `survey-spaghetti-momentum.mjs` | Numerical grind estimate; no catches, balance, ground travel or combat. |
| `test-spaghetti-island-entries.mjs` | All eight first-island catches using production input. |
| `test-spaghetti-island-transfers.mjs` | 96 native support contacts and 72 optional jump fixtures. |
| `test-spaghetti-rails.mjs --race` | Eight-racer native field; `SPAGHETTI_CHOICE=2` selects the reference combo. Default without `--race` is solo. |
| `test-spaghetti-recovery.mjs` | Injected falls at six supported anchors, stopped returns and complete native finish. |
| `test-spaghetti-keyboard.mjs` | Independent browser KeyboardEvents through the real input path; no rival driver, player placement or movement injection. Use `SPAGHETTI_ROUTE=combo SPAGHETTI_TRIAL=1 SPAGHETTI_FULL=1 SPAGHETTI_MAX=1`. |
| `test-spaghetti-editor.mjs` | Live node height/radius edit, navigation rebuild, exact undo and TEST. |
| `spaghetti-network-overview.mjs` | Native editor composition captures; no traversal claim. |
| `test-spaghetti-platforming.mjs` | Saved geometry equality plus ordinary checkpoint, pit and finish contact fixtures. |
| `spaghetti-platforming-browser.mjs` | Actual preserved level loaded at native/MAX, supported spawn and clean console. |
| `test-spaghetti-campaign.mjs` | Stable Quagmire save key, win gem and persistent time-trial unlock/medals. |
| `test-skate-race-rules.mjs` | Existing ordinary-road race regression. |

Required final repository checks are `npm run check:levels` and `npm run build`. No `check:all` is requested or run. The production build and all twenty level checks pass. The level-check batch was resumed after its time cap without repeating the fifteen passing prefix commands. The older local release output is 1,000,017,506 bytes, 17,506 bytes over budget. This is an accepted combined-size dependency: the coordinator owns final packaging and has 4,175,912 bytes of headroom on the current published base. No asset/geometry pruning was performed. See `level-checks.json`, `build.json` and `release-size.json`.
