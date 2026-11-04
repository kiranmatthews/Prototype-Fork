# A readable platformer box route — local preview

The platformer now has one authored route through all ten jump courts to the
crystal and finish. Its 229 ordinary/reward crates and nine checkpoint boxes
are on that route. The first crate sits in front of the spawn. Each subsequent
landing has a visible pair, with fruit marking the gap and gold arrows aimed
at the actual next landing. Gold edge markings remain after collection.

Keep the original fifty court jumps. Add forty small permanent landings across
the balcony transfers and chapter exits, making the complete route traversable
on foot. Balconies now curve toward the next court, keeping the next boxes in
the ordinary forward camera. The six Carlisle springs, three kickers, paired
spine chains and branching rail network remain available for board traversal.
Their receivers no longer carry crates that compete with the main route.

Recovery islands close to the route move to the nearest existing height,
preferring lower shelves and retaining all six strata. Their rails follow the
actual shelf positions. This opens the jumping and viewing space without
removing landing coverage. All 656 landings remain connected, and average
platform area is approximately 362.5 square metres including recovery shelves.
The main stepping stones are 12 by 14 metres.

This is a level-data change. The shared spaghetti helper now selects recovery
destinations from actual shelf heights; the race's unchanged shelf positions
produce the same choices. There are no runtime, player, tuning or camera
changes in this increment. The earlier compact race and HUD work is preserved
in local commit `1366361c` and its unpublished dependencies.

## Validation

All 114 authored route jumps pass native movement fixtures. Every crate has a
real supporting surface, every next box pair has a clear sightline from its
preceding landing, and representative pairs break through native spin input.
Full/native Chrome checks all 114 takeoffs: the next destination stays in the
standard camera. Lite and full/native screenshots are saved with compact
reports in `box-route-evidence/`.

Delivery remains local at port 5248. No shared level-pack replacement, push or
publication is included.

The final coverage pass checks 52,577 XZ positions and 2,148 native collider
rays. Sampled misses still land promptly. Six springs, three kickers, both
spine chains and checkpoint/crystal/finish pass again after the layout change.
Thirty-one native fork fixtures cover both courses; the platformer retains
30 primary fork junctions. Eight full-render fall cases keep the rider visible
without changing camera yaw. Required level checks and production build pass;
offline version `8c1fd3e1a6653c5f88f9`. No full suite ran.

The older fork fixtures used 288-metre height assumptions. They now measure
actual downhill grades, enter slopes at their physical ground height, and
scale the expected minimum speed gain with the requested vertical compression.
Actual race/platformer descents gain approximately 1.35 / 3.08 m/s from a
12 m/s entry. Normal gameplay tuning is unchanged.

All six platformer recovery threads cross their first span junction and
complete the following span with native balance inputs, including slow uphill
links. Six race threads pass the same handoff check. The fixtures begin on
the intended rail's approach, avoiding ambiguous catches at earlier crossings;
the platformer pilot uses firm countersteering without changing player state
or physics during traversal. No deaths occur in these fixtures.

Prompt-to-validated-local-preview: approximately 45 minutes. The first playable
route preceded the final traversal and visibility checks.
