# Historical regression fixtures

The input-only recordings predate several authored course, character and controller changes. Current gameplay is never retuned to recover their old timestamps.

- `locomotion-test-course-course.json` and `locomotion-slipstream-course.json` are the original entries from `ee9857a:public/levels.json`. The trajectory hashes in `test-locomotion-replays.mjs` were measured with the unchanged `b358c213` Player/tuning on these frozen courses. Recovery coverage tracks a previous board air explicitly; the live `airFromSkate` flag is cleared on landing and cannot serve as historical memory.
- `legacy-flats.ts` preserves `ee9857a`'s native Flats builder. The vert recording resumes its input segment at frame 5313 from the centre of its real first halfpipe, facing across it at 27.2 m/s. The current controller executes those recorded inputs, including real launches, landings and release ownership. Focused integration cases separately verify the original one-beat crest guard, held-press ownership, transfer and abandon behavior.
- The Jungle ledge recording resumes at frame 4351 from its recorded mesh-edge approach (`[-1.695248085,-0.59423062,-38.97382037]`). The real mesh query must catch before its recorded shimmy/climb controls run. It retains mover carry, neutral mantle, held-through-catch and blocked-headroom variants, without depending on unrelated wipeouts in the preceding 72 seconds.
- `native-scenery.mjs` replaces the retired Descent menu entry with an explicit native-builder fixture. It retains full geometry, chunking, materials, grouped walls and rails, and native pine batching. Its oil fixture exercises no-texture capture separately.
- Native atmosphere fixtures retain their older references except Warproom, Beachfront and four map sky cases, which use the authored `b358c213` appearance. Native-to-copy parity remains independently checked.

These fixtures are test inputs only. Production Player, tuning and camera code are unchanged by the regression repair.
