# Crystal Challenge Design Bible

*How Tony Hawk's Pro Skater hides its secret tapes, and how to build this game's crystals the same
way: hard to reach, clearly shown, and reached by clever navigation and the right grinds, jumps,
vert airs and transfers.*

Every level in this game has one crystal. This bible is about making that crystal the level's best
piece of navigation: a perch the player sees, wonders about, and reaches by reading the level's lines
and using the skate verbs well — the way THPS hangs a tape over a halfpipe, off the end of a rebar, on
a wire across a plaza or in the gap between two roofs.

It has three layers, like the [gameplay design bible](GAMEPLAY_DESIGN_BIBLE.md) it sits beside:

1. **The THPS study (Parts I–X).** Route-by-route maps of 36 levels from THPS1–4 and their 2020 and
   2025 remakes, in [`thps-bible/levels/`](thps-bible/levels/), with every secret tape, letter, goal
   object, named gap, unlock and designed line; statistics over them in
   [`thps-bible/STATS.md`](thps-bible/STATS.md); and what the developers said, in
   [`thps-bible/DEVELOPER_EVIDENCE.md`](thps-bible/DEVELOPER_EVIDENCE.md).
2. **This engine (Parts XI–XII, XIV).** What the crystal does, what the camera can show, and how high
   and far every skate verb reaches, measured with the real `Player`
   ([`tools/probe-skate-reach.mjs`](../tools/probe-skate-reach.mjs)); twelve crystal patterns; and eight
   recipes played through with real inputs
   ([`tools/verify-crystal-recipes.mjs`](../tools/verify-crystal-recipes.mjs)).
3. **This game (Part XIII).** Where the current crystals are and what the THPS evidence says about
   them, from [`thps-bible/CURRENT_GAME_CRYSTAL_AUDIT.md`](thps-bible/CURRENT_GAME_CRYSTAL_AUDIT.md).

**How to use it.** Read the laws (Part 0) once. Before placing or reviewing a crystal, pick a pattern
(Part XII), take its numbers from Part XI, start from the closest recipe (Part XIV), and run the
checklist (Part XV). When a number matters, measure it: the probe and the recipe verifier are there
for that.

**Evidence.** No game was played for this work. The maps were transcribed from isometric map renders,
period strategy guides, archive.org longplays and tool-assisted runs, and text guides, with every
record citing its source (codes in [`thps-bible/README.md`](thps-bible/README.md)). Heights in the
THPS study are estimates in metres against in-game references; engine numbers are measured. Where
this bible says "THPS does X", the level ids in brackets are the evidence; where it gives a rule, the
rule is inferred from that evidence unless a developer quote is cited.

## Contents

- [Part 0 — The laws of a crystal challenge](#part-0--the-laws-of-a-crystal-challenge)
- [Part I — What a THPS secret tape is](#part-i--what-a-thps-secret-tape-is)
- [Part II — Showing the tape](#part-ii--showing-the-tape)
- [Part III — Where tapes sit](#part-iii--where-tapes-sit)
- [Part IV — The route](#part-iv--the-route)
- [Part V — Lines and gaps](#part-v--lines-and-gaps)
- [Part VI — Letters, objects and the other collectibles](#part-vi--letters-objects-and-the-other-collectibles)
- [Part VII — Secret areas and unlocks](#part-vii--secret-areas-and-unlocks)
- [Part VIII — The level around the collectible](#part-viii--the-level-around-the-collectible)
- [Part IX — Progression, difficulty and failure](#part-ix--progression-difficulty-and-failure)
- [Part X — What the remakes changed, and what that says](#part-x--what-the-remakes-changed-and-what-that-says)
- [Part XI — This engine: the crystal, the verbs and how far they reach](#part-xi--this-engine-the-crystal-the-verbs-and-how-far-they-reach)
- [Part XII — Crystal challenge patterns](#part-xii--crystal-challenge-patterns)
- [Part XIII — Diagnosis: this game's crystals against the THPS evidence](#part-xiii--diagnosis-this-games-crystals-against-the-thps-evidence)
- [Part XIV — Recipes, played with the real skater](#part-xiv--recipes-played-with-the-real-skater)
- [Part XV — Review checklist](#part-xv--review-checklist)
- [Appendix A — Every secret tape](#appendix-a--every-secret-tape)
- [Appendix B — Tape case studies](#appendix-b--tape-case-studies)
- [Appendix C — The 36 levels](#appendix-c--the-36-levels)
- [Appendix D — Engine numbers at a glance](#appendix-d--engine-numbers-at-a-glance)
- [Appendix E — Glossary](#appendix-e--glossary)

## Part 0 — The laws of a crystal challenge

These hold for every crystal. Each is drawn from the THPS levels (Parts I–X, with level ids) and
checked against this engine (Part XI). Part XV turns them into a review checklist.

1. **One crystal, one idea.** A crystal is the level's single hardest piece of navigation, built
   around one escalation of what the level already teaches: one new height, one commitment, one
   trigger, or one longer chain. Never several at once.
2. **Put it on the level's signature feature.** The tape sits on or over the level's main object or
   tallest landmark (the Warehouse halfpipe, Philadelphia's wire, the College clock tower), never in
   an empty corner and never on the floor of the main route. The crystal is the landmark's crown.
3. **Float it past an edge.** Tapes hang in open air just beyond a launch edge — a coping, a roof
   edge, a wire's end, a window — not on a floor. The edge is the cue and the air is the test.
4. **Show it, then make the player work out the way.** The crystal is seen before it can be reached,
   and the place it is seen from is not the place it is reached from. Seeing is free; reaching is the
   puzzle.
5. **In this engine, show it from at or above its height.** The default camera cannot look up: a
   crystal more than ≈ 3 m above the rider's floor is off screen (XI.2). Tease it from a higher
   vantage (spawn deck, drop-in, roof across the street), or author the level's camera rig.
6. **Reuse the level's own lines, one layer higher.** The route is built from the lines, gaps and
   launchers the level already has, raised a layer: a roof line above the street line, a wire above
   the roofs. No geometry exists only for the crystal except, at most, its final perch.
7. **Teach the last move first.** The move that commits to the crystal appears earlier in the
   level in a safe form — at the spawn, on a letter, on a named gap.
8. **Let the smaller collectibles point the way.** Letters, cash and icons sit on the crystal's line
   or at its start, so collecting them teaches the route.
9. **Height comes from a launcher the player can read.** A quarter pipe at the end of a run-up, a
   kicker with a pad before it, a rail that points at the gap, a lit wall. The launcher is the cue when
   the crystal is out of frame.
10. **Speed is supplied, not hoped for.** If the route needs speed, put a speed source just before the
    commit: a drop from height, a bowl or pipe to pump, a speed pad. THPS1's first tapes take their
    speed from height alone; later ones pump a roof bowl (Downtown) or a quarter pipe (School II) right
    before the launch. Maximum vert belongs to the bonus levels.
11. **Design to the measured envelope with margin.** Use 75% of a measured maximum for early crystals,
    85% mid-career, 95% for experts (XI.6) — and make sure the intended move is *needed*.
12. **Cheap at the launch, costly after the commitment.** A miss before the commit returns the player
    to the start of the attempt in seconds; a miss after it may cost more. Never make the cheap part
    expensive.
13. **A touched crystal counts; plan the respawn.** Mid-air grabs over drops are fair here (a soft
    death keeps the crystal), but the gate must stay reachable from the respawn, and the crystal is
    banked only at the gate.
14. **Give it more than one way up.** Most THPS tapes have an easy and a hard approach, or several
    entries at different prices. One intended route, at least one alternative.
15. **Feed the landing back into the line.** After the crystal, the player lands on or rejoins a
    scoring line, not a dead end.
16. **Unlocks are paid once and shown.** A trigger that opens the way shows its effect where it
    happens (a door opens, a bridge deploys) and stays open for the run.
17. **Escalate across the campaign.** Early crystals: two or three moves, visible, cheap to retry. Late
    crystals: six to ten steps, a blind commitment or a trigger, and a costlier miss.
18. **Engine truths are design rules.** Ollie at the lip (kickers never launch a roll-off); vert airs
    come home; wallride walls on the 90° grid; one wallride per air; balance is a ≈ 1.3 s clock.
19. **Keep the crystal off the main floor.** The fallback crystal 6 m before the gate is a
    placeholder, not a challenge. Every level should author its crystal.
20. **Play it before you ship it.** Verify the intended route collects the crystal and the
    shortcuts you mean to rule out do not, with real inputs (`tools/verify-crystal-recipes.mjs`).

## Part I — What a THPS secret tape is

### I.1 One per level, a goal among goals

Every THPS1–THPS3 career level has exactly one secret tape, listed on the goal screen next to the
score goals, the S-K-A-T-E letters and the level's object goal. THPS1 levels have five goals, THPS2
and THPS3 levels about ten. Competitions (Skate Park Chicago, Burnside and Roswell in THPS1;
Marseille, Skatestreet and the Bullring in THPS2; Rio, Skater Island and Tokyo in THPS3) and the THPS2
bonus levels (Skate Heaven, Chopper Drop) have none: their secrets are a gap, a ramp island or a
secret area. The PS2 THPS4 (2002) had no
tapes at all; its PS1 port hid one in most levels as a non-goal collectible, and the 2025 remake
added a tape goal to most THPS4 levels, which it runs as 10-minute sessions instead of 2-minute
runs (`thps4-college`, `thps4-san-francisco`, `thps4-alcatraz`, `thps4-london`, `thps4-shipyard`).
The 2020 remake kept every THPS1 and THPS2 tape where it was.

The goal list shapes what the tape is for. It shares a two-minute run with five or more other goals,
so it is **a destination, not a hunt**: players take it early (the THPS1 guide tells you to grab the
Warehouse tape first, `thps1-warehouse`) or on the way to something else (`thps1-mall`), and a TAS
collects most tapes 3–36 s after leaving spawn (`thps1-downtown` 5 s, `thps1-downhill-jam` 3 s from the
A, `thps1-streets` 36 s). What takes time for a human is finding and executing the route, not
travelling to it.

### I.2 What the developers said

Neversoft's own statements (DEVELOPER_EVIDENCE.md) frame the tape the same way:

- Mick West compared collecting tapes to collecting stars in Mario 64, and the goal list was
  brainstormed against a drawn level; Scott Pease said the tapes-and-goals structure was taken from
  Diddy Kong Racing.
- Pease (2000) said collectibles were hidden "all over the level and in hard-to-reach places" so the
  levels would be hard to clean out; Chris Rausch wanted constant discovery.
- Aaron Cammarata (2001) and Pease (2002) described goals that change a level's structure — opening
  secret areas, adding geometry that "will change the lines". That is the THPS3–4 unlock tape
  (`thps3-canada`, `thps3-los-angeles`, `thps4-alcatraz`).
- Pease described a base path tuned for weaker players with "insanely tough" pro goals on top; the
  tape sits between the two.
- No developer statement explains *rules* for tape placement (height, concealment). The rules in
  this bible are inferred from the 36 levels.

### I.3 What a tape is not

Across the 27 tape records (22 levels; the THPS4 levels have a PS1 and a 2025 version):

- **Not on a floor.** No tape sits on the ground or on a floor you can simply ride over. Every one is
  in the air past an edge, on a wire, on a high object or behind glass (III).
- **Not in clutter.** Big street levels hide the tape by *district* (the walled-off Brooklyn Banks in
  `thps2-ny-city`, Carlsbad in `thps2-school-ii`), never under props or in a dark corner.
- **Not in a dead end.** The landing feeds back into a scoring line: Monster Grind's landing in the
  Warehouse, Around the Horn below the Canada tape, the bench and plaza after NY's rebar (IV.6).
- **Not a speed test for its own sake.** Most tape routes need moderate speed; THPS1 routes take it
  from height. Maximum vert belongs to the bonus levels (Chopper Drop's height ladder).

### I.4 How tapes changed across the series

| Game | What changed | Examples |
|---|---|---|
| THPS1 (1999) | Tapes over the level's signature feature; speed from height; routes of 2–10 steps; difficulty climbs 1 → 5 over the career | Warehouse sky box, School awning, Mall rods, Downtown roof gap, Downhill Jam podium, Streets Pagoda |
| THPS2 (2000) | Larger levels and districts; the first object trigger (Hangar's helicopter); tapes on the level's signature wire or rail | Hangar helipad, NY Banks rebar, Philadelphia wire, Venice High Wire |
| THPS3 (2001) | Goal unlocks gate the tape route (Canada's generator rope, LA's earthquake); vertical "upper loops" in rafters and window lattices; wallride and wallie steps | Foundry rafters, Canada mountain track, Airport lattice, LA tower |
| THPS4 PS1 (2002) | Tapes as non-goal pickups on roofs and wires | College wire, Kona ridge, Alcatraz water tower |
| THPS 1+2 (2020) | Every tape kept; added guidance (intro camera, painted arrows, near-miss gaps, pickups on the tape line) | Warehouse room camera, Downtown arrow, Streets ski-jump stripes, Mall Across The Light Beam |
| THPS 3+4 (2025) | Tapes added to THPS4 levels, on or beside the tallest landmark, shown in the level-start flythrough | College clock-tower wire, San Francisco hotel terrace, Alcatraz window |

## Part II — Showing the tape

### II.1 What the numbers say

- **Visible from spawn: almost never.** Of the 27 tape records, one is plausibly on the spawn
  sightline (`thps2-venice-beach`, ≈ 30 m ahead), 21 are recorded as not visible, and the rest (PS1
  pickups) are unknown; none is confirmed visible from spawn in the longplays.
  Letters are not much different (12 of 260).
- **First seen on the route, 5–40 m away (median ≈ 20 m).** Of the 23 tapes with a known first
  sighting, 10 appear only once the player is on the route itself (on the launch surface or its
  approach), 7 are seen from below, 2 in the remake's level-start flythrough, and one each after an
  unlock, from a vantage, from spawn and as a silhouette from the floor.
- **How it reads.** A glowing VHS icon, usually against dark sky or a dark wall: "the only lit object
  against a dark starry sky" on the Hangar helipad; "glowing tape icon floating in the night air
  between two dark roofs" in Downtown; a glint at the far end of the Mall's rods. Tapes are placed
  where the background is clean.

So THPS does not rely on spawn sightlines. It relies on three things: the **landmark** is visible
from far away even when the tape is not; the tape is **seen at the right moment** on the route; and
smaller collectibles and named gaps **point at it**.

### II.2 Seven ways THPS shows a tape

| Technique | How it works | Levels |
|---|---|---|
| **Silhouette of its container** | The tape's room or perch is in plain view; the tape itself appears late | `thps1-warehouse` (dark sky box on chains with a lit window over the biggest ramp) |
| **Seen from below, reached from above** | The player sees it from the busy floor line; the route starts somewhere higher | `thps1-school` (awning over the S-K line), `thps1-mall` (A right under the rods), `thps1-streets` (plaza centrepiece), `thps3-los-angeles` (pillar "way out of reach from a ground attack"), `thps4-san-francisco` (terrace seen from the patio) |
| **Seen from its launch** | It appears only when the player is already committed to the right surface | `thps2-school-ii` (1 s after landing on the library roof), `thps1-downtown` (bowl exit), `thps2-ny-city` (while grinding the second bar), `thps4-shipyard` (on arriving on the roof) |
| **On the main sightline** | A teaser in the direction the level invites you to go | `thps2-venice-beach` |
| **Revealed by an unlock** | A trigger opens a door or district; the tape glows the moment you enter | `thps2-hangar` (the west door shows night sky; the icon appears on the pad) |
| **Intro flythrough** | The remakes' level-start camera passes the tape | `thps4-college`, `thps4-alcatraz` (2025); the 2020 Warehouse intro shows the inside of the sky box |
| **Lit pointer** | A light, sign or painted mark points at the launch | Downtown's painted arrow (2020), Streets' striped ski jump (2020), Downhill Jam's yellow-lit rails |

### II.3 Pointers: the small things that say "this way"

- **Letters on the route.** The E hangs over the door the helicopter opens (`thps2-hangar`); A sits
  under the Mall's rods; T floats in Downtown's secret skyway and marks the tunnel; A marks the
  branch to Downhill Jam's high road; K and T teach the College and San Francisco wire moves early
  (VI.1).
- **Icons in the launch air.** A 200-point icon floats in the Mall's launch arc; a 500 floats in
  Downhill Jam's fastplant gap; three 200 icons mark School's hardest way onto the awning. The THPS1
  guide calls bonus icons signposts.
- **Gap names.** Downtown's T 2 T, Secret Tunnel Entrance, Tunnel Gap and Roof 2 Roof give the route
  away in order; Skate Heaven's "Time 2 Feed the Volcano!!!" and "Feed Me!!!" spell out what to do.
- **The wire itself.** A wire or rail leads the eye from its start to the tape (`thps2-philadelphia`:
  "the wire leads the eye to the planter where it starts").

### II.4 Hidden on purpose

Some tapes are meant to be found, not seen. NY City hides its tape in a walled district with three
entries at different prices (a low wall, a fallen pole, or the subway once five tokens are
collected); School II's tape is the doorway into a hidden area; Downhill Jam's sits on a high road
that branches off at the A. Each of these hidden tapes has a pointer at its entrance (the tokens and
subway, the planter launch, the A).

### II.5 What this means here

This engine's camera cannot look up (XI.2), so two THPS techniques need care: **seen from below**
does not work in the default rig (a crystal more than ≈ 3 m above the rider's floor is off screen),
and the **intro flythrough** does not exist. The other techniques transfer directly:

- Show the crystal **from a vantage at or above its height**: the spawn deck, a drop-in, a roof across
  the street, the top of the run-in, an earlier ledge. THPS already does this whenever a tape is
  seen from its launch or from a higher route (School II, Downtown, Shipyard).
- Make the **landmark** visible from the main route and let it carry the promise: a tall tower, a
  wire strung high over a plaza, a lit glass room.
- Put a **letter-equivalent** (wumpa line, crate row, colored gem, comboorb) on the route and an
  **icon-equivalent** in the launch air.
- For arena levels built around crystal hunts, author a `cameraRig` (XI.2) so "seen from below"
  works as in THPS.

## Part III — Where tapes sit

### III.1 The placement families

| Family | What it is | Tapes | Share |
|---|---|---|---|
| **Wire, rail, pole or rafter** | On or just above a wire, rod, rafter, pole or rail high over the floor; collected while grinding or by a hop | Mall rods; Philadelphia wire; Venice High Wire; Foundry rafters; Canada mountain track; Suburbia flagpole; Airport window lattice; College clock-tower wire (2025); College and London wires (PS1) | 10 |
| **On a high roof or landmark top** | On a terrace, ridge, tower top or water-tower rim | LA tower pipe; San Francisco terrace (2025 and PS1); Kona ridge (PS1); Alcatraz water tower (PS1); Shipyard roof block (PS1) | 6 |
| **Past an edge** | In open air just beyond the end of something you ride: an awning, a rebar, a duct, a window | School awning; NY rebar; Alcatraz window (2025); Shipyard duct (2025) | 4 |
| **Mid-air over a gap** | In the middle of a roof gap or a jump over a landmark | Downtown roof gap; School II roof gap; Streets over the Pagoda | 3 |
| **Above vert** | Above a coping, reached by a vert air | Hangar helipad; London upper roof (2025) | 2 |
| **Inside a room or on a podium** | Behind glass or on a perch in a hidden pocket | Warehouse sky box; Downhill Jam podium | 2 |

Three things stand out:

1. **The edge is the cue.** In three families out of six (wire end, past an edge, mid-gap) the
   tape hangs exactly where a ridden surface stops. The player sees the end of the awning, the end of
   the rebar, the end of the roof, and the tape says "keep going".
2. **Wires dominate.** A wire is a line, a balance test and a pointer at once, and it lifts the route
   into a layer the floor cannot reach. Wires, rails, poles and rafters hold 10 of the 27 tapes, the
   most common perch in all four games, and 24 of the 26 known routes include a grind of some kind.
3. **The landmark is the crown.** Every THPS 3+4 remake tape is on or beside its level's tallest
   landmark, and most THPS1–2 tapes are over the level's signature feature (the Warehouse halfpipe,
   the School awning, the Mall's hanging rods, the Streets Pagoda).

### III.2 Height

Heights are estimates (the sources give no side views), but they cluster clearly:

| Band (above the ground directly below; midpoint of the estimate) | Tapes | Examples |
|---|---|---|
| 3–5 m | 2 | NY rebar end, Mall rods |
| 5–8 m | 13 | Warehouse room, School awning end, Hangar, School II roof gap, Philadelphia wire, Venice wire, Streets, Downhill Jam, Foundry, Suburbia, Airport, Kona and London wires (PS1) |
| 8–12 m | 2 | San Francisco terrace (2025), Shipyard duct (2025) |
| 12–25 m | 6 | Downtown roof gap, Canada track, LA tower, College wire (2025), Alcatraz window (2025), London roof (2025) |

The median is ≈ 6.8 m over the 23 tapes with an estimate (the PS1 pickups mostly have none).

**Height above the take-off is small.** Measured from the surface the final move leaves (median
≈ 0.5 m over 22 tapes), twelve are 0–3 m up — at the apex of the last move or just under it — and
eight are *below* the launch: Streets is taken 8–12 m below the ski-jump lip, Venice 1–3 m below the
roof edge it is dropped from, Shipyard 0.5–1.5 m below the duct it rolls off, and the Mall, Downhill
Jam, Foundry, Suburbia and College (2025) tapes are caught at or below the surface the rider jumps or
grinds down from. Only two (Philadelphia's wire, the Airport lattice) sit more than 3 m above it. The height is in the climb, not in the last jump.
That is the THPS answer to "how high": **as high as the level's upper layer, and only a little
higher than the surface the route reaches.**

### III.3 Above vert

Only two tapes need a straight vert air (Hangar, London 2025), and both are easy airs (2–3 m above
the coping). THPS keeps big vert for the bonus levels: Chopper Drop's helicopter and its 100/200/400
height ladder. When vert does appear on a tape route it is usually a *speed source* (Downtown's roof
bowl, School II's quarter pipe, Canada's log loader) or a *transfer* (the Warehouse's Over the Pipe).

### III.4 Mid-air and past the edge: the commitment tapes

Tapes in mid-air are only ever collected by a committed move: you cannot stop under them. School II's
tape hangs in the gap between the library roof and the East Wing; Downtown's between two roofs over
the start alley; NY's off the end of a drooping rebar. The generosity is in the catch, not the
target: Downhill Jam's tape sits over four parallel rails, Streets' over a whole glass roof that you
fall through, NY's landing is a plaza.

### III.5 Rooms, districts and podiums

The Warehouse's sky box is a room hung over the halfpipe with glass at both ends of the line (the
start window and the box's window); you crash through the glass to collect it. Downhill Jam's podium
is a high road beside a one-way course. NY's Banks and School II's Carlsbad are districts. All of
them have a visible boundary (glass, wall, the high road's edge) that says "inside here".

## Part IV — The route

### IV.1 How long, how many moves

| Measure | Tapes | Typical | Range |
|---|---|---|---|
| Route steps (numbered moves from a natural start) | 26 | median 7 | 2 (PS1 College wire) – 11 (Canada) |
| Distinct moves per route | 26 | median 4 | 1 (Shipyard 2025: roll off a duct) – 7 (LA, Suburbia) |
| Route length (THPS1, measured on the maps) | 6 | 100–160 m | 40–50 m (Warehouse) – 160 m (School) |
| Human time, natural start → tape | 15 | 15–30 s | 6–8 s (Warehouse) – 45 s (Mall, from spawn) |
| TAS time from spawn | 6 | 5–36 s | 3 s (Downhill Jam from the A) – 64 s (Airport) |

The length grows across a career, not across a game: THPS1 goes from 2–3 moves (Warehouse) to 5–6
(School) to 6–7 including a timed hop (Mall), and Downtown, Downhill Jam and Streets run 9–10 steps
with six distinct moves each.

### IV.2 The chain every long route follows

The long THPS routes share one shape (it is clearest in Downtown, Downhill Jam, Streets and Canada):

1. **Entry trick** — a move that gets you off the floor line and into the route: Downtown's truck-bed
   kicker through a window, Streets' corner quarter pipe into the trench, Canada's tree climb.
2. **Corridor** — a hidden or raised path: Downtown's tunnel and skyway, Streets' building walkways,
   Downhill Jam's high road, LA's broken freeway, Canada's walkways.
3. **Speed source** — where the route converts height or pumping into the speed the last move needs:
   Downtown's roof bowl, Streets' ski-jump drop, Downhill Jam's gravity, School II's two pumped airs,
   Warehouse's drop from the start room.
4. **Commit** — one launch that cannot be taken back: Roof 2 Roof, Pagoda Gap, the fastplant over gap 3,
   the planter launch onto the library roof, the blind ollie onto the Mall's rods.
5. **Capture** — the tape, usually mid-air or on a rail, often with a generous catch underneath.
6. **Exit** — a landing that rejoins a line (VI.4).

Short routes compress the chain: Warehouse is speed source (drop-in) → commit (over the pipe) →
capture; Hangar is trigger (blade grind) → corridor (door) → commit (one vert air).

### IV.3 The moves

Moves recorded on the 26 tape routes with a known route (each counted once per route; from
`thps-bible/data/tape-index.json`):

| Move | Routes | Notes |
|---|---|---|
| Any grind (rail, ledge, wire, rail transfer) | 24 (92%) | the backbone: wires, rods, rafters, rebar, sign rails, poles |
| Ollie (incl. ollie off an edge) | 16 (62%) | the commit move on half the routes |
| Vert air | 14 (54%) | mostly as a speed source or a transfer, rarely the capture |
| Transfer (pipe or roof to something else) | 10 (38%) | Over the Pipe, Roof 2 Roof, Fountain Gap, Pickaxe Sluice |
| Ledge | 9 (35%) | roof edges, sign rails, walkways |
| Kicker | 8 (31%) | truck bed, plywood kicker, ski jump, planter |
| Wire | 8 (31%) | Philadelphia, Venice, College, London, LA's cable up |
| Rail transfer (rail to rail) | 5 (19%) | the Mall's timed hop, NY's blind hop to the hidden bar |
| Unlock | 5 (19%) | Hangar, Canada, Suburbia, LA, Alcatraz (2025) |
| Break glass | 4 (15%) | Warehouse, Downtown, Streets, Suburbia |
| Manual | 4 (15%) | links: School's awning, NY's El, Venice's ledge-to-wall |
| Wallride / wallie | 3 (12%) | Airport, San Francisco (2025), Kona (PS1) |

What is **absent** matters as much: no tape route needs a special trick, and the remakes' tape routes
avoid THPS4's new moves (skitching and the wallplant drive other goals instead). The tape tests
navigation with the basic verbs.

### IV.4 Speed

Most tape routes need moderate speed. THPS1 routes run downhill, so the level supplies the speed
(Warehouse's start room is the highest floor in the level; School's awning and pipe descend; Downhill
Jam is a hill). Where a route needs speed on the flat, it puts a speed source just before the commit:
a bowl (Downtown), two pumped airs (School II), a ski-jump drop (Streets). "Maximum" speed appears
only where gravity provides it (Downhill Jam) or where the route ends in a long gap (Downtown,
School II).

### IV.5 Commitment and generosity

- **One commit per route.** Before it, misses are cheap and retries short; after it, the attempt is
  decided.
- **Blind commits come late.** The Mall's ollie onto the rods is "almost blind" (the rods appear only
  once airborne); Downhill Jam's fastplant leaves "only seconds to make adjustments"; NY's second
  rebar is hidden until you are on the first. These are career positions 3, 6 and 4.
- **The catch is generous.** Four parallel rails under the Downhill Jam tape ("any rail = tape"), a
  whole glass roof under Streets', a plaza under NY's, the halfpipe under the Warehouse room (a short
  jump lands you in a second route to the room).

### IV.6 Two ways up, and the expert shortcut

Every THPS1 tape has an easier and a harder route (School has three graded ways onto the awning, the
hardest marked with three 200-point icons), NY City has three entries at different prices, College
(2025) has a teleport door and a harder uphill rooftop route, Foundry's tape is the midpoint of an
upper loop reachable from both ends, and Venice has a precise ground route (table to wire) and a
forgiving roof route. Tool-assisted runs show the expert shortcuts the designers left open: a
wallride up Downtown's alley wall straight to the roofs, a fastplant from below onto the Mall's rods,
a boneless-wallride-wallie climb of LA's tower. **Access, not distance, sets a tape's difficulty**
(T2's observation): the TAS reaches Downtown's tape 5 s after spawn because it found a different way
up, not because it skated faster.

### IV.7 One layer higher

The route is the level's main line raised a layer. School's tape route (roof → AC → pipe → awning)
is a copy of the stair line underneath it. Airport's tape rail sits above the flag rail and three
"class" gap rails on the same window wall. LA's tape route is the roof chain above the street the
earthquake lap runs round. The goals **rehearse the tape on the same geometry one tier lower**.

## Part V — Lines and gaps

### V.1 Lines

The 36 levels record 322 designed lines (7–11 per level); four in five (79%) carry at least one
collectible.
Lines are linked mostly by grinds, ollies and manuals, with reverts and wallrides joining vert to
street. The tape route is always one of the level's lines — often the one the level is famous for
(Philadelphia's wire, the Warehouse's Over the Pipe, the Mall's rods) — and the tape is the **peak of
a scoring line, not a dead end**: NY's tape sits between Re-Rebar and the plaza landing, with four of
the Banks' five cash icons on the approach; Philadelphia's sits between Fly by Wire and the roof.

### V.2 Named gaps

| Measure | Value |
|---|---|
| Named gaps recorded | 1,427 across the 36 levels |
| On a collectible's route | 467 (one in three) |
| Points (where recorded, 1,153 gaps) | median 200, most 100–500, up to 5,000 |

The most common kinds are rail transfers (16%), over-object (10%), ledge-to-ledge (10%), lip (8%),
channel (7%) and kicker (6%) gaps; secret-area gaps are rare (4%) but almost all of them (48 of 55)
lie on a collectible's route, and roof and wire gaps are on one about half the time (STATS.md). Gaps do three jobs for collectibles:

1. **They confirm each link.** In THPS3 every step of a tape route is a scored gap (Airport's "1st Class
   Grind!!", LA's Overpass Leap → Don't Fall!!! → Bustin' Cherries!), so the game tells the player the
   line is right as it is skated.
2. **They name the secret.** Downtown's T 2 T, Secret Tunnel Entrance and Roof 2 Roof; School II's
   "2 Da Roof!!!" and "Flyin' The Flag!"; Skate Heaven's "Feed Me!!!".
3. **They grade one object.** The Warehouse taxi launches to three destinations worth 600, 500 and
   1,000; Airport's Economy/Business/1st Class rails; Tokyo's Wire Ridin' 1–3. One prop serves beginners
   and experts, and the tape is usually the top rung.

### V.3 Transfers

Transfers — air from one ramp or surface to another — are the THPS move that turns a pipe into a
door. On tape routes they appear as pipe-to-deck (Warehouse's Over the Pipe into the sky box), roof
to roof (Downtown's Roof 2 Roof, Streets' Fountain Gap), and a staircase of vert transfers (Canada's
Load and Go → Smooth as Silk → Pickaxe Sluice). In this engine a straight vert air comes home, so
pipe-to-deck transfers need a carve off the end of a quarter pipe (recipe C8) or a street launcher
(XI.3, XI.5).

### V.4 Long rails and wires

The wire tapes (III.1) are also the longest grinds in their levels: the Mall's rods (30–40 m, ≈ 4 s),
Philadelphia's uphill wire (4 s), College's clock-tower wire. A long rail is a **balance test** in
THPS, and in this engine too (an uncorrected grind tips off after ≈ 1.3 s). The tape is placed past the
point where balance starts to matter: 60% along Philadelphia's wire, at the far end of the Mall's
rods.

## Part VI — Letters, objects and the other collectibles

### VI.1 Letters teach the route

| Pattern | Levels |
|---|---|
| **One letter per landmark**, each asking for that landmark's basic move: a tour of the level and a list of its verbs | `thps1-warehouse` (S kicker gap, K back quarter pipe, A taxi, T halfpipe, E upper deck), `thps2-hangar` (each letter on a named gap of a different landmark) |
| **Letters trace one line**: a loop, a sweep, or course order | Warehouse loop; School's single east-to-west sweep; Downhill Jam's S-K-A-T-E in spelling order down the hill |
| **A letter shares the tape's space** | Warehouse T on the tape's arc; School S and K under the awning; Mall A under the rods; Downtown T in the skyway |
| **A letter marks the access** | Downtown T marks the tunnel; Downhill Jam A marks the branch to the high road; Hangar E over the door that opens |
| **A letter teaches the tape's move earlier** | College K on a power line, San Francisco T on a wire over water (2025); Airport's letter above the same doorway launcher |
| **Near spawn the letters teach the launcher; the last letters lead to the tape's district** | THPS3 career levels (T7) |

Letters sit lower than tapes (median ≈ 3 m against ≈ 6.8 m) and are rarely visible from spawn (12 of
260), but they are on lines: half of all letters are reached by a grind and a third by a vert air.

### VI.2 Object goals are curricula

The THPS1 object goals each teach one family of moves on five different props: the Warehouse boxes
teach five ways onto a ledge, School's tables teach grinds, the Mall's directories are smash-through
gates. THPS2's cash is hidden "in hard-to-reach places" (Pease) and the 100% cash goal pulls players
into every secret area; THPS3's stat points and decks move with the skater group, while the tape
never moves (T7). Bonus icons (100/200/500 discs) are **signposts** — the THPS1 guide says the 500s
mark the 1,000-point lines — and one often floats in a tape's launch air (the Mall's 200).

### VI.3 C-O-M-B-O letters

THPS4 adds C-O-M-B-O letters, collected in one combo; THPS3 has none (its big addition is the revert),
and the 2025 remake brings COMBO lines to the THPS3 levels as pro goals: single grind → hop → manual
chains laid on the tape approaches, and a COMBO ladder on the Airport's south lattice. They are a line
laid out as collectibles, and the closest THPS analogue to this game's combo orb (`comboorb`).

### VI.4 The landing feeds back

Every tape landing rejoins a line: the Warehouse room's far deck is where Monster Grind ends, School's
landing is next to K and table 2 where the letter line continues, the Canada tape sits at a fork whose
exit drops into the Around the Horn goal, Philadelphia's wire ends at the roof route to the valve. A
crystal should end the same way: on a line, not in a corner.

## Part VII — Secret areas and unlocks

### VII.1 Kinds of unlock

| Kind | THPS examples | Needed for the tape |
|---|---|---|
| **Break the glass** | Warehouse start window and sky box; Downtown's truck-bed window into the tunnel; Streets' Pagoda roof | part of the route |
| **Ride an object** | Hangar: grinding a rotor blade makes the helicopter take off and opens the west door to the helipad | yes |
| **Complete a goal** | LA: grind four rails round the library and the earthquake breaks the freeway into a road to the roofs; Alcatraz (2025): Release the Prisoner | yes |
| **Pull a switch** | Canada: grinding the rope by the generator raises the log loader | yes |
| **Collect a set** | NY City: five tokens open the subway, which lands you at the foot of the tape's road (one of three entries) | optional |
| **Grind a decoration** | Philadelphia: an overhead line knocks down telephone poles and opens a hidden skatepark; Skater Island: the pirate flag opens the beach and ship; Tokyo: a lap of the high cables breaks the giant sign | not for the tape |
| **Teleport** | College (2025): the door at the back of the clock tower drops you at the top, on the wire | a shortcut |

Of the 157 unlock records across the 36 levels, 23 list a tape among what they open (break-glass
entries and optional keys included); five tapes cannot be reached at all without one (Hangar, Canada,
Suburbia, LA, Alcatraz 2025). Unlocks persist for the run (and
in THPS3, sometimes across runs: LA's broken freeway stays broken), so the cost is paid once and a
two-run plan fits the two-minute timer.

### VII.2 Rules the unlock tapes follow

1. **The trigger is on the level's biggest prop or a visible landmark** (the helicopter, the library's
   four rails, the generator).
2. **The effect is visible where it happens**: the helicopter flies off and the door opens on a
   starry sky; the freeway breaks; the log loader rises.
3. **The trigger and the tape are close in route**: Hangar's trigger-to-tape time is 12 s.
4. **Goals converge on the trigger**: Hangar's hangtime kickers reach the blades and a $50 sits on the
   blade line.
5. **Events add and remove lines**: LA's quake opens the roof route and closes one gap that only works
   before it.

### VII.3 Secret areas without a tape

Competition levels and bonus levels keep their secrets in areas, not tapes: Skate Heaven's volcano
island, Tokyo's Neon Freeway behind the giant sign, Rio's hidden pool with all three decks, Skater
Island's pirate ship, Roswell's secret pool room (Pool Grind, 2,000 points), Marseille's fountain room
behind a dead-tree warp (six of its eight cash icons), Skatestreet's two locked yards, the Bullring's
hidden bull channel. These are worth studying as *rooms to discover*:

- each opens from something ridden — a gutter, cables, a flag, a specific rail used as a key
  (Skatestreet's van key is the curved rail behind spawn);
- each has a gap name or on-screen text that says what to do or confirms the find ("Where am I?");
- the hard spots are **architectural tops**: Skate Park's ceiling girders over the halfpipe (Rafter
  Rail 1,000; Over The Rafters 2,000), Burnside's bridge girder, Marseille's crossbar over the hip, the
  Bullring's lighting wires 8–10 m up — and the signature hard move is a **vert air into a grind on a
  thin overhead bar**, with a speed source right beside it;
- the pickup nearest the spawn (6–8 s away) teaches the verb the secret needs, and the remakes hang
  their logo and plush pickups on exactly these spots.

In a contest a fall costs judges' points, never position, and keys persist across heats, so players
spend one of three heats exploring. The crystal analogue: a skate arena's crystal can sit on its
"rafters" — a high bar over its biggest ramp — reached by a vert air into a grind (P1 into P6).

### VII.4 Unlocks in this engine

| THPS trigger | Engine equivalent |
|---|---|
| Break glass, smash through | crates and breakable scenery on the line; a crate wall as the "glass" of a room |
| Ride an object to open a door | `!` crate in a group (makes `outline` crates solid: a staircase or bridge appears), `spinbridge` (spin to deploy timber; latches until reset) |
| Prove a move to get through | a `trickgate` is a wall with a condition: its aperture lets you through only while you perform its named deck trick, on every crossing; a `trickrail` can be ground only once its trick has started |
| One-way door into a secret area | `returnportal` (one-way, optionally `airOnly` — enter it in the air), `crumble` pads that fall away behind you |
| Moving object | `mover` platforms, travelling `rail`s, `ropeswing` |

Keep the THPS rules: the trigger on a visible prop, the effect visible where it happens, trigger and
crystal close in route, and the opening held for the run (outline crates stay solid once their `!`
crate has made them; a spin bridge without a `hold` time stays deployed until the level resets). A
trick gate is different: it is a test repeated at every crossing, not a door that stays open, so use
it as a skill gate on the route rather than as the unlock.

## Part VIII — The level around the collectible

### VIII.1 Size and shape

| Shape | Levels | What it does to the tape |
|---|---|---|
| **One room, a loop** | `thps1-warehouse` (≈ 50 × 45 m), `thps2-hangar`, `thps3-foundry` | Every goal lies on one short lap (the TAS does the Warehouse in a 15-second loop); a miss costs one more lap |
| **Campus or open street** | `thps1-school` (≈ 110 × 90 m), `thps2-school-ii`, `thps2-venice-beach`, `thps2-philadelphia`, THPS3 and THPS4 streets | Districts and layers; the tape sits in an upper layer or a district, with several ways in |
| **One-way course** | `thps1-mall` (300–400 m), `thps1-downhill-jam` | The tape hangs off a branch or a high road; a miss loses it for the run |
| **Big free-roam map** | THPS4 (10-minute remake runs) | Shortcuts and locks (teleport door, first building from spawn, an island-touring goal) instead of harder moves |

### VIII.2 Layers

Every career level is built in layers — ground, ledges and stairs, roofs, wires and beams, rafters or
catwalks, and closed rooms — and the tape sits in the top layer the level offers at that point in
the career. The THPS1 sequence is the template: Warehouse adds one suspended room above the floor;
School adds a roof-and-awning layer over the stair line; the Mall hangs rods over the hall; Downtown
puts its tape between two rooftops; Streets climbs three buildings to drop onto a centrepiece.

### VIII.3 Spawn and the opening drop

THPS spawns are often the highest floor in the level, and the first move converts that height into
speed: the Warehouse start room ("the highest floor surface") feeds the right entry ramp and the
tape jump; the Hangar's dark start corridor drops into the halfpipe under the S; School starts under a
canopy that teaches the awning drop. Spawn faces the level's main line, not the tape: the tape is
usually *behind or above* the first view, and the first letter is straight ahead (Hangar S "visible
at the top of the screen 3 s after spawn"; NY S on the first wall line).

### VIII.4 Districts and entries

Large levels split into districts joined by a few entries, and hide a tape in one district. NY City's
Banks have three entries at three prices; School II's Carlsbad is entered from the tape's own roof
gap ("a miss drops you into that new area anyway"); Downhill Jam's high road branches at the A and
rejoins at valve 4. The rule is the same at every scale: **close in space, far in route** — Downtown's
tape hangs directly over the spawn alley and is the last stop of a spiral route.

## Part IX — Progression, difficulty and failure

### IX.1 Difficulty across a career

Recorded tape difficulties (1–5, with reasons in the level files):

| Game | Tape difficulties in career order |
|---|---|
| THPS1 | Warehouse 1 → School 2 → Mall 3 → Downtown 3 → Downhill Jam 5 → Streets 4 |
| THPS2 | Hangar 2 → School II 4 → NY City 3 → Venice 3 → Philadelphia 2 |
| THPS3 | Foundry 3 → Canada 4 → Suburbia 3 → Airport 3 → LA 4 |
| THPS 3+4 (THPS4 levels) | College 2 → San Francisco 3 → Alcatraz 3 → Shipyard 2 → London 3 |

Difficulty rises fastest at the start of THPS1 and then plateaus at 3–4, with the hardest tapes in the
middle-late career (Downhill Jam 5, Streets 4, School II 4, LA 4). What grows is the *kind* of
challenge: THPS2's first three tapes go knowledge (Hangar's trigger) → commitment (School II's roof
gap) → chaining (Venice's 6–8-move route); THPS3's go one launch plus balance (Airport) → an event plus
a four-link roof chain (LA) → a full cable lap to a secret area (Tokyo's sign).

### IX.2 What a miss costs

| When | Cost | Examples |
|---|---|---|
| Before the commit | seconds; the route's start is close | Hangar blade miss 3–5 s; Warehouse short jump 5–10 s (lands in the halfpipe, itself a second route); NY hop 8–10 s; Philadelphia 5–10 s |
| After the commit | the climb back | School awning 15–20 s; Venice 20–30 s back to the highest roof; Downtown 40–50 s via truck, tunnel and bowl; LA a 3–5 storey fall |
| On a one-way course | the run | Mall and Downhill Jam: a new run, 60–75 s back to the branch |
| In a 10-minute remake run | proportionally little | THPS4 remake tape legs take 18–32 s of 600 |

The pattern is consistent: **misses are cheap at the launch and expensive after the commitment, and
they get more expensive with altitude and with career position.** Water is the fail plane in San
Francisco and Alcatraz; elsewhere a miss drops you to a lower layer, not out of the level.

### IX.3 How long a tape takes

Human routes take 15–30 s from a natural start (6–8 s for the Warehouse), inside a 120 s run that also
holds four to nine other goals. The tape fits beside them: players take it early or on the way, and the
THPS1 guide notes that all five Streets tapes "in one run" is impossible. A crystal route of 10–30 s is
the THPS-sized challenge; anything longer is a level in its own right.

## Part X — What the remakes changed, and what that says

### X.1 THPS 1+2 (2020): keep the tape, add the hint

Vicarious Visions kept every THPS1 and THPS2 tape and route (map layouts were "the most important
thing to keep the same"). What it added is guidance:

- an intro camera shot inside the Warehouse's sky box;
- a painted arrow on Downtown's launch ramp and stripes on Streets' ski jump;
- near-miss gaps that reward almost making it (the Mall's Across The Light Beam, School's Down The
  Awning);
- new pickups placed on the tape lines (a School textbook above the AC unit).

The lesson is that the 1999 silhouettes were considered too subtle for new players, but the routes
were not too hard: the fix was to point, not to simplify.

### X.2 THPS 3+4 (2025): tapes for the THPS4 levels

Iron Galaxy added tapes to the THPS4 levels and placed every one on or beside the level's tallest
landmark (the College clock tower, the San Francisco hotel's top terrace, the Alcatraz cell block and
water tower), shown in the level-start flythrough. Several reuse 2002 secrets: the PS1 port's tapes sat
on the same hotel ledge and water tower, and the College tower wire was already a named gap. The
routes avoid THPS4's new moves and use grinds, quarter-pipe transfers, wallride + wallie, a window rail
and a teleport door. Iron Galaxy also reworked Alcatraz's S-K-A-T-E line around whether players
naturally reach where the line starts, and kept bugged gaps because players remember them.

### X.3 Lessons

1. **Routes age well; signposts do not.** Both remakes kept the geometry and changed the pointers.
2. **Show the crown early.** A flythrough is the remakes' answer to "where is it?"; this game's
   answer is a vantage on the route (II.5).
3. **The start of a line must be where players already go.** Iron Galaxy moved a letter line for that
   reason; a crystal route that starts somewhere nobody rides will not be found.

## Part XI — This engine: the crystal, the verbs and how far they reach

Everything in this part was read from the source or measured with the real `Player` in a headless
run (`tools/probe-skate-reach.mjs`, output `docs/thps-bible/data/skate-reach-probe.json`). Heights
are feet heights unless a row says otherwise. **Measure the move a crystal depends on; do not compute
it** — the gameplay bible learned that lesson the hard way (GAMEPLAY_DESIGN_BIBLE.md XV.3), and this
probe found three more places where the obvious calculation is wrong (kicker roll-offs, carved airs,
pumped wallies).

### XI.1 The crystal itself

| Rule | Value | Source |
|---|---|---|
| Component | `{t:'crystal', p:[x,y,z]}`; one per level, the last one wins | `src/level.ts` (normalisation keeps the last crystal) |
| Fallback | no authored crystal → `placeCampaignCrystal()` drops one on the floor 6 m before the gate | `src/level.ts` ≈12113 |
| Where it shows | the shell's belt floats at `p.y + 1.75`; it bobs, spins and sheds purple glints | `Level.crystal`, glint loop |
| Pickup box | centre `(x, p.y + 1.3, z)`, 2.0 × 3.4 × 2.0 m | `Level.crystal` |
| **Pickup envelope** | the rider collects it when its **feet are between `p.y − 1.34` and `p.y + 3.0`** and its centre is **within 1.5 m on each horizontal axis** (up to 2.1 m on the diagonal) | probe `crystal-pickup-envelope` |
| Counting | touching it counts at once (score, sound, the HUD relic lights) — in mid-air too | `Player` pickup, probe `crystal-death` |
| Death | a soft death **keeps** a crystal taken this run; the rider respawns still holding it | probe `crystal-death` |
| Banking | it is saved only when the run **reaches the gate** (`campaign.commitClear`); a restart before the gate puts it back | `src/main.ts` |
| Absent | boss levels have none; skate races get no fallback crystal; time-trial and combo runs hide it | `allowsCrystal`, `skateRace`, `runMode` |
| Stopwatch | every level with a gate floats a time-trial stopwatch just off the racing line at its spawn; touching it starts a timed run, which hides the crystal — keep crystal routes that leave the spawn clear of it | `Level.placeClock` |

Three consequences shape every challenge in this bible:

1. **Reach height = feet apex + 1.34 m.** A move whose feet peak at 4.0 m above its take-off
   collects a crystal whose `p.y` is up to 5.34 m above that take-off. Subtract a margin (XI.6).
2. **A crystal can float over a lethal drop.** THPS lets you grab a tape and bail (the tape still
   counts); here a mid-air grab followed by a death still counts for the run, *provided the gate is
   still reachable from the respawn*. Never put the only route to the gate past the crystal's
   death drop with no checkpoint behind it.
3. **The crystal is not a goal on its own.** THPS banks a tape the moment you touch it; this game
   banks it at the gate. The crystal route must therefore rejoin a route to the gate, and a crystal
   placed late in a course with no checkpoint after it is worth less than one placed early: a death
   after the crystal costs the run's progress, not the crystal.

### XI.2 What the camera can show (the biggest difference from THPS)

THPS follows the skater with a low, nearly level chase camera, so a tape hanging high above a pipe or
a rooftop is visible from the street below. This game's course camera is a Crash rig: it sits behind
and above the rider, **pitched down**, and its height is anchored to the ground under the rider, not
to the rider (`src/main.ts` camera update; `camAirLift` 0 by default). With the default rig (`camDist`
5.05 m, `camHeight` 5.1 m, `camPitch` 25.35°, `camFov` 49°) the top edge of the frame is 0.85°
*below* horizontal. A crystal is on screen only while its centre is below that edge:

> `p.y + 1.75 ≤ groundY + camHeight + (camDist + d) · tan(camFov/2 − camPitch)`
> (d = horizontal distance from the rider to the crystal; groundY = the floor under the rider)

| Camera rig (dist / height / pitch / fov) | Highest visible crystal `p.y` above the rider's floor, crystal 0 m ahead | 10 m | 20 m | 40 m |
|---|---|---|---|---|
| Default course rig (5.05 / 5.1 / 25.35° / 49°) | **3.3** | 3.1 | 3.0 | 2.7 |
| Country Club style (11.5 / 7.3 / 18° / 66°) | 8.6 | 11.3 | 14.0 | 19.4 |
| Coconut Cart Rally (13 / 7.5 / 18° / 68°) | 9.5 | 12.3 | 15.2 | 20.9 |
| Cave Collapse (15 / 7 / 18° / 55°) | 7.8 | 9.4 | 11.1 | 14.5 |
| Rooftop Relay (11.5 / 7 / 30° / 66°) | 5.9 | 6.4 | 6.9 | 8.0 |
| Example low skate rig (6.5 / 3.2 / 12° / 60°) | 3.6 | 6.8 | 10.1 | 16.6 |

The rig starts to rise only when the rider climbs more than `maxRise` ≈ 3.45 m above the floor under
it (default lens), so during a big air the frame follows the rider with a lag and the crystal at the
apex sits near the top edge.

What this means for showing a crystal THPS-style:

- **In the default rig a crystal is seen from at or above its own height, never from below.** A
  crystal 6 m up a wall is invisible from the floor beside that wall at any distance. Tease it from a
  vantage at its level or higher: the spawn deck, a drop-in, a roof across the street, an earlier
  ledge, the far rim of a pit, or the top of the run-in to the launcher (Part II.6).
- **Levels built as skate arenas should author a rig.** `cameraRig` and `cameraAirLift` are level
  data, and several courses already set them (Country Club, Coconut Cart Rally, Cave Collapse, the
  Codex lab's Rooftop Relay). A rig with an 18° pitch and a 66° lens
  shows a crystal 8–14 m above the rider; that is the THPS sightline. Changing the rig changes the
  feel of the whole level, so decide it with the level, not per crystal.
- **The launcher is the cue when the crystal is out of frame.** On the final approach the crystal
  often leaves the top of the frame; the quarter pipe, kicker or wall that reaches it must read on its
  own (a lone quarter pipe at the end of a run-up, a lit wall, a rail pointing at the gap).

### XI.3 Verbs: what THPS used, what exists here

| THPS verb | Here | Engine rule that matters for crystals |
|---|---|---|
| Ollie | charged ollie | full charge ≈ 1.78 m feet apex on the flat (tap ≈ 0.6 m); 9.36 m long from cruise 12 m/s, 13.8 m at the 23 m/s charge maximum; holding Jump accelerates the board (GAMEPLAY_DESIGN_BIBLE XV.3) |
| Kicker / launch ramp | `ramp` | **you must ollie at the lip**: rolling off a kicker never launches (0 of 12 roll-offs left the ground); a kicker of rise *h* needs ≳ √(90·h) m/s to crest |
| Grind, ledge, rail transfer | `rail`, platform and road edges (grind by default), crate rows, `rope`, travelling rails, `trickrail` | snap radius 2.1 m; balance drifts (0.7) — with no stick correction the rider tips off after ≈ 1.2–1.4 s, losing 70% of its speed |
| Grind exit (ollie off a rail) | Jump on a rail | tap pops 1.23 m, full 2.30 m above the rail top; holding a direction on the release frame and the frame before throws you 1.96 m (tap) or 3.25 m (full) sideways |
| "Perfect" long grind | level flag `perfectGrindBoost` | ride ≥ 90% of a rail and you leave at 48 m/s whatever your entry: 14.4 m rolling off a 1 m rail, ≈ 27.5 m ollieing off |
| Manual | manual / nose manual | links lines across flat; minimum 3.5 m/s |
| Vert air | `vertramp` (half, quarter, bowl, pool), analytic halfpipes | pumping builds speed swing by swing; straight airs land back where they left; carved airs drift along the coping (XI.4) |
| Transfer (pipe to pipe) | spine transfer; carve off a pipe end | spine: only between **two analytic halfpipes on the same axis whose copings touch** (the far mouth within 0.7 m of a point 1 m past the near coping), by a second Jump release in the air with the stick over the ridge; the rider is mirrored onto the far face at the same height. Pipe end: a carved air that drifts past a pipe's end becomes plain flight; landing on another transition, steep face, rail or wall saves it, flat ground is a bail |
| Transfer (pipe to deck or roof) | carve off the end of a quarter pipe | a straight vert air lands back on the same face, also from a decked quarter pipe; a 40–45° carve off the **end** of a mesh-tracked quarter pipe flies on and lands on a deck or roof beside that end (recipe C8). Kickers and banks launch ballistic street transfers |
| Lip trick, revert | lip stall, revert | revert links a vert landing into a manual line |
| Wallride, wallie | wallride, wallie | straight walls on the 90° grid, or wall paths drawn with `pts`; a wall yawed off the grid is built from axis-aligned collision slabs and an angled approach reads as a head-on smack. Catch needs air, Grind held, ≥ 7.5 m/s and facing within 76° of the wall; one wallride per air (land or grind to re-arm); 12 s maximum |
| Wallplant, boneless, acid drop | — | absent. Acid drop = roll into the pipe from its deck; boneless = on-foot jump where the level allows walking; wallplant = wallie |
| Skitch, moving objects | `mover`, travelling `rail`, `ropeswing`, `spinbridge` | timing couplings; a travelling rail ferries a grind across a gap |
| Break glass, smash, unlock | crates (incl. `!` crates that make outline crates solid), `spinbridge`, `trickgate`, `trickrail`, `crumble`, `returnportal` (`airOnly`) | Part VII.4 maps THPS unlock triggers onto these |
| Trampoline / bounce | `trampoline`, arrow crates, enemy bounces | trampoline 3.75 m above its deck, 5.90 m with Jump held |
| Speed | `speedpad` | sets a target speed; use it to guarantee the speed a crystal route needs |

### XI.4 Reach tables (measured)

**Crystal reach** in these tables is the highest crystal `p.y` the move can collect: feet apex + 1.34.
Design to the margins in XI.6, not to these limits.

#### Vert: analytic halfpipe (coping 3.6 m above its floor)

| Speed at the bottom (m/s) | Coasting: air above coping | Pumping: air above coping | Pumping: feet apex above floor | Crystal reach above floor |
|---|---|---|---|---|
| 6 | no air | 6.37 (after 3.7 s of pumping) | 9.97 | 11.3 |
| 9 | no air | 7.16 (after 3.5 s of pumping) | 10.76 | 12.1 |
| 12 | no air | 0.57 | 4.17 | 5.5 |
| 15 | no air | 2.00 | 5.60 | 6.9 |
| 18 | 0.91 | 3.85 | 7.45 | 8.8 |
| 23 | 4.54 | 7.10 | 10.70 | 12.0 |

A pumped session from 9 m/s climbs 7.16 → 7.90 → 8.39 → 8.55 → 8.76 m above the coping and then
holds ≈ 8.3–8.8 m: **the vert ceiling is ≈ 8.7 m above the coping (≈ 12.3 m above the floor, crystal
reach ≈ 13.6 m)** and it takes 3–4 swings (≈ 4–6 s) to get there. Coasting from 12 m/s never clears
the coping. Rows 6 and 9 are slower starts that pump for several swings before the first air, which is
why their first air is higher than row 12's.

#### Vert: carved airs (approach at an angle across the flat)

| Speed | Approach angle | Air above coping | Drift along the coping |
|---|---|---|---|
| 12 | 0° / 15° / 30° / 45° | 0.57 / 0.15 / 0.40 / 1.10 | 0 / 0.7 / 2.1 / 5.2 m |
| 18 | 0° / 15° / 30° / 45° | 3.85 / 1.82 / 1.76 / 2.29 | 0 / 2.5 / 5.2 / 9.6 m |
| 23 | 0° / 15° / 30° / 45° | 7.10 / 4.01 / 3.12 / 3.29 | 0 / 4.7 / 8.7 / 13.1 m |

A carve buys distance along the pipe and costs about half the height. A crystal *above* the coping
wants a straight air; a crystal *along* the coping (between two pipes set end to end, or above a
deck at the far end of a pipe) wants a carve.

#### Vert: decked quarter pipe (mesh-tracked, coping 3.6 m)

| Speed | Coasting | Pumping | Lands |
|---|---|---|---|
| 12 | no air | no air | — |
| 15 | no air | 1.64 above coping | back on the face |
| 18 | no air | 3.25 | back on the face |
| 23 | 3.54 | 6.65 | back on the face |

#### Kickers (charged ollie released at the lip; roll-offs never launch)

| Kicker rise × length | Approach (m/s) | Speed at the lip | Feet apex above floor | Crystal reach | Lands past the lip |
|---|---|---|---|---|---|
| 0.8 × 4 m (11°) | 12 / 18 / 23 | 10.9 / 18.5 / 22.9 | 2.47 / 2.99 / 3.36 | 3.8 / 4.3 / 4.7 | 8.9 / 16.2 / 21.2 m |
| 1.2 × 4 m (17°) | 12 / 18 / 23 | 9.3 / 18.0 / 22.8 | 3.62 / 3.78 / 4.45 | 5.0 / 5.1 / 5.8 | 8.5 / 17.8 / 24.4 m |
| 1.8 × 4 m (24°) | 12 / 18 / 23 | 6.3 / 16.7 / 21.4 | 4.48 / 5.81 / 6.99 | 5.8 / 7.1 / 8.3 | 5.9 / 19.3 / 26.6 m |

9 m/s launched off none of them. A steeper kicker adds height but bleeds speed on its face: at
12 m/s the 1.8 m kicker gives the most height and the shortest flight.

#### Grind exits (any speed; distances scale with speed)

| Exit | Apex above rail top | Crystal reach above rail top | Distance at rail height, 6 / 12 / 18 / 23 m/s | Sideways throw |
|---|---|---|---|---|
| Tap | 1.23 m | 2.6 m | 3.2 / 6.5 / 9.7 / 12.4 m | 1.96 m |
| Full | 2.30 m | 3.6 m | 6.7 / 13.3 / 20.0 / 25.5 m | 3.25 m |

#### Slipstream (`perfectGrindBoost`; 24 m rail ridden end to end)

| Entry speed | Leave by | Exit speed | Apex above floor (rail 1 m up) | Lands past the rail end |
|---|---|---|---|---|
| 8, 12 or 18 m/s | rolling off | 48 m/s | 1.25 m | 14.4 m |
| 8, 12 or 18 m/s | ollie off | 48 m/s | 2.38 m | 27.4–27.8 m |

#### Wallride and wallie (straight wall, 35° approach)

| Entry | Wall entry height | Rising at | Ride with no wallie |
|---|---|---|---|
| Flat, tap ollie (9–23 m/s) | 0.2–0.7 m | 3.0–3.4 m/s | 0.4–0.5 s, then lands |
| Flat, full ollie (9–23 m/s) | 1.0–1.5 m | 3.0–7.0 m/s | 0.65–1.0 s, then lands |
| 1.8 m kicker, 12 m/s | 4.15 m | 3.0 m/s | 0.93 s, then lands |
| 1.8 m kicker, 18 / 23 m/s | 3.9 / 3.8 m | 11.3 / 14.6 m/s | 1.7 / 1.8 s (climbs to 7.8 / 10.4 m first) |

Wallride gravity (16) sinks a slow entry to the floor in under a second, and pumping the wallie means
staying on the wall, so the pump is limited by how high and how fast you arrive:

| Pump before release | Pop above the release point |
|---|---|
| tap | 1.68 m |
| 0.25 s | 2.62 m |
| 0.5 s | 3.86 m |
| 1.0 s | 7.08 m |
| 1.5 s | 11.27 m |

| Entry | Best feet apex (pump) | Crystal reach |
|---|---|---|
| Flat tap ollie | 3.0–4.0 m (0.25–0.5 s) | 4.4–5.3 |
| Flat full ollie | 4.8–6.3 m (0.5 s) | 6.1–7.6 |
| 1.8 m kicker at 12 m/s | 7.44 m (0.5 s) | 8.8 |
| 1.8 m kicker at 18 m/s | 14.15 m (1.0 s) | 15.5 |
| 1.8 m kicker at 23 m/s | 18.82 m (1.5 s) | 20.2 |

The wallie carries the rider **along** the wall (it lands 3.4–25.9 m downstream) and only 0.9–2.8 m
out from the face. A wallie crystal sits close to the wall and downstream of the release, never
straight out from it. The kicker-into-wallride-into-pumped-wallie chain is the tallest thing this
engine does: at full speed it out-reaches a pumped halfpipe session by 5–6 m.

#### Bounce and on foot

| Move | Feet apex above its surface | Crystal reach |
|---|---|---|
| Trampoline / Jump held | 3.75 / 5.90 m above the deck | 5.1 / 7.2 |
| Board full ollie / tap (flat) | 1.78 / ≈ 0.6 m | 3.1 / 1.9 |
| On foot full jump / + double jump | 2.85 / 4.59 m | 4.2 / 5.9 |
| Arrow crate / held + double | 3.77 / 7.65 m above its lid | 5.1 / 9.0 |

### XI.5 Engine rules that decide whether a route works

1. **Ollie at the lip.** A kicker is a cue to press Jump, never an automatic launch.
2. **Speed is the price of height.** Every launcher in XI.4 scales with entry speed; give the route a
   run-up the player can see, or a `speedpad`, and test it at the speed the run-up actually delivers.
3. **Vert airs come home.** A straight air lands back where it left. Reaching something *beyond* the
   coping takes a carve (along the pipe, or off the end of a quarter pipe onto a deck beside it), a
   spine (into a touching halfpipe), a halfpipe-end fly-off (into another transition, rail or wall), or
   a street launcher.
4. **Walls on the grid.** A wallride wall runs along X or Z, or is a `pts` wall path. Approach at 20–60°,
   not head-on and not grazing.
5. **One wallride per air.** Land or grind to re-arm; a chain of walls needs a landing or a rail
   between them.
6. **Balance is a clock.** An uncorrected grind lasts ≈ 1.3 s; long rails ask the player to balance.
   A crystal at the end of a long rail tests balance as much as the grind.
7. **A crystal touched counts.** Mid-air pickups over drops are allowed; plan the respawn so the gate
   stays reachable.
8. **Out of frame is out of mind.** With the default rig, anything more than ≈ 3 m above the rider's
   floor is off screen (XI.2).

### XI.6 Margins

Players are not frame-perfect. Use these margins against the measured limits:

| Crystal role | Height: use at most | Distance: use at most | Speed assumed |
|---|---|---|---|
| Tease or early test (career 1–3) | 75% of the feet apex, + 1.34 | 75% of the measured flight | what the visible run-up gives with no pumping |
| Mid-career test | 85% | 85% | one pump or one charged ollie |
| Expert crystal | 95% | 95% | a full pumped session, full charge or a `speedpad` |

The crystal also has a floor: put its `p.y` high enough that the intended move is *needed*. If a full
ollie or an on-foot double jump from the nearest floor can collect it (feet apex 1.78 / 4.59 m → reach
3.1 / 5.9 m), the challenge is decoration.

## Part XII — Crystal challenge patterns

Each pattern turns a THPS placement family (Part III) into a crystal challenge built from this
engine's verbs (Part XI). Heights are `p.y` of the crystal above the surface named; "reach" is the
measured feet apex + 1.34 m. Apply the margins of XI.6, and check the camera rule of XI.2 for every
pattern. Recipes (Part XIV) are played-through examples.

| # | Pattern | THPS precedent | Core verbs | Recipe | Career band |
|---|---|---|---|---|---|
| P1 | Vert ceiling | Hangar, London (2025), Chopper Drop | pumped vert air | C1 | early (one air) to expert (full session) |
| P2 | Arc over a gap | Downtown, School II, Warehouse | kicker + speed pad, roof launch | C2 | early to mid |
| P3 | Line's end | NY rebar, School awning, Kona ridge | grind + exit at the end | C3 | early to mid |
| P4 | Slipstream chasm | long-rail lines into gaps | perfect grind, ollie off | C4 | mid |
| P5 | Wall ladder | San Francisco (2025), Airport, Kona | kicker → wallride → wallie | C5 | mid to expert |
| P6 | High wire | Philadelphia, Mall, Venice, College, Foundry | ollie onto a high rail, balance | C6 | early to mid |
| P7 | Roof drop | Venice, Streets, Shipyard (2025) | climb, then ollie off the top | C7 | early to mid |
| P8 | Room over the line | Warehouse sky box | vert or kicker into a walled perch | — | early |
| P9 | Hidden district | NY Banks, School II Carlsbad, Downhill Jam | several entries at different prices | — | mid |
| P10 | Unlocked secret | Hangar, Canada, LA, Alcatraz (2025) | trigger elsewhere, then a short route | — | mid to late |
| P11 | Crown of the landmark | THPS4 remake tapes, LA tower | a layered climb that reuses the level | C6 + C7 | late |
| P12 | Carve transfer | Canada's vert staircase, channel gaps | carve off a quarter pipe's end | C8 | mid |

### P1 · Vert ceiling

**Idea.** The crystal hangs above a coping, out of reach of a casual air. The player must pump.

**Build.**
- Use an analytic halfpipe (`vertramp`, `vkind: 'half'`, straight, `arc: 90`) or a decked quarter pipe.
  Put the crystal within 1 m of the coping line horizontally (vert airs return to where they left; the
  pickup reaches 1.5 m on each axis).
- Height above the coping: **1–2 m** for a first-air crystal at 15 m/s (reach 6.9 m above the floor
  with a 3.6 m coping); **3.5–5.5 m** for one pumped air from 18–23 m/s; **6–7.4 m** for a pumped
  session (C1: 7.4 m, collected on the first air from 9 m/s after pumping); **up to 8.7 m** for the
  expert ceiling (the measured session cap).
- Give the pipe a flat run-in so the player arrives with speed, and enough length (≥ 20 m) that a
  carve does not run out of pipe.

**Rule out the cheap way.** Coasting at the 23 m/s maximum reaches only 4.5 m above the coping; a
straight first air from 12 m/s only 0.6 m. Above 5 m over the coping, only pumping gets there.

**Camera.** A crystal 7 m above a 3.6 m coping is ≈ 11 m above the pipe floor: invisible from the
floor in the default rig. Tease it from a deck above the pipe, or author a rig (C1 uses 11.5 / 7.3 /
18° / 66°).

**Failure.** Free: a short air lands back in the pipe and the next swing is another attempt. This is
THPS's cheapest tape (Warehouse's miss is "itself a second route").

### P2 · Arc over a gap

**Idea.** The crystal floats in the air over a gap the player must jump; only a committed launch
passes through it.

**Build.**
- A kicker (`ramp`) at the edge, with a speed pad or a drop-in before it. Ollie at the lip: roll-offs
  never launch.
- **To test speed, put the crystal on the far half of the arc.** A kicker's height barely changes
  with speed (1.2 × 4 m: 3.6 m at 12 m/s, 3.8 m at 18 m/s) but its distance doubles (8.5 → 17.8 m). C2
  puts the crystal 12 m past the lip at `p.y` 4.0: the 18 m/s arc collects it; the 12 m/s arc falls
  short into the pit.
- **To test the ollie, put it at the apex** (≈ 40% of the flight).
- Size the gap so the intended arc lands with margin: landing distances in XI.4.

**Camera.** Start the route from a deck above the kicker floor (C2's 3 m start deck) so the crystal
is in frame before the run-in; on the run-in it leaves the frame and the pad and kicker are the cue.

**Failure.** A pit under the gap makes the miss a death; the crystal still counts if touched. Put a
checkpoint before the run-in, as THPS puts the retry close to the launch.

### P3 · Line's end

**Idea.** A rail, ledge or rope ends in the air; the crystal hangs just past the end. The player must
ride the whole line and pop at the right moment.

**Build.**
- A full grind exit pops 2.30 m above the rail top (tap 1.23 m). Put the crystal **2.6–3.3 m above the
  rail top** to need the full exit (C3: 3.3 m), and **4–6 m past the end** at 12 m/s (the apex of a full
  exit is ≈ 4.9 m on).
- Hang the rail's end over a drop so the line has to be ridden out (C3's rail runs 7 m past the deck
  edge).
- Size the landing so a tap exit falls safely short and a full exit lands (C3: the tap lands short of
  the crystal on the far deck; the full exit lands past it).

**Variants.** A sideways exit throws the rider 1.96 m (tap) or 3.25 m (full): a crystal beside the
line's end, not in front, asks for a sideways pop. The NY rebar adds a blind early hop between two bars
(a rail transfer) before the end.

### P4 · Slipstream chasm

**Idea.** A chasm far too wide for any ollie, and one rail pointing at it. Ride the whole rail and the
slipstream throws you across.

**Build.**
- Level flag `perfectGrindBoost: true`. Coverage ≥ 90% of the rail exits at 48 m/s whatever the
  entry speed.
- Chasm 18–24 m (an ordinary ollie covers 9–14 m; the slipstream ollie-off covers ≈ 27.5 m).
- Crystal **12–14 m past the rail end**, `p.y` ≈ floor + 3.2–3.6 m (C4: 3.4): the ollie-off peaks at
  2.4 m and collects it, the roll-off peaks at 1.25 m and passes under.
- Make the rail's start easy to catch (low, at the end of a run-up): coverage is the skill gate.

**Failure.** Joining late (no boost) or rolling off drops into the chasm; put a checkpoint before the
rail.

### P5 · Wall ladder

**Idea.** A tall wall beside a launcher. Ride up the wall and spring off it to a crystal high above
anything a jump reaches.

**Build.**
- A straight wall on the 90° grid (or a `pts` wall path); a kicker aimed at it at 20–60°; a speed pad
  before the kicker.
- The rider catches the wall at the kicker's height and climbs while its launch speed lasts; pumping
  the wallie (hold Jump on the wall) adds 1.7 m (tap) to 11.3 m (1.5 s) above the release, but the
  rider sinks on the wall while pumping.
- Measured ceilings (feet): flat full-ollie entry 4.8–6.3 m; kicker entry at 12 m/s 7.4 m; at 18 m/s
  14.2 m; at 23 m/s 18.8 m. C5 (18 m/s, 0.75 s pump) collects at feet 13.3 m.
- **Place the crystal in the wallie lane**: 1–2 m off the face, downstream of the catch by (wall speed
  × pump time) + (0.7 × wall speed × ≈ 0.6 s). Never straight out from the wall.

**THPS note.** The San Francisco remake tape and the Airport lattice use wallride + wallie as the last
step of a climb, not as the whole route. Use P5 for one decisive step.

### P6 · High wire

**Idea.** A wire strung high over a plaza or a drop, from a roof or planter at one end. The crystal sits
on the wire; the challenge is getting on, and staying on.

**Build.**
- A `rail` (or `rope`, which snaps after `shake` seconds) between two high surfaces; its start 1–1.5 m
  above the surface you board from, reachable by a charged ollie with Grind held (C6).
- Crystal **on the wire** (`p.y` ≈ wire height + 0.4–0.6 m), collected while grinding, placed
  **past the point where balance starts to matter**: at 12 m/s an uncorrected grind tips off after
  ≈ 1.3 s, ≈ 16 m. Philadelphia's tape is 60% along its wire.
- Under the wire: a drop the player can recover from (a plaza, a fountain bowl) or a lethal one for
  late levels.

**Camera.** The crystal is in frame from the boarding roof (it sits ≈ 1 m above it) and invisible from
the plaza below in the default rig; the *wire* is the long-range pointer.

### P7 · Roof drop

**Idea.** The climb is the route; the crystal hangs past the top roof's edge at roof height. Only a
charged ollie off the edge carries the rider through it.

**Build.**
- Crystal at roof height (`p.y` = roof top), **5–8 m past the edge** (C7: 7 m). A charged ollie at
  12 m/s passes at feet ≈ 9.6 m (roof 8 m); a roll-off has dropped 6–7 m by then.
- The climb reuses the level: a kicker onto a lower roof, a wire up (P6), a wallride (P5).

**Variants.** Shipyard's 2025 tape inverts it: the tape is just *below* a duct's end and the skill is
**braking** — roll off slowly. In this engine a slow roll-off drops almost straight down: a crystal
1–2 m below an edge and within 1 m of it collects on a slow roll-off and is overshot by a fast one.

### P8 · Room over the line

**Idea.** A walled perch (a crate-walled box, a cage, a lit room) hangs over the level's signature
feature. The player sees the room, flies into it, smashes in.

**Build.**
- The room's floor 1–2.5 m above the coping or kicker apex that reaches it (Warehouse: 1–2.5 m over the
  far coping). The "glass" is a wall of crates on the line; the crystal 1 m above the room floor.
- The start of the route is the highest floor of the level (Warehouse's start room), so height becomes
  speed with no pumping.

**Failure.** Under the room, a pipe or deck that is itself a second route in (Warehouse's halfpipe).

### P9 · Hidden district

**Idea.** The crystal is in a district the main route does not enter. The district has several entries
at different prices; the crystal rewards finding it.

**Build.**
- Two or three entries: a cheap one that needs knowledge (a gap in a wall, a `returnportal`), a skilled
  one (a roof gap, P2), and an earned one (a switch or a set of pickups). NY City: a low wall, a fallen
  pole, or the subway after five tokens.
- Inside, the crystal sits on the district's own line (NY's rebar, P3) with the district's other pickups
  on the approach.
- A pointer at each entry: a letter-equivalent (a wumpa line, a crate row, a colored gem) or a gap
  name in the level's signage.

### P10 · Unlocked secret

**Idea.** A trigger elsewhere opens the way; the crystal is a short route beyond the opening.

**Build.**
- Trigger on a visible prop: a `!` crate that materialises outline crates into a staircase or deck
  (`codex-lab` already does this), a `spinbridge` the player spins open.
- Show the effect where it happens; keep it open for the run (outline crates stay solid; a spin
  bridge without `hold` stays down).
- Trigger-to-crystal time ≈ 10–15 s (Hangar: 12 s).
- Make goals converge on the trigger (Hangar's hangtime kickers reach the helicopter blades).

### P11 · Crown of the landmark

**Idea.** The crystal crowns the level's tallest landmark; the route is a layered climb that reuses
the level's own lines, one layer at a time (THPS 3+4's College tower, San Francisco terrace,
Alcatraz water tower; LA's tower).

**Build.**
- Three or four layers, each reached by a move the level teaches lower down: kicker onto a low roof →
  wire up to a higher roof (P6) → wallride (P5) or roof drop (P7) to the crown.
- A shortcut for experts (THPS: teleport doors; here: a `returnportal`, a hidden wallride).
- The landmark is visible from the main route; the crystal is visible from the second-to-last layer.

### P12 · Carve transfer

**Idea.** A quarter pipe ends short of a roof or deck at coping height; the crystal hangs over the gap
between them. Carve up the face toward the end and fly off the end onto the roof.

**Build.**
- A decked, mesh-tracked quarter pipe (not a plain analytic halfpipe), 10–14 m long, ending 2–4 m short
  of a roof at coping height.
- Carve at 40–45° from 15–23 m/s toward the end (C8: 18 m/s, 40°, lands 8.4 m past the ramp end).
- Crystal over the gap, **2–3 m past the ramp end** (out of reach of a straight air at the very end)
  and ≈ 1.5–2 m above the coping (C8: `p.y` 5.5 with a 3.6 m coping).

**Failure.** A slow carve drops into the gap: keep the floor under it, so it is a cheap miss.

### XII.13 Combining patterns into a level's crystal

THPS's harder tapes are two or three of these patterns in sequence, never more: Downtown is P9 (a
hidden corridor) → P1-as-speed-source (the roof bowl) → P2 (Roof 2 Roof); Streets is a climb → P7 off a
ski jump; College 2025 is P11 using P6. Build a crystal route as **one primary pattern plus at most
two supporting ones**, and make sure every supporting step is taught elsewhere in the level (law 7).

## Part XIII — Diagnosis: this game's crystals against the THPS evidence

`docs/thps-bible/CURRENT_GAME_CRYSTAL_AUDIT.md` measures every campaign course's crystal on the same
routes as the crate and geometry audits. Set against Parts I–X, the gap is wide.

### XIII.1 The numbers side by side

| Measure | THPS secret tapes (25) | This game's crystals (21 in play) |
|---|---|---|
| Where on the route | at the level's signature feature or tallest landmark; mid-route or on a branch | median **99%** of the way to the gate; 11 of 21 within 20 m of it |
| Height above the floor below | 3–25 m, mostly 5–8 m | median **1.3 m** above the route floor (highest 4 m) |
| Collectable by standing still | none | **13 of 21** from the route floor itself, 15 of 21 from somewhere |
| Easiest way in | a 4–6-move route; grind, ollie off an edge, vert air, transfer | walk 13, ollie 5, grind 3 |
| Moves a route needs | grind ≈ 85%, ollie ≈ 70%, vert ≈ 50%, transfer ≈ 35%, kicker ≈ 30% | no crystal needs a jump, double jump, ledge grab, vert air or wallride as its easiest way |
| Launchers near the perch | always (it is the route) | **no kicker within 25 m of any crystal**; a vert coping within 25 m of 3 |
| Seen before reached | from the launch, from below, or from a vantage, ≈ 20 m out | 17 of 21 in the camera frame from the approach (median lead 39 m) |
| Off the main line | most tapes are a layer above or a district beside it | 15 on the path, 3 off-line, 3 detours |

THPS tapes are the hardest navigation in their level; most of this game's crystals are a reward for
reaching the end. That is not wrong for every course, but it does not use the skate verbs the game
has, and the levels already contain the parts: 24 of 27 courses have authored rails beside the route,
11 have vert surfaces, 10 have kickers.

### XIII.2 What is already THPS-like

| Course | What it does right | THPS parallel |
|---|---|---|
| `jungle` (Jungle Ruins) | the crystal sits on the fallen-trunk grind rail over a 68 m ravine, 14% into the course; the grind is the only way to it | the Mall's rods: a high line over a drop, the line is the route |
| `treehouse-trail` | on a single taut rope across a missing bridge over the river | Philadelphia's wire |
| `tribal-run` | on the final crossing rail over a pit, 1.85 m up | NY's rebar line |
| `rooftop-relay` | on a branch roof 36 m off the route, two ollie gaps out, 4 m above the route floor | a district beside the main line (NY Banks, School II) |
| `codex-lab` | needs a `!` switch to build the deck that reaches it, then a hop | an unlock tape (Hangar, Canada) |
| `nightworks-after-hours` | over a quarter pipe, reachable by a vert air or a coping grind | Hangar's helipad |

### XIII.3 Diagnoses

Each diagnosis names the law (Part 0) it breaks and the fix (Part XII patterns, Part XIV recipes).

1. **The finish-line crystal** (11 of 21 within 20 m of the gate; `dark` 2.8 m before it; median 14 m
   before the gate). Breaks laws 2 and 19: the crystal is a last pickup, not a destination on the
   level's feature. *Fix:* move it onto the course's signature feature or tallest landmark and build
   one escalation of the course's own lines to reach it (P1–P11).
2. **The walk-in crystal** (13 of 21 collectable standing on the route floor). Breaks law 11 (the move
   must be *needed*). *Fix:* raise it above the floor-ollie reach (3.1 m above any floor it can be
   approached from, 5.9 m on foot) or float it past an edge where only a committed move passes
   (P2, P3, P7).
3. **The skate-rich course with a walk-in crystal** (`coastal-street-run`: a rail within 10 m of every
   route sample, 47 rails, 38 kickers, yet its crystal is a walk-in 65 m before the gate). Breaks law 6:
   the level's lines are not used. *Fix:* put the crystal at the end of one of those rails (P3) or over
   one of its kickers' far arcs (P2); recipes C2 and C3.
4. **No launcher near any crystal.** Breaks law 9. *Fix:* every crystal route needs a readable
   launcher in view of the perch: a quarter pipe at the end of a run-up, a kicker with a pad, a rail
   pointed at the gap, a lit wall.
5. **The fallback crystal** (`hollowwake-descent` has no authored crystal; the engine's
   6 m-before-gate fallback lands it 6 m *past* the gate because the course's camera lane is authored
   from the finish backwards). Breaks law 19. *Fix:* author a crystal; do not rely on the fallback for
   any level with a reversed or turning lane.
6. **The crystal above the frame** (`dark`: above the camera frame top for its whole approach;
   `rooftop-relay`: never in frame from the main route). Breaks law 5. *Fix:* give it a vantage at or
   above its height on the route, or lower it to ≤ 3 m above the floor it is seen from (XI.2), or
   author the level's rig.
7. **The centimetre perch** (`custard-creek` collects standing with 2 mm to spare; `codex-lab`'s perch
   leaves the feet 0.06 m short, so it needs a hop). Breaks law 11 in both directions: a perch that is
   *almost* a walk-in reads as a bug. *Fix:* put the crystal clearly inside one envelope — either a
   deliberate walk-in or at least 0.5 m out of standing reach so a deliberate move is needed.
8. **The fatal shortcut** (`treehouse-trail`, `tribal-run`: a full ollie from a surface at band height
   touches the crystal before a lethal landing). Not a bug: a touched crystal counts and survives the
   soft death (XI.1). But the intended grind should be the obvious way; keep the shortcut as THPS keeps
   its TAS lines — open to experts, not the first thing a player tries.
9. **The suppressed crystals** (`sky`, `jungle-terraces`, `rolling-bones` author crystals that the
   engine never builds on Secret Island courses). Not a placement problem, but authored data that does
   nothing; either remove it or decide that Secret Island courses get crystals.

### XIII.4 Where to start

The cheapest wins, in order:

1. The **finish-line walk-ins** on skate-rich courses (`coastal-street-run`, `beachfront`,
   `carlisle-coast`, `mayfield-mall`): each already has rails, kickers or vert near its route. Move
   the crystal onto that geometry with one of recipes C2–C4 or C8.
2. **`hollowwake-descent`**: author a crystal (it currently relies on the fallback).
3. **`dark`** and **`rooftop-relay`**: keep their placements, add a vantage (XI.2).
4. The **near-misses** (`custard-creek`, `codex-lab`): move the crystal 0.5 m to one side of the
   envelope so the intended move is unambiguous.

The audit tool re-measures every change (`node tools/crystal-placement-report.mjs --levels <id>`).

### XIII.5 Raw material per course

Every course already has some of the parts a THPS-style crystal needs. This table lists, from the
audit, what each campaign course has beside its route and which patterns (Part XII) those parts could
carry. It is a starting point for a design pass, not a placement: a pattern still needs its launcher
in view, its numbers inside the margins and a vantage for the camera.

| Course | Id | Crystal | Reach; along route; above floor | Rails / coping / vert / kickers / movers / trampolines near the route | Slipstream flag | Camera | Patterns the course can already support |
|---|---|---|---|---|---|---|---|
| Treehouse Trail | `treehouse-trail` | in play | grind line; 91%; 6.0 m | 5 / 2 / 2 / 6 / 0 / 0 | — | rig | P3, P6, P1, P12, P2, P5 |
| Banana Bay | `beachfront` | in play | walk; 99%; 1.1 m | 64 / 0 / 0 / 0 / 1 / 0 | — | rig | P3, P6, moving |
| Ripcord River | `rumblewater-run` | in play | walk; 99%; 1.2 m | 6 / 4 / 7 / 0 / 0 / 0 | — | default | P3, P6, P1, P12, P5 |
| Jungle Ruins | `jungle` | in play | grind line; 14%; 1.8 m | 26 / 0 / 0 / 5 / 0 / 0 | — | default | P3, P6, P2, P5 |
| Beach Street | `coastal-street-run` | in play | walk; 98%; 0.7 m | 47 / 42 / 0 / 38 / 0 / 0 | — | rig | P3, P6, P1, P12, P2 |
| Sunset Safari | `custard-creek` | in play | walk; 25%; 1.4 m | 6 / 0 / 1 / 0 / 2 / 11 | — | default | P3, P6, P1, P12, moving, bounce |
| Tribal Run | `tribal-run` | in play | grind line; 98%; 2.5 m | 7 / 0 / 0 / 0 / 24 / 0 | — | rig | P3, P6, moving |
| Waterfall Climb | `waterfall-climb` | in play | walk; 100%; — (the audit lost the route near the gate) | 1 / 0 / 0 / 0 / 3 / 0 | — | default | P3, P6, moving |
| Uga Ambush | `test` | in play | ollie; 71%; 2.3 m | 48 / 2 / 3 / 0 / 2 / 0 | — | default | P3, P6, P1, P12, P5, moving |
| The Merchant Wreck | `drowned-crown` | in play | ollie; 73%; 3.0 m | 5 / 0 / 0 / 0 / 6 / 0 | — | rig | P3, P6, moving |
| High Chief Uga Ha ku | `crab-chief` | none | — | 2 / 0 / 0 / 0 / 0 / 0 | — | default | P3, P6, P5 |
| Deadwater Park | `waterpark` | in play | walk; 100%; 1.2 m | 0 / 0 / 22 / 7 / 0 / 0 | — | default | P1, P12, P2 |
| Haunted Hassle | `codex-lab` | in play | ollie; 53%; 1.4 m | 7 / 0 / 1 / 2 / 2 / 0 | — | default | P3, P6, P1, P12, P2, P5, moving |
| Ghost Train | `ghost-train` | in play | walk; 31%; 1.2 m | 8 / 0 / 0 / 74 / 16 / 0 | — | default | P3, P6, P2, P5, moving |
| Tunnelbore Tracks | `hollowwake-descent` | in play | walk; 100%; 0.3 m | 0 / 0 / 167 / 0 / 0 / 0 | — | default | P1, P12, P5 |
| Carlisle Coast | `carlisle-coast` | in play | walk; 100%; 1.0 m | 3 / 0 / 0 / 0 / 18 / 30 | — | default | P3, P6, moving, bounce |
| Hogsworth Harbour | `rooftop-relay` | in play | ollie; 59%; 4.0 m | 1 / 0 / 0 / 0 / 0 / 0 | — | rig | P3, P6 |
| Mayfield Mall | `mayfield-mall` | in play | walk; 100%; 1.6 m | 32 / 11 / 76 / 2 / 0 / 0 | — | rig | P3, P6, P1, P12, P2, P5 |
| Dusty Road | `bryce-canyon` | in play | walk; 100%; 0.0 m | 4 / 0 / 0 / 0 / 0 / 0 | — | rig | P3, P6 |
| Nightmare Grove | `jungle-minefield` | in play | walk; 99%; 0.9 m | 7 / 0 / 0 / 0 / 0 / 0 | — | rig | P3, P6 |
| Guptus Eruptus | `nightworks-after-hours` | in play | ollie; 100%; 3.8 m | 3 / 0 / 1 / 6 / 5 / 0 | — | rig | P3, P6, P1, P12, P2, P5, moving |
| Torchlight Trouble | `dark` | in play | walk; 100%; 1.4 m | 3 / 0 / 0 / 0 / 29 / 0 | — | default | P3, P6, P5, moving |
| Sky Bridge | `sky` | suppressed | — | 18 / 0 / 0 / 2 / 0 / 0 | — | default | P3, P6, P2, P5 |
| Temple of Embers | `jungle-terraces` | suppressed | — | 11 / 0 / 5 / 0 / 0 / 0 | — | default | P3, P6, P1, P12, P5 |
| The Ancient Gates | `jungle-gate-run` | none | — | 1 / 0 / 0 / 1 / 3 / 0 | — | default | P3, P6, P2, P5, moving |
| Rolling Bones | `rolling-bones` | suppressed | — | 42 / 30 / 16 / 0 / 0 / 0 | — | default | P3, P6, P1, P12, P5 |
| The Skystream | `skystream` | none | — | 0 / 0 / 0 / 0 / 0 / 0 | — | default | — |

Counts are authored elements within reach of the walked route (rails and coping rails, vert meshes,
kickers, movers, trampolines; `context` in `data/current-game-crystals.json`). P5 is listed where a
wall face ≥ 2.5 m lines at least 2% of the route; check that the wall is on the 90° grid before
building a wall ladder on it. "Slipstream flag" is the level's `perfectGrindBoost`; no campaign course
sets it (the skate races do), so P4 needs the flag first.

## Part XIV — Recipes, played with the real skater

Each recipe below is a small level that `tools/verify-crystal-recipes.mjs` builds and plays with the
real `Player` and real inputs. A recipe passes only if its intended route collects the crystal **and**
each shortcut it is meant to rule out fails. All eight pass (`docs/thps-bible/data/crystal-recipes-
verified.json`). Coordinates are metres, travel is toward −Z, and floors (`platform`) are left out of
the snippets; the verifier file has the complete levels. The rail recipes run with the grind balance
drift switched off: balance is a separate skill (XI.5, rule 6), and the long-rail recipes ask for it
on top.

Use a recipe as a pattern, not a prefab: keep the measured relationships (launcher to crystal, height
above the take-off, distance past the edge) and dress the geometry for the level.

**C1 · Pumped vert ceiling** — THPS precedent: Hangar's helipad quarter pipe, Chopper Drop's height
ladder (Part III.3).

```js
{ t: 'vertramp', p: [0, 0, -60], len: 40, w: 2, rise: 3.6, vkind: 'half', arc: 90, arcSteps: 24 }, // copings at x = ±5.6
{ t: 'crystal', p: [4.6, 11.0, -60] },   // 1 m inside the +X coping, 7.4 m above it
// level: cameraRig: { camDist: 11.5, camHeight: 7.3, camPitch: 18, camFov: 66 }
```

- **Route**: drop into the pipe at 9 m/s and pump (hold Jump on the way up the wall, release at the
  coping). The first air that clears collects it (feet 9.8 m at the pickup).
- **Ruled out**: coasting at the 23 m/s maximum peaks at 8.6 m; a single pumped air from 12 m/s peaks
  at 4.2 m.
- **Camera**: 11 m is far above the default rig's 3.3 m (XI.2); the recipe sets a rig that shows the
  crystal from 10 m away (visible up to 11.3 m there). Without a rig, tease it from a deck above the
  pipe.
- **Tune**: crystal 7.4 m above the floor = one 15 m/s pumped air (early career); 12.5 m = a full
  pumped session (expert; reach 13.6 m).

**C2 · Drop-in kicker over a pit** — THPS precedent: School II's roof launch, the tape "in the air in
the gap" (Part III.4), and the Warehouse drop-in tease.

```js
{ t: 'platform', p: [0, 1.5, 6], s: [8, 3, 8] },                     // start deck, top 3 m: the tease
{ t: 'ramp', p: [0, 0, -2], len: 8, rise: 3, w: 8, yaw: 180 },       // drop ramp down to the run-in
{ t: 'speedpad', p: [0, 0.05, -14], s: [4, 0.1, 3], speed: 18 },
{ t: 'ramp', p: [0, 0, -32], len: 4, rise: 1.2, w: 4 },              // kicker, lip at z = -34
// pit from z = -34 to -48, landing deck from -48
{ t: 'crystal', p: [0, 4.0, -46] },                                  // 12 m past the lip, on the far half of the arc
```

- **Route**: roll off the start deck, hit the pad, charged ollie released at the lip. Collected at
  feet 3.96 m, 10.8 m past the lip; lands on the far deck.
- **Ruled out**: skipping the pad (12 m/s at the kicker) falls into the pit short of the crystal;
  rolling off the kicker without an ollie never launches and falls.
- **Camera**: from the start deck the crystal is 1 m above the rider's floor and in frame; on the
  run-in it is 4 m up and out of frame, so the kicker and the pad are the cue.
- **Why on the far half**: the 1.2 m kicker's *height* hardly changes with speed (3.6 m at 12 m/s,
  3.8 m at 18 m/s); its *distance* doubles. A crystal past the apex tests speed; one at the apex would
  only test the ollie.

**C3 · Rail-end pop** — THPS precedent: NY City's rebar (tape just past the end of the bar), School's
awning end (Part III.2).

```js
{ t: 'rail', p: [0, 1.0, -40], len: 14, yaw: 0 },   // z -33 to -47; the deck ends at -40, so 7 m of rail hangs over the pit
// pit from -40 to -53, landing deck from -53
{ t: 'crystal', p: [0, 4.45, -51.5] },              // 4.5 m past the rail end, 3.3 m above the rail top
```

- **Route**: grind at 12 m/s, charge Jump on the rail and release just before its end. Collected at
  feet 3.37 m; lands on the far deck.
- **Ruled out**: a tap exit at the rail end peaks at 2.38 m and lands safely short of the crystal (a
  miss that does not kill); a charged ollie from the deck edge without the grind falls into the pit.
- **Tune**: the full exit adds 2.30 m above the rail top whatever the speed, so the crystal height is
  fixed by the rail; its distance past the end scales with grind speed (4.9 m to the apex at 12 m/s).

**C4 · Slipstream across a chasm** — THPS precedent: long-rail lines that end at a gap (Part V.4); this
engine's perfect-grind launch.

```js
// level: perfectGrindBoost: true
{ t: 'rail', p: [0, 1.0, -22], len: 24, yaw: 0 },   // z -10 to -34, ends at the deck edge
// chasm from -34 to -56, landing deck from -56
{ t: 'crystal', p: [0, 3.4, -47] },                 // 13 m past the rail end
```

- **Route**: join at the start of the rail, ride all of it, ollie off the end. The rail launches at
  48 m/s; collected at feet 2.37 m, 12 m past the end; lands 27 m out on the far deck.
- **Ruled out**: rolling off the end (apex 1.25 m) passes under the crystal and drops into the chasm;
  joining halfway (no boost, 12 m/s) falls short.
- **Note**: the boost needs ≥ 90% of the rail, so the rail's first metre is the skill gate. Make the
  start of the rail easy to catch (low, at the end of a run-up) and the chasm obviously too wide for an
  ordinary ollie (22 m against 9–14 m).

**C5 · Kicker, wallride, pumped wallie** — THPS precedent: San Francisco's hotel terrace (wallride +
wallie to the tape), Kona's fence wallride (Part III.5).

```js
{ t: 'speedpad', p: [-6.9, 0.05, -10.2], s: [3, 0.1, 3], speed: 18, yaw: -35 },  // on the kicker line, 12 m before it
{ t: 'ramp', p: [0, 0, -20], len: 4, rise: 1.8, w: 4, yaw: -35 },                // kicker aimed 35° at the wall
{ t: 'wall', p: [4.1, 0, -45], s: [50, 24, 1], yaw: 90 },                        // straight wall along Z, face at x = 3.6
{ t: 'crystal', p: [2.2, 12.5, -44] },                                           // 1.4 m off the face, 19 m downstream of the catch
```

- **Route**: pad, charged ollie at the lip, hold Grind in the air: the rider catches the wall 4.3 m up
  at 17 m/s; hold Jump 0.75 s and release (8.1 m up). Collected at feet 13.3 m.
- **Ruled out**: a tap wallie peaks at 6.2 m; not holding Grind misses the wallride and peaks at 5.7 m.
- **Placement rule**: the wallie flies *along* the wall at 0.7 × the wall speed and only 1–3 m out
  from it, so the crystal goes downstream (catch point + wall speed × pump time + 0.7 × wall speed ×
  0.6 s) and close to the face.
- **Camera**: 12.5 m is out of any default frame; this is an arena crystal (author a rig) or one teased
  from a roof across the way.

**C6 · High wire between roofs** — THPS precedent: Philadelphia's wire, College's clock-tower wire,
Venice Beach's High Wire (Part III.1).

```js
// roof A: platform top 5 m (z 0 to -20); roof B: top 5 m (z -50 to -70); plaza at 0 between them
{ t: 'rail', p: [0, 6.0, -35], len: 30, yaw: 0 },   // the wire, 1 m above both roofs
{ t: 'crystal', p: [0, 6.6, -38] },                 // on the wire, 60% of the way across
```

- **Route**: from roof A, a charged ollie with Grind held catches the wire; grind across and collect it
  on the rail (feet 6.15 m).
- **Ruled out**: from the plaza under it, a charged ollie peaks at 1.6 m.
- **Note**: a 30 m wire at 12 m/s lasts 2.5 s, past the ≈ 1.3 s an uncorrected grind survives: the wire
  is a balance test, which is exactly what Philadelphia's uphill wire asks for. The crystal is visible
  from roof A (0.6 m above its floor) and invisible from the plaza (6.6 m above it).

**C7 · Roof drop through the crystal** — THPS precedent: Venice Beach's original route (drop off the
highest roof through the tape), School's awning end (Part III.4).

```js
// roof: platform top 8 m (z 0 to -30); street at 0
{ t: 'crystal', p: [0, 8.0, -37] },   // 7 m past the roof edge, at roof height
```

- **Route**: a charged ollie off the edge at 12 m/s carries the rider through it (feet 9.56 m).
- **Ruled out**: rolling off the edge drops under it; nothing on the street reaches 8 m.
- **Why it works**: it turns the *top* of a climb into the skill gate. The crystal sits on the roof's
  own sightline (visible from the whole roof), and the climb to the roof is the route. Combine it with
  a climb that reuses the level's lines (C6's roofs, a kicker onto a lower roof, a wire up).

**C8 · Carve transfer off a quarter pipe's end** — THPS precedent: transfers out of a quarter pipe onto
a roof or deck beside it (Part V.3), channel and hip gaps.

```js
{ t: 'vertramp', p: [0, 0, -26], len: 12, w: 0.5, rise: 3.6, vkind: 'quarter', arc: 90, arcSteps: 24, deck: 2 }, // z -20 to -32, rises toward +X, coping at x = 4.1
{ t: 'platform', p: [3, 1.8, -49], s: [10, 3.6, 26] },  // roof at coping height, 4 m past the ramp's end
{ t: 'crystal', p: [4.1, 5.5, -34.5] },                 // over the gap, 2.5 m past the ramp end
```

- **Route**: from the flat in front of the ramp, carve up the face at 40° toward its end at 18 m/s and
  pump. The air drifts along the coping, leaves the end of the ramp, passes through the crystal (feet
  4.23 m) and lands on the roof 8.4 m past the ramp end. No bail.
- **Ruled out**: a straight pumped air at the very end of the ramp (even at 23 m/s, feet 10.75 m) comes
  back down on the face and never gets within reach; a 15 m/s carve falls into the gap, short of both
  the crystal and the roof.
- **Engine rule**: this works on *mesh-tracked* vert (quarter pipes, bowls, anything that is not a plain
  analytic halfpipe). A carved air off the end of an analytic halfpipe instead counts as a pipe-end
  fly-off and bails on flat ground unless it lands on another transition, a rail or a wall (XI.3).
- **Tune**: 40–45° carves worked from 15–23 m/s; 55–60° approaches clipped the roof's side or never
  reached vert air. The roof's height sets the landing; keep it at or below the coping.

## Part XV — Review checklist

Run this for every crystal, in order. Each line names the law it checks (Part 0) and where the
numbers are.

**Place**

1. Is the crystal on or over the level's signature feature or tallest landmark? (law 2)
2. Does it float past an edge — a coping, roof edge, rail end, wire, window — rather than sit on a
   floor? (law 3)
3. Is it off the main floor and away from the gate? The fallback crystal 6 m before the gate does not
   count as a placement. (law 19; XIII.3 items 1 and 5)
4. Is it out of reach of the cheap way? Not collectable standing on any floor near it (feet must be
   ≥ 0.5 m short of `p.y − 1.34`), not reachable by a flat ollie (reach 3.1 m) or an on-foot double jump
   (5.9 m) from any floor it can be approached from, unless the challenge is meant to be on foot.
   (law 11; XI.4)

**Show**

5. Is it seen before it can be reached, from a different place than it is reached from? (law 4)
6. Is it in the camera frame from that place? With the default rig, `p.y` ≤ the viewing floor + 3.3 m
   at close range (3.0 m at 20 m). If not, add a vantage at or above its height, or author the level's
   `cameraRig`. (law 5; XI.2)
7. Is the launcher readable on its own for the stretch where the crystal is out of frame? (law 9)
8. Do smaller pickups (wumpa lines, crate rows, a colored gem) sit on the route or at its start? Is
   there an icon-equivalent in the launch air? (law 8; II.3)

**Route**

9. Is the route built from lines the level already has, raised one layer? Does any geometry exist
   only for the crystal beyond its final perch? (law 6)
10. Is it one primary pattern plus at most two supporting ones (XII.13)? Is each supporting step taught
    elsewhere in the level, with the commit move taught first? (laws 1, 7)
11. Is the speed supplied (a drop-in, a run-up, a `speedpad`) and tested at the speed it actually
    delivers? (law 10)
12. Does every height and distance sit inside the margin for its career band (75% / 85% / 95% of the
    measured maximum)? (law 11; XI.6)
13. Does the route respect the engine rules: ollie at the lip, vert airs come home, wallride walls on
    the 90° grid approached at 20–60°, one wallride per air, balance on long rails? (law 18; XI.5)
14. Is there a second way up — an easier route, or an expert shortcut? (law 14; IV.6)
15. Does a route that starts at the spawn stay clear of the time-trial stopwatch? (XI.1)

**Fail and exit**

16. Is a miss before the commit cheap (a few seconds back to the start of the attempt)? (law 12; IX.2)
17. If the crystal hangs over a lethal drop, is there a checkpoint before the commit and is the gate
    reachable from the respawn? (law 13; XI.1)
18. Does the landing rejoin a line toward the gate? (law 15; VI.4)
19. If an unlock is needed: is the trigger on a visible prop, its effect visible where it happens, held
    for the run, and close in route to the crystal? (law 16; VII.2)

**Campaign**

20. Does the crystal's difficulty fit its place in the island and the campaign (one or two moves early;
    four to eight, a blind commit or a trigger late)? (law 17; IX.1)
21. Is it the only crystal-like challenge in the level, so the level has one clear "hardest thing"?
    (law 1)

**Verify**

22. Has the intended route been played with real inputs, and have the shortcuts it rules out been
    shown to fail? Add the crystal to `tools/verify-crystal-recipes.mjs` as a recipe, or play it in the
    browser on `/?lite` and once in the full render. (law 20)
23. Has the audit been re-run for the level with scratch output paths (`node
    tools/crystal-placement-report.mjs --levels <id> --json <scratch>.json --md <scratch>.md`), and do
    its reach class, height and camera-frame result match the intent?

## Appendix A — Every secret tape

One row per tape and version, from [`thps-bible/data/tape-index.json`](thps-bible/data/tape-index.json) (curated from the level files; heights are estimates in metres). "Above launch" is the height above the surface the final move leaves; negative means the tape is below it (taken on a drop).

| Level | Version | Where | Family | Above ground (m) | Above launch (m) | Final move | First seen | Steps | Moves | Unlock | Difficulty |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [`thps1-warehouse`](thps-bible/levels/thps1-warehouse.md) | original (kept in 2020) | glass sky box hung over the halfpipe | room or podium | 5.5–8 | 1–2.5 | vert / transfer | main floor (silhouette) | 6 | break-glass, transfer, vert-air | — | 1 |
| [`thps1-school`](thps-bible/levels/thps1-school.md) | original (kept in 2020) | just past the lower end of the long awning over the S stair rail | past an edge | 4–6 | 1–2 | ollie off an edge | from below (kicker court) | 8 | bank, lip, grind, manual, ollie | — | 2 |
| [`thps1-mall`](thps-bible/levels/thps1-mall.md) | original (kept in 2020) | between two hanging light rods at their far end, over the water hazard | wire, rail or rafter | 3–5 | -2–0 | ollie onto a high rail | from below (A under the rods) | 8 | kicker, ollie, grind, rail-transfer | — | 3 |
| [`thps1-downtown`](thps-bible/levels/thps1-downtown.md) | original (kept in 2020) | between two roofs, directly above the start alley | mid-air over a gap | 10–15 | 0–2 | vert / transfer | from its launch (roof bowl exit) | 9 | kicker, break-glass, grind, rail-transfer, vert-air, transfer | — | 3 |
| [`thps1-downhill-jam`](thps-bible/levels/thps1-downhill-jam.md) | original (kept in 2020) | four-rail podium on a rock pillar in the canyon below the dam | room or podium | 4–8 | -1–0 | gap jump into a grind | from its approach (high road) | 10 | vert-air, grind, rail-transfer, transfer, boneless | — | 5 |
| [`thps1-streets`](thps-bible/levels/thps1-streets.md) | original (kept in 2020) | over the Pagoda's glass roof in the plaza, taken dropping through the glass | mid-air over a gap | 5–8 | -12–-8 | kicker off a roof | from below (plaza) | 9 | vert-air, ollie, transfer, ledge, kicker, break-glass | — | 4 |
| [`thps2-hangar`](thps-bible/levels/thps2-hangar.md) | original (kept in 2020) | above the helipad quarter pipe, outdoors past a door the helicopter opens | above vert | 4.5–6.5 | 2–3 | vert | after the unlock | 6 | kicker, grind, unlock, bank, vert-air | yes | 2 |
| [`thps2-school-ii`](thps-bible/levels/thps2-school-ii.md) | original (kept in 2020) | in the roof gap beyond the library roof, at the door into the hidden Carlsbad area | mid-air over a gap | 6–8 | 0.5–1.5 | ollie off an edge | from its launch (library roof) | 6 | vert-air, kicker, ollie, grind | — | 4 |
| [`thps2-ny-city`](thps-bible/levels/thps2-ny-city.md) | original (kept in 2020) | off the end of a drooping rebar in the walled-off Brooklyn Banks | past an edge | 3–4.5 | 0–1 | grind exit | while grinding to it | 10 | grind, rail-transfer, ollie, manual | — | 3 |
| [`thps2-venice-beach`](thps-bible/levels/thps2-venice-beach.md) | original (kept in 2020) | just above the High Wire over the table plaza | wire, rail or rafter | 6–7 | -3–-1 | ollie off an edge | from spawn (sightline, ≈ 30 m) | 8 | ledge, manual, vert-air, transfer, wire, ollie | — | 3 |
| [`thps2-philadelphia`](thps-bible/levels/thps2-philadelphia.md) | original (kept in 2020) | 60% along the wire from a planter over the fountain up to a roof | wire, rail or rafter | 5–7 | 3–5 | ollie onto a high rail | from the plaza | 8 | ollie, wire, grind | — | 2 |
| [`thps3-foundry`](thps-bible/levels/thps3-foundry.md) | original | on a dark beam in the rafters, level with the observation platform | wire, rail or rafter | 6–9 | -1–0 | gap jump into a grind | from the observation platform / from below | 6 | bank, vert-air, grind, transfer, ollie | — | 3 |
| [`thps3-canada`](thps-bible/levels/thps3-canada.md) | original | at a fork in the mine-cart track on the mountainside | wire, rail or rafter | 15–25 | 0–2 | gap jump into a grind | top of the climb (behind the spawn) | 11 | grind, unlock, bank, vert-air, transfer, ollie | yes | 4 |
| [`thps3-suburbia`](thps-bible/levels/thps3-suburbia.md) | original | on the haunted house's flagpole, reached out of the top-floor front window | wire, rail or rafter | 5–7 | -1–0 | gap jump into a grind | from below (the cul-de-sac) | 10 | unlock, ollie, transfer, vert-air, kicker, break-glass, grind | yes | 3 |
| [`thps3-airport`](thps-bible/levels/thps3-airport.md) | original | top rail of the red window lattice on the north glass wall | wire, rail or rafter | 5–8 | 2–5 | vert / transfer | on entering the gates | 5 | transfer, vert-air, grind, wallride, wallie | — | 3 |
| [`thps3-los-angeles`](thps-bible/levels/thps3-los-angeles.md) | original | on a black pipe off the top of the purple tower | roof or landmark top | 12–18 | 0–1 | grind exit | from below (half pipe) | 8 | unlock, wire, ollie, kicker, ledge, grind, rail-transfer | yes | 4 |
| [`thps4-college`](thps-bible/levels/thps4-college.md) | PS1 2002 | roof-to-roof wire near the brick plaza | wire, rail or rafter | — | — | grind from a roof | unknown | 2 | ledge, wire | — | 3 |
| [`thps4-college`](thps-bible/levels/thps4-college.md) | remake 2025 | on the clock-tower wire | wire, rail or rafter | 12–16 | -4–0 | portal to the top, grind down | intro flythrough; tower visible down the street | 7 | grind, ledge, wire | — | 2 |
| [`thps4-san-francisco`](thps-bible/levels/thps4-san-francisco.md) | PS1 2002 | second terrace line above the glass entrance | roof or landmark top | — | — | unknown | unknown | — | — | — | — |
| [`thps4-san-francisco`](thps-bible/levels/thps4-san-francisco.md) | remake 2025 | above a planter on the hotel's top terrace | roof or landmark top | 10–12 | 2–3 | wallride + wallie | from below (hotel patio) | 7 | transfer, wallride, wallie, ledge | — | 3 |
| [`thps4-alcatraz`](thps-bible/levels/thps4-alcatraz.md) | PS1 2002 | water-tower roof rim | roof or landmark top | — | — | kicker off a roof | while grinding it | 3 | grind, kicker, ollie | — | 4 |
| [`thps4-alcatraz`](thps-bible/levels/thps4-alcatraz.md) | remake 2025 | just outside the cell block's top-tier window, above the water tower | past an edge | 10–14 | 0–1 | grind exit | intro flythrough; through the window from inside | 8 | unlock, vert-air, grind, ledge, ollie | yes | 3 |
| [`thps4-kona`](thps-bible/levels/thps4-kona.md) | PS1 2002 | end of the large building's roof ridge | roof or landmark top | 6–8 | 0–1 | grind exit | from the roof | 4 | wallride, wire, ledge, ollie | — | 3 |
| [`thps4-shipyard`](thps-bible/levels/thps4-shipyard.md) | PS1 2002 | rooftop block on the central building | roof or landmark top | — | — | unknown | unknown | 4 | grind, manual, ollie, ledge | — | 3 |
| [`thps4-shipyard`](thps-bible/levels/thps4-shipyard.md) | remake 2025 | beyond the end of a roof duct, over an alley | past an edge | 8–12 | -1.5–-0.5 | roll off an edge | on arriving on the roof | 6 | ollie | — | 2 |
| [`thps4-london`](thps-bible/levels/thps4-london.md) | PS1 2002 | wire above the parked double-decker | wire, rail or rafter | 4–6 | — | grind from a balcony | unknown | 4 | vert-air, grind, wire | — | 3 |
| [`thps4-london`](thps-bible/levels/thps4-london.md) | remake 2025 | air above an upper-roof quarter pipe or spine | above vert | 14–24 | 2–4 | vert | from the wire grind up | 5 | vert-air, wire, grind, spine-transfer | — | 3 |

## Appendix B — Tape case studies

One paragraph per tape level, in career order: where the tape is, how it is shown, the route, and
what to take for a crystal. The level files have the full routes with sources.

### THPS1

**Warehouse** (`thps1-warehouse`, career 1, difficulty 1). Inside a glass sky box hung on chains over
the halfpipe, ≈ 5.5–8 m up. The box's silhouette and lit window are in plain view from the floor.
Route: break the start-room window → drop down the long right entry ramp (the start room is the
highest floor, so the drop is the speed) → ollie over the halfpipe (Over the Pipe) → crash through the
box's glass. 6–8 s; a short jump lands in the halfpipe, which is itself a second way in. *Take:* the
first crystal sits on the level's signature arc and teaches what a crystal is at no search cost (P8).

**School** (`thps1-school`, 2, difficulty 2). Just past the lower end of the long awning over the S
stair rail, ≈ 4–6 m up. Seen from the busy court below, reached only from above. Route: concrete ramp
up the gym → roof → AC unit → grind the pipe down onto the awning → ride its length → ollie off the end.
The spawn canopy teaches the finishing move. *Take:* a route above a route; the final move taught at
spawn (P3, P7).

**Mall** (`thps1-mall`, 3, difficulty 3). Between two hanging light rods at their far end, over the
water hazard where the A sits, so every player sees it from below. Route: right walkway → over the car
→ blind ollie onto a rod → 30–40 m descending grind → timed hop between the rods. A miss on the one-way
course costs the run. *Take:* the signature object as the perch, a blind commit, a balance test, an
icon in the launch air (P6).

**Downtown** (`thps1-downtown`, 5, difficulty 3). In mid-air between two roofs directly over the start
alley, ≈ 10–15 m up: close in space, far in route. Route: truck-bed kicker through a window (T 2 T
Gap) → hidden tunnel → T in the glass skyway → roof bowl (pump for speed) → Roof 2 Roof. The gap names
give the secret away in order. *Take:* hidden corridor + speed source + one committed jump (P9 → P2).

**Downhill Jam** (`thps1-downhill-jam`, 6, difficulty 5). On a four-rail podium on a rock pillar in the
canyon below the dam. The A marks the branch to a parallel high road; rails → gap 1 → natural arch →
quarter-pipe carry over gap 2 → fastplant over gap 3 → land on any of four rails. Gravity supplies the
speed, so the test is control. One-way course: a miss loses it for the run. *Take:* on a linear course,
hang the crystal off a branch that rejoins the main line; make the final catch generous (P9).

**Streets** (`thps1-streets`, 8, difficulty 4). Above the glass roof of the plaza's Pagoda, taken while
dropping through the glass, 8–12 m below the launch. Route: corner quarter pipe → trench → Fountain Gap
→ two building walkways → narrow ramp → third roof → ski jump → Pagoda Gap. *Take:* climb, then drop;
the target is the centrepiece but the way in starts at another landmark (P7, P11).

### THPS2

**Hangar** (`thps2-hangar`, 1, difficulty 2). Above the snowy helipad quarter pipe outside the hangar.
Grinding a helicopter rotor blade makes it take off and opens the west door; the tape glows as you roll
onto the pad (12 s from trigger to tape). The E hangs over the door that opens. *Take:* curiosity about
the biggest prop is the challenge; the trigger and the crystal are close (P10 → P1).

**School II** (`thps2-school-ii`, 2, difficulty 4). In the roof gap beyond the library roof, between the
East Wing's flagpoles, at the doorway into the hidden Carlsbad area. Route: two pumped airs on the K
quarter pipe → across the stage → planter launch onto the two-storey roof ("2 Da Roof!!!") → ollie off
the roof edge → flagpole grind into Carlsbad. Seen only from the roof. *Take:* the crystal as the
entrance exam to a new district; a miss drops you into it anyway (P2, P9).

**NY City** (`thps2-ny-city`, 4, difficulty 3). Off the end of a drooping rebar in the walled-off
Brooklyn Banks, ≈ 3–4.5 m up. Three ways in (a low wall, a fallen pole, or the subway after five
tokens). Route inside: grind the first bar, hop early to a second bar whose start is hidden, ollie off
the end. *Take:* a hidden district with entries at three prices; the crystal at the peak of the
district's own line (P9 → P3).

**Venice Beach** (`thps2-venice-beach`, 5, difficulty 3). Just above "The High Wire" over the table
plaza, on the spawn sightline ≈ 30 m ahead. Two routes: a precise one from the ground (table → wire) and
a forgiving one from the roofs (pool → roof → cable grinds → rooftop quarter pipe → drop off the highest
roof through the tape). *Take:* one crystal, two routes at two prices (P6, P7).

**Philadelphia** (`thps2-philadelphia`, 7, difficulty 2). 60% along the long wire from a raised planter
over the fountain up to a roof, ≈ 5–7 m up. Route: ollie onto the planter, ollie onto the wire, hold an
uphill grind; a bell marks the wire's start. *Take:* the signature line as the route; discovery easy,
execution (balance over a drop) the test (P6).

### THPS3

**Foundry** (`thps3-foundry`, 1, difficulty 3). On a beam over the middle of the hall, ≈ 6–9 m up, the
midpoint of an upper loop reachable from both ends: a hard end (meter, sky, leaps) and an easy back door
from spawn (kicker, catwalk grind, break glass). Stat points and decks lead up the hard end. *Take:* a
crystal on a loop with two entrances at two difficulties (P6).

**Canada** (`thps3-canada`, 2, difficulty 4). At a fork in the mine-cart track on the mountainside,
≈ 15–25 m up, behind the spawn. Grinding the rope by the generator raises the log loader (persists for
the run); then banked wall → loader → two transfers → ollie → rail grind. One skater group's letters
walk the route; the exit drops onto the Around the Horn rope. *Take:* a switch on the route, a
staircase of vert transfers, the landing feeding the next goal (P10, P11).

**Suburbia** (`thps3-suburbia`, 4, difficulty 3). On the haunted house's flagpole, facing the main
circle. An errand (take the axe to the Thin Man) opens the house; the route runs through it (in the
front, out the back, up to the top floor, out the front window) into a pole grind. Breaking glass marks
the commit; Spooky Drop off the pole lands back at spawn. *Take:* a locked building overlooking the hub,
climbed from inside (P10, P8).

**Airport** (`thps3-airport`, 5, difficulty 3). On the top tier of the red rail lattice on the north
window wall, round a curve, ≈ 5–8 m up. Route: a narrow quarter pipe built into a gate doorway → land
on the top rail → hold a balanced grind round the curve. The same wall carries the flag rail and three
"class" gap rails below it. *Take:* the goals rehearse the crystal one tier lower (P6, P5).

**Los Angeles** (`thps3-los-angeles`, 7, difficulty 4). On a black pipe off the top of the purple tower,
≈ 12–18 m up, seen from the half pipe below. The earthquake (grind four rails round the library) breaks
the freeway into a road to the roofs; then cable → library roof → freeway → plywood kicker → roofs →
Busters Cherry sign → across the street gap to the pipe. *Take:* the crystal as the payoff of a
level-changing event; every link a scored gap (P10, P11).

### THPS4 (PS1 2002 and THPS 3+4 2025)

**College** (`thps4-college`). 2025: on the clock-tower wire, ≈ 12–16 m up, shown in the flythrough; a
teleport door at the tower's base drops you on the wire at the top, and a harder uphill rooftop route
also exists. PS1: on a roof-to-roof wire. *Take:* the landmark crown with a shortcut and a hard way
(P11, P6).

**San Francisco** (`thps4-san-francisco`). 2025: above a planter on the hotel's top terrace, ≈ 10–12 m
up, seen from the patio below; spiral ramp → quarter-pipe transfer → wallride + wallie (or grind the
hotel sign). PS1: the same building. *Take:* a visible tier one move out of reach (P5, P11).

**Alcatraz** (`thps4-alcatraz`). 2025: just outside the cell block's top-tier window, above the water
tower, ≈ 10–14 m up, locked behind Release the Prisoner; vert air → interior tiers → window rail →
ollie. PS1: on the water-tower roof via a kicker rail. *Take:* climb a locked building from inside and
leave through a window (P10, P11).

**Kona** (`thps4-kona`, PS1 only). At the end of the large building's roof ridge: wallride the fence →
wire up → ridge grind → ollie. *Take:* a four-step layered climb with the crystal at the end of the
highest line (P5, P3).

**London** (`thps4-london`). 2025: above an upper-rooftop quarter pipe near the billboard: the quarter
pipe at the base of the column launches you onto a wire ("Yet Another Wire"), then rooftop spine
transfers; the tape appears while you grind the wire. PS1: on the red wire from a balcony to the column
(the level's 1,500-point gap). *Take:* the column wire carries both versions; a quarter-pipe-to-wire
lift (P1, P6).

**Shipyard** (`thps4-shipyard`). 2025: in the alley between the two central warehouse roofs, just past
the end of a vent duct; a "Rooftops" door teleports you up, and you **roll slowly** off the duct. PS1: on
a raised brick block on a roof whose edges are a scored gap. *Take:* a crystal that rewards braking,
not air (P7 variant).

## Appendix C — The 36 levels

Each level file holds the full route-by-route map; the JSON twin is in `thps-bible/data/`.

| Level | Location | Type | Career # | Collectibles | Gaps | Lines | Tape |
|---|---|---|---|---|---|---|---|
| [`thps1-warehouse`](thps-bible/levels/thps1-warehouse.md) | Woodland Hills, California | career-park | 1 | 15 | 16 | 9 | Hidden tape (secret tape) |
| [`thps1-school`](thps-bible/levels/thps1-school.md) | Miami, Florida | career-street | 2 | 17 | 32 | 10 | Hidden tape (secret tape) |
| [`thps1-mall`](thps-bible/levels/thps1-mall.md) | New York | career-street | 3 | 15 | 17 | 9 | Hidden tape (secret tape) |
| [`thps1-skate-park`](thps-bible/levels/thps1-skate-park.md) | Chicago, Illinois | competition | 4 | 8 | 18 | 9 | no tape |
| [`thps1-downtown`](thps-bible/levels/thps1-downtown.md) | Minneapolis, Minnesota | career-street | 5 | 17 | 27 | 10 | Hidden tape (secret tape) |
| [`thps1-downhill-jam`](thps-bible/levels/thps1-downhill-jam.md) | Phoenix, Arizona | career-street | 6 | 17 | 7 | 10 | Hidden tape (secret tape) |
| [`thps1-burnside`](thps-bible/levels/thps1-burnside.md) | Portland, Oregon (under the Burnside Bridge) | competition | 7 | 8 | 14 | 8 | no tape |
| [`thps1-streets`](thps-bible/levels/thps1-streets.md) | San Francisco, California | career-street | 8 | 18 | 26 | 9 | Hidden tape (secret tape) |
| [`thps1-roswell`](thps-bible/levels/thps1-roswell.md) | Roswell, New Mexico | competition | 9 | 8 | 13 | 9 | no tape |
| [`thps2-hangar`](thps-bible/levels/thps2-hangar.md) | Mullet Falls, Montana | career-park | 1 | 26 | 22 | 10 | Secret tape above the helipad quarter pipe |
| [`thps2-school-ii`](thps-bible/levels/thps2-school-ii.md) | Southern California (a composite of real San Diego-area school spots: Rancho Buena Vista crest, the Carlsbad gap and 11-set) | career-street | 2 | 30 | 43 | 11 | Secret tape in the gap between the library roof and the East Wing |
| [`thps2-marseille`](thps-bible/levels/thps2-marseille.md) | Marseille, France | competition | 3 | 16 | 38 | 8 | no tape |
| [`thps2-ny-city`](thps-bible/levels/thps2-ny-city.md) | New York, New York | career-street | 4 | 16 | 43 | 10 | Secret tape |
| [`thps2-venice-beach`](thps-bible/levels/thps2-venice-beach.md) | Venice Beach, California | career-street | 5 | 26 | 41 | 10 | Secret tape over the High Wire above the table plaza |
| [`thps2-skatestreet`](thps-bible/levels/thps2-skatestreet.md) | Ventura, California | competition | 6 | 16 | 39 | 8 | no tape |
| [`thps2-philadelphia`](thps-bible/levels/thps2-philadelphia.md) | Philadelphia, Pennsylvania | career-street | 7 | 14 | 41 | 9 | Secret tape |
| [`thps2-bullring`](thps-bible/levels/thps2-bullring.md) | Mexico | competition | 8 | 20 | 31 | 9 | no tape |
| [`thps2-chopper-drop`](thps-bible/levels/thps2-chopper-drop.md) | Hawaii | bonus | — | 5 | 10 | 6 | no tape |
| [`thps2-skate-heaven`](thps-bible/levels/thps2-skate-heaven.md) | fictional floating islands in space (skate-history spots) | bonus | — | 3 | 70 | 9 | no tape |
| [`thps3-foundry`](thps-bible/levels/thps3-foundry.md) | a working steel foundry (no city named in the sources) | career-park | 1 | 24 | 45 | 10 | Secret Tape |
| [`thps3-canada`](thps-bible/levels/thps3-canada.md) | British Columbia, Canada (parking lot, skatepark, forest, mountain) | career-park | 2 | 26 | 85 | 10 | Secret Tape |
| [`thps3-rio`](thps-bible/levels/thps3-rio.md) | Rio de Janeiro, Brazil | competition | 3 | 10 | 27 | 7 | no tape |
| [`thps3-suburbia`](thps-bible/levels/thps3-suburbia.md) | suburban cul-de-sac on a fall afternoon (Halloween leftovers) | career-street | 4 | 26 | 57 | 10 | Secret Tape |
| [`thps3-airport`](thps-bible/levels/thps3-airport.md) | unnamed international terminal, in-fiction airline "Hawkair" | career-street | 5 | 30 | 52 | 9 | Secret tape — top rail of the northern window lattice |
| [`thps3-skater-island`](thps-bible/levels/thps3-skater-island.md) | Middletown, Rhode Island, USA (a real indoor park) | competition | 6 | 12 | 53 | 7 | no tape |
| [`thps3-los-angeles`](thps-bible/levels/thps3-los-angeles.md) | downtown Los Angeles, California | career-street | 7 | 32 | 64 | 9 | Secret tape — black pipe off the top of the purple tower |
| [`thps3-tokyo`](thps-bible/levels/thps3-tokyo.md) | Tokyo, Japan | competition | 8 | 11 | 100 | 10 | no tape |
| [`thps4-college`](thps-bible/levels/thps4-college.md) | Fictional California college campus and the streets around it (G4m p001 calls it a corner of the "California College campus"; the PS1 bowl floor is painted "California College", VG) | career-street | 1 | 41 | 71 | 9 | Secret tape (remake); Secret tape (PS1, not a listed goal) |
| [`thps4-san-francisco`](thps-bible/levels/thps4-san-francisco.md) | San Francisco, California: the Embarcadero waterfront with a hotel/plaza block, streetcar road, overhead walkway, warehouses and a Pier 39-style wharf (remake loading card: "Visit Pier 39 today!", LP34 1:12:50) | career-street | 2 | 29 | 46 | 8 | Secret tape (remake); Secret tape (PS1, not a listed goal) |
| [`thps4-alcatraz`](thps-bible/levels/thps4-alcatraz.md) | Alcatraz Island, San Francisco Bay, California (remake card: "Tours STILL running from Pier 39!", LP34 1:22:38) | career-street | 3 | 33 | 78 | 9 | Secret tape (remake); Secret tape (PS1, not a listed goal) |
| [`thps4-kona`](thps-bible/levels/thps4-kona.md) | Kona Skatepark, Jacksonville, Florida (in-game "Kona USA"; LP4 1:06:24 loading card) | career-park | 4 | 24 | 65 | 7 | Secret tape (PS1, not a listed goal) |
| [`thps4-shipyard`](thps-bible/levels/thps4-shipyard.md) | Industrial harbour shipyard; remake tour card 'SHIPYARD / CALIFORNIA', level card 'Moving Junk Since 1978' (LP34 4:14:40, 4:23:40) | career-street | 5 | 39 | 52 | 11 | Secret tape (remake); Secret tape (PS1, not a listed goal) |
| [`thps4-london`](thps-bible/levels/thps4-london.md) | London, England (Trafalgar Square analogue with Nelson's column, National Gallery, Admiralty Arch, Thames riverside, South Bank undercroft); remake card 'LONDON - Beautiful night, innit?' (LP34 4:23:50) | career-street | 6 | 27 | 33 | 11 | Secret tape (remake); Secret tape (PS1, not a listed goal) |
| [`thps4-zoo`](thps-bible/levels/thps4-zoo.md) | A zoo ('Welcome to The Zoo', 2002; no city named in 2002 sources); remake labels it 'Zoo - London' / 'THE ROYAL ZOO' (LP34 4:29:50), card 'ZOO - GO WILD!' | career-street (PS2 2002) / competition (THPS 3+4 2025) | 7 | 21 | 20 | 8 | no tape |
| [`thps4-carnival`](thps-bible/levels/thps4-carnival.md) | Rural county fair at dusk: 'Mullet County Fair with rides and games' (shop text, LP4 4:04:52); banner '2002 Deep South BareBack Championships' (LP4 4:11:36) | bonus | 8 | 14 | 18 | 7 | no tape |
| [`thps4-chicago`](thps-bible/levels/thps4-chicago.md) | Chicago, Illinois (El train on red pillars, raising drawbridges, river ferry, red Calder-like sculpture, green lion statues); load card 'Featured in... Mat Hoffman's Pro BMX 2' (LP4 4:24:24) | bonus | 9 | 15 | 13 | 7 | no tape |

## Appendix D — Engine numbers at a glance

| Quantity | Value | Part |
|---|---|---|
| Crystal pickup | feet between `p.y − 1.34` and `p.y + 3.0`; centre within 1.5 m per horizontal axis | XI.1 |
| Crystal reach of a move | feet apex + 1.34 m | XI.1 |
| Default camera: highest visible crystal | `p.y` ≤ viewing floor + 3.3 m (0 m ahead), + 3.0 m (20 m ahead) | XI.2 |
| Flat full ollie / tap | 1.78 m / ≈ 0.6 m feet apex; 9.4 m long at 12 m/s, 13.8 m at 23 m/s | XI.3 |
| On foot jump / double | 2.85 m / 4.59 m | XI.4 |
| Grind exit tap / full | +1.23 m / +2.30 m above the rail top; sideways 1.96 m / 3.25 m | XI.4 |
| Grind balance, no correction | tips off after ≈ 1.2–1.4 s | XI.3 |
| Slipstream | ≥ 90% of a rail → 48 m/s exit; roll-off 14.4 m, ollie-off ≈ 27.5 m | XI.4 |
| Kicker 0.8 / 1.2 / 1.8 m (ollie at lip, 18 m/s) | feet apex 3.0 / 3.8 / 5.8 m; lands 16 / 18 / 19 m past the lip | XI.4 |
| Kicker roll-off | never launches | XI.5 |
| Halfpipe, coping 3.6 m | coast clears from 18 m/s; pumped first air 2.0 m (15 m/s), 3.9 m (18), 7.1 m (23) above the coping; session cap ≈ 8.7 m | XI.4 |
| Carved air (23 m/s) | 15° / 30° / 45°: 4.0 / 3.1 / 3.3 m above the coping, drifting 4.7 / 8.7 / 13.1 m along it | XI.4 |
| Quarter-pipe carve off the end | 40–45° from 15–23 m/s lands on a deck beside the end (C8) | XIV |
| Spine transfer | analytic halfpipes on one axis, copings touching; second Jump release in the air with the stick over the ridge | XI.3 |
| Wallride catch | air, Grind held, ≥ 7.5 m/s, facing within 76°; straight walls on the 90° grid; one per air | XI.3 |
| Wallie pop above release | tap 1.68, 0.25 s 2.62, 0.5 s 3.86, 1.0 s 7.08, 1.5 s 11.27 m | XI.4 |
| Wallie best feet apex | flat entry 4.8–6.3 m; 1.8 m kicker at 18 / 23 m/s: 14.2 / 18.8 m | XI.4 |
| Trampoline | 3.75 m above its top; 5.90 m with Jump held | XI.4 |
| Margins | 75% early, 85% mid, 95% expert of a measured maximum | XI.6 |

## Appendix E — Glossary

| Term | Meaning (THPS) | Here |
|---|---|---|
| Secret tape | the hidden collectible on each THPS1–3 career level's goal list | the crystal |
| Goal list | the level's goals (scores, S-K-A-T-E, objects, tape) | the crystal, crates and gem goals, time trial |
| Gap | a named, scored transfer or grind route | no named gaps; use signage, pickups and the line itself |
| Line | a chain of tricks through a level | a route through the level's rails, ramps and vert |
| Transfer | air from one ramp or surface to another | kicker and bank launches; carve off a quarter pipe's end; spine transfer |
| Spine | two ramps back to back sharing a coping | two analytic halfpipes whose copings touch |
| Hip | two ramps meeting at an angle | — (approximate with a carve between quarter pipes) |
| Channel | a gap between two ramps | a gap between two quarter pipes, crossed by a carve or a kicker |
| Lip trick | a stall on the coping | lip stall |
| Revert | a vert landing turned into a manual | revert |
| Wire / powerline grind | a cable grind high over the floor | a high `rail` or `rope` |
| Wallride / wallie | riding a wall / ollieing off it | wallride / wallie (pumped) |
| Acid drop, boneless, wallplant | drop-in from a ledge into a ramp; on-foot pop; plant off a wall | absent (roll in from the deck; on-foot jump; wallie) |
| Skitch | holding onto a vehicle | `mover`, travelling `rail` |
| Unlock | a trigger that opens geometry | `!` crates, `spinbridge`, `trickgate` / `trickrail`, `returnportal` |
| Bonus icon | 100/200/500-point disc | a wumpa line, a crate, a colored gem |
| TAS | tool-assisted run: the fastest possible line | the expert shortcut a route should allow |
