# Jungle Ruins mesh and shoreline polish

Source-owned visual pass, 27 October 2026. First playable browser review was
9.2 minutes after the brief. Work is isolated in `codex/jungle-ruins-polish`,
based on `37b69e6524faa1b448772b18107c818aac3a43f8`.

## Changes

- Replace the procedural polygon cliffs throughout the cove, jungle perimeter,
  aqueduct and ascent with the existing full-detail Treehouse cave-wall meshes.
- Fit native stone paving to all four launch banks, close the aqueduct deck
  undersides with individual foundation stones, and add chipped coping to the
  original temple steps and the final climbing platforms.
- Seat palms and tide rocks on the cove profile; seat temple edge plants on the
  actual floor and ramp heights. Keep planted rock pockets away from jump lips.
- Use a curved, sampled waterline beyond the actual sea-level sand contour,
  ground-only shore detection, finite water ribbon and dry-sand clearance from
  the Treehouse opening. Add consistent sand UVs and a wet-to-dry vertex tint.
- Hide the ascent's plain bank surface behind the detailed cliff dressing,
  preserving its authored geometry and collision data.
- Hang terrace vines below their coping and leave the lost shrine's footprint
  clear of trunks and dense shrubs.

No new public assets, asset simplification, distance-based geometry swaps,
movement tuning or shared runtime changes. Jungle Ruins is a native builder,
with no `jungle` entry in `public/levels.json`, so the pack needs no update.

## Validation

The evidence JSON and screenshots in this directory describe the final local
candidate. The release coordinator owns integration and public deployment.

- Native enclosure: 164 full-detail rock instances, 64 native background
  canopies, 96 roots checked against actual rock triangles, 112 player boundary
  probes, and a valid editor capture/rebuild.
- Finale preservation: all 164 authored gameplay components remain identical
  to the base after excluding the two presentation flags. The four skating
  gaps, twelve ledges, checkpoints, camera zones and finish retain their layout.
- `npm run check:levels` passes on Node 22.23.3.
- Cove: 1,831 dry-sand probes, 152 inland probes and three input-driven
  swim/return journeys pass with zero deaths.
- Finale: all four skating gaps and twelve climbing ledges complete in
  75.42 simulated seconds, earning five checkpoints with zero route deaths.
  Both aqueduct and ascent pit probes recover to the earned checkpoint.
- `npm run build` passes. Production stamp: `Codex/sol fork · build 10-27 07:22 UTC`;
  offline version: `0194e0289538aafacf31`.
- Chrome lite and full: eight MAX/native views and three 720p views per mode,
  four keyboard swim/return journeys overall, no console errors, failed assets
  or WebGL errors in these fresh-renderer sessions.
- Chrome input smoke in both modes: supported spawn, charged double jump,
  side containment, earned checkpoint, pit respawn, bonus entry/return and
  summit finish all pass.

The first session's temporary evidence was lost in the Mac restart. Final
validation is repeated from the preserved worktree and saved here.

Reproduce from the feature worktree with Node 22 and an installed Playwright.
During active release coordination, run these heavy commands through the shared
`run_heavy.py` guard as directed by the coordinator:

```sh
npm run check:levels
node tools/test-jungle-shore.mjs
node tools/test-jungle-finale.mjs
npm run build
node tools/jungle-polish-browser.mjs http://127.0.0.1:5418/
node tools/jungle-ruins-browser.mjs http://127.0.0.1:5418/
```

`PLAYWRIGHT_MODULE` may point to the installed Playwright module.
`JUNGLE_POLISH_LITE=1` selects the fast rendering path; the default captures
full rendering at MAX/native resolution as well as the ordinary game camera.
`JUNGLE_POLISH_GALLERY_ONLY=1` and `JUNGLE_POLISH_VIEWS=ascent,summit` are useful
for an art-only review after changing those views. `JUNGLE_POLISH_NORMAL_ONLY=1`
opens only a fresh 720p session.

Reports: [level checks](level-checks.json), [build](build.json),
[native cove](shore.json), [native finale](finale.json),
[unchanged gameplay](gameplay-preservation.json), [exact source blobs](validated-source.json),
[lite browser](browser-lite.json), [full browser](browser-full.json) and
[input smoke](browser-smoke.json).

Views: [original ascent](before-ascent.png), [new ascent at MAX](ascent.png),
[normal game camera](ascent-720.png), [stone launch and retaining faces](launch.png),
[cove](shore.png), and [swimming in the ordinary game camera](swim.png).
Raw local captures remain in `.work/`; the full native trace remains in
`native-run/`. The selected evidence above is committed.

### Existing renderer issue

The optional `JUNGLE_POLISH_LIVE_RESIZE=1` path reports WebGL error 1286 when
switching MAX → 720p after the camera gallery. The identical sequence with the
original Jungle modules from `37b69e65` reproduces it. Fresh MAX and 720p sessions
are clean; the ordinary gallery checks each presentation in a fresh renderer.
The [comparison](renderer-resize.json) retains both results. Shared renderer
changes are outside this scenery increment.
