# Beach Street invisible trip — 5 November 2026

The first downhill transition at course distance 100 m had two invisible
coping targets spanning the pavement. These preserve road-edge grinding, but
the grounded rail-blocking path treated them as raised bars. A native drive
at 20 m/s reproduced `bail('trip')` at distance 99.32 m, with no wall contact.

Kite riders now pass coping at or below 20 cm above their support height.
Those lines remain available to grind queries. Raised coping, physical rails
and scenery collisions keep their existing behavior. The wall's top stays
grindable; the hidden beach-side ground rim stays disabled.

The same collision path had a second issue: a fatal kite rail hit entered
`dead`, then ordinary skate-trip code immediately changed it back to `air`.
That code now returns after a fatal hit, allowing the kite collapse and
respawn to complete normally.

## Evidence and scope

- `seam-before.json`: native failure on the invisible Market Flat / Market
  Descent coping, with no intersecting wall.
- `seam-after.json`: the same centered drive crosses the join, then correctly
  hits the real planter at distance 136.46 m.
- `checks.json`: all 18 continuous road joins, retained edge/wall-top grinds,
  raised coping and physical rail deaths, respawn, and ordinary rail trips.
  Road-join probes isolate the authored road and shore components from the
  separate intentional hurdle/planter encounters.
- `browser-lite.json` and `browser-native.json`: the complete production level
  driven from distance 90 to 109.99 m, grounded, 19.34 m/s, zero deaths.
  Full rendering reviewed at 3024 × 1724. `console.json` is empty.
- `user-replay.json`: supplied 6,514-frame recording. Its format omits the
  kite's random wind seed, so the initial replay audit can drift into different
  scenery than the original. It is retained as input evidence, not claimed as
  an exact reconstruction of the original positions. The deterministic seam
  reproduction above establishes the invisible collision independently.

Focused checks:

```sh
node tools/test-beach-road-joins.mjs
node tools/test-beach-scrape.mjs
BEACH_OUTPUT=docs/beach-invisible-trip/controls node tools/test-kite-controls.mjs
npm run build
npm run check:release
git diff --check
```

The regression fixture deliberately keeps `solid:false` rail components.
Older Beach physics fixtures removed them along with visual-only components,
which hid this collision. No level data, assets, movement tuning or atmosphere
changes are required. The runtime change is confined to kite flush coping and
preserving a fatal state after an actual rail collision.
