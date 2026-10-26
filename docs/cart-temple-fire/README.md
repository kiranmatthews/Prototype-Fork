# Temple of Embers fire on the kart nozzles

The six sideways kart weapons now call the same flame surface generator as Temple of Embers. `src/templeFlame.ts` contains the accepted two-layer Gouraud lobes, yellow heat centres, orange body, ragged transparent rim, curl, flicker and distance-based cooling extracted from `TempleBreath`. `CartTempleJets` seats that surface on each small nozzle mouth and retains each emission's birth transform and inherited kart velocity. A cutoff leaves a short outward-travelling tail. The entire fleet's nozzle fire uses one bounded mesh/material draw, with fixed reusable vertex and colour buffers.

The temple's flame/ember vertex and colour buffers and hot-contact counts are byte-identical to the previous implementation at six cycle phases (hashes in `temple-baseline.json`). Temple cycle timing, smoke, embers and hazard behavior remain intact. Kart controls, lateral damage, cooldown and vehicle dynamics are unchanged. The Square attack adds no speed, lift or spin. Wreck fire keeps its existing rising fire and burnout lifecycle.

Validation passes:

- `node tools/test-temple-breath.mjs`: deterministic seeking, active hazard contacts, outward cutoff tail, harmless cooling, finite embers and reused buffers.
- `node tools/test-cart-fire.mjs`: both fire renderers have a travelling tail, stable paused buffers, finite life, bounded capacity, finite vertices and proper resource disposal. Nozzle particles retain their original mouth and direction after the emitter changes.
- `node tools/test-cart-drivers.mjs`: all six nozzles emit; the attack damages racers to either side once per burst, misses a racer ahead and produces zero vehicle propulsion. Original driver mounting and exit restoration pass.
- Chrome lite and full-render views inspect the real button trigger, quarter/end-on jets, cutoff and unchanged wreck/fire/husk lifecycle. Native 1600×900 views are included. Both runs have zero console or WebGL errors.
- The full-render 1280×720 eight-kart nozzle stress sample contains 815 active flame packets, adds one draw, and averages 17.16 ms per frame (58.3 fps), with a 16.8 ms 95th percentile. Calm averages 16.67 ms. Cart presentation grows from 4.60 to 7.94 ms with the full field firing. No console errors.

Build/type-check and release-size check pass: 998,816,824 / 1,000,000,000 bytes. No new image, model or texture downloads are required.

Browser reproduction: `CART_FULL=1 node tools/cart-fire-browser.mjs http://127.0.0.1:5497`; omit `CART_FULL` for lite. Stress: `CART_JET_STRESS=1 node tools/cart-polish-browser.mjs http://127.0.0.1:5497`. Set `PLAYWRIGHT_MODULE` to an installed Playwright package when needed. Output directories are controlled by `CART_FIRE_OUTPUT` and `CART_POLISH_OUTPUT`.
