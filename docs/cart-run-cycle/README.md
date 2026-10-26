# Bone Man run cycle for kart interactions

Kart approaches now sample the existing `player.run` (Quaternius `Jog_Fwd_Loop`) by elapsed seconds, with its authored tempo, root bounce, arm counter-swing and independent segment elasticity. The old path-percentage sine walk is removed. The ground portion of entering and exiting blends into that same run; the endpoint settles into the shared idle. The short seat transition and paired grab/pull keep their contact solves. Full running bypasses those solves so they cannot overwrite the imported legs or arms.

The human borrows clips from the live animation document without changing the gameplay animation clock or overlay. Animation Studio edits therefore carry through immediately. Rivals without a document use the same starter clips. No character scale, controls, ownership timing, path, kart handling or game geometry changes.

Verification:

- `node tools/test-cart-run-motion.mjs`: all imported joint rotations across 80 frames/two cycles; less than 0.00000005 radian error; elapsed cadence independent of approach percentage; authored root bounce; live clip changes; shared fallback; unaffected gameplay clock; finite entry/exit blends; original scale and clean return of the rig.
- `node tools/test-cart-interactions.mjs`: exit-before-steal, grab contacts, timed ownership, reservations, empty entry, passenger-side route, restart and wreck cancellation pass. Existing grab errors remain below 7 mm for hands and 2 mm for ankles.
- Shared animation runtime and ordinary walk/run/idle transition regressions pass. Updated the idle fixture's outdated zero-driver assumption to allow the already-present segment elasticity scalars while still rejecting added procedural joint motion.
- Continuous Chrome recordings cover native 1600×900 front, 40° and 90° approaches, theft, entry and exit, plus normal 720p. Lite and full rendering each record 1,000 fixed-step interaction frames with moving run joints and no console/WebGL errors. `motion-review.webm` is the full-render recording; the PNGs show representative native/normal frames.

Reproduce with `CART_FULL=1 node tools/cart-run-browser.mjs http://127.0.0.1:5497`; omit `CART_FULL` for lite. `PLAYWRIGHT_MODULE` can point to an installed Playwright package; `CART_RUN_OUTPUT` selects the output folder. The existing `tools/cart-interactions-browser.mjs` also passes its actual-button and staged-contact review.

Production build/type-check and release-size check pass: 998,856,771 / 1,000,000,000 bytes.
