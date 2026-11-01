# Sky Bridge stock-save recovery and release audit

2 November 2026 NZDT. The reported old course is reproducible on production
with an untouched saved 304-component Sky Bridge: build `11-01 09:57 UTC`
loads the 244 m course, gate Z=-239, three checkpoints and no cloud volumes.
The source and published source snapshot still contain the complete 423-component,
488 m course, gate Z=-483, seven checkpoints and twelve cloud volumes.

## Cause and correction

The crate-size change `087ac597` ran `migrateCrateLayout` while normalizing the
saved level registry. That changes coordinates where needed and always adds
`crateLayoutRevision: 1` before historical stock fingerprints are checked.
Every old Sky Bridge fingerprint consequently failed, so the registry treated
the stock copy as a local edit and let it shadow the current source. The same
ordering affects other courses with exact stock-copy checks.

Registry normalization now preserves the saved crate representation until
source selection. Runtime construction, editor working copies and editor-file
validation still apply the 20% enlargement exactly once. Five additional exact
Sky Bridge fingerprints recognize archives already persisted with the crate
revision. Both Ripcord representations remain recognized. Sky Bridge's editor
override indicator now agrees with the selected source. No archive is deleted
or rewritten by lookup; deliberate geometry, name and metadata edits remain
local. No source level, level-pack entry, renderer or movement tuning changed.

## Audit scope

- All 46 successful deployments in the latest 50 Pages runs, October 27 through
  November 1 UTC, remain ancestors of the latest released base `47637955`.
- All eight published pack revisions from the October 29 Sky Bridge extension
  through that base retain exactly the same complete Sky Bridge entry hash.
  Subsequent changes affect only Carlisle Coast and Rooftop Relay.
- Sky Bridge main and bonus source files are unchanged from extension commit
  `5c444d8e`. Their feature worktrees are clean, and their latest source commits
  are already in main. No level source files were deleted in the audited window.
- Production's compact sync pack intentionally omits source-identical levels;
  its provenance lists Sky Bridge among the twelve bundled source levels.
  The two retained published overrides are Flats and the Temple bonus.

This audit found a selection regression, with no evidence of a lost release or
an older whole-pack overwrite in that window. Detailed hashes, deployment
ancestry, all five failed historical fixtures and production reproduction are
in [audit.json](audit.json).

## Validation

Focused stock tests cover all five Sky Bridge generations in original and
already-migrated form, 70 authored Sky Bridge variants, archive retention,
Carlisle/Ripcord selection and deferred editor stack expansion. Cross-course
checks cover Custard v1–v5, six Country Club revisions, Drowned Crown, legacy
edge defaults and retired Slipstream saves. The crate dimension test exercises
six-high stacks, collapse/reset, collision and capture/reload. Import-security
and level-sync checks cover bounded validation and failed-restore preservation.

Two old stock test assumptions were corrected: Custard's measured Chrome
indices belong to the pinned v5 fixture, while its current waterfall revision
is compared to the published snapshot; Slipstream now targets the canonical
`slipstream-race` identity. Neither changes level content.

Production build/type checking and release-size validation pass. The candidate
contains 999,248,285 bytes against the 1,000,000,000-byte hosting budget.
Packaged lite browsers pass fresh, old, already-migrated, reloaded and edited
save cases. Native 1600×1000 rendering shows all twelve main clouds and seven
checkpoints; the extension completes both grinds, both board jumps and four
checkpoints with zero bails. The normal 720p view and bonus retain their clouds
and supported landings. All browser consoles are clear. Reports are in
[validation.json](validation.json). No full suite or unrelated level/physics
audit was run. Final publication evidence is recorded in the release handoff.

## Timing

The defect was traced and a production reproduction captured before changing
any level data. The first packaged cached-save recovery passed at about
20:11 UTC, approximately 28 minutes from the investigation start.
