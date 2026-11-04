# Follow-up validation — 5 November 2026

Validated locally at about 23:08 UTC on 4 November / 12:08 NZDT on 5 November.
Elapsed follow-up-to-playable time was approximately 45 minutes; this is an
estimate from the preceding 22:24 UTC handoff, not a separately recorded timer.

## Focused checks

- `node tools/test-crate-assets.mjs`: actual GLBs, closed positive-volume
  fragments, all six outward faces, true side openings, intact/fractured
  exterior surface agreement, 28,120-triangle complete cage/fruit budget.
- `node tools/test-crate-art.mjs`: shared geometry/materials, bounds, finite
  art pulse, remaining fruit and reset, absent dot markings, bounded debris,
  no checkpoint fragments/explosion. This headless test uses fallback shells;
  exported asset counts come from the separate asset test.
- `node tools/test-crate-portraits.mjs`: default Bone Man, four head changes,
  texture repaint/version changes, existing and newly created Life crates.
- `node tools/test-life-multihit-crates.mjs`: existing reward, contact,
  checkpoint and capture behavior. It passes with its expected mocked-asset
  404 warnings; it does not validate rendered asset appearance.
- `npm run build`: typecheck, Vite bundle and complete release preparation
  pass. Existing bundle-size warning remains. Both new GLBs survive production
  packing with exactly 6,120 / 6,880 triangles, and all texture URIs resolve.

No full suite was run. No level data or movement tuning changed.

## Browser evidence

The in-app browser ran the actual local game, first with `?lite`, then with
full rendering, at MAX/native 1512×806 and normal 900×480 CRT rendering.
The game console contained no warnings/errors, and asset readiness had no
pending or failed entries. The Vite server separately printed its existing
unrelated Carlisle public-manifest import warning.

The studio review covered the complete family, six sides of the new cage and
green switch, matching fracture pieces, and the two head portraits. A fixed
360-step actual-rendered-vertex debris check found minimum Y -1.017 over the
floor at -1.02, finite transforms and complete cleanup. Twelve simultaneous
cage impacts peaked at 168 fragments, within the existing total debris limit.

Real Player/Level gameplay checked:

- Five-hit sequence: 5 → 4 → 3 → 2 → 1 → 0, with visible fruit matching each
  state; the fifth hit breaks the cage into 42 fragments and counts one crate.
- Hard reset restores five hits/fruit and clears effects. Soft restore after
  two hits likewise restores five hits/fruit.
- Spin destruction, including the matching 42-piece fracture in normal CRT
  rendering, and subsequent reset.
- Changing the actual character head updates both HUD and the existing Life
  crate to Bone Man or the alternate portrait. Bone Man was restored afterward.

Screenshots and JSON evidence are beside this file. `family-native.png`
compares the requested neutral materials and Nitro green. The
`life-*-hud-full-native.png` pair shows the real HUD and crate together.
`multihit-six-sides.png` includes the underside, and
`multihit-fracture.png` shows its actual matching fragments.

## Reproduction and release

Use `tools/crate-review-vite.config.ts` for an isolated dev cache.
`crate-art-review.html` exposes the six-side, fruit-count, fragment contact and
burst-pool checks. `crate-game-review.html?playtest&level=bonus-easy` exercises
the actual Player/Level behavior; append `&lite` for the quick pass. These are
development harnesses, not new player-facing menus.

The prior crate commit `5bee927d` is already public through `fc4f5723`.
This follow-up is a separate validated increment for the release coordinator.
Shared file edits are limited to the HUD portrait mapping/hook in `src/ui.ts`,
one contents-instance disposal call in `src/level.ts`, and the append-only
iteration log. No rebase, main push or GitHub polling is part of this handoff.
