# Final combined release candidate

Main advanced to `3010206b25b932534e3395ec0c4fc6d3caa37f7d` (Sky Bridge bonus
construction) during the first candidate's verification. Merge `d5217281`
preserves that commit and the validated Beach increment. The only conflict was
the append-only iteration log; both complete entries were retained.

All five Beach source blobs, shared player/main/level runtime, and Beach level
registry remain unchanged from the first verified candidate. The new bonus
decoration is guarded by `parentId === 'sky'`, after the existing coastal
branch, and cannot change the Beach course or linked bonus. The Sky Bridge
owner's required level checks and browser evidence are retained in the merge.
No semantic conflict invalidated those checks or the Beach native tests.

The final combined production build and release-size checks pass: 1,847 files,
997,043,765 bytes, below the existing 1,000,000,000-byte limit. Fresh full-render
Chrome again passes the first 215 m with the actual delivered level pack,
without a source restore. No crash, console/asset error or canopy clipping;
hand attachment error remains below 0.022 mm. Native 1600×1000 captures were
visually reviewed. The visible local preview also reports the final stamp and
an empty error console.

Build: `Codex/sol fork · build 10-28 08:53 UTC`; offline version
`50ebdf5b2f0bc540abd9`; entry `assets/index-DL0X7OtM.js`. Build started at
08:53 UTC and the final browser check completed at 08:54:49 UTC. Source and
evidence hashes are recorded in `verification.json`. This directory records
the final local candidate; public verification is saved separately after
deployment.
