# Gameplay bible evidence base

This folder holds the evidence behind [`docs/GAMEPLAY_DESIGN_BIBLE.md`](../GAMEPLAY_DESIGN_BIBLE.md):
crate-by-crate maps of real Crash Bandicoot 2, 3 and 4 levels extended with their platforms, gaps,
jump sequences, obstacles and enemies; the machine-readable records the statistics are computed
from; audits of this game's own crate placement and level geometry; measured engine facts; and what
the developers said about building these levels. (The folder keeps its original `crate-bible` name.)

| Path | What it is |
|---|---|
| `levels/<id>.md` | One map per level: header counts, route skeleton, section-by-section ASCII maps, a table of every crate cluster with its design function, enemies and hazards, puzzle rooms (correct and tempting-wrong order), design logic, transfer notes for this game, then a "Geometry, obstacles and enemies" block (camera and route shape, platform and gap tables per section, jump sequences, obstacles, detailed enemies, section beats, geometry design logic and transfer), open questions. |
| `data/<id>.json` | The same level as structured records (schema below). |
| `data/c2-stage-counts.json` | Box, checkpoint, life and Aku totals for all 27 Crash 2 stages, with the off-normal-course share (from the Famitsu guide headers). |
| `data/skate-crate-probe.json` | Output of `node tools/probe-crate-skate-rules.mjs`: what the real Player/Level do when the board hits, grinds or rail-grinds into each crate type at a sweep of speeds. |
| `data/current-game-crates.json` | Per-level crate and cluster records for this game (from `tools/crate-placement-report.mjs`). |
| `data/current-game-geometry.json` | Per-level gap, landing, surface, hazard, enemy and beat records for this game (from `tools/level-geometry-report.mjs`). |
| `CURRENT_GAME_AUDIT.md` | Quantitative audit of this game's crate placement. |
| `CURRENT_GAME_GEOMETRY_AUDIT.md` | Quantitative audit of this game's gaps, platforms, hazards, enemies and rhythm. |
| `STATS.md` | Cross-level crate statistics, regenerated with `node tools/crate-bible-stats.mjs`. |
| `GEOMETRY_STATS.md` | Cross-level platform, gap, jump, obstacle, enemy and section statistics, regenerated with `node tools/crate-bible-geometry-stats.mjs`. |
| `DEVELOPER_EVIDENCE.md` | Public statements by Naughty Dog, Mark Cerny, Vicarious Visions and Toys for Bob about level design, labelled by how direct they are, with principles and a source register. |

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
| `GP <level>` | gamepressure.com Crash 4 walkthrough pages (used by the geometry pass for hazards and enemies the frames do not show clearly). |
| `PS` | pushsquare.com Crash 4 guide pages (boss behaviour). |

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

### Geometry keys

Added by the geometry pass; every other key is left as it was. Widths and sizes are in crates (u) and
are estimates, so most are strings holding a range (`"2-3"`). `camera` stays the level-wide string;
the per-section list is `cameraSections`.

```json
"cameraSections": [{"section": "S1", "mode": "into-screen", "notes": "..."}],
"platforms": [{"id": "P-S1-a", "section": "S1", "shape": "hex pillar", "size": "1x1", "heightDelta": 0,
               "edges": "open", "behaviour": "static", "roles": ["STEPPING"], "why": "...", "evidence": "F2 p056L", "confidence": "medium"}],
"gapsDetailed": [{"id": "G-S1-a", "section": "S1", "kind": "bottomless pit", "width": "2-3", "heightDelta": 0,
                  "landing": "1x1", "lethal": true, "runUp": "4", "move": ["running"], "coupling": "none",
                  "failure": "death", "nearby": ["S1-c", "E-S1-a"], "why": "...", "evidence": "...", "confidence": "medium"}],
"jumpSequences": [{"id": "J-S1-a", "section": "S1", "count": 5, "moves": ["plain"], "rhythm": "even",
                   "maxGap": "2", "rest": "P-S1-c", "noStop": false, "why": "...", "evidence": "..."}],
"obstacles": [{"id": "O-S2-a", "section": "S2", "kind": "fire statue", "placement": "flank", "timing": "...",
               "counter": ["wait-and-go"], "lethal": true, "combinedWith": ["S2-a"], "roles": ["TIMING-GATE"], "why": "...", "evidence": "..."}],
"enemiesDetailed": [{"id": "E-S1-a", "section": "S1", "kind": "rat", "archetype": "patrol-1D", "behaviour": "...",
                     "counter": ["spin", "stomp"], "fails": [], "placement": "on line", "roles": ["TEACH"],
                     "firstAlone": true, "why": "...", "evidence": "...", "confidence": "high"}],
"sectionBeats": [{"section": "S1", "beats": ["gap 2u", "enemy patrol", "crate stack", "rest", "checkpoint"],
                  "gaps": 3, "enemies": 2, "hazards": 1}],
"geometryObservations": ["..."],
"geometryTransfer": ["..."]
```

The vocabularies for shapes, roles, gap kinds, moves, placements, counters and archetypes are listed in
the bible's Appendix B. Keep digits from citations out of `width` and `maxGap` strings: the statistics
script reads the largest number in them.

### Crate composition keys

Composition keys: `wood, question, striped, arrowWood, arrowSteel, steel, life, aku, checkpoint,
tnt, nitro, switch, switchGreen, outline, ironBound, slot, timeCrate, multiHit` (Crash 4 maps define
any additional keys in their markdown). Design-function tags are listed in the bible's appendix.

## Adding a level

1. Read an existing map of the same game for granularity.
2. Transcribe from a primary source you can cite page-by-page; keep observation and inference apart.
3. Write `levels/<id>.md` and `data/<id>.json`, reconcile counts with the source's totals.
4. Add the geometry block and keys (above): platforms, gaps, jump sequences, obstacles and enemies in
   route order with ids, sizes in crates, the required move, the coupling and a reason for each.
5. Run `node tools/crate-bible-stats.mjs` and `node tools/crate-bible-geometry-stats.mjs` and check the
   level appears in `STATS.md` and `GEOMETRY_STATS.md`.
