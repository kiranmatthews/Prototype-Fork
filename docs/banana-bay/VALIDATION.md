# Banana Bay validation

27 October 2026. Worktree: `codex/banana-bay`, based on
`37b69e6524faa1b448772b18107c818aac3a43f8`. Integration and publication belong
to **Coordinate local work and releases**. This worktree does not push.

Status: **validated locally**. Required level checks, TypeScript/production
build and release-size check all exit 0. The final package contains
999,468,526 bytes, with 531,474 bytes of hosting headroom.
The final main Chrome clear takes 227.57 simulated seconds,
breaks 87 crates and defeats all 15 patrols without death.
See [the verification record](verification.json) for exact scopes and hashes.

## Delivered course

The finish moves to Z −1381, approximately 249 metres beyond the old finish.
Nine coastal encounter areas lead through the preserved original lagoon
crossings into a salvage finale: stepped piers, an aligning timber ferry and
a collapsing breakwater. There are 111 cargo crates, 14 checkpoint boxes and
15 enemy patrols. These crate and checkpoint counts are separate; the linked
bonus has another 26 crates.

Cargo has a purpose: paired loading consignments, an arrow that must survive
until its high parcel is collected, a wood cap above TNT with a clear refuge,
and seaward Nitro cargo beside a safe landward lane. The first gaps and loose
boards teach their rules over recoverable sand before the exposed lagoon.

Lifeguard Lockup retains its complete ordered crate puzzle. Permanent floors
become fitted oak wharves with timber supports. Full-detail sandstone, palms,
hibiscus, vines and broadleaf plants form near and distant garden islands.
Lighting, sky, fog and ocean look come from the same parent-level settings.
No runtime image, model or audio files are added.

The [research brief](../BANANA_BAY_DESIGN.md) documents eight consulted
developer/production/publisher sources and the specific original design
decisions inferred from each.

## Evidence and scope

- [Native structure and bonus clear](evidence/physics.json): supported spawn,
  normalized source and complete native capture, all 111 crate supports or
  explicit launcher dependencies, 14 clear checkpoint placements, 900 patrol
  support samples and the complete 26/26 bonus journey. The final version also
  checks dry, supported sand beside both new piers and the complete timber
  raft skin.
- [Main Chrome journey](evidence/beachfront-lite-journey.json): ordinary
  movement, jump and spin inputs from the actual start to the actual finish.
  No position, velocity, crate or enemy state is changed during traversal.
  Optional high cargo is tested separately; this is not an all-crate main clear.
- [Full-render bonus journey](evidence/bonus-beachside-run-full-journey.json):
  all 26 crates, zero deaths, completed finish, no console errors or failed
  requests. The native version takes 7,370 fixed steps (122.83 simulated seconds).
- [Cargo scenarios](evidence/cargo.json): the high parcel is collected before
  its launcher (110 steps), and the wood cap/TNT/refuge sequence succeeds
  (280 steps). Each case declares its own initial position, then uses only
  ordinary inputs. Neither case dies or changes crate state directly.
- Ferry phase cases start independently at the waiting quay, with delays of
  [0](evidence/ferry-phase-0.json), [2.4](evidence/ferry-phase-2.4.json),
  [4.8](evidence/ferry-phase-4.8.json) and
  [7.2 seconds](evidence/ferry-phase-7.2.json). Each crosses the ferry and
  breakwater and reaches the real finish without death. These four traces
  precede the final visual raft skin; its collider and motion parameters are
  unchanged. The subsequent complete Chrome journey covers the final skin
  and corrected sand shelves. A redundant phase rerun was stopped to reduce
  shared-machine contention; it is not counted as another pass.
- [Chrome lifecycle smoke](evidence/lifecycle-lite.json): real keyboard
  movement, spin activation of a checkpoint, walking into a lagoon gap,
  the death animation and automatic recovery at the banked checkpoint,
  plus parent/bonus entry and return. Retro mode correctly spends one reserve
  life on the fall; it does not increment the Modern-mode death counter.

The full-render views cover the coastal arrival, split pier, high parcel,
Nitro lane, ferry, breakwater and finish, plus three bonus locations. Both
MAX/native (actual 1600×1000 drawing buffer at DPR 1) and normal 720-line
presentation are captured. View fixtures declare isolated starts; they are
visual evidence, not traversal evidence. See
[main view measurements](evidence/beachfront-full-views.json) and
[bonus view measurements](evidence/bonus-beachside-run-full-views.json).

Representative images: [bonus arrival](evidence/bonus-arrival-full-native.jpg),
[bonus cargo](evidence/bonus-high-cargo-full-native.jpg),
[bonus machinery at normal resolution](evidence/bonus-wharf-full-normal.jpg),
[high parcel](evidence/main-high-parcel-full-native.jpg),
[timber ferry](evidence/main-ferry-full-native.jpg) and
[finish island](evidence/main-finish-full-native.jpg).

Automated input pilots establish feasibility, not novice usability or an FPS
benchmark. Browser runs use fresh storage and the local Vite game. Headless
native tests stub media loading; the separate Chrome checks use real assets.

## Reproduction

Use the repository's installed Node dependencies. Start Vite on port 5318.
The browser harness imports `playwright`, or accepts `PLAYWRIGHT_MODULE` for
the bundled runtime's absolute module path. Evidence defaults to this
directory's `evidence/`; `BANANA_BAY_OUTPUT` can redirect it.

During active release coordination, run new heavy commands through the primary
checkout's `.release-queue/run_heavy.py --owner <chat-id> -- <command>` two-slot
guard. The already-running final serial check/build pipeline predates that
capacity policy. All completed task-owned automated browsers are closed.

```sh
node tools/test-sunny-beach.mjs
node tools/test-banana-bay.mjs
node tools/test-banana-bay-cargo.mjs
node tools/test-banana-bay-route.mjs --ferry --phase=0
# Repeat the isolated ferry check with 2.4, 4.8 and 7.2.
node tools/banana-bay-browser.mjs --smoke
node tools/banana-bay-browser.mjs --journey
node tools/banana-bay-browser.mjs --journey --bonus --full
node tools/banana-bay-browser.mjs --full
node tools/banana-bay-browser.mjs --bonus --full
npm run check:levels
npm run build
npm run check:release
```

The task environment executes the exact package script strings with the
bundled Node/tool binaries. No install, dependency update or `check:all` run
is part of this iteration. Logs remain local; `verification.json` records
the final exits, measured results and source hashes.

## Integration boundaries

- `src/level.ts`: only the `SUNNY_BEACH_END_Z` import and the native ocean-tail
  loop bound change. There is no physics, input, lighting-system or tuning edit.
- `src/levels/themed-bonuses.ts`: one import and one beachfront-only dressing
  call. Preserve other bonus owners' changes when integrating.
- `tools/puzzle-switchyard-pilot.mjs`: recognize an existing woodpath's top
  without assuming every receiving shelf is a centred box.
- `public/levels.json` is untouched. Neither `beachfront` nor
  `bonus-beachside-run` exists among its 12 published overrides, so no pack
  replacement or synchronization is needed.
- All other edits are the Banana Bay source data, focused tools, research,
  evidence and an append-only `LEVEL_ITERATIONS.md` entry. Original lagoon
  crossings and movement tuning remain intact. Ordinary grindable edges keep
  their existing policy; sand shore shelves retain the original exception.

The final release-queue handoff supplies the immutable local commit. The
coordinator owns integration, any combined-build size decision and deployment.
