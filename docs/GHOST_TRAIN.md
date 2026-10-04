# Castle Ghost Train

A source-owned indoor ride inspired by Scooby-Doo Spooky Island. The course
spans 2,250 authored metres, with about 2.45km of travel in the complete pilot.
Its 28 chambers form eight chapters, with real climbs and descents from −4 m to
+10 m, 16 checkpoints, 16 moving carriages, 10 swinging axes and 15 mechanical
food/armour enemies. The ordinary movement tuning remains unchanged.

Open `/?playtest&level=ghost-train` for the complete renderer; add `&lite` for
fast section checks. The level is registered as `ghost-train` and is available
through the developer level menu. Its source is `src/levels/ghost-train.ts`.

The Island Map and Level Select expose **Ghost Train** in **Hidden Shores**.
On the map, travel down from The Bone Yard to its branch. It is available on
fresh saves, uses an actual banquet-chamber preview, and keeps existing saved
hub identities in their original order.

## Art direction

[Original production artwork and attraction imagery](GHOST_TRAIN_REFERENCES.md)
guide irregular castle silhouettes, insect-wing leadlight, monstrous portals,
clawed banquet furniture and saturated theatrical lighting. Three original
ImageGen chamber mockups are saved in `docs/ghost-train-concepts`; they are
concepts, not gameplay screenshots. Exact prompts and input references are
recorded in `prompts.json`.

Models and their textures are actual low-poly Meshy generations. The original
five models are joined by nine new generations: carved window bay, feast table,
skull axe, bronze chandelier, broken trestle, monster-mouth portal, clockwork
machine, flagstones and a demon-front car. The nine main models total 29,362
triangles and approximately 2.95MB. Their 145-credit generation/texture ledger,
provenance, bounds, original UV hashes and measured functional planes are in
`tools/ghost-train-assets-v2`.

The new 1,396-triangle demon mask is combined with the original open-car body
and four original wheel regions. Uniform fitting preserves their proportions.
Wall, floor and timber materials use actual Meshy albedo reprojected through
original UVs. ImageGen imagery is not used as a runtime surface texture.

`src/levels/ghost-train-show-scenes.ts` composes the boarding/axe reveal,
banquet theatre and hanging-rail crypt around the mockups. Invisible simple
collision masses match the visible furniture and native supported paths.
Static scenery is instanced in 40 m cells. `src/ghostTrain.ts` owns asset loading,
mechanical animation and a stable spotlight pool; `src/ghostClockwork.ts` uses
the actual measured gear, pulley and counterweight parts.

## Validation

- `tools/test-ghost-train.mjs`: source normalization, supported spawn and
  checkpoints, patrol support, actual carriage carry, checkpoint contact,
  broken-track death/respawn and the finish gate.
- `tools/test-ghost-train-articulation.mjs`: actual model triangles/UVs,
  independent armour/food articulation, planted feet, exact car wheels,
  measured clock motion, uniform static placement and GPU resource disposal.
- `tools/ghost-train-pilot.mjs --journey`: continuous production input from
  supported spawn through every chapter and all 16 checkpoints to the finish.
  The final run lasts 409.35 seconds, travels 2,447.43 m and finishes with zero
  deaths; its largest fixed-step displacement is 0.739 m. Twenty-one focused
  phase cases cover 36 carriage landings, seven native broken-rail catches,
  three axe timings and three floor jumps, with zero deaths.
- `tools/ghost-train-gameplay-browser.mjs`: three actual Chrome input pilots
  verify all four car supports in the first convoy, all three long-crypt rail
  catches and execution-axe timing, with full-render endpoint captures and
  no console errors.
- `tools/ghost-train-v2-browser.mjs`: eight authored flagship gameplay views,
  asset/material readiness, real camera framing, lighting, render counters
  and console checks. Capture artifacts are kept separate from concept art.

The final browser and publication evidence accompanies the level iteration
record. A scene's green test result does not substitute for visual review.

The first complete preview using all Meshy models took approximately 2.5 hours;
geometry, lighting and release verification followed. This is an authoring
record, not a timed benchmark. Final validation is recorded in
`docs/ghost-train-evidence/final-validation.json`.

The follow-up map integration widens the bounded world-map horizontal coordinates to
include Hidden Shores. This also resolves the earlier legacy-map migration
failure reproduced on `fccf04e`. The focused editor-security check now passes
180 cases, including old default maps, custom hub positions and current-map
round trips.
