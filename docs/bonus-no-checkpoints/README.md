# Bonus levels without checkpoints — 28 October 2026

Removed the eight checkpoints inherited by bonus puzzle layouts. The shared
bonus adapter now drops donor checkpoints; the ordinary puzzle sources keep
them. Loading any bonus room also strips legacy checkpoint components from
saved/imported data and editor captures. Parent box-gem totals exclude removed
checkpoints. Bonus success still banks its return state in the parent course.

| Bonus | Removed checkpoints | Remaining reward boxes |
| --- | ---: | ---: |
| Fern Reliquary (`bonus-jungle`) | 2 | 20 |
| Lifeguard Lockup (`bonus-beachside-run`) | 2 | 24 |
| Rooftop Deliveries (`bonus-coastal`) | 4 | 32 |

All 25 source/published bonus entries are checkpoint-free. No published level
snapshot, movement tuning, scenery or main-level checkpoint was changed.
Prompt to playable with full browser validation: approximately 16 minutes.

## Validation

- `tools/test-bonus-checkpoint.mjs`: passed legacy import, editor round-trip,
  retry at spawn, exact box target, ordinary checkpoints, successful/failed
  bonus returns and repeated real-Player parent respawns.
- `tools/test-bonus-masks.mjs`: all 40 cases passed.
- Input-only complete journeys passed for all three changed rooms, collecting
  every box, with zero checkpoints and zero deaths. Jungle: 82.23 simulated
  seconds; Beachside: 119.82 seconds; Coastal: 146.93 seconds.
- The package's `check:levels` command passed. The package's build command
  (`tsc --noEmit && vite build`) passed, using the bundled Node runtime directly
  because npm is not on this host's PATH. Offline version:
  `8185038211e5a73c75f9`, 948.2 MiB.
- `tools/test-puzzle-bonus-browser.mjs`: six production Chrome cases passed,
  all three changed rooms in lite and full/MAX 1440×900 rendering. Supported
  spawns, keyboard side movement, standing at former checkpoint locations,
  disabled checkpoint warps, fall recovery to the entrance and finish-gate
  triggers passed. No console, page or WebGL errors. Full and normal crossing
  screenshots were visually reviewed.
- Production stamp: `Codex/sol fork · build 10-28 07:32 UTC`.

[Structured results](validation.json), [browser evidence](browser/report.json),
[focused checks](focused.txt), [remaining journeys](journeys.txt),
[level-check summary](level-checks.txt), [build summary](build.txt).
The native journeys use the shared production Player/input pilots. Browser
crossing/finish placements exercise local support and triggers; they are not
presented as input-only playthroughs.

## Existing test limitations

The older combined bonus-flow test stops at its expectation that Skystream has
a unique bonus. The unchanged starting commit already resolves Skystream to
Easy Street. The older donor-equivalence test passes Jungle, then expects
Beachside platforms to remain meshes; the starting commit already replaces
those with Banana Bay woodpaths. Both mismatches were confirmed by bundling
the original sources from `aac956ab544572811e0787815450ce8718e09343`.
They were left outside this task. Separate current-layout native journeys,
the checkpoint/mask regressions and the six browser cases pass. No full
`check:all` was run.
