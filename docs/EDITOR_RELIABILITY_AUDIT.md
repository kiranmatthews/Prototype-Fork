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

## Verified hardening after 71893a3

- Support probes use early BVHs and private nearest-hit queries. A normal-grid
  regression drops from 458,752 to 2,048 triangle tests. Imported overlap is
  estimated before construction; exact cumulative BVH work is bounded before
  each ray, including coincident faces. Editor support-bearing commits get an
  exact disposable build before persistence. Rejected builds dispose their
  early acceleration trees and partial resources; successor ownership is tested.
  Level switching constructs a candidate before retiring the current run; ten
  actual main-handler regressions verify failed selection preserves world,
  editor/replay, pause, inventory, bonus sessions and VFX. Explicit cloud restore
  may still replace the requested library while retaining/reporting the old run
  if its selected replacement cannot build.
- Immutable owned registry entries cache their canonical JSON. At 128 levels /
  16.6 MB, a small transaction dropped from seconds to single-digit milliseconds
  in the non-rendering/in-memory-storage harness. Prepared transactions reuse
  exactly one validated active snapshot, reject forged/stale tokens, and still
  check live library limits before writing. Active Descent transaction work
  drops to roughly 0.4 s; its construction/rendering are separate costs.
- Twenty synthetic pointer cases exercise the real Editor and OrbitControls.
  A separate browser DOM harness passes six touch/pen/cancel/scrub/view cases,
  reports no browser errors, and leaves saved storage unchanged. Synthetic
  capture is modeled explicitly; this is not a physical-device claim.
- Descent retains road paint, barriers, mountain strips, bay islands and 214
  procedural pine owners. Visual mesh data carries material opacity/emission/
  fog without becoming phantom ground. Unused UV payloads are omitted while
  authored normals are preserved. All 294 geometry/material/collision/movement
  checks pass in lite and full modes without raising interchange limits.
  Mountain groups link their visible strips to collision walls; guardrail
  groups link their beams/posts to grind paths. Explicit terrain material edits
  are no longer overwritten by the jungle atmosphere setting.

## Remaining audit work

1. **Legacy conversion fidelity:** actual remaining differences were measured
   through the real atmosphere/material code, beyond object-tree warnings.
   Sky Bridge forks lose their id-bound whiteout (fog 5–24 m becomes 90–260 m,
   sky/mist reappear). Nightworks and coastal fog/light values change because
   native themes are not captured. Beachfront's Standard sand material loses
   normal/AO maps; oil slicks gain checker textures; static Nightworks platform
   emission is lost. Preserve these through bounded authored theme/material
   controls and verify rendered/effective values. Jungle atmosphere itself
   already matches after capture; do not add unused flags based on warnings.
   Descent's listed static scenery is covered, not every legacy builder.
2. **Large active-draft rendering:** active Descent has approximately 3 MB /
   1,940 components. Its CPU transaction and rebuild are now about 0.8–0.9 s
   combined before browser storage, DOM and WebGL. Measure the browser costs
   and repeated scene/resource churn independently if input remains sluggish;
   do not weaken import validation or rely on identity-caching mutable drafts.
3. **Device gesture coverage:** synthetic browser and actual OrbitControls
   event coverage is established, but physical touch/pen input and mobile
   virtual-keyboard viewport transitions still need device-specific QA.
4. **Cross-feature authoring audit:** continue checking component controls,
   authored field semantics, runtime ownership and import/build failure paths
   against the full original edit/move invariant. Existing passing tests do not
   establish that all possible editor interactions are covered.

Use `npm run check:editor-security`, `npm run check:editor-roundtrip`, and
`npm run build`, followed by real-browser lite/full checks. The dev-only
`/tools/editor-pointer-review.html` page provides the synthetic browser harness.
Preserve the full scope above when a later pass continues; do not declare
completion merely because current regression cases pass.
