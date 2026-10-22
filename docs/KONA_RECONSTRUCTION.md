# Kona PS1 reconstruction

The source-owned `kona` level recreates the Kona layout in the supplied THPS4 **PS1** VGCartography overview. Select **Kona · PS1** in MENU, or open `/?playtest&level=kona`. K/L move between five supported checkpoints.

The initial image-traced version was replaced after a geometric survey became available. `src/levels/kona-survey.json` preserves 163 surface groups and 97 connected grind paths from the publicly shared [PS1 Kona conversion](https://thpsgoat.com/mods/item-info?item=360), credited in its metadata to **tyler.thpsX** and uploaded by **TonyGourmand**. The collision reader was checked against the published [THPS scene importer](https://github.com/denetii/io_thps_scene/blob/main/import_thug2.py). Original archive files, textures, scripts, character assets, audio and sky geometry are not included. The survey is derived third-party geometry data, not a claim of ownership of the original game assets; this iteration remains local.

![Full-render Kona overview](art-reviews/kona-overview.png)

## Scale and geometry

One uniform scale, **0.0125 world metres per surveyed unit**, adapts the layout to this prototype's smaller skater. There is no independent stretching of axes or change to movement tuning. Coordinates are rotated into Three.js Y-up space. The native standing collision calibration remains 0.92 m, with its existing character-proportion adjustments.

| Feature | Authored metric measurement |
| --- | ---: |
| Low street rail | 0.618 m above the street |
| Mini transition curve | 1.394 m rise |
| Mini extension / long quarter height | 2.272 m |
| Timber transition lips | 3.433–3.811 m |
| Raised timber roll-in | 5.206 m |
| Tombstone principal rim | 3.028 m above street datum |
| Tombstone extension | 4.950 m above street datum |
| Lower kidney's lowest floor | −0.917 m relative to street datum |

Every measured control vertex is retained. Curved concrete receives two tangent subdivision passes; rectangular architecture stays sharp. The straight pipes refine in their cross-section plane, avoiding lateral steering noise. Bowls, the snake run, graded paths and terraces use their own connected floor geometry, without a covering foundation. Existing native components provide checkpoint, gate, camera-node and arrival-zone behavior. Materials reproduce the broad reference palette; the original texture art and career-goal overlays are outside this geometry iteration.

The small shared-toolkit changes let authored `mesh` vert surfaces use existing transition contact, landing and coping drop-in behavior. Explicit `rail.coping` survives save/load and geometric capture. A shallow authored transition can pass its own coping without being treated as an ordinary street-bar collision. Ordinary elevated rails remain solid. No values in `src/tuning.ts` changed.

## Verification

- `tools/test-kona.mjs`: editor normalization, component/aggregate mesh limits, all recessed bowl floors, sampled snake support, mounted spawn, all checkpoints, authored vert tags, coping persistence and ordinary-rail collision.
- `KONA_STRICT=1 node tools/kona-pilot.mjs`: snake both directions and four consecutive airs/landings in each mini and the timber vert, using production Player input only after initial placement.
- `KONA_BOWLS=1 KONA_STRICT=1 node tools/kona-pilot.mjs`: two clean airs and landings from each bowl route.
- `tools/kona-browser-playtest.mjs`: actual menu selection and K/L controls; continuous snake traversal; four mini airs; transfer into the adjacent mini; charged north-kicker to south-catcher jump with zero lateral error; a complete street grind; fall recovery to the saved checkpoint; finish gate. All successful traversal cases remain mounted and have zero bails or deaths.
- Full-render Chrome review and the same kicker landing pass with no console errors. `tools/kona-browser-review.mjs` saves player, overview and feature views.
- `check:levels`, TypeScript and production Vite build pass. Existing rail opt-out, 48-air Blockworks vert and waterpark vert checks pass.

The isolated task-only snapshot on committed base `79cdcdc0` also passes TypeScript, the structural test and both strict input-pilot modes. This verifies the reconstruction without relying on concurrent uncommitted level or player work.

The broader `test-vert-ollie-sequence.mjs` currently fails its board-stow/slam assertion at line 546. Repeating it with **all Kona Player changes removed in a Vite load override** reproduces the same failure (line 547 in the temporary test, due to the inserted override). It is not a Kona regression; the temporary test was removed after diagnosis. The full test suite was not run.

The first image-traced playable was available about 14 minutes after the prompt. Measurement correction and gameplay/visual verification took approximately 100 minutes including independent commit validation. No remote transfer, deployment or publication was performed.
