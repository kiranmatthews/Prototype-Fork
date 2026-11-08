# Jak-style suspension bridges

Reference: OpenGOAL Jak 1, pinned v0.3.9 commit `b6c8430c0b0a5cb139b939bcf0ffd25285b896c7`:

- [ropebridge.gc](https://github.com/open-goal/jak-project/blob/b6c8430c0b0a5cb139b939bcf0ffd25285b896c7/goal_src/jak1/engine/common-obs/ropebridge.gc): tuning, spring integration, rider forces, impacts, joint transforms and collision/rider updates.
- [effect-control.gc](https://github.com/open-goal/jak-project/blob/b6c8430c0b0a5cb139b939bcf0ffd25285b896c7/goal_src/jak1/engine/game/effect-control.gc): left/right walk/run and landing material sounds. The bridge solver does not run a separate creaking loop.
- [ISC notice](OPEN_GOAL_LICENSE.txt).

`src/ropeBridgePhysics.ts` ports the unusual squared-distance spring law, .16384 stiffness, .018 spring mass, .97 friction per tick, 60 Hz integration, pinned ends, approximately 2 m spring spacing, 12 m rider/impact influence, 2–19 m/s impact scaling and 200 ms impact debounce. Positions and velocities convert 4096 GOAL units to one metre. Forces are integrated into velocity once per fixed tick, then velocity into position with 1/60; multiplying both stages by dt would change the response. Multiple riders sum their loads. Slams apply the original stronger impact.

Our deliberate adaptation is to subtract the unloaded gravity equilibrium, preserving the authored deck heights and jump gaps. The original gravity-loaded parabolic reference and its residual force remain internal to the solver. Current source bridges are shorter than or comparable to the original 32/36/52/70 m variants. Existing single grind-rope amplitude values scale their displacement; suspended board bridges use the original unit gain. Their authored break timers remain intact.

`bridgeSpan` gives two shared world-space pinned anchors to related components. The runtime clips the original collision triangles into rigid board-sized strips, preserves exterior grind boundaries, animates each intact visual plank and ice/lashing instance, deforms the complete ropes and carries the rider with the contacted board. Fixed platform-side boxes are replaced with moving triangle side contacts. Crumble membership controls collision and edge activation. Sitting hazards follow the deck. All full-detail geometry remains available at every distance and in reflections; the original game's LOD substitutions are not ported. Editor move/rotate/scale operations carry the anchor data.

Coverage:

- Sky Bridge: all 16 timber/ice/rotten deck pieces, 16 upper hand ropes, lower bearers, lashings and icicles; four later timber run-ups are included.
- The Drowned Crown: both sloping halves of the escape suspension bridge, full existing Meshy planks and both segmented cables; the intentional missing-board gap remains open. Treasury staging offsets move its anchors too.
- The shared `rope` primitive automatically uses the new solver in Island Hopper, Treehouse Trail and any saved/custom/bonus level. Single grind ropes retain their route and do not acquire a board deck.
- Cloudtop Lockers currently uses cloud and masonry platforms. Other inspected bonus bridges are switch platforms, rigid catwalks or falling sluice decks, rather than suspension bridges; they retain their existing behaviour.

The three 48 kHz mono WAVs in `public/sfx/rope-bridge/` are **temporary original Jak recordings**, explicitly requested by the user on 8 November 2026: `walk-crwood1`, `walk-crwood2` and `land-crwood`. `tools/rope-bridges/extract-sfx.py` reads the local COMMON.SBK using the existing PS-ADPCM decoder, preserving tone pitch, relative gains and delayed creaks. The manifest records source/effect names, hashes, tone offsets, duration, levels and clipping checks. These audio placeholders are separate from the ISC-licensed source-code port and should be replaced for a final original release. Playback follows actual left/right foot contacts and landings, with no invented idle creak loop.

Focused checks: `node tools/test-rope-bridge-physics.mjs`, `node tools/test-rope-bridges.mjs`, `node tools/test-sky-bridge-construction.mjs`, `npm run check:levels`, and `npm run build`. Browser evidence and elapsed time are recorded in `docs/LEVEL_ITERATIONS.md`.
