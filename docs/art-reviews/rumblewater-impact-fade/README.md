# Unified impact hold and fade

The original 0.55-second impact hold gains **two seconds**, giving **2.55 seconds after lens contact** before the shared 0.4-second death fade. The natural reset follows at about 4.22 seconds after the fatal collision. Water and unrelated death timings remain unchanged.

These are unaltered **2560 × 1356 Max/native** game captures with **CRT explicitly enabled**. The game canvas contains the scene, crack, HUD and shared curtain before CRT; no crack image or fade was added to these PNGs afterward. All three frames were inspected at original resolution.

- `held-0.png`: full image during the additional beat.
- `fade-0.png`: scene, HUD and glass fading together.
- `black-0.png`: the same image at the end of the shared fade.

`report.json` records three actual input-driven deaths and resets, all crack/audio variants, the hold and fade times, CRT activation and native-frame luminance (70.26 → 52.47 → 0.08 on a 0–255 scale). A production HUD pixel probe verifies that a 50% fade halves both the world and glass, while a complete fade removes both. `lite.json` covers the direct-render path and reaches exactly zero at blackout. `runtime.json` covers the longer death timing, collision suppression, one life loss, pause and other-death exclusion.

Reproduce with `tools/boulder-camera-review.html`, `?lite`, and `?gameover`; see `tools/boulder-camera/README.md`. The full review enables CRT only in its local fixture.

`water-runtime.json` and `water-browser.json` check a declared corpse-only immersion after a genuine pursuing-boulder death. The existing camera run keeps its deadline and frozen camera; ordinary water deaths retain their own timing. Reproduce in the browser with `?gameover&water`.
