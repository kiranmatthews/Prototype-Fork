# Backwards steering recovery

Rally steering now resolves the held screen direction against the cart's forward or reverse travel and converts that request into the correct wheel angle. Previously, coasting backwards kept steering against the nose, causing alternating full-lock corrections even when travelling in the requested direction. The selected pedal supplies the direction close to rest. Pull-back braking uses the same travel frame; Circle still takes priority over X.

The change is confined to `src/golf-cart/controls.ts`. Kart dynamics, the winding stadium, all mound heights, side flames, theft controls and shared skating remain as authored.

Validation:

- 64 reverse-coasting combinations across course headings and stick directions converge without steering oscillation; nine X-powered spin recoveries and three brake/reverse transitions pass.
- Outcomes match at 30, 60 and 144 Hz. X release coasts without jumping, and Circle stops reverse travel with X held.
- Existing mayhem/interactions regression passes. All eight racers finish with zero falls; the solo route completes all twelve doubles in 80.45 seconds with no falls or rolls.
- Lite and full native 1600×900 Chrome pass six real keyboard/gamepad scenarios with no console or WebGL errors. Controller turnaround is sampled on packed dirt before the next tyre chicane, keeping its full acceleration assertion.
- Build/type-check and release-size checks pass: 998,854,691 / 1,000,000,000 bytes.

Reproduce with `node tools/test-cart-steering.mjs`, `node tools/test-cart-mayhem.mjs`, `node tools/test-coconut-cart-rally.mjs`, and `node tools/cart-steering-browser.mjs http://127.0.0.1:5497`. Set `CART_STEERING_LITE=1` for the lite browser pass and `PLAYWRIGHT_MODULE` when Playwright is supplied externally.
