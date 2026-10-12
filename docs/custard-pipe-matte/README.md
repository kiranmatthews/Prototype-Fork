# Custard Creek pipe matte correction

The woodland card rooted at `[98.8659668, -14, -25.0905762]` spanned the returning pipe at station 1156. Checking only its centre missed the intersection.

The placement pass now checks every point along the rotated card footprint against the full folded route, keeping a 28 m margin. Only this card moved, to `[52.3408203, -14, -13.2832031]`. All 53 cards remain. The half-metre route audit in `clearance.json` confirms at least 28.50 m clearance across the set and no changes to other components.

`before.jpg` and `after.jpg` show the same player-camera position at the obstructed exit. `entry.jpg` and `bend.jpg` check the rest of the skate pipe; `runout.jpg` follows ordinary forward input through the clear exit to the checkpoint area. Full rendering had no console errors.
