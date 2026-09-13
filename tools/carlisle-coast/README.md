# Carlisle Coast authoring

`src/levels/carlisle-coast.ts` fits the city to the original Test Course snapshot in `original-course.json`. The original route, elevations, ramps, jumps, halfpipe, enemy/obstacle sequence, checkpoints, lift, moving crossing and middle E side-scroll remain authoritative. The previously requested spawn-right playground (50 identified components) remains removed. The latest box brief replaces the old 170 crates with 162 authored placements, leaving 288 original non-box components in their original order.

`src/levels/carlisle-boxes.ts` groups the new boxes into 20 encounters: spaced skating strings, clear run-ups and landings, optional stacked rewards, two independent switch staircases, bounce assists and TNT/Nitro choices. All 12 crate kinds are used. The Nitro-clear switch is off the straight finish line. Every box is supported by original ground or an exact 0.96 m stack.

Visible steel beams use an upright tangent frame in both directions, a narrow 0.18 m flange and rounded 0.09 m running crest aligned with the existing truck/deck contact surface. This prevents the previous inverted sloped beams and deck/wheel overlap. Original rail 132 keeps its horizontal route and four original anchors, with two additional knots that lift it above the road crests; its supports follow that corrected path. Controller tuning is unchanged.

Foreground frontage and scaffold braces use `cameraCutaway` to hide during the side-scroll shot, including its transition. The rear scenery and playable decks/rails remain visible, all collision remains active, and ordinary/chase/editor views restore the scenery. The editor exposes this as **hide in side view** on decor, walls and meshes. Cutaway and permanent scenery use separate instancing buckets even when they share a city block.

Run `node tools/carlisle-coast/sync.mjs --write` to update only the `test` entry in `public/levels.json`. The campaign keeps the `test-course` progress key. Untouched published Test Course and Carlisle snapshots follow the latest builtin; edited or renamed local copies stay intact. `node tools/carlisle-coast/cache-signature.mjs 3b0c637 --check` verifies the previous published cache and a one-centimetre edit, renamed copy and in-place edit. This authoring utility requires the named revision in local git history.

The city uses the owner's CC0 Quaternius Downtown City MegaKit Standard download. `bake_city.py`, `compress_city.mjs` and `pack_city.py` produce the shared Meshopt/KTX2 library with JPEG/PNG fallbacks. Buildings, machinery and materials remain available in the editor. Road `amp` is height change across local +X in metres, preserving horizontal dimensions. Moving and breakaway work decks attach to original collision objects. Retaining-panel darkness is relative to each panel.

The original Meshy prompts, references and ledger remain here. No additional Meshy generations were used for the box/beam correction; total spending remains 75 of the authorized 600 credits. Signed responses and raw authoring models stay under ignored `.img2threejs/` directories.

Focused validation:

- `node tools/test-carlisle-layout.mjs` (also `node tools/test-carlisle-coast.mjs`) independently compares retained terrain/encounters with the original world, allowing only the documented rail-clearance edit. It covers 3,192 support samples, 3,950 join-clearance samples, 1,499 physical/rendered gap samples, 576 real Player ledge attempts and 208 dynamic-skin checks.
- `node tools/test-carlisle-boxes.mjs` checks crate support, walls, rail and landing clearance, both switch puzzles, editor normalization, side-view visibility and collider retention. It raycasts 1,026 actual beam surfaces; minimum beam-to-road clearance is 0.109 m.
- `node tools/test-carlisle-beam-contact.mjs` checks 96 actual board poses across rising/falling and N/E rails, both travel directions/stances and all eight grinds. It probes actual deck and wheel vertices, including Smith/Feeble overhangs, as well as contact and planted feet.
- `npm run check:levels` and `npm run build` are required before publishing. The full suite requires an explicit request.

The local `review.html` provides section/box positions, input-driven actions and actual-board grind fixtures. **Resume controller** restores live traversal after a static pose. **Use source** drops only the preview origin's test override. Preview capture uses a temporary localhost receiver. Current evidence is in `review.json`; prior city releases remain in git history.
