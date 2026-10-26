# Ground the stadium spectators

The supplied `replay-CoconutCartRally-2026-10-26T07-36-20.json` shows floating columns of people ahead of the kart near frame 6480. Spectators sampled the continuous road normal independently, while concrete grandstand rows used eight-metre mesh chords. Around sharp heading changes, their locations diverged, putting people and seats off their stands.

Seats and spectator roots now use barycentric placement on the same triangles as the grandstand tread. Their facing follows the panel's interpolated outward direction. The complete published level data is byte-equivalent after serialization; route, mounds, stands, kart handling, audience count, geometry and GPU cheering are retained.

Validation:

- `node tools/test-cart-crowd-placement.mjs`: all 32,958 spectator/seat roots supported, largest measured surface error below 0.85 mm. Checks actual Float32 stand triangles independently of the placement helper, exact published level equality, full crowd count and static instance buffers.
- `node tools/cart-crowd-placement-browser.mjs`: normal 720p and MAX/native review at the replay sightline and ten close views around sensitive bends. `CART_LITE=1` selects the existing half-resolution smoke path; `CART_BASE` selects a deployment.
- The supplied replay's driving portion, beginning at its recorded race seed at frame 2853, was played again in full native Chrome. The offending columns are gone at the matching end position. `replay-native.json` contains sampled states and an empty console-error list.
- Required `check:levels`, build/type-check and release-size checks pass. Release output: 998,855,279 / 1,000,000,000 bytes.

Browser images are retained in the local review outputs `/private/tmp/cart-floating-views-after/` and `/private/tmp/cart-floating-after/`; JSON evidence is saved alongside this file. `PLAYWRIGHT_MODULE` can select the locally bundled Playwright package.
