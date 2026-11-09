# Crate & Gameplay Design Bible

How the Crash Bandicoot series places crates — measured from crate-by-crate maps of real Crash 2,
3 and 4 levels — and how to rebuild that logic in this game, where the hero also skates, grinds
and plows through crates at speed.

**Read this before placing a single crate.** Agents authoring or reviewing levels should treat
Part 0 as binding rules, Parts II–VIII as the reasoning and the precedents behind them, Parts IX–X
as the engine facts and skate patterns, and Part XIII as the review gate.

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
| This engine's real distances and speeds | [Part IX — Translating Crash geometry into this game](#part-ix--translating-crash-geometry-into-this-game) |
| Grinding, smashing and crate rows | [Part X — Skate × crate patterns](#part-x--skate--crate-patterns) |
| What the current levels do differently | [Part XI — Diagnosis of the current game](#part-xi--diagnosis-of-the-current-game) |
| Copyable component recipes | [Part XII — Authoring recipes](#part-xii--authoring-recipes) |
| The checklist a level must pass | [Part XIII — Review checklist](#part-xiii--review-checklist) |
| Every level map | [Appendix A](#appendix-a--level-map-index) and [`docs/crate-bible/`](crate-bible/README.md) |

---

## Part 0 — The laws

These are distilled from 36 level maps (Part I). Each law links to its evidence.

1. **Crates are a second game laid over the route.** Reaching the exit and breaking every box are
   different goals with different skills (Crash 2: 37 % of all boxes sit off the normal course).
   Design both layers on purpose; never let the all-box layer be an accident of decoration. → VI.4
2. **Cluster, don't sprinkle.** In Crash a crate group averages 2.5–3.2 crates and only 12–17 % of
   all crates stand alone. A crate placement is a *decision point* (how do I get these, in what
   order, at what risk), not fruit along a path. → III.1, XI
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
    and a large share of the boxes. The all-box goal must never require surviving the no-death
    route. → VI.4
11. **Count traps live at attractors**: right after checkpoints, right before exits, behind an
    obstacle you just jumped, under ledges, toward the camera. Never in arbitrary corners. → IV.7
12. **Re-measure everything in this engine.** A crate is 1.152 m, the double jump reaches a 3-stack,
    the board smashes crates only at ≥ 12.5 m/s, and a crate row is a rail that breaks as you ride
    it. Copy Crash's *relationships*, never its raw distances. → IX, X

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
  never measured; Part IX re-derives every distance in this engine instead.
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
  collectible stack 4.** Part XI shows where.

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
(see XI.4).

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
- **Decouple the no-death goal from the all-box goal on purpose.** Road to Ruin's death route holds
  0 boxes (the perfect run never needs it); Diggin' It's holds 12 and bypasses half the normal
  course, so a perfect run sweeps that half *backwards*, with checkpoints placed for the loop
  ([Diggin' It](crate-bible/levels/c2-17-diggin-it.md)). Secret routes may hold no crates at all
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

## Part IX — Translating Crash geometry into this game

Crash's grammar survives only if its *distances* are re-measured in this engine. Everything below
was measured in the real Player/Level ([`skate-crate-probe.json`](crate-bible/data/skate-crate-probe.json),
`node tools/probe-crate-skate-rules.mjs`; jump peaks from [JUMP_MOTION_STUDY.md](JUMP_MOTION_STUDY.md)).

### IX.1 The unit

- **One crate = 1.152 m** (`0.96 × CRATE_SCALE 1.2`, `src/crateDimensions.ts`). Level data still
  places crates on the legacy **0.96 m grid**; at build time each touching formation is enlarged ×1.2
  about its own centre, so crates authored 0.96 apart end up touching at 1.152. **Author in grid
  units**: a row is `x0 + i·0.96`, a stack is `y0 + j·0.96`.
- Stack tops above the floor: 1 → 1.15 m, 2 → 2.30, 3 → 3.46, 4 → 4.61, 5 → 5.76, 6 → 6.91.
- Floating crates stay where authored. A crate whose support is destroyed settles onto whatever is
  under its column; Nitro never falls. **Crate tops are not ledge-grabbable**; only platforms and
  walls are.

### IX.2 Vertical reach (feet apex)

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

### IX.3 Horizontal reach (computed from measured airtimes; verify gaps you depend on)

| Move | Airtime (flat) | Distance | In crates |
|---|---|---|---|
| Full jump on foot (9 m/s) | 0.62 s | ≈ 5.6 m | ≈ 4.8 |
| Stomp bounce lid to lid, on foot | ≈ 0.62 s | ≈ 5.6 m | ≈ 4.8 |
| Full ollie at cruise (12 m/s) | ≈ 0.55 s | ≈ 6.6 m | ≈ 5.7 |
| Full ollie at charge maximum (23 m/s) | ≈ 0.55 s | ≈ 12.7 m | ≈ 11 |
| Stomp bounce on the board at cruise | ≈ 0.62 s | ≈ 7.4 m | ≈ 6.4 |

### IX.4 The board against single crates (measured)

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

### IX.5 Crate rows are rails (measured)

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

### IX.6 Crates on an authored rail line (measured)

| Crate on the line | < 12.5 m/s | ≥ 12.5 m/s |
|---|---|---|
| Plain crate | knocked off the rail (a mask absorbs it); crate survives | smashed; the grind continues |
| Mask crate | always pops | pops |
| TNT | knocked off, **not** lit | detonates — rider dies |
| Steel | knocked off unless masked | knocked off unless masked |
| `!` | triggered, no bail | triggered |

### IX.7 Explosions

TNT and Nitro share radius **2.75 m**, growing over 0.35 s (front ≈ 7.9 m/s). The rider dies within
radius + 0.5 m while it grows; crates within ≈ 3.35 m of the centre break (arrow crates are immune,
steel survives, switches flip, other explosives chain). TNT fuse 3 s. Because the front is slower
than cruise, **anything the rider lights while rolling away at ≥ 8 m/s is safe; anything they ride
through is not.** A blast covers about two crates on each side of the explosive.

### IX.8 Crash rules, re-dimensioned

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

---

## Part X — Skate × crate patterns

Each pattern gives its Crash precedent, the engine rule it relies on, a recipe in crate units
(1 u = 1.152 m; author on the 0.96 grid), what a wrong approach costs, and how to verify it.

### X.1 Smash lane — speed is the key
- **Precedent**: ride crates break on contact; the first crates after mounting teach it
  ([Hang Eight](crate-bible/levels/c2-03-hang-eight.md) W1-a, [Orient Express](crate-bible/levels/c3-03-orient-express.md) S1-a).
- **Engine**: smash at ≥ 12.5 m/s contact, trip at 8–12.5, ×0.81 speed per smash.
- **Recipe**: 1–3 single plain crates on a straight or descent, ≥ 5 m apart, entered at ≥ 18 m/s;
  more only with a slope or speed pad between. The first one sits right after a point where speed
  is naturally high (bottom of a ramp), readable ≥ 1.5 s ahead.
- **Wrong approach**: cruising trips on the first crate; on foot the player spins them.
- **Verify**: ride it at cruise (must trip), at charge (must clear), on foot (still collectable).

### X.2 Board stomp chain
- **Precedent**: Crash's crate-to-crate bounce chains; Turtle Woods' chained enemy bounces.
- **Engine**: a board landing on a lid is a stomp (2.87 m bounce, speed kept).
- **Recipe**: single crates (or 2-wide pairs) at equal height ≈ 6 u apart for cruise; the first
  reachable by a full ollie (1 crate high). End on a wooden arrow whose launch reaches a high reward.
- **Wrong approach**: charging smashes the first crate and breaks the chain; tap ollies fall short.

### X.3 One-way grind bridge
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

### X.4 Grind staircase
- **Precedent**: outline staircases over spikes ([Snow Go](crate-bible/levels/c2-02-snow-go.md) S3-c);
  timed staircases to a permanent crate ([Snow Way Out](crate-bible/levels/c4-6-1-snow-way-out.md) S7-a/b).
- **Engine**: grind-jump pop ≈ 2.4 m above the rail reaches a row one crate higher.
- **Recipe**: rows of ≥ 3 crates, each +1 u higher, offset so a plain grind-jump off one row's end
  lands on the next row's start; final row ends at a deck holding the reward. One-way by construction.

### X.5 Peel layers — a permanent rail under a consumable one
- **Precedent**: peel the pile (VII B1); the permanent steel skeleton of Crash structures.
- **Engine**: only open lids form rails; breaking the top layer exposes the row beneath.
- **Recipe**: a steel row with a wood row stacked on it. First pass grinds the wood (pays crates);
  afterwards the steel row is a reusable rail one crate lower. (Alternating wood/steel in one row
  does **not** persist — the steel singles stop touching.)

### X.6 Switch grind
- **Precedent**: the switch builds the way, leading straight onto the next rail
  ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) S6).
- **Engine**: a `!` inside a crate row is flipped by the grind-through and survives.
- **Recipe**: a row ending with a `!`; its outline group forms the next row or platform ahead, visible
  from the row. The line continues only if the rider grinds through the switch.

### X.7 Detonator row
- **Precedent**: TNT as clearer and switch-presser (V.1); the TNT bridge with steel footing
  ([Off-Balance](crate-bible/levels/c4-4-3-off-balance.md) bonus).
- **Engine**: an explosive in a row detonates when reached; ≥ 6.5–7 m/s survives; blasts break
  crates within ≈ 3.35 m and kill enemies within ≈ 3.5 m.
- **Recipe**: 4–6 crates with a TNT second from the end; the target (a guarded crate cluster, an
  enemy on a ledge) within 3 m of the TNT, not on the row.

### X.8 Speed-gated rail
- **Precedent**: a crate on the rail line ([A Real Grind](crate-bible/levels/c4-2-1-a-real-grind.md) R2-d).
- **Engine**: < 12.5 m/s knocks the rider off; ≥ 12.5 smashes through.
- **Recipe**: authored rail after a descent or speed pad; one plain crate on the line; give the slow
  rider a grind-jump over it (pop ≈ 2.4 m) or a parallel rail.

### X.9 Three-height rail pickups
- **Precedent**: Crash 4 puts rail crates above (jump), beside (contact) and below (hang) the rail,
  with "dodge = collect" placement (VIII.5).
- **Engine**: above — floating crates within grind-jump apex (≈ 2.4 m over the rail) break on contact
  or stomp; beside — a parallel crate row is itself a grind line, collected by a rail transfer;
  below — this game has an under-rail hang (Circle on a rail): **verify** how a crate at hanging height
  is treated before building on it.
- **Recipe**: the first crate of each rail move sits where dodging the obstacle puts the rider; the
  test version sits just past the obstacle in the opposite posture.

### X.10 Nitro beside the line, never on it
- **Precedent**: Nitro as lane geometry; no explosives on Crash 4 rails (VIII.1).
- **Engine**: Nitro kills on any contact at any speed (mask absorbs once).
- **Recipe**: Nitro beside skate lanes and rails, readable ≥ 1.5 s ahead (≥ 18 m at cruise, ≥ 35 m at
  charge), with a full lane width (≥ 2 u) of safe line beside it. Never on an authored rail line.

### X.11 Fuse kick
- **Precedent**: TNT as clearer and as pre-lit gate ([Bear It](crate-bible/levels/c2-08-bear-it.md)).
- **Engine**: a 3–12 m/s bump lights a 3 s fuse; the blast front (≈ 7.9 m/s) is slower than cruise.
- **Recipe**: TNT where approach speed is naturally low (after a turn, top of a climb) beside the
  thing it should clear; the exit line leads away from it.

### X.12 The tool speed destroys
- **Precedent**: preserve the tool (VII A4).
- **Engine**: a wooden arrow smashes at ≥ 12.5 m/s contact; landed on from an ollie it launches
  3.77 m (5.92 m held).
- **Recipe**: wooden arrow on a fast line; reward crate whose lid is 4.7–4.9 m above the arrow's
  floor (5–7 m for the held launch) and beyond double-jump reach. Charging into it destroys the tool.

### X.13 Return-trip economy
- **Precedent**: reverse sweeps and bonus returns (VII D1, [Piston It Away](crate-bible/levels/c2-21-piston-it-away.md) P2,
  [Stowing Away](crate-bible/levels/c4-8-2-stowing-away.md) bonus).
- Consumable structures (X.3–X.5) remove the way back; if a room needs a return sweep, author the
  return explicitly and test it from the far end.

### X.14 Board or boots
- **Precedent**: Air Crash takes 30 crates on the board and 29 on foot, each mode with its own grammar.
- **Recipe**: rooms where the board solution (grind, smash) is fast and the on-foot solution (stomp
  chain, careful order) preserves tools or routes. The two costs must differ visibly.

---

## Part XI — Diagnosis of the current game

From the [current-game audit](crate-bible/CURRENT_GAME_AUDIT.md): 27 campaign courses (57.6 km of
route between spawn and gate) and the three puzzle-trilogy levels, built through the real `Level`.
Bonus rooms, races and free-skate parks were not audited.

### XI.1 The numbers side by side

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

### XI.2 Anti-patterns found (with locations)

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
   is exactly X.3); many are unintended 2.3 m rails. Every crate row is a rail — decide it.
8. **Accidental speed checks.** 78 counted crates sit on ≥ 10 % descents (41 of Skystream's 60), where
   a fast board smashes them — or a slow one trips. Make these deliberate smash lanes (X.1) or move them.
9. **Crates on rail lines by accident.** 5 crates within 1 m of an authored rail line (e.g. a life
   crate on a Rolling Bones rail): each is a speed gate (IX.6) whether intended or not.
10. **Stray placements.** Two reused 5-crate stacks float unreachable in Mayfield Mall (filed as a
    separate task); a green `!` with no Nitro to clear (Ripcord River); a green `!` 886 m before the
    gate with Nitro before it (Sunset Safari).
11. **The puzzle trilogy inverts the green `!` rule**, placing it ahead of each Nitro field; Crash
    places it after the Nitro it clears, as the final object.

What already matches Crash: green `!` placement in the campaign; Temple of Embers' switch that
reveals earlier balcony rewards (switch-then-return, VII C2); Carlisle's floating cargo reached by
trampolines and crate chains (vertical access); the puzzle trilogy's density (11 per 100 m, 7 per
section) and its use of order puzzles.

### XI.3 What to change first

1. **Re-cluster before adding.** Merge strings of singles into clusters with a named job at
   decision points (a stack with a target, a wall with a `?`, a pair framing a jump, a row along a
   lane). Target: mean cluster size ≥ 2.5, single crates ≤ 20 % of crates.
2. **Re-section by rhythm.** Place checkpoints so each main-route section holds ≈ 10–12 crates and
   every mode change (boarding, rails, rides, side-scroll, bonus entrance) has one. No empty sections.
3. **Give every tool a target** (or delete it): every arrow has a reward above it inside its reach and
   outside double-jump reach (IX.2); every multi-hit crate supports something.
4. **Stage the explosives**: teach TNT alone with a readable job, then test it; use Nitro as lane
   geometry beside fast lines and as frames around single rewards; green `!` last.
5. **Add order puzzles**: harvest-before-dismantling stacks, sandwiches, peel piles (VII.A–B).
6. **Exploit the skate rules on purpose**: smash lanes on descents, one-way grind bridges, switch
   grinds, detonator rows, speed-gated rails (X). Audit every derived crate rail.
7. **Price rewards**: lives over hazards, masks before the hardest stretch, count traps at attractors.
8. **Close the vocabulary gaps when a level needs them** (runtime work, separate tasks): a
   slam-only reinforced crate kind; optionally Crash 3 slot crates and Crash 4 timed outlines.
   Until then, approximate reinforced crates with multi-hit crates or steel + switch structures.

---

## Part XII — Authoring recipes

Component format (see `CustomComponent` in `src/level.ts`): a crate is
`{t:'crate', kind, p:[x, bottomY, z]}` with `kind` one of `wood, mystery, life, mask, multihit,
bouncy, metalbounce, metal, tnt, nitro, bang, nitrobang`; `outline:true` makes it a ghost until a
`bang` with the same `grp` is hit; `nm` names it for the editor. Positions are on the **0.96 grid**
and touching formations are enlarged ×1.2 about their own centre at build time — so an authored row
of six (5.76 m) builds 6.91 m long, and pits sized for a bridge must use the enlarged length.
Corridors run toward −Z; the floor top is `y = 0` in these snippets. Every recipe ends with the
check it must pass; no recipe is finished until that check has been run in the browser (`/?lite`,
then one full-render pass).

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

**R2 · Arrow tool gate (A4, IX.2).** The floating reward needs the arrow; no plain crate within
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

**R6 · Switch-built crate bridge (C1, X.6).** A switch at the near edge materialises a crate row over
a pit; the row is footing on foot and a consumable grind line on the board.
```js
{t:'crate', kind:'bang', p:[0, 0, -118], grp:41, nm:'Bridge switch'},
...[0,1,2,3,4,5].map(i => ({t:'crate', kind:'wood', outline:true, grp:41,
     p:[0, -0.2, -121 - i*0.96], nm:`Bridge ${i + 1}`})),
{t:'pit', p:[0, -2, -123.5], s:[3, 1, 8.5]},   // sized for the enlarged row (≈ 6.9 m)
```
Check: before the switch the pit is impassable; after it the row is real; grinding it consumes it,
so if the route returns, author the return.

**R7 · One-way grind bridge (X.3).** A row floating over a pit at ollie-catch height between decks.
```js
{t:'platform', p:[0, -0.5, -134], s:[6, 1, 6]},                    // near deck, top y = 0
...[0,1,2,3,4,5,6].map(i => ({t:'crate', kind:'wood', p:[0, 0, -138.5 - i*0.96]})),
{t:'platform', p:[0, -0.5, -150], s:[6, 1, 6]},                    // far deck
{t:'pit', p:[0, -3, -142], s:[6, 1, 9]},
```
Check: a cruise-speed ollie catch grinds the whole row (all crates counted); a 6 m/s catch still
completes it; falling mid-way and respawning restores it; on foot the lids can be walked.

**R8 · Smash lane on a descent (X.1).**
```js
// on a >= 10 % descent after a straight where charge reaches >= 18 m/s
{t:'crate', kind:'wood',    p:[0,   ySlope(0),  -200]},
{t:'crate', kind:'mystery', p:[0.8, ySlope(6),  -206]},
{t:'crate', kind:'wood',    p:[0,   ySlope(12), -212]},
```
Check: cruise (12 m/s) trips on the first crate; charged it clears all three; on foot they are
collectable by spinning.

**R9 · Detonator row (X.7).**
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

---

## Part XIII — Review checklist

Run per cluster, per section and per level. A level fails review on any unchecked box.

**Per cluster**
- [ ] It has one named job (Part 0, law 3) and the job is legible from where the player first sees it.
- [ ] Its shape matches the job (III.1); it is not a lone crate unless the job is a steering target,
  landing marker or hidden pickup.
- [ ] Heights are re-measured (IX.2): no "gate" that a double jump or head-bonk defeats.
- [ ] If order matters, the tempting wrong order was played and costs what the design intends.
- [ ] Explosives have a job (V.1–V.2) and a refuge outside 3.25 m of every blast centre.
- [ ] Any crate row is an intended grind line or deliberately broken up (IX.5).
- [ ] Any crate on a fast board line is an intended smash/trip check (IX.4); any crate within 1 m of a
  rail line is an intended speed gate (IX.6).

**Per section (checkpoint to checkpoint)**
- [ ] ≈ 10–12 main-route crates; no empty sections; a checkpoint at every mode change.
- [ ] A new behaviour appears alone on safe ground before it is combined (VI.2).
- [ ] Masks precede the hardest stretch; lives sit on risk, never on the safe line (IV.8).
- [ ] Timing corridors carry no crates or one per safe window (IV.4).

**Per level**
- [ ] The clear route and the all-box route are both designed; their difference is visible (VI.4).
- [ ] Teaching order follows VI.2: vocabulary first, tools and explosives in the first third, tests
  and count traps mid-route, switch structures in the second half, green `!` last.
- [ ] Optional routes hold the hard recombinations; the all-box goal never requires the no-death route.
- [ ] Every arrow has a target; every multi-hit crate supports something; every switch's outlines are
  visible (or deliberately hidden with a signpost).
- [ ] Count traps sit at attractors (IV.7), not in arbitrary corners.
- [ ] Fast lines obey VIII.1: lanes as commands, no explosive on the forced line, boost gates clear.
- [ ] `node tools/crate-placement-report.mjs --levels <id>` shows mean cluster size ≥ 2.5, single
  crates ≤ 20 % of counted crates, no section without crates, no arrow without a target.
- [ ] `npm run check:levels`, `npm run build`, and a browser pass (`/?lite` + one full render) with
  no console errors; checkpoint restore tested after every irreversible crate puzzle.

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

## Appendix B — Design-function tags

The level maps tag every cluster; the same vocabulary is used in this bible and in
[`STATS.md`](crate-bible/STATS.md).

| Group | Tags |
|---|---|
| Route relation | `ON-PATH` collected by following the route · `EDGE-BAIT` on a ledge or pit edge · `DETOUR` small off-route trip · `BACKTRACK` behind the start or the camera · `HIDDEN` concealed by camera, scenery or darkness · `HIGH` above normal reach (needs a tool) · `LOW` below the path (pit, swamp, water) |
| Structure | `SINGLE` · `PAIR` · `ROW` · `STACK` · `PYRAMID` · `WALL` · `GRID` · `FLOAT-LINE` · `BRIDGE` · `STEPPING` · `SANDWICH` · `COLUMN-BOUNCE` |
| Function | `TEACH` · `TEST` · `REWARD` · `TOOL` · `SUPPORT-ORDER` · `EXPLOSIVE-MIX` · `CHAIN` · `SWITCH` · `OUTLINE` · `NITRO-SWITCH` · `REINFORCED` · `TIMED` · `ENEMY-LINK` · `CHECKPOINT` · `AKU` · `LIFE` · `SPEED-LINE` · `CHASE` · `ROUTE-SPLIT` · `BONUS` · `COUNT-TRAP` · `BLUE-GEM` · `TIME-TRIAL` |

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
