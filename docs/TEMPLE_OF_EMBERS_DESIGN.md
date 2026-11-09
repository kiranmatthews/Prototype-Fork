# Temple of Embers · level design (bible pass)

Temple of Embers (`jungle-terraces`, Secret Island slot 2, unlocked by five all-box gems) is where
Crash Bandicoot's crate corridor and Tony Hawk's earned speed have to meet. This pass re-authored
the course against [`GAMEPLAY_DESIGN_BIBLE.md`](GAMEPLAY_DESIGN_BIBLE.md): Part 0 as binding law,
Parts XV–XVII for this engine's measured reach, Part XIX for the recipes and Part XX as the gate.
The previous pass (seven rooms, foot climbs and board flats) kept its site but failed the bible's
own audit: 92 % of its crate clusters were single boxes (mean size 1.08 against the 2.5 floor), it
had a 20 m "fruit on a string", nine lethal gaps in one section with no rest, an enemy debuting at a
lethal edge, and a 63 m stretch with no beat. Those numbers were the brief for this pass; the
results are in §7.

Source: `src/levels/temple-of-embers.ts` (world space; stations are metres along −Z from the arrival
ledge, `x` across, negative left; crates on the 0.96 grid). `docs/LEVEL_ITERATIONS.md` holds the
timed record, `docs/temple-embers-design/` the evidence, including both bible reports.

## 1. Laws applied here

| Law | How this course obeys it |
|---|---|
| 1–3 Crates are a second game; cluster, don't sprinkle; one named job per cluster | Every placement is a cluster with a job named in its component label (teach, test, reward a risk, bait, tool, gate, lane marker, count trap). Result: 168 counted crates in 66 clusters, mean 2.56, nine singles (5 %). |
| 4 Introduce alone, recombine later | Board smashing, TNT, the arrow, the double jump, each sentinel rung and each enemy kind first appear alone where failure is cheap; the fuse court, the abutment and the terrace recombine them. |
| 5 Order is the puzzle | A one-shot height budget (R3), an arrow gate (R2) and a TNT with its payout beside it have tempting wrong orders that lose a box. |
| 6–7 Explosives have jobs; price rewards by risk | TNT: a clearer with a payout (teach), then the same silhouette with the TNT on top (test). Nitro: two rows that bound the landing lane behind the dais, counted by the green `!` last. Lives: over the ravine, over a Nitro row, above an arrow gate. Masks: the shrine, and one before the narrow stair. |
| 8 Checkpoints follow the crate rhythm and mode changes | Eleven checkpoints; 11–20 counted crates in every section but the declared timing peak (5); one at every board/foot change; four inside fast-line lane groups; none on a rail or timed footing. |
| 9 Fast lines: lanes as commands, no explosive on the forced line | Smash stacks on the floor and the descent, a crate bridge over the Ravine Break, a 42 m clear run-up before the charge gap, lane stacks 1.5 m off the line, Nitro only beside the lane where the rider can stop. |
| 13 Couple, don't widen | Foot gaps 3.5 m (plain band) coupled to a rise, a landing crab or a cycle; the one wide board gap is a deliberate 11 m charge check. |
| 14–15 Forgiving debuts; one variable at a time | Debut floors ≥ 14 m with no lethal edge for every enemy kind (the geometry report finds all four debuts "alone, safe, no edge"); sentinels climb debut → repeat → invert → combine → wave. |
| 17–18 Rest after 3–5 jumps; no-stop only from footing or a pursuer | The climb is two runs of three hops with a 6 m tier between; nothing forbids stopping except the sentinel pair's cycle. |
| 20 Landing size and occupancy are the dials | Climb landings 4 m deep, one occupied; teaching landings and checkpoint floors ≥ 6 m. |
| 21–22 Place enemies for position; rhythm by speed | Each kind climbs across → along → landing; 92 beats over 875 m (10.5 per 100 m), one every 13.5–18 m on foot and 24–36 m at cruise; the terrace heads are phased for 12 m/s. |

## 2. Sections

Eleven checkpoints cut the 876 m course into twelve sections. Counts are the bible's crate report
(`crate-placement-report.json`, sections by checkpoint). The colonnade is a declared optional route.

| # | Stations | Floor | Mode | New element | Counted | Clusters |
|---|---|---|---|---|---|---|
| S0 | −16 → 50 | 4 → 0 | board | smash speed (three 3-stacks after the bank) | 13 | 3-stack, 3-stack with a `?`, 3-stack, shrine stack with the mask on top, lane 2-stack |
| S1 | 50 → 165 | 0 | board | sentinel debut; the gutter grind | 18 | lane 2-stack, 3-row beside the coping (a parallel grind line), one box over the coping, sweep 3-stack, 2 × 2 bait block behind the crab, stair-foot 3-stack, lane 2-stack |
| S2 | 165 → 241.5 | 0 → 8 | foot | lethal gaps (the collapse); the crab along the lane | 11 | lane 2-stack, 3 × 2 wall with a `?` guarded by the crab, landing `?`, trap 2-stack |
| S3 | 241.5 → 315 | 8 → 16 | foot | TNT (teach), arrow gate, the double jump, the climb | 19 | TNT clearer + `?`, arrow + 3-row above it, sweep 2-stack, balcony 3-stack, rest-tier 2 × 2 block, side-ledge life, court trap 2-stack |
| S4 | 315 → 410 | 16 → 24 | foot | TNT (test), the censer, the bristleback | 20 | TNT-on-top + `?`, mask stack, pyramid, sweep 3-stack, one stack between the mossback and the censer, sandwich (row + lid), stair-top 3-stack |
| S5 | 410 → 486 | 24 → 16 | board | the smash lane on a descent; the frog | 11 | three 2-stacks 12 m apart (R8), head 3-stack, lane 2-stack |
| S6 | 486 → 548 | 16 | board | the one-way crate bridge | 14 | lane 2-stack, 6-crate bridge (R7), landing marker |
| S7 | 548 → 642 | 16 | board | the charge gap | 14 | landing `?`, two lane 2-stacks, 3-stack with a `?`; colonnade block, row and stack |
| S8 | 642 → 665 | 16 | board | the abutment pair (declared timing peak, IV.4) | 5 | trap 2-stack, 3-stack beyond the sweep |
| S9 | 665 → 739 | 16 → 19.5 | board / foot | cover crates; the cornice switch and its promise | 12 | lane 2-stacks, cover row (wood, steel, wood), promise 2 × 2 block (ghost until the `!`), pair over the entry lip, pair on the exit arc |
| S10a | 739 → 781 | 19.5 → 30 | foot | the sanctuary steps | 11 | gallery 3-stacks, terrace lane 3-stacks, trap 2-stack |
| S10b | 781 → 876 | 30 | board | the sentinel wave; Nitro rows; the green `!` | 20 | 3 × 2 wall with a `?`, two Nitro rows of three, life over the right row, height-budget 3-stack + `?`, green `!` |

Lives: three (the arrow gate's row, the side ledge, over the Nitro). Masks: two (the shrine stack, the
court stack before the narrow stair). The nine singles are the box over the coping, the two landing
markers, the arrow, the side-ledge life, the sandwich lid, the Ravine Break landing marker, the
height-budget target and the life over the Nitro.

## 3. Beat chart

Mode S skating, P platforming, R rest. Crates name their recipe where one applies.

| Stations | Beat | Mode | Crash half → skating half | Crates | Enemy | Fire |
|---|---|---|---|---|---|---|
| −16–30 | Arrival ledge and bank | S | open safe: a lit ledge, a 4 m bank | — | — | — |
| 34–44 | Smash stagger | S | three 3-stacks on the line: at ≥ 12.5 m/s they clear whole, slower trips (XV.4) | 3, 3 (`?` top), 3 | — | — |
| 40 | Shrine | S | the mask on a wood crate in its niche | 2 | — | — |
| 47–53 | Checkpoint lane group | S | R10 with stacks 1.5 m off the line: thread them, or take them at speed | 2, 2 | — | — |
| 60–120 | Gutter grind | S | ollie onto the coping; a 3-row on the floor beside it is a parallel line half a metre higher; one box over the coping for a grind jump (XVI.9) | 3, 1 | — | sleeping sentinel at 70 (debut: 14 s cycle, watched from the floor) with a 3-stack in its sigh |
| 95–120 | Crabs in the open | S | across the 28 m floor, roomy, opt-out (XIII.2) | 2 × 2 bait block behind the first | crab, crab | — |
| 146–172 | Stair foot | S→P | a 3-stack to smash, the lane group, dismount | 3, 2, 2 | — | — |
| 176–186 | Gateway | P | the crab paces ALONG the lane (rung 2) in front of a 3 × 2 wall whose top centre is the `?` | 6 | crab (along) | — |
| 200–212 | The collapse | P | two plinths, 2.3 / 2.0 / 2.75 m gaps; nothing on the plinths; a `?` marks the far lip | 1 | — | — |
| 212–240 | Upper run | P | a count trap at the run's top-right corner beside a fallen block | 2 | — | — |
| 240–266 | First landing | P | the mossback debuts on open floor; the TNT clearer (R4) four metres on with its `?` beside it; the arrow gate (R2) in the back corner; the sentinel a beat after the TNT with the balcony above it (double jump and grab only) | 3, 4, 2, 3 | mossback (debut) | sentinel at 262 (repeat) |
| 266–309 | The climb | P | six hops of 3.5 m rising +2, +2, +2, +1, +1, 0; a 6 m tier after three with a 2 × 2 block; a crab on the fifth landing (spin in the air); a life on a side ledge 4 m out | 4, 1 | crab (landing) | — |
| 309–342 | Fuse court | P | trap behind the checkpoint; the clearer's silhouette with the TNT on top (B2); mask stack; pyramid; the sentinel's sweep stack is the invert | 2, 3, 2, 3, 3 | — | sentinel at 334 (invert) |
| 342–396 | Narrow stair | P | 6 m wide between pits; the mossback on the line; the censer debuts with the stair as the waiting floor; one stack in the safe window | 2 | mossback (on the line) | censer at 382 |
| 396–424 | Stair top | R | the bristleback debuts alone on a 16 × 28 m floor; a payout sandwich (R1); a 3-stack | 3 + 1, 3 | bristleback (debut) | — |
| 424–476 | The sluice | S | 15 % descent: smash lane (R8), three 2-stacks 12 m apart | 2, 2, 2 | — | — |
| 474–489 | Aqueduct head | S / P | the frog debuts on the 6 × 12 m head; checkpoint in a lane group in the channel | 3, 2, 2 | frog (debut) | — |
| 520–527 | Ravine Break | S | 7 m level break (plain board band); a 6-crate row on the bed line is a one-way grind bridge (R7); the ollie is the fast line | 6, 1 | — | — |
| 548–590 | Clear run-up | S | checkpoint, then 42 m with nothing to do but charge (XVII.1) | — | — | — |
| 590–601 | Far Break | S | 11 m level charge gap: a cruise ollie (9.4 m) fails, 18 m/s (12.6 m) clears | landing `?` | — | — |
| 601–640 | Third span | S | lane beats one each side, a 3-stack to smash | 2, 2, 3 | — | — |
| 640–658 | Abutment court | S / P | both breaths meet in the middle: cross in the cool phase (combine); trap in the corner; a 3-stack beyond | 2, 3 | — | pair at 649 |
| 658–672 | Cistern entry | S | checkpoint lane group; the ghost block visible across the basin | 2, 2 | — | — |
| 684–706 | Jade basin | S | drop in and cross at speed; a pair over the entry lip (pop), a pair on the exit arc | 2, 2 | sentry on the right floor behind cover (XVII.6) | — |
| 690–729 | Broken cornice | P | seven ledges up the left wall; the `!` on its landing | `!` | — | niche sentinel at 716 over the right half of the exit |
| 692–712 | Hall beyond the basin | S / P | cover row before the sentry (wood, steel, wood); the promised 2 × 2 block appears when the switch fires: switch, then return down the ramp (VII C2) | 3, 4 | — | — |
| 721–744 | Ramp and gallery | S→P | ride up; the checkpoint, then two 3-stacks with the lane open between them | 3, 3 | — | — |
| 744–776 | Sanctuary steps | P | four 3 m gaps rising 2.25 m; the bristleback on the second step (rung 2); no crates on the steps | — | bristleback (landing) | — |
| 776–803 | Terrace approach | S | lane 3-stacks round the checkpoint, a trap beside it, a 3 × 2 wall with a `?` on the left; two heads 8 m apart phased 0.67 s for 12 m/s (XVII.3) | 3, 3, 2, 6 | — | sentinels at 792 (left) and 800 (right) |
| 803–834 | Dais launch | S | the shallow bank throws any speed onto the 22 m dais; crystal and braziers | — | bull on the far right (debut: the dais is the perch) | — |
| 834–862 | Behind the dais | S / P | two Nitro rows 1.5 m outside the dais's width bound the landing lane (XVI.10) with a life 3.5 m over the right row; the third head half a cycle off is the wave's break; the one-shot height budget (R3); the green `!` counts the rows | 3 + 3, 1, 3 + 1, `!` | — | sentinel at 843 |

## 4. Ladders

**Fire sentinels** (one family, nine heads at 0.8 scale on floor slabs so the breath crosses the body):

1. Debut — ravine floor, 14 s cycle, narrow sweep, watched from open floor, a 3-stack inside its sigh.
2. Repeat without the pause — first landing, left side, one beat after the TNT lesson; the balcony stands
   above it, so its sweep lies across the approach to the balcony.
3. Invert — fuse court: the reward is inside the sweep; enter while it is cool.
4. Combine — the abutment pair: both breaths meet in the middle; there is no safe lane, only the cool phase.
5. Wave — terrace: two heads phased 0.67 s apart for a board at 12 m/s (phases 0 and 7.13 s), a third after
   the dais half a cycle off (7.53 s) over the landing lane's left half.

**Censer** (second family): one debut over the narrow stair, with the stair itself as the waiting floor.

**Enemies** (twelve, six kinds), one rung per appearance:

| Kind | Debut (roomy, no lethal edge) | Next rungs |
|---|---|---|
| crab | across the ravine floor, 28 m wide, two of them | along the gateway lane (`yaw 90`), then on the fifth climb landing |
| mossback | the first landing, 4 m before the TNT and 17 m before the sentinel | on the narrow stair between pits |
| spring frog | the aqueduct head, 3.6 m from the channel bank | on the colonnade between its fallen floors |
| bristleback | the stair top terrace | the second sanctuary step (landing) |
| ember sentry | the cistern's right floor behind a cover row | — |
| russet bull | the terrace's right side, watched from the dais | — |

## 5. Gaps and footing

| Gap | Kind | Width | Move | Coupling | Landing |
|---|---|---|---|---|---|
| Collapse plinths (200–212) | pit | 2.3 / 2.0 / 2.75 m | plain | the first lethal gaps; a `?` marks the far lip | 2.5 m plinths, then the 28 m upper run |
| Climb hops (266–309) | pit | 3.5 m, +2 m rise ×3, +1 m ×2, level ×1 | plain (full jump) | run of three → 6 m rest tier → run of three; the crab on hop five | 3.5 × 4 m ledges, a 6 × 6 m tier |
| Side ledge (296) | pit | 4 m lateral | plain | the life is the price | 3.5 m |
| Colonnade floors (500, 540, 580) | pit | 2.8–3 m | plain | the frog between the second and third | walled 6 m walkway |
| Ravine Break (520–527) | pit | 7 m, level | full ollie from cruise (9.4 m) or grind the bridge | the bridge is consumed; the fast line is free | the channel bed, a marker 1.5 m off the line |
| Far Break (590–601) | pit | 11 m, level | charge (12.6 m at 18 m/s) | 42 m clear run-up; checkpoint at its start | the bed, a `?` 7 m on |
| Basin (684–706) | banked road | — | drop in | none; the sentry's line is blocked below the rim | — |
| Cornice (690–729) | pit under the last three | 2 m | step | the drain under the last steps | 4 m ledges, 4 m landing |
| Sanctuary steps (744–776) | pit | 3 m, +2.25 m | plain | the bristleback on step two | 5 m steps |
| Dais gap (810–812) | floor | 2 m | the bank throws | none: release | 22 m dais |

Checkpoint floors are 6 m deep or more; no checkpoint stands on timed footing, a ledge or a rail.
Checkpoints on the board line bank at smash speed and trip below it (the engine's rule), so each one
sits where the line is fast or where the rider has just mounted, and lane stacks stand 1.5 m off the line.

## 6. What changed from the previous pass

- Crates: 64 singles and stacks → 168 counted boxes in stacks, rows, walls, a bridge, a pyramid, a
  sandwich, a budget stack, an arrow gate, two Nitro rows and an outline promise; no crate on a plinth,
  ledge or step; four checkpoints inside lane groups; four count traps at attractors.
- Climb: eight six-metre double-jump hops → six 3.5 m full-jump hops with a stable tier and one
  occupied landing; the fuse court starts at 309.
- First landing: 26 m deep so the mossback debut, the TNT lesson and the sentinel stand a beat apart.
- Aqueduct: lips removed; the Ravine Break gains a consumable crate bridge; the Far Break becomes an
  11 m charge check with a checkpoint at the start of a 42 m run-up.
- Enemies: every kind now debuts on roomy ground away from edges and climbs a ladder; the frog left
  the ledge for the aqueduct head.
- Terrace: the six-single procession becomes a wall with a `?`; the three sentinels become a phased
  wave for cruise with a break; the Nitro ring becomes two rows beside the landing lane; a life is
  priced over a Nitro; the height-budget stack is the order puzzle.
- Cistern: cover crates in front of the sentry; a promise block that the cornice switch fills.
- Dropped: the Nitro frame (R5). With this engine's 0.8 m spin reach a `?` boxed by Nitro at one crate's
  distance is a coin toss, and the bible's own report would count the frame as four singles.

## 7. Validation (Part XX)

- `crate-placement-report.mjs --stock --levels jungle-terraces`: 168 counted crates, 66 clusters,
  mean size **2.56** (gate ≥ 2.5), **9 singles, 5 %** (gate ≤ 20 %), no section without crates, the
  one arrow has a crate target in the arrow-and-double-jump window, no orphan outlines.
- `level-geometry-report.mjs --stock --levels jungle-terraces`: 15 lethal gaps, the widest 11 m
  (the declared charge gap); 12 enemies, every first appearance alone, safe and off any lethal edge;
  92 beats (10.5 per 100 m); longest quiet stretch 58 m = the declared run-up to the Far Break.
- The temple's own gates (16 rules at build): floors under every crate, no rail through a crate,
  sweeps and blasts only on purpose, patrols on floor, checkpoints ten metres clear of hazards on floors
  six metres deep, gaps within reach, no crate on a stepping stone, mean cluster ≥ 2.5 and singles
  ≤ 20 %, 8–24 crates per section (3+ in the declared peak), outlines only in the switch group, the
  arrow gate's window and clear stomping range, the charge gap's run-up and checkpoint.
- Runtime: 2,569 support probes over 67 floors and eleven safe checkpoint warps; world collision audit
  0 hits; the input-only journey from spawn to gate (zero deaths); twelve unmasked encounters; fire
  contact, mask absorption and ledge hang; `check:levels`; production build; release size under the
  1,000,000,000-byte budget; Chromium lite pass over 32 rooms and full pass over 6 with clean consoles.
  Evidence in `docs/temple-embers-design/`.
