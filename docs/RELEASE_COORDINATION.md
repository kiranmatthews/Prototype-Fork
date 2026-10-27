# Release coordination — 27 October 2026

**Coordinate local work and releases** (`01a17b2e-3553-70e0-abb3-0bcc400dcc1b`)
is the sole active release coordinator, as requested by the user. This section
supersedes the ownership and pending statuses in the historical record below.
Other chats keep working locally and hand off immutable, validated commits.
They do not push to `origin/main`, dispatch duplicate workflows, or watch GitHub.

## Shared inbox and ownership

The live queue is local and ignored by Git:
`/Users/kiki/Documents/ChatGPT/Prototype Fork/.release-queue/`.
`coordinator.json` records the coordinator and current release state; each feature
owner writes only `<thread-id>.md`, using `HANDOFF_TEMPLATE.md`. Use `WORKING`
until a coherent increment is committed and tested, then `READY` with exact SHAs,
branch/worktree, owned files, dependencies, validation evidence and exclusions.
The coordinator records integrated/published SHAs in the state file. Updating a
handoff must not erase a previous unpublished SHA; list the new increment after it.

New work belongs in a task worktree. The original checkout contains old mixed
work and must not be reset, stashed or committed wholesale. Each worktree has its
own build output: `npm run build` prunes and rewrites `dist`, so simultaneous
builds in one directory are unsafe. Shared files require ownership coordination,
especially `src/main.ts`, `src/level.ts`, `src/player.ts`, `src/audio.ts`,
`package.json`, `public/levels.json`, and the iteration log.

## Integration and scheduling

1. Discover active chats for this repository and onboard each once. Read compact
   progress snapshots and local handoffs, not long histories or repeated logs.
   Do not wake completed chats merely for acknowledgements.
2. Integrate only `READY` immutable commits in a clean coordinator worktree based
   on current `origin/main`. Check ancestry first so already published commits are
   not applied again. Merge coherent branch history or cherry-pick declared
   feature commits; preserve dependencies and review conflicts explicitly.
3. Batch compatible increments that are ready together. Allow up to five minutes
   to combine work that is explicitly near ready; do not hold a ready feature
   indefinitely for unfinished work. Never push while a prior Pages deployment
   is running. Continue local integration while GitHub works.
4. Merge published level data by level ID or run the owner's focused synchronizer.
   An old full `public/levels.json` copy must not replace newer levels. Keep the
   iteration log append-only across feature owners.
5. Reuse checks and browser evidence for unchanged commits. Feature owners run
   `npm run check:levels` after changing level data. The coordinator may reuse
   that result when the final level sources, registry and exercised shared paths
   match the validated source; record exact commit/blob evidence. Rerun the
   invalidated checks for semantic conflicts or changed shared behavior. Run
   `npm run build` and `npm run check:release` on the final combined candidate.
   Smoke-test affected behavior in a real browser,
   including full rendering; review changed visual work at MAX/native resolution.
   Inspect console errors. Never run `check:all` unless the user requests it.
6. Fetch/recheck `origin/main` before the single push. If it moved, integrate it
   locally and repeat only invalidated checks. Push the validated candidate with
   ordinary fast-forward semantics; never force-push `main`.
7. Only the coordinator checks the matching workflow run. Poll with backoff or
   bounded waits, once per batch, while doing useful local work. Preserve the
   existing `pages` concurrency group and `cancel-in-progress: false`.
8. Success means the matching run succeeded AND the public page serves the
   expected release/build with `Codex/sol fork`, affected features work, and the
   console is clean. Record the commit, run URL, public version/stamp and evidence.
   Report failures once with the actionable cause; owners keep working locally.

## Shared Mac validation capacity

During this local coordination, use the ignored shared helper
`/Users/kiki/Documents/ChatGPT/Prototype Fork/.release-queue/run_heavy.py`
for new production builds, large native scene/physics checks and full-render
browser checks. Invoke it with `python3 <helper> --owner <chat-id> -- <command>`.
It allows two heavy foreground jobs across chats and releases their leases when
they exit. Keep light authoring, source review and small checks independent.

If the helper returns exit 75, continue independent work and note the required
job in your handoff; do not poll or spin. The coordinator schedules available
capacity. Close finished task-owned test browsers and preserve evidence in the
worktree. Idle resource waits do not count as productive greybox time. Do not
stop another chat's processes or the user's browser. This local limit addresses
the confirmed memory-pressure crash and does not change runtime asset fidelity.

## Initial state

- Current successful release: `37b69e6524faa1b448772b18107c818aac3a43f8`,
  [Pages run 40433868942](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/40433868942).
- **Add chaotic golf kart controls** is working on kart bailout animation in
  `codex/kart-drivers-thrusters`; local handoff requested. Earlier kart work is
  already published. Do not import the primary checkout's duplicate old copies.
- **Transform rooftop level with Crash 4** is idle and its completed roof/UV work
  is already published. No release wait or acknowledgement is needed from it.
- The existing Pages pipeline is already install → build → release-size check →
  deploy. It needs no change for this coordination.

---

# Historical coordination record

# Coordinated release — 25 October 2026

The **Remap treehouse stair controls** chat owns integration, the single push to
`origin/main`, and Pages verification for this batch. Feature owners finish and
validate their work locally; they do not push or manage deployment runs.

## Work queue

| Work | Source / owner | State |
| --- | --- | --- |
| Stair input mapping and balcony/stair skateboard restriction | `13261d3c`, `73f9a66b` | Implemented and validated; included in main |
| Larger Treehouse halfpipe and closed timber structure | `8b8fc220` | Committed locally; native, Chrome lite/full, lifecycle and level checks passed |
| Treehouse ocean approach, short swimming margin and clean sand–water edge | `f9867ee6`, integrated as `8dd3f98d` | Completed; 10 swim/return journeys, 1,001 dry-sand probes and lite/full browser checks passed |
| Restored rounded treehouse; boxy cabin reused on the right bank of the later beach by the huts | Coordinator | Completed in `09b1c7b1`; native coast clearance/collision and lite/full stair checks passed |
| Fitted invisible barriers around Treehouse trunks | `1975cd8e`, integrated as `f03df4a0` | Completed; 42 fitted walls, 168 capsule sweeps, contact/traversal and lite/full browser checks passed |
| Crumblewake Cave and procedural collapse | `92c611db` | Implemented and validated; live verification pending |
| Doubled merchant wreck and side gallery | `8c875b12`, `610d24d2` | Implemented and validated; live verification pending |
| Jungle Ruins aqueduct and climbing finale | `872db2ab` | Implemented and validated; live verification pending |
| Temple of Embers puzzles, patrols and support | `a4c0706e` | Implemented and validated; live verification pending |
| Country Club leader-biased cart crossings | `3a379b67` | Implemented and validated; live verification pending |
| Coconut Cart Rally | `7860613c`, integrated by `d5e7e7b8` | Implemented and validated; live verification pending |
| Procedural green start/finish beacons | `a25eca7e` | Implemented and validated; live verification pending |
| Race fixture isolation | `5144d576` | Retained in release base |
| Slipstream final scenery correction | `b783cfe2` + `375a81ee`, integrated through `ce5986d6` | Completed; protected gameplay fingerprint, 15 production views, all tunnels, level checks and build passed |
| Skystream crate placement | `9cff02ef`, integrated as `ffc79e5b` | Completed and integrated; 67/67 crates/checkpoints in one forward native and full-render run; owner level checks/build passed |

The earlier completed feature commits are retained from `5144d576`. The
coordinator branch `codex/consolidated-release-20261025` adds the halfpipe,
house restoration, Skystream, shoreline, trunk barriers and final Slipstream
scenery. All feature owners have completed their local handoffs.

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

## Final integration gate

The combined source through `8dd3f98d` passes required `npm run check:levels`,
`npm run build`, release-size validation, exact published-level synchronization,
Slipstream's protected gameplay fingerprint, Treehouse swim/return and dry-sand
checks, fitted trunk contacts/routes, and the relocated cabin's coast clearance.
The combined production build also passes Chrome lite/full swimming and
full-render house/shore inspection, with no console errors or failed assets.
The local production stamp is `Codex/sol fork · build 10-25 07:10 UTC`; the
897.2 MiB package contains 1,682 files (offline version
`79fe2b59d5c8ce8484c1`). No `check:all` was run.

A second verified recovery bundle at
`/private/tmp/prototype-final-rescue-20261025-071123/` preserves 22 existing
worktrees, including 226 changed/untracked files (291,495,157 bytes) in five
dirty worktrees. Their original working copies and indexes were untouched by
capture. Protected refs are listed in that directory's manifest. Preserve the
primary checkout's old dirty state in a named stash before its fast-forward;
do not reapply older duplicate implementations over this integrated release.

Publish this consolidated branch once through `origin/main`, then verify the
actual public URL `https://kiranmatthews.github.io/Prototype-Fork/`. Before this
release, the public entrypoint was still the 02:33 UTC build. Live verification
remains the final handoff gate; a local build is not proof of deployment.

Coordination preference: the user permits coordinating unfinished work in its
own chat, but this chat must do its own future tasks. The two already-started
Treehouse handoffs were permitted to finish after the user clarified that limit.

The initial consolidated push `f5dc912e` reached Pages run `40172277711`, which
correctly stopped on six new solid halfpipe panels inheriting a visual-only
grinding opt-out. The coordinator restored ordinary exposed-rim grinding on
those panels. The unchanged edge audit now passes 7,285 boundaries and 46
catches; native and full-render traversal, level checks, build and release size
also pass. The correction preserves every integrated feature and uses the same
single publishing workflow. The earlier shared checkout is additionally safe
in stash `0e575895dc50e5974cdcb2565e39d69fca634852`; never reapply its superseded
implementations over this release.
