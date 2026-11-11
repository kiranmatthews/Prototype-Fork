# THPS bible evidence base

This folder holds the evidence behind [`docs/THPS_DESIGN_BIBLE.md`](../THPS_DESIGN_BIBLE.md), the
design bible for this game's **crystal challenges**: one hidden crystal per level, placed somewhere
hard to reach and reached with clever navigation and the right grinds, jumps, vert airs and
transfers, the way Tony Hawk's Pro Skater hides its secret tapes. It contains route-by-route maps
of 36 THPS levels (THPS1–4 and their 2020 and 2025 remakes), the machine-readable records the
statistics are computed from, what the developers said about building those levels, measured
facts about this engine's skate reach, played-through crystal recipes, and an audit of this game's
current crystals.

| Path | What it is |
|---|---|
| `levels/<id>.md` | One map per THPS level: header table (game, location, versions, time limit, career position, goal list, size); zones and layers; spawn and first view; every collectible (the secret tape first, with its full route as a numbered list, then letters, goal objects and reach goals); named gaps; unlocks and events; designed lines; guidance and sightlines; design logic; original against remake; transfer to this game; open questions. |
| `data/<id>.json` | The same level as structured records (schema below). |
| `data/tape-index.json` | One curated row per secret tape across all 36 levels: layer, heights, launcher, visibility, route length, key moves, unlock, difficulty and placement pattern. The bible's Appendix A and the tape tables in `STATS.md` are built from it. |
| `data/skate-reach-probe.json` | Output of `node tools/probe-skate-reach.mjs`: measured vert airs, kickers, grind exits, slipstream, wallrides and wallies, trampolines, the crystal pickup envelope and what a death does to a held crystal. |
| `data/crystal-recipes-verified.json` | Output of `node tools/verify-crystal-recipes.mjs`: each bible recipe played with the real skater (intended route and ruled-out shortcuts). |
| `data/current-game-crystals.json` | Per-level crystal records for this game (from `tools/crystal-placement-report.mjs`). |
| `CURRENT_GAME_CRYSTAL_AUDIT.md` | Audit of where this game's crystals are, how they are reached and whether they can be seen. |
| `STATS.md` | Cross-level statistics over the THPS records, regenerated with `node tools/thps-bible-stats.mjs`. |
| `DEVELOPER_EVIDENCE.md` | Public statements by Neversoft, Activision, Vicarious Visions, Iron Galaxy and others about building Tony Hawk levels, labelled by how direct they are, with principles and a source register. |

Level ids: `thps1-<level>`, `thps2-<level>`, `thps3-<level>`, `thps4-<level>` (for example
`thps1-warehouse`, `thps3-canada`, `thps4-alcatraz`).

## Sources and evidence conventions

No game was played for this work and no scans, screenshots or video frames are stored in the
repository. The maps were transcribed from isometric map renders, period strategy guides, public
longplays and tool-assisted runs on archive.org, and text guides, in our own words, with every
record citing where it was read:

| Code | Source |
|---|---|
| `VG` | VGMaps / VGCartography isometric renders of the original level geometry, annotated with named gaps, S-K-A-T-E letters, goal objects and the tape. THPS1 and THPS2 are the PS1 games; the THPS3 maps are the PS1 edition (Canada also has a PS2 edition); the THPS4 maps are the PS1 edition of THPS4. |
| `G1 pNNN` | *Tony Hawk's Pro Skater Official Strategy Guide* (THPS1), scanned on archive.org. |
| `G3 pNNN` | BradyGames *Tony Hawk's Pro Skater 3* official strategy guide (PS2 era). Book page = scan page − 2. |
| `J3 pNNN` | *Joypad* 114 supplement (French, December 2001): THPS3 walkthrough. |
| `G4m pNNN` | THPS4 (PS2) in-box mini guide. |
| `PS12 <level>` | Push Square's THPS 1+2 (2020) per-level guides: goals, letters, tape locations and gap lists. |
| `PS34 <level>` | Push Square's THPS 3+4 (2025) per-level walkthroughs and secret-tape guide. |
| `WEB <site>` | Other text guides used for cross-checks (named in each record). |
| `LP1`, `LP2`, `LP3`, `LP4` `m:ss` | archive.org PS1/PS2 longplays of THPS1–4 (all goals). |
| `LP12`, `LP34` `h:mm:ss` | archive.org longplays of THPS 1+2 (2020, PC) and THPS 3+4 (2025, Xbox Series). |
| `TAS1`, `TAS3` `m:ss` | archive.org tool-assisted "all goals and golds" runs of THPS1 (N64) and THPS3 (GameCube): every tape's fastest line. |

Wiki, forum and video sites (Fandom, GameFAQs, Neoseeker, StrategyWiki, TrueAchievements, Reddit,
speedrun.com, YouTube) were not used, and pages that refused automated access were skipped rather
than worked around; each level file lists what it skipped.

Each record separates what was **observed** (with the source and a confidence) from the **why**,
which is design inference. Heights and distances are estimates in metres against references in the
same view (skater ≈ 1.8 m, vert ramp ≈ 3.5–4 m to the coping, one storey ≈ 3–3.5 m, car ≈ 4.5 m),
given as ranges. Where a remake moved or changed a collectible, both versions are recorded. The
PS1 port of THPS4 hid secret tapes as non-goal collectibles; the PS2 original had none; the 2025
remake added a tape to most THPS4 levels and runs those levels as 10-minute sessions.

## JSON schema (level maps)

```json
{
  "id": "thps1-warehouse", "game": "THPS1", "level": "Warehouse", "location": "Woodland Hills, California",
  "type": "career-park", "careerPosition": 1, "timeLimit": "2:00", "versions": ["PS1 1999", "THPS 1+2 2020"],
  "sources": ["VG ...", "G1 p044-p055", "LP1 ...", "TAS1 ..."],
  "goals": [{"text": "Find the secret tape", "version": "original"}],
  "size": {"class": "small", "footprint": "≈ 50 × 45 m", "evidence": "..."},
  "zones": [{"id": "Z1", "name": "...", "layer": "ground", "features": ["halfpipe"], "notes": "..."}],
  "landmarks": ["..."],
  "spawn": {"zone": "Z1", "facing": "...", "visibleCollectibles": ["T"], "notes": "..."},
  "collectibles": [{
    "id": "TAPE", "type": "tape", "label": "...", "zone": "Z2", "landmark": "...",
    "layer": "...", "heightM": "≈ 5.5-8 above the flat", "launchFrom": "...",
    "visibility": {"firstSight": "...", "fromSpawn": false, "reads": "...", "distanceFromFirstSightM": "≈ 20"},
    "route": [{"step": 1, "move": "vert-air", "from": "...", "to": "...", "geometry": "..."}],
    "moves": ["vert-air", "transfer", "break-glass"], "speed": "moderate", "skillGates": ["..."],
    "coupling": "none", "failure": "...", "timeFromSpawnS": "...", "difficulty": 1,
    "roles": ["TEASE", "TEST"], "why": "...", "evidence": "...", "confidence": "medium"
  }],
  "gaps": [{"name": "Over the pipe", "points": 250, "kind": "secret-area", "location": "...", "moves": ["vert-air"], "onRouteOf": ["TAPE"], "evidence": "VG"}],
  "unlocks": [{"trigger": "...", "opens": "...", "neededFor": ["TAPE"], "evidence": "..."}],
  "lines": [{"id": "L1", "name": "...", "sequence": ["..."], "links": ["manual"], "collectibles": ["S"], "why": "...", "evidence": "..."}],
  "guidance": ["..."], "designLogic": ["..."], "remakeChanges": ["..."], "transfer": ["..."], "openQuestions": ["..."]
}
```

Move vocabulary: `ollie`, `kicker`, `grind`, `rail-transfer`, `ledge`, `wire`, `manual`, `wallride`,
`wallie`, `vert-air`, `transfer`, `spine-transfer`, `hip`, `lip`, `bank`, `acid-drop`, `boneless`,
`wallplant`, `revert`, `skitch`, `break-glass`, `smash`, `unlock`, `moving-object`, `walk`. Route steps
may also use `ride` for plain travel between moves. Roles: `TEASE`, `TEST`, `EXPLORE`, `TEACH-LINE`,
`REWARD`, `SECRET-AREA`. Gap kinds: `rail-transfer`, `ledge-to-ledge`, `kicker`, `roof`, `wire`, `hip`,
`spine`, `channel`, `over-object`, `pool-transfer`, `lip`, `manual`, `wallride`, `hangtime`,
`secret-area`, `other`. Records may carry a `version` field (`original`, `PS1`, `remake`) where versions
differ; a level can list more than one tape when versions put it in different places.

## Regenerating

```bash
node tools/thps-bible-stats.mjs
```

```bash
node tools/probe-skate-reach.mjs docs/thps-bible/data/skate-reach-probe.json
```

```bash
node tools/verify-crystal-recipes.mjs docs/thps-bible/data/crystal-recipes-verified.json
```

```bash
node tools/crystal-placement-report.mjs --json /tmp/crystals.json --md /tmp/crystals.md
```

The probe and the recipe verifier build throwaway levels and change no game data. Run the crystal
report with scratch output paths when reviewing; write to this folder only when refreshing the
committed audit.
