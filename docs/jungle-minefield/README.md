# No-Man’s Grove

A fictional Vietnam-inspired monsoon-jungle track with **1,039 concealed pressure mines**, 252 metres of winding mud, closed foliage, hanging vines, bamboo-like cane, puddles, and abandoned canvas shelters. Follow the worn root strip and cross the narrow timber over the washout. Three lamp-lit clearings bank progress; a crystal and extraction gate finish the run.

Play: `/?playtest&level=jungle-minefield`. The developer MENU also lists **No-Man’s Grove**. The optional trial clock sits off the main route near the start. The campaign map is unchanged.

## Authoring

`src/levels/jungle-minefield.ts` owns the course, mine positions, cleared trail, and camera nodes. Existing Jungle/Treehouse assets supply the scenery. No movement tuning or new asset downloads are required. Blockworks in `codex-lab.ts` remains its own published course.

A native `crate` with `kind: 'nitro'` and `invisible: true` is a buried mine: its authored base stays below ground, with a shallow pressure contact at the surface. It has no visible dynamite assembly, never bobs or snaps onto the floor, and is revealed as a wireframe in the editor. The normal explosive collision, sound, chain reaction, and checkpoint snapshot logic handle play; orange bursts emerge above the soil. Capture/export preserves concealment, and hard/soft resets never reveal the mines.

## Validation

- `check:levels` passed. The existing package script was run directly with the bundled Node runtime because npm is not installed on this host.
- Production `build` passed (TypeScript and Vite, no full suite).
- `tools/test-jungle-minefield.mjs`: normalized data, 1,039 mines, clear trail/checkpoint margins, no auto-seating or idle bob, editor visibility/capture, native foot-contact death, chain reactions, and hard/soft snapshot restoration.
- `tools/test-jungle-minefield-browser.mjs`: real Chrome in lite/full rendering, continuous input-driven spawn-to-finish traversal with zero deaths, three activated checkpoints, crystal collection, deliberate mine contact, chain reaction, pit death, and supported checkpoint recovery. No browser console errors in either run.
- The deliberate mine test chained 155 buried mines, peaking at 71 simultaneous native blasts; all surviving mines stayed hidden after respawn.

Evidence: `validation.json`, `jungle.png`, `blast.png`.
