# Bounce crate plain lids — 5 November 2026

Removed the three-loop spring seal from the shared lid texture for wooden and
metal bounce crates. Both now expose their existing plain material on the lid;
the four side arrows remain. The same cleared atlas tile also applies to the
underside. No mesh, bounce animation, collision, reward or gameplay code changes.

The edit is confined to `src/crateArt.ts`'s top-icon branch. Native six-face
browser review confirms both materials and the side arrows. Evidence is in
`wood-six-sides.png` and `metal-six-sides.png`; the studio console is clean.

Actual game review also passes in lite/480p-CRT and full 2560×1440 rendering.
Both wooden and metal versions have bare lids and side arrows under full scene
lighting. No pending/failed assets or browser console warnings/errors.

Playable validation finished around 03:30 UTC / 16:30 NZDT, approximately
four minutes after this small follow-up began. Production build/release size
and deployed verification are recorded in the release handoff.

`npm run build` passes, including TypeScript and release asset preparation.
`npm run check:release` passes: 834,729,760 bytes within the hosting budget.
No new tests were added for this small, reversible texture-only change.
