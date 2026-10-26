# Animated kart exits and on-foot theft

Triangle while driving starts a 0.95-second exit. It cannot target or claim another kart. A separate on-foot press starts an empty-seat entry or a paired theft. Entering an empty kart takes one second; stealing takes 1.85 seconds after reaching the driver side. A short walk around the chassis handles approaches from the passenger side. Fast passing karts must slow enough to be grabbed.

The original full-size racer is used throughout. The exit braces, swings the legs out and steps onto the dirt. Theft reaches for the nearest upper arm, plants both feet, pulls the driver through the open side and releases them into the existing finite fall/get-up animation. The thief then climbs into the seat. Shared editable elasticity profiles supply independent segment compression, reach and rebound. Hand/foot IK runs after deformation. The whole skeleton is never resized.

An active interaction reserves the kart. The old driver owns it during the pull; the seat is empty during the climb; the new owner receives control after sitting down. Repeated input cannot skip these stages. Wrecks, rolls and restarts release borrowed rigs without leaving invisible players or duplicate owners. The forced ejection handoff respects post-reset protection while allowing its visible fall, and does not create a skateboard for an on-foot racer.

Validation:

- `node tools/test-cart-interactions.mjs`: no car-to-car theft, distinct exit/steal presses, staged ownership, simultaneous-theft exclusion, measured palm/foot contacts, full-size restoration, passenger-side route outside the chassis, empty entry, restart and wreck cancellation. The tested grab pose has under 7 mm palm error and under 2 mm ankle error.
- `node tools/test-cart-mayhem.mjs`: controls, accumulating damage, burnout, on-foot movement/jumping/finish, theft in both directions, loaners, weapons and cleanup.
- `node tools/test-cart-drivers.mjs`: original seated drivers, roof/wheel/floor clearance, full-size exit, six side nozzles and zero flame propulsion.
- Lite and full-render Chrome: physical interaction button, animated exit, paired grab/yank/entry, passenger-side approach, native 1600×900 front/quarter/side views and normal 720p presentation. Zero console or WebGL errors. The complete recorded movement is in `motion-review.webm`.
- Production build/type-check and release-size check pass: 998,830,018 / 1,000,000,000 bytes.

Browser reproduction: `CART_FULL=1 CART_VIDEO=1 node tools/cart-interactions-browser.mjs http://127.0.0.1:5497`; omit `CART_FULL` for lite. Set `PLAYWRIGHT_MODULE` to an installed Playwright package when needed; `CART_INTERACTION_OUTPUT` selects the evidence directory.

A short full-render 1280×720 Chrome frame sample during the paired pull averages 16.67 ms, with a 16.8 ms 95th percentile; the calm sample averages 17.59 ms. No browser errors. See `performance.json`.
