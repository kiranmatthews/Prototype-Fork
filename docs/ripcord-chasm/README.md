# Ripcord River finish chasm — 4 November 2026

The former 12 m sanctuary jump is now a 56 m chasm. A 40 m bank lets the
player move onto the escape rail before the edge. The 86.65 m rail includes
supported entry/exit sections, stays 10.8 m off the boulder's centreline at
the drop, and curves back to the crystal and finish after the stone has fallen
below the crossing. Route fruit follows the grind instead of inviting a jump
into the centre of the chasm.

The original finish position, four checkpoints, other jumps, boulder radius,
chase speeds and movement tuning are unchanged. The work uses the existing
bank and rail primitives and existing art; it introduces no generated models.

## Verification

- `node tools/test-ripcord-chasm.mjs`: full input-only run in 89.68 seconds,
  four checkpoints, crystal, finish, zero deaths; 112 physics frames grinding
  above the open chasm. Ground rays cover the centre and both shoulders.
- The actual last boulder completes its 176-frame fall with a minimum 2.66 m
  clearance from the rail and 4.74 m from the far bank.
- `npm run check:levels`, `npm run build`, and `npm run check:release` pass.
  Release output is 805,685,438 bytes. The full suite was not run.
- [Native run evidence](native-run.json), [Chrome lite crossing](browser-lite.json),
  and [full/native boulder fall](browser-fall.json).
- Native MAX review at 3024 × 1724 confirms the open chasm, supported rail ends
  and the boulder falling through the centre. [Frame](boulder-fall-native.png).
- [Normal full-render crossing](browser-full.json): 136 grind frames, crystal,
  finish, zero deaths and unchanged lives. [Missed rail](browser-respawn.json):
  one pit death followed by a grounded respawn. [Console](browser-console.json):
  no warnings or errors.

Local visual review: `/tools/ripcord-chasm-review.html?playtest&level=rumblewater-run`.
Add `&lite` for the fast render path. The review buttons use production
respawn/reset entry points and supply ordinary player inputs.
