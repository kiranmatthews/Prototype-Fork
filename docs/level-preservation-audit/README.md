# Complete level preservation audit

Baseline: `20917fb3359df024bd166c11f7f414924c2f0512`. Audit started 1 November 2026 UTC.

Ancient Gates was missing a completed three-commit native-art increment; the earlier marathon itself had not been deleted. A separate completed bonus-checkpoint removal was also unpublished. Exact historical stock saved in the browser could override newer source levels, and the published Jungle Terraces bonus still contained four old camera fields. This release recovers those increments and synchronizes that one bonus entry.

## Coverage

- All 805 retained Pages runs examined; all 688 successful deployment heads remain ancestors of main.
- All 688 successful source revisions evaluated or proven unchanged by the complete dependency graph: 233 distinct evaluations, 455 identical graphs, zero evaluation errors; 484 unique source snapshots.
- All 133 first-parent published-pack revisions: 121 modern packs / 156 unique entries, plus 12 retained pre-registry numeric-slot packs. No pack was silently omitted.
- All 70 current registry entries, including 25 bonuses, included in runtime checks. The baseline had 65 source-data courses and five native builders; the candidate has 66 and four after promoting the exact published Flats layout.
- All 20 existing worktrees, prunable historical checkout records, 36 non-ancestor refs and seven named stashes inspected.
- The primary checkout’s 1,410 dirty/untracked files (1,460,709,394 bytes) are all reachable as Git blobs; 980 match current main exactly and 1,037 are present in main history. Its five never-exactly-published shared source/pack files are older mixed copies, preserved by rescue refs.
- All 1,077 unique reflog tips inspected. The 143 tips without ordinary reachable refs now have permanent local `refs/archive/level-preservation-20261101/<sha>` refs. 135 are earlier forms of named retained work (60 have exact owned-file equality); the other eight are six retained stashes and two Hollowwake policy revisions already represented in current code/docs. Earlier amended/rebased forms are preserved, not reapplied over later implementations.
- Rooftop’s 19 untracked files are local/public validation evidence, not missing game source. They remain untouched.

## Source and save handling

The catalog records complete, unrounded data signatures keyed by level ID and title. It covers raw stock, crate-migrated stock, and both current normalization variants. Local field changes, renames, copied IDs and deliberate author saves remain authoritative. The historical data stays in the saved library. The editor and gameplay resolve the current source together.

Ten historical Rooftop snapshots fail today’s strict geometry validator. Their exact official bytes are recognized as an archive and resolve to current valid source; they are never marked as validated runtime geometry. Unknown invalid imports are still rejected. A partially unreadable saved library is backed up byte-for-byte before any replacement write; if that backup fails, the original stored library is not replaced.

Retired course IDs and pre-registry packs remain archived evidence; this does not resurrect intentionally removed menu entries. The 332-component Flats editor snapshot is preserved exactly as a source-owned course; all seven older Flats stock snapshots now advance to it. All 14 published snapshot entries therefore compact to source data. No whole older level pack was reapplied.

## Divergent refs

| Ref | Finding |
| --- | --- |
| `backup/pre-blockworks-cleanup-20260930` (94fd499b) | Preserved draft / pre-cleanup snapshot; not a completed level replacement. |
| `cleanup/pre-sync-20261005` (dc0880e5) | Published as 7538e28d; later campaign/map changes retained. |
| `codex/ancient-gates-marathon` (8e1aba81) | Already integrated; 24 owned implementation files match main. Current native recovery extends that route. |
| `codex/ancient-gates-tripo` (39bc66a1) | Recovered in 172868a0; five native models, mechanisms, distant mattes and distance-aware sound. |
| `codex/banana-bay` (94609eac) | Already integrated; 12 owned files match; remaining shared files contain later changes. |
| `codex/beach-kite-release` (a1f1d729) | Only final public-validation documentation is unmerged; gameplay already published. |
| `codex/beach-street-excellence` (5ddbc499) | Integrated; 20 owned files match. Later kite controls and presentation remain current. |
| `codex/bonus-no-checkpoints` (357a9426) | Recovered in this increment; removes checkpoint geometry and retry snapshots from bonuses. |
| `codex/cave-collapse` (f9867ee6) | Integrated; cave implementation matches. Later Treehouse opening/cabin/swimming edits supersede the old opening. |
| `codex/jungle-ruins-polish` (4f2a6623) | All eight owned files match main. |
| `codex/kart-drivers-thrusters` (77653ba6) | Integrated; 21 files match. Later live grid, loaner delivery and audio changes supersede shared files. |
| `codex/motu-beach-polish` (e94c3377) | Beach/Motu features integrated; later gameplay revisions retained, including removed loop-exit requirements. |
| `codex/nightworks-floating-rocks-20260908` (35caaa8a) | Only an old test roundoff assertion differs; current test already handles machine roundoff. |
| `codex/pre-merge-snapshot-20261023` (a4ef00bc) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/release-coordinator-20261027` (43f5f471) | Beach/Motu features integrated; later gameplay revisions retained, including removed loop-exit requirements. |
| `codex/rescue-20261025-071123/worktree-00` (1ee86618) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-13` (f9867ee6) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-14` (642153c4) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-17` (2fa61b63) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-18` (28473dae) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-25` (6bf0266b) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025-071123/worktree-27` (1975cd8e) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/redundant-race-fix` (8a588d23) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/superseded-slipstream` (bde0d0cb) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/worktree-00` (7e3d7ac2) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/worktree-14` (d7c4df9c) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/worktree-17` (6fe3cc61) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/worktree-18` (f656edf8) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/rescue-20261025/worktree-24` (5f9dd4d4) | Preserved recovery snapshot, not a release candidate; original refs and worktrees untouched. |
| `codex/slipstream-island-correction` (375a81ee) | Scenery integrated; 18 owned files match. Current shared runtime and published course retained. |
| `codex/spaghetti-rails` (d93e6c27) | All three owned files match main. |
| `codex/treehouse-trunk-collision` (1975cd8e) | All five owned files match main. |
| `codex/tribal-run` (062e3e0a) | Integrated; 26 owned files match. Current campaign, camera and shared release work retained. |
| `codex/waterfall-climb` (f771761d) | Rebuilt route integrated as 65ddf28a; ce75f647 subsequently split the cliff mesh to meet import limits. |
| `drafts/roo-character-studies` (706925c2) | Preserved draft / pre-cleanup snapshot; not a completed level replacement. |
| `origin/codex/haunted-hassle-quality` (20bd2634) | Remote work integrated as 0d476fec; 109 owned files match main. |

## Reproduction and evidence

Compressed JSON evidence beside this report contains immutable revision IDs, complete source dependency hashes, pack hashes, branch file comparisons and the original worktree inventory. `evidence.json` records the uncompressed SHA-256 values.

Retrieve deployment metadata with `gh api --paginate repos/kiranmatthews/Prototype-Fork/actions/workflows/deploy.yml/runs?per_page=100`. `tools/audit-level-sources.mjs --history` evaluates the retained successful revisions; `tools/audit-level-packs.mjs` collects pack history. Both write under `LEVEL_AUDIT_OUTPUT` (default `/private/tmp/level-preservation-audit`). `tools/build-stock-level-archive.mjs` refuses incomplete/errorful evidence. `tools/test-stock-level-preservation.mjs --history` verifies every recovered snapshot variant. Its default run also covers current authored edits, Ancient/Rooftop regression fixtures and failed-backup preservation.

The runtime catalog has 91 historical IDs and 1,691 complete signatures. The final matrix passes all 2,560 historical variants, 330 authored-edit cases, both archival fixtures and six backup/quota cases. Unknown/edited invalid imports retain strict validation. Two retired Beachside source versions are no longer valid under current import limits; their immutable history is retained and partial saved-library writes are guarded by the recovery backup.

`tools/write-level-audit-registry.mjs` writes the exact current selection/construction fingerprints used by `tools/level-preservation-browser.mjs`. The browser checks all current IDs for silent fallback and data mismatch, followed by native-resolution review of the recovered Ancient main/bonus and the corrected Jungle Terraces bonus.

The release pipeline keeps inactive font provenance in the source library and strips only whitespace outside JSON strings in four contact/provenance metadata files. Numeric lexemes, including negative zero and integers beyond binary64 precision, remain exact. Font-export members, all models and all texture pixels are untouched.

Final validation and deployment results are recorded below.

## Validated candidate

- Recovered Ancient model/layout/art/mechanism/audio checks pass; 21 main and four bonus native mechanism assemblies load without errors.
- Final `check:levels`, editor-security and transaction regressions, exact level synchronization, stock-cache checks and release-assets tests pass.
- Normal production build passes. Release size is 999,167,501 / 1,000,000,000 bytes; the generated sync pack is 20 bytes because all 14 published entries are now source-backed.
- Native 1600×1000 and normal presentation checks pass for Ancient main/bonus and Jungle Terraces bonus. Screenshots were reviewed.
- Chrome preserves the original Ancient archive across load/reload, advances raw and crate-migrated stock to the recovered course, and keeps an authored old version intact.
- All three checkpoint-free bonus rooms pass real-Chrome spawn, side controls, former checkpoint positions, retry and gate checks in lite and full/MAX presentation, with no console or WebGL errors.
- The browser source comparison uses an independently bundled current source registry in Chrome itself. Country Club can choose an extra procedural sampling row when Node and Chrome straddle a floating-point `ceil` boundary; browser-to-browser comparison verifies every vertex and field exactly rather than accepting topology differences as numeric tolerance. The game geometry is unchanged by this audit.

All **70 current entries / 25 bonuses** passed the local Chrome construction and source sweep: exact independently compiled source/construction data, no level fallback, no page/console errors, and no failed asset responses. Native/main/bonus, cached-stock/edited-stock, and bonus retry/finish evidence are in the adjacent browser reports. Public deployment verification is recorded in the owning release handoff (`01a195ed-5cfe-7ea2-a6a0-20d780fd99cd`) after publication.

## Public texture fallback discovered and corrected

The first public sweep of `f39c60d1` matched all 70 source definitions and all 25 checkpoint-free bonuses, but caught two Ghost Train texture requests returning 404. Its custom `fetch` loader bypassed the shared production image URL resolver: the original floor and bath PNGs were retained in source, while their pixel-identical WebP versions were correctly deployed. The loader silently substituted procedural materials. The failed run is preserved in `browser-public-initial.json.gz`.

`ghostCastleMaterials.ts` now uses the existing release image resolver, preserving development PNGs and production WebPs. A focused regression reproduces the failure against the real development/release asset inventories, verifies all four authored textures become ready, and checks decoded image disposal. The catalogue browser test now explicitly waits for Ghost Train textures and rejects any material fallback; native review includes Ghost Train as well. No level data or geometry changes are involved.

The texture regression, existing lossless release-image checks, build and release-size gate pass. Packaged normal and native 1600×1000 Chrome checks confirm all four textures ready, supported spawn, exact source data and no errors or failed responses. Their reports and reviewed screenshots are in `ghost-fixed-normal/` and `ghost-fixed-native/`. The follow-up release is 999,167,505 bytes. Final public verification is recorded in the release handoff.
