# Bryce Canyon · Hoodoo Run

A playable recreation of the desert descent and wooded basin seen at about
1:00–3:00 in [the Riders Republic reference](https://www.youtube.com/watch?v=LPkhWoYYkCA).
The user accepted layout differences after confirming no local game files
were available, prioritising lighting, textures, beauty and performance.
This is an authored approximation, not a recovered copy of Ubisoft's level.

The expanded 3,814 m route descends 439 m. It begins on a raised timber
boardwalk with a 12 m jump and separate landing trestle, follows a 761 m upper-rim
approach into the original sandstone descent, then continues for another
1,661 m through capstone passages, wooded switchbacks, a dry-wash timber bridge
and pine slalom. Thirteen checkpoints,
a continuous camera lane and a finish gate use the existing movement model.
The route is 2.74 times its original length; the finish now follows the complete
lower valley. Route-distance measurements describe authored geometry, not a
claim of matching bicycle speed or source-game coordinates.
Ordinary road edges retain the game's default grinding behaviour.

`src/levels/desert-canyon.ts` owns route, collision, terrain, foliage and event
furniture. `src/desertMaterials.ts` supplies shared metre-scale triplanar colour
and relief. Existing vegetation remains native; small course furniture is
batched, and scenery uses the existing instancing, culling and streaming system.
There are no distance mesh substitutions.

The procedural formations use the unchanged MIT noise and crack displacement
from [RockGenerator](https://github.com/bamyazi/RockGenerator), with authored
profiles and seeded erosion. Nine native models have 3,360–27,600 triangles.
Two scenic placements reuse all measured elevation samples in the public-domain
USGS Wall Street study, coloured for this scene and compressed losslessly.
The original game archive readers were researched, but no game archives or
source-game assets were available or used. Real terrain supplies broad natural
silhouettes; the playable route remains authored.

See `public/desert-canyon/SOURCES.txt`, both manifests and
`vendor/rock-generator/PROVENANCE.md` for attribution, hashes and source limits.

## Authoring and review

- `node tools/desert-canyon/build-rocks.mjs` rebuilds seeded rock assets.
- `node tools/desert-canyon/build-survey.mjs <detailed.glb>` rebuilds the scenic
  elevation asset and byte-verifies every losslessly compressed buffer.
- `node tools/desert-canyon/validate.mjs` checks route support, checkpoints,
  finish access, shared texture ownership and rock budgets.
- Local review: `/tools/desert-canyon/review.html?playtest&level=bryce-canyon&launchReview&nocrt`.
  Use the location selector, normal/MAX resolution, gameplay/wide camera and
  native-input traversal. `nocrt` isolates the scene's surfaces and lighting;
  omitting it reviews the game's normal CRT presentation.
- Published play: `/?level=bryce-canyon&playtest&nocrt`.
- To save a review PNG directly into `docs/desert-canyon`, run
  `node tools/desert-canyon/capture-server.mjs start` (or `valley`), add `&capture` to the local
  review URL, then press **Save frame**. The loopback sink accepts one PNG.

The course is a built-in source level. Its components are generated lazily on
first use; selecting other levels does not bake the canyon. It is intentionally
not duplicated in `public/levels.json`, whose archived snapshots are already
near the build's 64 MiB inspection bound.

The broader `check:levels` command currently stops at
`tools/test-waterpark-decks.mjs:49` (texture retirement). The identical failure
was reproduced in an untouched checkout of baseline `68e48cb3`; it is unrelated
to this course. Focused canyon checks and the production build are recorded in
the iteration log after validation.
