# Gameplay announcements and loop finish policy

The 28 October 2026 UTC change removes loop-based exit requirements globally.
A loop completion produces no title or unlock announcement. Old imported loop
flags are discarded, while physical riding and competition loop scoring remain.

The shared centre-screen announcement and legacy HUD game-over plate are available
only with M / Show Debug Menus enabled. The DOM and native CRT painter both reject
them during normal play. Hiding debug cancels the active notice and its timer;
restoring an old snapshot cannot reveal it while debug is hidden.

`tools/test-gameplay-announcements-browser.mjs` drives real Chrome against either
a local dev server or a packaged preview. Set `ANNOUNCEMENTS_FULL=1` for the full
render path at native 1600×1000. `PLAYWRIGHT_MODULE` can point to the host's supplied
Playwright installation.

- [Lite report](lite.json) and [packaged full-render report](full.json): empty error consoles, hidden announcements, explicit Canvas rejection, debug-only rendering, immediate clearing, no queued replay, working Pause and normal results.
- [Normal play](normal-play.png): clear view after disabling debug.
- [Debug-only notice](debug-only.png): diagnostic style enabled deliberately.
- [Ordinary results](ordinary-results.png): finish accepted with zero completed loops. This fixture begins on the final supported deck and tests admission, not a full traversal.

The separate native loop regression verifies a real complete turn without any
announcement, gravity/pressure failure and retry, and legacy save migration.
The existing Skystream traversal still reaches all three loops, four gaps, seven
checkpoints and 67 main-course boxes without bails or deaths.

The old performance lifecycle JSON files point here for current finish behavior;
their other historical measurements have not been rerun or rewritten.
