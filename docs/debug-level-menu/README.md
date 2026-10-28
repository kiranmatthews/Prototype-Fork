# Debug menu names and order — updated 29 October 2026

The debug MENU now takes campaign names and progression order from
`CAMPAIGN_LEVELS`. Each authored bonus follows its parent with the label
`[Parent name] Bonus`. Every row has a number; a bonus reuses its parent's
number, so the opening pairs are `1· Treehouse Trail` / `1· Treehouse Trail Bonus`
and `2· Banana Bay` / `2· Banana Bay Bonus`. The 1–9 playtest shortcuts open
the matching parent levels. The same ordered list drives play/edit tooltips
and active-row highlighting. Non-map courses and
tools follow the map in their existing registry order. Their authored bonuses
also follow their parents.

The shared Easy Street fallback has no single parent and is labeled `Bonus`.
The standalone Unity prototype `Bonus Level` retains its existing name. The
underlying registry IDs, saved editor names, data and geometry are unchanged.
Renamed map slots and stale saved bonus titles still resolve through their
existing authored bonus associations.

[Retired bonus names](../retired-bonus-level-names.txt) contains 22 distinct
reusable titles, one per line, with the former `Bonus:` prefix removed.
[The label review](labels.json) records all 66 IDs, old/new labels, numbers and
bonus parent IDs. There are 45 parent/standalone numbers and 21 linked bonuses.
The latest addition is `The Skystream Bonus`, immediately after `The Skystream`;
its previous title, `Cumulus Cache`, is preserved in the text list.

## Initial validation — 28 October

- `node tools/test-debug-shortcuts.mjs`: passed.
- `tsc --noEmit`: passed.
- `git diff --check`: passed.
- Real Chrome lite rendering: all 65 labels and their order, edit tooltips,
  registry completeness, actual Digit 2 launch, Banana Bay Bonus click and
  active state, correct editor target, and refresh with a renamed saved bonus
  and custom course passed. Saved names/data remained intact.
- Desktop 1440×900 and portrait 390×844 captures reviewed. The final run had no
  console errors or failed requests. See [browser evidence](browser-lite.json),
  [desktop](lite-desktop.png) and [portrait](lite-portrait.png).

The first fresh-storage browser run passed the behavior checks and reported
one canceled optional `levels.json` pull: the existing 51 MiB published file
exceeds the 16 MiB limit in `sync.ts`/`level.ts`, which deliberately aborts it.
The final run marked the isolated test context as already synced to verify
this presentation change independently. The affected bonus names in the
published file match the source names preserved in the text archive.

## Production validation — 29 October

Integrated current published main through `24c16a77`, preserving all newer
geometry, UI behavior and authored bonus registrations. The existing menu helper
already handles the new Skystream bonus through its parent association; no
additional runtime special case was needed. The saved title archive retains
all 21 prior names and adds `Cumulus Cache`.

The earlier capacity block is historical ([initial result](capacity.json)).
The release coordinator has since been retired and the user requested direct
publication. The shared capacity guard remains in use.

`npm run build`, `npm run check:release`, the existing debug-shortcut regression,
and diff checks pass. The production output is 997,082,558 bytes, within the
1,000,000,000-byte budget. Local build stamp: `Codex/sol fork · build 10-28 18:28 UTC`.

Real Chrome production checks pass in lite, full normal and full MAX/native
rendering, each with all 66 menu labels, map order, parent/bonus placement,
numeric and click launches, active rows, correct editor targets and refresh
with saved/custom names. Each mode actually launches `bonus-skystream` from
`The Skystream Bonus` and confirms the original `Bonus: Cumulus Cache` registry
entry remains intact. All three runs have zero console errors or failed
requests. Desktop and portrait captures were reviewed, including the native
cloud-bonus scene with its adjacent parent and bonus rows.

Evidence: [build receipt](release-2026-10-29/build.json),
[lite](release-2026-10-29/browser-lite.json),
[normal](release-2026-10-29/browser-full.json),
[MAX/native](release-2026-10-29/browser-full-native.json),
[latest bonus](release-2026-10-29/full-native-skystream-bonus.png).
No level data changed, so `check:levels` was not needed. No `check:all` ran.

## Numbering correction — 29 October

The requested numbering applies to every row, including entries beyond the
first nine. Parent numbers advance once per level; its bonus uses the same
number. Standalone prototypes and the shared fallback receive their own
numbers. Number metadata belongs to the menu only and never changes level IDs
or stored data. Digit 2 now launches Banana Bay, matching its displayed number.

The corrected production build and release-size check pass: 1,847 files and
997,082,634 bytes. Build stamp: `Codex/sol fork · build 10-28 18:40 UTC`.
Fresh-context Chrome lite, full normal and MAX/native checks all pass after
loading the published level pack. Each checks all 66 numbered rows, the 45
sequential parent/standalone numbers and all 21 shared bonus numbers, actual
Digit 2 launch, the new Skystream bonus, edit targets and saved/custom refresh.
All three modes have zero console errors or failed requests. Desktop and
portrait screenshots, including the paired `30· The Skystream` and
`30· The Skystream Bonus` rows, were reviewed.

Evidence: [build receipt](numbering-2026-10-29/build.json),
[lite](numbering-2026-10-29/browser-lite.json),
[normal](numbering-2026-10-29/browser-full.json),
[MAX/native](numbering-2026-10-29/browser-full-native.json),
[numbered menu](numbering-2026-10-29/full-desktop.png),
[new bonus number](numbering-2026-10-29/full-native-skystream-bonus.png).
