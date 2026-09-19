# Offline play

The production game automatically saves a complete offline copy after loading.
The title screen and Options show download progress and **Ready for offline play**
only after every file in that release has been saved. Keep the game open and online
until that message appears. The current copy is approximately 201 MiB, including
full-resolution GPU-compressed scenery and its original image fallbacks.

Saving starts after foreground startup assets settle. Downloads, integrity
checks and cache writes are serialized to bound temporary memory, and concurrent
requests for one missing file share the same write. Abandoned incomplete older
releases are removed; the complete working release and the current install's
resumable progress are preserved. Game saves are separate and are not removed.

## iPhone and iPad

1. Open the published game in Safari while online.
2. Use Share → Add to Home Screen.
3. Open the Home Screen game while still online. Wait for **Ready for offline play**
   there before enabling airplane mode. Installation can use a separate storage
   context, so do not rely on a download made only in a Safari tab.
4. Close and reopen the Home Screen game in airplane mode. Levels, sound and local
   progress remain available. Publishing editor changes still requires a connection.

The game requests persistent storage when supported. Safari decides whether to
grant it; Home Screen installation is one of its signals. Clearing website data,
the game's explicit local-data reset, or browser/OS eviction removes the offline
copy. Reopen online to save it again. See WebKit's
[storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).

## Releases and caching

- `tools/offline-build.mjs` generates `dist/sw.js` from the finished build. It hashes
  the HTML, bundles and runtime public assets, including unvisited levels' scenery,
  audio, KTX2 decoders and animation data. Font versions come from the game's atlas
  metrics; retired atlases, ZIP exports and provenance are excluded.
- The worker uses four concurrent downloads, checks content hashes, and records
  readiness only after the entire release succeeds. Interrupted downloads resume
  from their saved files when the game reconnects or reopens online. Low-storage
  and download failures are reported in the menu without claiming offline readiness.
- An update reuses unchanged assets by their content hashes. The previous release
  remains active until all game windows close. The menu reports when a downloaded
  update is waiting. This replaces the old automatic mid-session HTML refresh.
- Caches and cleanup are scoped to this project's URL path and `solProtoOffline`
  prefix. Only listed same-origin GET assets are intercepted. Authenticated requests,
  cloud writes and other projects bypass the worker.
- Query strings on game navigation, level JSON and animation requests resolve to
  their release's cached file. Byte-range responses support Safari media requests.
- Development mode does not register a worker. Test production builds at localhost
  or HTTPS, including the `/Prototype-Fork/` path used by GitHub Pages.

## Checks

`npm run check:offline` covers cold cache reads, subpaths/query strings, byte ranges,
interrupted saves, reuse, failed/atomic updates, scope isolation, content mismatch
and quota failure. `tools/test-offline-browser.mjs` runs against a production preview
with Playwright: a full browser restart with the preview origin shut down, movement/checkpoints,
previously unvisited jungle/city/Nightworks/map assets, local storage and a full
rendering pass. Set `OFFLINE_BROWSER=webkit` for the iPhone-layout WebKit pass. This test shuts down
the real preview server because Playwright WebKit’s offline emulation also blocks
service-worker cache responses (reproduced independently with a minimal HTML page).
Set `PLAYWRIGHT_MODULE` if Playwright is supplied by an external local runtime.

WebKit desktop testing with an iPhone viewport is not a physical iOS device test.
The Home Screen/airplane-mode sequence above is the device acceptance check.

## Scenery detail

Jungle/map cells, city cells and moving Nightworks rocks retain their authored
near mesh at all viewing distances. Instancing, bounds, frustum culling and city
cutaways remain. Embedded low-detail source geometry stays in the asset files for
authoring/backdrop use, but no runtime `THREE.LOD` swaps change visible scenery.
