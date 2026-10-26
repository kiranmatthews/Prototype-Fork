# Coconut Cart Rally: louder crowd, sharper turns, shorter flights

The course retains its original **6 m takeoff and 3.5 m landing mounds**. Three 90-degree bends replace the gentle sweep, with straight jump lanes, continuous banks, outside-wall chevrons and moved tyre barriers. The inside radius also leaves room for complete grandstands.

All 32,958 spectators have larger independent arm/elbow swings, body sway, anticipation, hops, landing compression and a travelling stadium wave. Planted-leg IK and the shared jump elasticity profile deform segments separately. The same full geometry remains at every distance; static instance buffers share one material and one per-frame time update.

Rally gravity is 24 m/s², launch speed is capped at 9 m/s, and crest amplification is reduced. Landing overlaps with nearby karts and wall scrapes still separate/damage the karts but cannot initiate a rollover or vertical kick. Hard lateral kart collisions still roll and recover. Controls and shared skating/roaming-cart defaults are unchanged.

Validation:

- First full-height dirt jump: **1.08 s airborne**, versus the previous 3.27 s; no rebound or roll and suspension settles within 0.27 s.
- 36 drop/drift/steering cases, wall impacts, descending/settling pack contact and 30/60/144 Hz fixed-step outcomes pass. Actual 16 and 24 m/s T-bones still roll; gentle contact does not.
- All eight headless racers finish with zero falls. Solo finishes in 103.53 s with zero falls/rolls. All twelve jumps still offer flight and all twelve missed jumps remain drivable slowly.
- Native 1600×900 and normal 720p browser reviews cover continuous cheering from three angles, all three bends, takeoff, touchdown and settle. Lite/full renderers have zero console or WebGL errors.

Reproduce with `node tools/test-cart-landings.mjs`, `node tools/test-cart-stadium.mjs`, `CART_REPORT=/private/tmp/rally-route.json node tools/test-coconut-cart-rally.mjs`, `node tools/cart-landings-browser.mjs http://127.0.0.1:5497`, and `node tools/cart-crowd-corners-browser.mjs http://127.0.0.1:5497`. The browser scripts use `PLAYWRIGHT_MODULE` when Playwright is supplied by the bundled runtime; `CART_LITE=1` selects the crowd lite pass. Full continuous motion recordings are retained locally with the browser capture outputs.

The required `check:levels` and shared `check:golf-cart` suites pass. The final synchronized level validator and build/type-check pass. Release size: **998,853,936 / 1,000,000,000 bytes**.

The complete full-render browser suite also passes real acceleration, steering, braking, X-release coast, all eight finishers with zero falls, trial restart and wall containment. The supported-stop fixture presses the brake explicitly; the earlier assumption that coasting would stop within ten seconds was removed while retaining every physical-button assertion.
