# Stationary kart audio — 27 October 2026

Occupied carts now stop their engine loop when their actual three-dimensional velocity settles. The engine starts again above 0.2 m/s and stops below 0.12 m/s, avoiding repeated restarts from tiny suspension movements. Vertical flight and sideways slides still count as motion. Throttle input alone cannot make a blocked, stationary kart hum indefinitely.

The change is confined to the kart engine gate. Skids, crashes, landing sounds, weapons, fire, proximity mixing and airborne pitch remain in their existing channels. Burning wrecks still crackle while stationary. No controls, movement physics or samples change for this fix.

`tools/test-cart-stationary-audio.mjs` exercises the real loop manager with instrumented Web Audio nodes: parked grid, blocked throttle, driving player and rivals, vertical air travel, lateral slide, stopping, jitter, restarting, proximity, abandoned karts, fire/flames and physical finish braking. It also verifies that stopped sources and gain nodes disconnect. Evidence is in `check.json`.

The existing Chrome audio and mix checks now expect a silent stationary grid. Their spectral fixture moves the carts before measuring engine output. Full production Chrome passes real keyboard driving/braking, quiet stationary carts, re-entry/theft, skate-audio isolation, crash/explosion/fire, pause cleanup and a switch back to a skating race (`chrome/report.json`). The lightweight production mix pass verifies the silent grid, audible midrange engine, actual airborne revs, rival proximity and fire volume (`mix/report.json`). Both have zero console and WebGL errors and use build `Codex/sol fork · build 10-27 06:22 UTC`.

Type-check, production build and release-size validation pass: 999,464,578 bytes against the 1,000,000,000-byte limit. The existing audio fixture was updated for the ninth kart sound (landing crunch) and a destruction hit strong enough to empty a healthy kart; these were stale test assumptions, not new gameplay changes.

The full production controller-pilot race also passes: all eight racers finish in 93.53–142.25 seconds with no falls, real keyboard throttle/steering/braking and X-release behavior pass, and the solo restart and stadium support checks pass. The audio context remains running after the finish, seven occupied parked carts have less than 0.00002 m/s of residual numerical motion, and no engine loops remain. The eighth racer finishes on foot. Evidence: `../rally-balance/production-race/report.json`.
