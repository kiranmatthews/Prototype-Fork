# Rally jump and landing response

The rally now uses gravity 11.5 instead of 13.5, retaining the existing crest launch strength, throttle, braking, steering and drift. Airborne body attitude follows the flight arc instead of the slope below the wheels. Landing drift and body lean no longer start a rollover. Ground impacts can still dent the kart, but do not apply the collision launch impulse or the old vertical rebound.

A touchdown compresses the suspended body by up to 0.14 model metres and settles in roughly a quarter second. The tyres remain planted, the seated driver travels with the cabin, and a brief contact settle prevents the touchdown itself from retriggering a crest launch. Hard side impacts retain the existing physical roll and finite recovery; gentle nudges do not flip the cart. These settings apply to Coconut Cart Rally; shared roaming-cart defaults and skate tuning are unchanged.

## Validation

- `tools/test-cart-landings.mjs`: 36 drops from 0.6–12 m, with sideways speeds of −9/0/+9 m/s and steering in both directions. All stay planted with zero rolls and zero rebound. Against the previous committed solver, the same scenarios produced 24 rolls and 33 rebounds. The original test scenario starts each airborne cart with a 0.3 rad body lean and 28 m/s forward velocity.
- A supported 2.4 m ramp crest produces about 1.97 seconds of flight and a 7.82 m apex, with identical final states at 30/60/144 Hz. Airborne cross-slope attitude, visual suspension compression and quarter-second settling also pass.
- Actual 16 and 24 m/s T-bones roll the struck cart and recover; a 5 m/s nudge remains upright. The shared golf-cart dynamics/resource/patrol checks pass with their existing defaults.
- The complete headless rally finishes with all eight racers, with one recovery during the combat race. All twelve jumps register flight. The solo run finishes in 95.72 s with zero falls and zero rolls. A direct upper-rim collision stays contained. The race report now follows each racer's current kart after theft, rather than measuring the abandoned original kart.
- All twelve dirt troughs remain traversable at low speed under the new profile. Checkpoints, mud slowdown and stadium containment pass.
- The Chrome lite run exercises keyboard throttle, steering, brake and coast; all eight racers finish with zero falls and no console errors. Solo restart and rim recovery also pass.

The full-render native 1600×900 and normal 720p review shows a natural 3.27 s dirt-jump flight, followed by a planted touchdown with 0.125 m of model-space compression and 0.0038 m remaining after 0.25 s. There are no rebounds, rolls, falls, console errors or WebGL errors. Native apex, touchdown and settled frames are included.

The build/type-check and release-size check pass: 998,814,025 / 1,000,000,000 bytes.

## Reproduction

Run `node tools/test-cart-landings.mjs`, `node tools/test-coconut-cart-rally.mjs`, `node tools/test-cart-stadium.mjs` and `GOLF_CART_REPORT=/tmp/cart-shared.json node tools/golf-cart/test.mjs` from the repository. Reports can be redirected with `CART_LANDING_REPORT`, `CART_REPORT` and `CART_STADIUM_REPORT`.

With the local server running, use `node tools/coconut-cart-rally-browser.mjs http://127.0.0.1:5497` for the complete lite race, then `node tools/cart-landings-browser.mjs http://127.0.0.1:5497` for the full-render jump/landing sequence. `PLAYWRIGHT_MODULE` can point to an installed Playwright package. The native landing fixture moves parked loaners out of its landing lane to isolate ground contact; the complete race and physical T-bone tests retain kart collisions.
