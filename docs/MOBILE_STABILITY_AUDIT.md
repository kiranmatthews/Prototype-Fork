# Mobile stability audit — 21 September 2026

This pass audited automatic offline installation/update, cache misses, image
residency, decoder concurrency/lifetime, level retirement, repeated results,
audio, and gameplay CPU work. CRT, resolution and filter ablations were excluded.
The desktop browser tests exercise touch layouts and WebKit; they cannot identify
an OS kill on a physical iPhone/iPad or establish that device's crash rate.

## Findings and changes

### Font images were a large allocation outside the game's resolution settings

Both font palettes eagerly retained three 2048 × 4046 PNGs each. Their decoded
RGBA source pixels total **189.66 MiB** before canvas intermediates, GPU copies,
scenery, character assets or offline work. Compressed download sizes obscure this.

The runtime now chooses one source set from the physical viewport's short edge,
independently of graphics settings. Phone-sized displays (up to 1440 physical
pixels) use cap-128 atlases; displays up to 2048 use cap-256; larger displays use
the unchanged cap-512 masters. A 3840 × 2160 TV receives the masters, as does a
1920 × 1080 viewport at DPR 2. Rotating a display preserves its tier. Resizing
across tiers loads and publishes a complete replacement set and updates SVG and
Canvas sources together.

| Source set | Decoded RGBA budget, six images |
| --- | ---: |
| Previous, every device / current 4K | 189.66 MiB |
| Current phone | 11.86 MiB |
| Current iPad (1024 × 1366, DPR 2) | 47.41 MiB |

All original PNGs and layout/kerning metrics remain unchanged. Derived PNGs use
premultiplied-alpha Lanczos resampling; only source sampling coordinates scale.
`tools/roo-type/build-runtime-atlases.py` reproduces them with Pillow. Images load
serially, and each painter's label cache has a byte budget (4 MiB on smaller
displays, 16 MiB at full size), in addition to its 32-entry limit. Browser checks
confirm phones request no master PNGs, iPads choose 256, and 4K chooses 512.
These figures describe decoded source pixels, not a claim about total OS RSS.

### Whole-release saving was still competing with play

Waiting for startup before calling `register()` did not isolate installation:
browsers also check worker updates on navigation. A complete release was still
downloaded, hashed, and copied through Cache Storage while a live game could be
using most of a mobile process's available memory. The previous serial download
fix bounded individual files, but not this overlap.

Home now offers **Save Offline**. It replaces the game with a small standalone
HTML screen containing no game bundle, canvas, WebGL context or decoded game
art. The game only reads existing offline status. The worker refuses full
installation unless a save screen is present and no other game window is open.
It checks again before each file, stopping at the next boundary if play begins.
Automatic update attempts cannot allocate a release cache alongside gameplay.

The complete versioned cache, hash validation, interrupted-save reuse, original
saves/settings, atomic activation and byte-range audio support remain. Online
runtime misses now go directly through ordinary HTTP: neither a full Cache
Storage quota nor a Cache API exception can prevent an online asset loading.
They do not enter the installer buffer/hash/write queue. The complete offline
pack is approximately 213.7 MiB on disk, including every font tier for offline
use on a different display; disk storage is distinct from decoded image memory.

Existing old cache-first workers can still serve old game code. Use
`update-game.html` once to adopt this release; it preserves saved games, custom
levels and settings. Then use Save Offline if an offline copy is wanted. Merely
reloading an old controlled game is not a reliable update mechanism.

Reference: [MDN service-worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).
The diagnosis of overlap comes from this repository's worker and startup code,
not from assuming a universal Safari memory limit.

### Duplicate decoder pools retained idle WebAssembly heaps

Jungle/Treehouse and Carlisle each constructed a KTX2 loader with two workers.
Three r166 explicitly warns about multiple active loaders. Both families now
share one loader with one worker, and its worker pool is terminated after five
seconds with no jobs. The loader's source URL/creator remains valid for later
loads. Busy and queued jobs prevent retirement; failed jobs release ownership.

Actual browser worker instrumentation observed a peak of one and zero idle
workers after every tested level, including returns to compressed Treehouse and
Carlisle assets. GPU compression, source textures and scenery fidelity remain.

### Idle ropes repeatedly rebuilt geometry and grind paths

Sky Bridge rewrote every braided rope vertex, recomputed bounds and rebuilt rail
segments every fixed tick, even with every rope at rest. A CPU profile attributed
about 1.47 seconds of a five-second sample to `BraidedRope.update`, plus rail
sampling and bounds work. The old level update averaged approximately 5.95–6.01
ms per tick on this desktop; the new production route measured 0.03–0.05 ms.
These are desktop timings, not an iPhone FPS prediction.

Idle ropes now reuse their existing buffers/path. Occupied sag, recovery's final
rest tick, breaking, collision disablement and restring still update normally.
Behavioral tests exercise all those transitions. No physics/tuning changed.

### Audio requests and graph nodes needed explicit lifetime boundaries

Startup now fetches/decodes two sounds at a time instead of every sound together.
Finished one-shots and stopped loops disconnect both source and gain. WebKit
caught queued requests continuing in the detached game document after navigating
to the offline saver; `pagehide` now cancels the queue and suspends audio.
Back/forward restoration loads missing sounds while retaining completed buffers.
The offline navigation also waits for already-requested scenery/image jobs to
settle before detaching their document. It never waits on Safari's gesture-gated
audio suspension promise and never starts bulk saving while those jobs finish.
Tests cover the concurrency bound, cancellation, restored loading, loop behavior,
full-length one-shots and disconnection.

### Milk props do not justify an art rollback

Cartons share their body/gable geometries and one 512² print texture. Milk drops
share geometry and morph buffers; only weights/orientation change per object.
The Treehouse desktop baseline spent about 0.25 ms per tick in the entire level
update and about 0.02 ms in the player's fruit update. Jungle's complete level
update was about 0.12 ms in the same initial profile. These costs do not explain
the widespread reloads. The milk art stays; idle drops now skip an unnecessary
parent-world-quaternion lookup when their velocity cannot affect orientation.

The bottle HUD has 101 × 256² CPU images (25.25 MiB) and one GPU texture per HUD,
not 101 GPU textures. Its source image pool is finite and shared. The balance
art is approximately 7 MiB. These were audited and retained; font residency was
the much larger avoidable allocation.

## Validation and limits

- Build: complete TypeScript check plus Vite production build, both in the shared
  workspace and an isolated release copy excluding unrelated local character work.
- Focused checks: offline installation/update/resume/hash/quota/ranges; foreground
  Cache API failure; prevention of installation beside a game; interruption when
  a game opens; font dimensions/glyph bounds/tier budgets; decoder busy/idle/error
  restart; audio lifetime; idle/sag/break/restring ropes; milk/carton contact and
  shading; asset retirement; graphics memory; loading gates; level transactions;
  Treehouse traversal/stairs/pits/checkpoints/finish; map locomotion; `check:levels`
  pipeline. The full suite was not run.
- Chrome production browser: initial lite traversal/movement/checkpoint, then 12
  real full-render transitions through Treehouse, Jungle, Cup, Sky, Carlisle and
  map, including four Treehouse result presentations. No page/console errors or
  context loss. After the first visits, three consecutive Sky returns each held
  **159 geometries / 62 textures**; Treehouse held **150 / 90**. Sky array-buffer
  backing storage remained approximately **23.33 MiB** on these returns. Counts
  after the first visit include lazily initialized presentation/reward resources;
  comparing a cold scene against a warmed scene is not a leak test.
- Phone source selection and dynamic changes pass; iPad and 4K menu screenshots
  were inspected. Menu actions remain in bounds. Display profiles simulate size
  and touch; they are not real device hardware.
- Chrome offline browser: full save in the lightweight screen, durable-profile
  browser restart with the HTTP origin stopped, uncached browser HTTP path,
  unvisited levels, movement, checkpoints, saved data, range audio and final full
  rendering pass; no console or asset errors.
- WebKit 26.5 with the iPhone 13 browser profile passes the same complete offline
  save, durable cold restart against a stopped origin, unvisited-level traversal,
  movement/checkpoints/save preservation, range audio and final full-render pass,
  with no console or asset errors after the navigation cleanup fixes.

Reproduction: `tools/test-mobile-stability-browser.mjs <production-preview-url>`
and `tools/test-offline-browser.mjs` (set `OFFLINE_BROWSER=webkit` for WebKit).
`PLAYWRIGHT_MODULE` can identify an installed Playwright module. Diagnostics are
available through `window.__game.getFontDiagnostics()` and
`window.__game.getSceneryDecoderDiagnostics()` alongside the existing renderer,
loading and context-recovery diagnostics.

A physical-device retest is still necessary. Without an iOS crash/jetsam log,
this audit supports specific allocation and CPU fixes, not a claim that every
reported restart had one proven cause.
