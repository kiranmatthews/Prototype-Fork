# RockGenerator procedural geology

Source: https://github.com/bamyazi/RockGenerator

Pinned commit: `c2822e22c085afc43f875ad38aad701bcd0b89d3`.

`noise.js` and `displacement.js` are unchanged copies of the upstream
`src/noise.js` and `src/geometry/displacement.js`. Copyright 2026 Rock Generator
Contributors; MIT licence retained alongside the files and in the release asset
directory. No upstream application, decimator or distance-LOD code is used.

`tools/desert-canyon/build-rocks.mjs` supplies our own hoodoo profiles and seeds
to the upstream horizontal/vertical crack displacement. It exports complete
native GLBs and records their hashes and triangle counts. All models remain
below 30,000 triangles. The same seeded simplex implementation carves the landform.
