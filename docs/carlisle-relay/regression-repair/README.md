# Carlisle regression repair — 30 October 2026

The requested repair addresses the 40 failed invocations recorded in
[`original-failures.json`](original-failures.json). The original failed run is
retained in `../final-validation/`; its results have not been rewritten.

## Runtime repairs

- Preserve explicit fog opt-in/opt-out and resolved native atmosphere values
  through editor capture, rebuild and material batching.
- Admit the actual 66.56 MB published level pack and the existing large explicit
  terrain mesh within bounded import limits. Keep depth, component, CPU-work,
  property-access and hostile-input guards. Explicit mesh buffers no longer
  consume the unrelated procedural-terrain sampling allowance.
- Account separately for wall-edge comparison work and emitted collision
  geometry. The aggregate CPU-work guard remains enforced.
- Serialize Nightworks emissive metadata only on supported decoration kinds.
- Uncross the Rooftop Relay death-pit polygon while preserving its points and
  extent; update only that level's published snapshot.
- Supply missing existing map landmark assets for five campaign level IDs.

No movement tuning was changed for these repairs. The player changes in the
release-packaging increment only attach the Meshopt decoder to asset loaders.
Published Mayfield and Skystream changes were integrated without dropping the
existing Carlisle launch-camera and animation work.

## Regression fixtures

The tests now exercise current authored structures and APIs. Retired level
counts, old native-scenery builders, old animation channels and the replaced
trampoline-camera property are no longer treated as runtime requirements.
Historical replay geometry is frozen explicitly so it tests the controller
against its recorded course rather than today's redesigned level. Provenance
is recorded in `tools/fixtures/regression-fixtures.md`.

The complete editor matrix yields between disposed cases so pending asset
callbacks can release their scenes instead of exhausting the Node heap. The
sentry line-of-sight fixture targets a visible corridor rather than a solid
wall. Beachside's native capture is compared with all 33 current authored
boardwalk paths and their actual support surfaces. Independent authored-head
pose checks start with a live rider instead of inheriting a random bail at the
end of the previous replay.

Legacy hand-built capture differences remain explicitly reported diagnostics;
this repair does not claim every legacy hand-built level converts losslessly.
No test is skipped or disabled in `check:all`.

## Release integrity

The combined release originally exceeded the unchanged 1,000,000,000-byte
Pages limit. The release build now:

- Packs 402 complete models with byte-for-byte decoded buffer checks, including
  geometry, skins and animation. It introduces no mesh reduction or LOD swaps.
- Retains original art and retired comparison models locally, omitting only
  unused comparison files from generated deployment output.
- Uses reviewed harbour image encodes and the existing data-map size policy.
  The fish market, repair shed and shrimp boat retain 8192-pixel colour maps;
  the two distant coastline-bank colour maps use 1024 pixels. Model geometry,
  collision and silhouettes are unchanged. Native and normal game views were
  inspected; detail-blurring building candidates were rejected.
- Stores 51 standalone PNGs as lossless WebP in the release. Raw RGBA pixels
  and dimensions match exactly. Chrome confirms exact alpha and opaque pixels;
  translucent compositing differs by at most one 8-bit rounding step. Full font
  PNG exports remain byte-identical to their original source files.
- Gzips the optional animation study catalogue without changing any keyframe or
  source byte. Production loading and offline membership support the new files.

## Evidence

- [`full-suite.json`](full-suite.json): actual `npm run check:all` invocation;
  44 groups, 203 leaf invocations (201 unique commands).
- [`build.json`](build.json): production type-check/build and release-size gate.
- [`browser-checks.json`](browser-checks.json): focused controls, live foot/board
  launch camera, packaged lite/full harbour and moving-platform carry checks.
- [`browser-launch/browser.json`](browser-launch/browser.json): second jumps,
  retained camera identity, float/gather, supported landing and normal CRT.
- [`browser-full/browser.json`](browser-full/browser.json): native-resolution
  machinery, bonus/return and three supported moving-platform rides.
- [`lossless-images/browser.json`](lossless-images/browser.json): all 51 native
  image pairs checked in Chrome.
- [`release-smoke/browser.json`](release-smoke/browser.json): packaged supported
  spawn, real K/L shortcuts, pit recovery, finish and catalogue download.
- `logs.tar.gz`: raw full-suite, focused, offline and build logs, including the
  earlier unsuccessful integration reruns. Success is determined by process
  exit codes, not by counting printed PASS lines.

The uninterrupted `npm run check:all` passed all 203 invocations across 44
groups against `088eb253` in 36.04 minutes.
All 40 originally failing commands remain included. Production build, offline,
release-size and local browser checks pass. The package is 998,290,153
bytes against the unchanged 1,000,000,000-byte limit. Publication is the remaining
release step; the browser smoke script is also used against the deployed site.

The first Pages attempt exposed an ignored cone-model file. Its exact approved
bytes are now tracked; the [isolated tracked-file build](clean-checkout/README.md)
and release gate pass. Gameplay code and the full-suite inputs are unchanged.

The Linux size difference was a stale stock-level certificate, not additional
art. [Portable stock verification](portable-stock/README.md) records exact-data
recertification, a new failing-then-passing regression, and the successful rebuild.
