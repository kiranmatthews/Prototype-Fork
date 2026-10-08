# Offline desktop publishing

The desktop edition uses the existing Three.js/WebGL game inside a pinned Electron runtime. It reads assets directly from its own app bundle through `boneman://game/`. There is no local HTTP server, remote content, runtime package manager, telemetry, updater, or first-run download.

Choose this route for consistent browser behaviour and controlled releases across macOS, Windows and Linux. Electron costs more disk space and baseline memory than a system webview. It is **not automatically faster**. Tauri uses OS-managed WebKit on macOS/Linux and WebView2 on Windows; that creates additional engine and OS compatibility combinations. For this game, a bundled, tested Chromium version is the more predictable starting point. The release performance gates below decide whether a build is fast enough; the shell name does not.

## Build and run

Use Node 24 and npm. Work from a clean, reviewed commit. Downloads happen on the build machine; the installed game does not need them.

```sh
npm ci
npm --prefix desktop ci
npm run check:desktop
npm run build:desktop
npm run desktop:smoke
npm --prefix desktop start
```

The root lockfile remains independent of `desktop/package-lock.json`; ordinary Pages builds do not install Electron. The runtime is pinned in `desktop/package.json`. Update the runtime and lockfile together, then rerun the native matrix. The default Electron development launcher and Playwright are development dependencies and are excluded from the finished app.

Create and verify a local app:

```sh
npm run desktop:pack
node tools/desktop/check-package.mjs
node tools/desktop/packaged-smoke.mjs
node tools/desktop/native-lifecycle.mjs
```

The local Mac app is `desktop/release/mac-arm64/BONEMAN.app` on Apple Silicon or `desktop/release/mac/BONEMAN.app` on Intel. Local Mac candidates use an ad-hoc signature so modified ARM binaries can run. This is not a Developer ID signature or notarization. Candidate installers are for testing, not public distribution.

After `npm run build:desktop`, run the matching command on a native host:

| Host | Candidate command | Deliverable |
| --- | --- | --- |
| Apple Silicon Mac | `npm --prefix desktop run dist -- --mac --arm64` | DMG and ZIP |
| Intel Mac | `npm --prefix desktop run dist -- --mac --x64` | DMG and ZIP |
| Windows x64 | `npm --prefix desktop run dist -- --win --x64` | Complete NSIS installer |
| Linux x64 | `npm --prefix desktop run dist -- --linux --x64` | AppImage and tar.gz |

Separate native Mac artifacts avoid Rosetta and avoid shipping two Chromium architectures to every player. Linux still needs ordinary OS graphics/display libraries and a supported GPU driver; “self-contained” includes the browser and game, not the operating system. None of these installers bootstraps a webview from the internet.

## Offline boundary and stability

- `desktop/main.cjs` creates one sandboxed game window. The renderer has no Node integration, preload bridge, IPC API, webview, or permission grants.
- Native session policy rejects HTTP, HTTPS, WebSocket and direct filesystem requests. CSP separately restricts scripts, textures, fonts, audio, workers and connections to bundled or locally generated resources. The pinned Basis/Embind decoder needs JavaScript call-adapter generation: it is emitted as a dedicated bundled worker with its own policy allowing that operation and denying all connections. The game window retains its prohibition on JavaScript string evaluation. The build adapter fails if the pinned Three.js loader structure changes. Navigation is limited to the game and local reset page; new windows and external links are denied.
- A secure, standard custom origin preserves relative URLs, browser storage, WebGL, WebAudio, WASM and blob workers. Local responses support MIME types, HEAD and byte ranges. Paths must be explicit members of the build manifest; missing files fail locally.
- The desktop build removes web update discovery and the GitHub publishing client. Cloud/token controls are hidden; “Restore bundled levels” reads the installed `levels.json`. Local file import/export stays available.
- Service workers are not enabled for the protocol. There is no full-game CacheStorage copy, cache warm-up, stale PWA version or online fallback. Hashed code can retain Chromium's code cache; mutable asset URLs are not cached across app releases.
- Saves and preferences use the stable BONEMAN profile outside the read-only bundle. On macOS this is `~/Library/Application Support/BONEMAN`; Windows uses `%APPDATA%\\BONEMAN`; Linux uses its application config directory. Replacing the app preserves this profile and the existing `solProto*` keys. The app does not silently import a browser's separate profile.
- Normal shutdown flushes browser storage. Disk-full and invalid-save handling remain in the shared game storage layer. Save exports/backups are still needed before a release that changes the save schema; an OS crash can lose the last unflushed write.
- The existing game stops simulation while hidden, clears held input/time accumulation on return, and handles WebGL loss/restoration. A killed or unresponsive renderer gets a native Reload/Quit prompt instead of an automatic restart loop.
- Production binaries disable RunAsNode, NODE_OPTIONS and Node inspector arguments and load only the ASAR application. macOS/Windows also validate ASAR integrity. The package verifier checks these fuses after packaging.

`BONEMAN_USER_DATA` can select an isolated test profile. Smoke tests create and remove their own temporary profiles; they never reset a player's saves. Packaged tests explicitly enable a local debugging port for the duration of that test; ordinary launches do not open it.

## Efficiency rules

Preserve the game's existing fixed simulation step and movement tuning. The desktop default keeps the authored 720-line internal render target, 1× output and 60 Hz cap. Retina window size must not silently multiply GPU work. Keep the hardware-accelerated Chromium defaults, VSync, browser sandbox and context recovery; do not add speculative GPU flags, disable the sandbox, force a backend, or remove frame limits to inflate an FPS number.

Assets stream from ASAR in bounded chunks. The native main thread neither decompresses the whole game nor hashes every asset on startup. Build/package verification does the expensive integrity work before distribution. Scenery continues to use the shared bounded loader, one KTX2 decoder worker, worker retirement, GPU texture formats and level-resource lifetime management. Existing lazy authoring panels stay lazy; separate web review/lab pages are excluded from this app.

`tools/desktop/assets.mjs` retains current runtime assets and their notices while omitting previous font atlases, ZIP authoring exports, provenance source assets and web-only downloader/update pages. It derives active font versions from the game's real font metrics. The manifest records every installed file's size and SHA-256. `audit.mjs` checks every hash, local HTML/glTF references, bundled decoders and absence of web publishing/update code. Runtime smoke testing remains necessary for computed URLs.

Do not remove assets based only on a short playthrough. Do not preload all levels to hide a first-load hitch. Optimize the specific measured CPU, GPU, loading or residency bottleneck while preserving the picture and gameplay, then repeat the same scene/input/resolution comparison.

## Automated distribution

`.github/workflows/desktop.yml` builds Apple Silicon, Mac x64, Windows x64 and Linux x64 artifacts. Both Mac jobs run on Apple Silicon: the x64 job explicitly pins both Node and Electron installation architecture to x64 and runs under Rosetta because the hosted Intel VM cannot initialize WebGL. The native capability probe asserts the Electron architecture. This verifies the x64 binary's functional behaviour, not physical Intel GPU performance; that remains a required release acceptance check. It runs focused checks, the real offline renderer smoke, packaging, ASAR/fuse verification, packaged-app smoke, native window hide/restore, and checksums. It never runs `check:all`.

For unsigned/ad-hoc candidates from main:

```sh
gh workflow run desktop.yml --ref main -f release=false
```

Download the `boneman-installer-*` and `boneman-evidence-*` artifacts from that run. CI checks correctness; virtual-runner frame times do not certify minimum-hardware performance. Linux CI explicitly uses a software GPU test backend because its hosted Mesa context cannot initialize this Chromium build. Test launchers alone honor BONEMAN_TEST_SOFTWARE_GPU=1; no software-GPU flags or relaxed graphics settings are added to the distributed app. Software GPU and Rosetta tests get longer functional-test deadlines while retaining the same full-render scenes and resolution. Initial readiness is observed through a minimal CDP connection before the full harness attaches; the game's persisted startup-error ledger is checked too. Connection loss and timeouts fail the test rather than leaving an indefinite wait.

For public distribution, configure these repository/environment secrets in GitHub, never in game source or the bundle:

| Secret | Purpose |
| --- | --- |
| `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PASSWORD` | Developer ID Application certificate in electron-builder's CSC_LINK format and its password |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | Apple notarization credentials |
| `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD` | Windows signing certificate and password |

Bump `desktop/package.json` and refresh its lockfile. Commit the reviewed change, tag it `desktop-vX.Y.Z`, and push the tag. Then:

```sh
gh workflow run desktop.yml --ref desktop-vX.Y.Z -f release=true
```

Release preflight rejects a branch build, mismatched version or missing credentials. Signing is required for Mac/Windows distribution. The Mac job validates the signature, stapled notarization ticket and Gatekeeper assessment; the Windows job validates the installer signature. A failed check prevents the draft release. Installation on a disconnected clean machine is a separate acceptance test: signing-service checks on a connected CI runner cannot prove that.

The successful workflow creates a **draft** GitHub release with installers and SHA-256 files. Complete the hardware/offline gates below, update its release notes with supported OS/GPU results, then publish:

```sh
gh release edit desktop-vX.Y.Z --draft=false
```

Updates are complete replacement app installers. There is no in-game network update check. Keep the previous signed release available for rollback; verify save compatibility before suggesting a downgrade. Re-run this workflow for runtime security updates, even if game code is unchanged.

## Release acceptance and performance

For each supported platform, record the immutable commit/content ID, Electron/Chromium versions, hardware/GPU/driver, OS, display refresh rate, power mode and exact graphics settings. Test the packaged artifact, not Vite or a development browser.

1. Copy/install it on a fresh machine/profile with networking disconnected **before first launch**, without a browser/PWA cache. Verify first menu, all campaign levels and bonus families, animation/audio/texture decoding, imports/exports, three save slots, quit/relaunch and update-over-old-version saves. Check that the bundle remains read-only.
2. Run lite/full smoke and staged spawn, movement, collision, checkpoint, pit respawn and finish checks. Include Treehouse Trials, water, nightworks, a boss and split-screen for their distinct asset/rendering paths. Exercise keyboard/gamepad hot-plug, audio device changes, resize/fullscreen, sleep/wake, repeated minimize/restore and actual WebGL context loss. No missing assets, shader errors or unhandled exceptions.
3. Use repeatable input replays and camera paths. Measure at least 60 seconds per representative scene after a warm-up, plus a separate cold-start sample. Record frame-delivery p50/p95/p99, frames over 33.3 ms, CPU/GPU traces, peak resident memory and time to interactive. Do not call requestAnimationFrame cadence a GPU timing measurement.
4. Start with a 60 Hz release budget: p95 delivery at most 18 ms, p99 at most 25 ms, and fewer than 1% of gameplay frames over 33.3 ms on the declared minimum hardware at the default preset. Treat these as acceptance targets, not already achieved claims. Compare against the previous release on the same machine; investigate >5% p95/p99 regressions. Capture GPU timing with disjoint-query validity or a native trace when diagnosing rendering.
5. Alternate the heavy levels for at least 30 transitions and run a 30-minute soak. After warm-up, textures, geometry and process memory must settle into a repeatable range rather than grow per transition. A plateau and clean return to the menu matter more than a single “low memory” screenshot.
6. Confirm hidden/minimized play stops simulation and audio loops, consumes minimal CPU, and resumes without a catch-up leap. Test renderer failure recovery once; progress saved before failure must remain readable. Verify zero game-origin HTTP/HTTPS/WebSocket traffic and zero listening game servers using process-level network observation as well as the built-in request probes.
7. Retain screenshots, traces, source and packaged smoke JSON, manifest content ID, signing/notarization results and checksums beside the release. A faster result without the same picture, inputs, resolution and content is not a valid performance comparison.

The smoke scripts are short automated regression checks. They are not a full-course playthrough, a sustained hardware benchmark, a physical controller test or a substitute for the final disconnected installer review.

## Verified local result

The initial macOS arm64 candidate contains **861 manifest-tracked game files / 408.3 MiB**, omitting **438.5 MiB** of web/authoring material from the public asset inventory. The app with its browser runtime occupies approximately **696 MiB** on this host; compressed candidate installers are approximately **487 MiB**. This is a size reduction, not an FPS claim.

Fresh-profile disconnected startup, lite/full gameplay with CRT enabled, checkpoint/pit/finish, persistent saves, actual WebGL loss/restoration, and cold Treehouse/Jungle/Nightworks/boss asset loading pass. Deliberate fetch/image/WebSocket/worker requests and a native-session request produce **zero hits** on the probe server. The packaged app passes full rendering without focus emulation. A separate native test verifies stopped simulation while hidden, resumed simulation on show, and enabled sandboxing. Details and bundle identity are in [the local evidence](performance/offline-desktop.json).

This is an ad-hoc Mac candidate. Developer ID signing/notarization, signed Windows distribution and minimum-hardware acceptance are exercised when releasing with the documented credentials and hardware matrix.

## References

Architecture and implementation follow the official [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [custom protocol API](https://www.electronjs.org/docs/latest/api/protocol), and [fuses](https://www.electronjs.org/docs/latest/tutorial/fuses). The measurement-first policy follows [Electron performance guidance](https://www.electronjs.org/docs/latest/tutorial/performance). Engine differences are documented by [Tauri](https://v2.tauri.app/reference/webview-versions/). Signing configuration and stapling follow [electron-builder's notarization workflow](https://github.com/electron-userland/electron-builder/blob/master/website/docs/features/code-signing/notarization.md).
