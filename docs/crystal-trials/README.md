# Numbered skating challenges

[Play on your phone](https://kiranmatthews.github.io/Prototype-Fork/challenge-playtest.html?touch).

Each of the 25 challenges is a continuous skating sequence with one starting checkpoint and one final crystal. Three to five linked sections require repeated ollies, catches, transfers, landings, carving or vert pumps. The later runs combine switches, timed or crumbling surfaces, moving rails, Nitro clearances and airborne bounce rows.

Bank airs can land directly into grinds. Bounce chains feed elevated rails. Raised receiving roofs preserve the height earned in the previous section, so approaching the final crystal from the recovery floor cannot replace the intended sequence. The ordinary edges remain grindable. The authored player, movement tuning and animation baseline are unchanged.

The source modules remain independently reusable. The whole course lays them in a straight corridor, with at least 512 metres between starts and longer spacing for the longer sequences. There are 224 metres between one trial's local exit and the next origin, leaving a clear run into the next approach. A flat floor 8 metres below the first approach catches ordinary misses; marked dark pits cause death. A wide side bank returns a missed run to its start. The course exit opens only after all 25 crystals. These practice rewards do not alter campaign progress.

| Number | Components |
|---|---|
| 1 | Bank air → long grind → raised roof gap. |
| 2 | Bank air → rope grind → moving roof → gap. |
| 3 | Long balance → two rail transfers → bank air. |
| 4 | Moving roof gaps → enemy carve → bank-to-rail air. |
| 5 | Bank-to-rail air → transfers → high vert crystal. |
| 6 | Rope air → spring and bounce row → high grind → roof gap. |
| 7 | Timed roof gap → rail transfers → enemy carve and bank. |
| 8 | Switch grind → roof gap → rope transfer → Nitro-framed air. |
| 9 | Enemy carve → moving roof gaps → grind and kickflip gate. |
| 10 | Bridge airs → rail catch → enemy carve → spring and bounce row. |
| 11 | Rail transfers → switch roof → high grind → Nitro gap. |
| 12 | Spring and bounce row → moving high rail → kickflip gap. |
| 13 | Rope transfer → two rail transfers → moving roof gaps. |
| 14 | Timed roof gaps → moving grind → switch roof and high rail. |
| 15 | TNT-framed switch grind → enemy carve → rail catch and kickflip. |
| 16 | Nitro gap → spring and bounce row → high rail transfers. |
| 17 | Grind and enemy carve → rope transfer → bridge airs → roof gap. |
| 18 | Moving grind → moving roof gaps → rail transfers → kickflip. |
| 19 | Crumbling gaps → switch roof → high grind → spring and bounce row. |
| 20 | Two switch grinds → rope transfer → Nitro air → rail and kickflip. |
| 21 | Kickflip to rail → transfers → enemy carve → switch bank and high grind. |
| 22 | Rope and timed gap → bounce-to-rail → enemy carve → bridge airs. |
| 23 | Switch roof and high grind → moving rail → rope transfer → Nitro gap. |
| 24 | Rail transfers and carve → crumbling gaps → bounce-to-rail → kickflip. |
| 25 | Switch and Nitro kickflip → timed gap → rope transfer → enemy carve → high grind → bounce row. |

The previous platforming collection is preserved as rejects `01-p`–`25-p`; the short skating studies are `01-s`–`25-s`. There are 75 rejected attempts plus the original eight-station grid, all selectable from the same phone page. [Rejects index](rejects/README.md).

The phone entry downloads this collection and its rejects on Play, with touch controls, retry, individual selection and whole-course selection. It does not fetch the shared level pack or install the full game's offline cache. The live page transferred **34.7 MB** with caching disabled; its picker loaded **27.3 KB** before Play. [Public phone measurement](sequences/phone-public/smoke.json).

**All 25 challenges pass native and phone controller routes.** The continuous course and full-render routes through 5 and 25 also pass. All 25 have been visually reviewed at native 1280 × 720 resolution. The public deployment is verified with clean consoles.

Current validation and measurements are in [progress.json](progress.json) and [sequences/](sequences/README.md). The numbered evidence directories, `course/`, `phone-public/` and `public/` at this directory's root describe the superseded platforming release; its original progress record is preserved in [platforming-version/progress.json](platforming-version/progress.json).

To verify the current geometry:

```sh
CRYSTAL_SKATE_OUT=/tmp/crystal-sequences node tools/test-crystal-skate.mjs 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25
CRYSTAL_SKATE_OUT=/tmp/crystal-sequences node tools/test-crystal-skate-course.mjs
node tools/test-crystal-skate-recovery.mjs
node tools/test-crystal-trials.mjs 25
CRYSTAL_SKATE_OUT=/tmp/crystal-sequences python3 tools/review-crystal-skate.py
CRYSTAL_PHONE_TRIALS=1,3,5,13,16,21,25 python3 tools/crystal-trials-phone.py
CRYSTAL_PHONE_URL=PRODUCTION_URL python3 tools/test-challenge-phone.py
```

The native pilots supply controller inputs to the production Player and Level; browser pilots use the application's ordinary fixed-step loop. They do not change movement, position, velocity or pickup state to complete a route. Visual fixtures are explicitly staged and separate from traversal evidence. Full-render screenshots use native 1280 × 720 output. The historical `test-crystal-trials-course.mjs` and platforming pilot modules document the prior collection.

Design references: [THPS research](../warehouse-flow/research-principles.md) and the measured movement rules in the [Gameplay Design Bible](../GAMEPLAY_DESIGN_BIBLE.md).
