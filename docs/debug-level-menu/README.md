# Debug menu names and order — 28 October 2026

The debug MENU now takes campaign names and progression order from
`CAMPAIGN_LEVELS`. Each authored bonus follows its parent with the label
`[Parent name] Bonus`. The same ordered list drives the numbered playtest
shortcuts, play/edit tooltips and active-row highlighting. Non-map courses and
tools follow the map in their existing registry order. Their authored bonuses
also follow their parents.

The shared Easy Street fallback has no single parent and is labeled `Bonus`.
The standalone Unity prototype `Bonus Level` retains its existing name. The
underlying registry IDs, saved editor names, data and geometry are unchanged.
Renamed map slots and stale saved bonus titles still resolve through their
existing authored bonus associations.

[Retired bonus names](../retired-bonus-level-names.txt) contains 21 distinct
reusable titles, one per line, with the former `Bonus:` prefix removed.
[The label review](labels.json) records all 65 IDs, old labels and new labels.

## Completed validation

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

## Queued validation

The required `npm run build` was submitted through the shared heavy-job helper
and returned exit 75 before running; both slots were held by chat
`01a18164-7b38-7f11-94c2-2428089ba3db`. See [capacity result](capacity.json).
Production build and full normal/MAX browser checks need coordinator capacity.
This increment is not marked READY for publication until those checks pass.
No level data changed, so `check:levels` was not needed. No `check:all` ran.
