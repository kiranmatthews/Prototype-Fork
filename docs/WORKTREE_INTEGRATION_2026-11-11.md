# Worktree integration and orphan audit — 11 November 2026

## Correction: the requested effect was heat distortion

The requested Jak effect is the **transparent framebuffer heatwave**, already
completed by the chat **Recreate the course desert section** in commit
`afb40ace3064a9c0d9c323de4e546c675dd1b883` (9 November), on
`codex/flame-heat-distortion`. That commit was already an ancestor of main.
The previous integration (`d281ae70`) incorrectly interpreted the request as
replacing torch artwork with new particles. This recovery removes that particle
implementation and restores the torch factory and green-eco module exactly to
`91fe4413`, including their original heatwave attachment.

The original `flameHeatDistortion.ts`, `flameHeatSource.ts`, kart `templeJets.ts`
and `gouraudFire.ts`, `templeBreath.ts` and fireball integration are byte-identical
to `afb40ace`. No replacement shader or new visual tuning is introduced.

Original coverage:

- Every shared torch, including phase flames, moving braziers and tiki crowns.
- Kart blaster/boost jets and burning wrecks, following the travelling packets.
- Tiki breath and enemy fireballs.
- TNT/nitro explosion fire, excluding cold smoke.

The original pass copies the world framebuffer, refracts it through the Jak
11-slice distortion geometry, then draws the flame meshes. It depth-tests against
foreground geometry, uses one instanced distortion draw, and skips cold, hidden
or culled sources. The original implementation and its focused tests remain the
authority. `npm run check:flame-heat` now exposes that existing test directly.

`fa688e9d` also added Dusty Road heat coverage. Later, `db001d61` deliberately
removed those desert heat bands at the user's request. Their absence is intended;
this recovery does not restore them.

## Character authority and valid startup fixes

Claude's latest character movement/animation was explicitly designated as
authoritative. The integration started from main `91fe4413`, containing Claude's
idle, charge, skid, slide, low-pose, slam and ledge work. All authored movement,
animation and tuning files remain unchanged by this recovery.

Two valid ordinary-game startup fixes from `d281ae70` are retained:

- The gameplay document adapter passes the body skeleton to the existing D
  generator, while retaining the full editable board-authoring rig in the
  document. Its regression compares all generated clips with the comparison
  lab for exact equality.
- The motion loader accepts raw gzip and JSON/GLB already decoded by HTTP gzip
  handling, with explicit HTTP error reporting.

The flame-review asset base and its Labs fixture link also remain fixed.

## Audit scope and findings

The expanded audit examined **268 local/remote branch refs**, not just the ten
active worktrees. There were 274 non-merge commits outside main's ancestry and
41 maximal divergent lineages. Patch equivalence, matching published commits,
file/blob comparisons and later replacements distinguish missing work from
rebased or cherry-picked history. A further object-database scan found 44 commits outside branch/tag reachability.
These are published revisions, discarded alternatives or historical stashes. They
are now protected by local `refs/archive/orphan-audit-20261111/<commit>` refs.
Notable examples: the vector-prompt experiment `94369e43` was replaced by the
corrected Retina-canvas fix `ccabb205`; Splat Valley was published then deliberately
retired by `fccf04e9`; Carlisle beacon, camera-distance and board-test stash changes
are present on main. The per-lineage and unreachable-commit inventory is
[`ORPHAN_WORK_2026-11-11.json`](ORPHAN_WORK_2026-11-11.json).

### Actual work outside main

| Work | Preserved location | Disposition |
| --- | --- | --- |
| Temple of Embers v6 and Ember Reliquary redesign | `codex/preserved-temple-embers-v6` and `origin/claude/gifted-clarke-d9w70q`, tip `060f0c69`; content `634caa3c` | **Preserve for a separate pass**, explicitly requested by the user during this audit. Its v6 dressing pass has build/browser evidence; gameplay checks still describe v5. No Temple content is merged here. |
| Jak progress-menu HUD particle port | `codex/jak-whole-game-lab`, `8de60c29` | Initially unfinished at audit. Subsequently recovered at the user's request into **Jak particle / HUD study** (`jak-particle-study.html`). Missing extractor, real-rig, manifest, build and browser checks are now completed; only the particle-study delta was integrated. See `JAK_ASSET_LAB.md`. |
| Roo character/texture studies | `drafts/roo-character-studies`, `706925c2` / `646a2dbc` | Explicitly unfinished local study and generated-artifact snapshot; preserved. |
| Beach kite public verification evidence | `codex/beach-kite-release`, `a1f1d729` | Fourteen historical evidence files absent from main; gameplay already published. Retain the evidence branch rather than replay its older runtime. |
| Slipstream review screenshots | October rescue refs, including `6bf0266b` and `1ee86618` | Historical screenshot-only leftovers; completed scenery is on main via `ce5986d6` and earlier integration. Retain rescue refs. |
| Jungle release-race diagnostic | Rescue refs `2fa61b63` / `6fe3cc61` | Temporary diagnostic script, not a completed gameplay feature. Retain rescue refs. |

No other missing completed runtime feature was found among the divergent branch
lineages. The archived Skate packaging is superseded by the published playable
study (`9357fd78`); restoring its private-only configuration would undo later
publication and movement corrections. The older D live-tuning note is historical
validation, not an unmerged animation implementation.

### Completed work already integrated

| Original branch/work | Main evidence |
| --- | --- |
| Heatwaves / Dusty Road / rope bridge / enemy audit | `afb40ace`, `fa688e9d`, `db001d61`, `84fdb6b7`, `06efc419` are main ancestors |
| Jump/skate release | `39788711` is a main ancestor; subsequent Claude motion remains authoritative |
| Ancient Gates marathon | `b7ef2149`, `f614fcb8`, `d8bea1a2`, `ca668910` |
| Beach Street kite and course refinements | `48a89b22`, `422bb01b`, `0f892239`, `076b9a96` |
| Banana Bay and surface verification | `a1cd3fd0`, `783e6cfe` |
| Bone Head HUD | `6e70570c` |
| Crate artwork and fractures | `fc4f5723` |
| Jak eco beams / first-person HUD | `7bc3fdd2`, `1abfe4ed` |
| Jungle Ruins | `4f5639b2`, `e47c9c71`, `df6e5c77` |
| Kart loaners, skating and engine fixes | `6eaa70d7`, `8e699c7d`, `fa7ae069` |
| Motu festival / structure / palm refinements | `257daf57`, `db455c1a`, `54e191a5`, `5efce981` |
| Treehouse swimming, trunk collision and flow | `8dd3f98d`, `f03df4a0`, `a6105697` |
| Spaghetti decision-platform camera | `7d9e2556`, followed by newer course work |
| Tribal Run / Resonance Vault | `976133f4`, `470c4ce3`, followed by newer Tribal Run work |
| Waterfall Climb / Hidden Spillway | `ec1549ed`, `1c88cb4e`, `65ddf28a` |
| Haunted Hassle | `0d476fec` |
| Wumpa validation | `3f16b020` |
| Earlier renderer-roundoff and race-test fixes | Superseded by `4e02a961` and `5144d576` (later refined by `f814b1e3`); current tests retain the relevant protections |
| Preserved rail opt-out test | Main contains the original test plus later geometry-capture coverage |

The shared Documents checkout remains dirty and based on `4e1a78b0`. It is
preserved, not reset or staged. Clean task worktrees can follow the corrected
mainline; original checkpoint/rescue refs remain recoverable. No historical
branch is merged wholesale over Claude's current movement files or the current
published level pack.

## Recovery validation

- Existing shared heat tests pass: source motion, cold/hidden retirement,
  bounded buffers, depth/render order, HDR/resize and resource cleanup.
- All ten original real-GPU configurations pass: byte/HDR targets, 360/720/1440,
  fractional DPR and split viewport. Foreground, flame and outside-region errors
  are zero; zero-strength identity differs by at most one byte step.
- Actual Nightworks: 92 torch objects, ten visible heat sources in the reviewed
  view; on/off comparison changes 1,927 pixels at 720 and 8,845 at native
  2560×1440, with identical disabled control frames. Full renderer and lite have
  no console errors; WebGL error zero. The effect remains animated.

- Actual kart blasters and wrecks: 92 and 75 visible distortion packets in the
  respective reviewed frames, no dropped packets, one extra draw, zero WebGL or
  console errors. Kart scenery has independent animation, so its disabled-frame
  pixel count is not an identity test; the isolated GPU harness supplies that.
- Green-eco source/lifecycle checks, production build and release-size check pass
  (935,100,007 bytes / 1,000,000,000). No full suite was requested or run.

The local original-effect review remains available at
`http://127.0.0.1:5189/tools/flame-heat/review.html?playtest&level=dark&launchReview&nocrt&lite`.
It is correctly marked as a local authoring review in Labs. The heat effect itself
is part of the ordinary published game. Deployment verification follows in the
release handoff.
