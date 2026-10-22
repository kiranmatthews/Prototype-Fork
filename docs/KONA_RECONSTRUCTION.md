# Kona PS1 reconstruction

The source-owned `kona` level recreates the Kona layout in the supplied THPS4 **PS1** VGCartography overview. Select **Kona · PS1** in MENU, or open `/?playtest&level=kona`. K/L move between five supported checkpoints.

The initial image-traced version was replaced after a geometric survey became available. `src/levels/kona-survey.json` preserves 163 surface groups and 97 connected grind paths from the publicly shared [PS1 Kona conversion](https://thpsgoat.com/mods/item-info?item=360), credited in its metadata to **tyler.thpsX** and uploaded by **TonyGourmand**. The collision reader was checked against the published [THPS scene importer](https://github.com/denetii/io_thps_scene/blob/main/import_thug2.py). Original archive files, textures, scripts, character assets, audio and sky geometry are not included. The survey is derived third-party geometry data, not a claim of ownership of the original game assets; this iteration remains local.

![Original survey overview; the playable park is now uniformly twice this first-pass scale](art-reviews/kona-overview.png)

## Scale and geometry

One uniform scale, **0.025 world metres per surveyed unit**, makes the entire park **2× larger than the first reconstruction** following the user's skater-relative scale feedback. The first pass over-relied on collision-capsule height; the visible skater needed more room. All axes, grind paths, checkpoints and camera positions scale together. Movement tuning and character size remain unchanged. Coordinates are rotated into Three.js Y-up space.

| Feature | Authored metric measurement |
| --- | ---: |
| Low street rail | 1.236 m above the street |
| Mini transition curve | 2.788 m rise |
| Mini extension / long quarter height | 4.544 m |
| Timber transition lips | 6.866–7.622 m |
| Raised timber roll-in | 10.412 m |
| Tombstone principal rim | 6.056 m above street datum |
| Tombstone extension | 9.900 m above street datum |
| Lower kidney's lowest floor | −1.834 m relative to street datum |

Every measured control vertex is retained. Curved concrete receives two tangent subdivision passes; rectangular architecture stays sharp. The straight pipes refine in their cross-section plane, avoiding lateral steering noise. Bowls, the snake run, graded paths and terraces use their own connected floor geometry, without a covering foundation. Existing native components provide checkpoint, gate, camera-node and arrival-zone behavior. Materials reproduce the broad reference palette; the original texture art and career-goal overlays are outside this geometry iteration.

The small shared-toolkit changes let authored `mesh` vert surfaces use existing transition contact, landing and coping drop-in behavior. Explicit `rail.coping` survives save/load and geometric capture. A shallow authored transition can pass its own coping without being treated as an ordinary street-bar collision. Ordinary elevated rails remain solid. No values in `src/tuning.ts` changed.

The collision correction separates hard ramp backs, end caps and perimeter faces from rideable vert surfaces. Ground raycasts alone cannot block horizontal motion through a vertical mesh, so those source faces also generate native two-sided `wallpath` colliders. Source VERT flags preserve the actual riding face. Straight-pipe subdivision now preserves a vertical lip tangent instead of averaging it with the flat deck; the old average curled the last section into a bank and let the rider drive out over the lip. Support probes use the same refined triangles as the runtime.

## Verification

The scale/collision follow-up adds `tools/test-kona-collision.mjs`: 25 wall approaches (23 reach physical contact), including the perimeter, mini backs and timber structure; twelve straight/angled, charged/uncharged pipe approaches; no wall crossing or bail, all pipe approaches return inside, and maximum measured feet penetration below 0.000005 m. All three pipes also pass four consecutive charged airs and landings. Both directions of the enlarged snake run remain traversable. The local `tools/kona-collision-review.html` page runs the production game with visible reports and shares its input controller with the automated browser test. The final full-render browser pass also verifies the adjacent-mini transfer, street line, grind, snake run, fall recovery and finish gate with zero console errors. At the corrected scale, the street line uses an ollie onto the first raised lip, then a second ollie to the catcher, holding grind on descent across its coping. Detailed correction results are in `docs/performance/kona-collision.json`.

The correction took approximately 39 minutes from the bug report to the verified full-render pass.

The following records describe the initial reconstruction; the correction report above and the new browser results distinguish what has been repeated at 2× scale:

- `tools/test-kona.mjs`: editor normalization, component/aggregate mesh limits, all recessed bowl floors, sampled snake support, mounted spawn, all checkpoints, authored vert tags, coping persistence and ordinary-rail collision.
- `KONA_STRICT=1 node tools/kona-pilot.mjs`: snake both directions and four consecutive airs/landings in each mini and the timber vert, using production Player input only after initial placement.
- `KONA_BOWLS=1 KONA_STRICT=1 node tools/kona-pilot.mjs`: two clean airs and landings from each bowl route.
- `tools/kona-browser-playtest.mjs`: actual menu selection and K/L controls; continuous snake traversal; four mini airs; transfer into the adjacent mini; charged north-kicker to south-catcher jump with zero lateral error; a complete street grind; fall recovery to the saved checkpoint; finish gate. All successful traversal cases remain mounted and have zero bails or deaths.
- Full-render Chrome review and the same kicker landing pass with no console errors. `tools/kona-browser-review.mjs` saves player, overview and feature views.
- `check:levels`, TypeScript and production Vite build pass. Existing rail opt-out, 48-air Blockworks vert and waterpark vert checks pass.

The isolated task-only snapshot on committed base `79cdcdc0` also passes TypeScript, the structural test and both strict input-pilot modes. This verifies the reconstruction without relying on concurrent uncommitted level or player work.

The broader `test-vert-ollie-sequence.mjs` currently fails its board-stow/slam assertion at line 546. Repeating it with **all Kona Player changes removed in a Vite load override** reproduces the same failure (line 547 in the temporary test, due to the inserted override). It is not a Kona regression; the temporary test was removed after diagnosis. The full test suite was not run.

The first image-traced playable was available about 14 minutes after the prompt. Measurement correction and gameplay/visual verification took approximately 100 minutes including independent commit validation. No remote transfer, deployment or publication was performed.
