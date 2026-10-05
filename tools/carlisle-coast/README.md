# Carlisle Coast authoring

The active Carlisle Coast is the sandstone temple ravine described in
[docs/CARLISLE_COAST.md](../../docs/CARLISLE_COAST.md). Its source-owned level
contains 287 retained non-box originals, 162 authored boxes and 1,848
non-colliding art components: 2,297 components total. Original support, walls,
pits, rails, checkpoints, timed obstacles, side-scroll travel and the finish
remain authoritative, including the existing hill-rail clearance correction.
Movement tuning is unchanged.

`src/levels/carlisle-coast.ts` owns the retained course and boxes;
`src/levels/carlisle-coast-art.ts` supplies editor-compatible presentation.
The new `tools/carlisle-coast-assets/` pipeline owns six original Meshy models,
references, prompt records, surface maps and provenance. It used 90 existing
credits, verified 486 → 396. The six GLBs total 14.15 MiB transfer, 30,797 near
triangles, 6,400 actual far triangles and 10.00 MiB of ASTC 4×4 atlas mip chains.
Beachside Stonecliff and four Treehouse Trials V2 aliases retain measured
natural proportions and receive Carlisle's scoped moss/ochre material tint.

Gateways fit the full supporting pad: measured clear width is 11.588 m at an
18 m authoring width; placements use at least 22 m overall width and enough
additional width for `supportWidth + 1` m clearance. Guardians sit outside the
support. Moss overlays use negative depth bias; normal maps retain the correct
signed Y response. E foreground cutaways hide both LOD meshes without changing
collision. Streaming forms 1,184 cells, with peak 261 resident cells at the
fifteen source spawn/checkpoint camera locations. Desktop/portrait rendered
performance evidence is pending and belongs in
`docs/performance/carlisle-coast-*`.

## Sync and check

```sh
node tools/carlisle-coast/sync.mjs --write
node tools/test-carlisle-layout.mjs
node tools/test-carlisle-boxes.mjs
node tools/test-carlisle-beam-contact.mjs
node tools/test-carlisle-presentation.mjs
python3 tools/carlisle-coast-assets/validate.py
npm run check:levels
npm run build
```

`sync.mjs` updates only the `test` snapshot in `public/levels.json`. The campaign
keeps `test-course` progress. Untouched published Test Course/Carlisle snapshots
follow the builtin; edited or renamed local copies stay intact. The
`cache-signature.mjs REV --check` utility verifies migration and edited-copy
preservation for a published revision available in local Git history.

Smoke-test lite first, then perform full and portrait browser review:

```sh
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --lite --smoke-only
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --visual
node tools/carlisle-coast-browser.mjs http://127.0.0.1:5240 --portrait --visual
```

The harness restores source, records actual frames and console errors, and
checks the fork build stamp. The input pass verifies supported spawn, charged
skating jump, checkpoint, pit respawn and finish. See the main document for
output controls, provenance and the release workflow. Do not run
`npm run check:all` without an explicit request.

## Historical city tools

`original-course.json` remains the independent course oracle. The city
prompts/references/ledger, CC0 Downtown City licence, `bake_city.py`,
`compress_city.mjs`, `pack_city.py`, extras tooling and former `review.html`
remain historical authoring material. They do not define the active ravine
presentation or require city model loads during this level. Earlier city
releases and their review evidence remain in Git history.
