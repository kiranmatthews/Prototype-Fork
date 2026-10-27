# Motu Reef Loop — exterior support frame

Twelve thin posts that crossed the loop opening have been replaced by two continuous exterior ribs, four grounded uprights and four diagonal braces. Eight concrete feet carry steel plates and anchor heads. The original riding mesh, full outer skin, roll-in and separated exit retain their exact geometry. Individual feature-name signs remain removed.

The original 225 non-batched festival components are unchanged from d4f4e3f0fb7ddfbcdc99d55842d785652527d1f4. New supports stay at least 0.39 metres outside the loop's riding radius. Uprights and feet use ordinary native platform contact and edge grinding. Structural diagonal braces use native swept side contact and deliberately provide no additional grind line.

Native validation passes 24,924 nondegenerate authored triangles, eight new brace sweeps and the existing 952 closure-fit points / 424 closure contacts. The loop still completes from rest in 295 frames, reaching 8.399 m. The boardwalk reaches all four targets in 227 frames; the wave-wall air returns to ground. All eight real Player routes pass in both full and lightweight browser rendering. Console warnings/errors are empty.

Daylight and sunset were inspected at 1920 × 1080 scene input with 3840 × 2160 output. Moonlight and the final full-render entrance/exit view were inspected at normal 1280 × 720 input. The viewport override was reset after review.

Required level checks, TypeScript/production build and release-size validation all pass. The package contains 1,838 files and 999,498,661 / 1,000,000,000 bytes; offline version 52cc6b15700a60fa3cfd. Exact source hashes and command exits are recorded in verification.json. The first check:levels attempt was intentionally interrupted to provide the user's requested live local preview. After the preview tab closed, the remaining commands resumed without repeating unchanged native/browser checks.

This increment changes src/levels/motu-festival.ts and tools/test-motu-festival.mjs, plus evidence and the append-only iteration log. It changes no shared runtime, movement settings, external assets or public/levels.json. The separate palm-contact preparation is not wired into this level or included in this increment.

## Evidence

- daylight-native.png, sunset-native.png, moonlight-normal.png: exterior frame in all three looks.
- loop-front-normal.png: final full-render view of the approach and exit.
- native-validation.json: contact, geometry and continuous native routes.
- source-preservation.json: comparison with the immutable prior source.
- full-rides.json and lite-rides.json: eight real Player routes in each renderer.
- full-console.json, lite-console.json and final-console.json: clean browser logs.
- daylight-report.json, moonlight-report.json and verification.json: render settings, source hashes and command results.
