# Half-speed airborne lateral movement

Request started 28 October 2026 at 10:14:07 UTC. The rebuilt browser check
completed at 10:19:57 UTC: approximately 5 minutes 50 seconds to playable.

Kite jumps now halve all lateral movement, including wind drift, from the
takeoff frame. Still-air steering is 4.5 m/s in flight and returns to the
existing 9 m/s on landing. The retained velocity is rescaled at each transition,
so there is no leftover full-speed sideways burst at takeoff or compounded
halving over multiple frames. Forward speed, jump height/gravity, ground
steering response, slow strong gust cadence and the one-second brake remain.
This change is confined to `src/kiteTow.ts`; no global tuning or level data edit.

Nine focused motion cases cover left/neutral/right input against both wind
directions and still air. Every airborne frame travels exactly half the
matching ground frame, forward travel matches, the jump-release frame is
already reduced, and landing restores the previous ground response.
The full native course still completes all 13 jumps, ten checkpoints,
24 main-course boxes and the crystal, then deliberately walks/jumps to finish.

Production build and release-size checks pass. Fresh full-render Chrome uses
the delivered level pack and passes the opening 215 m including the first
jump, with no crash, console/asset errors or canopy clipping. MAX/native
1600×1000 captures are retained. The existing visible in-app tab could not be
reloaded because its browser-control API was unavailable; the user was asked
to reload once. The independently verified local preview serves the new build.

Build: `Codex/sol fork · build 10-28 10:18 UTC`; offline version
`3677e6fd625bef13d007`; entry `assets/index-CxyMwRXC.js`. Release: 1,847 files,
997,070,333 bytes, below the existing 1,000,000,000-byte limit. Current published
Sky Stream and vertex-lighting work is preserved by integration merge
`8d4e0c25`. No unrelated audits or `check:all`; no level data changed.
