# Gameplay Design Bible

How the Crash Bandicoot series builds its levels — crates, platforms, gaps, jumps, hazards and enemies —
measured from maps of 36 real Crash 2, 3 and 4 levels, and how to rebuild that logic in this game, where
the hero also skates, grinds and plows through crates at speed.

**Read this before placing a crate, a gap, a hazard or an enemy.** Agents authoring or reviewing levels
should treat Part 0 as binding rules; Parts II–XIV as the reasoning and the precedents behind them
(crates in II–VIII; ground, gaps, jumps, hazards and enemies in IX–XIV); Parts XV–XVII as the engine
facts and skate patterns; Part XIX as copyable recipes; and Part XX as the review gate.

| If you need… | Go to |
|---|---|
| The rules in one page | [Part 0 — The laws](#part-0--the-laws) |
| What was studied and how | [Part I — Evidence base](#part-i--evidence-base) |
| What each crate type is *for* | [Part II — Crate vocabulary](#part-ii--crate-vocabulary) |
| Shapes of crate groups and their meaning | [Part III — Cluster grammar](#part-iii--cluster-grammar) |
| Where crates go relative to route, gaps, enemies, camera | [Part IV — Placement logic](#part-iv--placement-logic) |
| TNT, Nitro, switches, outlines, reinforced crates | [Part V — Explosives, switches and special crates](#part-v--explosives-switches-and-special-crates) |
| Section sizes, checkpoints, teaching order, the two goals | [Part VI — Pacing and structure](#part-vi--pacing-and-structure) |
| Named crate puzzles with real examples | [Part VII — Puzzle archetypes](#part-vii--puzzle-archetypes) |
| Chases, rides, vehicles and rails | [Part VIII — Fast lines](#part-viii--fast-lines-chases-rides-vehicles-rails) |
| Platform shapes, sizes, roles, timed footing and surfaces | [Part IX — Platforms and footing](#part-ix--platforms-and-footing) |
| Gap kinds, widths, coupling, landings and teaching order | [Part X — Gaps](#part-x--gaps) |
| Jump runs, rhythm, rests and cadence | [Part XI — Jumps, sequences and rhythm](#part-xi--jumps-sequences-and-rhythm) |
| Hazards: palette, telegraphs, escalation, explosives as architecture, chases | [Part XII — Obstacles and hazards](#part-xii--obstacles-and-hazards) |
| Enemies: placement, debuts, ladders, groups, enemies as tools | [Part XIII — Enemies](#part-xiii--enemies) |
| Section beats, camera modes and route shape | [Part XIV — Section beats, camera and level flow](#part-xiv--section-beats-camera-and-level-flow) |
| This engine's reach, ranges, gap bands, enemy and hazard timings | [Part XV — Translating Crash geometry into this game](#part-xv--translating-crash-geometry-into-this-game) |
| Grinding, smashing and crate rows | [Part XVI — Skate × crate patterns](#part-xvi--skate--crate-patterns) |
| Skating with gaps, hazards and enemies | [Part XVII — Skate × ground, hazard and enemy patterns](#part-xvii--skate--ground-hazard-and-enemy-patterns) |
| What the current levels do differently | [Part XVIII — Diagnosis of the current game](#part-xviii--diagnosis-of-the-current-game) |
| Copyable component recipes | [Part XIX — Authoring recipes](#part-xix--authoring-recipes) |
| The checklist a level must pass | [Part XX — Review checklist](#part-xx--review-checklist) |
| Every level map | [Appendix A](#appendix-a--level-map-index) and [`docs/crate-bible/`](crate-bible/README.md) |

---

## Part 0 — The laws

These are distilled from 36 level maps (Part I) and the measured engine (Part XV). Each law links to its
evidence.

**Crates and the all-box layer**

1. **Crates are a second game laid over the route.** Reaching the exit and breaking every box are
   different goals with different skills (Crash 2: 37 % of all boxes sit off the normal course).
   Design both layers on purpose; never let the all-box layer be an accident of decoration. → VI.4
2. **Cluster, don't sprinkle.** In Crash a crate group averages 2.5–3.2 crates and only 12–17 % of
   all crates stand alone. A crate placement is a *decision point* (how do I get these, in what
   order, at what risk), not fruit along a path. → III.1, XVIII
3. **Every cluster has one job you can name**: teach, test, reward a risk, bait an edge, serve as a
   tool, gate or frame a route, mark a landing or a mode change, or trap the careless counter. If
   you cannot name it, delete it. → IV
4. **Introduce alone, on safe ground; recombine later under pressure.** Every new crate behaviour
   first appears by itself where failure is cheap (`TEACH`: median first section in all three
   games); its recombination with hazards comes 25–50 % of the way in for Crash 2 and 3 (`TEST`),
   almost at once in Crash 4, whose players already know the vocabulary. → VI.2
5. **Order is the puzzle.** Supports must outlive the targets above them; tools (arrows, striped
   crates, TNT keys) must survive until used; switches must be hit before (or returned to after)
   their outlines. The tempting order must cost something real. → VII
6. **Explosives are tools and frames, not confetti.** TNT clears, launches, bridges, keys and
   times; Nitro shapes lanes and frames single rewards. Explosive clusters are 16–23 % of Crash
   clusters, and 43–45 % of them also hold rewards whose collection method the explosive
   dictates. → V.1–V.2
7. **Price rewards by risk.** Lives sit over Nitro, inside minefields, behind hidden switches and on
   enemy springboards — never on the safe line. Masks sit right before the hardest stretch. → IV.8
8. **Checkpoints are part of the crate rhythm.** One every 10–12 main-route crates (median),
   at every mode change, beside every bonus entrance, embedded in crate groups on forced rides,
   never on a rail. → VI.1
9. **On fast and forced lines a crate's lane is a steering command.** Crates go on the riding line,
   density falls as speed rises, boost gates stay clear, landings are marked by single crates, and
   no explosive sits on a rail. → VIII
10. **Optional routes carry the hard recombinations** — bonus rounds, secret routes, gem paths —
    and a large share of the boxes. Decide deliberately whether the all-box goal requires the
    no-death route: Crash 2 sometimes couples them (boxes or the only green `!` on the death route,
    forcing a deathless reverse run), Crash 3 and 4 decouple them (death-route Nitro is credited
    remotely). Default to decoupling. → VI.4
11. **Count traps live at attractors**: right after checkpoints, right before exits, behind an
    obstacle you just jumped, behind the start, where momentum carries you past, under ledges,
    toward the camera — and in the switches themselves. Never in arbitrary corners. → IV.7
12. **Re-measure everything in this engine.** A crate is 1.152 m, the double jump reaches a 3-stack,
    the board smashes crates only at ≥ 12.5 m/s, and a crate row is a rail that breaks as you ride
    it. Copy Crash's *relationships*, never its raw distances. → XV, XVI

**Ground, gaps, hazards and enemies**

13. **Couple, don't widen.** Crash gaps are short (median 2.5 u, about half a Crash jump) and about three
    in four are coupled to something: an enemy on the landing, a cycle on the far bank, a footing timer, a
    pursuer, an explosive on the take-off. This hero jumps 5.1 crates flat, so width alone tests nothing
    here; put the difficulty on the gap's edges. → X.2–X.3, XV.9
14. **Every element debuts forgivingly, with a place to stand.** A new gap first appears without a pit or
    beside the path; a new hazard with a waiting spot in view of a full cycle; a new enemy kind on roomy
    ground, often with an opt-out, a mask or its counter just given. Couple it to edges later. → X.6, XII.2,
    XIII.2
15. **Escalate one variable at a time, then hold.** Debut → repeat without the pause → invert the counter
    → combine. Footing goes static → moving → sinking → crumbling; landings shrink 4 → 2 → 1 u; patrols go
    across the path → along it → onto the landing. Never make every jump slightly harder than the last:
    plateau, rest, then raise. → IX.2–IX.3, XII.2, XIII.3
16. **Lethal timers telegraph, and the telegraph is geometry.** A rising crusher, a strobing pad, marks on
    the floor under a falling object, a drawn crossbow, a visible approach. Every lethal window must be
    readable, with contrast, from the spot where the player waits. → XII.3
17. **Rest after 3–5 coupled jumps; checkpoints stand on the widest fixed floors.** Runs average three
    jumps; climbs of 12–20 have a stable tier every 2–3. Checkpoints sit on floors of about 4 u at
    transitions, never on timed footing, a ledge or a rail. → XI.1, IX.1
18. **No-stop comes from footing or a pursuer, never from width.** Sinking, crumbling, moving or burning
    floors and chasers forbid stopping. "Keep moving" and "wait" never share a stretch except at a
    deliberate peak, and every timed crossing has a fast line. → XI.3
19. **Channel the route; spend width on purpose.** Walled lanes keep the line through the challenge;
    lethal space runs beside the line; lanes narrow to a crate or two for chokes and finales; wide space is
    for arenas and deliberate optional routes. → IX.5, XIV.5
20. **Landing size and landing occupancy are the difficulty dials.** Keep the take-off generous; shrink,
    occupy or move the landing. Teaching landings are wide, coupled landings 2–4 u. → IX.2, X.4
21. **Place enemies for their position, and use them as tools.** The same enemy becomes a different
    problem on the line, at the take-off, on the landing, between hazards or beside a crate. Enemies are
    also steps, springboards, projectiles and bait. → XIII.1, XIII.5
22. **Rhythm is measured in seconds and built in metres.** Crash streams run one decision every 2–3 s on
    vehicles and one step every 1.5–2 s on timed footing. Convert by speed (24–36 m between decisions at
    board cruise, 13.5–18 m on foot) and phase hazard rows for the approach speed. → XI.4, XV.12, XVII.3
23. **Each camera mode has its own grammar; change mode only at a one-way transition with a
    checkpoint.** → IX.6, XIV.3
24. **Geometry is valid only for the movement model it was built for.** The N. Sane remake kept Naughty
    Dog's spacing, changed the jump, and the same gaps became harder. Measure every gap, window and patrol
    in this engine (Part XV); never copy Crash distances. → XV, DEVELOPER_EVIDENCE.md

---

## Part I — Evidence base

### I.1 What was studied

36 levels were mapped crate by crate — every cluster, gap, enemy, checkpoint, bonus round and
secret/gem/death route — with a citation per cluster and a design rationale for each:

| Game | Levels mapped | Primary sources |
|---|---|---|
| Crash Bandicoot 2 (1997) | 15: Turtle Woods, Snow Go, Hang Eight, Crash Dash, Snow Biz, Air Crash, Bear It, The Eel Deal, Bear Down, Road to Ruin, Hangin' Out, Diggin' It, Cold Hard Crash, Ruination, Piston It Away | Famitsu *Exciting Perfect Guide* (isometric maps drawing every box, stage box counts, perfect-gem pages); Dimension Publishing official guide (numbered screenshot walkthrough) |
| Crash Bandicoot 3 (1998) | 12: Toad Village, Orient Express, Bone Yard, Makin' Waves, Gee Wiz, Hang 'em High, Tomb Time, Dino Might!, Sphynxinator, Future Frenzy, Tomb Wader, Gone Tomorrow | Famitsu tour guide (route maps, cumulative box counts at every checkpoint, time-trial route pages); Prima official guide |
| Crash Bandicoot 4 (2020) | 9: Rude Awakening, A Real Grind, Crash Compactor, Jetboard Jetty, Draggin' On, Off-Balance, Snow Way Out, Bears Repeating, Stowing Away | Gameranx per-level crate guides (running tallies at every checkpoint) and frames from a completionist longplay hosted on archive.org |

Each map lives in [`docs/crate-bible/levels/`](crate-bible/levels/) with a machine-readable twin in
[`docs/crate-bible/data/`](crate-bible/data/); the folder [README](crate-bible/README.md) gives the
schema and citation codes. Cross-level numbers in this bible come from
[`STATS.md`](crate-bible/STATS.md) (`node tools/crate-bible-stats.mjs`). Game-wide Crash 2 totals
come from all 27 stage headers ([`c2-stage-counts.json`](crate-bible/data/c2-stage-counts.json)).
Engine facts come from the real Player/Level ([`skate-crate-probe.json`](crate-bible/data/skate-crate-probe.json),
`node tools/probe-crate-skate-rules.mjs`). The current game was audited level by level
([`CURRENT_GAME_AUDIT.md`](crate-bible/CURRENT_GAME_AUDIT.md), `node tools/crate-placement-report.mjs`).

### I.2 Method and limits

- No commercial game was played. Maps were transcribed from period guides and a public longplay in
  our own words; no scans or frames are stored in the repository.
- Every cluster records what was **observed** (with a confidence) separately from **why** it is
  there (design inference). The why is ours, not the developers'.
- Totals reconcile with the guides' own counts in most levels; where they do not (Bear It 45/48,
  Snow Biz, Cold Hard Crash, Hangin' Out, Diggin' It, Snow Go's wall), the level file says exactly
  where the gap is instead of forcing it. Crash 4 crate *types* are sometimes unreadable at 480p and
  recorded as `unknown`; their positions and counts are still tallied.
- Positions are relative (route order, lane, above/below, crate widths). Crash's own metres were
  never measured; Part XV re-derives every distance in this engine instead.
- The earlier [platformer puzzle dossier](PLATFORMER_PUZZLE_RESEARCH.md) (11 case studies, other
  platformers) remains valid; this bible supersedes it for Crash crate placement.

### I.3 Game-wide numbers

| Measure | Crash 2 (27 stages, guide headers) | Mapped Crash 2 / 3 / 4 levels |
|---|---|---|
| Boxes per stage | mean 70 (39–155) | 42–196 per level |
| Off the normal course (bonus, secret, gem, death routes) | **37 %** (703 of 1,878) | often 30–70 % per level |
| Boxes per checkpoint (whole stage) | ≈ 20 | — |
| Main-route crates between checkpoints (median) | — | **10 / 12 / 11** |
| Mean crates per cluster | — | **3.0 / 2.5 / 3.2** |
| Single crates: share of clusters / share of crates | — | 34 / 39 / 46 % of clusters, **12 / 16 / 17 % of crates** |
| Clusters containing TNT or Nitro | — | 23 / 16 / 19 % (43–45 % of them also hold rewards) |
| Nitro as share of crates (known types) | — | 17 / 9 / 17 % (they count toward the gem) |
| Life crates | 41 in 27 stages; more than half off the normal course | — |
| Aku crates | 37 in 27 stages; none on the bear/jetpack vehicle stages | — |

Crash 3's own stage table adds: bonus rounds exist on 15 of 32 stages and on none of its vehicle
stages; death routes (skull platforms, no-death runs only) on three; colored-gem secret routes on
seven.

### I.4 The geometry pass and the developers' own words

A second pass re-read the same sources for every level's ground and threats and extended each level
map with a "Geometry, obstacles and enemies" block and matching JSON records (schema in the folder
[README](crate-bible/README.md)): **1,035 platforms, 571 gaps, 296 jump sequences, 401 obstacles
and 416 enemy records in 254 sections**, each with an observation, a reason and a citation. They are
aggregated in [`GEOMETRY_STATS.md`](crate-bible/GEOMETRY_STATS.md) (`node tools/crate-bible-geometry-stats.mjs`).

- Sizes and widths are estimated in crates against crates visible in the same drawing or screenshot
  (Famitsu maps are stylised, so numbers come from screenshots and topology from maps). Treat every width
  as a range; the files give a confidence for each.
- Cycles are given in seconds only where a guide's on-screen timer or timestamped longplay frames measure
  them; most timing is qualitative (slow, medium, fast; "one beat per jump").
- The statistics fold free-text records into classes with patterns in the script; about 1 % stays
  unclassified. Percentages are a guide to proportions, not measurements.
- The pass corrected a few first-wave readings without rewriting the crate content: Turtle Woods has three
  rat pits with 2 + 4 + 4 moles; Snow Go's outline staircase floats over floor, not spikes; Bears
  Repeating's S3 discs are spinning lifts; Hangin' Out's S4 is a walking catwalk; several Crash 3 robot
  labels were wrong (each file lists its corrections under its open questions).

[`DEVELOPER_EVIDENCE.md`](crate-bible/DEVELOPER_EVIDENCE.md) collects 114 public statements by Naughty Dog,
Mark Cerny, Vicarious Visions and Toys for Bob on level structure, gaps, hazards, enemies, camera,
checkpoints, crates and testing, labelled by how direct they are. This bible cites its principles where
they support or qualify a finding and keeps them apart from what the maps measure: almost nothing
first-hand survives about Crash 2 or 3 level design, and no developer published gap spacings.

The current game's ground was audited too: [`CURRENT_GAME_GEOMETRY_AUDIT.md`](crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md)
(`node tools/level-geometry-report.mjs`) walks every campaign course along its route and records gaps,
landings, hazards, enemies and beats (Part XVIII).

---

## Part II — Crate vocabulary

A crate type is a *verb* the player must choose. The series adds types slowly and gives each a
small, stable set of jobs. Shares are of mapped crates whose type was read (Crash 2 / 3); Crash 4
figures are shares of its known types (its 480p frames leave some crates `unknown`).

| Crash type | Behaviour | Jobs it does in the maps | Share C2 / C3 | This game's kind |
|---|---|---|---|---|
| Wood (木箱) | breaks to any attack or stomp; 1–8 fruit | rhythm on the line, walls to break through, stepping stones, supports under targets | 33 % / 36 % | `wood` (63 % of this game's solid crates) |
| `?` (？箱) | fruit or a life; repeated deaths can turn fruit-`?` into life-`?` (C3) | the "surprise" behind a wall, step-up crates, rewards after hazards | 22 % / 26 % | `mystery` (9 %) |
| Striped / bounce (シマ箱) | each stomp or head-bonk pays fruit (C2: up to 10; C3: 2 per bounce, breaks after 5); side-breaking pays nothing (C2) | sandwich payouts, finite height supports, footing that must outlive a target, bridges | 6 % / 4.5 % | `multihit` (1 %) |
| Wooden arrow (↑箱) | high bounce, higher with Jump held; breakable ("don't break it carelessly") | the height tool under a floating target; a tool that must survive | small | `bouncy` |
| Steel arrow (↑ブロック) | same bounce, unbreakable, uncounted | permanent launcher, relay chains, bonus exits | small | `metalbounce` |
| Steel block (ブロック) | unbreakable, uncounted | footing over gaps, the permanent part of a structure, caps that block the easy approach | uncounted | `metal` (12 %) |
| Life (1UP箱) | extra life ("often hidden in hard-to-find places") | risk prices: over Nitro, between mines, on enemy springboards, inside TNT rings | 1 % / 2 % | `life` |
| Aku Aku (アクアク箱) | protective mask; three in a row = invincibility (C3) | placed one or two clusters **before** the hardest hazard | 2 % / 1 % | `mask` |
| Checkpoint (C箱) | respawn point; counts as a box | part of the crate rhythm; at mode changes, bonus pads, after each new idea | 5 % / 4 % | checkpoint crate |
| TNT (バクダン箱) | stomp → 3-count; side hit → instant blast; clears boxes and enemies | tool, springboard, bridge, key, timer, chain trigger, frame | 6 % / 5 % (C4 11 %) | `tnt` (1 %) |
| Nitro (ニトロ箱) | explodes on any touch; some hop; destroyed only by the green `!` (or blasts) | lane geometry, frames around a single reward, walls, lids, fields; **counted** | 17 % / 9 % (C4 17 %) | `nitro` (3 %) |
| `!` switch (!ブロック) | stomp/spin/blast turns its outline crates real; in Crash 3 Egypt it also moves platforms | builds bridges, stairs and reward rows; forces looking around and backtracking | uncounted | `bang` |
| Green `!` | detonates every Nitro in the stage | the last object of the level, "essential for a perfect"; can clear Nitro the player never visited | uncounted | `nitrobang` |
| Outline (透明箱) | pass-through ghost until its `!` is hit | promises visible before the switch, bridges, stairs, Nitro lids over rewards | 3 % / 5 % | `outline: true` + `grp` |
| Iron-bound / reinforced (鉄ワク箱) | breaks only to a body slam (or Aku invincibility, C3) | teaches the slam alone, then locks: reinforced over TNT, cubes, column puzzles | 3 % / 4 % | **none** (gap: approximate with `multihit` or steel + switch) |
| Slot crate (C3 スロット箱) | cycles icons; turns to steel if not broken quickly | timed reward placed where players pause (after a checkpoint, before the gate) | 1.3 % (C3) | none |
| Time crate (C3 タイムストップ箱) | time-trial only; freezes the clock 1/2/3 s | the speed line: stack tops, roofs, ramp flight paths | time-trial | none |
| Crash 4 additions | timed red-`!` outlines, lids that turn to iron on a timer, phase (mask) crates, slow-motion Nitro, Nitro detonator at the exit, bounce-wumpa crates, crates on rails | races against a timer, mask-specific access rules, bulk Nitro credit, rail pickups | — | none of the timed/phase types |

**Observed constraints on the vocabulary**

- *Few types per level, staged across the game.* Crash 4's first level has no Nitro, no `!` and no
  reinforced crate ([Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md)). A theme's first
  stage may confine explosives to the bonus ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md)).
- *Nitro counts.* Every game counts Nitro toward the box total and gives one late switch that
  clears them, so the all-box goal never requires touching a Nitro (Crash 4 even pays leftover
  Nitro at the exit detonator).
- *Uncounted metal is grammar, not reward.* Steel blocks, steel arrows and switches never count;
  they are the permanent skeleton of a structure, the parts that survive the player.
- *This game's mix is inverted*: 63 % wood, 9 % `?`, 1 % TNT, 3 % Nitro, 1 % multi-hit and no
  reinforced type, against Crash's 33–41 % wood, 13–26 % `?`, 5–11 % TNT, 9–17 % Nitro and ≈ 5 % striped.
  Plain wood carries no decision; the other types do.

---

## Part III — Cluster grammar

### III.1 Size and shape

| Shape (canonical) | Share of clusters C2 / C3 / C4 | What it asks of the player | Typical precedent |
|---|---|---|---|
| Single | 34 / 39 / 46 % | a steering target, a landing marker, a hidden pickup | [Bear It](crate-bible/levels/c2-08-bear-it.md) landing markers on the far bank of jumps |
| Stack (2–5 high) | 16 / 15 / 12 % | an order: what is on top, what is underneath, what falls when the base goes | [Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S1-d: spin only the middle box so the striped top lands intact |
| Pair | 10 / 13 / 9 % | a beat (one each side, one each lane) | [Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md) S7-c |
| Row | 9 / 6 / 5 % | a line to follow, a lane to hold, a wall to break | [Bear Down](crate-bible/levels/c2-13-bear-down.md) S2-c two-line field |
| Floating line | 6 / 7 / 6 % | a jump arc to trace, a hover path, a ramp flight | [Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md): 8 floating crates on every boost line |
| Grid / block / mountain | 4 / 7 / 2 % | peel order, buried hazards, slam cubes | [Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) H-a: crate mountain with one buried TNT |
| Sandwich | 4 / 3 / 2 % | repeated bounces between two crates; the lower must outlive the upper | [Toad Village](crate-bible/levels/c3-01-toad-village.md) S1-c: striped over striped, 20 fruit |
| Wall (blocks the path) | 3 / 2 / 1 % | break to pass — or, under a no-break rule, vault it | [Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S2-c (blue gem forbids breaking it) |
| Pyramid | 2 / 2 / 1 % | a high crate above a support structure | [A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S5 pyramid with a high crate |
| Stepping stones | 3 / 2 / 2 % | crates as the only footing over a hazard; they break as used | [Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S2-a/S3-d over no-spin mud |
| Bridge | 1 / 1 / 1 % | crates span a gap; the act of crossing consumes them | [Hang Eight](crate-bible/levels/c2-03-hang-eight.md) G-c floating boxes that break on landing |
| Column (bounce up) | 2 / 1 / 0 % | climb a structure by bouncing | [Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) bonus relay |

- **Mean cluster size is 3.0 / 2.5 / 3.2 crates** (median 2). Single crates are a third to a
  half of clusters but only **12–17 % of all crates**: most crates live in structures.
- **This game: mean 1.56, 84 % singles, ≈ 58 % of counted crates standing alone, tallest
  collectible stack 4.** Part XVIII shows where.

### III.2 What goes where inside a structure

- **Top of a stack = the target or the tool; base = the support.** Striped crates on top so a
  careful break drops them intact ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S1-d,
  [Toad Village](crate-bible/levels/c3-01-toad-village.md) S2-e: slide, don't spin, so the striped
  crate falls unbroken).
- **Where the explosive sits defines the safe approach** ([Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md)
  S1-e vs S4-a): TNT on top — stomp it and leave; Nitro at the base — break from above or in the
  air only; a ring of Nitro — approach from the open side; Nitro switched on over rewards — sealed
  until a TNT key ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) bonus).
- **Heavy crate on TNT** is Crash 4's standard lock: jump-attack the heavy top so the TNT burns its
  fuse instead of detonating on contact ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md)
  S8-a, [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) S2-c/S5-b). **TNT on a breakable
  crate** drops to your level when its support goes ([Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md) S1-h).
- **A column cleared from the bottom** (だるま落とし): Nitro / wood / slot, slide the base out
  ([Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) S4-a).
- **A buried hazard in a generous pile** punishes spin-spam: the most generous-looking pile is the
  only one that can kill ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) H-a, body slam
  forbidden).
- **Walls carry one special crate** — a `?` behind or inside a wood wall, a striped crate in the top
  row as the no-break foothold, a `?` in the centre of the temple's only exit
  ([Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md) S2-h: every player sees
  unsupported crates drop).
- **Explosive walls chain**: knock out one bottom crate of a TNT wall and the chain clears all of it
  ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S2-c; [Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md)
  S3-f six-TNT wall: vault it to finish, light one for all boxes).

### III.3 Grammar by mode

Checkpoints mark mode changes, and each mode has its own crate grammar
([Air Crash](crate-bible/levels/c2-07-air-crash.md), [Crash Dash](crate-bible/levels/c2-05-crash-dash.md)):

| Mode | Grammar |
|---|---|
| On foot, free movement | stacks, blocks, walls, sandwiches, switch rooms, explosive puzzles |
| Forced ride (bear, tiger, chase) | singles, pairs and loose fields on lanes; stacks only on jump lips; explosives beside the lane, never on it, never in an unstoppable chase |
| Vehicle on water (jet board/ski) | steering targets each paired with a hazard; height only through ramps; boost gates kept clear |
| Rail (Crash 4) | crates above, beside and below the rail; no explosives on rails; checkpoints at entry and dismount |
| Side-scroll | pockets into the screen, crates hidden by foreground scenery or under ledges |
| Bonus round | one dense puzzle box: vertical stacks, switch relays, return sweeps, the life crate |

---

## Part IV — Placement logic

Every placement in the maps can be read as an answer to "what does this crate make the player
do *here*?". The recurring answers:

### IV.1 Relative to the route

- **On the line (rhythm).** About a third of clusters are collected by simply following the route
  (`ON-PATH` is the most frequent tag in all three games). They pace the route and confirm the
  line; they are *not* the all-box challenge.
- **On the far side.** Crates sit where you land after a jump, a log or a drop
  ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) S1-c, S4-d; [Bear It](crate-bible/levels/c2-08-bear-it.md)
  S1-c, S2-b, S4-d) — they reward committing to the jump and tell you where to aim.
- **Just beside the line.** One step off the racing line, so collecting costs a small, visible
  deviation ([Makin' Waves](crate-bible/levels/c3-05-makin-waves.md) S1-b, a 1-second crate the
  time-trial page says to skip).
- **Behind or under.** Behind a low wall you just jumped ([Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md)
  S1-f, the level's first count trap), under ledges in side-scroll ([Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md):
  six crates under ledges), in a pocket into the screen ([Snow Biz](crate-bible/levels/c2-06-snow-biz.md) S2-b).
- **Backtrack.** Behind the start, behind a checkpoint's arrival point toward the camera
  ([Snow Go](crate-bible/levels/c2-02-snow-go.md) S4-b: the green `!`), or made real only after a
  switch further on.
- **High and low.** High crates are guarded by one-use tools — an arrow under a bounce crate, a
  `?` springboard, a TNT launch ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S3-c,
  [Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) S10-b). Low crates sit in mud, swamps and
  pits, reachable by a body slam from inside ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S3-d).

### IV.2 Relative to gaps, platforms and floors

- **Rest stops after "don't stop" runs.** Crates sit on the solid platform *after* crumbling tiles
  or a fire lane, never on the hazard itself ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md)
  S2-a, S3-b, S4-a).
- **Safe islands.** Masks and lives on steel islands in a flooding channel
  ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) S2-a, S2-f); crate stacks in the safe
  pockets between blinking laser gates ([Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) S1-b).
- **Crates as the footing.** Stepping stones across no-spin mud, a bridge of floating crates that
  break on landing, striped crates as the only footing over a gap under six floating `?`
  ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md) B-d) — the crate is both a count item and
  the route, and breaking order decides which you keep.
- **Mode changes and dead ends.** Crate piles mark the drop hole at an apparent dead end
  ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S1-b, S4-a); a 2×2 block marks the bear's
  mount point ([Bear Down](crate-bible/levels/c2-13-bear-down.md) S1-a); the start trio triggers
  the chase ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) S1-b).
- **Last chance before one-way.** A big hazard-free crate wall right before a one-way drop
  ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md) S3-e) — the all-box run must be
  completed before the point of no return.

### IV.3 Relative to enemies

- **Enemy as step.** A crate floats out of reach above a spiked turtle; only a stomped, flipped
  turtle gives the height ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S3-b). A rat
  is the springboard onto a walled platform and onto a TNT stack
  ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) S1-b, S1-d).
- **Enemy as projectile.** Every frog pond borders a crate group; a spun frog flies into the
  crates ([Toad Village](crate-bible/levels/c3-01-toad-village.md) S2-b, S2-e, S3-a).
- **Crate as shield.** A crate in front of an enemy forces you to jump the crate (killing the
  enemy) before collecting it (Road to Ruin S1-c).
- **Explosive kills the guard.** A TNT whose blast clears the lizard you would otherwise have to
  slide-kill (Road to Ruin S1-d, S4-b).
- **Enemy you must keep alive.** The only way up to a death route's green `!` is a robot left alive
  on the outward run ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) P3). Every enemy
  in the puzzle-dense levels is paired with a crate or explosive: projectile, weapon, step, or
  survivor ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md), [Ruination](crate-bible/levels/c2-19-ruination.md)).

### IV.4 Relative to timed hazards

- **Pure timing corridors carry no crates**; the rooms between them are dense. Smasher, fire-statue,
  piston and beam corridors are crate-free in the puzzle-dense Crash 2 levels
  ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md), [Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md)),
  so the player never has to choose between a timing and a pickup they cannot see coming.
- **Where they do mix, one crate (or one small group) per safe window.** Crates hanging off a ceiling mesh are spaced
  one per floating-mine patrol window ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S2-a,
  S3-a); crates in water never more than two at a time, one per low-water window
  ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md)); a crate on a table swept by flame jets
  ([Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md) S1-b).
- **Inside the hazard lane.** A 2-stack inside a fire statue's lane: collecting costs part of a
  cycle ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) S2-a).
- **Two clocks at once.** TNT stepping stones in a flooding channel: the fuse and the water
  ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) S1-d).

### IV.5 Relative to the camera

- **Toward the camera** is where crates hide in corridor levels: behind the checkpoint arrival
  point, on floes reached by riding toward the camera ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md)
  S6-a, S9-b), behind waterfalls, right after cutscenes.
- **Foreground occlusion** in side-scroll: crates behind foreground rock
  ([Snow Biz](crate-bible/levels/c2-06-snow-biz.md) S3-a) or behind low walls on the isometric map.
- **Signposting** when the hidden crate matters: blue neon arrows point at hidden crates and rail
  inputs ([Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md) S4-a); empty outline
  crates visible from the spawn advertise a route that does not exist yet
  ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) HO-a).
- **Announce once, then repeat quietly**: a hidden `?` above a jump carpet is pointed out the first
  time and only hinted the second ([Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) S2-b → S4-c).

### IV.6 Relative to checkpoints and the bonus

- Checkpoints sit **inside** crate groups on forced rides so the same carve collects them
  ([Orient Express](crate-bible/levels/c3-03-orient-express.md): C1 between two crates, C2 the first
  of a five-crate slalom) — a missed checkpoint on a forced ride cannot be fetched.
- The checkpoint stands **beside the bonus pad**, and the bonus adds into the main counter on exit
  ([Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md), [Off-Balance](crate-bible/levels/c4-4-3-off-balance.md),
  [Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md)) — the bonus doubles as a save point.
- **Shelters**: each boulder chase ends in a roofed room with a checkpoint and 2–3 crates where the
  boulder stops ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md) S1-b, S2-a, S4-a).

### IV.7 Count traps — where the all-box run is lost

Count traps (crates easy to miss for the gem) are not random; they cluster at **attractors**,
places where players' attention is elsewhere:

| Attractor | Examples |
|---|---|
| Right after a checkpoint (players glance back, then run on) | slot crate after C1 ([Toad Village](crate-bible/levels/c3-01-toad-village.md) S2-a); crate right of the second checkpoint ([Off-Balance](crate-bible/levels/c4-4-3-off-balance.md)) |
| Right before the exit (players relax) | slot crate before the gate (Toad Village S3-d); `?` + TNT at the last bend ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) S4-i); the green `!` below the final platform ([Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md) S4-e) |
| The far side of an obstacle you just cleared | crate behind a low wall ([Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md) S1-f); crate behind a ramp lip — launching skips it ([Makin' Waves](crate-bible/levels/c3-05-makin-waves.md) S2-f) |
| Beside the bonus pad | two crates beside the pad (Rude Awakening S5-d); crates in the tyres either side ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) T-a/T-b) |
| Above the line | floating lives above the road ([Orient Express](crate-bible/levels/c3-03-orient-express.md) S1-f, S2-d); a crate out of camera view above a TNT ([Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) 139/187) |
| Tools that must survive | an arrow that is not broken by bouncing, so it is easily left behind ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) X-g) |
| Direction and momentum | crates behind the start ([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) S0-a); two floating `?` over a tar slide that momentum carries you past, with crusher blocks as the steps back up ([Tomb Time](crate-bible/levels/c3-09-tomb-time.md) S4-a/b); one-way rejoins that demand a reverse run (Sphynxinator P1) |
| The switches themselves | hidden behind scenery ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) S4-a: four `!` behind ice pillars), making the room worse ([Ruination](crate-bible/levels/c2-19-ruination.md) S2-d: outlines become Nitro), or at the far end so collecting needs a reverse trip ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) bonus) |

The median first count trap appears 14–42 % of the way into the route; the final one is usually
the green `!` itself (VI.2).

### IV.8 Pricing rewards by risk

- **Lives are never on the safe line**: over a Nitro floor ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md)
  X-e), between two mines ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) W1-b), ringed by four
  TNT ([Air Crash](crate-bible/levels/c2-07-air-crash.md) S3-d), in a TNT/1UP/TNT column
  ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md) B-c), next to TNT in a row
  ([Snow Biz](crate-bible/levels/c2-06-snow-biz.md) S1-b), at the bottom of a steel-hemmed column
  reachable only by body slam ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md) B-b).
- **A single `?` framed by Nitro** with an Aku crate just before it (The Eel Deal S2-a/S2-b;
  [Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md) S1-h, a `?` ringed by three Nitro just
  past a beam fence, so you arrive fast and must stop short).
- **Masks before hazards**: the first explosive or hanging test of a level comes one or two
  clusters after an Aku crate ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) S3-a,
  [Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) S1-d/S3-d, [Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md)
  S1-d); a mask crate sits in the TNT's blast so the explosion pays it out
  ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) S1-d).

---

## Part V — Explosives, switches and special crates

### V.1 TNT: seven jobs

| Job | How it is built | Precedents |
|---|---|---|
| **Clearer** | lit beside a wall, a guard or a cluster; the blast breaks crates (still counted) and kills enemies | Road to Ruin S1-d (rat → TNT → kills the lizard, pays out the mask); [Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S2-c TNT wall chain |
| **Springboard** | stomp it (the stomp bounces you) to reach floating or off-camera crates before the fuse ends | [Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md) S2-a; [Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) S10-b/S10-c |
| **Bridge / footing** | a row of TNT with steel as the only safe footing; TNT stepping stones in water | Off-Balance bonus B-a/B-c; [Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) S1-d |
| **Key** | reinforced crate on TNT: the blast is the only way to open the structure; a W/TNT stack on a steel step unlocks crates beneath | Off-Balance S3-a; [Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) S3-c |
| **Switch presser** | a TNT whose blast presses the `!` below or beside it | Gone Tomorrow B-a; [Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) bonus B-f; [Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md) TNT on a `!` |
| **Timer / gate** | pre-lit TNT on a forced ride counts itself down as you approach | [Bear It](crate-bible/levels/c2-08-bear-it.md): all six TNT are pre-lit timed gates |
| **Frame** | TNT heading a line forces left-first order; TNT next to a life makes precision pay | [Bear Down](crate-bible/levels/c2-13-bear-down.md) S2-c/d; [Snow Biz](crate-bible/levels/c2-06-snow-biz.md) S1-b |

- **Teach → test**: a TNT single, then a TNT stack ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md)
  S3-b → S3-c); a TNT stack with a mask reward in the blast, then the same layout without it
  ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) S1-d → S4-b); an on-screen prompt beside
  one TNT, then a wood–TNT–wood triangle ([Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md) S1-j → S1-k).
- TNT almost never sits loose inside a big collectible pile — and when it does, the pile is the
  puzzle ("peel from the outside", Road to Ruin H-a).

### V.2 Nitro: geometry, frames and deferred credit

- **Lane geometry.** Four Nitro along one edge force the other lane at sprint speed
  ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md) S3-a); Nitro framing a centre lane on ice
  ([Bear It](crate-bible/levels/c2-08-bear-it.md) S3-b); a wood–Nitro–Nitro–wood weave
  ([Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md) S8-b).
- **Frames and lids.** A single reward framed by Nitro; a 7-Nitro row laid like a lid over the row
  that holds the switch ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) B-a); a column of
  three `?` at the end of a Nitro row (Snow Way Out B-h).
- **Walls behind their switch.** The green `!` stands in front of the Nitro wall it clears
  ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S5-c/S5-d); a 2×3 Nitro gate at the goal
  behind the green `!` ([Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) S4-f).
- **Tempo rule** ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md), [Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md)):
  no explosives at all in a chase you cannot stop in; in fast sections Nitro sits *beside* the lane;
  only where the player can stop is Nitro mixed into ordinary groups.
- **Deferred credit.** Nitro count toward the total, and the green `!` sits where reaching it costs
  nothing: the end of the level (median position 0.73–1.0 along the main route), after the boss, at
  the end of the bonus. It can clear Nitro the player never visits — death-route and secret-route
  Nitro ([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md), [The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md)
  X-a) — so optional hard routes never tax the all-box goal. Crash 4 pays leftover Nitro at an exit
  detonator: 32 of 187 crates in Off-Balance, 13 + a 36-crate slow-motion block in Bears Repeating.
  Nitro masses are bulk credit, not danger to be collected.
- **Rare inversion**: Road to Ruin puts four Nitro at the very start of a perfect run and credits
  them only from the green `!` near the goal — the run is "closed" at the far end.

### V.3 Switches and outlines

| Pattern | Effect on the player | Precedents |
|---|---|---|
| **Outline promise** | outlines visible before (sometimes long before) the switch exists | [Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) HO-a (filled from another level) |
| **Switch after its outlines** | forces a backtrack | [Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) S2-b; [Snow Biz](crate-bible/levels/c2-06-snow-biz.md) B-c |
| **Switch out of view** | rewards looking around | [Snow Go](crate-bible/levels/c2-02-snow-go.md) S4-f (`!` hidden off-screen above a steel arrow) |
| **Delayed switch** | outlines solidify two docks later | [Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md) S7-e → S8-d |
| **Switch relay** | four switches in forced order across crumbling floors | Road to Ruin bonus B-a |
| **Switch builds the route** | a steel bridge with wood crates in it leads onto the next rail; an outline staircase over spikes, broken from below | [A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S6; [Snow Go](crate-bible/levels/c2-02-snow-go.md) S3-c |
| **Switch turns hazards on** | outlines become Nitro on top of the reward crates; a TNT chain later releases them | [Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) B-e → B-h |
| **Switch moves the level** | Egypt `!` blocks move platforms as well as materialising outlines | [Tomb Time](crate-bible/levels/c3-09-tomb-time.md) |
| **Timed outlines (C4)** | red-`!` crates exist for a few seconds; often the stairs to a permanent crate; lids that turn to iron when a timer ends | [Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) S1-b/e/f, S7-a/b; [Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md) B-c; [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) bonus |

Median switch position is the second half of the route in Crash 2/3 (0.46–0.71); Crash 4 brings
switches earlier (0.24) and makes them timed.

### V.4 Iron-bound / reinforced crates

Taught alone first — an 8-crate iron cube with nothing dangerous nearby
([Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) S1-c), a lone reinforced crate
([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S5) — then combined: a life on three iron
crates beside a Nitro (Gee Wiz S2-a), wood–reinforced–TNT–reinforced pyramids under a high crate
(A Real Grind S5), reinforced over TNT as a key ([Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) S3-a),
an iron-bound crate on a switch that builds a three-crate stair when slammed
([Air Crash](crate-bible/levels/c2-07-air-crash.md) B-b–B-d). **This game has no reinforced kind**
(see XVIII.3, item 8).

### V.5 Striped, arrow, slot and time crates

- **Striped crates pay per hit and must often outlive their job**: sandwich payouts, the lower crate
  of a sandwich strands the upper if broken first ([Toad Village](crate-bible/levels/c3-01-toad-village.md) S1-c),
  striped crates as the only footing across a gap ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md) B-d),
  ramming a striped crate on a vehicle pays all ten fruit at once ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) W1-a).
- **Arrows are tools that must survive**: an arrow under a floating striped crate
  ([Snow Go](crate-bible/levels/c2-02-snow-go.md) S1-b); an arrow box that must survive until a
  later route creates the crate above it ([Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) R-a/R-b);
  a bounce crate on a wooden arrow under a high crate — spin the stack and the high crate is lost
  ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S3-c); an arrow on top of a 5-stack
  ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) B-c); an arrow whose bounce drops you into a
  hole at the mesh end ([Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) S3-g).
- **Slot crates go where players pause**: right after a checkpoint and right before the gate
  ([Toad Village](crate-bible/levels/c3-01-toad-village.md) S2-a, S3-d); one ahead of a life on a
  timer ([Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) S2-b).
- **Time crates follow a different line from the all-box run**: on stack tops, roofs, ramp flight
  paths and behind the hard decisions ([Orient Express](crate-bible/levels/c3-03-orient-express.md):
  22 time crates worth 29 s against a 16.9 s record). The tiger dips before jumping and landing, so
  a time crate on the second tier only breaks if you land just before the stack — the designers put
  the 1-second crates on the stack tops. Time trials also turn three Aku crates into timed
  invincibility through the hardest stretch ([Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md)).

---

## Part VI — Pacing and structure

### VI.1 Sections and checkpoints

- **Main-route crates between checkpoints: median 10 (C2), 12 (C3), 11 (C4)**; sections range from
  a handful on chase stretches to 30–50 in dense rooms. Crash 2 averages 3.4 checkpoints per stage
  and ≈ 20 boxes per checkpoint over the whole stage including optional routes; Crash 4 levels in
  the set have 4–5.
- **Checkpoint placement**: after each new idea and before the next; on entry ledges and landings
  around rails, never on a rail ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md)); right
  before every vehicle run ([Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md)); at every
  dock ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md)); in the shelter at the end of each chase
  ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md)); beside every bonus pad; mid-ride after the
  dense half of a bear ride ([Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md)); inside
  crate groups on forced rides ([Orient Express](crate-bible/levels/c3-03-orient-express.md)).
- **Checkpoint state matters**: a death restores the section's crates, so every irreversible crate
  puzzle needs a checkpoint before it, and a checkpoint after a destroyed tool can bank a failed
  all-box state (the player restarts for the gem — acceptable in Crash, but make it visible).

### VI.2 Teaching order inside a level

Median position (0 = first section, 1 = last) where each function first appears on the main route:

| Function | Crash 2 | Crash 3 | Crash 4 |
|---|---|---|---|
| TEACH, ON-PATH rhythm, first CHECKPOINT | 0 | 0 | 0 |
| ENEMY-LINK, AKU | 0 | 0.17 / 0 | 0 / 0.55 |
| SUPPORT-ORDER (first order puzzle) | 0 | 0.13 | 0.14 |
| TOOL (arrow, striped, TNT used as a tool) | 0.10 | 0.33 | 0.17 |
| EXPLOSIVE-MIX | 0.23 | 0.42 | 0 |
| TEST (recombination under pressure) | 0.25 | 0.50 | 0.07 |
| HIGH | 0.25 | 0.33 | 0.13 |
| EDGE-BAIT, TIMED, HIDDEN | 0.33 | 0.13–0.33 | 0–0.50 |
| COUNT-TRAP | 0.42 | 0.33 | 0.14 |
| SWITCH | 0.46 | 0.67 | 0.24 |
| OUTLINE | 0.63 | 0.71 | 0.24 |
| NITRO-SWITCH (green `!`) | 0.73 | 1.00 | 1.00 |

Read as a recipe: open with the level's vocabulary alone and safe; bring tools and explosives in
the first third; test and hide in the middle; save switch structures for the second half; close
with the green `!`. Crash 4 compresses the curve (earlier tests, earlier switches) because its
players already know the vocabulary.

- **Teach → test pairs inside one level** are the norm: iron cube → iron column; a carpet crate
  announced → repeated silently; TNT single → TNT stack; a striped-crate payout pair on safe ground
  → striped crates under lives over a Nitro floor ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md)).
- **New behaviours first appear alone on safe ground** (A1's rule): the first striped pair, the
  first ice pair, the first slam cube, the first TNT next to a single wood crate with an on-screen
  prompt. **The hard recombinations go into optional routes.**
- **"Dodge = collect", then decouple** ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md)):
  the first crate of each new move sits exactly where dodging the obstacle puts you; the test puts
  the crate just past the obstacle in the *opposite* posture.

### VI.3 Masks, lives and difficulty assistance

Aku crates come one or two clusters before the first explosive or hazard test and immediately
before the hardest stretch; lives are priced by risk (IV.8). Vehicle stages carry no Aku crates in
Crash 2. Crash 3 time trials convert three Aku crates into timed invincibility.

### VI.4 The two goals: clear vs all-box

- **Optional routes hold a large share of the boxes**: 37 % of all Crash 2 boxes; Turtle Woods 32/62,
  Hang Eight 51/74, Road to Ruin 58/88, Snow Biz 79/124. Crash 4 bonuses are 12–22 % of each level.
- **The bonus round is a puzzle box, the main route a rhythm track.** Bonuses are single
  side-view rooms whose geometry changes after a switch and forces a return sweep
  ([Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) B-a…f; [Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md):
  floating crates are your footing home); they hold the dense vertical puzzles and usually the life crate.
- **Couple or decouple the no-death and all-box goals on purpose.** Road to Ruin's death route holds
  0 boxes (the perfect run never needs it); Diggin' It's holds 12 and bypasses half the normal
  course, so a perfect run sweeps that half *backwards*, with checkpoints placed for the loop
  ([Diggin' It](crate-bible/levels/c2-17-diggin-it.md)); Cold Hard Crash's death route holds ≈ 21 and Piston
  It Away's holds the only green `!`, so both demand a deathless run for the gem. Secret routes may hold no crates at all
  ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) red-gem course) or only Nitro credited
  remotely ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md)).
- **Three ways to tie a colored-gem route to the all-box goal** ([Tomb Time](crate-bible/levels/c3-09-tomb-time.md),
  [Dino Might](crate-bible/levels/c3-11-dino-might.md), [Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md)):
  the route holds boxes (Tomb Time, 25); it holds the green `!` that clears main-path Nitro
  (Dino Might); it holds nothing and is a pure skill route for its own gem (Sphynxinator).
- **Cross-level promises.** Outline crates in Road to Ruin are filled from a hidden entrance in
  Diggin' It; Air Crash's only green `!` sits behind Bear Down's secret warp — the box gem is
  impossible on the first visit, by design.
- **Fork order and last chances.** Each fork's dead end must come first; a large crate wall waits
  before the one-way drop ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md)). The all-box
  difficulty is sequencing and commitment, not concealment.
- **Vehicles can destroy a route.** Air Crash's stepping crates are easy board targets, but on foot
  they are the only bridge to a secret warp — boarding through them first closes that route
  ([Air Crash](crate-bible/levels/c2-07-air-crash.md) S2-a). This is the closest Crash precedent for
  this game's consumable grind rows.

---

## Part VII — Puzzle archetypes

A crate puzzle exists only if there is a **correct order** and a **tempting wrong order that costs
something** (a crate, a route, a life). Each archetype below lists real instances; open the level
map for the exact layout. "Loss" says what the wrong order costs: *all-box* (the gem), *route*,
or *life*.

### VII.A Support and order

**A1 · Harvest before dismantling.** A target sits on or above a breakable support; take the target
first, then the support. Instances: striped over striped — breaking the lower first strands the
upper ([Toad Village](crate-bible/levels/c3-01-toad-village.md) S1-c); a 3-stack wood/wood/striped
where only the middle box is spun so the striped crate drops onto the base
([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S1-d); use a 2×2 iron block as a step to a
floating `?` *before* slamming it ([Dino Might](crate-bible/levels/c3-11-dino-might.md) P5); take the
life off the top of a TNT stack before anything else (Dino Might P2). Loss: all-box.

**A2 · Ride the collapse.** Breaking the base of a stack lowers the rest; ride the falling stack as
an elevator. Spin the bottom two of a 4-stack with a TNT inside, ride the drop and jump from the
top crate to a ledge holding a life before the TNT blows ([Tomb Time](crate-bible/levels/c3-09-tomb-time.md)
P1). Loss: life + all-box.

**A3 · Clear from the bottom (だるま落とし).** A column whose top is dangerous to touch: slide the
base crates out one by one ([Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) S4-a:
Nitro/wood/slot); break the wood notch first, then slam down the middle of an iron-bound wall
([Ruination](crate-bible/levels/c2-19-ruination.md) P5); slide the side columns of a 4×4 cube
with a TNT core ([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P5). Loss: life or all-box.

**A4 · Preserve the tool.** A launcher must survive until it has done its job: an arrow that must
survive until a later route creates the crate above it ([Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md)
R-a/R-b); a bounce crate on a wooden arrow under a high crate ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md)
S3-c); a bounce crate that reaches an off-camera crate ([Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md)
S7-c/d); striped steps that must survive the outward trip of a bonus so you can return
([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) P2); an arrow left unbroken because
bouncing does not break it ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) X-g). Loss: all-box.

**A5 · Crates as consumable footing.** Crates are the only route and are destroyed by using them:
striped crates as the only footing under six floating `?` ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md)
B-d); floating boxes that break on landing ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) G-c);
a bridge of striped crates at the end of a bonus ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md)
B-h/B-i). Loss: route (fall) or all-box.

### VII.B Explosives

**B1 · Peel the pile.** A generous pile hides an explosive: peel from the outside, expose it, light
it and step away ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) H-a, body slam forbidden);
a 2×2 wood pile with a Nitro hidden behind — spin from the front, never slam or angle in
([Ruination](crate-bible/levels/c2-19-ruination.md) P1); a 1UP behind a Nitro in a wall hollow —
step in and jump-break, don't spin ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) P3).
Loss: life.

**B2 · Same silhouette, new hazard.** Repeat one pile shape with the explosive moved: three identical
2×3 piles with TNT in no row, the middle row, then the bottom row
([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P4); the same 3-stack with TNT on top
(stomp and leave) and Nitro at the base (top-down only) ([Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md)
S1-e vs S4-a). Loss: life. The player learns to *read* a structure before acting.

**B3 · Light, retreat, let it work.** Stomp the penguin, stomp the `?`, light a TNT in a 2×2
TNT/`?` pile and retreat ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) P4); bounce
off a rat onto a TNT stack whose blast pays out the mask ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md)
S1-d); light a heavy-capped TNT by jump-attacking its top (Crash 4 lock, III.2). Loss: life.

**B4 · Time the fuse to a patrol.** A lizard paces between two TNT; light the near TNT as it
reaches the far end ([Ruination](crate-bible/levels/c2-19-ruination.md) P4). Loss: life / enemy survives.

**B5 · TNT as launcher.** Stomp a TNT to bounce into floating crates before it blows
([Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md) S2-a; [Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md)
bonus P6; climb lit TNT steps quickly in [Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P6).
Loss: life.

**B6 · Explosive wall chain.** One knocked-out crate drops a TNT and the chain clears the wall
([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) S2-c); vault the wall to finish or light one
to count all six ([Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md) S3-f). Loss: all-box
if you vault.

**B7 · Drop the heavy onto the TNT.** Spin the two `?` under an iron crate so it falls onto a TNT,
then slam ([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P6; Crash 3: dropping a box or
block onto TNT starts its fuse). Loss: all-box.

**B8 · Nitro lid / frame.** A Nitro row laid over the row holding the switch
([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) B-a); a single `?` framed by Nitro with an
Aku just before ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md) S2-a/b); hidden Nitro
directly behind a staggered stack punish overshoot ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md)).
Loss: life.

**B9 · Let the hazard clear it.** Stone pillars crush two Nitro on greasy tar if the player waits at
the edge ([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P3). Loss: life (if you hurry).

### VII.C Switches

**C1 · The switch builds the way.** A `!` creates a steel bridge with crates in it leading onto the
next rail ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S6); a `!` materialises a 2×3
outline bridge ([Tomb Time](crate-bible/levels/c3-09-tomb-time.md) P2); a steel arrow under a floating
3-crate column capped by a `!` that builds a steel bar over two Nitro to a floating `?`
([Dino Might](crate-bible/levels/c3-11-dino-might.md) P3). Loss: all-box.

**C2 · Switch, then return.** An outline life at the death-route start fills only from the
route-end `!` ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) P5); a switch placed after
its outlines ([Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) S2-b); both bonus lives are
outlines filled from the far end of the bonus ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md)).
Loss: all-box.

**C3 · Find the switch.** Four `!` blocks hidden behind two ice pillars fill an outline row; the
route clears without them ([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) P2); a `!`
hidden off-screen above an arrow ([Snow Go](crate-bible/levels/c2-02-snow-go.md) S4-f). Loss: all-box.

**C4 · Do not press yet.** A `!` turns six outlines into Nitro: press it only on the perfect run and
leave cleanly, then detonate them with the green `!` after C4 ([Ruination](crate-bible/levels/c2-19-ruination.md)
P2); a second `!` turns outlines into Nitro *on top of* the reward crates
([Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) B-e → B-h). Loss: life.

**C5 · Relay.** Four switches in forced order across crumbling floors
([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) B-a). Loss: route (fall).

**C6 · Race the timer.** Red-`!` crates exist for seconds; a timed staircase leads to a permanent
crate ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) S7-a/b); blow a framed TNT before
its frame turns to iron ([Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) bonus). Loss: all-box.

**C7 · An enemy or a blast presses it.** Slide-kick a porcupine into the `!` behind him
([Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) P1); a TNT blast presses the `!`
below it ([Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) B-a); bounce off a circling rat
to reach a green `!` floating out of jump reach ([Ruination](crate-bible/levels/c2-19-ruination.md) P3).
Loss: all-box.

### VII.D Route-scale puzzles

**D1 · Reverse sweep.** An optional route skips part of the main course, so the perfect run comes
back for it: Diggin' It's death route (12 boxes) skips half the course
([Diggin' It](crate-bible/levels/c2-17-diggin-it.md) P1); the perfect route runs the right course
backwards after the purple course ([Tomb Time](crate-bible/levels/c3-09-tomb-time.md) P4); a fork
whose left branch rejoins by a one-way drop — all-box = left, reverse right, forward
([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P1); the only green `!` at the end of the
death route forces a deathless reverse run ([Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) P3).

**D2 · Remote credit.** The green `!` at the end of a gem course clears Nitro on the main path
([Dino Might](crate-bible/levels/c3-11-dino-might.md) P1); the secret course holds only Nitro, cleared
from the main route ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md)).

**D3 · Cross-level promise.** Outlines in one level, their switch in a hidden entrance reached from
another ([Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) ← [Diggin' It](crate-bible/levels/c2-17-diggin-it.md);
[Air Crash](crate-bible/levels/c2-07-air-crash.md) ← Bear Down).

**D4 · Fork order and last chances** ([The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md));
**crates behind the start** ([Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) P2).

**D5 · The vehicle closes the route** ([Air Crash](crate-bible/levels/c2-07-air-crash.md) S2-a).

### VII.E Enemies and timing

**E1 · Enemy as step** ([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S3-b;
[Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) S1-b; Ruination P3). **E2 · Enemy as
projectile** ([Toad Village](crate-bible/levels/c3-01-toad-village.md) frogs; Cold Hard Crash P1).
**E3 · One crate per window** ([Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) mesh crates;
[Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) water). **E4 · The chaser breaks crates and
they still count** — so crates can line a chase without making the gem deadly
([Dino Might](crate-bible/levels/c3-11-dino-might.md) P6).

### VII.F Goal-structure puzzles

**F1 · Same object, opposite instructions.** The all-box run must break the crate wall; the blue-gem
(no-break) run must vault it, using the striped crate in its top row once without breaking it
([Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) S2-c). **F2 · Same prop, different
answers.** Three towers, each with a worker holding a springboard: ignore it (crates in the tunnel),
bounce (crates on the roof), jump over it and the hole (crates under the tower); loose lives on the
roofs are decoys ([Orient Express](crate-bible/levels/c3-03-orient-express.md) S2-a, S3-b, S4-c).

---

## Part VIII — Fast lines: chases, rides, vehicles, rails

These levels are the closest analogues to skating: the player moves fast, often cannot stop, and
steers more than they platform. They share one grammar, and it differs sharply from on-foot rooms.

### VIII.1 The fast-line rules

1. **The crate's lane is the steering command.** Groups run along a lane so holding it collects
   them; slaloms alternate lanes deliberately (left–right–left before the obstacle that demands
   that tempo); single crates mark where to land ([Bear It](crate-bible/levels/c2-08-bear-it.md),
   [Bear Down](crate-bible/levels/c2-13-bear-down.md), [Orient Express](crate-bible/levels/c3-03-orient-express.md)
   S1-a → S1-c).
2. **Every crate is paired with a hazard** — beside the mine line it marks the safe lane, between
   two mines it is the life, in the cannon lane it is the dare ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md)
   W1-b/W1-c, [Makin' Waves](crate-bible/levels/c3-05-makin-waves.md) S1-f, S2-g).
3. **Boost gates and launch lines stay clear of crates**; crates sit just before or after them
   (Hang Eight W2-a). Ramps *deliver* crates: on the flight path, on roofs, under landings, behind
   lips (Makin' Waves S2-e, S2-f, S3-e).
4. **No explosive ever sits on the line you cannot leave.** None in an unstoppable chase, none on a
   Crash 4 rail; Nitro goes beside the lane as geometry ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md)
   S3-a), TNT is pre-lit as a timed gate ([Bear It](crate-bible/levels/c2-08-bear-it.md)). Forced
   lines are *pure reward*, which lets them be dense and strict without costing lives.
5. **Density falls as speed rises**, and difficulty comes from hazards and commitment, not hiding.
6. **Checkpoints sit right before the run, at landings and docks, and inside crate groups**, never
   on the moving line itself.
7. **The time-trial line is a different line**: stack tops, roofs, ramp arcs, the hard decision.

### VIII.2 Chases (boulder, dinosaur)

- The first chases of a level carry **no crates on the run**; each chase ends in a shelter — a
  roofed room with a checkpoint and 2–3 crates where the pursuer stops ([Crash Dash](crate-bible/levels/c2-05-crash-dash.md)
  S1-b, S2-a, S4-a).
- The final chase finally puts crates in the danger lane, **on the hazard side** (pit lip, electric
  fences): run past and spin back, paid for by the lead earned on speed pads (Crash Dash S4-b–S4-e;
  F2: missing one pad makes the box gem near impossible).
- Explosives in chases are edge geometry only; the green `!` may be the chase's last object, so the
  gem needs a lead ([Bone Yard](crate-bible/levels/c3-04-bone-yard.md) S5-c/d). Bone Yard's first
  chase carries 17 crates with no explosives; its free section carries every TNT, the only mask, the
  switch and the bonus; its final chase 4 crates + 3 Nitro.
- When the chaser breaks crates the player missed and they still count, crates may line the chase
  ([Dino Might](crate-bible/levels/c3-11-dino-might.md) P6).

### VIII.3 Rides (polar bear, tiger)

- **Mount and dismount are marked**: a 2×2 block to ram through at the mount
  ([Bear Down](crate-bible/levels/c2-13-bear-down.md) S1-a); the green `!` taken on foot after the
  ride ([Bear It](crate-bible/levels/c2-08-bear-it.md) P5).
- **Lane beats**: one crate each side ([Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md)
  S7-c), a 2-stack on a jump lip (S7-d), a pocket against a wall (S7-n), a full-width wall of six
  iron arrow crates as a launch gate (S7-h), a wood–Nitro–Nitro–wood weave (S8-b).
- **Pre-alignment before ice**: boxes, then Nitro framing a centre lane, teach lining up before a
  slide you cannot steer (Bear It S1-d, S3-b); ice pairs return harder later in the level
  (Bear Down S2-a → S4-b).
- **Line choice**: a big landing into a two-line 10-box field with a TNT heading the right line
  forces left-first (Bear Down S2-c/d); the reward line starts on the safe exit of an 8-Nitro field
  (Bear It S4-a → S4-b).
- **Structure**: a dense, all-or-nothing first half ending at a mid-ride checkpoint; a lighter,
  Nitro-seeded second half whose Nitro is paid at the exit (Bears Repeating).
- **Ride height vs stacks**: the tiger dips before jumping and on landing, so the second tier of a
  stack only breaks if you land just before it ([Orient Express](crate-bible/levels/c3-03-orient-express.md)
  time-trial page). Stack height is a skill check *only* when the mount's body height varies.
- **Same prop, different answers**: three tower props with three different crate solutions
  (Orient Express, VII F2). Floating life crates over the road reward looking up.

### VIII.4 Water vehicles (jet board, jet ski)

- Right after boarding, a forgiving stagger of crates teaches that riding into a crate breaks it
  ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) W1-a: five boxes in a 2-1-2 stagger; ramming a
  striped crate pays all ten fruit at once).
- Every run: a checkpoint, then a floating crate line on the boost line read from far away
  ([Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md): eight floating crates per run);
  the later run threads the same line between mines — "the crate line is the safe line until it is not".
- Height only through ramps: a `?` above a ramp arc reachable only with a boost, a moving mine just
  beyond (Hang Eight W2-b); an in-line pair on a ramp's flight path that needs a flip; a rising line
  of three whose third is too high for a plain jump ([Makin' Waves](crate-bible/levels/c3-05-makin-waves.md)
  S2-e, S3-e).
- Crates on moving rafts with iron or Nitro stacked on top (Jetboard Jetty S4-c, S4-f).
- The main route stays light because the time trial shares it; the dense content lives in the gem
  course and bonus (Hang Eight: 15 of its 23 main boxes on the board legs, 51 of 74 off-course).

### VIII.5 Rails (Crash 4)

[A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) is the only rail level in the set
([Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md) has no rails despite its name; its hover
arcs follow the same "crates on the movement path" rule).

- **Three heights relative to the rail**: above it (jump from the rail), on or beside it (contact),
  below it at hanging height (hang under the rail).
- **Dodge = collect**: the first crate of each new rail move sits exactly where dodging the obstacle
  puts you — a row of three under a spiked board, beside the safe rail of a twin pair, hanging under
  a tower barrier (R1-b, R2-b, R2-g). The test version puts the crate just past the obstacle in the
  opposite posture (R1-f, R1-g).
- One crate sits on the rail line itself (R2-d); a `?` on a car bonnet marks the second rail's
  entrance (R2-a).
- **No TNT or Nitro on rails**; only obstacles kill. **Checkpoints bracket the rails** (entry ledge,
  landing after the launch, dismount) and never sit on them.
- Density: 26 crates across two rails, about one every 2 seconds; [Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md)'s
  rail holds only four, placed at neon cues.

---

## Part IX — Platforms and footing

The level maps record every platform the route stands on, with its shape, size in crates (u), edges,
behaviour and role ([`GEOMETRY_STATS.md`](crate-bible/GEOMETRY_STATS.md) aggregates them). Sizes are
estimates read against crates in guide screenshots: treat them as ranges. This part says what
platforms are *for*. Part XV converts the sizes into this game's metres.

### IX.1 Footing is mostly static, and small where it matters

About three quarters of all recorded platforms are static. Moving, riding, phase, crumbling,
rotating, sinking and bouncy footing together make up the remaining quarter, and they are spent
where the level wants a clock (IX.3). Shapes split evenly between broad floors (rooms, decks,
corridors) and small footing (pads, tiles, stepping stones, pillars, planks). The size of a
platform follows from its role, not from the jump in front of it:

| Role | What it is for | Typical size (smaller × larger side) |
|---|---|---|
| `STEPPING` | a stone in a jump run | ≈ 2 × 2.5 u (smaller side 1.5–2.5 u) |
| `TIMING-STEP` | a step that moves, sinks, flips or is crossed by a hazard | ≈ 2 × 2.5 u |
| `LANDING` | where a committed jump ends | ≈ 2.5 × 3 u |
| `PERCH` | a stable spot to watch a hazard or line up a jump | ≈ 2.5 × 3 u |
| `SAFE-ISLAND` | a pocket of safety inside a hazard field | ≈ 2.5 × 3 u |
| `BONUS-PAD` | a crate deck or bonus entrance | ≈ 2.5 × 3 u |
| `CHOKE` | a narrow lane that forces one line | ≈ 3 u wide (2–3.5) |
| `REST` | a fixed floor between tests | ≈ 3.5 × 4 u |
| `CHECKPOINT-PAD` | the floor a checkpoint stands on | ≈ 4 × 4 u |
| `ARENA` | a room for enemies or a crate puzzle | ≈ 4 × 5 u, often much larger |

Three rules fall out of the table and recur in almost every level file:

1. **Checkpoints and rests stand on the widest fixed floors.** Crash 4's Rude Awakening brackets every
   challenge with a rest floor (courtyard, chamber, decks, cave floor, wall base, summit) and lets
   no two hazard groups touch. Snow Way Out puts every checkpoint on a 3 × 3 to 6 × 3 u pad. Crash
   2's Hang Eight puts all three checkpoints on docks, never on timed footing or the board. No level
   puts a checkpoint on a narrow ledge, a mud crossing, a moving platform or inside a pit.
2. **Crates live on decks, not on stepping stones.** Bears Repeating never puts a crate on its
   1.5–2 u pads; every crate group stands on a deck of 3 × 3 u or more. Road to Ruin keeps crates on
   rest platforms, never on crumbling or hazard tiles. Snow Way Out's 1–1.5 u wall-top carries
   crates in single file and nothing else. Collecting and precise footing are separate beats.
3. **The smallest footing is short and placed just before a change.** Crash Compactor and A Real
   Grind put their 1 u lanes immediately before a mode change (a rail, a bridge the player built);
   Ruination narrows to one tile wherever an enemy patrols, forcing a single counter. A choke is a
   few seconds long and ends in a wider floor.

### IX.2 Landing size is the difficulty dial

Gap width barely moves inside a level (X.2). What moves is the landing:

- **Shrink it.** Off-Balance's landings go 3 → 2 → 1.5 → 1 u and end on a 1 u plank under dragons.
  Crash Compactor's round footing goes from 4 u cog discs to 1.5 u posts to 1 u steel boxes. Snow
  Way Out's falling-ice crossings go from 2 × 2 slabs with a static pillar halfway, to pillars
  6–8 u apart, to 1 × 1 falling cubes on a 1.2 u path with no rest.
- **Occupy it.** An enemy waiting on a 2–4 u landing is the defining side-scroll coupling of Crash 2
  (Snow Go's seal on a ≈ 2 u pillar, Turtle Woods' enemy-on-landing pit, Snow Biz's hedgehog on a
  landing pillar). Crash 4 does the same with spiders over pillar landings (Rude Awakening) and
  enemies waiting where each new move lands (Off-Balance).
- **Make it move.** Air Crash escalates moving footing by axis: a lateral shuttle, static floating
  discs that need air steering, a hippo that sinks when stood on, a bobbing pillar, a pair of
  submerging pillars, then appearing pillars on the death route.
- **Keep the take-off generous.** Coupled landings are small (2–4 u), while teaching landings are
  wide; the take-off side is a floor or a perch. Turtle Woods gives a ? / ? perch over the Nitro
  floor and a rock before the last mud box, exactly where a one-shot jump needs a stable take-off.

### IX.3 Footing that keeps time, in escalation order

Timed footing is how Crash makes a short gap hard and how it forbids stopping (XI.3). The levels
introduce each kind in a mild form, then double or combine it:

| Footing | Mild form first | Escalated form | Examples |
|---|---|---|---|
| Moving (lateral, vertical, orbit) | a slow shuttle between fixed floors | a chain of movers, or a mover carrying a threat | Air Crash discs; Bears Repeating hung pads → lift discs; Crash Compactor's disc carrying explosives round a still player |
| Sinking / bobbing | one pillar, skippable by a fast jump | pairs, offset; enemies as sinking footing | Hang Eight pillar ×1 → ×2, hippos; Air Crash submerging pillars |
| Crumbling | a single tile beside the line, or a code shown once | runs with no rest, with fire or enemies | Road to Ruin: patterned tiles hold, plain tiles crumble; Bears Repeating's crumbling ice under slow-mo; Rude Awakening's skulls for the finale |
| Phase / switch-made | appears per switch on safe ground | half the squares solid under a toggle; outlines that close into iron | A Real Grind's phase bridge and half-solid field; Bears Repeating's closing lid |
| Rotating / tilting | one revolving pad by a wall | a ring of pads, enemies riding it | Ruination's ring of four hex pads, rats circling a floating green `!` |
| Falling (as you approach) | a stump that falls and recovers | a five-smasher colonnade where stopping kills | Cold Hard Crash's stumps relent at the end; Snow Way Out's falling cubes |

Two placement rules apply to all of them. **Timed footing follows a static teaching stretch**:
Rude Awakening gives about 2.5 minutes of static ground before its sinking blocks. And **a timed
crossing ends on a checkpoint floor or a wide rest**, never on another timed platform.

### IX.4 Surfaces are a code, previewed once in isolation

Ice, mud, electric strips, red-hot floors and coloured tiles change what a floor means. Crash shows
each code once where it cannot kill, then uses it:

- Snow Go's ice escalates in four steps: a walled field with one TNT where nothing can fall, a field
  with Nitro pairs, narrow icy bonus ledges, ice in front of an enemy. Snow Biz introduces ice on
  its widest pit-free floor, makes it a run-up that seals can steal, a downhill that carries you
  past crates, and finally a bounded patch whose step stops any slide.
- Snow Way Out previews its three floe types (frosted rests, clear slides, cracked breaks) on a single
  floe between two piers before the full field.
- Bear Down uses ice three times: with crates on it, empty, then stricter.
- Road to Ruin codes footing by texture: patterned tiles hold and plain tiles crumble.
- Stowing Away's electric strips run on both floor and ceiling with 2–3 u safe pads; the gravity
  mask makes the "gap" a choice of surface.

Ice never borders a lethal edge until momentum is the point of the beat (Snow Biz, XII.2).

### IX.5 Lane width and edges

Width is a dial the levels turn on purpose:

- **Walled corridors remove side falls from the main course.** Turtle Woods' ≈ 5–8 u walled lane
  leaves room to steer around enemies, which is why its early enemies are optional. Stowing Away's
  tubes are 4–5 u wide and walled, and the floor is continuous: the difficulty is across-path hazards.
- **Lethal space lies beside the line, not in it** (Draggin' On, Off-Balance): water or void runs
  alongside the walkway, so a lateral mistake kills while the forward line stays readable.
- **Roads narrow for finales and careful moves.** Diggin' It and Bear Down narrow from 5–7 u to 2–3 u;
  Crash Dash's lengthwise trench leaves ≈ 1.5–2 u late in the level; Bear It's ≈ 6–7 u road keeps a
  ≈ 2.5–3 u centre lane between TNT gates and Nitro pairs.
- **Vehicle lanes are slaloms.** Hang Eight's board legs run in a ≈ 6–8 u channel; Jetboard Jetty
  narrows from 8–12 u open water to 2–4 u channels between mines to a 2–3 u gate between whirlpools;
  Bears Repeating's bear valley is 10–14 u wide with 5–6 u tunnels, and each hazard takes one lane.
- **Railed edges mark depth-reading hazards.** Bears Repeating's toward-camera rope bridge (2.5 u)
  has railed sides and posts every 6–8 u as rests because depth is read late.

### IX.6 Platform grammar follows the camera

Each camera mode has its own platform grammar (XIV.3 gives the camera side):

| Camera | Typical footing | Typical gap | Examples |
|---|---|---|---|
| Into the screen | wide walled floors, ice fields, corridors 4–8 u | across-path pits 1.5–3 u, holes beside the line | Snow Go's into-screen sections; Stowing Away's tubes |
| Side-scroll | separate ledges 2–12 u, pillars, stepping stones | ≈ 2 u gaps, crushers on far banks, enemies on landings | Snow Go, Turtle Woods' secret, Rude Awakening's bonus |
| Toward the camera (chase) | one ≈ 5 u lane, slab islands | partial holes, fences, full-width pits late | Crash Dash; Bears Repeating's bridge |
| Vehicle | a channel or valley with lanes | few jumps, prompted, often with a crate on the lip | Hang Eight, Jetboard Jetty, Bear It |
| Side view, vertical | ≈ 2 u tiers, a stable tier every 2–3 | climbs of 12–20 jumps | Rude Awakening's climb; Crash Compactor's phase climb |

### IX.7 Platforms as tools and as route control

- **Unjumpable gaps, closed courts and one-way transitions remove alternatives.** Turtle Woods' rat
  pits (≈ 5–6 u, too wide to jump) force a descent and lock it until every mole is dead; its closed
  court makes a 2 × 5 crate wall unavoidable. Snow Go's free-fall shaft makes S4 a no-return
  section, so its only backward content sits directly behind the arrival point. The Eel Deal pairs
  each dead end with a through route and ends the second fork in a one-way hole.
- **Waiting spots are built into the geometry**: Hangin' Out's zig-zag ceiling meshes leave notches
  to wait in; Cold Hard Crash's disc channels have a 1 u curb; Piston It Away offers a raised piston
  to watch from.
- **Walls appear around checkpoints** (Ruination): rest is visible from the geometry alone.
- **Secrets hang off dangerous space**: behind a lion, a drop into the void, an iron block beside the
  raft (Draggin' On, Jetboard Jetty).

**In this game:** a crate is 1.152 m, so Crash's 2 u stepping stone is 2.3 m and its 4 u checkpoint
pad 4.6 m. This hero lands faster and from longer jumps, so give landings more depth than width:
coupled landings 2.5–4.5 m deep, teaching landings ≥ 6 m deep, checkpoint floors ≥ 6 m (XV.13). The
current courses are the opposite extreme: their median landing after a gap is 28 m deep (XVIII).

---

## Part X — Gaps

Every level map lists its gaps with kind, width in crates, height difference, landing, lethality,
run-up, the move it needs, what it is coupled to and what failure costs. The figures below are
aggregated in [`GEOMETRY_STATS.md`](crate-bible/GEOMETRY_STATS.md).

### X.1 What a gap is made of

Bottomless pits and lethal water make up a little under half of all recorded gaps; the rest are
hurdles and barriers that act like gaps (Nitro lanes, fallen totems, low walls), floor holes,
drop-downs, stepping-stone runs, moving-platform crossings, lava patches, bounce chasms, safe water or
mud, crumble runs, launches, height gates, swings and a few lethal floors (red-hot, shark sand).
Nearly three quarters are lethal. The remainder fail softly: the
player falls out of a bonus, drops to a lower route and loses its crates, is trapped until a pit's
enemies are dead, or is slowed by mud. **Soft failures are concentrated where a lesson is new**
(Turtle Woods: two mud swamps and three rat pits turn failure into delay; Snow Biz: missed float-line
crates cost a climb, not a life) **and where precision is the point** (Cold Hard Crash's post field,
Piston It Away's crate stair). Bonus rooms hold the widest gaps and the smallest tops because a fall there
costs nothing (Rude Awakening, Snow Biz).

### X.2 Widths stay short

Recorded gap widths have a median of **2.5 u** (quartiles 1.8–3 u; 90th percentile 5 u), and the
lethal main-route gaps crossed on foot have the same median. The width barely changes within a level:
Rude Awakening keeps 1.5–3 u from start to finish, Cold Hard Crash, Ruination and Piston It Away
stay at about 1–3 u (median 1.5–2), and Snow Way Out keeps its static gaps at 1–4 u.

Width depends only a little on the move the gap asks for. Every jump type has a median between 2 and
4 u; only device crossings go further:

| Required move | Median width | Quartiles | Reading |
|---|---|---|---|
| plain jump | 2 u | 1.5–2.5 | the default lethal gap |
| running jump | 2.5 u | 2.4–3.5 | announced by a ramp or run-up |
| slide-jump | 2.8 u | 2.5–3.1 | a technique gate more than a distance |
| crate bounce | 2.8 u | 2.5–5.6 | tool gaps; widest 8.5 u |
| spin-extended jump (Crash 3/4) | 3 u | 2–5 | widest 6 u |
| double jump (Crash 4) | 3 u | 2.4–4 | the double jump buys height and margin more than length |
| held / high jump | 3.8 u | 1.8–4.5 | late, often with air steering |
| wall-run, swing | 5–6.5 u | 3–7 | device crossings |
| ride (vehicle, raft, disc) | 3 u | 2.5–4 | the vehicle sets the speed |

Long crossings use a device rather than a longer jump. Off-Balance keeps plain jumps at 1–4 u and
crosses wider gaps by swing, raft, lift or mask hover (5–6 u); every long crossing in Snow Way Out is
a moving platform tied to the mask or a vehicle. Running or maximum-distance jumps are rare on the
main route and live on optional routes (Snow Biz's gem course "maximum jump", Diggin' It's secrets).
Bear Down states it outright: a normal jump from the very edge clears the "big" ponds, so the speed
burst only buys take-off margin.

### X.3 The difficulty is in the coupling

About **three quarters of all gaps are coupled** to something else: an enemy on the landing, a hazard
cycle, a pursuer, an explosive on the take-off, a footing timer, a speed demand, a low ceiling. The
level files describe the same move in every game: keep the gap short and put the problem on its edges.

| Coupling | What it does | Examples |
|---|---|---|
| Enemy on the landing | the jump becomes jump-plus-attack; spin in the air before landing | Snow Go G-S3-c (seal on a ≈ 2 u pillar); Turtle Woods G-S1-d; Rude Awakening's spider over the pillar landing |
| Enemy at the take-off | the run-up must be cleared first | Snow Biz's hedgehog at a take-off edge; Bear It's seals |
| Hazard cycle on the far bank | wait on the near side, go when it rises | Snow Biz G-S2-d (crusher), Snow Go's drop-pillars, Road to Ruin's fire statues after a perch |
| Explosive on the take-off or landing | punishes a careless approach or landing | Snow Biz G-S1-a (TNT row on the take-off ledge); A Real Grind's Nitro mesas |
| Footing timer | the landing sinks, crumbles or moves | Hang Eight's sinking pillar, piranha in the gap, hippos; Road to Ruin's crumbling hex member |
| Pursuer | no time to line up | Crash Dash: the next hazard decides where you land |
| Low ceiling | the strongest jump is wrong | The Eel Deal's last gate: a regular jump passes, a dash-jump kills |
| Lane choice | a two-phase gate | Bear It's orca holes: the first leap shows the safe half, and the crate beyond is often on the other half |

Because of this, **a gap's danger rises in a level while its width stays flat**. The Eel Deal re-dresses
one timed pool five times: wide walkways to wait on, sinking pads that forbid waiting, a mid-pool
platform where waiting is sanctioned, no footing and three floating Nitro, then five floating platforms
with dash-jumps. Same clock, new footing each time.

### X.4 Landings and take-offs

- **Landings are designed, not leftover**: a crate on the landing to aim at, a targeted island, a walled
  crate platform (Diggin' It, Bear It). Crate markers on landings tell the player where to land on
  forced lines (VIII).
- **Coupled landings are small (2–4 u); teaching landings are wide** (Turtle Woods, Snow Go). The
  first-wave crate maps already showed single crates marking landings; the geometry maps show the
  landing itself shrinking as the level goes on (IX.2).
- **Run-up is given where a jump is committed**: Turtle Woods gives ≥ 4 u of run-up to each of its three
  lethal pits; Snow Biz's only running jumps on the main route are announced by an ice ramp.
- **Speed sections end on guaranteed landings**: both of A Real Grind's rails end in an automatic launch
  onto a checkpoint pad; Crash Dash's chases end in shelters.

### X.5 Height differences

Just over half of all gaps are level, a fifth rise and about a tenth drop. Height is rarely gained by
jumping up a gap: it comes from tools and rides (Snow Biz: steel arrow, elevator, crate staircases, gem
platform, return elevator), and each ride is a camera change with a checkpoint. Crash 4 climbs use
≈ 2 u risers marked by fruit columns (Bears Repeating) and vertical finales of 12–20 jumps with a
stable tier every 2–3 (A Real Grind, Crash Compactor). Drops are one-way doors: a free-fall shaft
(Snow Go) or a one-way hole (The Eel Deal) enforces route order and protects a payout.

### X.6 Teaching order for a gap type

The maps show the same ladder in every game:

1. **The move without a pit.** Rude Awakening teaches JUMP on a 0.5–1 u railed step, DOUBLE JUMP up a
   2–3 u dead-end wall and CRAWL under a hut, each with a prompt and nothing lethal; its first forced
   lethal gap arrives ≈ 80 s in.
2. **The pit beside the path.** Turtle Woods' hole beside the path with a box at its lip; Rude Awakening's
   floor hole beside the line.
3. **The full-width pit after a practice runway.** Turtle Woods G-S1-c.
4. **The coupled pit.** An enemy on the landing (Turtle Woods G-S1-d), a crusher on the far bank (Snow Go).
5. **The recombined pit under pressure**, usually at a section's end or on an optional route.

A new gap *shape* follows the same rule: it appears first non-lethal or optional (Turtle Woods' hurdle
that cannot fail, then mud that only slows), then lethal.

### X.7 Gaps that are not jumps

- **Enforced descents and locks**: Turtle Woods' rat pits are walled squares too wide to jump; the
  trampoline exit appears only when every mole is dead.
- **Bonus entrances**: Snow Go's one gap meant to be fallen into is marked by a floating `?` and guarded
  by a Nitro on its take-off edge.
- **Lane narrowers**: Crash Dash's lengthwise trench narrows the lane instead of being jumped.
- **Surface gaps**: Stowing Away crosses its electrified floor by flipping gravity, not by jumping;
  A Real Grind's phase mask makes and removes footing.
- **Height gates**: a vertical "gap" reached with an arrow, a stack or an enemy bounce (Cold Hard Crash,
  Piston It Away's ISGN that must be left alive as the step back).

**In this game:** Crash's 2 u plain gap is 2.3 m, well under half of this hero's 5.85 m running jump.
Width alone cannot carry difficulty here (XV.9): couple gaps to landings, cycles and enemies instead,
keep plain gaps in the 2.5–4 m band on foot and 3.5–8 m on the board, and make every wider crossing a
tool or device crossing.

---

## Part XI — Jumps, sequences and rhythm

A *jump sequence* is a run of consecutive jumps with no rest between them. The maps record each one
with its length, moves, rhythm, widest gap, where the rest is and whether stopping is possible.

### XI.1 Runs are short and end on a rest

Across the maps the median run is **3 jumps** (Crash 4: 4.5), the widest gap inside a run has a median
of 2.5 u, and the longest ordinary runs reach 9–12 jumps. Vertical finales are the exception: Crash 4
builds 12–20-jump climbs on ≈ 2 u tiers with a stable tier every 2–3 jumps (A Real Grind, Crash
Compactor). The level files agree on the spacing of rests:

- a rest after **3–5 coupled jumps** (Turtle Woods, Snow Go, Hang Eight);
- runs of **2–5 jumps ending on a rest or a checkpoint** (Snow Biz, Air Crash, Bear It, The Eel Deal);
- Crash 4's **no-stop runs of 3–6 jumps split by a static rest** (Snow Way Out puts a solid pier, deck,
  pillar or boat every 2–5 jumps; Bears Repeating a railed scaffold or deck every 3–4);
- the **first lethal runs are 2–3 standing jumps where you can stop** (Rude Awakening).

Teaching stretches use isolated jumps with ≥ 4–6 u of flat floor between them (Turtle Woods). Runs
lengthen and rests shorten as a level goes on (Bear It: S1 separates its jumps with crate beats, S3 ends
with three holes in a row, S4 holds a no-stop triple).

### XI.2 Rhythm types

| Rhythm | Share of runs | What it is | Examples |
|---|---|---|---|
| Even | ≈ 40 % | equal gaps, equal beats; the default for teaching and for stepping stones | Snow Biz J-S1-a (three short level pits); Crash Dash's slab islands, one jump per slab |
| Syncopated | ≈ 30 % | uneven beats, set by something moving: wait for a pillar and a piranha, a log passes, two jumps, wait | Hang Eight; Piston It Away; Road to Ruin's rolling logs |
| Accelerating | ≈ 10 % | beats get closer; used to close a section | Snow Biz J-S2-a (two hops past hedgehogs, then the ramp-fed dash-jump) |
| Stop-and-go, isolated | the rest | jump, stop, jump; one jump per screen | Bear Down; the first lessons in every level |

Guides name the rhythm for the player: "count to two", "one-two", "jump, jump, dash, dash"
(Crash 2's Famitsu POINT boxes), *renzoku janpu* (consecutive jumps) and *pyon ×3*. A rhythm that can
be spoken can be learned, which is why Crash Dash alternates its holes and fences left–right–left: the
player reads a cadence instead of individual hazards.

### XI.3 No-stop comes from footing or a pursuer, never from width

About two in five recorded runs forbid stopping, and in every case the reason is the floor or a
chaser, not the size of the gaps: sinking blocks and shark sand (Rude Awakening, A Real Grind),
crumbling ice (Bears Repeating), falling cubes (Snow Way Out), sinking pads in an eel pool (The Eel
Deal), recovering stumps and lit TNT steps (Cold Hard Crash, Ruination), a boulder (Crash Dash), a
rope swing carrying a lit TNT (Snow Way Out's finale). Two corollaries:

- **"Keep moving" and "wait" never share a wall.** Draggin' On's wall shelves either crumble (keep
  moving) or are swept by dragons (wait), never both. Ruination fuses them only once, at its peak beat
  (fire statues say wait, crumbling floors say go), and Piston It Away's peak beats do the same.
- **Every timed crossing has a slow safe line and a fast line.** Hang Eight's guide dash-jumps the pillar
  gap without waiting; its time-trial advice is not to wait for footholds. Snow Go's twin log smashers
  leave a pocket, so one dash or two half-dashes both work. The fast line is a skill bypass, not a
  requirement.

### XI.4 Cadence in seconds

Where a guide's on-screen timer allows it, the maps measure the beat:

- **On a vehicle, one decision every ≈ 2–3 s** (Hang Eight: whirlpools 0:23, mine line 0:21, ramp 1 0:18,
  field 0:16).
- **On timed footing, one step every ≈ 1.5–2 s** (Hang Eight's hippos).
- **On rails, obstacle spacing tightens from ≈ 9.5 s to ≈ 2.5 s**, and rail switches come about once a
  second (A Real Grind); an oncoming cart is visible ≈ 1.5 s ahead.
- **Hazard cycles of ≈ 2–3 s can be watched once from a safe ledge**, so climbs run on wait-and-go
  (Draggin' On). Crash Compactor's fire cycles *lengthen* from ≈ 2–3 s to ≈ 4–4.5 s as more threats stack
  up: the window grows with the number of simultaneous problems.

Part XV.12 converts these beats into metres for this hero.

### XI.5 Where the hardest run goes

The hardest run in a section is placed where a retry is cheap: right after a checkpoint in Crash 4
(Draggin' On, Off-Balance; unstompable enemies first appear on narrow lanes right after a checkpoint in
Crash Compactor) and closing the section into the next checkpoint in Crash 2 (accelerating runs end
sections; checkpoints follow the hardest chains in Diggin' It and Bear Down). Timing gets more
forgiving before the last checkpoint of a level (Piston It Away). Finales recombine every earlier
answer: Bear Down's last strip asks for four different answers in a row.

### XI.6 Light jumps and late skills

- **A short or light jump is an advanced move.** Bear Down tests short jumps deliberately; The Eel Deal's
  low ceiling makes the strongest jump the wrong one.
- **Held jumps and air steering arrive late.** Bear It's orca hole 4 is a held jump from an ice edge with
  air steering, after three plain holes; its pond with totems on the landing asks for a move left in
  the air.
- **Crash 4's double jump is assumed, so its height gates stay modest** (Snow Way Out); its mask moves
  are taught alone first (Off-Balance: wall-run with a prompt over water, then the hover, then the phase,
  each recombined in later sections).
- **Forced rides put optional crate hops on a fixed beat** (Rude Awakening's vine, Bears Repeating's bear):
  the jump is a choice on the beat, not a survival test.

### XI.7 Rhythm and difficulty

Developers name monotonic escalation as a mistake: Crash 1's designer said every jump was slightly
harder than the one before, and Stormy Ascent was cut and Future Tense toned down for the same reason
([DEVELOPER_EVIDENCE.md](crate-bible/DEVELOPER_EVIDENCE.md), principle 3). The maps show the
alternative: a run, a rest, a harder run, a breather room (Stowing Away's shifting-wall room has no
hazard and no crate), then a test. Toys for Bob describes the target as a stream "almost rhythmic in
nature" that becomes flow once mastered (principle 6).

**In this game:** keep runs at 3–5 jumps with a rest one beat long; space beats by speed (XV.12: 13.5–18 m
on foot, 24–36 m at board cruise); make no-stop runs out of `crumble`, `phasepad`, sinking `mover`s or a
`boulderChase`, never by widening gaps; give every timed run a fast line (a double-jump skip, XIX RG4).

---

## Part XII — Obstacles and hazards

An obstacle is anything that threatens the player without being an enemy: crushers, fire, electricity,
falling and rolling objects, blades, spikes, mines, explosive crates used as geometry, collapsing
scenery, slippery or hot surfaces, closing doors and pursuers. The maps record each with its placement,
timing and telegraph, counter, what it is combined with and its role.

### XII.1 The hazard palette

Explosive crates used as geometry (≈ 23 % of obstacle records) and static blockers (walls, fences,
totems, trees; ≈ 21 %) are the most common, followed by crushers and pistons (≈ 11 %), fire (≈ 11 %),
mines, falling objects and electricity or lasers (≈ 7 % each), and water hazards, rolling objects,
spikes and slippery surfaces (≈ 5–6 % each), with floor holes, collapsing scenery, blades, turrets,
closing doors, sweeping fliers, pendulums, conveyors and wind making up the tail. About four in five are
lethal on contact.

Placement is mostly **across the path** (over half), then **on the flank** and **on a platform** (about a
fifth each) and **overhead** (about an eighth); pursuers are rare and concentrated in chase levels.
Counters split into **wait-and-go** (over a third), **jump over** (≈ 30 %) and **go around / steer**
(about a quarter), with destroy, outrun and slide under making up the rest. Roles: `TEST` and
`TIMING-GATE` (about a third each), then `AREA-DENIAL`, `TEACH`, `LANE-BLOCK` and `RHYTHM`.

### XII.2 Debut, repeat, invert, combine

Every level introduces its hazards the same way, and the order is the most consistent finding of the
geometry pass:

1. **Debut alone with a place to stand and watch.** Snow Biz's wooden pillar has a waiting bank, its first
   icicles a flat floor where the guide says "stop and wait", its first disc a waiting spot in front.
   Cold Hard Crash's disc channels have a 1 u curb to wait on; Piston It Away offers a raised piston.
   Crash 4 does the same: every hazard in Draggin' On and Off-Balance appears alone on safe ground before
   it is paired.
2. **Repeat without the pause.** Snow Biz's reprises remove the waiting spot: icicles → pit → smasher,
   smasher with icicles right behind, twin discs, faster smashers on the gem course.
3. **Invert the counter on a later instance.** Snow Biz's first icicles say stop and let them fall; the
   second set must be slid through immediately. Cold Hard Crash's smashers go from "wait" (a pair, a pair,
   three on ice) to a five-smasher colonnade where stopping kills.
4. **Combine one complication at a time.** Crash Compactor's fire goes from one sweeping jet with a crate
   on its table, to two alternating turrets, to two alternating hatches with a 4.5 s period and 2 s
   offset, to canisters at both ends of a bridge with a mutant on it, to a flamethrower on the climb.
   Diggin' It's electric fences add one complication per instance and end in a pit hidden behind the
   current that needs a slide-jump. Piston It Away's ≈ 20 pistons go single → a wave of four → a slow
   pair to shelter under → an in-phase pair → synced with an enemy's arms → behind a shield → sequenced
   on the death route.

**Signature hazards can debut as harmless scenery.** Draggin' On flies a spectral dragon over the opening
about a minute and a half before dragons sweep the first wall the player must climb.

### XII.3 Telegraphs are part of the geometry

Every lethal timing hazard in the maps announces its next window, and most announcements are physical:

| Telegraph | Examples |
|---|---|
| The hazard's own motion | a crusher's slow rise; a disc's position in its trough; pistons at full extension; barrels high on a pipe wall (The Eel Deal, Hangin' Out) |
| Colour and light | flashing water when the eel is live (The Eel Deal); red-hot undersides on presses (Stowing Away); strobing phase objects |
| Marks on the floor | green puddles where spiders drop (Rude Awakening); red target rings under a bomber's strikes (A Real Grind); the boss's ≈ 2 s strips before a slam (Jetboard Jetty); shadows |
| Visible approach | rolling wheels seen on a curved causeway (Rude Awakening); a cart visible ≈ 1.5 s ahead on a rail (A Real Grind) |
| Wind-up | a drawn crossbow, harpoons already stuck in the boards (Snow Way Out); a TNT counting |
| Prompts and signs | HANG, SWITCH and SWING prompts ≈ 2–3 s ahead (A Real Grind); neon signs where the camera cannot help (Crash Compactor) |

Developers say the same: Vicarious Visions added tells to spikes that fired without warning when testers
stalled; Toys for Bob's rule was difficulty "fair and not cheap", with precision in how things are
telegraphed; Naughty Dog dropped a lava level because orange Crash would not read against it
([DEVELOPER_EVIDENCE.md](crate-bible/DEVELOPER_EVIDENCE.md), principle 5). **A telegraph needs contrast as
well as timing.**

### XII.4 Placement patterns

- **A hazard on the landing chooses the landing side** (Crash Dash: two quick pits then a fence, so land
  left; a pit with a fence on the landing's left, so jump on the right).
- **Gates accept two strategies** (Snow Go's twin smashers leave a pocket: one dash or two half-dashes).
- **The same object can make opposite demands** (Hang Eight: ramp 1 rewards maximum boost, ramp 2 punishes
  it, 2–3 s apart; Diggin' It's speed pads point straight at the next hazard).
- **Proximity and pressure triggers make stopping the danger** (Cold Hard Crash's icicles fall when you
  approach; Piston It Away's floor plates fire a beam from behind, and a `?` on a pedestal beside one
  tempts the stop).
- **Machine and enemy can share one cycle**, so one input clears both (Piston It Away).
- **Non-lethal hazards cost distance or time** where a pursuer makes time the currency (Crash Dash's mines
  launch and slow rather than kill).
- **Knockback first comes where a wall catches you, later over voids** (Off-Balance, Draggin' On).
- **Hazards recur across modes**: on foot, on the raft and on the vehicle (Jetboard Jetty).

### XII.5 Explosives as architecture

Explosive crates are the most common obstacle in the maps, and their job is geometry:

- **Nitro builds lanes, hurdles and edge walls**, never on the required line: The Eel Deal's Nitro room
  builds a 1 u lane (a `?` between two Nitro), a 2-high hurdle and the cover for a secret door; Bear It's
  Nitro pairs fix a ≈ 2.5–3 u centre lane; floating Nitro replace stepping stones in an eel pool.
- **TNT is terrain**: a step, a bridge, a springboard, an ambush (Off-Balance: a strong crate on a TNT is a
  +3 u wall step; Ruination's TNT stacks fill a ledge so they must be landed on as timed steps).
- **Explosions are moving hazards beside the route** (Bears Repeating's giant Nitro block sits beside a row
  of 2–3 u steel blocks: trigger it, then outrun it).
- **In early stages, explosive floors and rows appear only on optional routes** (Turtle Woods, Snow Go,
  Hang Eight).
- **A timed hazard never shares space with a new explosive lesson** (Rude Awakening places its only timed
  hazard between its two TNT lessons).

### XII.6 Hazard stretches, rewards and timers

- **Hazard-only stretches have no enemies** (Stowing Away's engine room is a gallery of timing gates with
  no enemy; Snow Way Out; Crash Compactor's crate-free junk arena tests timing before the bonus).
- **Two clocks on one footing appear only in finales** (Snow Way Out's rope swings each carry a lit TNT).
- **Hazards double as rewards** (inferno crates, Nitro lids, a 36-crate Nitro block).
- **Closing geometry is a timer** (Bears Repeating's crate slot under a lid that turns to iron; Stowing
  Away's invisible frames that turn to iron).
- **Optional routes remix the hazards on worse footing** (Piston It Away's death route; Snow Biz's gem
  course; Road to Ruin's death route swaps static timing for moving platforms and rolling logs).
- **An enemy can weaken a hazard** (The Eel Deal: knocking a scrubber into a fan breaks a blade).

### XII.7 Pursuers

Chases are a separate grammar (VIII.2 for crates):

- **The pursuer nearly fills the lane** (Crash Dash: a ≈ 4 u boulder on a ≈ 5 u lane), so the only exit is
  forward.
- **Chase hazards ask for a lateral move or a jump, never a stop**: partial holes, full-width pits,
  half-width fences, mines that cost distance.
- **Shelters split the run into short chases**, each holding a checkpoint and releasing a fresh pursuer.
- **Chase endings are geometric**: a bridge destroyed behind the player, a bridge that drops the boulder.
- **Bees and chasing enemies punish stopping beside crates** (Diggin' It).

**In this game:** XV.11 lists the engine's hazard primitives with their default cycles, and XVII.3 shows
how to phase a row of them for the approach speed. Every lethal primitive here already telegraphs (the
crusher's slow rise and hanging shadow, the fire tiki's 1.25 s still warning, the phase pad's 0.9 s
strobe); keep the telegraph in view from the waiting spot, and keep hazards out of the first beat after
a new enemy or explosive lesson.

---

## Part XIII — Enemies

The maps record each enemy (or enemy group) with its archetype, behaviour, counter and what fails,
placement, role and whether it first appears alone on safe ground.

### XIII.1 The roster is simple; placement does the work

Archetypes split roughly into fifths: static or rooted enemies, 1-D patrollers, shielded or armoured
enemies that need a specific counter, and fliers plus projectile throwers, with burrowers and
ambushers, chasers, hoppers, loop patrollers, swimmers and a few chargers and mini-bosses making up the
rest. **Spin** defeats three enemies in five; **avoid** is the answer for a third (vehicles,
indestructible mines, pursuers); **stomp** works on a quarter and **slide** on a fifth; body slam,
shooting (Crash 3's bazooka), explosives and flinging cover the rest. What fails is most often **the
wrong phase** (attacking while blades are out, during a dash or a discharge), then **contact from the
front** (shields) and **spinning** an enemy that punishes spins (spiked rats, flame helmets).

The geometry pass says the same thing in every game: **an enemy's placement matters more than its
behaviour.** Snow Biz makes its hedgehog harder four times without changing it: first on a long flat
after C1 with an Aku Aku crate between it and the next one, then on a take-off edge, then on a landing
pillar, then just beyond a sprint where you must stop. Snow Way Out's crossbow snipers matter because
they sit above posts 1–1.5 u wide. Ruination narrows the lane to one tile wherever an enemy patrols.

| Placement | Share of records | What it asks |
|---|---|---|
| On the line | ≈ 30 % | engage or pass; the default and the teaching position |
| On the landing | ≈ 15 % | attack while landing (spin in the air), the side-scroll signature |
| Between hazards | ≈ 9 % | one input must clear both, or the waiting spot is taken |
| Flank | ≈ 9 % | lateral pressure on a narrow line |
| In the pit or water | ≈ 6 % | a timed gap (piranhas, eels, sharks, orcas) |
| Above | ≈ 6 % | a sniper, a dropper or a hovering drone |
| Guarding a crate | ≈ 5 % | the deck guard occupies the only standing space beside the crate |
| Take-off edge | ≈ 4 % | the run-up must be cleared first |

Roles are spread evenly: `HURDLE`, `TEST`, `TIMING-GATE` and `GUARD` each cover about a fifth of enemies,
`GATEKEEPER` and `TEACH` an eighth each, and `TOOL/STEP`, `PROJECTILE` and `AMBUSH` the rest.

### XIII.2 Debuts are forgiving, but rarely alone

Most level files describe a new enemy kind's first appearance as forgiving. The strict test, alone on
safe ground, holds for about a third of recorded debuts overall: a fifth in Crash 2, a third in Crash 4
and half in Crash 3. The usual forms are:

- **alone on a wide floor**: Turtle Woods' turtle after C1; Draggin' On's first gong monk with a wall
  behind it; Jetboard Jetty's lone pirate on a wide dock; Rude Awakening's hub crab;
- **with an opt-out**: Turtle Woods' ≈ 5–8 u lane lets the player steer around its early enemies, which its
  guide says need not be killed; Diggin' It introduces its plant alone and its guide says it can simply be
  ignored;
- **with a mask at hand**: Snow Biz puts an Aku Aku crate between its first hedgehog and the next; Diggin'
  It's first mines come right after a mask crate, so the first mistake is forgiven;
- **right after the counter is given**: Crash 4 introduces mask-gated enemies immediately after their mask
  (Stowing Away's shielded lab assistants follow the whirlwind pickup; Off-Balance's mask enemies follow
  each mask), so the enemy and its answer are taught together;
- **in a harmless form first**: spider puddles before the spider and an out-of-reach thrower before the
  village throwers (Rude Awakening); a sniper first shown from a safe pad below it (Snow Way Out);
- **on a checkpoint pad**: Snow Way Out's helmeted stomp-only blocker first appears on the C4 pad itself,
  and Crash Compactor's unstompable enemies appear alone on narrow lanes right after a checkpoint, so a
  mistake costs nothing.

Exceptions are deliberate. Ambushers sit on landings from the start (Snow Biz, Crash Compactor), the
secret course breaks the rule (Turtle Woods), and Crash 2 often debuts an enemy on roomy ground next to
a crate rather than alone (Cold Hard Crash, Ruination, Piston It Away).

### XIII.3 Escalation ladders

Each enemy kind climbs a ladder of placements, usually one rung per appearance:

- **Patrol axis**: across the path, so it can be timed past → along the path, so it must be engaged → waiting
  on a landing (Turtle Woods).
- **Context**: alone with a wall behind it → over a 1-deep walkway → a gallery of 3–4 → paired bells where
  you wait for both strikes (Draggin' On's gong monks).
- **Geometry around one counter**: open floor → across a raft gap → drones hovering inside the gaps between
  pads → hurdles on a narrow toward-camera bridge; the counter (hit the owner) never changes (Bears
  Repeating's drone owner).
- **Footing**: from solid tiles to crumbling ones (Road to Ruin).
- **Numbers**: Penky groups of 4 → 4 → about 8, ending in an arena at the gate (Sphynxinator); mole pits
  2 → 4 → 4 (Turtle Woods).
- **Hazard pairing**: a shield researcher alone → beyond a hole → beside Nitro (Tomb Wader); knock-back
  enemies are paired with holes or Nitro once known (Future Frenzy, Gone Tomorrow).
- **Two-state gates**: Bear Down's worker slab (lowered: jump; raised: ride under) appears seven times,
  each adding one complication, ending in a double gate with a fake-out hold.

### XIII.4 Groups and mixed counters

- **One move can solve a group**: sliding penguins come down lanes in file, and spinning the leader
  bowls the rest (Snow Biz); seals die together when the first is hit (Snow Go). Groups that unlock or
  die together make one decision out of several enemies.
- **Mixed counters test switching**: The Eel Deal's scrubbers want a spin or slide while its spiky rats
  forbid the spin, and its guide then sends them "one after another". Diggin' It gives each enemy its
  own counter (slide-only lizard, slam-only plant, stomp-only rats).
- **An explosive beside an enemy changes the counter**: stomp instead of spin, so the blast does not
  catch you (Piston It Away); Crash 4 places fodder next to TNT so the blast can take them (Crash
  Compactor).
- **The floor decides the counter**: a belt carrying you away from an MTAT gives time to shoot it, a belt
  carrying you toward it means spin (Gone Tomorrow).

### XIII.5 Enemies as tools, bait and signposts

About one enemy in twelve is recorded as a tool or step, and the level files return to the idea
constantly:

- **Steps and springboards**: Turtle Woods' turtle under a floating box above jump height and the
  ostriches' backs in the secret; Air Crash's hippo; Ruination's rats on a rotating ring as the only way
  up to a floating green `!`; Piston It Away's robot below the turret ledge, which must be left alive as
  the step back on the box-gem return, and its bounce chains on the death route.
- **Projectiles**: The Eel Deal's scrubber knocked into a fan breaks a blade; Crash enemies flung into
  crates and switches.
- **Bait**: Jetboard Jetty's pirates walk into a lit TNT; chasers are lured into mines and under the
  boss's slams.
- **Signposts**: Draggin' On's lion stepping out of an archway marks the secret walkway.
- **Rhythm setters rather than blockers**: throwers, bombers and sand sharks deny areas and set the beat
  (A Real Grind, Rude Awakening); Hang Eight's flytraps are planted and its piranhas pulse in gaps.

### XIII.6 Enemies on fast lines, ice and vehicles

- **Enemies attack momentum, not health**, on ice and slopes: Snow Biz's seals on the ice patch matter
  because being turned or stopped loses the run-up for the closing jump.
- **On rides that cannot attack, enemies are hurdles and timing gates**: Bear It has no spin on the bear,
  so seals and orcas are pure avoidance; Bears Repeating's skiers take one lane at a time.
- **Vehicle enemies are moving lane blockers**: one on a wide slope first, then two side by side in a
  tunnel (Bears Repeating).
- **In into-screen downhill stretches enemies arrive as projectiles; in side-scroll strips they guard
  landings** (Cold Hard Crash, Ruination, Piston It Away).
- **Indestructible threats become wait-then-outpace gates** (The Eel Deal's mines under the hanging mesh).

### XIII.7 Density and biome

The median section holds about 2 enemies (Crash 2: 4, Crash 3: 3, Crash 4: 1). Crash 4 runs one enemy
type per biome (Rude Awakening's crabs on the beach, spiders in the temple, throwers in the village,
plants on the wall) and keeps hazard-only stretches free of enemies (XII.6). Naughty Dog's account of
why crates exist is the reverse view of the same budget: with only two or three enemies on screen, the
next challenge had to be a pit or far away, and crates filled the gap
([DEVELOPER_EVIDENCE.md](crate-bible/DEVELOPER_EVIDENCE.md), principle 11).

**Telegraphs** are facing direction and visible cycles: quills, arms, shields, crouches, a planted
wind-up (Piston It Away; Crash 3's enemies all run on cycles, none chases).

**In this game:** XV.10 maps the nine engine enemy kinds onto these archetypes with their timings;
XVII gives the skate-specific placements (the bull alley, the drone over a rail, cover from a sentry,
the shell spring, the pinball line). Contact with a live enemy on the board is a hit, so place enemies
on skate lines as hazards with a readable counter, debut each kind on roomy ground off the fast line,
and climb its placement ladder one rung per appearance.

---

## Part XIV — Section beats, camera and level flow

Each level map lists the ordered beats of every section (gap, enemy, hazard, crates, rest, checkpoint)
with counts. This part reads those sequences as a whole: how dense a section is, how it opens and
closes, how the camera changes the grammar and where the level spends its rests.

### XIV.1 Density per section

| Game | Median gaps per section | Enemies | Hazards | Beats |
|---|---|---|---|---|
| Crash 2 | 3 | 4 | 3 | 10 |
| Crash 3 | 2 | 3 | 2 | 12 |
| Crash 4 | 2 | 1 | 1 | 6 |
| All | 3 | 2 | 2 | 9 |

A Crash section between checkpoints holds about nine beats (six in Crash 4, ten to twelve in Crash 2
and 3), and roughly one new element (VI.2 for crates). Crash 4's sections are shorter and sparser per section but more numerous: its checkpoints
are closer together (Snow Way Out's late checkpoints come close because the falling-ice stretches kill
most).

Three sample sequences show the shape (abridged from the level files):

- **Ruination S2** (Crash 2): pad with a lizard (jump past) → TNT ledge with two lit stacks and a monkey →
  crumbling ledge with two Nitro → arrow pad (a TNT; a loose mask above) → `!` room → one-tile walkway with
  a monkey walking away → C2 and a gem pad. *Three gaps, three enemies, three hazards; the walkway choke
  closes the section.*
- **Tomb Wader S1** (Crash 3): scarab gauge (the water clock) → handle and door → channel 1 with a disc and
  two wet crates → stairs → dry path with crates → spiked mummy, alone → `?` + Nitro → door → channel 2 with
  TNT stepping stones → stairs → shield researcher, alone, dry → C1 at the bonus pad. *Every new enemy
  appears alone on dry ground between two water crossings.*
- **Snow Way Out S5** (Crash 4): side view, the falling-slab gorge in two halves with a pillar rest → a house
  balcony landing with a crate → a dock with a single floe (the surface preview) → an inferno-crate pyramid
  and a tape. *Two gaps, two hazards, no enemy: a hazard section with a built-in preview of the next one.*

### XIV.2 How a section opens and closes

- **Open safe, close hard.** Sections start on a rest floor or checkpoint pad with a teaching beat
  (Rude Awakening brackets every challenge with a rest floor) and end with the hardest run before the
  next checkpoint, or put the hardest run right after a checkpoint so retries are cheap (XI.5).
- **One element per section.** Each section adds one family (a hazard, an enemy, a footing) and recombines
  it with what came before; Rude Awakening never times a hazard and handles a new explosive at once.
- **The previewed element.** A section often ends with a harmless preview of the next section's idea
  (Snow Way Out's single floe before the floe field; Draggin' On's harmless dragon fly-over).
- **Rests are visible.** Walls appear around checkpoints (Ruination); a secure pad is named as a breather
  in the guides (Road to Ruin's gem path); Stowing Away's shifting-wall room has no hazard and no crate.

### XIV.3 Camera modes carry grammars

Sections are into-screen about half the time, side-scroll about a third, and vehicle or
toward-camera chases about a sixth. The level files agree that each camera has its own grammar (IX.6 for
footing):

| Camera | What it is used for | Typical beats |
|---|---|---|
| Into the screen | depth, arenas, lateral choice | wide floors, across-path hazards, holes beside the line, enemies to engage; may have no forced gap (Future Frenzy's into-screen half) |
| Side-scroll | timing and height | separate ledges, ≈ 2 u gaps, crushers on far banks, enemies on landings |
| Side view, vertical | climbs | ≈ 2 u tiers, a stable tier every 2–3, prompts for new verbs |
| Toward the camera | chases and count traps | lateral moves only, alternating hazards; railed sides where depth is read late (Bears Repeating's bridge) |
| Vehicle or ride | slalom and speed | lanes, boost gates, few prompted jumps with a crate on the lip |

**Mode changes happen at one-way transitions, and each carries a checkpoint**: a lift top, a free-fall
shaft, a dock, an automatic rail launch onto a pad (Snow Go, Hang Eight, A Real Grind). The camera
always shows the axis being tested (A Real Grind: rail 1 tests vertical dodges in a side view, rail 2
lateral switches in a chase view). Where the camera cannot help, signs do (Crash Compactor's neon signs
cue rail inputs and hidden ledges). Snow Go even uses the vertical framing limit as a design tool, hiding
a switch above the camera frame.

### XIV.4 When each element first appears

Along the main route (0 = first section, 1 = last), median over the levels that use it:

- **Enemies**: patrollers, throwers and fliers debut in the first section (0); shielded enemies early
  (0.1); static enemies, swimmers and chargers around 0.3; burrowers and ambushers, loop patrollers and
  hoppers mid-level (0.5); chasers 0.6; mini-bosses late (0.8).
- **Obstacles**: pendulums, closing doors, leaping creatures and sweeping fliers are first-section ideas
  when a level is built around them; slippery surfaces 0.2; turrets, fire, crushers, explosive crates,
  spikes, water and static blockers around 0.3; collapsing scenery 0.4; falling objects, mines, low
  barriers and tilting footing mid-level (0.5); blades and wind 0.6; rolling objects, electricity and
  hidden holes late (0.7); sliding walls 0.8.
- **Gaps**: pits, lethal and timed water, lava, mud and lethal floors at once (0); swings, floor holes and
  stepping stones early (0.1–0.2); hurdles and drop-downs 0.3; moving-platform crossings, crumble runs and
  launches 0.4; height gates mid-level (0.5); bounce chasms and timed hazard crossings late (0.7).

The order follows the teaching rule: the plain version of an idea first, the coupled and hidden
versions later. Rolling objects, electricity, hidden holes, chasers and bounce chasms come late because
they combine a clock or a tool with something the player has already learned.

### XIV.5 Route shape and enforcement

- **Channel the route.** Naughty Dog cut its first two Crash 1 levels because open space let Crash walk
  around the enemies, and Toys for Bob returned to "linear hallway" levels
  ([DEVELOPER_EVIDENCE.md](crate-bible/DEVELOPER_EVIDENCE.md), principle 1). Every map shows a single readable
  main line with side content hung off it (Snow Way Out never doubles back; its search content is lateral
  or behind waterfalls next to rests).
- **Enforce order with geometry, not text**: unjumpable gaps, closed courts, one-way drops, a hole in front
  of the last payout (IX.7).
- **Loops and hubs are rare and deliberate** (Gone Tomorrow's hub makes the route a loop; Air Crash's board
  course loops so a missed ramp crate costs a lap, not a life).
- **The skill ceiling sits beside the critical path**: gem routes, death routes, bonus rooms and time-trial
  lines hold the hardest recombinations (VI.4; Future Tense's rework kept the critical path smooth and the
  skill ceiling in the death route and time trials).

**In this game:** a section of about 9 beats (6–12) at one beat per 1.5–3 s is roughly 10–35 s of play:
about 80–320 m on foot and 110–430 m at board cruise (XV.12). For comparison, the median current course's longest
stretch with no beat at all is 130 m (XVIII). Change camera mode only at a one-way transition with a checkpoint (`camnode` and
`zone` components carry the camera); keep each section to one new element.

---

## Part XV — Translating Crash geometry into this game

Crash's grammar survives only if its *distances* are re-measured in this engine. Everything below
was measured in the real Player/Level ([`skate-crate-probe.json`](crate-bible/data/skate-crate-probe.json),
`node tools/probe-crate-skate-rules.mjs`; jump peaks from [JUMP_MOTION_STUDY.md](JUMP_MOTION_STUDY.md));
enemy and hazard timings were read from the code named in each table.

### XV.1 The unit

- **One crate = 1.152 m** (`0.96 × CRATE_SCALE 1.2`, `src/crateDimensions.ts`). Level data still
  places crates on the legacy **0.96 m grid**; at build time each touching formation is enlarged ×1.2
  about its own centre, so crates authored 0.96 apart end up touching at 1.152. **Author in grid
  units**: a row is `x0 + i·0.96`, a stack is `y0 + j·0.96`.
- Stack tops above the floor: 1 → 1.15 m, 2 → 2.30, 3 → 3.46, 4 → 4.61, 5 → 5.76, 6 → 6.91.
- Floating crates stay where authored. A crate whose support is destroyed settles onto whatever is
  under its column; Nitro never falls. **Crate tops are not ledge-grabbable**; only platforms and
  walls are.

### XV.2 Vertical reach (feet apex)

| Launch | Apex above its take-off surface | Highest stack top you can land on from the floor |
|---|---|---|
| Tap jump | 1.1–1.3 m | 1 crate, marginal |
| Full jump | **2.85 m** | **2 crates** (2.30 m) |
| Full jump + double jump at the apex | **4.59 m** | **3 crates**; 4 (4.61 m) is out of reach |
| Stomp a wood crate (Jump held or not) | 2.87 m above its lid | from a 1-high crate: 4.0 m → 3 crates |
| Crate stomp + double jump | **4.61 m** above its lid | from a 1-high crate: 5.8 m → **5 crates** |
| Wooden or steel arrow | 3.77 m above its lid | floor arrow: 4.9 m → **4 crates** |
| Arrow + double jump | **5.51 m** above its lid | floor arrow: 6.7 m → **5 crates** |
| Arrow with Jump held at contact | 5.92 m above its lid | floor arrow: 7.1 m → **6 crates** |
| Held arrow + double jump | **7.65 m** above its lid | floor arrow: 8.8 m → **7 crates** |
| Board ollie, full charge | ≈ 1.7 m | 1 crate — the board cannot ollie onto a 2-stack |
| Board ollie, tap | ≈ 0.56 m | cannot clear a crate |
| Grind jump (pop 12.5 m/s) | ≈ 2.4 m above the rail | a row one crate higher |
| Ledge grab (lip ≤ 2.4 m above the feet) | platform lips to ≈ 5.2 m (full jump) / ≈ 7.0 m (double) | never crate tops |

The double jump fires after *any* launch (floor, crate bounce, arrow) and adds ≈ 1.74 m; all values
in the table were measured with real inputs (`reach` rows in the probe output).

**Head reach (breaking a floating crate from below)** is the feet apex + ≈ 0.92 m (the player box is
0.92 m tall, `CONST.playerHalf.y = 0.46`). Above the floor: full jump ≈ 3.8 m; double jump ≈ 5.5 m;
floor-crate stomp + double ≈ 6.7 m; arrow ≈ 5.8 m; arrow + double ≈ 7.6 m; held arrow ≈ 8.0 m; held
arrow + double ≈ 9.7 m. The engine's default "arrow + floating fruit crate" partner (bottom 3.2 m above
the arrow's lid, ≈ 4.35 m above the floor) is therefore a reward pairing, not a gate.

**Enemy bounces** (measured, `enemy-bounce` rows). Stomping a crab (`grunt`) bounces 2.67 m above its
back, 3.77 m above the floor. Stomping a live turtle, or landing on the shell it leaves (belly 1.40 m),
bounces 5.17 m above the floor; with Jump held 7.32 m; with a double jump 6.91 m, or 9.05 m held. Each
enemy bounce re-arms the double jump, so an enemy is a launcher exactly like a crate (XVII.7).

**Height-gate consequences.**

1. Crash's "out of reach without a tool" (typically 3 crates up) is **inside** double-jump reach
   here. A tool gate needs a landing target above ≈ 4.6 m, or a floating target whose underside is
   above ≈ 5.5 m — and **every crate is a launcher**: a stomp plus double jump head-reaches ≈ 6.7 m,
   so keep plain crates out of stomping range of a gated target.
2. Floating-target windows above the floor: **arrow gate** underside 5.6–7.4 m (arrow + double jump
   reaches, floor double jump does not); **held-arrow gate** 8.1–9.5 m (held bounce + double jump
   only). Landing-target windows: arrow gate 4.7–6.6 m; held-arrow gate 6.8–8.7 m.
3. "Harvest before dismantling" (A1) needs the overhead target beyond double-jump reach from the
   floor *and* within reach from the support's lid or bounce.
4. Cap double jumps with ceilings or overhangs, honestly visible; never rely on players not
   knowing the double jump exists.

### XV.3 Horizontal reach (measured)

Flat ground, take-off to touchdown, real inputs (`range` rows of the probe output). Jump is
release-to-jump: a *tap* is the shortest press, a *full* jump holds ≈ 0.4 s.

| Move | Distance | In crates | Apex | Notes |
|---|---|---|---|---|
| Running tap jump (9 m/s) | **4.95 m** | 4.3 | 2.11 m | the shortest real press while running; the standing tap peaks lower (1.1–1.3 m, XV.2) |
| Running full jump | **5.85 m** | 5.1 | 2.85 m | |
| Running full jump + double jump at the apex | **9.15 m** | 7.9 | 4.59 m | the double jump keeps the horizontal speed |
| Board tap ollie at cruise (12 m/s) | 4.66 m | 4.0 | 0.66 m | cannot clear a crate |
| Board full ollie from cruise | **9.36 m** | 8.1 | 1.78 m | holding Jump to charge also accelerates: 12 → 15.6 m/s at take-off |
| Board full ollie from 18 m/s | 12.55 m | 10.9 | 1.78 m | take-off 20.9 m/s |
| Board full ollie at charge maximum (23 m/s) | **13.83 m** | 12.0 | 1.78 m | |

The earlier computed estimate for a full ollie at cruise (≈ 6.6 m) was wrong by almost 3 m because
it ignored the charge acceleration. **Measure the move a gap depends on; do not compute it.**
Transfer notes in the level files written before this measurement quote ≈ 5.6 m for the running jump;
the values in this table supersede them.

**Run-up.** On foot the run builds from rest to 9 m/s in 0.75 s (`walkRampTime`), about 3.4 m of
floor. A gap that needs the full running distance needs that much flat run-up in front of it;
standing jumps were not measured and travel less.

**Forgiveness the level can count on** (all from `src/tuning.ts`; do not retune them for a level):

| Rule | Value | What it means for layout |
|---|---|---|
| Coyote time | 0.28 s after leaving an edge (`coyoteTime`) | ≈ 2.5 m of travel at run speed, ≈ 3.4 m at cruise: a late press still jumps, so a take-off edge is not a precision test |
| Edge catch | rolling or skating off a lethal edge slower than 6 m/s teeters at the brink (`teeterCatchSpeed`) | slow players are protected at every lethal edge; fast ones are not |
| Ledge grab | lips up to 2.4 m above the feet, held up to 6 s (`ledgeReach`, `ledgeGrabTime`) | a jump that falls short of a platform *top* still catches its lip; platforms and walls only, never crate tops |
| Edge grinding | platform and road edges grind by default; rail snap radius 2.1 m (`railSnapDistance`) | a skater who comes up short can save the jump on the far edge's lip, and an edge on the line is always a grind option |

### XV.4 The board against single crates (measured)

| Crate | ≤ 6 m/s | 8–12.5 m/s at contact | ≥ 13 m/s run-up (≥ 12.5 at contact) |
|---|---|---|---|
| Wood, `?`, life, mask, multi-hit, wooden arrow | bumps and stops | rider **trips** (bail); crate survives | crate **smashes**; ≈ 19 % of speed lost per contact |
| 2- or 3-high wood stack | — | trips | **whole stack clears** for one contact's speed cost (the upper boxes fall and break on the rider) |
| TNT | wall at ≈ 1 m/s; fuse lit from ≈ 3 m/s, rider survives | **fuse lit**; rider bounces off, survives | **detonates on contact — rider dies** |
| Nitro | **death** | **death** | **death** |
| Steel | wall | wall | wall **crash** (bail) |
| `!` / green `!` | triggered by any hit | triggered | triggered |

- Smash speed (12.5 m/s) sits just above cruise (12 m/s): smashing is a **choice** made by charging
  or descending. A 12.5 m/s start decays below the threshold over a short run-up and trips.
- Each smash multiplies speed by ≈ 0.81 (13 → 10.4, 18 → 14.6, 23 → 18.6). On flat ground a rider at
  charge maximum smashes about three crates in a row before dropping under the threshold; holding
  charge (≈ 9 m/s²) recovers a smash in ≈ 0.3 s, so a sustained smash line needs crates ≥ 5 m apart
  *and* the player holding charge, or a descent.
- Landing on a crate from a board air is a true **stomp**: the crate breaks and the rider bounces
  2.87 m keeping forward speed. Landing on an arrow launches 3.77 m (5.92 m held) and rolls on.

### XV.5 Crate rows are rails (measured)

Any run of ≥ 2 crates touching side by side, with equal top heights and nothing stacked on them,
grows a grind line along each exposed long edge (explosives, steel and `!` count as part of the
ledge; see "CRATE RUNS ARE RAILS" in `src/level.ts`).

| Situation | Result |
|---|---|
| Plain crates in the row | every crate ridden over breaks and pays out, the last at the dismount; crates behind the catch point survive |
| Row floating over a pit | a **one-way bridge**, consumed behind the rider |
| `!` in the row | flipped by the grind-through; the switch stays |
| Steel in the row | ridden over intact, no bail; survives as a permanent piece |
| TNT or Nitro in the row | detonates the instant the rider reaches it: **≤ 5.5 m/s grind speed kills, 6 m/s bails, ≥ 6.5–7 m/s outruns the blast**, which then clears the rest of the row |

Grind speed is the entry speed, so a cruising entry clears an explosive row easily; only slow,
deliberate catches die. **An explosive in a row is a minimum-speed check, not a wall.** A gap in
the row (or a crate stacked on it) ends the rail.

### XV.6 Crates on an authored rail line (measured)

| Crate on the line | < 12.5 m/s | ≥ 12.5 m/s |
|---|---|---|
| Plain crate | knocked off the rail (a mask absorbs it); crate survives | smashed; the grind continues |
| Mask crate | always pops | pops |
| TNT | knocked off, **not** lit | detonates — rider dies |
| Steel | knocked off unless masked | knocked off unless masked |
| `!` | triggered, no bail | triggered |

### XV.7 Explosions

TNT and Nitro share radius **2.75 m**, growing over 0.35 s (front ≈ 7.9 m/s). The rider dies within
radius + 0.5 m while it grows; crates within ≈ 3.35 m of the centre break (arrow crates are immune,
steel survives, switches flip, other explosives chain). TNT fuse 3 s. Because the front is slower
than cruise, **anything the rider lights while rolling away at ≥ 8 m/s is safe; anything they ride
through is not.** A blast covers about two crates on each side of the explosive.

### XV.8 Crash rules, re-dimensioned

| Crash relationship | In this engine |
|---|---|
| A 3-high stack needs a tool | needs ≥ 5 crates (or a ceiling) to defeat the double jump |
| Bounce chain lid to lid | single crates ≈ 5 crates apart on foot, ≈ 6 on the board at cruise |
| Ride crates break on contact | board crates break only ≥ 12.5 m/s; below that they trip the rider — decide which you want |
| TNT stomp = 3-count, spin = instant | same on foot; on the board a slow bump lights it, a fast hit kills |
| Crates as stepping stones that break as used | crate rows as grind bridges that break as ridden (one-way) |
| Ride stack only breaks low tier if you dip | a fast board clears whole 2–3 stacks: stacks are *not* a height check on the board; use floating crates above the line instead (ollie apex 1.7 m, grind-jump 2.4 m) |
| No explosive on the forced line | keep TNT/Nitro off authored rails and fast lanes; in crate rows they only kill slow grinds |
| Checkpoint every 10–12 main crates | ditto — and at every mode change (boarding, rails, rides, side-scroll) |

### XV.9 Gap-width bands for this game

Crash's gaps are measured in crates in the level maps. Translate the *relationship* (step, plain,
committed, double, tool) rather than the crate count: this hero jumps 5.1 crates flat on foot and
7.9 with the double jump, while the Crash 2 median plain gap is 2 crates (X.2). Widths are edge to
edge along travel, with ≈ 1 m of margin left inside each measured range.

| Band | On foot | On the board | Crash relationship it replaces | Use |
|---|---|---|---|---|
| Step gap | ≤ 2.5 m (≤ 2 u) | ≤ 3.5 m | puddles, mud, cracks, hurdles | rhythm and teaching; no real risk |
| Plain jump | 2.5–4 m (2–3.5 u) | 3.5–8 m (full ollie at cruise) | the plain 1.5–3 u pit (two in five Crash gaps) | the default lethal gap |
| Committed jump | 4–4.8 m (3.5–4 u) | 8–12 m (needs charge or a run-in) | Crash's running or held jump | a test; needs ≥ 3.5 m of flat run-up on foot |
| Double-jump or full-charge gap | 5–8 m with the double jump (4.5–7 u) | 12–13 m at charge maximum | Crash 4's double jump; Crash's longest held jumps | late, after the double jump (or the charge) has been taught alone |
| Tool gap | > 8 m on foot | > 13 m | crate bounce, arrow, enemy bounce, ride, swing, vine | bounce (crate, arrow, `trampoline`, turtle shell), `ropeswing`, `mover`, grind line |

Two consequences follow from the measured forgiveness:

1. **Width alone barely tests this hero.** With 4.95 m from the shortest running press, 0.28 s of coyote
   time and a ledge grab, a plain gap is lethal only for a player who stops at the edge. Crash's
   designers reached the same place with a much shorter jump: most of their gaps are short and the
   difficulty sits in what is coupled to them (X.3). Do the same here: couple a gap to a cycle, a
   landing threat, a small landing or a speed demand rather than widening it.
2. **On the board, width is a speed check.** A full ollie covers 9.4 m from cruise and 13.8 m at the
   charge maximum, so a board gap between 9.5 and 13 m asks "did you charge?" exactly as the smash
   threshold does for crates (XV.4). Put the charge run-up in view before the gap.

### XV.10 Enemy vocabulary (from `src/level.ts` and `src/enemies/`)

Enemies are `{t:'enemy', foe, p, range, speed}` and patrol back and forth along one axis around `p`
(X in a corridor, Z in a side-scroll) over `range` each way (default 5 m) at `speed` (default 3 m/s).
Enemies on terrain turn back at an unsupported patrol end instead of walking off it. Timings below
are the defaults in the code; sizes are the hit box (width × height).

| Engine kind (skin) | Behaviour and timing | Defeated by | What fails | Leaves | Box | Crash archetypes it can stand in for |
|---|---|---|---|---|---|---|
| `grunt` (Coral Crab) | 1-D patrol at `speed` | spin, stomp, slide or slam | — | a stomped carcass you can spin into crates as a projectile; the stomp bounces 2.7 m above its back (3.8 m above the floor) | 1.3 × 1.1 m | rats, armadillos, seals, penguins, lab workers, hedgehogs (rolled-up phase excepted) |
| `spiker` (Bristleback) | 1-D patrol | spin, slide or slam | **stomp** (the spikes hurt) | — | 1.3 × 1.1 m | porcupines (spiked phase), spiked shells, anything Crash teaches "don't jump on" |
| `turtle` (Mossback) | patrol at 0.7 × `speed` | stomp, spin (ghost skins recoil spins) | spinning a ghost skin | a **shell trampoline** with a 1.40 m belly: stomping the live turtle or landing on the shell bounces to 5.2 m above the floor (7.3 m with Jump held; 6.9 / 9.1 m with a double jump); a spin flings it | 1.3 × 0.9 m | Turtle Woods' flip-and-step turtles; enemy-bounce steps |
| `charger` (Russet Bull) | patrols at 0.25 × `speed`; when you are within 3.6 m of its lane and 2.5–26 m along it, it plants for a **0.70 s windup** (0.55 s for ghost skins), dashes at 3.4 × `speed` for up to 1.3 s or to its patrol end, then is **dizzy for 1.1 s** | anything during the windup, patrol or dizzy spell | anything during the dash (untouchable, lethal) | — | 2.6 × 2.0 m (bull ×1.8) | rhinos, bulls, ramming lab robots, any telegraphed charge |
| `hopper` (Spring Frog) | crouches 0.45 s, then leaps (8.6 m/s up: ≈ 1.5 m high, ≈ 0.7 s in the air) moving forward at `speed` | stomp **only while grounded**, spin | stomp in the air (your feet pass under it) | — | 1.3 × 1.1 m | Toad Village frogs, leaping fish, bouncing enemies |
| `floater` (Violet Watcher) | hovers 1.65 m up; if you are within 12 m along and 6 m across, swoops every 2.6 s, dipping to 0.35 m over 0.8 s | spin (a jump-spin while it hovers, or any spin during the swoop) | **stomp** | — | 1.3 × 1.1 m | bees, bats, vultures, pterodactyls, drones |
| `sentry` (Ember Sentry) | rooted; tracks ≥ 1.3 s, charges 0.55 s, fires a 10.5 m/s orb (range 32 m, life 3.4 s), cools 0.85 s: one shot per ≈ 2.7 s. **Fires only with a clear line**: walls, live crates and ground block it | any hit to the body | standing in the shot line | — | 1.05 × 1.15 m | turrets, lab gunners, throwing enemies, fire-breathing statues that aim |
| `spinner` (Brass Whirler) | blades **out 2.2 s** (lethal, untouchable, 2.1 m wide), **in 1.35 s** (harmless, open, 0.8 m wide) | any hit while retracted | any contact while extended | — | 2.1 or 0.8 × 1.1 m | spinning blade robots, flame-holding guards, any timed-threat enemy |
| `moa` | patrols and idles; within 3.8 m (and 1.8 m of its height) for ≥ 0.8 s it winds up 0.62 s (aim locks after 0.32 s), pecks 0.36 s (beak live 0.08–0.25 s), then **recovers 0.9 s** with a harmless body | spin, stomp or any ordinary attack | the peck | a harmless roast | 1.65 × 2.95 m | ostriches, big birds, tall telegraphing melee enemies |

Missing archetypes compared with Crash: burrowers that pop out of holes, swimmers (eels, orcas,
piranhas), shielded fronts that must be attacked from behind, free pursuers and mini-bosses.
Approximate them with the vocabulary above and the hazards in XV.11 (a `spinner` on a short range for
a flame guard, a `hopper` on a zero-length patrol beside a pit for a leaping piranha, a `stone` or the
level's `boulderChase` for a pursuer) rather than inventing behaviour in level data.

### XV.11 Hazard vocabulary and timing (component contract in `src/level.ts`)

| Component | Behaviour and authored fields (defaults) | Timing inside one cycle | Crash analogues |
|---|---|---|---|
| `crumble` | breakaway pad; `shake` warning (0.85 s), `speed` fall acceleration (30 m/s²); returns 10 s after dropping | shakes on contact, then falls | crumbling ruin tiles, collapsing bridges, sinking logs (one-shot) |
| `phasepad` | flips between solid + burning and ghost + dark; `cycle` (4 s), `amp` on-share (0.5, range 0.1–0.9), `phase` **as a fraction of the cycle** | solid for `amp × cycle`, strobing for the last 0.9 s; while dark it is not ground | timed platforms, Crash 4 phase objects |
| `mover` | platform on an axis: `amp` travel each way (4 m), `speed` in **radians per second** (0.6), `phase` in radians; optional `orbit`, `spin` (degrees per second), `bounce` | sinusoidal: period = 2π / `speed` (10.5 s at the default), peak deck speed = `amp × speed` (2.4 m/s) | moving platforms, rafts, lifts, floating logs |
| `crusher` | stomping block over a deck: `cycle` (3.2 s), `phase` in seconds | hangs 38 % (1.2 s) → **slams 8 %** (0.26 s, lethal) → rests 24 % (0.77 s, a solid block) → rises 30 % (0.96 s) | pistons, smashers, drop pillars, falling slabs |
| `pendulum` | swinging bob: `len` (5 m), `amp` radians (1), `speed` radians per second (1.6), `phase` | period 2π / `speed` (3.9 s); the bob crosses the centre line every half period (2.0 s) | swinging logs, axes and blades |
| `stone` | rolling boulder patrolling along Z: `range` half-travel (20 m), `speed` (6 m/s), `radius` (0.9 m) | constant speed, turns at each end | rolling logs, barrels, patrolling boulders |
| `firetiki` | turning carved head sweeping fire: `amp` sweep (28°, ≤ 60), `range` reach (7.1 m, 1–16), `cycle` (7.8 s, 4–30), `phase` in seconds | turns while cool 54 % (4.2 s) → **warning 16 %** (1.25 s, still) → **fires 23 %** (1.8 s, sweeping ±65 % of `amp`) → cool 7 % | fire statues, flamethrowers, steam vents |
| `ropeswing` | grab rope swinging in a plane: `len` (6 m), `amp` radians (0.85), `speed` (0 = natural pendulum), `phase`; `range` + `cycle` make the anchor travel | — | vines, swing ropes, hanging hooks |
| `spinbridge` | timber the player spins open: `cycle` opening seconds; `hold` folds it after that long, otherwise it latches | — | Great Gate plank, drawbridges |
| `trampoline` | broad bounce deck: `speed` launch velocity (16), `amp` held-Jump multiplier (1.25) | — | bounce pads, mushrooms, springs |
| `speedpad` | board boost deck: `speed` target speed, `cycle` hold seconds | — | speed pads (Diggin' It, Crash Dash) |
| travelling `rail` | `amp`/`speed`/`axis` move the whole line on a cycle | sinusoidal like a mover | Crash 4 moving rails |
| `rope` | sagging grindable rope: `amp` sag (1.2 m); **snaps** after `shake` seconds of grinding (3 s) | — | breaking ropes and vines |
| `pit` (+ `thorn` visual) | death volume; pair a `thorn` cluster with a slightly smaller pit for a readable spike pit | — | bottomless pits, spike pits, lethal water |
| `grindosaurus` | patrolling lethal body with a moving grindable spine: `range` (4), `speed` (1.5), `coverage` = fraction you must ride | — | a ridable creature or moving rail with a lethal body |
| `angryball` | proximity-activated ball that chases across its own halfpipe profile: `range` (12), `speed` (7), `radius` (0.8) | — | rolling pursuers in a trough |
| `trickgate` / `trickrail` | circular lock or rail that opens only for its required deck trick | — | Crash 4 mask-gated paths (skill locks) |

**Level-data systems** (keys on the level object, not components):

- `boulderChase` — a pursuit boulder on one camera/floor `path` with optional `forks`, `shelters`
  (entry/exit pairs that end one run and start the next), `speed`, per-run `paces`, `headStart`,
  `openingDrop` and a `tunnel` camera mode. This is the engine's version of Crash Dash and Boulders.
- `minefields` — pressure fields (`p`, `s`, `spots`, `rectangles`); a rail with `minefieldTrap` set
  detonates one on contact.
- `caveCollapse` — a collapse that follows a `path` after a `trigger`, with `headStart`, `warning`,
  `speed` and `spacing`: a falling-rock pursuer.

**Units differ between primitives.** `phase` is seconds on a `crusher` and a `firetiki`, radians on a
`mover`, `pendulum` and `ropeswing`, and a *fraction of the cycle* on a `phasepad`. `speed` is m/s on
a `stone` and an enemy but radians per second on a `mover` and a `pendulum`. To stagger two hazards
by half a cycle: crusher `phase = cycle / 2`; mover `phase = π`; phasepad `phase = 0.5`.

### XV.12 Rhythm in metres

Crash's guides give rhythm in seconds: about one decision every 2–3 s on a board or vehicle, one
step every 1.5–2 s across timed footing, and a rest after 3–5 coupled jumps (XI). This hero is
faster, so convert by speed rather than copying distances:

| Situation | Speed | One beat at 1.5 s | One beat at 2 s | One beat at 3 s |
|---|---|---|---|---|
| On foot, full run | 9 m/s | 13.5 m | 18 m | 27 m |
| Board at cruise | 12 m/s | 18 m | 24 m | 36 m |
| Board charging | 18 m/s | 27 m | 36 m | 54 m |
| Board at charge maximum | 23 m/s | 35 m | 46 m | 69 m |

A Crash-like stream of board decisions therefore wants **≈ 24–36 m between decisions at cruise** and
proportionally more on a fast line. Closer spacing turns the stream into a wall of simultaneous
demands; much wider spacing turns it into an empty road. On foot, timed footing at one step per
1.5–2 s spaces its cycles 13–18 m apart along the route. Hazard cycles should match the beat they
sit in: a `crusher` or `phasepad` whose window recurs every 3.2–4 s fits one decision per beat at a
walk, but a skater at cruise covers 38–48 m per cycle and needs the window aligned with the approach
(XVII).

### XV.13 Crash geometry relationships, re-dimensioned

| Crash relationship (measured in the maps) | In this engine |
|---|---|
| Plain lethal pit ≈ 2 u (two in five gaps) | plain band 2.5–4 m on foot, 3.5–8 m on the board; difficulty from coupling, not width |
| Held, spin-extended or double-jump gaps: medians 3–4 u, widest 6–8 u | committed band 4–4.8 m on foot, or a double-jump gap 5–8 m once taught |
| Gaps crossed by a crate or enemy bounce: median ≈ 3 u, widest 8.5 u | tool gaps > 8 m on foot: a crate or arrow bounce, a turtle shell or `trampoline` |
| Teaching jumps isolated, ≥ 4–6 u of flat floor between | ≥ 5–7 m of flat floor between teaching jumps; more on the board (one beat, XV.12) |
| Coupled landings small (2–4 u), teaching landings wide | landing pads 2.5–4.5 m deep when coupled; ≥ 6 m deep when a lesson is new (coyote and edge catch forgive the take-off, nothing forgives a short landing on the board) |
| Rest after 3–5 coupled jumps | same count; a rest is a fixed floor at least one beat long with nothing timed on it |
| No-stop runs come from footing that disappears or a pursuer, never from width | `crumble`, `phasepad`, sinking `mover`, `boulderChase`, `caveCollapse` |
| A new hazard debuts alone with a place to wait | a fixed floor ≥ 5 m before the first `crusher`, `firetiki`, `phasepad` or `pendulum`, in view of a full cycle |
| An enemy debuts alone on safe ground, then moves to the take-off, then the landing | the same three steps for each `foe` kind |
| Enemies as steps or springs (turtle, hippo, frog) | `turtle` shell, a stomped `grunt` carcass as a projectile, `grindosaurus` spine |

---

## Part XVI — Skate × crate patterns

Each pattern gives its Crash precedent, the engine rule it relies on, a recipe in crate units
(1 u = 1.152 m; author on the 0.96 grid), what a wrong approach costs, and how to verify it.

### XVI.1 Smash lane — speed is the key
- **Precedent**: ride crates break on contact; the first crates after mounting teach it
  ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) W1-a, [Orient Express](crate-bible/levels/c3-03-orient-express.md) S1-a).
- **Engine**: smash at ≥ 12.5 m/s contact, trip at 8–12.5, ×0.81 speed per smash.
- **Recipe**: 1–3 single plain crates on a straight or descent, ≥ 5 m apart, entered at ≥ 18 m/s;
  more only with a slope or speed pad between. The first one sits right after a point where speed
  is naturally high (bottom of a ramp), readable ≥ 1.5 s ahead.
- **Wrong approach**: cruising trips on the first crate; on foot the player spins them.
- **Verify**: ride it at cruise (must trip), at charge (must clear), on foot (still collectable).

### XVI.2 Board stomp chain
- **Precedent**: Crash's crate-to-crate bounce chains; Turtle Woods' chained enemy bounces.
- **Engine**: a board landing on a lid is a stomp (2.87 m bounce, speed kept).
- **Recipe**: single crates (or 2-wide pairs) at equal height ≈ 6 u apart for cruise; the first
  reachable by a full ollie (1 crate high). End on a wooden arrow whose launch reaches a high reward.
- **Wrong approach**: charging smashes the first crate and breaks the chain; tap ollies fall short.

### XVI.3 One-way grind bridge
- **Precedent**: crates as consumable footing (VII A5); the vehicle that closes a route
  ([Air Crash](crate-bible/levels/c2-07-air-crash.md) S2-a); floating boxes that break on landing
  ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) G-c).
- **Engine**: rows ≥ 2 touching, equal tops, open lids grow edge rails; every crate ridden breaks.
- **Recipe**: a straight row of 4–8 crates floating at deck height across a pit; decks at both ends;
  entry by ollie catch or a snap from the deck edge (snap radius 2.1 m). Put the box value in the row.
  If the route returns, author the return (a far-end `!` that materialises a steel bridge, a portal,
  a separate rail).
- **Wrong approach**: on foot, walking the lids keeps the bridge (allowed); stomping them breaks the
  footing under you.
- **Verify**: grind at cruise and at 6 m/s; fall mid-way and confirm the checkpoint restores the row.

### XVI.4 Grind staircase
- **Precedent**: outline staircases over spikes ([Snow Go](crate-bible/levels/c2-02-snow-go.md) S3-c);
  timed staircases to a permanent crate ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) S7-a/b).
- **Engine**: grind-jump pop ≈ 2.4 m above the rail reaches a row one crate higher.
- **Recipe**: rows of ≥ 3 crates, each +1 u higher, offset so a plain grind-jump off one row's end
  lands on the next row's start; final row ends at a deck holding the reward. One-way by construction.

### XVI.5 Peel layers — a permanent rail under a consumable one
- **Precedent**: peel the pile (VII B1); the permanent steel skeleton of Crash structures.
- **Engine**: only open lids form rails; breaking the top layer exposes the row beneath.
- **Recipe**: a steel row with a wood row stacked on it. First pass grinds the wood (pays crates);
  afterwards the steel row is a reusable rail one crate lower. (Alternating wood/steel in one row
  does **not** persist — the steel singles stop touching.)

### XVI.6 Switch grind
- **Precedent**: the switch builds the way, leading straight onto the next rail
  ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S6).
- **Engine**: a `!` inside a crate row is flipped by the grind-through and survives.
- **Recipe**: a row ending with a `!`; its outline group forms the next row or platform ahead, visible
  from the row. The line continues only if the rider grinds through the switch.

### XVI.7 Detonator row
- **Precedent**: TNT as clearer and switch-presser (V.1); the TNT bridge with steel footing
  ([Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) bonus).
- **Engine**: an explosive in a row detonates when reached; ≥ 6.5–7 m/s survives; blasts break
  crates within ≈ 3.35 m and kill enemies within ≈ 3.5 m.
- **Recipe**: 4–6 crates with a TNT second from the end; the target (a guarded crate cluster, an
  enemy on a ledge) within 3 m of the TNT, not on the row.

### XVI.8 Speed-gated rail
- **Precedent**: a crate on the rail line ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) R2-d).
- **Engine**: < 12.5 m/s knocks the rider off; ≥ 12.5 smashes through.
- **Recipe**: authored rail after a descent or speed pad; one plain crate on the line; give the slow
  rider a grind-jump over it (pop ≈ 2.4 m) or a parallel rail.

### XVI.9 Three-height rail pickups
- **Precedent**: Crash 4 puts rail crates above (jump), beside (contact) and below (hang) the rail,
  with "dodge = collect" placement (VIII.5).
- **Engine**: above — floating crates within grind-jump apex (≈ 2.4 m over the rail) break on contact
  or stomp; beside — a parallel crate row is itself a grind line, collected by a rail transfer;
  below — this game has an under-rail hang (Circle on a rail): **verify** how a crate at hanging height
  is treated before building on it.
- **Recipe**: the first crate of each rail move sits where dodging the obstacle puts the rider; the
  test version sits just past the obstacle in the opposite posture.

### XVI.10 Nitro beside the line, never on it
- **Precedent**: Nitro as lane geometry; no explosives on Crash 4 rails (VIII.1).
- **Engine**: Nitro kills on any contact at any speed (mask absorbs once).
- **Recipe**: Nitro beside skate lanes and rails, readable ≥ 1.5 s ahead (≥ 18 m at cruise, ≥ 35 m at
  charge), with a full lane width (≥ 2 u) of safe line beside it. Never on an authored rail line.

### XVI.11 Fuse kick
- **Precedent**: TNT as clearer and as pre-lit gate ([Bear It](crate-bible/levels/c2-08-bear-it.md)).
- **Engine**: a 3–12 m/s bump lights a 3 s fuse; the blast front (≈ 7.9 m/s) is slower than cruise.
- **Recipe**: TNT where approach speed is naturally low (after a turn, top of a climb) beside the
  thing it should clear; the exit line leads away from it.

### XVI.12 The tool speed destroys
- **Precedent**: preserve the tool (VII A4).
- **Engine**: a wooden arrow smashes at ≥ 12.5 m/s contact; landed on from an ollie it launches
  3.77 m (5.92 m held).
- **Recipe**: wooden arrow on a fast line; reward crate whose lid is 4.7–4.9 m above the arrow's
  floor (5–7 m for the held launch) and beyond double-jump reach. Charging into it destroys the tool.

### XVI.13 Return-trip economy
- **Precedent**: reverse sweeps and bonus returns (VII D1, [Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) P2,
  [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) bonus).
- Consumable structures (XVI.3–XVI.5) remove the way back; if a room needs a return sweep, author the
  return explicitly and test it from the far end.

### XVI.14 Board or boots
- **Precedent**: Air Crash takes 30 crates on the board and 29 on foot, each mode with its own grammar.
- **Recipe**: rooms where the board solution (grind, smash) is fast and the on-foot solution (stomp
  chain, careful order) preserves tools or routes. The two costs must differ visibly.

---

## Part XVII — Skate × ground, hazard and enemy patterns

Part XVI does for crates what this part does for the rest of the level. Each pattern gives the Crash
precedent, the engine rule it relies on (XV.3, XV.9–XV.12 and the code named there), a recipe in
metres (crates in brackets), what a wrong version costs, and how to verify it.

Three engine facts drive every pattern here:

- **Contact with a live enemy on the board is a hit.** Only a stomp, a spin, a slide or mask
  invincibility defeats an enemy; riding into one costs the mask or the run, whatever the speed.
  Enemies on a skate line are therefore hazards with a counter, not obstacles to plough through.
- **The spin works on the ground, in the air, on a grind, on a rope and while hanging** (not while
  bailing). A skater can spin an enemy off a rail without leaving it.
- **A spun enemy is a projectile**: it is flung at 42 m/s and smashes any crate it hits. A stomped
  `grunt` leaves a carcass that a later spin flings the same way; a defeated ordinary `turtle`
  leaves a shell trampoline.

### XVII.1 Charge gap — "did you charge?"

- **Precedent.** Hang Eight's first ramp rewards full boost and its second punishes it; Jetboard
  Jetty's lanes narrow only after the open runs. Crash asks for speed with the vehicle, never with
  the jump length alone.
- **Engine.** A full ollie covers 9.36 m from cruise (holding Jump accelerates 12 → 15.6 m/s),
  12.55 m from 18 m/s and 13.83 m at the 23 m/s charge maximum. Charging builds 9 m/s²: cruise to
  18 m/s takes ≈ 0.7 s and ≈ 10 m, cruise to 23 m/s ≈ 1.2 s and ≈ 21 m.
- **Recipe.** Gap 10.5–12 m edge to edge (9–10.5 u), level take-off and landing. A straight,
  empty run-up of ≥ 30 m in clear view, with nothing else to do on it. Landing ≥ 6 m deep and
  ≥ 5 m wide. The far lip is a grindable edge (XVII.2). Put the gap where a crash costs only the
  approach: a checkpoint ≤ 1 beat (XV.12) before the run-up.
- **Wrong.** Under 9.5 m the gap is not a check; over 13.5 m it is impossible. A hazard on the
  run-up makes two demands at once. A run-up that turns hides the gap until it is too late to charge.
- **Verify.** In the browser, ride the gap at cruise without charging: it must fail (or catch the
  lip). Charge from the run-up start: it must clear with ≥ 1 m to spare.

### XVII.2 Edge save — the landing lip is a grind

- **Precedent.** Crash's generosity is in the failure, not the layout: Turtle Woods punishes its
  first gaps with time, not lives; Crash 4's landing shadow makes landings readable. Snow Go and
  Hang Eight put checkpoints on wide fixed floors, never on timed footing.
- **Engine.** Platform and road edges grind by default; the grind snap radius is 2.1 m; a lip up to
  2.4 m above the feet can be grabbed on foot. A skater who comes up short and presses Grind catches
  the near edge of the landing.
- **Recipe.** Make the landing's near edge a clean straight lip at least 6 m long along travel
  (perpendicular gaps give a short lip; a gap crossed at an angle gives a long one). Keep that edge
  free of crates and walls. Use `edgeGrinding: false` only for a deliberate exception such as a
  slippery or burning surface, and say why in the level notes.
- **Wrong.** A landing flush with a wall, or an edge cluttered with decor, removes the save. A
  landing lip lower than the take-off by more than ≈ 2 m makes the save invisible.
- **Verify.** Jump the gap 1–2 m short on purpose and press Grind: the rider must catch the lip
  and ride it out onto the landing.

### XVII.3 Green wave — timed hazards phased for the approach speed

- **Precedent.** Snow Go follows every crusher at once with a demand, so the reward for timing is
  flow. Off-Balance uses its flame totem as a metronome; Stowing Away puts crates in the gaps
  between laser gates, so the hazard rhythm sets the crate rhythm.
- **Engine.** A `crusher` (cycle 3.2 s by default) slams for 0.26 s, rests as a solid block for
  0.77 s and leaves ≈ 2.2 s of passable hang-and-rise. A `firetiki` warns for 1.25 s, then fires for
  1.8 s of its 7.8 s cycle. A `phasepad` is solid for `amp × cycle`. A rider at speed `v` reaches the
  `i`-th hazard of a row spaced `D` apart `i·D/v` seconds after the first.
- **Recipe.** For hazards whose `phase` is in seconds (crusher, firetiki), set
  `phase_i = phase_0 − i·D/v` (modulo the cycle) so each one is open as the rider arrives at the
  design speed: 12 m/s for a board at cruise, 9 m/s on foot. Example: three crushers 12 m apart for a
  cruising board, `cycle 3.2`, phases 0, −1.0, −2.0 (that is 0, 2.2, 1.2). Space them at least one
  beat apart (XV.12) so each one reads. Then break the wave once, at the test: the last hazard is
  phased half a cycle off, so a rider who learned "hold cruise" must brake or charge.
- **Wrong.** Random phases make a row unreadable at speed. A window shorter than the time needed
  to cross the hazard's footprint (`footprint / v` plus ≈ 0.3 s) cannot be passed. A wave tuned for
  cruise that starts after a forced speed change (a downhill, a speed pad) is out of phase.
- **Verify.** Ride the row at the design speed without braking: every hazard must be open. Ride it
  at charge maximum and at a walk: at least one must close, and the stopping floor before it must
  be visible.

### XVII.4 Bull alley — a telegraphed charge with a dodge pocket

- **Precedent.** Crash 4 teaches heavy enemies at the ends of transitions (Draggin' On's lions) and
  armoured blockers on checkpoint pads (Snow Way Out); the boulder chases put the pursuer in a lane
  it nearly fills, so the only exit is forward.
- **Engine.** A `charger` notices you within 3.6 m of its lane and 2.5–26 m along it, plants for
  0.70 s, then dashes at 3.4 × its speed (10.2 m/s at the default 3 m/s) for up to 1.3 s or to its
  patrol end, untouchable and lethal, then stays dizzy and harmless for 1.1 s. The bull's body is
  ≈ 2.6 m wide.
- **Recipe.** Debut: a 10–12 m wide floor, the bull patrolling across it, a ledge or crate stack
  the player can stand on to watch one charge. Test: a lane 6–8 m wide with dodge pockets 3 m deep
  every 12–15 m (one dash length) along the bull's patrol. Reward: a crate cluster at the bull's
  patrol end, reached during the dizzy spell. On the board the skater can outrun a dash moving away
  at cruise (12 > 10.2 m/s) but not one coming toward them.
- **Wrong.** A bull on a narrow ledge over a pit makes the dash an unavoidable death. A bull whose
  patrol crosses a board line gives a rider at cruise 0.7 s of windup (about 8 m of travel), then a
  dash that closes at about 22 m/s: too little to read.
- **Verify.** Approach at a walk and at cruise from both directions; at each speed the windup must
  be visible before the dash can reach the player.

### XVII.5 Drone over the rail — spin from the grind

- **Precedent.** Turtle Woods gives its vulture a ≈ 10 u runway for reaction distance; Bears
  Repeating teaches its drones over open floor, then across a raft gap, then hovering inside gaps,
  keeping one counter while the geometry changes.
- **Engine.** A `floater` hovers 1.65 m above its base and swoops every 2.6 s when the player is
  within 12 m along and 6 m across, dipping to 0.35 m for 0.8 s. Stomping fails; any spin works,
  and the spin is available while grinding.
- **Recipe.** A straight rail 18–30 m long with a floater patrolling parallel to it at rail height,
  its patrol centred on the rail's middle. Teach it first over a floor beside the rail, then over
  the rail above a safe drop, then over a lethal gap. A crate the flung drone can hit (beside the
  rail's end) makes the spin pay.
- **Wrong.** A floater over a jump where the only counter is a jump-spin costs the jump. On a rail
  ridden faster than 18 m/s, the 2.6 s swoop cycle stretches over 47 m and the drone may never
  swoop in reach: either an empty encounter or a surprise.
- **Verify.** Grind the rail at cruise: the swoop must arrive while the rider is on it, and a spin
  must defeat the drone without unseating the rider.

### XVII.6 Cover crates — the sentry shoots only what it can see

- **Precedent.** Snow Way Out first shows its crossbow snipers from a safe pad below them; Crash 4
  uses hazards and crates that double as rewards.
- **Engine.** A `sentry` tracks for ≥ 1.3 s, charges for 0.55 s and fires a 10.5 m/s orb (range
  32 m) about every 2.7 s, but only along a clear line: walls, live crates and ground block both the
  aim and the shot.
- **Recipe.** Put a row of 2–3 crates (1 high on foot, 2 high on the board) between the sentry and
  the approach, 4–8 m in front of it. The crates are cover and a payout: breaking them (a spin, or a
  board at ≥ 12.5 m/s) pays and exposes the player. A steel crate is permanent cover. A route that
  breaks cover just after a shot (the 2.7 s cycle) reaches the sentry safely.
- **Wrong.** Cover the player cannot see from the approach is not a decision. A sentry facing a
  rail with no cover turns the rail into a shooting gallery.
- **Verify.** Stand behind the cover and confirm the sentry does not fire; break it and confirm it
  does.

### XVII.7 Shell spring — the turtle as a tool gap

- **Precedent.** Turtle Woods teaches the turtle in four steps and ends with a turtle patrolling
  under a floating box that is above jump height (E-S3-b): the enemy is the step.
- **Engine** (measured, `enemy-bounce` rows of the probe). Defeating an ordinary `turtle` (Mossback)
  by spin or stomp leaves a shell whose belly is 1.40 m high. Landing on it bounces like an arrow
  crate: 3.77 m above the belly, **5.17 m above the floor**; with Jump held 7.32 m; with a double jump
  at the apex 6.91 m, or 9.05 m held. Stomping the live turtle already launches from the shell to the
  same 5.17 m. A later spin flings the shell away. Ghost skins recoil spins and leave no shell. For
  comparison, stomping a `grunt` bounces 2.67 m above its back (3.77 m above the floor).
- **Recipe.** As a height tool: a floating target whose underside is 5.6–7.4 m up beside the turtle's
  patrol (out of the floor double jump's 5.5 m head reach, inside the shell + double jump's 7.8 m);
  or a landing 7–8.5 m up reached only by a held shell bounce plus double jump (feet 9.05 m). As a
  gap tool: the turtle on the take-off side of a gap wider than 8 m, its shell bounce the only way
  across. Teach the shell bounce first on safe floor.
- **Wrong.** A turtle that can walk off its strip or into the gap removes the tool and soft-locks the
  route; give it terrain support or a short `range`. A height target low enough for a plain double
  jump makes the turtle decoration.
- **Verify.** Defeat the turtle with a spin and with a stomp; in both cases the shell must remain
  and the bounce must reach the target, and the target must be out of reach without it.

### XVII.8 Crumble run on the board — speed makes it easy, stopping kills

- **Precedent.** Bears Repeating's crumbling ice slabs (first slow-mo use); Snow Way Out's falling
  cubes; in every level, no-stop runs come from footing that disappears, never from gap width.
- **Engine.** A `crumble` pad shakes for 0.85 s after contact, then falls; it returns 10 s later.
  At cruise a skater covers 10 m during the shake.
- **Recipe.** A line of 3–6 crumble pads 3–5 m deep with 1–2.5 m gaps on foot, or one long
  crumble strip on the board. Fixed floors at both ends; the far one is a rest. On the board, add
  a single slow element (a turn, a crate to smash) only after the run has been ridden once clean.
- **Wrong.** A crumble pad as a teaching landing (the lesson and the clock arrive together). A
  crumble run ending in a gap that needs a charge: the run-up is collapsing.
- **Verify.** Walk it and ride it; a deliberate one-second stop anywhere must fall.

### XVII.9 Shelter chase — the boulder run in short legs

- **Precedent.** Crash Dash splits its pursuit into four short chases: every roofed room stops the
  boulder, holds the checkpoint and releases a fresh boulder when the player leaves. The boulder
  nearly fills its lane, so the only escape is forward; mines cost distance rather than lives.
- **Engine.** `boulderChase` takes a `path`, `shelters` (entry/exit pairs), `speed`, per-leg
  `paces`, `headStart` and `openingDrop`, and can fork. On foot the hero runs 9 m/s; on the board
  cruise is 12 m/s and charge 23.
- **Recipe.** Legs of 10–20 s. Lane 1.3–1.5 × the boulder's diameter, so it can never be passed.
  Hazards that ask for a lateral move or a jump, never a stop (partial holes, half-width fences,
  full-width pits on the last leg). A checkpoint in every shelter. Set the pace from the slowest
  required move: a leg with an on-foot jump sequence should be beatable at 8 m/s.
- **Wrong.** A boulder faster than the slowest required action is a coin toss. A hazard that needs
  a stop (a timing gate) inside a chase cannot be solved.
- **Verify.** Run every leg at the slowest legitimate speed with one mistake; the boulder must
  still not catch up before the shelter.

### XVII.10 Ferry and transfer — a mover under a grind line

- **Precedent.** Air Crash escalates its moving footing by axis; Crash 4 crosses long gaps only with
  moving footing tied to a vehicle or mask; Jetboard Jetty's raft sets a beat that cannot pause.
- **Engine.** A `mover` is sinusoidal: period 2π / `speed` (10.5 s by default), peak deck speed
  `amp × speed`. A travelling `rail` moves the same way. A `ropeswing` anchor can travel.
- **Recipe.** A long gap crossed by a mover whose deck carries a short rail or a crate row; the
  skater grinds aboard, rides across and ollies off at the far end of the travel. Keep the deck's
  peak speed below ≈ 3 m/s for on-foot boarding; align the far end of travel with the landing.
- **Wrong.** A mover whose far end does not meet the landing turns the crossing into a blind jump.
  A deck that moves faster than walking speed throws a walking player off its edge.
- **Verify.** Board the mover at its slowest and fastest points of travel; both must be safe.

### XVII.11 Hurdle enemy — the frog and the low swing

- **Precedent.** Crash Dash's fences and Jetboard Jetty's raft boom are hurdles on a forced line;
  Crash's light enemies are hurdles on the line while heavy ones guard transitions (Draggin' On).
- **Engine.** A `hopper` crouches 0.45 s and leaps ≈ 1.5 m high for ≈ 0.7 s; it can be stomped only
  on the ground. A `spinner` is out 2.2 s and in 1.35 s, 2.1 m wide when out. A board ollie at
  cruise peaks at 1.78 m and covers 9.4 m.
- **Recipe.** A hopper on a board line is a timed hurdle: ollie over it while it crouches, or spin
  it in the air. A spinner on a 6–8 m wide lane is a gate: pass beside it while it is in, or spin
  it during the 1.35 s window. Debut each alone on a wide floor before it guards a line.
- **Wrong.** A hopper whose leap carries it into the landing zone of a required jump turns two
  readable things into one unreadable one.
- **Verify.** Pass the hurdle at cruise ten times with only its telegraph to go on.

### XVII.12 Pinball line — enemies as projectiles into crates

- **Precedent.** The Eel Deal: an enemy knocked into a fan breaks a blade; Jetboard Jetty lures
  pirates into a lit TNT; Crash enemies turn into tools.
- **Engine.** A spun enemy flies at 42 m/s and smashes crates it hits; a stomped `grunt` leaves a
  carcass a later spin flings the same way.
- **Recipe.** A `grunt` patrolling 3–6 m in front of a crate cluster the player cannot otherwise
  reach (behind a gap, on a ledge). Spinning the grunt toward the cluster breaks it from a distance;
  stomping first and flinging the carcass is the careful version. Use it for optional crates only.
- **Wrong.** Making the fling the only way to finish the all-box route: aiming is hard to read.
- **Verify.** From the patrol's near end, a spin toward the cluster must break at least one crate.

---

## Part XVIII — Diagnosis of the current game

XVIII.1–XVIII.3 cover crates; XVIII.4–XVIII.6 cover ground, gaps, hazards and enemies.

From the [current-game audit](crate-bible/CURRENT_GAME_AUDIT.md): 27 campaign courses (57.6 km of
route between spawn and gate) and the three puzzle-trilogy levels, built through the real `Level`.
Bonus rooms, races and free-skate parks were not audited.

### XVIII.1 The numbers side by side

| Measure | Crash (2 / 3 / 4 maps) | This game: campaign | This game: puzzle trilogy |
|---|---|---|---|
| Mean crates per cluster | 3.0 / 2.5 / 3.2 | **1.56** | ≈ 1.3 |
| Single clusters (share of clusters) | 34 / 39 / 46 % | **84 %** | 83 % |
| Crates that stand alone (share of crates) | 12 / 16 / 17 % | **≈ 58 %** (730 of 1,255 counted) | ≈ 63 % |
| Main-route crates between checkpoints (median) | 10 / 12 / 11 | **2** (mean 4.4); **82 of 286 sections have none** | 7 |
| Checkpoint spacing | by crate rhythm and mode change | median **139 m** | 56 m |
| Clusters holding TNT or Nitro | 23 / 16 / 19 % | ≈ 4 % (38 of ≈ 945) | 17 % |
| …of which also hold rewards | 43–45 % | 13 % (5 of 38) | 2 of 10 |
| Wood share of solid crates | 33–41 % | **63 %** | — |
| `?` share | 13–26 % | 9 % | — |
| TNT / Nitro share | 5–11 % / 9–17 % | 1 % / 3 % | — |
| Striped / multi-hit share | 5 % | 1 % (15 crates) | 5 crates |
| Reinforced (slam-only) crates | 3–5 % | **no such kind** | none |
| Arrow crates with something to reach above | the tool is always for something | 14 of 26 (**12 have nothing above**) | 9 of 11 |
| Green `!` | the level's last object, after its Nitro | 8 of 9 Nitro courses: within 40 m of the gate, after all Nitro ✔ | before each Nitro field ✘ |
| Off the main line | 37 % of Crash 2 boxes in optional routes | 5 % of counted crates > 8 m from the camera lane (bonus rooms not counted) | 0 |
| Crates per 100 m of route | (not measured in metres) | median **1.76** (0.22–7.8) | 11.2 |

The campaign's routes are long and fast, so crates per metre exaggerates the gap; time on route was
not measured on either side. The measured differences are **structural**: the crates exist, but they
are spread as singles along long sections (median 2 per checkpoint section, 58 % standing alone)
instead of being gathered into clusters that pose decisions at a rhythm the checkpoints follow
(10–12 per section, 12–17 % alone).

### XVIII.2 Anti-patterns found (with locations)

1. **Fruit on a string.** Evenly spaced single crates along the route: Sunset Safari (`custard-creek`)
   has 16 such runs, the longest 20 crates one every 12 m with 99 % of its clusters single; 22 runs in
   3 courses. Crash never does this on foot; on rides it uses lane beats, landing markers and
   paired hazards instead (VIII).
2. **Empty sections and empty courses.** 82 checkpoint sections carry no counted crate; Dusty Road,
   Guptus Eruptus and Torchlight Trouble carry none at all. In Crash every section has a crate
   rhythm and checkpoints exist *because* of it (VI.1).
3. **Tools for nothing.** 12 of 26 arrow crates have nothing above them to reach; 6 sit at a drop
   edge or over a void. In Crash an arrow is always the answer to a visible question (V.5).
4. **No order puzzles.** Tallest collectible stack is 4; only 57 stacks in the campaign; multi-hit
   crates mostly stand alone (11 of 15). Nothing asks the player to choose an order (VII.A).
5. **Explosives without jobs.** 17 TNT in 27 courses; TNT next to reward crates 7 times, usually
   without a readable method. Crash gives every TNT one of seven jobs (V.1) and teaches it alone first.
6. **Structural crates mistaken for crate design.** One switch in the Codex lab builds 400 steel
   outline crates into 13-high towers — useful level geometry, but none of it is a crate decision.
7. **Accidental grind lines.** 170 derived crate rails, 71 % only two crates long, 79 % hanging over
   gaps (mostly Carlisle). Some are good one-way bridges (Carlisle's 21-crate "Crown cargo causeway"
   is exactly XVI.3); many are unintended 2.3 m rails. Every crate row is a rail — decide it.
8. **Accidental speed checks.** 78 counted crates sit on ≥ 10 % descents (41 of Skystream's 60), where
   a fast board smashes them — or a slow one trips. Make these deliberate smash lanes (XVI.1) or move them.
9. **Crates on rail lines by accident.** 5 crates within 1 m of an authored rail line (e.g. a life
   crate on a Rolling Bones rail): each is a speed gate (XV.6) whether intended or not.
10. **Stray placements.** Two reused 5-crate stacks float unreachable in Mayfield Mall (filed as a
    separate task); a green `!` with no Nitro to clear (Ripcord River); a green `!` 886 m before the
    gate with Nitro before it (Sunset Safari).
11. **The puzzle trilogy inverts the green `!` rule**, placing it ahead of each Nitro field; Crash
    places it after the Nitro it clears, as the final object.

What already matches Crash: green `!` placement in the campaign; Temple of Embers' switch that
reveals earlier balcony rewards (switch-then-return, VII C2); Carlisle's floating cargo reached by
trampolines and crate chains (vertical access); the puzzle trilogy's density (11 per 100 m, 7 per
section) and its use of order puzzles.

### XVIII.3 What to change first

1. **Re-cluster before adding.** Merge strings of singles into clusters with a named job at
   decision points (a stack with a target, a wall with a `?`, a pair framing a jump, a row along a
   lane). Target: mean cluster size ≥ 2.5, single crates ≤ 20 % of crates.
2. **Re-section by rhythm.** Place checkpoints so each main-route section holds ≈ 10–12 crates and
   every mode change (boarding, rails, rides, side-scroll, bonus entrance) has one. No empty sections.
3. **Give every tool a target** (or delete it): every arrow has a reward above it inside its reach and
   outside double-jump reach (XV.2); every multi-hit crate supports something.
4. **Stage the explosives**: teach TNT alone with a readable job, then test it; use Nitro as lane
   geometry beside fast lines and as frames around single rewards; green `!` last.
5. **Add order puzzles**: harvest-before-dismantling stacks, sandwiches, peel piles (VII.A–B).
6. **Exploit the skate rules on purpose**: smash lanes on descents, one-way grind bridges, switch
   grinds, detonator rows, speed-gated rails (XVI). Audit every derived crate rail.
7. **Price rewards**: lives over hazards, masks before the hardest stretch, count traps at attractors.
8. **Close the vocabulary gaps when a level needs them** (runtime work, separate tasks): a
   slam-only reinforced crate kind; optionally Crash 3 slot crates and Crash 4 timed outlines.
   Until then, approximate reinforced crates with multi-hit crates or steel + switch structures.

### XVIII.4 Geometry, hazards and enemies: the numbers side by side

From the [geometry audit](crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md) (`node tools/level-geometry-report.mjs`):
the same 27 campaign courses and 3 puzzle-trilogy levels, built through the real `Level` and walked
along the route line in 0.25 m steps, with reach judged against the measured ranges (XV.3). Crash
figures are from the 36 level maps (IX–XIV; widths in crates converted at 1.152 m).

| Measure | Crash (2–4 maps) | This game: campaign | This game: puzzle trilogy |
|---|---|---|---|
| Gap width, median | 2.5 u ≈ 2.9 m | **6 m** (quartiles 3–12.5 m) | 5.25 m |
| Plain-jump gap against the hero's running jump | ≈ 2 u of a ≈ 4–5 u Crash jump: about half | **half of all gaps exceed the 5.85 m foot jump**; 37 % exceed the double jump | half exceed the foot jump |
| Gaps coupled to an enemy, hazard, cycle or pursuer | ≈ 3 in 4 | **rare**: 4 danger hazards and 4 enemies at landings; 22 enemies at take-offs | timed pads and switches at every gap |
| Landing after a gap, depth | 2–4 u ≈ 2.3–4.6 m when coupled; ≈ 4 u checkpoint pads | **median 28 m deep, 7.3 m wide**; 2 landings under 2 m | mostly 16–32 m |
| Narrow footing (chokes) | ≈ 15 % of platforms are chokes; lanes narrow for finales | **1 % of the walk is narrower than 2 m** | 0 % |
| Gaps per section | median 3 | **103 of 286 sections have no gap**; 0.81 gaps per 100 m | 3.25 per 100 m |
| Enemies per section | median 2 (Crash 2: 4) | **185 of 286 sections have no enemy**; 10 courses have none on the route | 2.51 per 100 m |
| Enemy placement | on the line ≈ 25 %, landing ≈ 20 %; ladders across → along → landing | patrols **across the route 129, along it 17**; 48 % within 2 m of a lethal drop | along 13, static 4 |
| First appearance of an enemy kind | forgiving (alone, opt-out, mask or counter given) | 29 of 64 alone on safe ground; **25 spoiled by a lethal edge** | 9 of 13 |
| Danger hazards on the route | ≈ 2 per section | **74 in 11 courses; 16 courses have none** | none |
| Footing timers | moving, sinking, crumbling, phase: about a quarter of platforms | movers 134, crumbles 119, phase pads 26 | spin bridges, crumbles, phase pads |
| Crumble warning | readable (texture code, a shake) | **0.04–2.25 s** (median 0.7 s) | 0.85–1.1 s |
| Beat spacing | one decision per 1.5–3 s (24–36 m at board cruise) | 3.84 beats per 100 m (one per 26 m), but **the median course has a 130 m stretch with no beat** (max 2,748 m) | 13.2 beats per 100 m |

The campaign's *average* beat spacing is close to a Crash stream at board cruise. What differs is the
structure. Width carries the difficulty instead of coupling: half the gaps are at or beyond the jump,
and almost none have something waiting on the landing. Landings are huge, so the landing dial is
never turned. Enemies stand on the first rung of every ladder (patrolling across the lane), often at
lethal edges from their first appearance. Long empty stretches break the rhythm that the averages
hide.

### XVIII.5 Geometry anti-patterns found (with locations)

1. **Width as the only dial.** 228 of 457 campaign gaps exceed a foot jump and 120 exceed even the
   23 m/s ollie; 62 can be crossed only by a board at full charge (for example `rolling-bones`' 13.9 m
   water gap). Crash keeps gaps at about half its jump and couples them (X.2–X.3). A board-only gap is
   a fine speed check (XVII.1) when the run-up and the charge are visible; most are not built as one.
2. **Gaps beyond every measured move with no aid.** 19 campaign gaps (for example a 55.9 m pit in
   `carlisle-coast`). Either a launch the audit does not model, or a place where the route line leaves
   the walkable path: check each one in the browser.
3. **Uncoupled landings.** Only 4 of 74 danger hazards and 4 of 180 on-route enemies are at a landing;
   Crash's defining coupling (an enemy waiting on a 2–4 u landing) is almost absent. `drowned-crown` is
   the exception that shows the opposite error: 12 of its 13 enemies stand at gap edges, 11 at take-offs.
4. **Landings too large to matter.** A 28 m deep, 7.3 m wide median landing means a jump never asks
   for precision. Keep big floors for rests and checkpoints; shrink landings at test gaps (IX.2).
5. **No chokes.** 1 % of the walk is narrower than 2 m. Crash narrows lanes deliberately before mode
   changes, where enemies patrol and in finales (IX.5).
6. **Empty sections and dead stretches.** 59 of 286 sections have no gap, enemy or danger hazard;
   `bryce-canyon` runs 4,760 m without a gap and 2,748 m without any beat.
7. **Enemies stuck on the first rung.** Patrols run across the route (129 of 165 moving patrols); few
   run along it, few wait on landings or between hazards. The placement ladder of XIII.3 is unused.
8. **First appearances at lethal edges.** 25 of 64 first appearances stand within 2 m of a lethal drop,
   and 48 % of all on-route enemies do. Crash debuts on roomy ground and couples to edges later (XIII.2).
9. **Hazards confined to a few courses.** 41 % of all danger hazards sit in three courses; 16 courses have
   none. Crash 4 gives each level one hazard family and escalates it (XII.2); Crash 2 and 3 do the same
   per section.
10. **Warnings that cannot be read.** A crumble pad in `rumblewater-run` shakes for 0.04 s before it drops;
    campaign crumble warnings range from 0.04 to 2.25 s. A lethal timer needs a readable telegraph (law 16).
11. **Danger next to a landing without a debut.** A crusher 2.4 m from the landing edge of a 4 m gap in
    `drowned-crown`: a far-bank crusher is a good Crash pattern (Snow Biz) once the crusher has been met
    alone with a place to wait.

What already matches Crash: the puzzle trilogy's density (3.25 gaps, 2.51 enemies and 13.2 beats per
100 m) and its gaps bridged by spin bridges, outline surfaces and crates; 9 of its 13 first appearances
are alone on safe ground; `sky`'s first section reads like a Crash stream (`CRGHERGGHGCRGHCG`); the
campaign's crusher cycles (median 3.5 s) and phase-pad cycles (4.4 s) sit in Crash's watchable 2–4.5 s
range.

### XVIII.6 What to change first (geometry)

1. **Couple before widening.** At each existing test gap, put the difficulty on an edge: an enemy on a
   2.5–4.5 m landing, a crusher or fire tiki on the far bank after its debut, a footing timer. Bring
   plain gaps back into the 2.5–4 m band on foot (XV.9).
2. **Shrink test landings, keep rest floors wide.** Coupled landings 2.5–4.5 m deep; teaching landings
   ≥ 6 m; checkpoints on floors ≥ 6 m.
3. **Fill the quiet stretches.** No main-route stretch longer than about one section without a beat;
   target one beat per 13.5–18 m on foot and per 24–36 m at board cruise (XV.12).
4. **Give every course one hazard family and climb its ladder**: debut alone with a waiting spot, repeat
   without the pause, invert, combine (XII.2). Raise crumble warnings to ≥ 0.5 s (the 0.85 s default).
5. **Re-place enemies on the ladder**: debut each kind on roomy ground away from lethal edges, then
   move it to a take-off, then a landing, then between hazards; use `yaw: 90` for along-lane patrols.
6. **Build board speed checks deliberately**: a visible 30 m charge lane before every board-only gap,
   and a grindable landing lip (XVII.1–XVII.2).
7. **Audit the 19 unaided impossible gaps** in the browser and fix the route or add the aid.
8. **Add chokes** (1–2 crates wide, a few seconds long) before mode changes and in finales.

---

## Part XIX — Authoring recipes

Component format (see `CustomComponent` in `src/level.ts`): a crate is
`{t:'crate', kind, p:[x, bottomY, z]}` with `kind` one of `wood, mystery, life, mask, multihit,
bouncy, metalbounce, metal, tnt, nitro, bang, nitrobang`; `outline:true` makes it a ghost until a
`bang` with the same `grp` is hit; `nm` names it for the editor. Positions are on the **0.96 grid**
and touching formations are enlarged ×1.2 about their own centre at build time — so an authored row
of six (5.76 m) builds 6.91 m long, and pits sized for a bridge must use the enlarged length.
Corridors run toward −Z; the floor top is `y = 0` in these snippets. Every recipe ends with the
check it must pass; no recipe is finished until that check has been run in the browser (`/?lite`,
then one full-render pass).

### XIX.1 Crate recipes

**R1 · Sandwich (A1, III.2).** Two multi-hit crates, the upper floating; each stomp and each
head-bonk pays. Two variants, because the double jump changes what strands the lid:
```js
// Payout sandwich: lid underside 3.15 m — a plain jump from the base bonks it.
{t:'crate', kind:'multihit', p:[0, 0,    -20], nm:'Sandwich base'},
{t:'crate', kind:'multihit', p:[0, 3.15, -20], nm:'Sandwich lid'},
// "Lower last" sandwich: lid underside 6.0 m — reachable only by bounce + double jump from the
// base (head ≈ 6.7 m); with the base gone the floor double jump (head ≈ 5.5 m) falls short.
{t:'crate', kind:'multihit', p:[8, 0,   -20], nm:'Base: break it last'},
{t:'crate', kind:'multihit', p:[8, 6.0, -20], nm:'Lid: stranded if the base goes first'},
```
Check: the payout loop works by plain jumps (variant 1) or double jumps (variant 2); in variant 2,
breaking the base first leaves the lid unreachable.

**R2 · Arrow tool gate (A4, XV.2).** The floating reward needs the arrow; no plain crate within
stomping range (a stomp + double jump head-reaches ≈ 6.7 m).
```js
{t:'crate', kind:'bouncy', p:[0, 0,   -40], nm:'Arrow: the tool'},
{t:'crate', kind:'life',   p:[0, 6.5, -40], nm:'Reward: arrow + double jump (head ≈ 7.6 m)'},
// Held-arrow variant: underside 8.5 m (held bounce + double jump ≈ 9.7 m; plain arrow + double ≈ 7.6 m)
```
Check: floor double jump fails; a plain arrow bounce alone fails (head ≈ 5.8 m); arrow + double jump
succeeds; breaking the arrow first loses the life. Data-built levels do not get the engine's automatic
partner crate above an arrow — place it explicitly.

**R3 · One-shot height budget (A1, VII.A).** Every stomp breaks the crate under it and lowers the
stack, so a wood stack is a height budget spent from the top. The target needs the *first* stomp on
the intact stack plus a double jump.
```js
{t:'crate', kind:'wood',    p:[0, 0,    -60]},
{t:'crate', kind:'wood',    p:[0, 0.96, -60]},
{t:'crate', kind:'wood',    p:[0, 1.92, -60], nm:'Top: stomp this once, then double jump'},
{t:'crate', kind:'mystery', p:[0, 8.4,  -60], nm:'Target: head reach 9.0 m from the intact top'},
// Forgiving variant: make the top crate multihit (five stomps from the same 3.46 m lid).
```
Check: stomp + double jump from the intact top (lid 3.46 m, head ≈ 9.0 m) breaks the target; any earlier
spin (the column settles to a 2.30 m lid, head ≈ 7.8 m) or a stomp without the double jump loses it.
Note the inversion of Crash's Turtle Woods trick: there, spinning the middle box saved the striped top;
here any spin lowers the budget.

**R4 · TNT clearer with a payout (V.1, B3).** A TNT whose blast pays out a mask and clears a guard.
```js
{t:'crate', kind:'tnt',  p:[0,    0,    -80]},
{t:'crate', kind:'tnt',  p:[0,    0.96, -80], nm:'Lit by stomping from the enemy bounce'},
{t:'crate', kind:'mask', p:[1.92, 0,    -80], nm:'Inside the 3.35 m blast: the explosion pays it out'},
// enemy patrol 2-3 m in front; refuge platform >= 3.5 m from the TNT centre
```
Check: lighting it and retreating clears the mask crate and the enemy; spinning the mask crate first
next to the TNT kills; repeat the same layout later without the mask as the test.

**R5 · Nitro frame (IV.8, B8).** A single reward approachable only from the open side.
```js
{t:'crate', kind:'mystery', p:[0,     0, -100]},
{t:'crate', kind:'nitro',   p:[-1.92, 0, -100]},
{t:'crate', kind:'nitro',   p:[ 1.92, 0, -100]},
{t:'crate', kind:'nitro',   p:[0,     0, -101.92]},
{t:'crate', kind:'mask',    p:[0,     0, -90], nm:'Mask one cluster before the frame'},
```
Check: a front spin collects the `?` without touching Nitro; a slam or a sideways spin kills. Place
the level's `nitrobang` near the gate so these three Nitro are credited at the end.

**R6 · Switch-built crate bridge (C1, XVI.6).** A switch at the near edge materialises a crate row over
a pit; the row is footing on foot and a consumable grind line on the board.
```js
{t:'crate', kind:'bang', p:[0, 0, -118], grp:41, nm:'Bridge switch'},
...[0,1,2,3,4,5].map(i => ({t:'crate', kind:'wood', outline:true, grp:41,
     p:[0, -0.2, -121 - i*0.96], nm:`Bridge ${i + 1}`})),
{t:'pit', p:[0, -2, -123.5], s:[3, 1, 8.5]},   // sized for the enlarged row (≈ 6.9 m)
```
Check: before the switch the pit is impassable; after it the row is real; grinding it consumes it,
so if the route returns, author the return.

**R7 · One-way grind bridge (XVI.3).** A row floating over a pit at ollie-catch height between decks.
```js
{t:'platform', p:[0, -0.5, -134], s:[6, 1, 6]},                    // near deck, top y = 0
...[0,1,2,3,4,5,6].map(i => ({t:'crate', kind:'wood', p:[0, 0, -138.5 - i*0.96]})),
{t:'platform', p:[0, -0.5, -150], s:[6, 1, 6]},                    // far deck
{t:'pit', p:[0, -3, -142], s:[6, 1, 9]},
```
Check: a cruise-speed ollie catch grinds the whole row (all crates counted); a 6 m/s catch still
completes it; falling mid-way and respawning restores it; on foot the lids can be walked.

**R8 · Smash lane on a descent (XVI.1).**
```js
// on a >= 10 % descent after a straight where charge reaches >= 18 m/s
{t:'crate', kind:'wood',    p:[0,   ySlope(0),  -200]},
{t:'crate', kind:'mystery', p:[0.8, ySlope(6),  -206]},
{t:'crate', kind:'wood',    p:[0,   ySlope(12), -212]},
```
Check: cruise (12 m/s) trips on the first crate; charged it clears all three; on foot they are
collectable by spinning.

**R9 · Detonator row (XVI.7).**
```js
...['wood','wood','wood','tnt','wood'].map((kind, i) => ({t:'crate', kind, p:[0, 0, -230 - i*0.96]})),
{t:'crate', kind:'life', p:[2.5, 1.0, -233.8], nm:'Guarded target within 3 m of the TNT'},
```
Check: a cruise grind survives and the blast breaks the target; a 5 m/s catch dies; a spin from the
deck fires the TNT early (decide whether the target should survive that).

**R10 · Checkpoint inside a fast-line group (VI.1, IV.6).**
```js
{t:'crate', kind:'wood', p:[-1.2, 0, -300]},
{t:'checkpoint',         p:[ 0,   0, -306]},
{t:'crate', kind:'wood', p:[ 1.2, 0, -312]},
```
Check: the line that collects both crates also breaks the checkpoint; no checkpoint on a rail.

**R11 · Count trap at an attractor (IV.7).**
```js
{t:'checkpoint',            p:[0,   0, -400]},
{t:'crate', kind:'mystery', p:[2.5, 0, -397], nm:'Behind the checkpoint, toward the camera'},
```
Check: visible when the player turns; not visible in the default forward framing; counted.

### XIX.2 Geometry, hazard and enemy recipes

The snippets below use two helpers so that gaps and floors stay aligned. Corridors run toward −Z,
the floor top is `y = 0`, a `platform`'s `p` is its centre, a `pit` is the death volume under a gap,
and an enemy patrols across the lane (X) unless `yaw: 90` turns it along the lane (Z).

```js
// zNear = the edge you arrive at; len/width are measured along travel (toward -Z).
const floor = (zNear, len, w = 10, x = 0, top = 0) =>
  ({t:'platform', p:[x, top - 0.5, zNear - len / 2], s:[w, 1, len]});
const pitGap = (zNear, width, w = 10, x = 0) =>
  ({t:'pit', p:[x, -4, zNear - width / 2], s:[w, 1, width]});
```

**RG1 · Gap ladder (X.6, law 14).** Teach a lethal gap in four beats, each one step more lethal.
```js
floor(0, 20),                                   // safe start
{t:'platform', p:[0, -1.1, -21], s:[10, 1, 2]}, // 1 · a 0.6 m trench that cannot kill
floor(-22, 12),
pitGap(-34, 3, 5, -2.5), floor(-34, 3, 5, 2.5), // 2 · a hole on the left half; the right half stays floor
floor(-37, 12),                                 // practice runway, 12 m
pitGap(-49, 3.5), floor(-52.5, 12),             // 3 · full-width plain gap, 3.5 m (3 u)
pitGap(-64.5, 3.5), floor(-68, 5),              // 4 · the same gap onto a 5 m landing…
{t:'enemy', foe:'grunt', p:[0, 0, -70.5], range:3, speed:2.5, nm:'…with a crab on it'},
floor(-73, 14),                                 // rest, then the checkpoint
{t:'checkpoint', p:[0, 0, -80]},
```
Check: beats 1–2 cannot kill a player who stays on the line; beat 3 kills only a player who stops
at the edge; beat 4 punishes landing on the crab without a spin. Width never rises above the plain
band (XV.9); only the coupling changes.

**RG2 · Hazard debut, then the green wave (XII.2, XVII.3).** A crusher first over solid floor with a
watching spot, then a phased pair, then combined with a gap on its far bank.
```js
floor(-90, 60),                                                         // no pit under any of the first three
{t:'crusher', p:[0, 0, -103], s:[4, 3, 3], cycle:3.2, phase:0,    nm:'Debut: watched from the 11 m of floor in front'},
{t:'crusher', p:[0, 0, -121], s:[4, 3, 3], cycle:3.2, phase:0,    nm:'Pair 1'},
{t:'crusher', p:[0, 0, -133], s:[4, 3, 3], cycle:3.2, phase:1.87, nm:'Pair 2: 12 m later = 1.33 s at 9 m/s'},
pitGap(-150, 3), floor(-153, 10),
{t:'crusher', p:[0, 0, -156], s:[4, 3, 3], cycle:3.2, phase:0,    nm:'Far bank: start when it rises'},
```
Check: at 9 m/s the pair is open for a player who goes as pair 1 opens; standing on the 8 m floor
shows a full cycle before the first crusher; the far-bank crusher is the first one with a gap in front
of it, after three without.

**RG3 · Enemy debut ladder (XIII.2–XIII.3).** One kind, four placements.
```js
floor(-170, 14),
{t:'enemy', foe:'spiker', p:[0, 0, -177], range:4, speed:2.5, nm:'1 · Alone on a 14 m floor'},
floor(-184, 10),
{t:'enemy', foe:'spiker', p:[0, 0, -191], range:4, speed:3, nm:'2 · Patrols across the take-off'},
pitGap(-194, 3.5), floor(-197.5, 4),
{t:'enemy', foe:'spiker', p:[0, 0, -199.5], range:1.5, speed:2, nm:'3 · Occupied 4 m landing: spin before landing'},
floor(-201.5, 16),
{t:'enemy', foe:'spiker', p:[-2, 0, -208], range:3, speed:3, nm:'4 · Mixed counters…'},
{t:'enemy', foe:'grunt',  p:[ 2, 0, -212], range:3, speed:3, nm:'…stompable beside unstompable'},
```
Check: beat 1 can be passed or spun; beat 3 punishes a stomp; beat 4 punishes a player who stomps
everything. Do not put beat 3 within one beat (XV.12) of a new hazard.

**RG4 · Timed stepping stones with a skill bypass (IX.3, XI.3).** Three phase pads phased for a
step every 0.8 s; the double jump can skip the middle pad.
```js
floor(-230, 10),
{t:'phasepad', p:[0, 0, -241.5], s:[3, 0.6, 3], cycle:4, amp:0.5, phase:0,   nm:'Pad 1'},
{t:'phasepad', p:[0, 0, -246.5], s:[3, 0.6, 3], cycle:4, amp:0.5, phase:0.8, nm:'Pad 2 (0.8 s later)'},
{t:'phasepad', p:[0, 0, -251.5], s:[3, 0.6, 3], cycle:4, amp:0.5, phase:0.6, nm:'Pad 3 (1.6 s later)'},
pitGap(-240, 13), floor(-253, 10),
```
`phase` on a phase pad is a *fraction of the cycle*: pad `i`, reached `Δt` seconds after pad 1,
takes `phase_1 − Δt / cycle`. Check: stepping pad to pad on each pad's solid window works; skipping
pad 2 is a 7 m double-jump gap (XV.9 double band) and works at any time; every pad strobes for 0.9 s
before it goes dark.

**RG5 · Section beat template (XIV.1).** One section of a Crash-like level, in metres for this hero.

| Beat | Content | Length at 9 m/s on foot | At 12 m/s on the board |
|---|---|---|---|
| Open | safe floor, one teaching crate cluster | ≥ 18 m (2 s) | ≥ 24 m |
| Teach | the section's new element alone, a place to watch it | 15–25 m | 25–35 m |
| Practice | the element plus a plain gap or a familiar enemy | 25–40 m | 35–50 m |
| Rest | fixed floor, nothing timed, often a reward | ≥ 13 m (1.5 s) | ≥ 18 m |
| Test | the element coupled to the hardest gap or enemy, 3–5 jumps | 30–50 m | 40–70 m |
| Checkpoint | a floor ≥ 6 m deep, crates beside it | — | — |

Medians across the Crash maps (XIV.1) put about 3 gaps, 2 enemies and 2 hazards in one section;
keep a section to one new element.

**RG6 · Shelter chase leg (XVII.9).** A boulder pursuit cut into legs by shelters.
```js
// level data, not a component
boulderChase: {
  path: [[0, 0, -300], [0, 0, -420], [0, 0, -560]], // one camera/floor spine
  radius: 2.6, speed: 8, paces: [8, 8.5], headStart: 10,
  shelters: [{entry: [0, 0, -410], exit: [0, 0, -432]}], // a checkpoint lives inside
},
```
The engine rejects the whole level if the chase breaks its limits (`validBoulderChase` in
`src/boulderChase.ts`): radius 1–12 m, speed and every pace 2–35 m/s, one pace per leg
(`shelters + 1`), `headStart` ≥ 2 × radius + 4 m, a path longer than twice the head start, and each
shelter 18–100 m long along the path, starting ≥ 3 × radius + 30 m after the previous shelter (or
the path start) and ending ≥ 3 × radius + 20 m before the path's end.
Lane 7–8 m wide (1.3–1.5 × the 5.2 m diameter), hazards that ask for a lateral step or a jump and
never a stop. Check: run each leg at 8 m/s with one mistake; the boulder must not reach the
shelter first. On the board use paces above cruise (Rumblewater uses 23–30 m/s with charging).

**RG7 · Board slalom lane (VIII, XV.12).** Decisions spaced one beat apart at cruise.
```js
floor(-600, 112, 12),                                                     // 12 m lane
{t:'crate', kind:'nitro', p:[-2.88, 0, -620]}, {t:'crate', kind:'nitro', p:[-3.84, 0, -620]}, // wall left: go right
{t:'speedpad', p:[3, 0, -646], s:[3, 0.2, 4]},                            // reward on the right, 26 m later
{t:'enemy', foe:'hopper', p:[0, 0, -672], range:3, speed:3, nm:'Timed hurdle 26 m later'},
pitGap(-712, 10.5, 12), floor(-722.5, 30, 12),                            // charge gap (XVII.1) after a 40 m empty straight
```
Check: at cruise each decision is visible for ≥ 1.5 s before it arrives; the charge gap fails at
cruise and clears charged; nothing sits on the 40 m run-up.

**RG8 · Vertical climb finale (XI.1, Crash 4 finales).** 12–20 jumps on ≈ 2.3 m tiers with a stable
tier every 2–3 jumps.
```js
for (let i = 0; i < 12; i++) {
  const stable = i % 3 === 2;
  add(stable ? floor(-760 - i * 4, 4, 8, 0, 2.3 * (i + 1))   // stable tier: 4 m deep, 8 m wide
             : {t:'crumble', p:[0, 2.3 * (i + 1), -762 - i * 4], s:[3, 0.5, 3]}); // 2.3 m up each time
}
```
A 2.3 m rise is a full jump on foot (apex 2.85 m) with margin; do not exceed 2.6 m per tier.
Check: the climb can stop on every third tier; a player who waits on a crumble tier falls one tier,
never to the bottom (put fixed floor under the lower half).

---

## Part XX — Review checklist

Run per cluster, gap, hazard, enemy, section and level. A level fails review on any unchecked box.

**Per cluster**
- [ ] It has one named job (Part 0, law 3) and the job is legible from where the player first sees it.
- [ ] Its shape matches the job (III.1); it is not a lone crate unless the job is a steering target,
  landing marker or hidden pickup.
- [ ] Heights are re-measured (XV.2): no "gate" that a double jump or head-bonk defeats.
- [ ] If order matters, the tempting wrong order was played and costs what the design intends.
- [ ] Explosives have a job (V.1–V.2) and a refuge outside 3.25 m of every blast centre.
- [ ] Any crate row is an intended grind line or deliberately broken up (XV.5).
- [ ] Any crate on a fast board line is an intended smash/trip check (XV.4); any crate within 1 m of a
  rail line is an intended speed gate (XV.6).

**Per section (checkpoint to checkpoint)**
- [ ] ≈ 10–12 main-route crates; no empty sections; a checkpoint at every mode change.
- [ ] A new behaviour appears alone on safe ground before it is combined (VI.2).
- [ ] Masks precede the hardest stretch; lives sit on risk, never on the safe line (IV.8).
- [ ] Timing corridors carry no crates or one per safe window (IV.4).

**Per level**
- [ ] The clear route and the all-box route are both designed; their difference is visible (VI.4).
- [ ] Teaching order follows VI.2: vocabulary first, tools and explosives in the first third, tests
  and count traps mid-route, switch structures in the second half, green `!` last.
- [ ] Optional routes hold the hard recombinations; whether the all-box goal needs the no-death route
  is a stated decision (default: it does not).
- [ ] Every arrow has a target; every multi-hit crate supports something; every switch's outlines are
  visible (or deliberately hidden with a signpost).
- [ ] Count traps sit at attractors (IV.7), not in arbitrary corners.
- [ ] Fast lines obey VIII.1: lanes as commands, no explosive on the forced line, boost gates clear.
- [ ] `node tools/crate-placement-report.mjs --levels <id> --json <scratch>/crates.json --md <scratch>/crates.md`
  (without `--json` and `--md` it overwrites the committed audit) shows mean cluster size ≥ 2.5, single
  crates ≤ 20 % of counted crates, no section without crates, no arrow without a target.
- [ ] `npm run check:levels`, `npm run build`, and a browser pass (`/?lite` + one full render) with
  no console errors; checkpoint restore tested after every irreversible crate puzzle.

**Per gap**
- [ ] Its width sits in the band for its intended move (XV.9), measured edge to edge at the real take-off
  and landing heights; a gap that needs a specific move was crossed in the browser at the slowest
  legitimate speed.
- [ ] Its difficulty is named: the coupling (landing occupant, cycle, footing timer, pursuer, low ceiling,
  speed demand), or why it is a step or plain gap. Width is not the only dial (law 13).
- [ ] Landing depth fits the role: coupled 2.5–4.5 m, teaching ≥ 6 m, checkpoint floor ≥ 6 m; the landing
  lip grinds unless it is a stated exception (XVII.2).
- [ ] Committed jumps have run-up: ≥ 3.5 m of flat floor on foot; ≥ 30 m of clear straight before a board
  charge gap (XVII.1).
- [ ] Failure costs what is intended (death, lower route, bonus exit, delay), and respawn returns the player
  before the gap.

**Per hazard**
- [ ] It debuts alone with a waiting spot from which a full cycle is visible (XII.2), and its telegraph has
  contrast against the hero and the ground.
- [ ] Its window is passable: footprint ÷ speed + 0.3 s fits inside the window at every speed the line
  allows; a row is phased for the approach speed (XVII.3) with the right `phase` unit (XV.11).
- [ ] Crumble warnings are ≥ 0.5 s; no lethal hazard sits within one beat after a new enemy or explosive
  lesson.
- [ ] "Keep moving" and "wait" do not share a stretch, except at a deliberate peak beat.

**Per enemy**
- [ ] Its kind debuts on roomy ground off the fast line and away from lethal edges, or right after its
  counter is given (XIII.2).
- [ ] Its placement climbs one rung per appearance (XIII.3), and its role is named.
- [ ] Its counter is readable at the approach speed: a charger's windup is visible before the dash can
  arrive; a floater swoops while the rider is on its rail (XVII.4–XVII.5).
- [ ] On a board line it is a hazard with a counter (contact is a hit), never a surprise at cruise.
- [ ] A tool enemy (turtle shell, crab carcass, enemy step) cannot walk off its strip, and losing it never
  soft-locks the route.

**Per section (geometry)**
- [ ] One new element and about 9 beats (6–12); no main-line stretch longer than one beat (13.5–18 m on foot,
  24–36 m at cruise) without a beat, unless it is a declared breather.
- [ ] Jump runs of 3–5 with a rest one beat long; no-stop runs only from footing or a pursuer; every timed
  run has a fast line.
- [ ] The hardest run sits next to a checkpoint, right after it or closing into it.
- [ ] Any camera-mode change happens at a one-way transition with a checkpoint, and the camera shows the
  axis being tested.

**Per level (geometry)**
- [ ] One hazard family (two at most) climbs debut → repeat → invert → combine; each enemy kind climbs its
  placement ladder.
- [ ] The main line is channelled; width serves arenas and optional routes; chokes sit before mode changes
  and in the finale.
- [ ] `node tools/level-geometry-report.mjs --levels <id> --json <scratch>/geo.json --md <scratch>/geo.md` (without
  `--json` and `--md` it overwrites the committed audit) reports no unaided gap beyond the measured reach,
  no section without a gap, enemy or hazard unless declared a breather, no crumble warning under 0.5 s and
  no enemy first appearance at a lethal edge.

---

## Appendix A — Level map index

Totals are the guide/HUD totals; "mapped" sums the clusters located in the map (gaps are explained in each file). Generated from `docs/crate-bible/data/`.

| Game | Level | Total | Mapped | Routes | Clusters | Puzzles |
|---|---|---|---|---|---|---|
| Crash 2 | [Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) | 62 | 62 | main 30 · secret 27 · bonus 5 | 28 | 6 |
| Crash 2 | [Snow Go](crate-bible/levels/c2-02-snow-go.md) | 74 | 74 | main 64 · bonus 10 · red-gem course 0 | 23 | 6 |
| Crash 2 | [Hang Eight](crate-bible/levels/c2-03-hang-eight.md) | 74 | 74 | main 23 · bonus 11 · gem 40 | 23 | 6 |
| Crash 2 | [Crash Dash](crate-bible/levels/c2-05-crash-dash.md) | 44 | 44 | main 27 · bonus 17 | 15 | 4 |
| Crash 2 | [Snow Biz](crate-bible/levels/c2-06-snow-biz.md) | 124 | 102 | main 37 · bonus 18 · gem 47 | 37 | 6 |
| Crash 2 | [Air Crash](crate-bible/levels/c2-07-air-crash.md) | 102 | 91 | main 59 · bonus 8 · secret 35 · death 0 | 32 | 7 |
| Crash 2 | [Bear It](crate-bible/levels/c2-08-bear-it.md) | 48 | 45 | main 48 | 22 | 5 |
| Crash 2 | [The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md) | 79 | 79 | main 62 · bonus 14 · secret 3 | 24 | 6 |
| Crash 2 | [Bear Down](crate-bible/levels/c2-13-bear-down.md) | 42 | 42 | main 42 | 22 | 5 |
| Crash 2 | [Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) | 88 | 88 | main 33 · bonus 13 · secret 42 · death 0 | 23 | 6 |
| Crash 2 | [Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) | 93 | 89 | main 56 · bonus 37 · secret 0 | 24 | 4 |
| Crash 2 | [Diggin' It](crate-bible/levels/c2-17-diggin-it.md) | 95 | 84 | main 55 · bonus 28 · death 12 | 31 | 6 |
| Crash 2 | [Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) | 155 | 125 | main 103 · bonus 31 · death 21 | 40 | 6 |
| Crash 2 | [Ruination](crate-bible/levels/c2-19-ruination.md) | 84 | 84 | main 35 · bonus 49 · gem 0 | 21 | 5 |
| Crash 2 | [Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) | 69 | 67 | main 33 · bonus 26 · death 10 | 28 | 3 |
| Crash 3 | [Toad Village](crate-bible/levels/c3-01-toad-village.md) | 42 | 42 | main 35 · bonus 7 | 24 | 5 |
| Crash 3 | [Orient Express](crate-bible/levels/c3-03-orient-express.md) | 51 | 51 | main 51 | 24 | 5 |
| Crash 3 | [Bone Yard](crate-bible/levels/c3-04-bone-yard.md) | 66 | 66 | main 52 · bonus 14 · gem 0 · death 0 | 30 | 4 |
| Crash 3 | [Makin' Waves](crate-bible/levels/c3-05-makin-waves.md) | 37 | 37 | main 37 | 24 | 4 |
| Crash 3 | [Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) | 100 | 100 | main 82 · bonus 18 | 34 | 5 |
| Crash 3 | [Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) | 95 | 95 | main 58 · bonus 20 · secret 17 | 33 | 5 |
| Crash 3 | [Tomb Time](crate-bible/levels/c3-09-tomb-time.md) | 98 | 98 | main 54 · bonus 19 · gem-purple 25 · death 0 | 41 | 4 |
| Crash 3 | [Dino Might!](crate-bible/levels/c3-11-dino-might.md) | 112 | 112 | main 61 · bonus 25 · gem-yellow 26 · death 0 | 44 | 6 |
| Crash 3 | [Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) | 107 | 107 | main 79 · left-branch 5 · right-branch 11 · bonus 28 · gem-blue 0 · death 0 | 37 | 6 |
| Crash 3 | [Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md) | 87 | 87 | main 68 · bonus 19 | 37 | 7 |
| Crash 3 | [Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) | 88 | 88 | main 53 · bonus 25 · death 10 | 43 | 6 |
| Crash 3 | [Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) | 87 | 87 | main 49 · bonus 17 · gem-path 12 · gem-return 9 | 37 | 7 |
| Crash 4 | [Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md) | 104 | 104 | main 96 · bonus 8 | 45 | 4 |
| Crash 4 | [A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) | 153 | 153 | main 123 · optional 8 · bonus 22 | 79 | 9 |
| Crash 4 | [Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md) | 136 | 136 | main 88 · gem-path 24 · bonus 24 | 49 | 6 |
| Crash 4 | [Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md) | 196 | 196 | main 145 · bonus 29 · gem-green 22 | 37 | 4 |
| Crash 4 | [Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md) | 139 | 139 | main 117 · bonus 22 | 32 | 4 |
| Crash 4 | [Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) | 187 | 187 | main 160 · bonus 27 | 39 | 4 |
| Crash 4 | [Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) | 153 | 153 | main 120 · bonus 33 | 59 | 6 |
| Crash 4 | [Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md) | 227 | 227 | main 200 · bonus 27 · gem 0 | 71 | 6 |
| Crash 4 | [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) | 152 | 152 | main 118 · bonus 34 | 38 | 5 |
| **All** | **36 levels** | **3650** | **3567** | | **1250** | **193** |

Geometry records per level (Part I.4; the "Geometry, obstacles and enemies" block of each file):

| Game | Level | Platforms | Gaps | Jump runs | Obstacles | Enemy records | Sections |
|---|---|---|---|---|---|---|---|
| Crash 2 | [Turtle Woods](crate-bible/levels/c2-01-turtle-woods.md) | 19 | 16 | 7 | 4 | 14 | 5 |
| Crash 2 | [Snow Go](crate-bible/levels/c2-02-snow-go.md) | 22 | 12 | 5 | 6 | 12 | 5 |
| Crash 2 | [Hang Eight](crate-bible/levels/c2-03-hang-eight.md) | 21 | 12 | 6 | 9 | 9 | 6 |
| Crash 2 | [Crash Dash](crate-bible/levels/c2-05-crash-dash.md) | 16 | 11 | 5 | 10 | 1 | 5 |
| Crash 2 | [Snow Biz](crate-bible/levels/c2-06-snow-biz.md) | 38 | 25 | 9 | 14 | 16 | 6 |
| Crash 2 | [Air Crash](crate-bible/levels/c2-07-air-crash.md) | 25 | 15 | 8 | 14 | 6 | 7 |
| Crash 2 | [Bear It](crate-bible/levels/c2-08-bear-it.md) | 14 | 16 | 6 | 7 | 3 | 4 |
| Crash 2 | [The Eel Deal](crate-bible/levels/c2-10-the-eel-deal.md) | 26 | 12 | 7 | 9 | 8 | 6 |
| Crash 2 | [Bear Down](crate-bible/levels/c2-13-bear-down.md) | 15 | 21 | 12 | 8 | 12 | 4 |
| Crash 2 | [Road to Ruin](crate-bible/levels/c2-14-road-to-ruin.md) | 32 | 18 | 10 | 10 | 8 | 7 |
| Crash 2 | [Hangin' Out](crate-bible/levels/c2-16-hangin-out.md) | 23 | 10 | 7 | 8 | 10 | 7 |
| Crash 2 | [Diggin' It](crate-bible/levels/c2-17-diggin-it.md) | 23 | 18 | 6 | 6 | 11 | 7 |
| Crash 2 | [Cold Hard Crash](crate-bible/levels/c2-18-cold-hard-crash.md) | 57 | 34 | 10 | 21 | 23 | 8 |
| Crash 2 | [Ruination](crate-bible/levels/c2-19-ruination.md) | 39 | 19 | 13 | 17 | 13 | 7 |
| Crash 2 | [Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) | 40 | 19 | 9 | 25 | 30 | 6 |
| Crash 3 | [Toad Village](crate-bible/levels/c3-01-toad-village.md) | 18 | 14 | 5 | 4 | 10 | 4 |
| Crash 3 | [Orient Express](crate-bible/levels/c3-03-orient-express.md) | 15 | 9 | 5 | 6 | 17 | 4 |
| Crash 3 | [Bone Yard](crate-bible/levels/c3-04-bone-yard.md) | 23 | 21 | 7 | 7 | 10 | 7 |
| Crash 3 | [Makin' Waves](crate-bible/levels/c3-05-makin-waves.md) | 11 | 10 | 4 | 5 | 4 | 3 |
| Crash 3 | [Gee Wiz](crate-bible/levels/c3-06-gee-wiz.md) | 24 | 15 | 5 | 9 | 19 | 5 |
| Crash 3 | [Hang 'em High](crate-bible/levels/c3-07-hang-em-high.md) | 29 | 16 | 7 | 5 | 13 | 6 |
| Crash 3 | [Tomb Time](crate-bible/levels/c3-09-tomb-time.md) | 34 | 16 | 15 | 14 | 9 | 7 |
| Crash 3 | [Dino Might!](crate-bible/levels/c3-11-dino-might.md) | 20 | 12 | 8 | 13 | 14 | 6 |
| Crash 3 | [Sphynxinator](crate-bible/levels/c3-16-sphynxinator.md) | 25 | 20 | 9 | 12 | 17 | 9 |
| Crash 3 | [Future Frenzy](crate-bible/levels/c3-19-future-frenzy.md) | 27 | 8 | 9 | 8 | 17 | 5 |
| Crash 3 | [Tomb Wader](crate-bible/levels/c3-20-tomb-wader.md) | 26 | 16 | 9 | 8 | 14 | 6 |
| Crash 3 | [Gone Tomorrow](crate-bible/levels/c3-21-gone-tomorrow.md) | 27 | 9 | 11 | 4 | 18 | 7 |
| Crash 4 | [Rude Awakening](crate-bible/levels/c4-1-1-rude-awakening.md) | 25 | 12 | 7 | 3 | 7 | 9 |
| Crash 4 | [A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) | 33 | 21 | 9 | 9 | 9 | 12 |
| Crash 4 | [Crash Compactor](crate-bible/levels/c4-2-2-crash-compactor.md) | 39 | 17 | 9 | 19 | 7 | 11 |
| Crash 4 | [Jetboard Jetty](crate-bible/levels/c4-3-3-jetboard-jetty.md) | 32 | 13 | 7 | 20 | 9 | 12 |
| Crash 4 | [Draggin' On](crate-bible/levels/c4-4-2-draggin-on.md) | 33 | 14 | 7 | 17 | 8 | 8 |
| Crash 4 | [Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) | 48 | 19 | 10 | 21 | 12 | 13 |
| Crash 4 | [Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) | 58 | 22 | 15 | 14 | 10 | 11 |
| Crash 4 | [Bears Repeating](crate-bible/levels/c4-6-3-bears-repeating.md) | 45 | 22 | 12 | 20 | 11 | 10 |
| Crash 4 | [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) | 33 | 7 | 6 | 15 | 5 | 9 |
| **All** | **36 levels** | **1035** | **571** | **296** | **401** | **416** | **254** |

## Appendix B — Design-function tags

The level maps tag every cluster; the same vocabulary is used in this bible and in
[`STATS.md`](crate-bible/STATS.md).

| Group | Tags |
|---|---|
| Route relation | `ON-PATH` collected by following the route · `EDGE-BAIT` on a ledge or pit edge · `DETOUR` small off-route trip · `BACKTRACK` behind the start or the camera · `HIDDEN` concealed by camera, scenery or darkness · `HIGH` above normal reach (needs a tool) · `LOW` below the path (pit, swamp, water) |
| Structure | `SINGLE` · `PAIR` · `ROW` · `STACK` · `PYRAMID` · `WALL` · `GRID` · `FLOAT-LINE` · `BRIDGE` · `STEPPING` · `SANDWICH` · `COLUMN-BOUNCE` |
| Function | `TEACH` · `TEST` · `REWARD` · `TOOL` · `SUPPORT-ORDER` · `EXPLOSIVE-MIX` · `CHAIN` · `SWITCH` · `OUTLINE` · `NITRO-SWITCH` · `REINFORCED` · `TIMED` · `ENEMY-LINK` · `CHECKPOINT` · `AKU` · `LIFE` · `SPEED-LINE` · `CHASE` · `ROUTE-SPLIT` · `BONUS` · `COUNT-TRAP` · `BLUE-GEM` · `TIME-TRIAL` |

The geometry records (Part I.4) use a second vocabulary. Ids are `P-` platforms, `G-` gaps, `J-` jump
sequences, `O-` obstacles and `E-` enemies, followed by the section id (`P-S1-a`, `G-X-c`).

| Group | Terms |
|---|---|
| Platform roles | `REST` fixed floor between tests · `STEPPING` a stone in a jump run · `LANDING` where a committed jump ends · `SAFE-ISLAND` safety inside a hazard field · `PERCH` a stable spot to watch or line up · `CHECKPOINT-PAD` · `BONUS-PAD` · `ARENA` · `CHOKE` a narrow lane forcing one line · `TIMING-STEP` a step that moves, sinks, flips or is crossed by a hazard |
| Platform shapes | wide floor · corridor · narrow ledge · square pad · round/hex pillar · stepping stones · bridge/plank · log · moving platform · rotating/tilting · sinking/floating · crumbling · phase/timed · bouncy · ice · tar/slow · conveyor · rail · vehicle lane |
| Gap kinds | bottomless pit · lethal water · safe water/mud · lava · spikes · crumble run · floor hole · moving-platform crossing · swing/vine · chasm with bounce · drop-down (plus hurdles, lethal floors and height gates recorded as gaps) |
| Required moves | `plain` · `running` · `held/high` · `spin-extended` · `double` (Crash 4) · `slide-jump` · `crate-bounce` · `enemy-bounce` · `arrow` · `ride` · `swing` · `body-slam drop` (plus mask moves, wall-run and climbs) |
| Jump rhythm | `even` · `syncopated` · `accelerating` · stop-and-go · isolated; `noStop` when stopping is impossible |
| Obstacle placement | `across path` · `flank` · `overhead` · `on platform` · `pursuer` |
| Obstacle counters | `wait-and-go` · `jump over` · `slide under` · `go around` · `destroy` · `outrun` |
| Obstacle roles | `TIMING-GATE` · `LANE-BLOCK` · `PURSUIT` · `AREA-DENIAL` · `RHYTHM` · `TEACH` · `TEST` |
| Enemy archetypes | `static` · `patrol-1D` · `patrol-loop` · `chaser` · `hopper` · `flier` · `projectile` · `shielded/armored` · `burrower/ambusher` · `swimmer` · `pursuer` · `mini-boss` |
| Enemy counters | `spin` · `stomp` · `slide` · `body slam` · `flip-then-spin` · `avoid` · `TNT/blast` · `fling into` |
| Enemy placement | `on line` · `flank` · `take-off edge` · `landing platform` · `moving platform` · `between hazards` · `guarding crate` · `above` · `in pit` |
| Enemy roles | `TEACH` · `TEST` · `GUARD` · `TOOL/STEP` · `PROJECTILE` · `BAIT` · `TIMING-GATE` · `HURDLE` · `AMBUSH` · `PURSUER` · `GATEKEEPER` |
| Camera per section | `into-screen` · `side-scroll` · `toward-camera chase` · `vehicle` · `top-down/aerial` |

## Appendix C — Glossary of guide terms

| Japanese (Famitsu guides) | Meaning |
|---|---|
| 箱 / はこ, はこのかず ぜんぶで NN コ | box(es); "total boxes: NN" (stage header) |
| チェックポイント! はこのかず NN コ | "checkpoint — boxes so far: NN" (Crash 3; includes the C box; a number in brackets adds Nitro) |
| 木箱 · ?箱 · シマ箱 · ↑箱 | wood · question · striped · wooden arrow |
| 1UP箱 · アクアク箱 · C箱 | life · Aku Aku · checkpoint |
| バクダン箱 · ニトロ箱 | TNT · Nitro |
| 鉄ワク箱 | iron-bound (reinforced) crate — body slam only |
| ブロック · ↑ブロック · !ブロック · !ブロック(緑) | steel block · steel arrow · switch · green switch |
| 透明箱 / 隠し箱 | outline ("transparent / hidden box") |
| スロット箱 · タイムストップ箱 | slot crate · time-stop crate (Crash 3) |
| ふつうコース · ひみつコース · ボーナスチャレンジ | normal course · secret course · bonus round |
| ドクロ (コース) | skull (death route; no-death runs only) |
| パーフェクトダイヤ · 隠しダイヤ | clear (all-box) gem · hidden/colored gem |
| ボディプレス | body slam |
| スライディング · スピン | slide · spin |
| ちゅういてん | caution points (the perfect pages' warnings) |

Terms from the geometry pass (hazards, footing and the guides' short POINT advice):

| Japanese (Famitsu guides) | Meaning |
|---|---|
| 木柱 · えんばん岩 · ツララ | wooden up-down pillar (a crusher) · stone disc rolling in a channel · icicles |
| ドッカン地雷 · ドッカン機雷 · 浮遊機雷 | landmine · sea mine · floating mine |
| ボワボワ石像 · 熱い柱 · 毒針 | fire statue · hot pillar · poison dart (trap) |
| シロクマ柱 · 石塀 | polar-bear totem · low stone wall |
| 狭い足場 · 落ちる足場 · 動く足場 · 足場が縦長 | narrow footing · footing that falls · moving footing · long, narrow footing |
| 連続ジャンプ · ピョン!ピョン!ピョン! | consecutive jumps (a run) · "hop, hop, hop" (a three-jump rhythm) |
| 着地に注意 · 早めに着地 · 正確に着地 | watch the landing · land early · land precisely |
| 一気に抜けろ · 迷いは禁物 | go through in one go · no hesitating |
| 火が止まってから · 爆発してから · 止まるのを待て | after the fire stops · after it explodes · wait until it stops |
| 引きつけてから · 引きつけて倒せ | let it come to you · let it come, then strike |
| 加速禁止 · スピン禁止 | no speeding (no speed burst here) · no spinning (spin fails on this enemy) |
| 遠近感をつかめ | judge the depth (a toward-camera jump) |
| チュールを足場に | use the rat as a step |
| ここから横スクロールじゃ | "side-scrolling from here" (a camera change) |
| 余裕だぜ | "easy" — an announced rest beat |
