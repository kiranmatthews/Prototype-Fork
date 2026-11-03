# Tribal Run — moving platforms and enclosed bush

The continuous 2.32 km causeway is now 30 fixed landings separated by 29 river
crossings. Thirty-five native timber decks provide straight ferries aligned to
the route bends, six pairs of alternating lifts and five orbiting rafts. The
existing movement, jump, grind and platform-carry physics remain unchanged.

Closed earth banks, overlapping thickets, mature trees, fern verges and high
boughs reuse Treehouse Trails' complete assets. The old open lagoon islands are
replaced by forest. The river remains below the gaps; there is no hidden fixed
floor at deck height. Native containment walls sit inside the outer banks.

Thirty-four crab patrols wear manually assembled wooden masks, shields and
spears. Each costume is three meshes and **276 triangles**, attached to the
existing animated head/claws; the imported skin, elasticity and takedown rules
are retained. Eight carved fire heads sweep across the dry approaches with an
open escape verge. Boarding zones and checkpoint restarts have space clear of
patrol centres. No new generated asset or distance-dependent mesh swap is used.

The nine checkpoints, bonus entrance/return, crystal and finish remain on
supported fixed ground. The separate Resonance Vault bonus is unchanged.
Tribal Run is a source-owned builtin and has no entry in `public/levels.json`;
the other published overrides and stock certificates are untouched.

## Review and evidence

- [Native input journey](native-0-28.json): continuous ordinary controls, every
  moving deck ridden, checkpoint boxes activated, crystal collected and gate
  reached. The pilot writes input traces to `/private/tmp/tribal-moving-trace.json`.
- [Geometry audit](geometry.json): 1,479 native collision support probes,
  29 open gaps, ordered camera headings, crate seating and supported checkpoints.
- Browser [opening](browser-opening.json) and [finale](browser-finale.json)
  evidence, [Course Clear](browser-course-clear.jpg) and
  [MAX/native paired lifts](max-paired-lifts.jpg). The game's result screen
  owns completion before the browser pilot can observe the headless Player's
  `finished` state; the recorded Course Clear screen is the finale evidence.
- `node tools/test-tribal-moving.mjs --audit` repeats both. `TRIBAL_FIRST`,
  `TRIBAL_LAST` and `TRIBAL_WAIT` select a crossing range or starting phase.
- `tribal-moving-review.html?playtest&level=tribal-run` provides visible review
  controls, the same input pilot, checkpoint/pit/finish probes and MAX/720p
  rendering. Add `&lite` for the lightweight pass. Review controls are not part
  of the published game bundle.

Validation includes the existing enemy-runtime lifecycle/animation regression,
`npm run check:levels`, the production build and release-size check. No full
suite was run. Browser evidence and final measurements are recorded in
`docs/LEVEL_ITERATIONS.md`.
