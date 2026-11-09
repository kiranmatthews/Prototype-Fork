# Crate bible evidence base

This folder holds the evidence behind [`docs/CRATE_DESIGN_BIBLE.md`](../CRATE_DESIGN_BIBLE.md):
crate-by-crate maps of real Crash Bandicoot 2, 3 and 4 levels, the machine-readable records the
statistics are computed from, an audit of this game's own crate placement, and measured engine
facts about crates on the skateboard.

| Path | What it is |
|---|---|
| `levels/<id>.md` | One map per level: header counts, route skeleton, section-by-section ASCII maps, a table of every crate cluster with its design function, enemies and hazards, puzzle rooms (correct and tempting-wrong order), design logic, transfer notes for this game, open questions. |
| `data/<id>.json` | The same level as structured records (schema below). |
| `data/c2-stage-counts.json` | Box, checkpoint, life and Aku totals for all 27 Crash 2 stages, with the off-normal-course share (from the Famitsu guide headers). |
| `data/skate-crate-probe.json` | Output of `node tools/probe-crate-skate-rules.mjs`: what the real Player/Level do when the board hits, grinds or rail-grinds into each crate type at a sweep of speeds. |
| `data/current-game-crates.json` | Per-level crate and cluster records for this game (from `tools/crate-placement-report.mjs`). |
| `CURRENT_GAME_AUDIT.md` | Quantitative audit of this game's crate placement. |
| `STATS.md` | Cross-level statistics, regenerated with `node tools/crate-bible-stats.mjs`. |

Level ids: `c2-<stage>-<slug>`, `c3-<stage>-<slug>`, `c4-<dimension>-<level>-<slug>`.

## Sources and evidence conventions

No commercial game was played for this work and no scans or video frames are stored in the
repository. The maps were transcribed from period strategy guides and a public longplay, in our
own words, with every cluster citing where it was read:

| Code | Source |
|---|---|
| `F2 pNNN[L/R]` | Famitsu *Crash Bandicoot 2 Exciting Perfect Guide* (Japanese, 1998), archive.org item `jp-crash-2-guide`. Isometric line maps drawing every box, stage headers with box/1UP/Aku/checkpoint counts, per-stage perfect-gem pages. `pNNN` is the archive's spread number; book page = 2N−8 (left) / 2N−7 (right). |
| `D2 pNNN` | Dimension Publishing *Crash Bandicoot 2 Official Strategy Guide* (English), archive.org `crash-2-dimension-guide`. Numbered screenshot walkthrough. |
| `F3 pNNN` | Famitsu *Crash Bandicoot 3* tour guide (Japanese), archive.org `warped-jp-guide`. Route maps with crate callouts, cumulative box counts at every checkpoint, time-trial route pages. |
| `P3 pNNN` | Prima *Crash Bandicoot: Warped Official Strategy Guide* (English), archive.org `crash-warped-prima`. |
| `LPn h:mm:ss` | archive.org `PS4_Longplay_Crash_Bandicoot_4_Its_About_Time`, part n, timestamp (a completionist run: all crates collected). |
| `GR <level>` | Gameranx per-level Crash 4 "all crates and hidden gem" guides (running crate tallies at checkpoints). |

Each cluster records an **observed** fact with a confidence (`high` / `medium` / `low`) and a
separate **why**, which is design inference. Where a guide's total and the mapped clusters do
not reconcile, the level file says so instead of forcing the numbers. N. Sane Trilogy remakes keep
the original layouts but can differ by a crate or two; the maps follow the PS1 guides.

## JSON schema (level maps)

```json
{
  "id": "c2-01-turtle-woods", "game": "Crash 2", "stage": 1, "name": "Turtle Woods",
  "sources": ["F2 p021-p022"], "camera": "into-screen",
  "totalBoxes": 62, "totalSource": "F2 p021L header",
  "routes":   [{"id": "main", "boxes": 30, "basis": "..."}],
  "sections": [{"id": "S1", "route": "main", "from": "start", "to": "C1", "boxes": 9, "cumulative": null, "notes": "..."}],
  "clusters": [{"id": "S1-a", "section": "S1", "order": 1, "where": "...",
                "composition": {"question": 1}, "count": 1, "arrangement": "single", "stackHeight": 1,
                "floating": false, "access": ["walk"], "relations": ["..."],
                "tags": ["ON-PATH", "SINGLE", "TEACH"], "why": "...", "evidence": "F2 p021R", "confidence": "high"}],
  "enemies":  [{"section": "S1", "kind": "...", "count": 1, "where": "...", "role": "..."}],
  "gaps":     [{"section": "S1", "kind": "...", "where": "...", "crates": ["S1-c"]}],
  "puzzles":  [{"id": "P1", "clusters": ["..."], "summary": "...", "solution": "...", "wrongOrder": "...", "loss": "..."}],
  "observations": ["..."]
}
```

Composition keys: `wood, question, striped, arrowWood, arrowSteel, steel, life, aku, checkpoint,
tnt, nitro, switch, switchGreen, outline, ironBound, slot, timeCrate, multiHit` (Crash 4 maps define
any additional keys in their markdown). Design-function tags are listed in the bible's appendix.

## Adding a level

1. Read an existing map of the same game for granularity.
2. Transcribe from a primary source you can cite page-by-page; keep observation and inference apart.
3. Write `levels/<id>.md` and `data/<id>.json`, reconcile counts with the source's totals.
4. Run `node tools/crate-bible-stats.mjs` and check the level appears in `STATS.md`.
