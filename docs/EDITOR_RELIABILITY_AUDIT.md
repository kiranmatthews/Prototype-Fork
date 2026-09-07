# Editor reliability audit

This is an ongoing audit against the requirement that authored level content can
be moved and edited without losing behavior. Passing the normal build is a
release gate, not proof that every remaining fidelity or resource issue is solved.

## Verified hardening after a03db25

- Shared files validate both their input and fully migrated form. Canonical
  additions and wrapper names cannot defer an invalid change until reopening.
- Modular masonry is bounded before generation; 144 builder comparisons and
  the native Jungle capture check the estimate against actual output.
- Long and thin polygon walls retain complete collision. Diagonal subdivisions
  bound AABB overreach, and excessive scan work is rejected before construction.
- Library limits preserve draft/registry/history consistency; quota failures keep
  a valid session copy. Fifteen behavioral transaction cases cover acceptance,
  rejection, retry, selection, locks and interrupted moves.
- Old/new ocean data preserves its rendered geometry across migration. Tests
  compare actual full/lite vertices for both source coordinate modes, both sea
  sides, straight/curved conversion, translation and native coastal capture.
- Narrow docks avoid panel overlap and expose the canvas via EDIT. The inspector
  keeps TEST reachable while scrolling. Reentrant capture loss cannot roll back
  a completed numeric scrub.

## Remaining audit work

1. **Terrain support probe cost:** `buildWoodPath` probes ground before the final
   scene BVHs are installed. Current accounting multiplies probe count by
   component count, which does not describe the triangle work of native meshes.
   A 600 m support-seeking path with 25 native meshes of roughly 4,000 triangles
   can pass existing limits yet request roughly 31.8 million raw triangle tests.
   Reproduce this with real support probes and either build the acceleration
   structures before probing or enforce an accurate aggregate work limit.
2. **Legacy conversion fidelity:** strict hand-built object comparison still
   diagnoses themes/custom material effects and manually emitted visual-only
   scenery. Compare actual missing content, not only object-tree inequality;
   preserve authored content with editable representations and meaningful
   visual/runtime evidence before claiming complete capture parity.
3. **Touch gesture coverage:** portrait/landscape panel layout is checked in a
   browser, but true multi-touch selection, orbit, cancellation and keyboard
   viewport transitions still need targeted browser/device verification.
4. **Large-library responsiveness:** whole-registry transaction validation now
   preserves correctness; measure repeated edits near the allowed library size
   before deciding whether a cached acceptance summary is needed. Such a cache
   must invalidate on all mutations and never weaken the trust boundary.

Use `npm run check:editor-security`, `npm run check:editor-roundtrip`, and
`npm run build`, followed by real-browser lite/full checks. Preserve the full
scope above when a later pass continues; do not declare completion merely because
current regression cases pass.
