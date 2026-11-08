# Temple of Embers · level design framework

Temple of Embers (`jungle-terraces`, Secret Island slot 2, unlocked by five all-box gems) is the
course where the game's two halves have to meet: Crash Bandicoot's readable corridor of crates,
hazards and checkpoints, and Tony Hawk's lines, grinds and speed that has to be earned. This is
the second redesign. The first kept the old site and re-dressed it; players could not tell it
apart from what came before, and its rails ran through its crates. This version starts from a
new site, gives every chapter one set piece the course never had, and refuses to build if any
two things it places collide. `docs/LEVEL_ITERATIONS.md` holds the timed record and evidence.

Source: `src/levels/temple-of-embers.ts` (the course, authored in station space through a DSL
that registers everything it places), `src/levels/jungle-temple-space.ts` (the winding world
builder), `src/levels/jungle-sequel-art.ts` (banks, paving, gateways, halls, ravine),
`src/levels/ember-reliquary-bonus.ts` (the bonus). Stations are route metres from the ravine rim
(−24) to the sanctuary gate (1484); `side` is metres across the eight-metre road, negative left.

## 1. Pillars

1. **One idea per chapter, and it is the chapter.** Thirteen chapters, each built around a single
   set piece with a Crash half (a hazard with a rule) and a skating half (the line that answers
   it). Nothing from one chapter leaks into the next except knowledge.
2. **Every hazard has a skating answer, every line has a walking answer.** Breathing stones are
   crossed by waiting or by the gold rail that ignores them; burning ropes are grinds, and a fall
   lands on a bellows floor; the ash floor is a hop rhythm or one board boost; the censers are
   timed or passed on the right-hand rail; the pistons are three timings or one breath at speed.
3. **Fail soft before fail hard.** The first three chapters never kill a rider who commits: the
   rope floor catches, the lift well returns you to the court, the stone chasms are the first
   death pits and they come after the rail has been shown. From the serpent on, the course bites.
4. **Collision-free by construction.** The authoring layer registers every crate, rail, rope,
   flame, swing, pad, patrol, pit, void and checkpoint and refuses to build the course if a rail
   passes within a crate, a crate stands in a sweep or a swing without being meant to, a crate
   sits on anything that moves or breaks, a checkpoint respawns within ten metres of a hazard, or
   a rigid set piece lands in a bend. A second audit checks the built world independently.
5. **Readable danger, paid risk.** Every hazard telegraphs: amber-to-blue stones, the rope's
   smoulder, the ash pad's shake, the censer's arc, the hammer's rest, the sentinel's amber
   windup, nitro's green glow. Every risk has a reward inside it and a safe lane beside it.
6. **Crates are the grammar.** Rhythm lines on the straights, offerings at the edge of each
   hazard, caps where the air arrives, consolation where a fall lands, a hoard beyond a patrol,
   nitro that is only ever looked at. 83 counted boxes on the course, 17 in the bonus, 100 in all.
7. **Light is language.** Warm lamps every 26 m mean safe ground; paired lamps mean a banked
   checkpoint; no lamps within 14 m of a sentinel, where its fire is the only light; scorched
   paving marks the gauntlet; the brazier on the lift is the only light that moves.
8. **Checkpoint before a twist, never on a landing, never beside a hazard.** Eleven checkpoints,
   one at the start of every chapter that changes the rules, each at least ten metres from any
   flame, patrol, nitro, fuse, swing or hammer, and never inside the side-view turn.

## 2. Site and silhouette

The temple is cut into a cliff. The road is an axis-aligned switchback: an arrival leg down a
ravine rim, then four 240 m galleries running east, west, east, west, each one storey (12 m)
above the last, joined by 100 m courts at the ends, and a final spur north to the sanctuary.
Every leg is axis aligned, so world-axis primitives (patrols, the lift, pads, hammers) keep their
authored meaning, and every bend is a 12 m fillet the rigid set pieces stay out of.

| Leg | Stations | Heading | Height | Storey block beneath |
| --- | --- | --- | --- | --- |
| Ravine rim and ash court | −24 → 115 | north, dropping 7 → 0 | 7 → 0 | ash court core |
| Gallery of stones and ropes | 115 → 355 | east | 0 | cut open under the rope floor |
| Pilgrim bank | 355 → 455 | north | 0 → 12 | self-supporting ribbon |
| Ash gallery and censer hall | 455 → 695 | west | 12 | cut open under the ash chasm |
| Lift court and well | 695 → 795 | north | 12 → 24 | the well is open to its floor at 7 |
| Serpent gallery and shrine | 795 → 1035 | east | 24 | full |
| Flame climb | 1035 → 1135 | north | 24 → 36 | self-supporting ribbon |
| Reservoir, vault and leap | 1135 → 1375 | west | 36 | cut under the bowl and the leap |
| Ember Gauntlet and sanctuary | 1375 → 1490 | north | 36 → 46 | sanctuary core |

The storey blocks are each deep enough to reach the previous gallery's cornice, so from any
gallery the temple reads as a stepped pyramid with the road zigzagging up its face, and from the
lift the rider sees the three galleries already ridden. The ravine is an elliptical ring of 44
cliff bays; Treehouse trees and ferns replace the old jungle foliage, rooted clear of every road.

## 3. Beat chart

Mode: S skating, P platforming, R rest. Intensity 1 (rest) to 5 (climax).

| Ch. | Stations | Chapter | Mode | Int. | Set piece (Crash half → skating half) | Crates | Enemy | Fire | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | −24–127 | Ravine rim and ash court | S | 1 | Drop-in bank → the rim rail beside it; weaving crate line; first flame read from the right lane | 3 weave, mask, 2 in the sweep, 2 after the crab | crab crossing | T1 left at 84 | 58 |
| 1 | 127–250 | Gallery of stones | P | 2 | Ember stones breathe amber and blue over two chasms → a gold rail on the right crosses regardless | 2 rhythm, island mystery, 2 landing | — | — | 140 |
| 2 | 250–343 | Burning ropes | S | 2 | Two grind ropes that part after 3 s and 2.4 s of weight → the fall lands on an ash floor with two bellows that bounce you back | 3 consolation below, 2 rhythm, 2 after the mossback | mossback crossing | — | 252 |
| 3 | 343–467 | Pilgrim bank | S | 2 | Bank, left stair with offerings, right gold rail: three routes up | 3 stair | — | — | — |
| 4 | 443–590 | Ash gallery | P | 3 | Seven ash pads that break under weight, an island mid-field → one board boost crosses it all | 2 rhythm, island mystery, 2 after, 2 after the frog | spring frog | T2 left at 566 over a striped crate | 474 |
| 5 | 590–683 | Censer hall | P | 3 | Side view. Three censers swing along the hall through the fruit line → the right-hand rail passes every swing | 6 at the swing edges, 2 under the watcher | violet watcher | — | 592 |
| 6 | 683–807 | Lift court | R | 1 | The bonus door in a right-hand court; a burning lift to the third storey (a fall returns through an ember draft); cap-before-fuse court on top | TNT + cap + refuge mystery, 2 rhythm | — | — | 756 |
| 7 | 807–920 | Serpent gallery | S | 3 | A lethal body patrolling the centre whose spine is a grind: ride most of it to defeat it, or take the side lanes; then the flame and the bull | 2 rhythm, hoard, 1 in the sweep, bull refuge | russet bull along the lane | T3 right at 884 | 814 |
| 8 | 920–1023 | Sealed shrine | P | 3 | A side chamber behind a kickflip seal: a flip through the ring opens it for good; the ember sentry covers the approach to the climb | life, mystery, wood inside; 1 after the sentry; 2 rhythm | ember sentry | — | 930 |
| 9 | 1023–1147 | Flame climb | S | 3 | The pilgrim bank again with a sentinel on the right: the stair and the left rail are the safe routes | 3 stair | — | T4 right at 1090 | — |
| 10 | 1123–1240 | Jade reservoir | S | 3 | The one bowl: exit offerings on both carving lines, a cap above the exit lip met by drop-in air, a life above the entry lip for a pumped return; the first nitro glows beside the lane | 2 exit, 2 caps, 2 nitro, 2 rhythm | — | — | 1150 |
| 11 | 1240–1363 | Piston vault | P | 4 | Three hammers that breathe together in a roofed vault → the boost before it carries a rider through in one breath; mask; the seven-metre leap with its gold rail | 4 after the vault, mask, 2 landing | — | — | 1238 |
| 12 | 1363–1490 | Ember Gauntlet and sanctuary | S→P | 5 | Three sentinels in a staggered wave up the last bank with an offering inside each sweep; a bristleback at the door; the crystal; the nitro gate; the green switch | 3 in the sweeps, 2 procession, 3 nitro | bristleback crossing | T5–T7 at 1402/1420/1438 | 1392 |

## 4. Set-piece catalogue

| Set piece | Rule | Telegraph | Skating answer | Failure | Recovery |
| --- | --- | --- | --- | --- | --- |
| Ember stones (5 phase pads, 10 s round, lit 65 %) | stand only on a lit stone; amber and blue trade places | the warning pulse before a stone goes dark | gold rail at side 3.6 over each chasm | death pit | checkpoint 140 |
| Burning ropes (15 m, 3 s; 20 m, 2.4 s; both at side −1.6) | grind across before the fibre parts; it restrings after 4 s | the rope sags and smoulders under weight | the ropes are the line | a fall of 5 m onto the ash floor | two bellows (19 m/s) under the island and the landing |
| Ash floor (7 pads, 0.72 s shake, 1.4 m hops) | keep moving | the shake | board boost to 30 m/s at station 494 | death pit | checkpoint 474 |
| Censer hall (3 pendulums, 6 m arms, 0.95 rad, 1.3 rad/s) | the bob owns the centre line | the swing is read in side view | gold rail at side 3.6 | crushed | checkpoint 592 |
| Brazier lift (10.4 m deck, 12 ↔ 24 m, 12.6 s round) | wait, board, ride | the deck's brazier | — (a rest beat) | a fall into the well | the ember draft portal returns you to station 737 |
| Serpent (grindosaurus, 24 m patrol, 60 % spine) | the body is lethal; its spine is a grind | spine fruit | ride the spine to defeat it | death | checkpoint 814 |
| Kickflip seal (trick gate, 2.2 m aperture) | only a kickflip through the ring opens the shrine | the sealed ring and its sigil | the flip itself | bounced off | optional: three boxes inside |
| Piston vault (3 hammers, 3.6 m blocks, 3.8 s round, in phase) | pass as they rise or hang | the rest on the deck, the rise | board boost at station 1248 through all three | crushed | checkpoint 1238 |
| Jade reservoir (radius 7, 60° walls) | pump for height | the bowl | drop-in air meets the exit cap; a pumped return reaches the entry life | — | — |
| Ember Gauntlet (three sentinels 18 m apart, phases a third apart) | weave to the far lane of each flame | amber windup | speed through the wave | burned (a mask absorbs one) | checkpoint 1392 |

Sentinels: 7.1 m reach, 7.8 s cycle (cool 0–54 %, warn 54–70 %, fire 70–93 %), ±28° sweep, heads
at side ±6.4 on their own footing. A head on one side leaves the far 2.2 m of the road cool.

## 5. Mechanic arcs

| Mechanic | Introduce | Develop | Twist | Conclude |
| --- | --- | --- | --- | --- |
| Grinding | the rim rail beside the drop-in | rails over the stone chasms that ignore the stones | ropes that part under weight; the censer rail past the swings; the serpent's spine | the leap rail into the gauntlet |
| Timing | breathing stones | ash pads that break | censers in side view; the lift's cycle | three hammers in one breath; the three-flame wave |
| Fire | T1 beside the ash court, read from the right lane | T2 over the striped crate on the ash landing | T3 on the serpent gallery, T4 making the climb's stair and rail the safe routes | T5–T7 staggered up the gauntlet bank |
| Crates | weave line, mask, offering after the crab | offerings at the edge of each hazard; consolation on the rope floor | caps where the air arrives; the hoard beyond the serpent; three boxes behind a trick | nitro beside the lane, then the green switch counts all five |
| Enemies | crab (any attack) | mossback (stomp), frog (spin while grounded) | watcher (jump-spin, side view), bull (dodge then strike), sentry (jump the orb) | bristleback at the door (spin only) |

## 6. Crate inventory

Counted boxes: **83 on the course, 17 in the bonus, 100 in all.**

| Job | Kinds | Where |
| --- | --- | --- |
| Rhythm lines | wood | arrival weave (36–44), stone approach, rope landing, terrace, lift court, serpent approach, climb approach, reservoir terrace, sanctuary procession |
| Hazard-edge offerings | wood, mystery, multihit | stacks beside the crab, mossback, frog, watcher, bull and sentry; the striped crate inside T2's sweep; offerings at the edge of each censer swing; one inside T1, T3 and each gauntlet sweep |
| Caps where the air arrives | wood, life | above the reservoir's exit and entry lips |
| Consolation | wood, mystery | the ash floor under the ropes; the stone island; the ash island |
| Hoards behind a skill | wood, mystery, life | beyond the serpent's patrol; the three boxes inside the kickflip-sealed shrine; the pilgrim stair offerings |
| Milestones | mask, mystery | masks before the first flame and before the gauntlet; the fuse court's refuge mystery; two landing mysteries after the leap |
| Hazards | tnt, nitro, nitrobang | one capped TNT with a marked refuge; two nitro beside the reservoir terrace, three at the sanctuary gate; the green switch beyond the crystal |

## 7. Enemy roster

| Station | Kind | Placement | Lesson |
| --- | --- | --- | --- |
| 96 | crab | crossing the ash court | spin or stomp, escape either side |
| 318 | mossback | crossing the rope landing on the left | stomp; the shell stays in the offering lane |
| 580 | spring frog | crossing the ash landing | spin only while it is grounded |
| 648 | violet watcher | between the censers, in side view | jump-spin it |
| 846 | temple serpent | patrolling 24 m of the gallery centre | grind its spine, or keep to the side lanes |
| 906 | russet bull | running the gallery centre for 18 m | read the windup, keep left, strike while it is dizzy |
| 996 | ember sentry | right of the climb approach | jump the slow orb, spin the body |
| 1452 | bristleback | crossing the sanctuary door | the stomp habit is punished |

## 8. Scenery and wayfinding

- **Gateways** (hanging arches) open every chapter: ravine rim, stones, ropes, ash gallery,
  censer hall, lift court, serpent gallery, sealed shrine, reservoir, vault, gauntlet, sanctuary.
- **Roofed halls** cover the censer hall and the piston vault, the two chapters played indoors.
- **Side courts** hold the bonus door (right of the lift court) and the sealed shrine (left of the
  serpent gallery), each with its own parapet, paving and lamps.
- **Paving** marks every flat court; scorched paving marks the gauntlet bank.
- **Shoulders and parapets** run continuously along the road, breaking only at chasms, voids, the
  lift well, the bowl, the hammers' footprints and the side courts.
- **The storey blocks** and their cornices make the pyramid; the reservoir sits in a cut in the
  fourth storey with its own retaining walls.

## 9. The Ember Reliquary

The bonus is unchanged from the first redesign: five side-view rooms (vestibule with mask, a
sentinel breathing across the lane, an arrow kept to reach a high switch that creates the jade
bridge, the cap-before-fuse vault, a nitro corridor counted from a green switch), 17 boxes, entered
from the lift court's right-hand landing.

## 10. Validation

- **Authoring rules** (12, run every time the module loads; a violation throws): rigid set pieces
  out of the bends; no rail or rope within a crate; no rail ending over a chasm; crates inside a
  sweep only when flagged, and flagged crates actually reachable; no crate within a censer swing;
  no crate on a pad, lift, bellows, boost or hammer; no rail through a hammer; every crate on
  authored floor; no crate inside a patrol; checkpoints ten metres clear of every hazard;
  volatile crates clear of other boxes; frames and heads out of the lane.
- **World audit** (`tools/test-temple-embers-collisions.mjs`): rails and ropes against crates in
  world space, lamps against flames, crates against machinery, parapets against hammers, crates
  against patrol walks, floor under every crate, the side-view zone's coverage, the seal and the
  heads beside the lane. Zero hits.
- **Structure** (`tools/test-temple-night.mjs`): 3,544 support probes across the road, the lower
  floors, the side courts and every stair step; eleven safe checkpoint warps; the kill plane
  respawn; the sentinel breath phases.
- **Journey** (`tools/test-temple-embers-journey.mjs`): one input-only run from spawn to gate
  through every set piece, 138 s, zero deaths, grinding both stone rails and both ropes, boosting
  the ash floor, riding the lift, waiting each hammer, ollieing the leap, weaving the gauntlet.
- **Encounters, climbs, fire, bonus**: all seven patrols defeated unmasked from a standing start;
  both pilgrim stairs climbed from the bank and rejoined; fire contact, mask absorption and ledge
  hang; the bonus and the themed-bonus flow.
