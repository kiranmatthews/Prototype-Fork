# Carlisle plated moving decks

Local presentation increment based on `233fa1bd070e514d402b47e869cdcae3a2095477`.
Twenty native moving steel boxes now have solid bevelled plates, recessed seams,
continuous backing, I-section edge frames, underside cross members, orange edge
caps and recessed hex fasteners. The previous corner plates shared the floor's
top plane and flickered; the replacement separates those surfaces.

All new geometry remains inside each original moving box. Plate tops meet the
original contact plane. The native box still owns collision, grinding and motion;
the visual shell follows its existing transform. No physics, camera, spring,
course, crate or bonus changes. Eighteen slippery surfaces remain wet steel.
The eight bouncing movers keep their nets and the four bonus boats keep their
boat decks. Full geometry remains at every distance, with no LOD or decimation.

The eight source sizes share 32 merged geometries and four materials. Across all
20 placements there are 893 plates, 183 girders, 538 fasteners and 126,960
triangles. There are no new colliders or per-frame update loops.

## Material provenance

Built-in Imagegen produced the complete 1254×1254 navy marine-paint image at
`public/textures/carlisle-steel/weathered-navy.png`. It is used without cropping,
resizing or retouching, at a fixed metre scale, as albedo and subtle bump.
`prompt.json` preserves the exact generation prompt and original output path.
`texture.json` records its SHA-256 and byte-identical compiled copy. No Tripo
credits, API usage or purchases were made in this increment.

## Verification

- `tools/test-carlisle-steel.mjs`: all 20 authored rectangular boxes matched;
  finite geometry inside the original bounds; 4,320 downward surface probes
  with no holes or raised art; eight shared templates and clean disposal.
- `tools/test-carlisle-shipyard.mjs`: original main/bonus course and twelve
  original prop fingerprints pass. The seven previously added airborne cargo
  formations remain unchanged.
- `protected-source.json`: 19 protected source files match the preceding commit,
  including player, camera, tuning, levels, cargo, wet slopes and earlier art.
- `tools/carlisle-steel-review.mjs`: compiled lite and full native 1920×1080
  Chrome checks, eight moving-deck views, normal 480p/CRT presentation, translating
  and spinning deck carry, main/bonus/main reload and zero console errors.
  Both carry cases stayed grounded without deaths. The bonus retains four boats
  and creates no steel shells.
- `npm run build`: typecheck, production bundle and asset preparation pass.
  Build stamp: `Codex/sol fork · build 10-30 03:48 UTC`; 1,783 files / 1,112.5MiB;
  offline version `70cd0e51f4bb34232847`.

`before/` retains the preceding compiled build's views and native carry samples;
`lite/` and `review/` contain current evidence. An initial test incorrectly
assumed the moving boxes had no explicit vertices; it now verifies their actual
eight-corner rectangular geometry. The first build caught an unused material
field, removed before the passing build. Neither correction changed gameplay.

This is a bounded presentation review, not a new continuous four-kilometre clear
or a sustained performance measurement. No level data changed, so the earlier
level audit is retained; no full-suite run. Local only; publication remains held.

[Play locally](http://127.0.0.1:5483/?playtest&level=carlisle-coast&art=harbour).
