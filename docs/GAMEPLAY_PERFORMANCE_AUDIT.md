# Gameplay and loading audit — 9 October 2026

The ongoing goal is lossless gameplay/loading performance and smoothness across the game, checking every level individually. This first pass uses the current published catalog at `bdc5370`: **55 levels**, including all bonus rooms, the map, the boss and both competitions. Work is isolated from the original checkout's unrelated edits.

## Validated changes

- Nightworks collision trees are reused only when local position/index buffers have identical bytes and attribute formats. Dimensions, yaw, winding or vertex changes receive a different tree. Each moving/phase rock keeps independent bounds, motion and enabled state. The level releases the cache when disposed. Nightworks uses **21 trees for 62 solids**; After Hours uses **20 for 29**.
- The rock collision broad phase reuses temporary boxes/vectors, removing seven temporary objects per eligible rock per query. Capsule sweeps, contact order, contact depth, push-out, active phases and motion are unchanged.
- Covered GPU warm-up still draws every eligible mesh in batches of at most 24. Cheap batches share a **4 ms CPU budget** instead of requiring two browser refresh intervals apiece. Expensive batches yield individually. GPU fences, scene/renderer restoration, complete destination preparation, input locking and the authored minimum loader duration remain intact.
- Remove an unnecessary `toNonIndexed()` call on an already non-indexed dodecahedron. Three returned the same geometry; the redundant conversion emitted warnings in affected levels.

There are no movement-tuning, geometry, animation, texture-resolution, shadow-quality or render-resolution changes.

## Repeated browser measurements

Three rounds, alternating before/after order, isolated Chrome contexts, Apple M1 Pro / ANGLE Metal, 1280×720 viewport, DPR 1, unchanged 720p/1× fixed-60 preset and full rendering. Loading includes the normal cover/vortex/preparation/reveal sequence. Construction is measured separately; it is not network time. Values are medians and should not be extrapolated to a physical phone.

| Level | Construction before → after | Menu transition before → after |
| --- | ---: | ---: |
| Treehouse Trials | 664 → 654 ms | 6,328 → 5,629 ms |
| The Nightworks | 2,357 → 866 ms | 6,344 → 4,809 ms |
| Nightworks: After Hours | 1,219 → 849 ms | 5,142 → 4,779 ms |

The construction reductions are **63%** for Nightworks and **30%** for After Hours. Treehouse's **11%** transition reduction comes from warm-up scheduling; its small construction difference is measurement variation. Most small levels already meet the authored loader minimum, so this change does not claim faster visible transitions for them. Steady-play frame timings remain at the existing 60 Hz cap.

## Verification and boundaries

- All 55 levels completed both the unchanged lite and full-render load/profile passes, with zero console errors. All **145 checkpoint** positions supported the player in each pass. The same 55-level full-render pass on the optimized source retained supported spawns/checkpoints and a clean error console.
- The initial audit used forward input everywhere; horizontal bonus/puzzle courses need Right/Left. The audit now selects the authored side-scroll direction. Production lifecycle results separately verify native movement, checkpoint respawn and finish behavior. Do not count an incorrect Up-input probe as successful traversal or as a game defect.
- Exact collision regression: **634 contacts, 2,182 misses and 96 moving/phase sweeps** match independently built Three.js collision trees without an epsilon. Tests also cover modified vertices, changed winding, changed sizes/yaw and level disposal.
- Loading regressions cover every warmed mesh, fast/expensive batches, GPU completion/loss, exceptions, renderer/scene restoration, loading duration, nested asset readiness and input release. Update the existing callback-shape assertion to recognize the current completion wrapper, which still calls `guardGameplayFromMenu()`.
- The exact `check:levels` commands and production type-check/build passed. npm is absent on this host, so the package script's Node entry points were invoked directly. No full-suite run.

Two existing Nightworks checks fail identically on unchanged `bdc5370` and the optimized tree. `test-nightworks.mjs` expects the old zero-height spawn floor, before the raised arrival pad. The After Hours pilot misses the second counterweight at fixed tick **2,096**, ending at `[90.66642352087555, -35.55261672061277, -373.16020697348523]`. The complete before/after failure report is identical. These failures have not been hidden or weakened; the pilot/current gameplay mismatch still needs investigation.

## Remaining goal work

The goal remains active. Entry/checkpoint/lifecycle probes do **not** prove a complete intended traversal of every course. Continue the individual course traversal audit and investigate the After Hours pilot failure. The paired browser trace also identifies pre-existing first-play shader/buffer allocations in both Nightworks courses, identical before and after this change. The follow-up owner trace locates phase-rock wireframe buffers on the first update, transparent effect materials, fruit material variants and the HUD composite texture. Remove avoidable first-use work without changing when these objects appear. Repeated level-return residency, touch/portrait and graphics-recovery checks remain part of the broader smoothness audit.
