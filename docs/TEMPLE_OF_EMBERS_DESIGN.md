# Temple of Embers · level design framework

Temple of Embers (`jungle-terraces`, Secret Island slot 2, unlocked by five all-box gems) is the
course where the game's two halves have to meet: Crash Bandicoot's readable corridor of crates,
hazards and checkpoints, and Tony Hawk's lines, transitions and speed that has to be earned.
This document records the principles used to re-author its layout, crates, enemies, fire and
scenery, and the Ember Reliquary bonus that now serves as the course's exam. It is the design
reference; `docs/LEVEL_ITERATIONS.md` holds the timed record and validation evidence.

The site is kept: both temple arms, the five jade reservoirs, the two stair climbs, the two switch
bridges, the two ollie gaps, the causeway, the lantern stair court and the cores. Everything the
player meets on that site was re-decided.

## 1. Pillars

1. **Two kinds of time.** Skating time is kinetic and low on decisions: banks, rails, bowls,
   gaps. Platforming time is slow and decision-heavy: crate order, switch circuits, fuse refuges,
   patrol reading. Chapters alternate between the two and never demand both at once until the
   climax. A checkpoint ends every chapter so the player can reset their attention.
2. **Introduce, develop, twist, conclude.** Every mechanic appears four times: alone on safe
   ground, combined with one other element, inverted or combined with a hazard, and finally
   as part of the summit. Act I (the Terraces) introduces; the causeway breathes; Act II (the
   Skyline) develops and twists; the Sanctuary concludes.
3. **Readable danger, paid risk.** Every hazard telegraphs before it harms: the sentinel's
   amber windup, the TNT count, nitro's green glow, the bull's planted windup, the sentry's
   charging lens. Every risk has a visible reward sitting inside it, and a visible safe lane
   beside it.
4. **Crates are the grammar.** A crate is a breadcrumb (it draws the line), a reward (it marks
   progress), a tool (arrow, striped support, steel footing), a puzzle (an order that can be
   got wrong) or a hazard (TNT, nitro). Each placement has exactly one of those jobs, and the
   all-box gem is the meta-objective that makes the optional lines and the bonus matter.
5. **Lines, not rooms.** Where the course skates, rewards sit on skate lines: low gold rails
   beside banks, caps suspended above the reservoir lips where every drop-in's air arrives,
   exit offerings on both carving lines out of a bowl, a pumped-return cap above the giant
   bowl's entry. Speed is never free; it pays in reach.
6. **Light is language.** Warm lamps mean safe ground. Paired lamps mean a banked checkpoint.
   No lamps mean a sentinel's territory, where its fire is the only light. Jade means a switch
   circuit. Scorched paving means a gauntlet.
7. **Checkpoint before a twist, never on a landing.** Every chapter that changes the rules
   starts from a checkpoint; no checkpoint, enemy or fire stands where a jump lands blind.
8. **Difficulty is combination, not numbers.** Nothing gets faster, longer or deadlier on its
   own; the course gets harder because elements the player already knows start overlapping.

## 2. Beat chart

Stations are route metres from the Fern court spawn (−20) to the sanctuary gate (1384). Intensity
is 1 (rest) to 5 (climax). Mode: S skating, P platforming, R rest.

| Ch. | Stations | Chapter | Mode | Int. | What is learned or combined | Crates | Enemy | Fire | Light |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | −20–34 | Fern court | R→P | 1 | Spin, count, mask; optional arrow-first room (life above) | mask, 3 wood, arrow room | — | — | arrival lamps |
| 1 | 34–151 | First bank and teaching reservoir | S | 2 | First low gold rail; first flame seen from the right-hand lane; first bowl, with its exit line | multihit inside the sweep; exit offerings; suspended exit cap | crab (open bank) | T1 teaches | lamps stop 14 m before the sentinel |
| 2 | 151–285 | Processional climb and switch court | P | 2 | Stair alternative with rewards; stomp lesson; `!` creates the visible bridge | climb mystery/life; switch; 3 rewards after the bridge | mossback (shell stays in the offering lane) | — | paired lamps at 151 |
| 3 | 285–359 | Three-times-high ascent | S | 2 | Timing an attack on a jumping foe while climbing at speed | offering beyond the frog | spring frog | — | paired lamps at 285 |
| 4 | 359–504 | Summit fuse court, sanctuary reservoir, first ollie | P→S | 3 | Cap before fuse, refuge, blast relay; fire over the court approach; 6 m ollie or gold rail | TNT court and relay cache; exit line; landing mysteries | — | T2 over the court approach | summit lamps, none at the sentinel |
| 5 | 504–600 | Torch causeway | R | 1 | Breath. Lantern stair court (optional steel-tower restoration); Ember Reliquary bonus; mask for Act II | 48 steel + 3 rewards; mask; weaving pickup line | — | — | courtyard braziers |
| 6 | 600–805 | Return gallery, bull bank, cloud reservoir | P→S | 3 | Arrow room gains a return switch; the bull owns the centre of its bank; the sentry covers the apron; flame sweeps the drop-in lane | return rewards; bull refuge offering; sentry's life; multihit; exit line | russet bull, ember sentry | T3 on the drop-in lane | lamps at 632 only |
| 7 | 805–920 | Cloud fuse reprise and crown bank | P | 4 | Fuse reprise chains a nitro; a hovering watcher over the fast lane while the pilgrim stair is the slow safe route; the stomp habit is punished | TNT court + chained nitro; climb rewards; offerings | violet watcher, bristleback | T4 beside the bank | lamps at 832 |
| 8 | 920–1049 | Crown court and sun crown reservoir | P→S | 4 | First nitro beside the lane (never touch); arrow kept for the high life; `!` bridge into the bowl | 2 nitro; crown arrow + life; switch; exit line | — | — | crown lamps |
| 9 | 1049–1152 | Rising sun and the giant reservoir | S | 4 | The biggest bowl: exit line plus a pumped-return life above the entry lip | rhythm pair; exit line; entry life | — | — | paired lamps at 1049 |
| 10 | 1152–1194 | Descending aqueduct | S | 3 | Flame guards the gold rail mount: time the grind entry or take the open right lane | — | — | T5 at the rail mount | none: scorched paving |
| 11 | 1194–1345 | Final leap and the Ember Gauntlet | S→P | 5 | 7 m ollie, landing under a flame, mask, then three sentinels in a staggered wave with offerings inside each sweep | mask; 3 mysteries; 3 gauntlet offerings | — | T6 landing; T7–T9 wave | none: fire only |
| 12 | 1345–1392 | Sanctuary | R→P | 2 | Victory lap: a procession between two crossing guardians, flanked by nitro; crystal; green switch counts every nitro; gate | 3 procession wood; 3 nitro; green switch | two crabs crossing opposite halves | — | sanctuary lamps |

## 3. Mechanic arcs

| Mechanic | Introduce | Develop | Twist | Conclude |
| --- | --- | --- | --- | --- |
| Flame sentinel | T1 (94) beside the first terrace; its sweep reaches a striped crate but not the right-hand lane | T2 (375) sweeps the summit court approach, where the TNT puzzle wants your attention | T3 (734) sweeps the reservoir drop-in lane; T4 (872) makes the stair the slow safe route; T5 (1176) guards the rail mount; T6 (1252) waits at the landing of the final leap | T7–T9 (1278/1300/1322) alternate sides with phases a third of a cycle apart: a wave to weave through |
| Reservoir (bowl) | r6 teaching bowl with a low exit line | r9 bowl after the fuse court | r12 and r14 bowls arrive at speed from a flame lane and a switch bridge | r18 giant bowl: exit line plus a life above the entry lip that needs a pumped return (or a hop from the aqueduct rail) |
| Gold rail | First bank grind, 0.8 m above the slope | Ascending aqueduct grind beside the stair | Rails over both switch bridges and the two gaps; the aqueduct rail passes beside every suspended cap | Final gap grind as the fast finish line |
| Switch bridge | `!` at 249 creates the jade bridge at 256 | `!` at 619 reveals the earlier return-gallery rewards | `!` at 948 creates the crown bridge straight into the sun crown bowl | The green `!` at 1378 changes the whole level's count |
| Arrow room | Fern court: keep the arrow, claim the life above, destroy the arrow last | Return gallery: the rewards are outlines until a far switch reveals them | Crown arrow with a life ten metres up, beside the first nitro | The bonus turns the arrow into the key to a switch |
| Fuse court | Summit: stomp the cap, prime, retreat to the marked refuge; the blast flips a relay and restores a cache | Cloud reprise: the blast also detonates a chained nitro | — | The bonus vault repeats the cap-before-fuse order in side view |
| Nitro | Two glow beside the crown court lane: look, never touch | One chained inside the cloud fuse blast | Three flank the sanctuary procession | The green switch beyond the crystal counts all six at once |
| Enemy reading | Crab on open ground | Mossback (stomp), frog (timing) | Bull (dodge, then strike while dizzy), sentry (ranged), watcher (hover), bristleback (no stomp) | Two crabs crossing opposite halves of the procession |

## 4. Crate inventory

Counted boxes (everything except steel, steel arrows and switches): **89 on the main course, 17
in the bonus, 106 in all.** By job:

| Job | Kinds | Where |
| --- | --- | --- |
| Breadcrumb lines | wood | opening rhythm (9–17), weaving arrival line (584–592), bridge rewards, rising sun pair, sanctuary procession |
| Skate-line rewards | wood, life | exit offerings on both carving lines of all five bowls; a suspended cap above each exit lip; the giant bowl's entry life |
| Encounter offerings | wood, mystery, life | one stack after each encounter, capped with a mystery where the lesson changed (bull, bristleback); the sentry's life |
| Tools | bouncy, multihit, metal | three arrows (Fern court, return gallery, crown); two striped crates, one inside a sweep; 48 steel steps of the lantern stair |
| Puzzles | bang, outline rewards | two bridge switches, one return switch, one lantern switch, two blast relays with outlined caches |
| Hazards | tnt, nitro, nitrobang | two capped TNT with refuges; six nitro; one green switch |
| Milestones | life, mask, mystery | masks before the first ascent, before Act II and before the gauntlet; lives on both stair tops, above arrows, over the giant bowl, behind the sentry and on the lantern shelf |

Rules applied to every placement: visible before commitment, never on a blind landing, never
within spin reach (1.3 m) plus blast radius (2.75 m) of a nitro, the pilot lane at +1.25 m stays
clear of every nitro by more than a body width, and no counted box depends on a hidden route.

## 5. Enemy roster

Seven of the game's eight kinds, each placed where its rule is legible and its escape lane is
open. Patrols are axis-bound, so crossing patrols walk the lane's cross-axis and the bull runs
along the one long straight bank that has no rail on its side.

| Station | Kind | Placement rule | Lesson |
| --- | --- | --- | --- |
| 56 | crab | open bank, centre, escape both sides | spin or stomp |
| 198 | mossback | offering lane; its solid shell stays there | stomp, then the shell is footing |
| 319 | spring frog | long straight ascent | attack only while it is grounded |
| 660 | russet bull | centre of the long rolling ascent, 18 m lane, right-hand lane clear | read the windup, step aside, strike while it is dizzy |
| 727 | ember sentry | pipe apron, right side | jump the slow orb, spin the body; its life is behind it |
| 848 | violet watcher | over the crown bank's fast lane | jump-spin, or take the pilgrim stair |
| 896 | bristleback | after the crown flame, left lane | the stomp habit is punished |
| 1352 / 1362 | two crabs | crossing opposite halves of the sanctuary, ten metres apart | the centre lane stays clear; rhythm, not threat |

## 6. Scenery and wayfinding

- **Landmarks per chapter.** Gateway arches mark chapter starts (Fern court, Jade reservoir,
  Bridge court, Sanctuary garden, Sanctuary landing, Forest arrival, Cloud reservoir, Crown court,
  Cloud garden, Upper landing, Ember Gauntlet, Sun sanctuary). Roofed halls mark rests.
- **Lamps.** Guidance lamps every 26 m on alternating shoulders, skipping gaps and any station
  within 14 m of a sentinel. Paired lamps stand at every checkpoint and at the start of each
  patrol bank. The aqueduct flame and the gauntlet have no lamps at all.
- **Paving.** Worn processional slabs on every encounter bank, scorched slabs under the
  sentinels of the aqueduct and gauntlet, fitted court paving on the causeway and lantern court.
- **Planting.** The Treehouse library (ancient trees, crowns, ferns, groundcover) at measured
  proportions, rooted outside every route arm; reservoir masonry, piers and vines tie each bowl
  to its storey.
- **Night.** Moon fill and fog keep floor edges readable; the sentinel crowns and torches share
  the bounded six-light pool.

## 7. Ember Reliquary (bonus)

A side-scrolling exam of the course's vocabulary in the order the course taught it. Seventeen
counted boxes; a bonus death returns to the parent as usual, so the vestibule gives a mask first.

| Room | x | Decision | Boxes |
| --- | --- | --- | --- |
| Offering vestibule | 0–20 | spin, count, and take the mask before the fire | wood ×2, mask, mystery |
| Ember gate | 20–42 | a sentinel behind the lane breathes across it toward the viewer, sweeping about six metres of floor; two offerings stand inside the sweep | wood ×2 |
| Jade bridge chain | 42–86 | keep the arrow; bounce to the shelf; strike the high `!` so the outlined bridge becomes real; drop back; clear the arrow last; cross; collect | arrow, mystery, wood, mystery |
| Fuse vault | 86–112 | stomp the wooden cap, double-jump for the life, return to prime the TNT, wait in the marked refuge | TNT, wood, life, mystery |
| Nitro corridor | 112–156 | jump three volatile offerings seven metres apart, then strike the green switch beyond them | nitro ×3 |

The dependency chain is deliberate: the arrow is both a counted box and the only key to the
switch; the bridge cannot be crossed before the switch; the life above the TNT disappears with its
support; the three nitro only count through the green switch, which must be struck from outside
every blast radius.

## 8. Kept on purpose

The merged two-arm route, its heights, turns and bowl radii are unchanged because the collision,
camera spine and support were already audited. The lantern stair court and both blast relays are
kept because they already express their lessons well. Movement tuning is untouched. The level
uses only existing editor components: no new runtime system was required.

## 9. Validation (8 November 2026)

All checks ran against the final source. Evidence is in `docs/temple-embers-design/`.

| Check | Result |
| --- | --- |
| `tools/test-temple-night.mjs` | 3,625 five-lane support and body-clearance probes pass; 9 sentinels, 96 torches, 12 checkpoint warps, pit recovery |
| `tools/temple-embers-audit.mjs` | 2,192 shoulder probes with no missing support; 18 lateral exits supported; 16 masonry side sweeps blocked; 9 enemies |
| `tools/test-temple-night-flow.mjs` | continuous input-only journey finishes in 7,877 fixed steps / 131.3 s with zero deaths, both mainline gaps ollied, both switch bridges created |
| `tools/test-temple-embers-encounters.mjs` | all nine patrols supported along their whole span and defeated unmasked, ending upright: crab, mossback, frog, bull (struck from the shoulder while winding up), sentry, watcher, bristleback, two sanctuary crabs |
| `tools/test-jungle-sequel-crates.mjs` | both arrow rooms (correct and wrong order), the crown arrow, and both TNT refuges pass; the cloud reprise now also chains its nitro |
| `tools/test-temple-embers-puzzles.mjs` | lantern stair: switch, 48 restored steel steps, 3 rewards, supported return |
| `tools/test-jungle-sequel-climbs.mjs`, `test-temple-fire.mjs`, `test-jungle-sequel-bank-clearance.mjs` | pass unchanged |
| `tools/test-ember-reliquary-bonus.mjs` | 17/17 boxes, gem, zero deaths, no mask spent at the ember gate; the chasm stays open until the high switch; `themed-bonus-puzzles --id=bonus-jungle-terraces` passes through the shared pilot |
| `npm run check:levels`, `npm run build` | pass after `sync-temple-night` and `certify-stock-levels` |
| Browser (Chromium, `?playtest&level=…`) | lite: 19 temple stations and 9 bonus views supported with a clean console; full render: 7 stations and 3 bonus views, clean console, `Codex/sol fork` stamp |

Known limits: the suspended reservoir caps and the giant bowl's entry life are reachable by a
bowl air or a hop from the adjacent aqueduct rail by construction (bottom 2.6 m above the lip,
reached with 0.8 m of feet clearance), but no automated pilot performs a vert air; they remain
the course's mastery items.
