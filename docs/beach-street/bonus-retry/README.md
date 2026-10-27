# Beach Street — retry a failed bonus

A failed kite bonus returns the rider 16 metres before the platform, aligned
with its centre and supported by the street. The kite waits for a fresh button
press. Riding forward can enter again; steering around the pad can continue
the main course. Completed bonuses retain their exit point beyond the pad.

The change is confined to the failed kite return position in `Level` and the
success/failure selection in `returnFromBonus`. Existing inventory restoration,
checkpoints, bonus locks and ordinary-level return points keep their rules.
No level geometry, published pack or movement tuning changes.

`tools/kite-bonus-retry-browser.mjs` exercises the production flow with real DOM
keys and live wind. It enters the actual bonus, crosses its kill plane, waits
through the normal death/return flow, verifies a supported stationary retry,
enters a second time, fails again, then steers around the pad and next planter.
A separate fixture exercises the completed-return branch; it does not claim
to collect all bonus boxes. Physical gamepads are isolated in the automated
browser, so playing the visible preview cannot interfere.

`tools/test-bonus-checkpoint.mjs` checks the production return function on an
ordinary level, including exact authored return positions on success/failure,
inventory and durable checkpoint state. The older kite controls browser now
expects the approach before the pad and explicitly chooses its bypass route.

Evidence: `browser-lite.json`, `browser-full.json`, MAX/native retry screenshots,
`build-final.json` and the source/report hashes in `verification.json`.

Run the focused browser with `node tools/kite-bonus-retry-browser.mjs --lite`,
then without `--lite` for full rendering. `BEACH_BASE` defaults to the task
preview at port 5288. Use the shared release queue's `run_heavy.py` guard.
