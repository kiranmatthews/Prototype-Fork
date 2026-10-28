# Beach kite integration and release — 28 October 2026

The replacement user instructions retire coordinated publishing and resume
owner publication. This record follows the earlier local-only handoff; it does
not change that historical evidence.

The validated source commit `5ddbc4997ce90b1777bce0054f2030563d6a44f4` was
cherry-picked cleanly onto `origin/main` at
`aac956ab544572811e0787815450ce8718e09343`, producing
`b34dffe299f06f59d901f4c0220f2b615b229aba` on `codex/beach-kite-release`.
The original branch remains `codex/beach-street-excellence`. The five changed
runtime/level files have exactly the same Git blobs as the validated source.
Newer shared `main.ts` and `level.ts` changes on main are preserved.

Strong wind now holds each target for 3.5–6.5 seconds and changes smoothly.
Lateral steering remains at 9 m/s with the original response. Forward speed
increases remain, and the maximum slowdown threshold is one second. See the
[complete feature evidence](../kite-spring/README.md) for the earlier full
course, controls, bonus-retry and framing validation.

## Combined candidate verification

- Native spring/manual/contact/gaze/boundary checks pass (`native-spring.json`).
- Native controls, bonus entry and on-foot finish checks pass
  (`native-controls.json`).
- Native connected 3 km traversal passes all 13 jumps, ten checkpoints and
  24 main-course boxes (`native.json`).
- Required `check:levels` and production build pass (`release-checks.json`).
- Release output is 1,847 files and 997,040,791 bytes, within the existing
  1,000,000,000-byte host limit.
- A fresh Chrome full-render preview traverses the first 215 m against the
  delivered level pack without restoring or replacing its source. It passes
  with no crash, console/asset errors or clipped canopy. Both captures use
  native 1600×1000 rendering and were visually reviewed
  (`local/browser-full-preview.json`).

The combined build is `Codex/sol fork · build 10-28 08:47 UTC`, offline version
`4af446aebe8e0704b2a4`, entry `assets/index-aIxY8ysn.js`. Integration checks
started at 08:43 UTC and the rebuilt browser check completed at about 08:51
UTC. The final user corrections were already browser-playable at 08:20 UTC;
this additional time covers release integration and verification.

`verification.json` records the exact source and evidence hashes. The older
feature manifest remains intact and identifies its original shared-runtime
base. No global tuning, public level-pack overwrite, unrelated source changes
or `check:all` run is part of this increment.

The browser runner now accepts `--published` so deployment verification tests
the actual freshly loaded level rather than restoring a built-in copy. Public
verification is recorded separately after the matching Pages run succeeds.
