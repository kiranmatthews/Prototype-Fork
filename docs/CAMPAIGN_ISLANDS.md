# Six-island campaign

The menu map has five main islands and one secret island: **38 destinations, 22 existing courses and 16 planned slots**. Player-facing names come from `src/campaign.ts`; existing editor IDs and save keys remain stable. The M editor catalogue retains the original authoring names so old projects can still be located.

## Island roster

An em dash in the source column means a genuine Coming Soon placeholder. It cannot load another course or earn progress. Each island has its own map landmass, palette and relief; the main route runs left to right through the listed order.

| Island | Menu name | Existing course / authoring ID |
| --- | --- | --- |
| Motu Motu | Treehouse Trail | Treehouse Trail · `treehouse-trail` |
| | Banana Bay | Beachside Run · `beachfront` |
| | Jungle Ruins | Jungle Ruins · `jungle` |
| | Ripcord River | Rumblewater Run · `rumblewater-run` |
| | Beach Street | Coastal Street Run · `coastal-street-run` |
| | Motu Beach Invitational — boss competition | Jungle Cup · `jungle-cup` |
| The Uga Isles | Sunset Safari | Custard Creek · `custard-creek` |
| | Tribal Run | — |
| | Waterfall Climb | — |
| | Uga Ambush | Former Carlisle Coast · `test` |
| | The Merchant Wreck | The Drowned Crown · `drowned-crown` |
| | High Chief Uga Ha ku — boss | Crab Chief · `crab-chief`, as confirmed by the user |
| Spooky Shores | Deadwater Park | Deadwater Park · `waterpark` |
| | Haunted Hassle | Haunted Hassle · `codex-lab` |
| | Ghost Train | Ghost Train · `ghost-train` |
| | Tunnelbore Tracks | Hollowwake Descent · `hollowwake-descent` |
| | Slipstream — boss race | Slipstream · `slipstream-race` |
| | Deadwater Cup — boss competition | Deadwater Cup · `waterpark-cup` |
| Maynard Quay | Carlisle Coast | — new course; distinct from Uga Ambush |
| | Country Club Circuit | Country Club · `country-club` |
| | Hogsworth Harbour | Rooftop Relay · `rooftop-relay` |
| | Unnamed Course 4 | — |
| | Unnamed Course 5 | — |
| | Maynard Quay Boss | — |
| Quagmire Caverns | Factory Fuss | Warehouse / Five Lines · `warehouse` |
| | Nightmare Grove | No-Man’s Grove · `jungle-minefield` |
| | Guptus Eruptus | Nightworks: After Hours · `nightworks-after-hours` |
| | Torchlight Trouble | The Nightworks · `dark` |
| | Skate Race — boss race | — |
| | Monster Final Boss | — |

Country Club keeps its existing shared race runtime and race rewards. Factory Fuss currently uses the existing free-skate Warehouse, which does not offer a time-trial medal. Neither entry invents a new course or changes movement physics.

## Secret Island

All eight secret courses are planned slots named by their unlock condition. Reaching the island requires **every main boss victory and at least one satisfied secret-course condition**. A cup requires an overall win and a boss race requires a race win; merely finishing either does not count. The missing Maynard and Quagmire bosses deliberately prevent a normal save from unlocking the secret island prematurely.

| Slot | Menu name | Requirement |
| --- | --- | --- |
| 1 | 5 Medals | At least 5 time-trial medals |
| 2 | 5 Clear Gems | At least 5 all-boxes clear gems |
| 3 | 10 Medals | At least 10 time-trial medals |
| 4 | 15 Clear Gems | At least 15 all-boxes clear gems |
| 5 | 20 Medals | At least 20 time-trial medals |
| 6 | All Main Medals | A medal on every main course that offers one |
| 7 | All Clear Gems | Every main clear gem and the clear gems from secret slots 1–6 |
| 8 | All Gems & Medals | Every main and earlier secret clear gem and medal, plus every authored coloured gem |

Each course contributes one medal regardless of tier; a bronze-to-gold upgrade does not count twice. Legacy relic ownership counts as gold. Crystal and retired combo-gem awards do not count as clear or coloured gems. No coloured-gem challenges are currently authored: the final requirement has explicit future metadata/ownership support and remains unsatisfied while that catalogue is empty.

The final two conditions exclude the destination's own rewards and later locked slots. This avoids requiring a reward from an inaccessible course to unlock that same course. Planned main slots remain part of future “all” requirements, while the ordinary completion percentage counts only built courses.

## Menu and save behaviour

- Level Stats / Level Select reveals only unlocked levels and islands. Locked names, previews, rows and island pages remain hidden; secret slots also require their individual medal/gem condition. Unlocked Coming Soon slots remain inspectable with keyboard, controller, mouse or touch, while the menu, host transition and map entry independently block unavailable gameplay.
- The map's physical travel remains gated by progression. Unbuilt ordinary slots can be visited and do not strand existing courses later on that island. Unbuilt bosses keep the next island closed.
- Old save progress follows stable keys. For example, `test-course` remains Uga Ambush; it is never transferred to the new Carlisle Coast placeholder. Already completed main courses remain selectable after the reorder.
- Unassigned and retired keys remain in the durable ledger, preserving their earned data. Editor map point indices are append-only; untouched old captures adopt the new layout while custom point coordinates remain untouched.
- Planned cards use the shared Coming Soon illustration. Five newly assigned courses have compact previews captured from their real game geometry. Game-owned menu artwork remains in the existing pre-CRT pass.

## Existing proper courses without an island assignment

| Course | Editor ID |
| --- | --- |
| Temple of Embers | `jungle-terraces` |
| Sky Bridge | `sky` |
| The Descent | `descent` |
| Jungle Gate Run | `jungle-gate-run` |

These are retained in the M editor menu. Bonus rooms remain attached to their parent courses. Inside Your Room is the supporting bedroom scene; Flats & Pipes, Bone Yard / Wipeout Playground, Backport Mechanics Lab and MeshyLook Thorn Courtyards are test or study entries. Island World Map is the menu scene. None was assigned to an unspecified campaign slot.

## Local verification and delivery

Work is isolated on `codex/six-island-campaign`, based on the already-available integrated local `origin/main` (`aef70752`). The primary checkout and its unrelated unfinished work are preserved. No network fetch, push, upload or deployment is required.

- `npm run check:levels` and the production TypeScript/Vite build.
- `npm run check:campaign` and `npm run check:level-select`, including exact assignments, save/editor migration, boss gates, threshold boundaries and independent secret unlocks.
- `tools/test-six-island-browser.mjs <dev-url>`: six actual island meshes, 38 supported hubs, 407 reciprocal finite route samples, real keyboard travel through every destination, placeholder entry guards and a real touch course launch.
- `tools/test-six-island-production.mjs <preview-url>`: the production build in lite/full rendering, fresh-save concealment, progression-based reveals, all six unlocked pages, actual Uga Ambush and High Chief entry, and the renamed boss health HUD.
- Browser menu review at 390×844, 844×390, 1024×768 and full-render 1280×720. Fixed screen regions, bounded list scrolling, pre-CRT rendering and touch targets are checked; screenshots are visually reviewed. Browser console errors: zero.

Set `PLAYWRIGHT_MODULE` to an existing local Playwright module and `ISLAND_REVIEW_DIR` for local evidence. Browser fixtures use isolated ephemeral progress, including simulated future boss wins solely to inspect the complete map. The full `check:all` suite is not part of this task.
