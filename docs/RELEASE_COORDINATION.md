# Coordinated release — 25 October 2026

The **Remap treehouse stair controls** chat owns integration, the single push to
`origin/main`, and Pages verification for this batch. Feature owners finish and
validate their work locally; they do not push or manage deployment runs.

## Work queue

| Work | Source / owner | State |
| --- | --- | --- |
| Stair input mapping and balcony/stair skateboard restriction | `13261d3c`, `73f9a66b` | Implemented and validated; included in main |
| Larger Treehouse halfpipe and closed timber structure | `8b8fc220` | Committed locally; native, Chrome lite/full, lifecycle and level checks passed |
| Treehouse ocean approach, short swimming margin and clean sand–water edge | **Build a crumbling cave chase level** chat | Recovered from the user's queue; owner implementing and validating locally |
| Restored rounded treehouse; boxy cabin reused on the right bank of the later beach by the huts | Coordinator | Completed in `09b1c7b1`; native coast clearance/collision and lite/full stair checks passed |
| Fitted invisible barriers around Treehouse trunks | **Rebuild merchant wreck interior** chat | Recovered from the user's queue; owner measuring models and implementing locally |
| Crumblewake Cave and procedural collapse | `92c611db` | Implemented and validated; live verification pending |
| Doubled merchant wreck and side gallery | `8c875b12`, `610d24d2` | Implemented and validated; live verification pending |
| Jungle Ruins aqueduct and climbing finale | `872db2ab` | Implemented and validated; live verification pending |
| Temple of Embers puzzles, patrols and support | `a4c0706e` | Implemented and validated; live verification pending |
| Country Club leader-biased cart crossings | `3a379b67` | Implemented and validated; live verification pending |
| Coconut Cart Rally | `7860613c`, integrated by `d5e7e7b8` | Implemented and validated; live verification pending |
| Procedural green start/finish beacons | `a25eca7e` | Implemented and validated; live verification pending |
| Race fixture isolation | `5144d576` | Retained in release base |
| Slipstream final scenery correction | `codex/slipstream-island-correction`, starting at `b783cfe2` | Owner finishing rock silhouettes, final review, documentation and validation; local commit requested |
| Skystream crate placement | `9cff02ef`, integrated as `ffc79e5b` | Completed and integrated; 67/67 crates/checkpoints in one forward native and full-render run; owner level checks/build passed |

The earlier completed feature commits are retained from `5144d576`. The
coordinator branch `codex/consolidated-release-20261025` adds the halfpipe,
house restoration and Skystream, while the final shoreline, trunk and
Slipstream passes are being completed locally.

## Recovery and preservation

Before integration, 189 changed or untracked files in five worktrees were
archived (268,306,736 bytes of source and evidence). Original worktrees remain
intact. Local rescue branches under `codex/rescue-20261025/` protect 28 worktree
heads, including five snapshot commits made using separate temporary indexes.
The actual working copies and their indexes were not altered by those snapshots.

The original file archives, SHA-256 manifest, protected-ref manifest and verified
incremental `recovery.bundle` (125,366,110 bytes) are in
`/private/tmp/prototype-release-rescue-20261025-0612/`. The bundle uses the existing
`origin/main` history as its prerequisite. The rescue refs also retain redundant
race fix `8a588d23` and superseded Slipstream commit `bde0d0cb`; do not apply those
in addition to their replacements.

`codex/slipstream-release-candidate-20261025` at `a00f74a4` preserves an initial
integration of `b783cfe2` onto `5144d576`. It resolves the published level pack by
level ID so no other course is replaced by an old snapshot. The canonical
Slipstream worktree contains later refinements; merge those once validated.

## Deployment queue

Superseded runs `40167676488` and `40167391713` were cancelled by the coordinator.
Keep the existing `pages` concurrency group with `cancel-in-progress: false`.
Do not push intermediate feature commits separately. Validate the complete
release, push once, then verify the public `Codex/sol fork` build and affected
features. No full `check:all` run was requested.

## Recovered queue references

The six Treehouse requests are tracked above: stair controls, expanded/closed
halfpipe, ocean approach/swimming, rounded house plus relocated cabin, water
clipping, and fitted trunk collision. The two screenshots and 2,027-frame
replay supplied later are archived with hashes in the rescue directory’s
`recovered-inputs/` folder. The user clarified that the reused cabin belongs on
the right bank of the later beach beside the huts, not the opening clearing.
