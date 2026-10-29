# Mayfield Mall — 29 October 2026

An original 800 m, forward (-Z) conventional level in Maynard Quay's fourth
slot. The campaign progress key remains `maynard-course-4`; its playable level
and preview IDs are `mayfield-mall`. Starts on foot, with normal walking,
jumping, mounting, braking and grinding. No park controller, reference-game
calibration, collectathon, race, compulsory board, or global tuning changes.

The six spaces are the Galleria, Food + Friends, Palm Court, Loading Hall,
Kona Gardens and Sunset Walk. Six checkpoints, two short gaps, 26 crates,
a crystal, time-trial clock and one finish gate support a conventional run.
Gold/silver/bronze targets are 55/80/115 seconds.

## Source composition and original layout

- **Mall:** rebuilt concourse, paired escalator ascent, fountain bypass, shop
  fronts and relocated directory meshes. The old stacked U-turns, flying leap,
  wall layout and source camera path are absent. The new climb is 3.6 m over
  38 m; the main passages are 26–34 m wide.
- **School Miami:** complete table/bench assemblies at 67% of their playable
  source size, rearranged into a food court, plus a descending promenade and
  narrow footbridge. The campus, pools and gym footprint are not copied.
- **Warehouse:** existing native bank/island/steelwork helpers underpin a new
  loading hall. A 12 m dock points along the course, with a 4.5 m gap and long
  runout; separate plywood quarters leave the main aisle clear.
- **Kona:** the complete kiosk mesh is relocated and resized. Disconnected
  bowls become an 84 m open-ended promenade with a 12 m flat middle, smooth
  2.4 m transitions and walkable side decks reached through shallow ramps.

Disney's *The Weekenders* inspired the cream, teal, mauve and coral mall,
food-court hangout, slush counter, record/shoe shops and arcade. This is an
original mall design; no show imagery is shipped. Reference context:
[series/setting overview](https://www.imdb.com/title/tt0237987/plotsummary/).
All selected source triangles remain present. Scenery is batched by room and
colour, with no distance-based geometry substitutions.

## Collision corrections

The initial Kona deck slab's side collider caught the capsule at x = ±8.07 m
before the quarter's real lip. Removed that overlapping slab: the swept
transition now owns the complete deck and its outer skirt. Both sides at two
stations climb, air and return without bailing. The warehouse quarters do too.
Narrow floor strips outside the Kona deck are closed; both raised routes are
walkable from their entrance ramps to the next area. The kiosk and planters
sit clear of those routes. Escalator flanks and dock margins have solid,
continuous support. Trim, treads, lettering and steel trusses are visual only;
ordinary platforms and roads retain their normal grindable edges.

## Validation

- First supported browser play: **8 min 31 sec** after the prompt.
- First continuous, death-free finish: **10 min 11 sec** after the prompt.
- Native production player: 89.68 s on foot, 33.75 s on the board; both gaps,
  all six checkpoints, crystal and finish reached through input only.
- Six side-transition rides: no bail or death; peak height 3.96 m in the
  warehouse and 6.67 m at Kona; maximum per-step displacement below 0.53 m.
- Both raised Kona walking routes reach the exit without a snag.
- Chrome lite skateboard run: 33.58 s, no deaths or console errors.
- Production Chrome full-render walking run: **89.52 s**, both jumps, all
  six checkpoints and the crystal, actual menu selection and finish; no deaths
  or console errors. Global tuning was unchanged.
- Full rendering at 1920×1080 MAX/native: all six checkpoints, real K/L
  controls and a deliberate fall/respawn. One life spent; supported recovery
  at the saved checkpoint. Source data matched the browser registry exactly.
- Focused campaign/save-key and editor-format checks; full required
  `check:levels` script passed. Production type-check/build and hosting-size
  check passed: **997,207,888 / 1,000,000,000 bytes**, including the course preview.
  Public deployment is verified after the commit is published.

Run focused checks with `node tools/test-mayfield-mall.mjs` (add `--skate`),
`node tools/test-mayfield-transitions.mjs`, and
`node tools/mayfield-browser.mjs [URL]` (add `--full --foot` or `--native --tour`).
The browser script accepts `PLAYWRIGHT_MODULE` and `MAYFIELD_OUTPUT`.

## Ownership and release

Geometry lives in `src/levels/mayfield-mall.ts`; the only shared runtime-file
change is its import and builtin registration in `src/level.ts`.
`src/campaign.ts` assigns the existing slot and preserves its save key.
The campaign test is updated for one fewer placeholder and one more course.
The original four source courses and `src/tuning.ts` remain unchanged.

The source-only registry path is deliberate: duplicating the complete 1.5 MB
editor export in `public/levels.json` pushed its existing archive over the
64 MiB inspection bound. The builtin is directly editable/exportable and
restorable in the game; no archive limit or geometry detail was reduced.
`public/levels.json` and existing snapshot certificates remain unchanged.
