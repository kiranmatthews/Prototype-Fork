# Recharging flames and tactical kart rivals

Every racer gets the same 0.7-second side-flame burst and six-second interval between activations. Initial recharge times are shuffled across evenly spaced slots between 0.8 and six seconds. The human participates in that shuffle. The race seed makes the ordering reproducible for replays, while normal restarts receive a fresh seed. Countdown, pause and render-only calls do not consume recharge; on-foot time does. Exiting or taking a different kart cannot reset it.

Rivals fire when an opponent is inside either side jet or will enter it within 0.4 seconds, using relative horizontal/vertical velocity and the same damage volume as the actual attack. They conserve their burst for targets they can affect: protected racers, star users, distant racers and opponents directly ahead/behind are rejected. Shields remain worth breaking. A charged or nearly charged rival can shift its normal lane by at most 2.5 metres to draw alongside a nearby opponent. This stays inside the supported track and is disabled through the dirt-jump approach, flight and landing region. Vehicle handling, control mapping, flame geometry and damage stay authored; flames never propel the kart.

Square remains a press action. A blocked press briefly uses the existing notice text to say that flames are recharging; there is no new meter.

Focused validation:

- `node tools/test-cart-flames.mjs`: 100 seeds, distinct/fair starting slots, deterministic replays, countdown/render isolation, predictive side contact at four headings, useful shield attacks, protected-target conservation, recharge cadence, one hit per burst, flanking limits, preserved jump line, real animated kart swap, held-button behavior, on-foot recharge and restart.
- `node tools/test-cart-drivers.mjs`: original full-size drivers and contacts, all six nozzles, side-only damage and exact vehicle-motion parity when firing.
- `node tools/test-cart-mayhem.mjs`: controls, damage, burnout, on-foot recovery, theft and restart.
- `node tools/test-coconut-cart-rally.mjs`: all eight racers finish with zero falls; solo completes all twelve full-height doubles in 80.45 seconds with zero falls or rolls. Rim containment still passes.
- Lite Chrome: all seven rivals fire during the first 30 seconds, with 15 bursts and 15 damaging contacts. Native/full and normal 720p captures check the existing flames and recharge feedback. Browser reports assert each shooter's starting delay and six-second interval, as well as real health loss and no console/WebGL errors.

Production build/type-check and release-size check pass: 998,859,233 / 1,000,000,000 bytes.

Browser reproduction: `CART_FULL=1 node tools/cart-flames-browser.mjs http://127.0.0.1:5497`. Omit `CART_FULL` for lite; `CART_FLAME_RACE_SECONDS=30` runs the shorter opening check. `CART_FLAME_SEED` selects a reproducible race; `CART_FLAME_OUTPUT` selects the output folder. Set `PLAYWRIGHT_MODULE` if Playwright is installed outside this checkout.

Final full-render race: all seven rivals fire, with 35 total bursts, 20 actual damaging flame contacts, 13 wreck/ejection recoveries and all eight finishers with zero falls. Each rival uses between three and five bursts in this run. Native/normal captures and the console/WebGL checks pass.
