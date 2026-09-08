# Editor reliability audit

This records the completed hardening passes against the requirement that
authored level content can be moved and edited without losing behavior. The
user requested closeout after the current integration and release. The findings
below remain documented follow-up candidates; no further audit is scheduled.
Passing the normal build is a release gate, not proof that every possible
fidelity or resource issue is solved.

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

## Verified hardening after c902b81

- Native atmosphere is represented by bounded final fog/light/backdrop values;
  copied IDs retain Sky Bridge's whiteout and Nightworks/coastal lighting.
  Legacy data-backed Sky exports/duplicates preserve their effective defaults
  without saving a no-op editor open. Explicit custom settings apply after
  sky/jungle/map defaults, with honest fallback-sky controls. 442 actual
  renderer/security/history checks compare against the pre-change native
  baseline and exercise every override; control tests preserve exact data
  behind rounded numeric/color displays.
- Native Beachfront sand meshes retain the trusted Standard material, normal/AO
  maps, metric UVs and regenerated tangent frames. Descent oil remains
  untextured, and Nightworks static platforms retain glow. Nine implemented
  surface types support bounded emission. Material styles cannot load user URLs.
  All 256 allowed environment sand patches and styled meshes share three maps
  per Level, preventing small files from multiplying the 2K textures per patch.
- Signed-axis transforms preserve moving platform/rail/ferry direction at each
  point in time. Independent rope swing/ferry clocks and natural rope speed
  survive native capture; actual collider, grind and release velocities are
  tested through rotations and nonuniform group transforms. The merged
  floating-rock Nightworks retains its flexible rope grips and gains accurate
  rock size/yaw controls, signed movement and diagonal ridge alignment. The
  corrected ridge mapping turns native 90-degree asymmetric hulls by 180
  degrees from the prior inconsistent mapping; native support/landing and
  loaded visual/collision checks pass. Explicit rock color/glow/texture/fog
  overrides reach both fallback and asynchronously loaded materials.
- A real-browser large-draft fixture exposed six leaked ocean textures per
  rebuild: uniform merging cloned rendered textures while disposal released
  originals. Owned sampler bindings fix the leak. Nine repeated operations in
  lite/full geometry modes hold 13–14 textures and return to one shared texture
  after cleanup. See [browser measurements](EDITOR_BROWSER_PERFORMANCE.md) for
  timings and the distinction between this fixture and the full game pipeline.

## Follow-up findings retained at closeout

1. **Thorn authoring and hazard alignment:** a selected elongated thorn and pit
   rotate differently. The pit turns while the thorn visual stays on its old
   axis; an actual lethal point lies outside the visible bounds afterward.
   Thorn `s/yaw/seed/color` fields also lack single-item controls. Fix this first,
   preserving the deliberately separate visual/collision owners and sparse
   defaults, then compare actual geometry and pit membership through edits.
2. **Car inspector/runtime agreement:** a sparse car displays range 5, speed 3
   and X patrol, while runtime uses range 12, speed 10 and Z. Road-following cars
   ignore the exposed range/yaw controls. Correct effective defaults and make
   route/free-patrol authoring truthful; verify actual movement and collision.
3. **Remaining legacy presentation:** normal Beachfront camera framing still
   uses a native-ID-only six-degree FOV offset, lost by copies for P1 and P2.
   Preserve that authored offset without retuning the user's global lens.
   Continue the broader source-only inventory; the listed scenery/material
   fixes do not establish full conversion parity for every legacy builder.
4. **Large active-draft responsiveness:** the real browser fixture measures
   roughly 0.8–0.94 s synchronous transactions for Descent. Geometry construction
   remains the largest stage. It omits player/campaign UI/postprocessing and
   does not measure completed GPU work; investigate these separately before
   claiming full game or mobile performance.
5. **Device gesture coverage:** synthetic browser and actual OrbitControls
   event coverage is established, but physical touch/pen input and mobile
   virtual-keyboard viewport transitions still need device-specific QA.
6. **Cross-feature authoring audit:** continue checking component controls,
   authored field semantics, runtime ownership and import/build failure paths
   against the full original edit/move invariant. Existing passing tests do not
   establish that all possible editor interactions are covered.

Use `npm run check:editor-security`, `npm run check:editor-roundtrip`, and
`npm run build`, followed by real-browser lite/full checks. The dev-only
`/tools/editor-pointer-review.html` page provides the synthetic browser harness.
These findings describe the limits of this closed pass and can guide a future
user-requested iteration. They are not scheduled background work.
