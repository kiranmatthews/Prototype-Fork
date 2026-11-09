# Temple of Embers · level design

Temple of Embers (`jungle-terraces`, Secret Island slot 2, unlocked by five all-box gems) is the
course where the game's two halves have to meet: Crash Bandicoot's readable corridor of crates,
hazards and checkpoints, and Tony Hawk's lines, grinds and speed that has to be earned. This is
the third version. The first re-dressed the old site; the second built a switchback of set pieces
that read as a test lab, buried its tiki heads and stacked machines where the course needed
places. This version is built from one rule the owner set and one the engine taught:

- **Uphill is on foot.** Every climb is platforming: death pits, platform gaps, height changes
  and enemies. Every flat and every descent is skating: speed, grinds, gaps and launches.
- **Rooms, not corridor.** The course is seven places a pilgrim would recognise, each with one
  job, joined so that the next room is visible before it is entered.

Source: `src/levels/temple-of-embers.ts`, authored directly in world space (stations are metres
along −Z from the arrival ledge; `x` is across, negative left). `src/levels/jungle-sequels.ts`
re-exports it as the published level. `docs/LEVEL_ITERATIONS.md` holds the timed record and
`docs/temple-embers-design/` the evidence.

## 1. Pillars

1. **Foot climbs, board flats.** The Great Stair and the Sanctuary Steps are walked and jumped
   (standing jump 5.9 m, double jump 9.6 m, 2.85 m apex); the ravine floor, the sluice, the
   aqueduct, the reservoir and the terrace are ridden (23 m/s flat, 30 m/s downhill).
2. **One job per room.** Learn the spin and the first flame; climb; descend with speed; cross a
   chasm two ways; drop in and pump; four jumps; release and celebrate.
3. **Every threat has a safe lane or a cool phase, and exactly one has only the cool phase.**
   Sentinels face across their room so one half is always cool. The abutment pair at the end of
   the aqueduct is the single place where both breaths meet in the middle, so timing is the
   only answer, and the checkpoint stands ten metres before it.
4. **Fail soft before fail hard.** The first death pit is the collapsed flight, after a landing
   has already been crossed. A bad launch onto the dais lands on the terrace floor, not in the
   nitro. A slow run at the cistern ramp rolls back onto the hall floor.
5. **Readable danger, paid risk.** Amber windup before every breath; the censer's arc; the bob's
   shadow; nitro's green glow. Every risk holds an offering and has a cool lane beside it.
6. **Crates are the grammar.** Carving lines where speed is being learned, offerings at the
   edge of every sweep, caps where the air arrives, mysteries behind patrols, a nitro ring that
   is only ever counted. 64 counted boxes on the course, 17 in the Ember Reliquary, 81 in all.
7. **Light is language.** Braziers mark the walls, paired lamps mark a banked checkpoint, the
   dais carries its own fire, and no lamp stands inside a sentinel's reach.
8. **Verified places.** Every floor the rider can stand on is registered when it is authored.
   The module refuses to build if a crate floats, a checkpoint stands within ten metres of a
   sentinel, a ledge chain has a hop over 4.6 m, a crate stands in a sweep without being marked,
   or two placed things overlap. The built world is audited again independently.

## 2. Site and silhouette

A ravine runs north (−Z) into a hillside. The temple is cut into its head: a broad floor, a great
stair up its east wall, a sluice back down to an aqueduct that crosses the ravine on arches, a
cistern under a dome, four steps to the sanctuary terrace. 876 m from the arrival ledge to the
gate; 30 m of climb. Treehouse cave walls and earth banks line the ravine, rim trees stand on top,
and the Jungle Ruins masonry kit (bonded platforms, steps, cornices, columns, arches, hanging
gateways) builds everything the pilgrims built.

| Room | Stations | Floor | Mode | What it is |
| --- | --- | --- | --- | --- |
| Ravine floor | −16 → 180 | 4 → 0 | board | 28 m wide loam floor with river stones, a shrine, a raised jade gutter, two crabs |
| The Great Stair | 180 → 424 | 0 → 24 | foot | three flights: a collapse with two plinths, eight fallen ledges, a narrow flight under a censer |
| The sluice | 424 → 476 | 24 → 16 | board | a banked stone channel with two bends and coping rails |
| Broken aqueduct | 476 → 658 | 16 | board or foot | the channel on arches with two breaks; a colonnade with three fallen floors; the abutment court |
| The Cistern | 658 → 744 | 16 → 19.5 | board or foot | a jade basin under a dome, a broken cornice, an ember sentry, a niche sentinel, a ramp to the gallery |
| Sanctuary steps | 744 → 776 | 19.5 → 30 | foot | four ledges over the drain, a bristleback on the second |
| Sanctuary terrace | 776 → 876 | 30 | board | a paved court, a launch bank onto the brazier dais inside a nitro ring, the green switch, the gate |

## 3. Beat chart

Mode: S skating, P platforming, R rest. Intensity 1 (rest) to 5 (climax).

| Stations | Beat | Mode | Int. | Crash half → skating half | Crates | Enemy | Fire | Checkpoint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| −16–30 | Arrival ledge and bank | S | 1 | a lit ledge, a bank down to the floor | — | — | — | — |
| 30–64 | Carving line and shrine | S | 1 | five offerings to weave → the mask in the shrine niche | 5 wood, mask | — | — | 50 |
| 60–120 | Gutter grind | S | 2 | a raised jade gutter → ollie onto its coping, 55 m of grind with a fruit line | — | — | sleeping sentinel at 70 (14 s cycle, narrow), an offering inside its sigh | — |
| 90–176 | Crabs in the open | S | 2 | two crabs crossing → spin, or carve around | stack between them, one before the stair | crab, crab | — | 165 |
| 180–240 | First flight and the collapse | P | 2 | a crab on the lower run; the flight has fallen into the ravine → two plinths to hop | 2 plinth | crab | — | — |
| 240–256 | First landing | P | 2 | the sentinel owns the right half, the turtle crosses it → offerings on the safe left | 3 wood, stack in the sweep | mossback | waking sentinel at 249 | 243 |
| 256–322 | Fallen ledges | P | 3 | eight ledges zigzag up a metre each over the ravine, a frog on the big third block, a life on a side ledge | 3 wood, mystery, life | spring frog | — | — |
| 322–346 | Fuse court | P | 3 | a sentinel on the left, a capped TNT on the right with a refuge mystery beyond | stack in the sweep, tnt + cap, mystery | — | waking sentinel at 340 | 332 |
| 346–400 | Narrow stair and censer | P | 3 | six metres wide with pits both sides; a turtle on the first steps; a censer whose bob clears the treads only at the ends of its swing | 2 wood | mossback | — | — |
| 400–424 | Sluice head | R | 1 | the stair top terrace, two offerings, the channel ahead | 2 wood | — | — | 410 |
| 424–476 | The sluice | S | 2 | eight metres of descent through two bends → coping rails on both lips, a fruit line, two offerings at speed | 2 wood | — | — | — |
| 476–640 | Broken aqueduct | S / P | 3 | two breaks (7 m and 9 m) announced by six-metre lips → ollie them at speed; or walk the colonnade and jump its three fallen floors | 4 wood on the colonnade | spring frog on the colonnade | — | 480 (head) |
| 640–658 | Abutment court | S / P | 4 | both ways meet between two sentinels whose breaths meet in the middle → cross in the cool phase | 2 wood beyond the sweep | — | abutment pair at 649 (8 s, in step) | 642 |
| 658–706 | Cistern entry and basin | S | 3 | drop into the jade basin and cross it at speed; a cap above the entry lip for a pop, a life on the exit arc | cap, life | ember sentry on the right floor | — | 664 |
| 690–731 | Cornice and hall | P / S | 3 | a broken cornice climbs the left wall over the drain; the niche sentinel sweeps the right half of the exit; the ramp is the fast way up | 2 wood, mystery; 2 wood behind the sentry | — | niche sentinel at 716 | — |
| 731–744 | Gallery | R | 1 | twelve metres to stop and look down the drain | — | — | — | 738 |
| 744–776 | Sanctuary steps | P | 4 | four ledges 2.25 m up each over the drain; the bristleback punishes a stomp | 2 wood, mystery | bristleback | — | — |
| 776–810 | Terrace approach | S | 2 | a procession of offerings on the left, the first sentinel on the left, the bull on the far right → build speed down the centre | 6 wood | russet bull | sentinel at 800 | 778 |
| 803–834 | Dais launch | S | 5 | a long shallow jade bank → fly onto the twenty-two-metre dais inside the nitro ring; the crystal and two braziers wait on top | crystal, 6 nitro | — | sentinel at 818 (right) | — |
| 834–876 | Green switch and gate | S | 3 | drop off the back, two mysteries, the green switch counts the ring, the gate under the roofed sanctuary | 2 mystery, nitrobang | — | sentinel at 840 | — |

## 4. Set-piece catalogue

| Set piece | Rule | Telegraph | Skating answer | Failure | Recovery |
| --- | --- | --- | --- | --- | --- |
| Sleeping sentinel (70, 14 s cycle, ±12°) | the left half of the floor burns for 3 s in 14 | the long amber windup | ride the centre or the gutter | burned (a mask absorbs it) | checkpoint 50 |
| Collapse (200–212) | the flight is gone | fallen treads and blocks at the pit edges | — (on foot) | the pit | checkpoint 165 |
| Fallen ledges (260–316) | eight hops, a metre up each, about six metres corner to corner | the fruit arcs between them | — (double jumps) | the ravine | checkpoint 243 |
| Censer (386, 8 m chain, 0.9 rad) | the bob owns the treads except at the ends of its swing | the arc and the woosh | — | crushed | checkpoint 332 |
| Sluice (424–476) | a banked channel: the bank holds you in | the copings | pump the bends, grind the lips | — | — |
| Ravine Break and Far Break (520–527, 590–599) | the channel is gone for 7 m, then 9 m | six-metre lips rising 0.9 m, fruit arcs | ollie the lip at speed | the chasm | checkpoint 480 or 410 |
| Colonnade floors (500, 540, 580) | three gaps of under three metres | the fruit arcs | — (on foot) | the chasm | checkpoint 480 |
| Abutment pair (649, 8 s, in step) | both breaths meet in the middle for 1.8 s in 8 | both heads glow together | cross in the first 4 s of the cycle | burned | checkpoint 642 |
| Jade basin (684–706, 45°, 2 m deep) | roll in, roll out | the jade | a pop at the entry lip for the cap; a fast crossing climbs out at full speed | — | — |
| Cistern ramp (721.6–731.6) | 3.5 m of climb in 10 m | the ramp | carry speed out of the basin | a stall rolls back onto the hall | — |
| Sanctuary steps (748–772) | four ledges 2.25 m up with three-metre gaps | the fruit arcs | — (double jumps) | the drain | checkpoint 738 |
| Dais launch bank (803–810, 13.2 m radius, 32°) | a two-metre gap onto a two-metre dais | the jade bank and the fruit arc | any push from nine metres a second to the cap lands on the dais | the floor before the dais (walk around) | checkpoint 778 |
| Nitro ring (six, 14 m from the dais centre) | never touch it | the green glow | the green switch at 852 counts all six | death | checkpoint 778 |

Sentinels: heads at 0.8 scale on floor slabs so the breath crosses the body at chest height,
reaching 7.1 m along the facing with the authored sweep; cool 0–54 %, warning 54–70 %, fire
70–93 % of each cycle. Eight face across their room from one side and leave the other side cool;
the abutment pair is the one forced timing.

## 5. Mechanic arcs

| Mechanic | Introduce | Develop | Twist | Conclude |
| --- | --- | --- | --- | --- |
| Skating speed | the arrival bank and the carving line | the sluice descent | the breaks need speed, the abutment needs none | the dais launch rewards any speed |
| Grinding | the gutter coping (55 m, a fruit line) | the sluice lips through two bends | the aqueduct lips end over the chasm | — |
| Jumping on foot | two plinths over the collapse | eight fallen ledges, a metre each | four steps, 2.25 m each, with a bristleback | the hop onto the terrace |
| Fire | one slow narrow sigh read from the centre | a waking sentinel owning half a landing, twice | two breaths that meet in the middle | three fast sentinels framing the dais |
| Crates | carving line, mask | offerings on every landing and in every sweep | caps where the air arrives, a life on a side ledge | the nitro ring counted from the switch |
| Enemies | crab (any attack) | mossback (stomp), frog (spin while grounded) | sentry (its orbs cross the hall), bristleback (spin only) | the bull (read the windup) |

## 6. Crate inventory

Counted boxes: **64 on the course, 17 in the Ember Reliquary, 81 in all.**

| Job | Kinds | Where |
| --- | --- | --- |
| Carving and rhythm lines | wood | the five river-stone offerings (36–60), the sluice pair, the procession of six on the terrace |
| Hazard-edge offerings | wood, mystery | the stack inside each sentinel's sweep (70, 250, 339), the three on the first landing's safe half, the narrow stair pair, the two beyond the abutment sweep, the two behind the sentry |
| Climb rewards | wood, mystery, life | offerings on every second fallen ledge and the mystery on the last, the life on the side ledge, the cornice offerings and its top mystery, the step offerings |
| Caps where the air arrives | wood, life | above the basin's entry lip, on the exit arc |
| Milestones | mask, mystery, crystal | the shrine mask before the first flame, the fuse court's refuge mystery, the two mysteries behind the dais, the crystal on the dais |
| Hazards | tnt, nitro, nitrobang | the capped TNT in the fuse court; six nitro in a ring around the dais; the green switch beyond it |

## 7. Enemy roster

| Station | Kind | Placement | Lesson |
| --- | --- | --- | --- |
| 95, 120 | crabs | crossing the open floor, the second nearer the gutter | spin or stomp, escape either side |
| 190 | crab | the lower run of the first flight | the first enemy met on foot |
| 254 | mossback | the right half of the first landing, inside the sentinel's side | stomp it, or stay left |
| 277 | spring frog | the left of the big third ledge | pass it on the right; spin only while it is grounded |
| 350 | mossback | the first steps of the narrow stair | stomp it or wait for its turn |
| 560 | spring frog | the colonnade | spin only while it is grounded |
| 697 | ember sentry | the cistern's right floor | its orbs cross the hall; jump them from the ledges |
| 756 | bristleback | the second sanctuary step | spin only |
| 812 | russet bull | running the right side of the terrace | read the windup, keep left, strike while it is dizzy |

## 8. Scenery and wayfinding

- **Gateways** (hanging arches with solid piers) open the Great Stair, both landings, the
  cistern and the sanctuary.
- **The shrine** is a niche of three temple walls with a brazier on its lintel, holding the mask.
- **The aqueduct** stands on pier pairs every twelve metres from the ravine floor to the channel
  bed with arches between them; the colonnade carries columns, lintels and a roof along the
  right wall and a parapet toward the channel; the aqueduct head joins the channel bank to the
  walkway so the sluice can be walked down and the colonnade reached on foot.
- **The cistern** is a cave of Treehouse walls under a dome of cave roof, lit by braziers on
  bases, with the Reliquary's chapel off the left cornice and bonded stone closing the basin's
  open ends.
- **The terrace** is paved except around the dais and the sentinels; parapets run both sides,
  the sanctuary roof covers the gate, and summit trees and canopies stand around the court.
- **Lamps**: braziers along the ravine walls, paired lamps at every checkpoint, braziers and
  corner lamps on the dais.

## 9. The Ember Reliquary

Unchanged: five side-view rooms (vestibule with mask, a sentinel breathing across the lane, an
arrow kept to reach a high switch that creates the jade bridge, the cap-before-fuse vault, a
nitro corridor counted from a green switch), 17 boxes, entered from the chapel off the cistern's
left cornice and returned to the cistern floor.

## 10. Validation

- **Authoring rules** (10, run every time the module loads; a violation throws): every crate
  stands on registered floor; patrols walk on floor; checkpoints have floor and stand ten metres
  clear of every sentinel; no crate stands inside a sweep without being marked and no marked
  crate is unreachable; no crate inside a patrol walk; volatile crates keep their blast clear of
  other boxes; ledge chains hop at most 4.6 m and rise at most 2.4 m; scenery stays out of the
  sentinels and the lanes; plinths and ledges are supported; the camera spine has a floor at
  every node.
- **World audit** (`tools/test-temple-embers-collisions.mjs`): rails against crates, lamps
  against the directional breath, scenery against sentinels, crates against patrol walks and
  pedestals, floor under every crate. Zero hits.
- **Structure** (`tools/test-temple-night.mjs`): 2,526 support probes over 70 registered floors
  (every ledge, landing, flight, walkway and court; the curved jade surfaces are ridden by the
  journey instead); ten safe checkpoint warps; the kill plane respawn; the sentinel phases.
- **Journey** (`tools/test-temple-embers-journey.mjs`): one input-only run from spawn to gate,
  120 s, zero deaths, 32 boxes: the gutter grind, the collapse plinths, eight double-jumped
  ledges, the censer wait, the sluice, both breaks ollied at speed, the abutment pair waited
  out, the basin at 23 m/s and the ramp, four steps with the bristleback spun in the air, the
  dais launch, the green switch. Any room boundary can be the start (`TEMPLE_START`).
- **Encounters** (`tools/test-temple-embers-encounters.mjs`): all ten patrols defeated unmasked
  from a standing start on their own floor.
- **Fire** (`tools/test-temple-fire.mjs`): bare contact in the sleeping sentinel's sigh burns,
  a mask absorbs it, and the breath reaches a ledge hang.
- `npm run check:levels`, production build, Chromium lite pass (22 rooms) and full pass (7
  rooms) with clean consoles. Evidence in `docs/temple-embers-design/`.

## 11. What the engine taught, kept for the next course

- A vert wall zeroes forward speed at its lip and a deck reads as a coping to crest, so a drop-in
  bowl is a 45° banked road with a short rim, not a vert pipe, and every launch is a bank of at
  most 32° at the lip (steeper fires the vert hang).
- The breath leaves a full-size head 0.85–1.25 m above its base; the rider's body is 0.92 m
  tall. Heads stand on floor slabs at 0.8 scale with the range widened to match.
- A pendulum at yaw 0 swings across the course; yaw 90 swings along it.
- A road's vertical face next to a banked rim will wreck a rider who crests below the lip; give
  the rim 0.6 m of flat before the floor begins.
- Enemy names are capped at the editor's label length; the level data will not normalize past
  it.
