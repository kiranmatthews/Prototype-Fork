# Bryce Canyon · Hoodoo Run

A playable recreation of the desert descent and wooded basin seen at about
1:00–3:00 in [the Riders Republic reference](https://www.youtube.com/watch?v=LPkhWoYYkCA).
The user accepted layout differences after confirming no local game files
were available, prioritising lighting, textures, beauty and performance.
This is an authored approximation, not a recovered copy of Ubisoft's level.

The complete 5,631 m route descends 1,176 m. It begins on a raised timber
boardwalk with a 12 m jump and separate landing trestle, follows a 772 m upper-rim
approach into the original sandstone descent, then continues through connected
hoodoo walls, wooded switchbacks, a creek bridge and a steep rock chute.
A new 1,751 m exposed cliff traverse follows the previous finish, descending
another 356 m above an open forested river valley. Seventeen checkpoints,
a continuous camera lane and the relocated finish use the existing movement model.
Route-distance measurements describe authored geometry, not a claim of matching
bicycle speed or source-game coordinates.
Ordinary road edges retain the game's default grinding behaviour.

`src/levels/desert-canyon.ts` owns the complete route, collision and original canyon.
`src/levels/desert-vista.ts` owns the exposed rim, valley, native planting and
procedural strata. `src/desertVistaCatalog.ts` is its generated spatial asset catalog. `src/desertMaterials.ts` supplies shared metre-scale triplanar colour
and relief. Existing vegetation remains native; small course furniture is
batched, and scenery uses the existing instancing, culling and streaming system.
There are no distance mesh substitutions.

The reference-style revision replaces the extension's broad, shallow hills with
narrow descending cuts, connected orange sandstone fins, warm pale caps and
contrasting pine pockets. Existing native pine geometry and its original atlas
are rearranged into branch whorls; all 9,153 source triangles survive, with added
branch supports and leaf copies bringing the complete tree to 24,763 triangles.
Low existing shrubs and grass cluster beside the woodland trail. A cut creek
passes beneath the lower timber bridge. High sun, stronger surface relief and
a cooler sky distinguish the lit sandstone from its shaded cuts.

The level has a lower, wider forward camera. The shared surface-follow overlay
now honours a level's authored camera rig, as the ordinary camera already did;
it previously substituted the default close, downward shot on gravity tracks.
An integration regression checks authored distance and pitch on the actual
production camera wrapper, alongside the existing loop and input tests.

The procedural formations use the unchanged MIT noise and crack displacement
from [RockGenerator](https://github.com/bamyazi/RockGenerator), with authored
profiles and seeded erosion. Nine native models have 3,360–27,600 triangles.
Two scenic placements reuse all measured elevation samples in the public-domain
USGS Wall Street study, coloured for this scene and compressed losslessly.
The original game archive readers were researched, but no game archives or
source-game assets were available or used. Real terrain supplies broad natural
silhouettes; the playable route remains authored.

See `public/desert-canyon/SOURCES.txt`, the rock, survey and pine manifests and
`vendor/rock-generator/PROVENANCE.md` for attribution, hashes and source limits.

## Exposed valley continuation

The opening of [the additional Riders Republic reference](https://www.youtube.com/watch?v=Zwf8svpX__E)
establishes the new composition: a close orange cliff on the left and a deep,
forested valley on the right. Native terrain spans 2.9 km across and contains
an opposite rim, wooded talus, alluvial terraces and a winding river roughly
500 m below the trail. Geometric shelves and undercuts provide actual relief
in the close sandstone face. This section uses the same MIT RockGenerator
noise, shared CC0 mineral maps and existing tree/plant library as the canyon.

The complete 886,856-triangle landscape is baked into 84 fixed spatial cells
(28.3 MB of source GLBs). Native detail remains unchanged in every view;
there are no distance mesh swaps. Terrain, silhouettes and shadows share these
meshes. The riding surface, shoulder contact and continuous cliff-fall recovery
use ordinary source-owned mesh components. Original terrain/foliage extents
remain anchored to the old route length so appending the vista does not
redistribute its seeded planting. The final gate follows the new descent.

## Authoring and review

- `node tools/desert-canyon/build-vista.mjs` rebuilds the complete valley cells
  and their bounds, hashes and catalog without simplification.
- `node tools/desert-canyon/build-rocks.mjs` rebuilds seeded rock assets.
- `python tools/desert-canyon/shape-library-pine.py` (with Pillow installed)
  rebuilds the pine from the existing library mesh and writes its provenance.
- `node tools/desert-canyon/build-survey.mjs <detailed.glb>` rebuilds the scenic
  elevation asset and byte-verifies every losslessly compressed buffer.
- `node tools/desert-canyon/validate.mjs` checks route support, checkpoints,
  finish access, shared texture ownership and rock budgets.
- Local review: `/tools/desert-canyon/review.html?playtest&level=bryce-canyon&launchReview&nocrt`.
  Use the location selector, normal/MAX resolution, gameplay/wide/right-valley camera and
  native-input traversal. `nocrt` isolates the scene's surfaces and lighting;
  omitting it reviews the game's normal CRT presentation.
- Published play: `/?level=bryce-canyon&playtest&nocrt`.
- To save a review PNG directly into `docs/desert-canyon`, run
  `node tools/desert-canyon/capture-server.mjs opening` (or `vista` / `basin` / `finish`), add `&capture` to the local
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
