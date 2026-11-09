# Temple of Embers · level design (the switchback)

Temple of Embers (`jungle-terraces`, Secret Island slot 2, unlocked by five all-box gems) is where
Crash Bandicoot's crate corridor and Tony Hawk's earned speed have to meet. The previous pass put the
crates right ([`GAMEPLAY_DESIGN_BIBLE.md`](GAMEPLAY_DESIGN_BIBLE.md) Part XX: mean cluster 2.56, 5 %
singles) but laid the whole course along one straight line. This pass keeps that crate composition
and re-plans the course the way the Famitsu isometric maps the bible cites plan theirs: seven legs
at right angles, courts at the corners, the route doubling back over its own start, a stretch read
from the side. Nothing ahead of the player is ever simply "straight on".

Source: `src/levels/temple-of-embers.ts`. Everything is authored in **station space** (a continuous
metre count `s` along the route, `x` across it with negative left, `y` up) and placed in the world by a
leg table (`TEMPLE_LEGS`): each leg has a start station, a world origin and a yaw, so a crate, row,
ramp or wall authored at (s, x) lands axis-aligned on whichever leg owns that station. `toLocal`
reverses the map for tools and pilots. `docs/LEVEL_ITERATIONS.md` holds the timed record,
`docs/temple-embers-design/` the evidence, including both bible reports.

## 1. Shape sources

| Famitsu map (bible README links) | What this course took from it |
|---|---|
| Ruination (Crash 2, p071–072) | pillar chains climbing diagonally over the void, walled checkpoint pads, double fire-head chokes, the route doubling back on itself |
| Road to Ruin (p055–057) | zig-zag walkways, a covered room mid-route, fire heads on both sides of a lane, pads that fall away |
| Tomb Time (Crash 3, p068–070) | right-angle corridors, stairs between levels, a fork with a checkpoint at the junction |
| Sphynxinator (p071–073) | a fork that rejoins, a run back toward the start for the perfect, timed slabs |
| Turtle Woods (Crash 2, p021–022) | a winding walled corridor with one turn and a closed court wall |
| Cold Hard Crash (p067–070) | an into-screen corridor that turns into a side-scrolled strip of ledges |

## 2. The seven legs

Plan view, from the spawn: north, west, north, east (side-scrolled), south back over the start,
east, north. Heights are floor levels; "board" and "foot" follow the law that climbs are walked and
speed lives on flats and descents.

| Leg | Direction | Stations | World | Floor | Mode | Room |
|---|---|---|---|---|---|---|
| 1 | north (−Z) | −18 → 149 | z +18 → −131, x ±14 → ±8 | 4 → 0 | board | the ravine floor: arrival bank, smash stagger, shrine, gutter grind, two crabs, the walled corner court |
| 2 | west (−X) | 149 → 235 | x −8 → −94, z −137 ± 10 | 0 → 8 | foot | the pillar chain over the void and the walled landing court |
| 3 | north | 235 → 311 | z −147 → −223, x −79 ± 10 | 8 → 16 | foot | six fallen ledges, a side ledge, the roofed fuse court |
| 4 | east (+X), **side view** | 311 → 406 | x −67 → +26, z −206 ± 8 | 16 → 24 | foot | the broken stair between parapets, the mossback, the stone slab, the stair top |
| 5 | south (+Z) | 406 → 640 | z −198 → +36, x 16 (channel ±3.9), colonnade at x 25–31 | 24 → 16 | board (fork) | the sluice, the aqueduct with two breaks, the colonnade, the abutment court twelve metres above the spawn |
| 6 | east | 640 → 728 | x 24 → 112, z 27 ± 20 | 16 → 19.5 | board / foot | the cistern: entry lane, censer, jade reservoir, cornice, promise block, ramp, gallery |
| 7 | north | 728 → 860 | z 19 → −113, x 108 ± 20 | 19.5 → 30 | foot → board | four sanctuary steps, the terrace, the wave, the dais, the Nitro rows, the gate |

Sightlines are the point of the shape. The aqueduct (leg 5) runs the length of the ravine's east rim
sixteen metres above the floor the player skated on in leg 1; from the ravine floor the player sees
the arches ahead and above. The abutment court stands twelve metres above and a few metres east of
the spawn ledge: the player looks down on where they started before turning east into the cistern.
The terrace looks west over the whole complex. Every corner is a walled court (Ruination's saves) that
carries a checkpoint and parapets, so each turn is a room with a reason, not a bend in a path.

Camera: ordered `camnode`s every 5 m along each leg's centre line with an 8 m corner radius, so the
camera turns with the course; one travel `zone` (`dir: 'E'`) over the broken stair puts leg 4 in the
side view. Pits: under the pillar chain, under the fallen ledges, in and beside the stair's breaks,
under the aqueduct (never over the ravine floor), the cistern drain, under the steps.

## 3. Laws applied here

| Law | How this course obeys it |
|---|---|
| 1–3 Crates are a second game; cluster, don't sprinkle; one named job per cluster | Every placement is a cluster with a job named in its component label. Result: 165 counted crates in 65 clusters, mean 2.55, nine singles. |
| 4 Introduce alone, recombine later | Board smashing, TNT, the arrow, the double jump, each sentinel rung and each enemy kind first appear alone where failure is cheap; the fuse court, the abutment and the terrace recombine them. |
| 5 Order is the puzzle | A one-shot height budget (R3), an arrow gate (R2) and a TNT with its payout beside it have tempting wrong orders that lose a box. |
| 6–7 Explosives have jobs; price rewards by risk | TNT: a clearer with a payout (teach), then the same silhouette with the TNT on top (test). Nitro: two rows that bound the landing lane behind the dais, counted by the green `!` last. Lives: over the ravine, over a Nitro row, above an arrow gate. Masks: the shrine, and one in the fuse court. |
| 8 Checkpoints follow the crate rhythm and mode changes | Eleven checkpoints; 7–20 counted crates in every section; one at every board/foot change; four inside fast-line lane groups; one at every corner court; none on a rail, a ledge or timed footing. |
| 9 Fast lines: lanes as commands, no explosive on the forced line | Smash stacks on the floor and the sluice, a crate bridge over the Ravine Break, a 42 m clear run-up before the charge gap, lane stacks 1.5 m off the line, Nitro only beside the lane where the rider can stop. |
| 13 Couple, don't widen | Foot gaps 3.5 m (plain band) coupled to a rise, a landing crab or a cycle; the pillar chain's gaps couple to height; the one wide board gap is a deliberate 11 m charge check. |
| 14–15 Forgiving debuts; one variable at a time | Every enemy kind debuts alone on safe ground (the geometry report: 4 of 4 first appearances alone and safe); sentinels climb debut → repeat → invert → combine → wave. |
| 16 Lethal timers telegraph, and the telegraph is geometry | The stair slab hangs in view in the side view before it stamps; the cistern censer swings in the hall's open air; every sentinel warns before it breathes. |
| 17–18 Rest after 3–5 jumps; no-stop only from footing or a pursuer | The pillar chain is two hops, a walkway, a hex pad, two hops; the ledges are two runs of three with a 6 m tier between; nothing forbids stopping except the sentinel pair's cycle. |
| 20 Landing size and occupancy are the dials | Ledges 4 m deep, one occupied; teaching landings and checkpoint floors ≥ 6 m; the pillar chain's plinths are empty. |
| 21–22 Place enemies for position; rhythm by speed | Each kind climbs across → along → landing; 95 beats over 830 m (11.5 per 100 m); the terrace heads are phased for 12 m/s. |
| XVII side view | Leg 4 reads depth from stepped parapets on both edges of every flight; its hazards move in the screen plane (a patrol along the stair, a slab that rises and falls); its breaks are 2.5 m, the plain foot band. |

## 4. Sections

Eleven checkpoints cut the 830 m route (as the camnode lane measures it) into twelve sections.
Counts are the bible's crate report (`crate-placement-report.json`). The colonnade is a declared
optional route and rejoins at the cistern passage.

| # | Stations | Leg | Floor | Mode | New element | Counted | Clusters |
|---|---|---|---|---|---|---|---|
| S0 | −18 → 50 | 1 | 4 → 0 | board | smash speed (three 3-stacks after the bank) | 13 | 3-stack, 3-stack with a `?`, 3-stack, shrine stack with the mask on top, lane 2-stack |
| S1 | 50 → 137 | 1 | 0 | board | sentinel debut; the gutter grind; crabs in the open; the corner court | 18 | lane 2-stack, 3-row beside the coping, one box over the coping, sweep 3-stack, 2 × 2 bait block behind the crab, 3-stack on the line, court lane 2-stack |
| S2 | 137 → 210 | 1 → 2 | 0 → 8 | foot | the first lethal gaps (pillar chain); the crab along the lane | 11 | court lane 2-stack, 3 × 2 wall with a `?` on the hex pad, landing `?`, trap 2-stack |
| S3 | 210 → 284 | 2 → 3 | 8 → 16 | foot | TNT (teach), the arrow gate, the double jump, the ledges | 19 | TNT clearer + `?`, arrow + 3-row above it, sweep 2-stack, balcony 3-stack, rest-tier 2 × 2 block, side-ledge life, court trap 2-stack |
| S4 | 284 → 382 | 3 → 4 | 16 → 24 | foot (side view) | TNT (test), the slab, the bristleback | 20 | TNT-on-top + `?`, mask stack, pyramid, sweep 3-stack, one stack between the mossback and the slab, sandwich (row + lid), stair-top 3-stack |
| S5 | 382 → 468 | 4 → 5 | 24 → 16 | board | the smash lane on a descent; the frog | 11 | three 2-stacks 12 m apart (R8), head 3-stack, lane 2-stack |
| S6 | 468 → 530 | 5 | 16 | board | the one-way crate bridge | 14 | lane 2-stack, 6-crate bridge (R7), landing marker; colonnade block |
| S7 | 530 → 616 | 5 | 16 | board | the charge gap | 9 | landing `?`, two lane 2-stacks; colonnade row and stack |
| S8 | 616 → 649 | 5 → 6 | 16 | board | the abutment pair (declared timing peak, IV.4); the first board turn | 7 | trap 2-stack, 3-stack beyond the sweep, cistern lane 2-stack |
| S9 | 649 → 723 | 6 | 16 → 19.5 | board / foot | the censer; cover crates; the cornice switch and its promise | 15 | lane 2-stack, pair over the entry lip, pair on the exit arc, cover row (wood, steel, wood), promise 2 × 2 block (ghost until the `!`) |
| S10 | 723 → 765 | 6 → 7 | 19.5 → 30 | foot | the sanctuary steps | 8 | gallery 3-stacks, terrace lane 3-stack |
| S11 | 765 → 860 | 7 | 30 | board | the sentinel wave; Nitro rows; the green `!` | 20 | lane 3-stack, trap 2-stack, 3 × 2 wall with a `?`, two Nitro rows of three, life over the right row, height-budget 3-stack + `?`, green `!` |

Lives: three (the arrow gate's row, the side ledge, over the Nitro). Masks: two (the shrine stack, the
fuse-court stack). The nine singles are the box over the coping, the two landing markers, the arrow,
the side-ledge life, the sandwich lid, the Ravine Break landing marker, the height-budget target and
the life over the Nitro.

## 5. Beat chart

Mode S skating, P platforming, R rest. Crates name their recipe where one applies.

| Stations | Beat | Mode | Crash half → skating half | Crates | Enemy | Fire / timer |
|---|---|---|---|---|---|---|
| −18–30 | Arrival ledge and bank | S | open safe: a lit ledge, a 4 m bank | — | — | — |
| 34–44 | Smash stagger | S | three 3-stacks on the line: at ≥ 12.5 m/s they clear whole, slower trips (XV.4) | 3, 3 (`?` top), 3 | — | — |
| 40 | Shrine | S | the mask on a wood crate in its niche to the left | 2 | — | — |
| 47–53 | Checkpoint lane group | S | R10 with stacks 1.5 m off the line | 2, 2 | — | — |
| 60–112 | Gutter grind | S | ollie onto the coping on the right; a 3-row on the floor beside it is a parallel line; one box over the coping for a grind jump (XVI.9) | 3, 1 | — | sleeping sentinel at 70 (debut, 14 s cycle) with a 3-stack in its sigh |
| 95–118 | Crabs in the open | S | across the 28 m floor, roomy, opt-out (XIII.2); a 2 × 2 bait block behind the first; a 3-stack on the line at 112 | 4, 3 | crab, crab | — |
| 125–149 | Corner court | S→P | a walled court: lane stacks round the checkpoint, parapets on three sides, the arch west; brake, dismount | 2, 2 | — | — |
| 149–205 | Pillar chain | P | two plinths (+1, +1 m), a 1.6 m walkway with the crab pacing along it, the hex rest pad with a 3 × 2 wall and its `?`, two pillars (+1.5, +1.5), the landing court; the gaps are 3–3.5 m over the void | 6 | crab (along) | — |
| 205–235 | Landing court | P | the `?` marks the landing; a trap stack in the corner; checkpoint; the mossback debuts on 20 × 30 m of floor; the TNT clearer (R4) with its `?` beside it; the arrow gate (R2) to a floating row; the sentinel one beat on with the balcony above its sweep (double jump and grab) | 1, 2, 4, 4, 2, 3 | mossback (debut) | sentinel at 231 (repeat) |
| 235–278 | Fallen ledges | P | six hops of 3.5 m rising +2, +2, +2, +1, +1, 0 up the ravine's west wall; a 6 m tier after three with a 2 × 2 block; a crab on the fifth ledge (spin in the air); a life on a side ledge 4 m out | 4, 1 | crab (landing) | — |
| 278–311 | Fuse court (roofed) | P | trap behind the checkpoint; the clearer's silhouette with the TNT on top (B2); mask stack; pyramid; the sentinel's sweep stack is the invert | 2, 3, 2, 3, 3 | — | sentinel at 303 (invert) |
| 311–367 | Broken stair (side view) | P | 7 m wide between stepped parapets; two 2.5 m breaks; the mossback paces the second flight; one stack in the safe window; the stone slab stamps the third flight (cycle 3.6 s): wait as it rests, go as it rises | 2 | mossback (on the line) | slab at 357 |
| 367–406 | Stair top | R→S | the bristleback debuts alone on a 16 × 39 m floor; a payout sandwich (R1); a 3-stack; checkpoint; drop into the sluice | 3 + 1, 3 | bristleback (debut) | — |
| 406–458 | The sluice | S | 15 % descent through two bends: smash lane (R8), three 2-stacks 12 m apart | 2, 2, 2 | — | — |
| 456–468 | Aqueduct head (the fork) | S / P | the frog debuts on the 6 × 12 m head; checkpoint in a lane group in the channel; walkers step onto the colonnade | 3, 2, 2 | frog (debut) | — |
| 502–509 | Ravine Break | S | 7 m level break (plain board band); a 6-crate row on the bed line is a one-way grind bridge (R7); the ollie is the fast line | 6, 1 | — | — |
| 530–572 | Clear run-up | S | checkpoint, then 42 m with nothing to do but charge (XVII.1) | — | — | — |
| 572–583 | Far Break | S | 11 m level charge gap: a cruise ollie (9.4 m) fails, 18 m/s (12.6 m) clears | landing `?` | — | — |
| 583–616 | Third span | S | lane beats one each side; the checkpoint ten metres short of the pair, so a stop is a real option | 2, 2 | — | — |
| 616–640 | Abutment court | S | both breaths meet in the middle: cross in the cool phase (combine); the lane turns east over the spawn ledge; trap in the corner; a 3-stack beyond | 2, 3 | — | pair at 626 |
| 640–656 | Cistern entry | S | checkpoint lane group under the passage vault | 2, 2 | — | — |
| 656–668 | Hall and censer | S | the censer swings across the lane in the hall's open air: time the gap or ride wide of its track | — | — | censer at 662 |
| 667–690 | Jade reservoir | S | drop in and cross at speed; a pair over the entry lip (pop), a pair on the exit arc | 2, 2 | sentry on the south floor behind cover (XVII.6) | — |
| 678–713 | Broken cornice | P | seven ledges up the north wall; the `!` on its landing | `!` | — | niche sentinel at 700 over the exit lip |
| 676–696 | South floor | S / P | cover row before the sentry (wood, steel, wood); the promised 2 × 2 block appears when the switch fires: switch, then return down the ramp (VII C2) | 3, 4 | — | — |
| 705–728 | Ramp and gallery | S→P | ride up; the checkpoint, then two 3-stacks with the lane open between them | 3, 3 | — | — |
| 728–758 | Sanctuary steps | P | four 3 m gaps rising 2.25 m; the bristleback on the second step (rung 2); no crates on the steps | — | bristleback (landing) | — |
| 758–786 | Terrace approach | S | lane 3-stacks round the checkpoint, a trap beside it, a 3 × 2 wall with a `?` on the left; two heads 8 m apart phased 0.67 s for 12 m/s (XVII.3) | 3, 3, 2, 6 | — | sentinels at 776 (left) and 784 (right) |
| 787–818 | Dais launch | S | the shallow bank throws any speed onto the 22 m dais; crystal and braziers | — | bull on the far right (debut: the dais is the perch) | — |
| 818–846 | Behind the dais | S / P | two Nitro rows 1.5 m outside the dais's width bound the landing lane (XVI.10) with a life 3.5 m over the right row; the third head half a cycle off is the wave's break; the one-shot height budget (R3); the green `!` counts the rows; the gate | 3 + 3, 1, 3 + 1, `!` | — | sentinel at 827 |

## 6. Ladders

**Fire sentinels** (one family, nine heads at 0.8 scale on floor slabs so the breath crosses the body):

1. Debut — ravine floor, 14 s cycle, narrow sweep, watched from open floor, a 3-stack inside its sigh.
2. Repeat without the pause — landing court, one beat after the TNT lesson; the balcony stands above it.
3. Invert — fuse court: the reward is inside the sweep; enter while it is cool.
4. Combine — the abutment pair: both breaths meet in the middle; there is no safe lane, only the cool phase.
5. Wave — terrace: two heads phased 0.67 s apart for a board at 12 m/s, a third after the dais half a
   cycle off over the landing lane's left half.

**Timers** (two families, one each): the stone slab over the stair's third flight (hangs 38 % of a
3.6 s cycle, slams, rests as a wall, rises; the hanging block clears a standing player by three
metres, so the read is "wait as it rests, go as it rises"), and the censer in the cistern hall (a 6 m
arm swinging across the lane, low only through the middle of its swing; the hall is 24 m across so a
rider may time it or ride round its track).

**Enemies** (twelve, six kinds), one rung per appearance:

| Kind | Debut (roomy, no lethal edge) | Next rungs |
|---|---|---|
| crab | across the ravine floor, 28 m wide, two of them | along the pillar chain's walkway, then on the fifth fallen ledge |
| mossback | the landing court, 4 m before the TNT and 17 m before the sentinel | on the broken stair between pits, in the side view |
| spring frog | the aqueduct head, 3.6 m from the channel bank | on the colonnade between its fallen floors |
| bristleback | the stair top terrace | the second sanctuary step (landing) |
| ember sentry | the cistern's south floor behind a cover row | — |
| russet bull | the terrace's right side, watched from the dais | — |

## 7. Gaps and footing

| Gap | Kind | Width | Move | Coupling | Landing |
|---|---|---|---|---|---|
| Pillar chain (155–205) | pit | 3.0–3.5 m, +1, +1, +1, +1, +1.5, +1.5, +1 m | plain / double | the first lethal gaps; a crab paces the walkway; the hex pad is the rest | 2–3 m plinths, a 1.6 × 10 m walkway, a 7 × 7 m pad, the 20 × 30 m court |
| Fallen ledges (240–278) | pit | 3.5 m, +2 m rise ×3, +1 m ×2, level ×1 | plain (full jump) | run of three → 6 m rest tier → run of three; the crab on hop five | 3.5 × 4 m ledges, a 6 × 6 m tier |
| Side ledge (265) | pit | 4 m lateral | plain | the life is the price | 3.5 m |
| Stair breaks (329, 347) | pit | 2.5 m, rising with the stair | plain | the mossback after the first, the slab after the second (XVII side view) | the next flight |
| Colonnade floors (482, 522, 562) | pit | 2.8–3 m | plain | the frog between the second and third | walled 6 m walkway |
| Ravine Break (502–509) | pit | 7 m, level | full ollie from cruise (9.4 m) or grind the bridge | the bridge is consumed; the fast line is free | the channel bed, a marker 1.5 m off the line |
| Far Break (572–583) | pit | 11 m, level | charge (12.6 m at 18 m/s) | 42 m clear run-up; checkpoint at its start | the bed, a `?` 7 m on |
| Reservoir (667–690) | banked trough | — | drop in | none; the sentry's line is blocked below the rim | — |
| Cornice (678–713) | pit under the last three | 2 m | step | the drain under the last steps | 4 m ledges, 4 m landing |
| Sanctuary steps (732–756) | pit | 3 m, +2.25 m | plain | the bristleback on step two | 5 m steps |
| Dais gap (794–796) | floor | 2 m | the bank throws | none: release | 22 m dais |

Checkpoint floors are 6 m deep or more; no checkpoint stands on timed footing, a ledge or a rail.
Checkpoints on the board line bank at smash speed and trip below it (the engine's rule), so each one
sits where the line is fast or where the rider has just mounted, and lane stacks stand 1.5 m off the
line. Corner courts carry their checkpoint inside the walls.

## 8. What changed from the previous pass

- Shape: one 876 m straight line → seven legs at right angles (830 m by the camera lane), four
  walled corner courts, a side-scrolled stair, a fork that rejoins, and the route returning over its
  own start twelve metres up. The leg table (`TEMPLE_LEGS`) and `templeToWorld` / `templeToLocal` are
  the new authoring frame; every helper (`masonry`, `flight`, `pit`, `parapet`, crate rows, patrols,
  sentinels, rails, camera nodes) takes a station and a lateral offset and turns with its leg.
- The collapse plinths and the first-landing ramp became a pillar chain over the void (Ruination):
  two plinths, a crab's walkway, a hex rest pad with the 3 × 2 wall, two pillars, a landing court.
- The narrow stair became a side-scrolled broken stair (Cold Hard Crash) with stepped parapets,
  2.5 m breaks and a stone slab in place of the censer: a censer swinging along a stair cannot be
  passed on foot (its bob is low along the whole arc and faster than a walker), and one swinging
  across a 7 m stair in the side view moves in depth, which the side camera cannot read. The censer
  moved to the covered cistern hall, where it swings across the lane in open air and its gallows
  stands on real floor.
- The abutment court is the first board turn: the lane bends east at the court's middle, the
  sentinel pair stands just inside the court's mouth, and the third span's checkpoint is ten metres
  short of them so a rider can stop and read the cycle.
- The colonnade's last floor runs on into the cistern passage, so walkers rejoin without a seam.
- Crates: the composition is the previous pass's, re-stationed; the one change of count is the third
  span's 3-stack, dropped so the span is a braking length (165 counted, mean 2.55).

## 9. Validation (Part XX)

- `crate-placement-report.mjs --stock --levels jungle-terraces`: 165 counted crates, 65 clusters,
  mean size **2.55** (gate ≥ 2.5), **9 singles** (14 % of clusters, 5 % of crates; gate ≤ 20 %), no
  section without crates (7–20 per section), the one arrow has a crate target, no orphan outlines.
- `level-geometry-report.mjs --stock --levels jungle-terraces`: 21 lethal gaps, the widest 11 m
  (the declared charge gap), median landing 5.3 m deep; 12 enemies, every first appearance alone and
  safe; 95 beats (11.5 per 100 m); longest quiet stretch 58 m = the declared run-up to the Far Break.
- The temple's own gates (17 rules at build): the previous sixteen plus "the route turns" (every leg
  meets the next at a right angle, legs share a boundary station, no two legs overlap in plan).
- Runtime: 2,417 support probes over 72 floors and eleven safe checkpoint warps; world collision
  audit 0 hits; the input-only journey from spawn to gate through all seven legs (8,066 steps /
  134.4 s, zero deaths, 69 boxes), and from each room boundary; twelve unmasked encounters; fire
  contact, mask absorption and ledge hang; the side-scroll zone's camera (looks −Z from the stair's
  south side) and control frame confirmed on grounded probes; `check:levels`; production build;
  release size under the 1,000,000,000-byte budget; Chromium lite pass over 32 rooms and full pass
  over 8 with clean consoles. Evidence in `docs/temple-embers-design/`.
