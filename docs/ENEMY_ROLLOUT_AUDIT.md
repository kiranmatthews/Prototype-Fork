# Enemy rollout audit — 23 September 2026

The reported device still showed the old cube enemies in Jungle Ruins after a
deployment. Fresh-build testing had not covered how an installed older copy
received the release.

## Runtime and editor coverage

All 20 built-in levels and four synced pack entries were instantiated in both
play and editor modes with real model loading: **48 combinations, 220 enemy
instances**. Every ordinary enemy had a ready imported model, zero BoxGeometry
parts, and the exact triangle count of its GLB in the shipping manifest.
Capture/export retained every kind. The real editor also placed all eight kinds
through its ADD buttons, then committed them to play and reopened an imported
copy successfully. An actual Jungle capture created by the pre-roster build was
retained through the app update and rendered all eight new models afterward.

| Built-in level | Ordinary enemies |
| --- | ---: |
| Jungle Ruins | 8 — all replacement types |
| Flats & Pipes | 11 |
| Sky Bridge | 2 |
| Carlisle Coast | 28 |
| Coastal Street Run | 16 |
| Codex Geometry Lab | 12 |
| Treehouse Trail, Slipstream, Nightworks, World Map, Descent, Beachside Run, both Bonus levels, Island Hopper, Jungle Gate Run, Meshylook Thorns, Jungle Cup, Chimeworks and Backport Lab | 0 |

Synced overrides also passed: Flats 3, Sky 2, Carlisle 28 and Slipstream 0.
Grindosaurus and Angry Ball are separate mechanics and were explicitly excluded
by the user. Their data and designs are preserved.

The 3D factory already routed the eight ordinary kinds through
`createEnemyVisual`. The editor's small palette drawings still depicted the old
roster. Those are replaced with thumbnails rendered from the actual shipping
GLBs, with shared species names in the palette, inspector, outliner and review.
Thumbnail manifests bind each image to its model hash. Gameplay IDs, placement
defaults, patrol rules and authored level data are unchanged.

## Installed-app update fault

The older worker served cached HTML even on a normal online reload. Its updated
worker could then reject installation because no offline-save screen was open.
That kept the old code—including cube enemy builders—active. This failure was
reproduced in Chrome and WebKit with the actual pre-roster game and a cache-first
installed-copy fixture. It does not establish the exact build on the user's
device without its stamp.

The corrected worker separates installing its routing code from saving a whole
release:

- Automatic worker updates install lightweight code without downloading models,
  audio or a release cache. They wait for existing game windows to close.
- Online document navigation checks the current HTML. A document's module-entry
  identity pins its asset selection, preventing new HTML from receiving the old
  cached enemy files. Old offline documents keep their own matching assets even
  if connectivity returns or the worker restarts.
- A lightweight activation retains the last complete offline release. Only the
  dedicated saver can request the complete download; shared jobs, hashes, ranges,
  interrupted saves and the no-game-window guard remain in place.
- After an explicit complete save, activation can replace the old copy. Saves,
  settings and custom levels are never cleared.

The existing save-preserving `update-game.html` escape also remains available.
The game now checks a small, uncached `release.json` descriptor. Home changes its
existing Save Offline action to **Update Game** when a newer build is available,
without adding another menu row or reloading an active run. A valid descriptor
is required before requesting a worker-code check; failed offline probes do not
interrupt play or attempt a worker update.
The two lightweight helper pages use cache-busting navigation URLs.

Service-worker lifecycle reference:
[MDN: Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
The install/update diagnosis above comes from this repository's code and browser
reproduction, not an assumption that publishing automatically replaces a running
installed app.

## Reproduction and regression coverage

```sh
node tools/test-enemy-catalog.mjs
node tools/test-enemy-assets.mjs
node tools/test-game-update.mjs
node tools/test-offline.mjs
node tools/test-update-game.mjs
node tools/test-enemy-coverage-browser.mjs <vite-url>
node tools/test-enemy-release-browser.mjs <candidate-dist> <pre-roster-dist>
node tools/test-offline-browser.mjs
```

Use `PLAYWRIGHT_MODULE` for an external Playwright installation and
`ENEMY_BROWSER=webkit` / `OFFLINE_BROWSER=webkit` for WebKit. The coverage tool
checks all source and synced routes, actual rendering, palette placement and
saved/imported data. The release test checks old cube reproduction, zero bulk
downloads during a worker update, close/reopen adoption, explicit recovery,
byte-preserved campaign/custom-level/settings storage, full Jungle rendering
and the Home update action. The offline test verifies a complete save, durable
browser restart with the origin stopped, all eight Jungle models, other levels,
movement, checkpoints and audio byte ranges.

CI now runs the enemy catalog and update regressions alongside the existing
offline checks. No full suite was run. Unrelated local character work is excluded
from the production snapshot and commit.

Coverage summary: [coverage.json](enemy-audit/coverage.json).

Final Chrome and WebKit checks passed complete offline saves and cold restarts
with the origin stopped, including all eight Jungle models. Game/asset errors
were absent. Expected network failures from the optional `release.json` probe
are recorded separately. Browser update tests also passed with an actual
pre-roster Jungle editor override and byte-preserved saves/settings.
Evidence: [Chrome offline](enemy-audit/offline-chromium.json),
[WebKit offline](enemy-audit/offline-webkit.json), and
[Chrome installed-copy upgrade](enemy-audit/rollout-chromium.json) /
[WebKit installed-copy upgrade](enemy-audit/rollout-webkit.json).
