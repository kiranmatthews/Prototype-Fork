# Mall parking-garage opening

The level begins inside the original Mall entrance, above the galleria. Its
three stacked corridors, two quarter pipes, sloping return lanes, overhead
decks and fitted walls come from the actual source geometry. The conventional
path turns across the flat quarter toes and descends 36.25 m into the main mall.
The quarters remain rideable optional lines with normal board controls.

The new assembly contains 171 source components, 12,047 mesh triangles and 75
solid components. It uses the galleria's transform: 96% width, 92% length and
100% height. The complete course is now 2,163.87 m with ten checkpoints and
71,035 imported mesh triangles, plus native primitives and new connectors.
The first checkpoint is at the garage exit; the time-trial clock and level
preview now use the upper garage start.

Collision work includes continuous normals on the original quarter surfaces,
exact side collision, and fitted extensions at the quarter/wall seams. The
normal controller's existing mesh-crest launch now accepts authored vert
meshes that explicitly request the skate camera. This fixes a rider sticking
at the vertical lip. Original park controls and movement tuning are unchanged.

## Evidence

- `foot.json` / `skate.json`: complete input-driven production Player/Level
  runs, 244.18 s / 140.68 s, all ten checkpoints, crystal and finish, zero
  deaths, actual riding ground from all four source levels. Long per-frame
  traces are omitted from these compact committed reports.
- `parking-contact.json`: both garage quarters climb, launch and land without
  bailing; maximum frame displacements 0.557 m / 0.565 m. Both side-wall seam
  tests stop 0.504 m inside the boundary.
- `transitions.json`: all six existing Warehouse/Kona approaches still climb,
  launch and return without bailing; largest frame displacement 0.567 m.
- Browser reports and screenshots: packaged Chrome lite skating and full
  MAX/native 1920×1080 walking through the opening; exact source match, normal
  controls, supported checkpoint warps, deliberate pit recovery and no console
  errors. Screenshots retain the actual game render without paint-over.
- Required `check:levels`, production type checking/build and release-size
  checks pass. Final local release: 997,264,351 / 1,000,000,000 bytes.

Run the focused checks with `tools/test-mayfield-parking.mjs`, the existing
full-course `tools/test-mayfield-mall.mjs` (`--skate` optional), and
`tools/test-mayfield-transitions.mjs`. For real Chrome, use
`tools/mayfield-browser.mjs URL --parking --recovery`, adding `--foot --native`
for full-resolution walking. `MAYFIELD_OUTPUT` chooses the report directory.

This increment owns the Mayfield level data, preview, dedicated tests/review
tools and documentation. The only shared runtime edit is the narrow
authored-mesh crest predicate in `src/player.ts`. The four original source
levels, bonus, campaign/save key, tuning and published editor pack are retained.
