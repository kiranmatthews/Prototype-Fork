# No-Man’s Grove — ten minefields

The current source-owned course is a 1,314 m nighttime jungle route. It begins inside the reused Hollowwake rock bore, emerges into ten minefields separated by supply camps, then descends through another fire-lit tunnel to the extraction gate. The entrance begins about 33 m underground, with 142 m of tunnel ahead, a narrower 5.8 m bore radius, a rounded climb reaching about 18° and sealed rock behind the camera. Travel is forward, away from the camera; there is no boulder. Play `/?playtest&level=jungle-minefield` or select **No-Man’s Grove** in the developer menu.

There are **3,401 concealed charges**. The soil never reveals safe regions. The brown canvas clues use black circles/rails and red Xs; read each from its bottom (approach) toward its top (far camp). Low, angled displays sit in cleared pockets on the left camp verge, eighteen metres before most fields (fifty metres before the speed jump), so they leave the field view open. Every start and end is framed by two tall torches and a bright cardboard band across the whole path. The band sits on the safe camp side, with a dark inner edge aligned exactly to the minefield boundary. Most bands are 2.4 m deep; the jump entrance uses the 0.8 m of flat soil available beyond its ramp lip. Foliage is recessed around these markers. They reveal the field limits, never its safe route.

| Field | Crossing | Clue / checkpoint |
| --- | --- | --- |
| 1 | Two banks of three rails, raised 1.65 m; near-left and far-middle are safe. Floor and the other four rails trigger the field. | Six-rail diagram |
| 2 | Five isolated safe foot spots; every other ground position triggers the field. | Five circles |
| 3 | One winding rail, with no safe ground. | Curved line; checkpoint afterward |
| 4 | Five foot spots. | Lower half torn away; only the final spots are shown |
| 5 | Four columns by ten rows of flush cardboard. Some safe cells contain TNT. | Matching grid; floor has no Xs or circles |
| 6 | 120 m straight crossing in the second column from the left. A wandering cardboard trail is a decoy. | X O X X; checkpoint afterward |
| 7 | 18 m jump from a full-width natural earth rise. Build ordinary top speed and time the jump near the lip; no boost pad. | Partly torn large X; checkpoint afterward |
| 8 | Hidden foot spots. | Rag torn away; checkpoint afterward |
| 9 | Blank cardboard grid, with a Nitro hazard. | Rag torn away; checkpoint afterward |
| 10 | Blank cardboard grid with concealed safe cells and TNT debris; no rail. | Rag torn away |

Refuges span **64 m**, with **96 m before field 7** to allow an ordinary top-speed run-up. The first 28 m are clear for landing and braking; supplies sit 29 m and 35 m after the previous field, with the shelter and any checkpoint around 32 m. The clue comes afterward, 46 m into the refuge, leaving a separate 18 m approach to the next field. Before field 7 the clue stays after the base, with a 50 m run-up to the field and a 12 m-long, 1.3 m-high earth ramp spanning the whole 12 m path. The entrance and exit refuges use the standard 64 m spacing. Foliage is recessed around the base and clue, and the shelter sits to the right of the path through the boxes.

Fields 8–10 reuse established mechanics with the route information missing. Safe camps contain native supply crates and alternating life/mystery provisions. The five checkpoints follow fields **3, 6, 7, 8 and 9**. An optional clock sits off the line in the entrance tunnel; the crystal is in the exit tunnel. Jump onto the native finish warp pad to complete the course.

## Rules and authoring

`src/levels/jungle-minefield.ts` owns the geometry, hidden safe regions, trapped rails, ordered forward camera nodes and checkpoint placement. `src/minefields.ts` implements field-wide pressure and explosion state. The shared Level/Player integration is limited to validation, capture, reset, explosive events and native blast death. Movement tuning is unchanged.

Unsafe ground contact or touching a trapped rail detonates every charge in that field. TNT and Nitro explosions within a field trigger it regardless of proximity to a mine, including otherwise safe explosive interactions. The blast reaches across the field, leaving adjacent camps outside its bounds. Fields rearm on respawn. Mines have no rendered idle objects; the detonation starts with a full-size burst at the actual ground, rail or explosive contact, then samples smaller bursts across the whole field. Local effects are emitted first so distant mines cannot exhaust the shared particle pool before the trigger is shown. Existing concealed native Nitro crates retain their earlier behavior and regression coverage.

All seven rails have matching metal legs at both ends, sunk 2.5 cm into the soil. The continuous ground is authored before the rails so the existing rail artwork can measure its support height during construction; the grind paths and trap rules are unchanged.

The cardboard cells and decoy sheets are visual, flush overlays. They do not create safe collision platforms or grind edges. The continuous soil and enclosed tunnel bore have documented edge-policy exceptions; the launch rise uses the existing continuous terrain surface with soil closing its front face.

## Generated artwork

- **Built-in ImageGen** produced all ten transparent canvas rags. Final 512×768 WebPs are in `public/grove/clue-1.webp` through `clue-10.webp`. Exact prompts and original filenames are saved in `public/grove/clue-prompts.json`. Packing preserved the generated alpha and markings. The grid artwork was visually checked against all 40 authored cells.
- **Meshy** produced the ragged bamboo/canvas checkpoint shelter, reused at each camp. The packed GLB is `public/grove/checkpoint-camp.glb` (430 kB, original UVs, textures limited to 1024). The prompt, completed task ledger and provenance live in `tools/grove-assets/` and `public/grove/checkpoint-provenance.json`. Preview and texture stages consumed 15 credits total.
- Existing local jungle and Hollowwake assets provide the surrounding environment. New runtime art totals about 1.7 MB. Generation used text prompts; the user's photograph was not uploaded.

## Local validation

Run these from the repository root with the installed local Node runtime:

```sh
node tools/test-jungle-minefield.mjs
node tools/test-grove-traversal.mjs
node tools/test-grove-camps.mjs
node tools/test-grove-ramp.mjs
node tools/test-grove-approach-browser.mjs http://127.0.0.1:5259
node tools/test-jungle-minefield-browser.mjs http://127.0.0.1:5259 --camps --fields=7,10
node tools/test-jungle-minefield-browser.mjs http://127.0.0.1:5259 --camps --full
npm run check:levels
npm run build
```

The browser test accepts `PLAYWRIGHT_MODULE` for a cached external Playwright installation. The traversal test writes reproducible native input sequences to `/private/tmp/grove-traversal/`; run it before the camp and browser tests. The camp check continues fields 1, 3 and 7 with a half-second reaction delay, braking to rest, both supply pickups, any checkpoint, a pause at the clue and a forward run to the next approach. Those input sequences live in `/private/tmp/grove-camps/`. Browser reports and screenshots are written to `/private/tmp/grove-browser/`.

The tests prove each field independently from its approach, using real movement inputs and no physics/tuning substitutions. The three extended camp routes stop 15.1–26.9 m beyond the previous field, before the first supply crate at 29 m; they preserve a continuous field-to-refuge-to-next-approach journey. They also cover supported tunnel traversal, native checkpoint activation, deliberate pressure death and rearming, native pit recovery, support at all five checkpoints, and the descending exit/finish. These are section-by-section proofs, not a claim of a single uninterrupted expert run. The ramp test also verifies the full width at x = −4.5, 0 and 4.5 m: a correctly timed jump at 22.89 m/s clears with no artificial speed, while an early jump, a short run-up and rolling off without jumping detonate field 7. The retained report is `ten-fields-validation.json`. The focused approach review checks clue screen bounds and confirms live blast particles at the exact player contact; its screenshots are `/private/tmp/grove-revision-*.png`. The required level checks, focused edge audit and production build were run; the full suite was not requested.

The later boundary-marking review is recorded separately in `boundary-marking-validation.json`: all twenty boundaries in lite/full views, plus native-input browser routes through fields 1, 7 and 10, camp stops, checkpoint recovery and the finish. The earlier all-ten-field report remains the gameplay baseline; mine regions and solid geometry are unchanged.

All changes and evidence are local under the temporary slow-network workflow. No push or deployment was performed.

## Earlier version

`validation.json`, `jungle.png` and `blast.png` document the superseded 252 m / 1,039-mine winding-trail version from 18 October. They are historical evidence, not results for the ten-field layout.
