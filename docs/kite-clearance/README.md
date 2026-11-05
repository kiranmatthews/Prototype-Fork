# Kite clearance and apparent size

6 November 2026 (NZ). Approximately 31 minutes from the request to the reviewed
playable result, including the follow-up to enlarge the higher kite. Release
verification followed.

The canopy now flies 22 m above the rider's ground reference and at least 104 m
ahead (farther in narrow viewports). Its presentation scale is 3× so its apparent
size remains close to the previous, much nearer kite. Pitch is about 13 degrees;
steering and gust banking are smaller. The centre stays over the open street
when the rider hugs the building frontage.

`KiteFlight` queries the existing scenery index using the complete transformed
canopy bounds. It anticipates the forward sweep, rises over roofs, and holds
altitude until the resting tether distance has also passed the obstruction.
An 80 cm planning margin and 15 cm contact margin protect the low wingtips.
It resets on respawn/teleport. This changes presentation only: rider motion,
collisions, scoring, jump/grab controls and camera settings are unchanged.
The full original 7,873-triangle canopy and 1,912-triangle bar remain intact.
The lines remain flexible visual connections and can cross scenery.

Validation:

- `node tools/test-kite-clearance.mjs`: 4,515 poses across the 3 km source course,
  five lateral positions and three gust directions. The conservative canopy
  bounds overlap authored hard-scenery bounds in 1,683 old-placement cases and
  zero new-placement cases. This is an envelope test, not a claim that every
  soft leaf or every possible trajectory can never overlap.
- The same check covers moving and camera-culled scenery, inactive surfaces,
  invisible containment, a 900-frame roof approach/departure, and resets.
  Maximum per-frame height change in that traversal is 0.136 m.
- Forty complete-canopy projection cases cover wide, square and portrait
  cameras, both gust/steering extremes, and a 7 m jump. All remain in frame.
- Existing kite art/bridle/flyaway, Indy contact/landing, tow-motion and
  world-solid tests pass. Asset hashes are retained in `art-check.json`.
- Full-render browser review at MAX/native 1506 × 1498 covers roadside,
  uphill and airborne poses, plus an old-placement toggle. These are explicitly
  held presentation fixtures. `tools/kite-clearance-review.html` is local only.
- The production build was also tested with normal start/jump input; its
  console had no warnings or errors.
- `npm run build` and `npm run check:release` pass: 854,365,528 bytes of the
  1,000,000,000-byte hosting budget.

Evidence: `clearance-check.json`, `art-check.json`, `motion.json`,
`browser-poses.json` and the PNG captures in this directory.
