# No-Man’s Grove — ten minefields

The current source-owned course is a 690 m nighttime jungle route. It begins inside the reused Hollowwake rock bore, emerges into ten minefields separated by supply camps, then descends through another fire-lit tunnel to the extraction gate. Travel is forward, away from the camera; there is no boulder. Play `/?playtest&level=jungle-minefield` or select **No-Man’s Grove** in the developer menu.

There are **3,554 concealed charges**. The soil never reveals safe regions. The brown canvas clues use black circles/rails and red Xs; read each from its bottom (approach) toward its top (far camp). The timber strips mark the beginning and end of a field, without revealing its safe route.

| Field | Crossing | Clue / checkpoint |
| --- | --- | --- |
| 1 | Two banks of three rails; near-left and far-middle are safe. Floor and the other four rails trigger the field. | Six-rail diagram |
| 2 | Five isolated safe foot spots; every other ground position triggers the field. | Five circles |
| 3 | One winding rail, with no safe ground. | Curved line; checkpoint afterward |
| 4 | Five foot spots. | Lower half torn away; only the final spots are shown |
| 5 | Four columns by ten rows of flush cardboard. Some safe cells contain TNT. | Matching grid; floor has no Xs or circles |
| 6 | 120 m straight crossing in the second column from the left. A wandering cardboard trail is a decoy. | X O X X; checkpoint afterward |
| 7 | 18 m jump, with a boost and rising launch ramp in the preceding camp. | Partly torn large X; checkpoint afterward |
| 8 | Hidden foot spots. | Rag torn away; checkpoint afterward |
| 9 | Blank cardboard grid, with a Nitro hazard. | Rag torn away; checkpoint afterward |
| 10 | Final winding grind. | Rag torn away |

Fields 8–10 reuse established mechanics with the route information missing. Safe camps contain native supply crates and alternating life/mystery provisions. The five checkpoints follow fields **3, 6, 7, 8 and 9**. An optional clock sits off the line in the entrance tunnel; the crystal is in the exit tunnel. Jump onto the native finish warp pad to complete the course.

## Rules and authoring

`src/levels/jungle-minefield.ts` owns the geometry, hidden safe regions, trapped rails, ordered forward camera nodes and checkpoint placement. `src/minefields.ts` implements field-wide pressure and explosion state. The shared Level/Player integration is limited to validation, capture, reset, explosive events and native blast death. Movement tuning is unchanged.

Unsafe ground contact or touching a trapped rail detonates every charge in that field. TNT and Nitro explosions within a field trigger it regardless of proximity to a mine, including otherwise safe explosive interactions. The blast reaches across the field, leaving adjacent camps outside its bounds. Fields rearm on respawn. Mines have no rendered idle objects; the detonation samples soil bursts across the whole field to avoid thousands of mesh allocations. Existing concealed native Nitro crates retain their earlier behavior and regression coverage.

The cardboard cells and decoy sheets are visual, flush overlays. They do not create safe collision platforms or grind edges. The continuous soil and enclosed tunnel bore have documented edge-policy exceptions; the jump ramp retains its native exposed edges.

## Generated artwork

- **Built-in ImageGen** produced all ten transparent canvas rags. Final 512×768 WebPs are in `public/grove/clue-1.webp` through `clue-10.webp`. Exact prompts and original filenames are saved in `public/grove/clue-prompts.json`. Packing preserved the generated alpha and markings. The grid artwork was visually checked against all 40 authored cells.
- **Meshy** produced the ragged bamboo/canvas checkpoint shelter, reused at each camp. The packed GLB is `public/grove/checkpoint-camp.glb` (430 kB, original UVs, textures limited to 1024). The prompt, completed task ledger and provenance live in `tools/grove-assets/` and `public/grove/checkpoint-provenance.json`. Preview and texture stages consumed 15 credits total.
- Existing local jungle and Hollowwake assets provide the surrounding environment. New runtime art totals about 1.7 MB. Generation used text prompts; the user's photograph was not uploaded.

## Local validation

Run these from the repository root with the installed local Node runtime:

```sh
node tools/test-jungle-minefield.mjs
node tools/test-grove-traversal.mjs
node tools/test-jungle-minefield-browser.mjs http://127.0.0.1:5259
node tools/test-jungle-minefield-browser.mjs http://127.0.0.1:5259 --full
npm run check:levels
npm run build
```

The browser test accepts `PLAYWRIGHT_MODULE` for a cached external Playwright installation. The traversal test writes reproducible native input sequences to `/private/tmp/grove-traversal/`; run it before the browser test. Browser reports and screenshots are written to `/private/tmp/grove-browser/`.

The tests prove each field independently from its approach, using real movement inputs and no physics/tuning substitutions. They also cover supported tunnel traversal, native checkpoint activation, deliberate pressure death and rearming, native pit recovery, support at all five checkpoints, and the descending exit/finish. These are section-by-section proofs, not a claim of a single uninterrupted expert run. The retained report is `ten-fields-validation.json`. The required level checks, focused edge audit and production build were run; the full suite was not requested.

All changes and evidence are local under the temporary slow-network workflow. No push or deployment was performed.

## Earlier version

`validation.json`, `jungle.png` and `blast.png` document the superseded 252 m / 1,039-mine winding-trail version from 18 October. They are historical evidence, not results for the ten-field layout.
