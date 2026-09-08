# Browser editor measurements

Measured 2026-09-08 in the in-app Chromium browser at 1280×720, using
`/tools/editor-performance-review.html?lite` and `?full` on Vite. These are local
measurements, not device-wide performance guarantees.

The fixture builds and captures native Descent, opens the real Editor on a
disposable user copy, and moves all 84 members of Mountain wall 1. It performs
three edit/undo/redo cycles, with real validation, browser storage, outliner,
selection helpers, Level construction/disposal and WebGL rendering. The draft
contains 1,940 components and approximately 2.96 MB of JSON. The fixture restores
the previous library and all storage values after each run.

| Measured stage | Lite geometry | Full geometry |
| --- | ---: | ---: |
| Complete synchronous edit/undo/redo transaction | 807–923 ms | 817–937 ms |
| Level constructor within that transaction | 376–445 ms | 382–423 ms |
| Outliner rebuild within that transaction | 43–53 ms | 43–52 ms |
| Browser storage within that transaction | 3–6 ms | 3–7 ms |
| Forced layout after history operations | 43–59 ms | 44–56 ms |
| First render submission after a transaction | 77–87 ms | 75–133 ms |

Some diagnostic method timings are nested. Do not add them together or add
constructor/outliner/storage work to the transaction total a second time.
Render submission measures CPU work; it does not wait for completed GPU work.
This fixture does not run the game's player, campaign UI, reflection/depth
prepasses or postprocessing. Main-game and physical mobile input latency still
require separate checks.

## Texture lifetime bug found and fixed

Before the fix, a run grew from 15 live GPU textures to 70 after nine operations,
and left 61 allocated after closing and disposing the scene. The ocean's
`UniformsUtils.merge` cloned its texture wrappers. The shader sampled those
clones, but the ocean disposed the original wrappers it owned.

The ocean now clones only the shared fog/light uniform templates and binds its
owned texture objects directly. The repeated browser runs in both geometry
modes stay at 13–14 textures, returning to one shared texture after cleanup.
The one-time increase corresponds to the shared fruit asset completing its
load. Equivalent undo/redo states retain stable geometry and program counts.
Both runs reported zero browser errors and restored saved storage.

`tools/test-ocean-resources.mjs` also checks the actual shader sampler objects:
all are disposed exactly once, quality changes dispose render targets and
restore owned fallbacks, and late image completion cannot remount disposed
geometry. The browser review remains necessary evidence for real GPU cleanup.
