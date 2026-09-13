# Carlisle Coast authoring

`src/levels/carlisle-coast.ts` fits the city to the original Test Course snapshot in `original-course.json`. It retains the original route, exact elevations, ramps, jumps, halfpipe, rail nodes, enemy/obstacle sequence, crates, checkpoints, lift, moving crossing and middle E side-scroll zone. Only the previously requested spawn-right playground (50 identified components) is removed. All other 458 source components stay in their original order. Their collision and motion remain authoritative beneath the city presentation.

Run `node tools/carlisle-coast/sync.mjs --write` to update only the `test` entry in `public/levels.json`. The campaign keeps the `test-course` progress key. Exact untouched copies of either the original Test Course or first Carlisle release follow the corrected builtin; edited or renamed local copies stay intact.

The city uses the owner's CC0 Quaternius Downtown City MegaKit Standard download. `bake_city.py`, `compress_city.mjs` and `pack_city.py` produce the shared Meshopt/KTX2 library with JPEG/PNG fallbacks. The same buildings, machinery and materials remain available in the editor. Road `amp` is height change across local +X in metres, preserving horizontal length and width. Moving and breakaway work decks attach to the original collision objects. Retaining-panel darkness is relative to the panel, so lower districts keep their correct lighting.

The original Meshy authoring prompts, references and ledger remain here. No new Meshy generations were needed for this correction; total spending remains 75 of the authorized 600 credits. Signed responses and raw authoring models stay under ignored `.img2threejs/` directories.

Validation: `node tools/test-carlisle-layout.mjs` (also available through `node tools/test-carlisle-coast.mjs`) compares the actual original and city worlds, including every gameplay property, entity and grind path, timed hazards, 3,192 support samples, 3,950 dense join-clearance samples, 1,499 physical and rendered gap samples, 576 real Player ledge attempts and 208 dynamic-skin checks. Run `npm run check:levels` and `npm run build` before publishing. The full suite requires an explicit request.

The local `review.html` provides original-section positions and input-driven checks. Its Use source button drops the preview origin's local test override. Preview capture uses a temporary localhost receiver, separate from the published game. Current evidence is recorded in `review.json`; the earlier flat city is retained in git history at `1e8868c`.
