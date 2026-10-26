# Kart audio isolation

The real browser reproduced a moving kart with four `kartEngine` loops and an unintended `skateLoop`. The hidden rider still reported `skateSoundRolling`, and the shared render audio path did not check who owned movement. Countdown also played `skateTransition`, and a yank-out reused `railLand`.

The shared board and foot audio now yields while a kart or kart interaction owns the human racer. The normal foot audio path resumes after exit. Kart countdown no longer plays a skate transition, and yank-outs use the existing licensed kart impact sample. Engine, tyre skid, collision, thruster, fire and explosion assets and mixing are unchanged. Ordinary skate race countdown and rolling audio remain active.

`tools/cart-audio-browser.mjs` now checks both desired and forbidden sounds on the production SFX bus. It drives with real controls, drifts, fires thrusters, exits, walks until real footsteps play, steals a rival's kart, drives again, wrecks the kart, pauses and switches to The Slipstream. It checks that the hidden skate state is present during the driving fixture while no skateboard channel is allowed to play, and that actual skating starts a real `skateLoop` in a running AudioContext afterward.

The shared audio lifecycle and cart-interaction regressions pass. Build/type-check and release-size checks pass at 998,854,775 / 1,000,000,000 bytes. Run `node tools/cart-audio-browser.mjs http://127.0.0.1:5497`; add `CART_FULL=1` for native full rendering and `PLAYWRIGHT_MODULE` for an externally supplied Playwright runtime.
