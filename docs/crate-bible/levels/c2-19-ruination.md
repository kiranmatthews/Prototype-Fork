# Crash 2 — Stage 19 Ruination  (からくりのはいきょ)

Sources: F2 p071L (stage header), p071R (start → C2, POINT1–3), p072L (C2 → C3, POINT4–6, bonus door), p072R (C3 → goal, POINT7–9), p099R (perfect page: order, bonus cautions with two screenshots, gem course); F2 p015 (legend). D2 p062 (shots 1–8), p063 (9–35: main route to C2, the green-gem course, the return and the level end), p064 (36–52: box-gem run including the bonus round, shots 39–44).

Evidence level:
- **Read directly:** the header (84 boxes, superscript 49; 1UP 0, Aku 1 (sub 0), C 4 (sub 0)); every crate icon on the F2 line art at zoom; POINT texts 1–9; the p099R statements, including that the **gem course contains no boxes at all**; D2 captions 1–52. Also the D2 bonus HUD box counter in shots 39–44 (1 → 16 → 17 → 22 → 28 → 36), and the stack shapes in D2 shots 2, 7–11, 30, 39–45, 48–52.
- **Reconciled:** main route 35 = 84 − 49, with every main-route cluster located. Bonus 49 = all off-course boxes, consistent with the HUD counters (36 shown with the final pyramid still standing).
- **Inferred:** the internal split of the bonus after shot 41 (counters only, shapes partly hidden by explosions).
- **Known source error:** F2 p072R draws one stack as "? over C". The header says 4 checkpoints, and D2 shows four checkpoint crates elsewhere (shots 6, 13, 48, 31). D2 shots 30 and 52 show that stack as two ? crates. Counted here as ?/?.

## At a glance
| Field | Value |
|---|---|
| Theme | Ruined temple on stone pillars at night. Fire-breathing statues (ボワボワ石像), crumbling floors, rotating platforms, tilting stone pillars, log-throwing gorillas |
| Camera | Into-screen throughout (F2: 3D scroll). Bonus round is side-scroll |
| Total boxes | **84** (F2 p071L header; superscript **49** off-course) |
| Boxes per route | main **35** (all located) · bonus **49** · gem course **0** (F2 p099R) · no death or secret route |
| Checkpoints | 4, all main route: C1 after the first pillar run; C2 beside the green-gem platform; C3 on the walled platform after the fire-statue lanes; C4 beside the floating green ! |
| 1UP | 0 boxes in the whole stage |
| Aku | 1 box (between two fire-statue pairs, before C3). Loose masks (not boxes) float above a steel arrow (S2), inside the gem course's ape-face room, and after the green ! |
| TNT | main 7 (two 2-high TNT stacks used as stepping platforms; 1 beside the steel arrow; 2 on the lizard ledge) · bonus ≈ 3 |
| Nitro | main **12**: 1 hidden behind the start pile, 2 on a crumbling ledge, 7 in the ! room (1 solid + 6 outline that the ! turns into Nitro), 2 around the rat after C3. The **green !** after C4 (reached by bouncing off a rat) detonates them all |
| ! switches | 1 plain ! in the Nitro room (main); 1 ! in the bonus (fills outline steps); green ! after C4 |
| Outline | main 6 (become Nitro, all-box only); bonus ≈ 6 frames filled by the ! (bridge and steps; probably not boxes) |
| Iron-bound | ≈ 29, all in the bonus (4×4 block, three towers) |
| Arrows | steel arrow 1 (S2, under the floating mask); no wooden arrows seen |
| Striped | 2 (top of the bonus exit pyramid) |
| Gems | **Clear gem (box)** = all 84 boxes (the gem course adds none). **Clear gem (hidden)** = finish the gem course, entered from the green-gem platform at C2 (needs the green gem from Stage 10, The Eel Deal) |
| Enemies | rats チュール (bounce targets, stand guard by Nitros), frilled lizards トゲック (pace along narrow pillars; slide them lengthwise), monkeys モンプー (patrol between TNT stacks), gorilla ドンちゃん (throws logs from afar; jump-spin to beat) |
| Hazards | fire statues (single and paired, POINT4/6), crumbling floors, 4 rotating platforms (POINT5), tilting pillars (POINT8), rolling logs (POINT9) |
| Difficulty | F2 rating こりゃたいへん. F2 p099R says the box perfect only needs a careful normal-course clear, apart from the ! / green-! business. It calls the gem course extremely hard and says it has no boxes |

## Route skeleton
```
START ─ S1: [W W / W W + hidden N] ─ pillars: [?] e:rat e:lizard×2 ─ fire statue ─ C1                                        7
        S2: [T/T] e:monkey [T/T] ─ crumbling ledge [N] [N] ─ [T] + ⇑steel arrow (mask above) ─ ! ROOM [N + 6 outline→N] ─ e:monkey ─ C2 + (green-gem pad)   15
                                                                                                                                    │
            ┌─────────────── GEM COURSE (needs green gem; 0 boxes; logs, tilting/crumbling platforms; ape room: fruit + loose mask; hidden gem) ──┐
        S3: double fire statues ─ 4 rotating platforms ─▶ [BONUS pad] ─ e:monkey [?/?] ─ fire lane ─ crumbling platforms between statue pairs ─ [Aku] ─ C3 [N]     4
        S4: e:rat [N] ─ ledge [T] e:lizard [T] ─ [? ?] ─ tilting pillars ─ [?/?] (gem course returns here) ─ C4                                                9
        S5: rats circling a floating GREEN ! (bounce off a rat to hit it) ─ e:Don-chan logs ─ pillars ─ GOAL                                                       0
BONUS (from S3): [4×4 iron block with 1 wood notch] → ! + outline steps → [? on 3 iron] → [T/T + iron tower] → [T + 5-iron tower] → wood steps → exit pyramid      49
```
F2 perfect order (p099R): normal → bonus → normal.

## Section-by-section map

### S1 — Start → C1  (7; F2 p071R lower half; D2 shots 1–6)
```
 START ─ e:fire-statue ─ platform:  [W][W]          pillars:  [?] e:rat   e:lizard   e:lizard   ─ e:fire-statue ─ [C1]
                                    [W][W][N] <- Nitro tucked behind the pile
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S1-a | first platform after the opening fire statue | wood ×4, Nitro ×1 (hidden behind) | 2×2 pile with a Nitro tucked behind it | spin from the front only; F2 forbids the body slam here | ON-PATH EXPLOSIVE-MIX HIDDEN SUPPORT-ORDER TEACH | The level's thesis in one pile: the box you want sits next to one you must not touch. A wide spin or a body slam next to the pile sets off the hidden Nitro. Breaking the pile from the front exposes it | F2 p071R POINT1 + screenshot; D2 shot 2 (four boxes with a Nitro hidden behind them) | high |
| S1-b | on a pillar, next to a rat; lizards on the next pillars | ? ×1 | single | stomp the rat, then spin the box | ENEMY-LINK SINGLE ON-PATH | D2 adds a coupling: killing the rat sets the lizard pacing, so jumping the rat is safer. The crate tempts you into the fight | F2 p071R; D2 shots 3–4 | high |
| S1-c | walled platform after the second fire statue | checkpoint ×1 | single | walk | CHECKPOINT | First save after two fire-timing jumps | F2 p071R; D2 shot 6 | high |

### S2 — C1 → C2  (15; F2 p071R upper half; D2 shots 7–13)
```
 long ledge:  [T]  e:monkey  [T]        crumbling ledge: [N] ... [N]        platform: [T] [⇑]  (mask floats above the arrow)
              [T]  (paces)   [T]
 ! room:   [N] [o][o][o]            then e:monkey ledge ─ [C2] + green-gem platform (gem course)
           [!] [o][o][o]  <- the ! turns all six outlines into Nitro
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S2-a | long ledge, either side of a patrolling monkey | TNT ×4 | two 2-high TNT stacks, used as footing | jump onto a stack; when the monkey returns, jump on it and spin it; light the next stack and leave before it blows | ON-PATH EXPLOSIVE-MIX ENEMY-LINK STACK TIMED | Explosives are the floor here. Standing on a TNT stack lights a 3-count, so each stack is a timed step and the monkey patrols the gap between them | F2 p071R; D2 shots 7–8 (TNT stacks, one counting 3) | high |
| S2-b | a crumbling ledge | Nitro ×2 | two singles spaced along the ledge | jump each without stopping | ON-PATH TIMED TEST | You can't wait and line up the jumps, because the floor gives way. The Nitros punish the panic jump | F2 p071R; D2 shot 9 | high |
| S2-c | platform beside a steel arrow; a loose Aku mask floats above the arrow | TNT ×1 (F2 icon; D2 calls it simply a box) | single next to the arrow block | break it, then bounce on the arrow to grab the mask | TOOL EXPLOSIVE-MIX AKU | The arrow is a tool to reach a mask that floats out of reach. The adjacent TNT means you mustn't linger while bouncing | F2 p071R zoom; D2 shot 10 | medium |
| S2-d | the ! room (POINT3) | Nitro ×7 (1 solid + 6 outline that the ! turns into Nitro) | ring of outlines around the ! block | hit the ! only for the perfect; the green ! later destroys them | SWITCH OUTLINE NITRO-SWITCH EXPLOSIVE-MIX COUNT-TRAP | **A switch that makes the room more dangerous.** F2 and D2 both say don't press it unless you're going for all boxes. The outline Nitros count toward the total, so the perfect forces you to arm a trap, walk out of it, and detonate it with the green ! at the end | F2 p071R POINT3 + screenshot; D2 shot 11 | high |
| S2-e | end of the monkey ledge | checkpoint ×1 | single, next to the green-gem platform | walk | CHECKPOINT ROUTE-SPLIT | The save sits at the gem-course entrance | F2 p071R; D2 shot 13; F2 p099R screenshot | high |

### GEM COURSE — green-gem platform at C2 (0 boxes; F2 p099R; D2 shots 13–30)
No boxes (F2 p099R says so explicitly; D2 shots 14–29 show none). Contents: log-throwing gorillas at range, collapsing and tilting platforms, a fire run, and a room with an ape face holding fruit and a loose Aku mask (D2 26). The hidden gem is near the end (D2 29). A return green-gem pad then drops you back on the main route beside the S4-d ?/? stack (D2 30, 52). For the bible: an optional route can be a pure skill test with **no** box obligation, so the all-box player has no reason to suffer it.

### S3 — C2 → C3  (4; F2 p072L; D2 shots 36–48)
```
 e:fire-statues L+R (POINT4) ─ 4 rotating platforms (POINT5) ─▶ [BONUS ? pad] on a pillar
   ─ pillar: e:monkey [?/?] ─ fire lane ─ crumbling platforms between statue pairs (POINT6) ─ [Aku] ─ statues ─ [C3] [N]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | pillar next to the bonus pad, guarded by a monkey that hops pillar to pillar | ? ×2 | 2-high stack | follow the monkey, spin it, then the stack | ENEMY-LINK STACK ON-PATH | The crate pillar is also the monkey's route. Kill the monkey first or it knocks you off | F2 p072L; D2 shot 45 | high |
| S3-b | small platform between two pairs of fire statues | Aku ×1 | single | jump in during a fire gap, grab, and jump on before the next burst | AKU TIMED ON-PATH | The only mask box in the stage, placed in the fire run where one burn would otherwise end the run. The Aku tip says to learn the statue timing | F2 p072L zoom (Aku-face box); D2 shot 47 | high |
| S3-c | walled platform after the statue lanes | checkpoint ×1 | single (a Nitro sits at the platform edge, counted in S4-a) | walk | CHECKPOINT | Save before the Nitro/rat walkway | F2 p072L; D2 shot 48 | high |

### S4 — C3 → C4  (9; F2 p072L top-right → p072R; D2 shots 48–52, 30–31)
```
 [C3] [N] ─ e:rat ─ [N]  (POINT7: jump N, stomp rat, jump N)
 narrow ledge:  [T] e:lizard ... [T]
 platform:  [?] [?] ─ tilting pillars (POINT8) ─ platform: [?/?] (gem course drops you here) ─ [C4] e:rat×4 circling a floating [G!]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S4-a | either side of a rat, right after C3 | Nitro ×2 | Nitro – rat – Nitro on a narrow walkway | jump the Nitro, stomp the rat as a step, jump the next Nitro | ENEMY-LINK STEPPING EXPLOSIVE-MIX TEST | POINT7: the rat is the stepping stone between two Nitros. D2: dash-jump over the lot; there is no need to waste a life on the rat | F2 p072L/R POINT7; D2 shot 48 | high |
| S4-b | narrow ledge with a pacing lizard | TNT ×2 | one TNT at each end of the lizard's beat | stomp the near TNT just as the lizard reaches the far end; light the other on the way past | EXPLOSIVE-MIX ENEMY-LINK TIMED CHAIN | D2: time the near TNT so the blast kills the lizard for you. TNT used as a trap you set for an enemy | F2 p072R; D2 shot 49 | high |
| S4-c | platform before the tilting pillars | ? ×2 | two singles | spin | PAIR ON-PATH REWARD | A breather payout before the perspective test | F2 p072R; D2 shot 50 | high |
| S4-d | platform after the tilting pillars, beside the gem-course return pad | ? ×2 | 2-high stack | spin | STACK ON-PATH ROUTE-SPLIT | Marks where the optional route rejoins. Gem-course runners pass it either way | D2 shots 30, 52; F2 p072R (misdrawn ?/C) | high |
| S4-e | platform beside the floating green ! | checkpoint ×1 | single | reach it from a rotating platform | CHECKPOINT NITRO-SWITCH | The last save sits next to the Nitro switch, so a failed rat bounce costs little | D2 shot 31; F2 p072R | high |

### S5 — C4 → goal  (0)
The green ! floats in space. You reach it by **bouncing off one of four rats** circling it and steering onto it (D2 31). Hitting it destroys all 12 Nitros (including the 6 armed outline Nitros), which finishes the box count. Then come log-throwing Don-chan sections (POINT9: spin the logs away, jump-spin the gorilla), stepping pillars and the goal. No boxes.

### BONUS — iron-bound demolition (49; F2 p072L door, p099R cautions; D2 shots 38–44)
```
 [R][ ][R][R]   <- one plain wood box in the notch (row 1, col 2)       [!] floats; outline steps appear when hit
 [R][R][R][R]
 [R][R][R][R]                    [?]          [T]            [R]
 [R][R][R][R]                    [R]          [T]  [R]       [R]          exit:   [S][S]
                                 [R]               [R]       [R]                 [W][W][?][?][W][W]
                                 [R]               [R]       [R]             [W]                 [W][W]
                               ══steel══          (tower)   [T][R]  (5 iron + TNT)  wood steps     [W]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| B-a | entry | iron-bound ×15, wood ×1 | 4×4 block; the wood box fills one top notch | spin the wood box, high-jump into the notch, then body-slam down through the middle | BONUS REINFORCED GRID SUPPORT-ORDER TEACH | F2 p099R: spin the middle wooden box, climb into the lowered notch, then body-press the centre to smash many at once. D2: slam down the rows to each side. Never body-slam the bottom row first, or the rest is stranded and you have to die to retry | D2 shot 39 (block counted at zoom), counter 1 → 16 at shot 40; F2 p099R caution 1 + screenshot | high |
| B-b | floating ! then outline frames | (! + ≈6 outline frames: a 4-wide bridge and a 2-step pair) | the ! fills the frames as footing | hit the ! from below, run across | SWITCH OUTLINE TOOL | The frames are traversal, not loot. The counter does not rise as you cross them (16 → 17 only after the next ?) | D2 shot 40 | medium |
| B-c | steel slab | ? ×1 on iron-bound ×3 | 4-high tower | spin the ? on top, then body-slam down | BONUS REINFORCED STACK SUPPORT-ORDER | Spin first, then slam: the ? caps a tower only a slam can open | D2 shot 41 (counter 17) | high |
| B-d | next tower with a TNT pair at its foot | TNT ×2, iron-bound ×6 (internal split estimated) | iron tower + 2-high TNT stack | light the TNT, stand on top of the tower while it blows, then slam the rest | BONUS REINFORCED EXPLOSIVE-MIX CHAIN TOOL | F2 p099R caution 2: high-jump off the TNT onto the iron boxes and wait there for the blast, which does the work. Body-slam whatever survives | D2 shot 42 (counter 22 mid-blast); F2 p099R screenshot 2 | medium |
| B-e | tall tower | TNT ×1 at the base, iron-bound ×5, plus wood steps ×2 | 5-high iron column with the TNT beside its foot | bounce up from the TNT, wait on top, slam down when clear | BONUS REINFORCED EXPLOSIVE-MIX TOOL SUPPORT-ORDER | D2: you must be on top of the pile when it blows, or you can't get through. The TNT is both springboard and demolition charge | D2 shot 43 (counter 28 → 36 by shot 44) | medium |
| B-f | exit | striped ×2 (top), ? ×2, wood ×9 | wide pyramid (6-crate bar on two feet, 2 on top) | smash along the row | BONUS PYRAMID ROW REWARD | A plain payout to finish, with nothing left to solve | D2 shot 44 (counter 36 with the pyramid intact; 49 − 36 = 13) | medium |

## Enemies and hazards
| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | fire statues | opening and before C1 | the start pile sits right after the first fire gap |
| S1 | rat + 2 lizards | pillars | the ? sits by the rat. Killing the rat frees a lizard to pace (D2 4) |
| S2 | monkey | between the two TNT stacks | the TNT stacks are its patrol endpoints. Stomp it from a stack |
| S2 | crumbling ledge | Nitro pair | can't pause to aim |
| S3 | twin fire statues, rotating platforms, crumbling platforms | statue lanes | the Aku box is inside the fire run |
| S3 | monkey | ?/? pillar | guards the stack |
| S4 | rat | between 2 Nitros | the rat is the stepping stone |
| S4 | lizard | TNT ledge | the TNT is the weapon |
| S4 | tilting pillars | before S4-d | perspective test; no crates on them |
| S5 | 4 rats | circling the floating green ! | an enemy bounce is the only way to reach the switch |
| S5 / gem course | Don-chan (gorilla) logs | final stretch and gem course | no crates. Pure timing |

## Puzzle rooms and dependency chains
1. **Hidden-Nitro pile (S1-a).** Setup: a 2×2 wood pile with a Nitro tucked behind it. Right: spin from the front; never slam. Wrong: a body slam or an angled spin into the back, which kills you. Design: teaches in the first ten seconds that this level's crates are mixed with explosives.
2. **The ! that arms a trap (S2-d).** Setup: a ! surrounded by six outlines. Right for all boxes: press it, walk out without touching the new Nitros, and later hit the green ! (S5). Right for a clear: never press it. Loss: 6 boxes on the all-box count. Design: the switch inverts the usual reward. It turns the room hostile and pays off only with the final switch.
3. **Rat-bounce to the green ! (S5).** You can't reach the switch by any jump alone. You have to bounce off one of the circling rats and steer. A failed bounce costs a life, which is why C4 sits beside it. Design: the box total depends on an enemy-bounce skill.
4. **Lizard TNT trap (S4-b).** Light the near TNT as the lizard reaches the far end, and its own blast clears the ledge. Wrong: lighting early (the lizard is still beside you) or spinning a TNT.
5. **Bonus iron-bound demolition (B-a…B-e).** A chain of slam-order puzzles. The notch is the only entry into the block; each tower is capped by a ? to spin first; TNTs are lit from the top of the tower they will clear. Wrong order strands iron-bound boxes (reachable only by slam from above), which forces a death to reset the bonus.

## Design logic of this level
1. **Few boxes on the route, most in one bonus.** 35 main versus 49 bonus. The route is a timing level (fire statues, crumbling floors, rotating and tilting platforms), and boxes would compete with that focus. The bonus then becomes a dedicated slam-order puzzle room.
2. **Explosives make up most of the main route:** 12 Nitro and 7 TNT among 35 boxes, with only 11 plain/?/Aku boxes and 4 checkpoints. Every crate interaction has a "what not to touch" component.
3. **Every enemy is tied to an explosive or a box:** monkey between TNT stacks, rat between Nitros, lizard between TNTs, rats around the green switch, monkey guarding ?/?.
4. **The only Aku box sits in the hardest fire-timing stretch.** It's a mid-gauntlet reward rather than a pre-gauntlet gift.
5. **Switch inversion.** The ! makes Nitros, and the green ! (reachable only by enemy bounce) removes them. The perfect needs both, the clear needs neither.
6. **The optional gem course is box-free,** so completionists and gem hunters have cleanly separate goals. The course rejoins the route at a ?/? stack you can't miss.
7. **Checkpoints sit before each new skill** (fire timing, the TNT/monkey ledge, the Nitro/rat walkway, the rat bounce).
8. **Count traps** are not hidden crates but **behavioural**: the six outline Nitros exist only if you choose to arm them.

## Transfer to the skate game
1. **Hidden-explosive pile:** a 2×2 wood pile with a Nitro flush behind it on the line of travel. On the board a 13 m/s plow-through (which would otherwise smash the pile) carries the rider into the Nitro and kills. The correct answer is to stop, step off, and spin from the front. Teach board-speed discipline with one pile.
2. **TNT stacks as timed stepping stones:** two 2-high TNT stacks (2.3 m tops, reachable by full jump) with a patrolling enemy between. Standing on one starts the 3 s fuse, so the player must stomp the enemy and hop to the next stack within the fuse. Don't make the stacks a crate rail (TNT on a grind detonates); separate them by ≥ 1 crate width.
3. **Switch that arms a trap:** a ! that turns outline frames on the main skate line into Nitro, and a green ! at the end reachable only by enemy bounce (stomp at 14 m/s ≈ 3 m) from a patrolling enemy. This works for an all-box challenge without slowing normal runs.
4. **Enemy-bounce gate for the green !:** float the green ! about 4–5 m up, above our double-jump reach (≈ 4.6 m) but within an enemy-stomp bounce plus double jump, over a pit. Put a checkpoint on the launch platform.
5. **Iron-bound demolition bonus:** a 4×4 multi-hit/iron block with one plain crate in a top notch. The player must climb in and body-slam (our shock radius ≈ 3.4 m clears about 3 columns per slam). Towers capped by a ? and flanked by a TNT you light from the top teach "stand on what will be cleared".
6. **Box-free optional skill route:** if a skate level has a hard optional rail line, keep crates off it, so the all-box goal never forces the hardest line.

## Geometry, obstacles and enemies

Sources for this block: F2 p071R, p072L, p072R, p099R (maps, POINT texts, screenshots); D2 p062 (shots 1–17), p063 (18–35) and p064 (36–52). No guide gives a statue, log or platform cycle in seconds, so timing is qualitative. Widths come from D2 screenshots, using crates, floor tiles and Crash as rulers (one floor tile ≈ 1.3–1.5 u). Almost every edge in this level is open over a void.

### Camera and route shape

- **S1** — into-screen: diagonal climb from the start pipe (bottom-left) to the top-right (F2 p071R lower half): a chain of pillar tops, hex pads and a narrow walkway over a void.
- **S2** — into-screen: continues up and right (F2 p071R upper half) along ledges on columns to the ! room, then a narrow walkway straight into the screen to C2.
- **GEM** — into-screen: gorilla log alleys along chains of platforms (D2 p062 shots 14–17, p063 18–30); logs come toward the camera.
- **S3** — into-screen: single-lane walkways, a rotating ring and pillar clusters climbing to C3 (F2 p072L).
- **S4** — into-screen: the route doubles back up and to the left (F2 p072R lower half, つづき← then つづく↑).
- **S5** — into-screen: turns right along the top strip (F2 p072R): the rat ring, then a stepped pillar line down to the gorilla and the goal.
- **BONUS** — side-scroll: a flat room left to right (D2 p064 shots 39–44).

There is no side-scroll on the main route. Depth judgement is the constant test: D2 19 says "these jumps look really long, but it's just the perspective", and POINT8 says "grasp the depth".

### Platforms and gaps (section by section; table per section)

Platforms are `P-…`, gaps are `G-…`. Sizes are in crate widths (u), estimated from crates or Crash in the same screenshot; F2 line art gives topology only. Confidence is in brackets after the evidence.

#### S1 — Start → C1

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | square pad (start ledge at the pipe) | ≈2 | 0 | stand | static; edges: open | PERCH | A safe place to stand and read the first statue's cycle before the first jump. | D2 p062 shot 1; F2 p071R (medium) |
| G-S1-a | S1 | bottomless gap across a flame line | ≈1-2; landing big square platform ≈4x4 (the S1-a pile) | 0 to +1 | plain | fire statue beside the jump: wait until it stops breathing (D2 1) / fail: death (burn or fall) (lethal; run-up ≈1-2) | TEACH | The first gap of the level is also the first statue. It is short, and the player starts from a standstill, so only the timing is new. | D2 p062 shot 1; F2 p071R (medium) |
| P-S1-b | S1 | wide floor (raised square block) | ≈4x4 | +0-1 | land | static; edges: open | REST, LANDING | Big landing that carries the hidden-Nitro pile (POINT1). Room to stop, but the pile itself is the danger. | F2 p071R POINT1; D2 p062 shot 2 (medium) |
| P-S1-c | S1 | pad described as "unsteady" (behaviour not shown) | ≈2 | 0 | plain jump | unsteady per the caption (sinks or wobbles?); edges: open | STEPPING | A one-word caption only: recorded so the pad is not mistaken for safe ground. | D2 p062 shot 2 (low) |
| P-S1-d | S1 | square pillar top | ≈2.5-3 | 0 | plain jump | static; a rat stands by the ?; edges: open | LANDING | First enemy, met on a roomy pad next to a crate. | D2 p062 shot 3 (medium) |
| G-S1-b | S1 | bottomless gaps (pillar to pillar) | ≈1-2; landing ≈2.5-3 pad with a rat and a ? | 0 | plain | rat on the landing / fail: death (lethal; run-up ≈1-2) | TEACH | Short gaps; the landing carries the enemy lesson. | D2 p062 shot 3; F2 p071R (medium) |
| P-S1-e | S1 | hex pads ×3 joined in a row | ≈2-2.5 each (≈6-7 across in all) | 0 | plain jump | static; a rat and a lizard stand on it; edges: open | ARENA | A small arena where two enemies interact: killing the rat sets the lizard pacing (D2 4). | D2 p062 shot 4 (medium) |
| G-S1-c | S1 | bottomless gap onto the hex row | ≈1-2; landing hex row with a rat and a lizard | 0 | plain | enemy coupling: killing the rat frees the lizard to pace (D2 4) / fail: death (lethal; run-up ≈1) | TEST | The safe line is to jump over the rat rather than kill it. | D2 p062 shot 4 (medium) |
| P-S1-f | S1 | corridor (long narrow walkway, 縦長) | ≈1.5 wide × ≈6 long | 0 | walk; slide lengthwise | static; a lizard paces its length; edges: open | CHOKE | Shaped for one move: a slide along the length reaches the lizard (POINT2). | F2 p071R POINT2 + screenshot (medium) |
| P-S1-g | S1 | stepping stones (small square pillar tops) | ≈1.5-2 | 0 | plain jumps | static; beside the second fire statue; edges: open | TIMING-STEP | Stepping stones inside a flame line: now the statue must be timed while hopping. | D2 p062 shot 5; F2 p071R (medium) |
| G-S1-d | S1 | bottomless gaps through a flame line | ≈1-2 each; landing ≈1.5-2 pillar tops, then the C1 platform | 0 | plain | second statue: jump as the fire burns out (D2 5) / fail: death (lethal; run-up ≈1) | TEST | The S1 statue lesson repeated with no standing start. | D2 p062 shot 5; F2 p071R (medium) |
| P-S1-h | S1 | square pad (walled; parapets on the far sides) | ≈4x4 | 0 | walk | static; edges: walled on the far sides | CHECKPOINT-PAD, REST | Walls appear only around saves: the one place you cannot fall off. | F2 p071R; D2 p062 shot 6 (high) |

#### S2 — C1 → C2

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S2-a | S2 | square pad (a lizard on it) | ≈2 | 0 | jump past the lizard | static; edges: open | STEPPING | A guarded take-off for the TNT ledge. | D2 p062 shot 7 (low-medium) |
| G-S2-a | S2 | bottomless gap | ≈1-2; landing TNT ledge | 0 | plain | lizard on the take-off pad (D2 7: jump past it) / fail: death (lethal; run-up ≈1) | HURDLE | Jump past the lizard rather than fight on a small pad. | D2 p062 shot 7 (low-medium) |
| P-S2-b | S2 | narrow ledge (long, on columns) with two 2-high TNT stacks | ≈1.5-2 wide × ≈8 long; stacks ≈5 apart | +2 (stack tops) | jump onto stack 1, stomp the monkey, onto stack 2, off | the stacks fill most of the ledge width, so you cross them by landing on them, which starts their 3-count; edges: open | TIMING-STEP | Crates as platforms with a timer: each stack is a step that expires. | F2 p071R; D2 p062 shot 8 (medium) |
| G-S2-b | S2 | lit-TNT hurdles on a narrow ledge | ≈5 of floor between the stacks; landing TNT top (2-high) | +2 / −2 | plain, enemy-bounce | TNT 3-count once landed on; the monkey patrols between the stacks / fail: death (blast) or fall (lethal; run-up ≈2) | TIMING-GATE | D2 8: stand on the TNT, stomp and spin the monkey when it returns, then hit the next stack and jump before it blows. | D2 p062 shot 8 (a stack counting 3) (medium) |
| P-S2-c | S2 | crumbling ledge (one tile wide) | ≈1.5 wide × 5-6 tiles (≈8) | 0 | run and jump | tiles disappear if you wait (D2 9); edges: open | CHOKE | A floor that forbids waiting, carrying two Nitros that forbid hurrying. | D2 p062 shot 9; F2 p071R (medium) |
| G-S2-c | S2 | crumble run with two Nitros on the centre line | hops ≈1-1.5 (over each Nitro); run ≈8 long; Nitros ≈3 apart; landing tile after each Nitro | 0 | running, plain | collapsing tiles / fail: death (lethal; run-up continuous) | TEST | Two pressures in opposite directions on one-tile footing. | D2 p062 shot 9 (medium) |
| P-S2-d | S2 | square pad (walled) with a steel arrow | ≈3 | arrow reaches ≈+3-4 (loose mask above) | walk; arrow bounce | static; edges: walled at the back | REST, PERCH | A rest pad with a vertical bonus: the mask is reached only by the arrow. | F2 p071R; D2 p062 shot 10 (medium) |
| P-S2-e | S2 | corridor (raised causeway with high walls, the ! room) | ≈3 wide | 0 | walk | static; edges: walled (ornate) | ARENA | The widest floor of the route, with walls for once: a room in which to choose whether to arm the trap. | D2 p062 shot 11; F2 p071R POINT3 (medium) |
| P-S2-f | S2 | corridor (one-tile walkway rising into the screen) | ≈1.5 × ≈8 | rising | walk; jump over the monkey | static; a monkey walks away along it; edges: open | CHOKE | One lane with an enemy in it: you must deal with it from behind (D2 12). | D2 p062 shot 12 (medium) |
| P-S2-g | S2 | square pad (C2 + round green-gem pad) | ≈3 | 0 | walk | static; edges: open | CHECKPOINT-PAD | The save is at the optional route's door. | D2 p062 shot 13 (high) |

#### GEM — gem course (green-gem pad at C2; no boxes)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-GEM-a | GEM | stepping stones (square pads in log alleys) | ≈2 | stepped ±0.5-1 | plain jumps | static; edges: open | STEPPING | Stable pads where you wait for the next log. | D2 p062 shots 14–15; p063 27–28, 32–34 (same pattern on the main route) (medium) |
| P-GEM-b | GEM | crumbling tile rows | ≈5 tiles | 0 | run | collapse behind you; edges: open | CHOKE | D2 16 and 24: run across before the floor vanishes. | D2 p062 shot 16; p063 shot 24 (medium) |
| P-GEM-c | GEM | collapsing hex pads ×2 | ≈2 | 0 | plain jumps | collapse; edges: open | TIMING-STEP | Crumble in hex form. | D2 p063 shot 18 (medium) |
| P-GEM-d | GEM | tilting pillars (hex tops) ×2 | ≈2 | 0 | jump when it bends closest | bend toward and away from you; edges: open | TIMING-STEP | D2 21–22: jump onto the tilting platform as it bends closest. | D2 p063 shots 21–22 (medium) |
| P-GEM-e | GEM | secure platforms (named as breathers) | ≈2-3 | 0 | land | static; edges: open | SAFE-ISLAND | D2 23 and 25: a secure platform for a quick breather after a crumble run. | D2 p063 shots 23, 25 (medium) |
| P-GEM-f | GEM | wide floor (ape-faced room) | ≈4 | 0 | walk | static; edges: walled | REST | Fruit and a loose mask: a reward room mid-course. | D2 p063 shot 26 (medium) |
| G-GEM-a | GEM | bottomless gaps with incoming logs | ≈2; landing ≈2 pad | ±0.5 | plain | logs from an off-screen gorilla bounce along the pads toward you: wait for one to pass, then jump two platforms (D2 14–15, 19); at one pad jump straight up to dodge (D2 27) / fail: death (knocked off or fall) (lethal; run-up ≈1) | RHYTHM | The projectile sets a two-jumps-then-wait cadence. | D2 p062 shots 14–15; p063 19, 27 (medium) |
| G-GEM-b | GEM | crumble runs (one beside a fire statue) | no jump inside the row; run ≈7 long (five tiles); landing next pad | 0 | running | tiles collapse; D2 17: keep running and you'll make it past the fire / fail: death (lethal; run-up continuous) | TEST | Statue plus crumble without stopping: the S3 recipe in advance. | D2 p062 shots 16–17; p063 24 (medium) |
| G-GEM-c | GEM | moving-platform crossing (tilting pillars) | ≈1.5-2.5 (varies with the lean); landing ≈2 tilting top | 0 | plain | pillar lean / fail: death (lethal; run-up 0) | TEST | Same device as POINT8 on the main route. | D2 p063 shots 21–22 (medium) |
| G-GEM-d | GEM | drop-down (three platforms down to the return pad) | -; landing return green-gem pad beside the S4-d ?/? | down ≈3 steps | plain | none / fail: none (not lethal) | REST | The exit drops you onto the main route beside a crate stack you cannot miss. | D2 p063 shot 30 (medium) |

#### S3 — C2 → C3

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S3-a | S3 | corridor (single-lane walkway between a statue pair) | ≈1.5 × ≈8-10 | rising | wait, then run | static; statues on raised blocks either side; edges: open | CHOKE | The lane is the flame line: there is no side step. | F2 p072L POINT4; D2 p064 shot 37 (medium) |
| P-S3-b | S3 | rotating platforms (4 hex pads on a ring) | ≈2.5-3 each; gaps ≈1.5-2 | 0 | jump on when a pad swings to the front, ride | rotate around a centre; the ride carries you to the bonus pad (D2 38); edges: open | TIMING-STEP | A moving platform used as transport to the bonus. | F2 p072L POINT5; D2 p064 shot 38 (medium) |
| G-S3-a | S3 | moving-platform crossing (rotating ring) | ≈1.5-2; landing moving hex ≈2.5-3 | 0 | plain, ride | ring rotation: jump when a pad is in front (POINT5) / fail: death (lethal; run-up ≈1) | TIMING-GATE | Wait-and-board timing with a generous landing. | F2 p072L POINT5; D2 p064 shot 38 (medium) |
| P-S3-c | S3 | round/octagonal pillar tops (bonus pad among them) | ≈2 | ±0.5 | plain jumps | static; edges: open | STEPPING, BONUS-PAD | A pillar cluster shared with a hopping monkey. | F2 p072L; D2 p064 shot 45 (medium) |
| G-S3-b | S3 | bottomless gaps (pillar to pillar) | ≈1-2; landing ≈2 pillar tops; the monkey hops ahead | ±0.5 | plain | the monkey hops the same line / fail: death (or knocked off) (lethal; run-up ≈1) | TEST | D2 45: follow behind the monkey and spin it when you can. | D2 p064 shot 45 (medium) |
| P-S3-d | S3 | crumbling lane (single-lane walkway) between statue pairs | ≈1.5 wide; ≈8-10 long in two halves | rising | consecutive jumps | tiles crumble (POINT6); edges: open | CHOKE | The fire says wait; the floor says go. POINT6: hesitate and you are burnt. | F2 p072L POINT6; D2 p064 shot 46 (medium) |
| P-S3-e | S3 | square pad (walled, mid-lane, carrying the Aku box) | ≈2.5 | 0 | jump in during a gap in the fire | static; edges: walled | SAFE-ISLAND | A safe island with the level's only mask box, between the two statue pairs. | F2 p072L; D2 p064 shot 47 (medium) |
| G-S3-c | S3 | crumble run through two statue pairs | hops ≈1-1.5; run ≈4-5 long per half; landing Aku pad, then the C3 platform | rising | running, plain | statue breath: start as the fire is dying and keep jumping (POINT6) / fail: death (burn or fall) (lethal; run-up continuous) | TEST | D2 47: grab the Aku, then jump before the statues end their cycle. | F2 p072L POINT6; D2 p064 shots 46–47 (medium) |
| P-S3-f | S3 | square pad (walled, C3) | ≈4x4 | 0 | walk | static; edges: walled; a Nitro at the outer corner | CHECKPOINT-PAD | Save after the statue gauntlet. | F2 p072L; D2 p064 shot 48 (high) |

#### S4 — C3 → C4

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S4-a | S4 | corridor (walkway) with Nitro – rat – Nitro | ≈2 wide | 0 | jump, bounce off the rat, jump | static; edges: open | CHOKE | Explosive hurdles with an enemy as the stepping stone between them. | F2 p072R POINT7; D2 p064 shot 48 (medium) |
| G-S4-a | S4 | Nitro hurdles with an enemy step | ≈3-4 in all; landing the rat, then floor | 0 | plain, enemy-bounce | none (or one dash-jump over everything, D2 48) / fail: death (lethal; run-up ≈1-2) | TEST | POINT7 チュールを足場に: use the rat as footing between two Nitros. | F2 p072R POINT7; D2 p064 shot 48 (medium) |
| P-S4-b | S4 | narrow ledge (single lane, diagonal) with a TNT at each end | ≈1-1.5 × ≈6 | rising | stomp the near TNT when the lizard reaches the far end | static; a lizard paces between the TNTs; edges: open | CHOKE | A lane that turns the lizard's own patrol into a bomb delivery. | F2 p072R; D2 p064 shot 49 (medium) |
| P-S4-c | S4 | square pad (walled) with ? ? | ≈3 | 0 | walk | static; edges: walled | REST | Payout before the perspective test. | F2 p072R; D2 p064 shot 50 (high) |
| P-S4-d | S4 | tilting pillars ×2 (hex tops) | ≈1.5-2 tops | 0 to +1 | jump at the closest approach | lean toward each other and back; once on, steer so you don't slide off (POINT8); edges: open | TIMING-STEP | Depth judgement and timing on a moving top. | F2 p072R POINT8; D2 p064 shots 50–51 (medium) |
| G-S4-b | S4 | moving-platform crossing (tilting pillars) | ≈1.5-2.5 (varies with the lean); landing ≈1.5-2 tilted top | 0 to +1 | plain | pillar lean (D2 51: jump when the two are closest) / fail: death (slide off or fall) (lethal; run-up 0) | TEST | The gap width itself is the timing signal. | F2 p072R POINT8; D2 p064 shots 50–51 (medium) |
| P-S4-e | S4 | square pad with ?/? and the gem-course return pad | ≈3 | 0 | walk | static; edges: open | REST | Where the optional route rejoins. | D2 p063 shot 30; p064 52 (high) |
| P-S4-f | S4 | square pad (walled, C4) | ≈4x4 | 0 | walk | static; edges: walled on 3 sides | CHECKPOINT-PAD | Save beside the rat ring and the green !. | F2 p072R; D2 p063 shot 31 (high) |

#### S5 — C4 → goal

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S5-a | S5 | rotating platforms (hex) circling the floating green ! | ≈2 each | 0 | jump on when one is closest to the C4 room | rotate round the green !; a rat rides each; edges: open | TIMING-STEP | Moving pads that bring the enemy launcher to you. | D2 p063 shot 31; F2 p072R top (medium) |
| G-S5-a | S5 | void with an enemy bounce to a floating switch | not visible (several u); landing green ! block (1x1), then back to a pad | up to the floating ! (not visible) | ride, enemy-bounce | pads rotate; the rats ride them / fail: death (fall) (lethal) | TEST | D2 31: bounce off the rat, take aim, launch onto the switch floating in space, jump back to a platform. | D2 p063 shot 31 (medium) |
| P-S5-b | S5 | stepping stones (five small square pillars) | ≈1.5 tops; gaps ≈1-2 | descending | plain jumps in pairs | static; edges: open | STEPPING | Stable pillars where you wait for the gorilla's logs. | F2 p072R; D2 p063 shots 32–34 (medium) |
| G-S5-b | S5 | bottomless gaps with rolling logs | ≈1.5-2; landing ≈1.5 pillar tops | descending | plain | Don-chan's logs: wait for a log to pass, jump two platforms, wait (D2 32–33) / fail: death (knocked off or fall) (lethal; run-up ≈1) | RHYTHM | The gem course's cadence, given to every player at the end. | D2 p063 shots 32–34; F2 p072R POINT9 (medium) |
| P-S5-c | S5 | wide floor (walled goal platform with a grid floor) | ≈5x5 | 0 | walk | static; edges: walled | REST | Finish on the biggest walled floor in the level. | F2 p072R (medium) |

#### BONUS — bonus round (side-scroll)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | BONUS | crate structure as terrain (4x4 iron-bound block) | 4x4 | +4 | climb into the notch, slam | breakable only by body slam; edges: open | ARENA | The bonus's first floor is made of crates. | D2 p064 shot 39 (high) |
| P-B-b | BONUS | phase bridge (4 outline frames) plus a 2-step pair | 4 frames wide; 2 steps | 0 / +1-2 | hit the !, run across | materialised by the floating !; edges: open | STEPPING | Switch-made footing, not loot (the counter does not rise when the frames fill). | D2 p064 shot 40 (medium) |
| G-B-a | BONUS | gap bridged by switch-made frames (depth below not visible) | ≈4; landing raised slab beyond | 0 | running | ! must be hit first / fail: not visible (lethal: not visible; run-up ≈2) | TEACH | A switch that builds the route rather than paying a reward. | D2 p064 shot 40 (low-medium) |
| P-B-c | BONUS | crate towers as perches (3-5 iron-bound high) | 1 wide | +3 to +5 | bounce up from the TNT, wait on top, slam down | blown up by the TNT at their foot; edges: open | PERCH | D2 43: you must be on top of the pile when it blows. | D2 p064 shots 41–43 (high) |

### Jump sequences

| id | section | count | moves | rhythm | widest gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 4 | plain | syncopated (enemies on two landings) | ≈2 | P-S1-e hex row | no | Pillar chain broken up by enemy pads. | D2 p062 shots 3–4; F2 p071R |
| J-S1-b | S1 | 3 | plain | even, timed to the end of a burst (≈2-3 hops) | ≈2 | P-S1-h C1 | yes | Once the fire stops you must hop all the pillars before it returns. | D2 p062 shot 5 |
| J-S2-a | S2 | 4 | plain, enemy-bounce | syncopated: stack 1, monkey, stack 2, off (wait for the monkey, then beat the fuse) | ≈2-3 | not visible (end of the ledge) | yes | A lit stack cannot be stood on for long, so the chain runs on the fuse. The stacks stand ≈5 u apart, with the monkey's floor between them. | D2 p062 shot 8 |
| J-S2-b | S2 | 3 | running, plain | even (Nitros ≈3 apart) | ≈3 | P-S2-d arrow pad | yes | The floor collapses, so the Nitro hops cannot be lined up at leisure. | D2 p062 shot 9 |
| J-GEM-a | GEM | 2 | plain | syncopated: two jumps, wait for the log, repeat (2 + 2 + 2…) | ≈2 | each stable pad | no | The log sets the beat. | D2 p062 shots 14–15; p063 19–20, 27–28 |
| J-GEM-b | GEM | 6 | plain, running | timed (tilt), then no-stop (crumble) | ≈2 | P-GEM-e secure platform | partly | D2 21–25: tilting pillars, a crumbling pad, a secure platform, a crumble row, three jumps to a secure platform. | D2 p063 shots 21–25 |
| J-S3-a | S3 | 2 | plain, ride | wait for the pad, board, ride (2-3 jumps) | ≈2 | P-S3-c pillar cluster | no | The ring removes the need to jump far: the timing is the boarding. | F2 p072L POINT5; D2 p064 shot 38 |
| J-S3-b | S3 | 3 | plain | follow the monkey's hops | ≈2 | P-S3-c (the ?/? pillar) | no | The enemy leads the line you take. | D2 p064 shot 45 |
| J-S3-c | S3 | 5 | running, plain | even, no hesitation (≈4-6 consecutive jumps) | ≈1-2 | P-S3-e Aku pad, then P-S3-f C3 | yes | POINT6 迷いは禁物: consecutive jumps through crumbling footing while the fire dies. | F2 p072L POINT6; D2 p064 shots 46–47 |
| J-S4-a | S4 | 3 | plain, enemy-bounce | even (or one dash-jump over everything) | ≈1.5 | P-S4-b ledge start | yes | Nitro, rat, Nitro as one motion (POINT7). | F2 p072R POINT7; D2 p064 shot 48 |
| J-S4-b | S4 | 3 | plain | wait for the lean, jump | ≈2.5 at the widest | P-S4-e ?/? pad | no | You may stand on a tilting top if you steer (POINT8). | F2 p072R POINT8; D2 p064 shots 50–51 |
| J-S5-a | S5 | 3 | ride, enemy-bounce, plain | timed to the rotation: onto a pad, off the rat onto the !, back to a pad | not visible | a rotating pad / C4 | no | The switch is out of reach except by an enemy bounce. | D2 p063 shot 31 |
| J-S5-b | S5 | 2 | plain | 2-and-wait, three times (≈6 jumps over 5 pillars) | ≈2 | P-S5-c goal platform | no | D2 32–34: wait for the log, jump two platforms. | D2 p063 shots 32–34 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S1-a | S1 | fire statue (ボワボワ石像), single, at the start | flank (beside the first jump) | breathes flame across the jump in bursts; wait until it stops (D2 1). No cycle length stated | wait-and-go | S1-a pile on the landing | TEACH, TIMING-GATE | Taught from a standstill on a safe start pad. | D2 p062 shot 1; F2 p071R |
| O-S1-b | S1 | fire statue, single, before C1 | flank (beside the pillar hops) | jump the platforms as the fire burns out (D2 5) | wait-and-go | J-S1-b pillar hops | TEST | Same statue, now while hopping. | D2 p062 shot 5; F2 p071R |
| O-S2-a | S2 | TNT stacks used as lit hurdles | on path (fill the ledge) | 3-count once you land on one | use as a step, leave before the blast | E-S2-b monkey | TIMING-GATE | A crate whose timer turns a platform into a countdown. | D2 p062 shot 8; F2 p071R |
| O-S2-b | S2 | crumbling ledge | on path | disappears if you wait (D2 9) | outrun | S2-b Nitros | TEST | No-wait floor with no-touch crates. | D2 p062 shot 9 |
| O-S2-c | S2 | switch-armed Nitros (outlines become Nitro) | on path around the ! | appear only if the ! is hit | go around | S2-d | AREA-DENIAL | An opt-in hazard: the all-box player arms it; the clear player never sees it. | F2 p071R POINT3; D2 p062 shot 11 |
| O-GEM-a | GEM | rolling logs thrown by gorillas (≥3) | across path (rolling toward you along the platform chain) | periodic throws (not stated); logs bounce along the pads; at one point jump straight up to dodge (D2 27) | wait-and-go, jump over, destroy (spin, F2 p099R) | G-GEM-a pads | RHYTHM, TIMING-GATE | F2 p099R: stop on non-crumbling footing and spin the logs away; deeper in they are hard to see. | D2 p062 shots 14–15; p063 19–20, 27–28; F2 p099R |
| O-GEM-b | GEM | crumbling tiles and collapsing hexes | on path | collapse when stood on | outrun | O-GEM-a logs | TEST | Crumble replaces safe pads between log waves. | D2 p062 shot 16; p063 18, 23–24, 29 |
| O-GEM-c | GEM | fire statue beside a crumble row | flank | D2 17: keep running and you'll make it past the fire | outrun | O-GEM-b | TEST | The statue cannot be waited out because the floor will not wait. | D2 p062 shot 17 |
| O-GEM-d | GEM | tilting pillars | on path | bend toward and away from you | wait-and-go | P-GEM-e secure pad after | TEST | POINT8 device, harder. | D2 p063 shots 21–22 |
| O-S3-a | S3 | fire statue pair (both sides of a lane) | flank, both sides | both breathe; hold still until they finish (POINT4). D2 37: wait for the moving heads to stop belching flames, then jump over and run through | wait-and-go | P-S3-a single lane | TEACH | First pair, with a safe floor to wait on. | F2 p072L POINT4 ダブルファイヤー; D2 p064 shot 37 |
| O-S3-b | S3 | rotating ring of four hex pads | on path | continuous rotation; jump on when a pad comes to the front | wait-and-go | bonus pad at the end of the ride | TIMING-GATE | Moving platform as a gate and as transport. | F2 p072L POINT5 動く足場; D2 p064 shot 38 |
| O-S3-c | S3 | fire statue pairs ×2 over a crumbling lane | flank, both sides | start as the fire is about to die; consecutive jumps; any hesitation burns you (POINT6) | wait-and-go, outrun | S3-b Aku pad mid-lane | TEST | The pair lesson with the waiting floor removed. | F2 p072L POINT6 迷いは禁物; D2 p064 shots 46–47 |
| O-S4-a | S4 | Nitro pair around a rat | on path | static | jump over | E-S4-a rat | TEST | Explosives as hurdles with an enemy step. | F2 p072R POINT7; D2 p064 shot 48 |
| O-S4-b | S4 | TNT pair at the ends of a narrow ledge | on path | 3-count once stomped | destroy (light it as the lizard arrives) | E-S4-b lizard | TEST | D2 49: hop on the near TNT as the lizard reaches the far box; the explosion kills it. | F2 p072R; D2 p064 shot 49 |
| O-S4-c | S4 | tilting stone pillars | on path | lean toward each other and back; jump at the closest approach (POINT8) | wait-and-go | S4-c ? ? pad | TEST | Perspective plus motion. | F2 p072R POINT8 遠近感をつかめ; D2 p064 shots 50–51 |
| O-S5-a | S5 | rotating pads with rats circling the floating green ! | around the switch | continuous rotation | wait-and-go | E-S5-a rats | TIMING-GATE | The switch is surrounded by moving enemies you must use. | D2 p063 shot 31; F2 p072R |
| O-S5-b | S5 | rolling logs thrown by Don-chan | across path (along the pillar line toward you) | periodic (not stated): wait for a log, jump two platforms (D2 32–33) | destroy (spin), jump over, wait-and-go | E-S5-b | RHYTHM | POINT9: move while spinning the logs away; beat Don-chan with a jump-spin. | F2 p072R POINT9 丸太が飛んでくる; D2 p063 shots 32–34 |

Hazard tally (from the F2 maps and D2): 8 fire statues on the main route (S1: 2 singles; S3: 3 pairs), ≥1 more in the gem course; crumbling floors in S2 (one ledge of 5–6 tiles) and S3 (the lane between the statue pairs, in two halves), plus ≥5 crumbling pieces in the gem course; 1 rotating ring of 4 hex pads (S3) and 1 ring of 4 rotating pads carrying rats (S5); 2 tilting pillars on the main route and 2 in the gem course; log throwers: 1 on the main route (S5), ≥3 in the gem course. No cycle lengths are stated.

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | rat (チュール) | static | stands beside the ? on a roomy pad | spin, stomp | guarding crate | TEACH, GUARD | yes | The first enemy, met on a wide pad (only the void is dangerous). D2 3: smash the rat, break the box. | D2 p062 shot 3 (medium) |
| E-S1-b | S1 | rat on the hex row | static | stands on the hex row next to a lizard | jump over (recommended), spin, stomp (fails: killing it frees the lizard to pace) | landing platform | BAIT | no | D2 4: jump over the rat; killing it sets the lizard pacing. An enemy you should not kill. | D2 p062 shot 4 (medium) |
| E-S1-c | S1 | frilled lizard (トゲック) on the hex row | patrol-1D | starts pacing once the rat is gone | slide, spin | landing platform | GUARD | no | Coupled to E-S1-b. | D2 p062 shot 4 (medium) |
| E-S1-d | S1 | frilled lizard on the long narrow walkway | patrol-1D | paces the length of the walkway | slide (lengthwise) | on line (narrow walkway) | TEACH, GATEKEEPER | no | POINT2 足場が縦長: on long narrow footing, slide it lengthwise. | F2 p071R POINT2 (medium) |
| E-S2-a | S2 | frilled lizard on the pad before the TNT ledge | patrol-1D | paces a small pad | jump over | take-off pad | HURDLE | no | D2 7: jump past the lizard. | D2 p062 shot 7 (low-medium) |
| E-S2-b | S2 | monkey (モンプー) between the TNT stacks | patrol-1D | paces the ≈5-u floor between the stacks | stomp then spin (from a stack) | between hazards (TNT stacks) | TIMING-GATE | no | Its return sets the moment to leave the lit stack. | D2 p062 shot 8; F2 p071R (medium) |
| E-S2-c | S2 | monkey walking away up the C2 walkway | patrol-1D | walks away from you along a one-tile lane | jump over, run it down, spin from behind | on line (one-tile walkway) | HURDLE | no | D2 12: wait for it to head away, jump over, run it down and spin it. | D2 p062 shot 12 (medium) |
| E-GEM-a | GEM | gorilla (ドンちゃん) ×≥3, log thrower | projectile | stands on a pad at the end of a platform chain and throws logs along it | jump-spin, tag after bouncing in (D2 20) | landing platform at the far end of a chain | PROJECTILE, GATEKEEPER | no | Every alley ends at its thrower. | D2 p062 shots 14–15; p063 20, 28; F2 p099R (medium) |
| E-S3-a | S3 | monkey hopping pillar to pillar | hopper | hops along the pillar cluster ahead of you | spin (from behind when you catch it) (fails: letting it knock you off) | on the stepping-stone line, guarding the ?/? | GUARD | no | D2 45: follow behind it and spin it when you can. | D2 p064 shot 45; F2 p072L (medium) |
| E-S4-a | S4 | rat between two Nitros | static | stands between the Nitros | stomp (use as footing) | between hazards | TOOL/STEP | no | POINT7. D2 48: you can also dash-jump over everything; there is no need to waste a life on the rat. | F2 p072R POINT7; D2 p064 shot 48 (medium) |
| E-S4-b | S4 | frilled lizard on the TNT ledge | patrol-1D | paces between the two TNTs | TNT/blast (light the near TNT as it reaches the far end), slide (fails: lighting the TNT while it is beside you) | between hazards | TEST | no | The lizard's patrol delivers it to the blast. | D2 p064 shot 49; F2 p072R (medium) |
| E-S5-a | S5 | rats ×4 on rotating pads around the green ! | patrol-loop | carried round the switch on rotating pads | stomp (bounce) | moving platform | TOOL/STEP | no | The only way up to the switch is an enemy bounce. | D2 p063 shot 31; F2 p072R (medium) |
| E-S5-b | S5 | Don-chan (gorilla) at the end of the pillar line | projectile | throws logs along the pillars | jump-spin | landing platform (last pad before the goal) | GATEKEEPER, PROJECTILE | no | POINT9: beat Don-chan with a jump-spin. | F2 p072R POINT9; D2 p063 shot 34 (medium) |

D2 3 and 4 give conflicting advice about rats (smash the rat; jump over the rat), so they are recorded as two rats, one beside the ? and one on the hex row. F2 draws two spiky critters on these pillars. The first-wave map lists 1 rat and 2 lizards here.

### Section beats

- **S1** (gaps 4 · enemies 4 · hazards 2): start pad (pipe) → statue 1 → jump to the big platform → 2x2 pile + hidden Nitro → unsteady pad → pillar: rat + ? → hex row: rat + lizard (jump the rat) → narrow walkway: lizard (slide lengthwise) → statue 2 → pillar hops → C1 (walled)
- **S2** (gaps 3 · enemies 3 · hazards 3): pad with a lizard (jump past) → TNT ledge: two lit stacks + monkey → crumbling ledge + 2 Nitros → arrow pad (TNT; loose mask above) → ! room (don't press it for a clear) → one-tile walkway: monkey walking away → C2 + gem pad
- **GEM** (gaps 4 · enemies 3 · hazards 4): log alley: wait, jump 2, wait; tag gorilla 1 → crumble row → crumble row past a fire statue → 2 collapsing hexes → log alley; tag gorilla 2 → 2 tilting pillars → crumbling pad → secure pad (breather) → crumble row → 3 jumps to a secure pad → ape room (fruit + mask) → log alley: pause and jump straight up → gorilla 3 → crumbling hex → clear gem → drop 3 platforms to the return pad
- **S3** (gaps 3 · enemies 1 · hazards 3): statue pair 1 over a one-lane walkway (wait) → rotating 4-hex ring (ride to the bonus pad) → bonus pad → pillar line with a hopping monkey (?/?) → statue pair 2 + crumbling lane (consecutive jumps) → Aku pad (safe island) → statue pair 3 + crumbling lane → C3 (+ Nitro)
- **S4** (gaps 2 · enemies 2 · hazards 3): Nitro – rat – Nitro (rat as step) → narrow TNT ledge with a pacing lizard (TNT trap) → ? ? pad (rest) → 2 tilting pillars (jump at the lean) → ?/? pad (gem return) → C4
- **S5** (gaps 2 · enemies 5 · hazards 2): rotating pads + 4 rats around the floating green ! (rat bounce) → steps down → 5 pillars + Don-chan's logs (wait, jump 2) → Don-chan (jump-spin) → goal
- **BONUS** (gaps 1 · enemies 0 · hazards 0): iron block (notch, slam) → ! → outline bridge over a gap + steps → ? on an iron tower → TNT + iron tower (stand on top) → TNT + 5-iron tower → wood steps → exit pyramid

Hazard counts include environmental hazards and explosives used as geometry (TNT stacks, Nitro hurdles), not crates inside collection clusters.

### Geometry and enemy design logic

1. The level runs on two opposite pressures. Fire statues say "wait" and the floors say "don't": crumbling tiles, a crumbling ledge, tilting pillars and a rotating ring. Its hardest beats put both on one lane (O-S3-c), and POINT6 sums it up: hesitate and you are burnt.
2. The statue lesson is ordered. First comes a single statue beside a standing start (O-S1-a), then a single statue beside a hop chain (O-S1-b). Next is a pair flanking a lane with a solid floor (O-S3-a: wait for both), and finally pairs over crumbling tiles with a safe pad between them (O-S3-c). There are 8 statues on the main route: 2 singles and 3 pairs.
3. Walls mark rest. Every checkpoint sits on a walled square platform (parapets on three sides), and these are almost the only edges you cannot fall off. Everything else is open-edged over a void, so rest is readable from the geometry alone.
4. Lanes are one tile wide (≈1.5 u) wherever enemies patrol: the lizard walkway, the monkey walkway and the TNT ledge. The lane makes the enemy unavoidable and makes the lengthwise slide the right tool (POINT2).
5. Enemies are tools or triggers more often than obstacles. A rat is a stepping stone between Nitros (E-S4-a), and a monkey's return times your exit from a lit TNT (E-S2-b). A lizard walks into its own TNT (E-S4-b), rats carry you up to the green ! (E-S5-a), and one rat should not be killed because it releases a lizard (E-S1-b).
6. Perspective is a deliberate test. The into-screen camera looks along pillar chains, and D2 19 says the jumps only look long. POINT8 asks the player to grasp the depth on tilted pillars, and F2 p099R warns that the gem course's diagonal jumps are hard to judge. Gaps stay ≈1–2 u wide so that a plain jump is nearly always enough, once trusted.
7. Moving platforms serve as both transport and gate. The rotating hex ring carries you to the bonus pad (P-S3-b). The rotating rat ring around the floating green ! is the climax, because there the moving platform delivers the enemy you must bounce on (P-S5-a).
8. Explosives are geometry. TNT stacks fill a narrow ledge, so you must land on them and race their fuse (G-S2-b). Nitros on a crumbling ledge combine a floor you cannot wait on with crates you cannot touch (G-S2-c). Nitros bracket a rat so that the enemy becomes the bridge (G-S4-a).
9. The gorilla alleys use a projectile to set the rhythm: wait for the log, jump two platforms, wait again (G-GEM-a, G-S5-b). The same cadence opens the gem course and closes the main route, so every player meets it once.
10. The gem course remixes the theme at its hardest. It has crumble rows, collapsing hexes, tilting pillars, a statue beside a crumble row and three gorillas, but it names its breather platforms explicitly (D2 23, 25) and holds no boxes. It is a pure skill route.
11. Recovery is ungenerous in geometry (nearly every gap is bottomless) and generous in rests and help. Each checkpoint is walled, the Aku pad sits inside the statue gauntlet, and loose masks wait above the steel arrow and beside the green !.
12. Difficulty comes from timing couplings rather than from gap length or enemy count. Fire, crumble, tilt, rotation, logs and fuses each modulate gaps that rarely exceed 2 u. A designer can build every section from one short gap plus one timer.

### Geometry transfer to the skate game

1. Fire lane: put a pair of `firetiki` heads (cycle/phase offset so their windows overlap briefly) on either side of a one-crate-wide walkway (≈1.2–1.7 m). Floor it with `crumble` tiles (short `shake`, ≈0.3 s) in two halves, and place a walled 2–3-crate safe pad (≈2.3–3.5 m) between the halves with a mask on it. On foot the lane is ≈8–10 crates (≈9–12 m), roughly 1–1.3 s of running at 9 m/s, so the shared fire window must be at least that long.
2. Tilting-pillar crossing: there is no tilt primitive, so use two `mover` pads (≈1.7–2.3 m tops) oscillating on `axis: "x"` toward each other. The gap should open and close between ≈1.7 and ≈2.9 m (1.5–2.5 crates): always inside a full jump (≈5.6 m), but only comfortable for a tap jump at the narrowest point. That teaches "jump when they are closest".
3. Log alley: line up five 1.5-crate pillars (≈1.7 m) with ≈2-crate gaps (≈2.3 m) and roll a `stone` along the line toward the player (default axis Z), with its speed and range tuned so one boulder passes every two jumps. Put a `sentry` or a `charger` on the last pad as the thrower or gatekeeper.
4. Walled checkpoints in open levels: in a level built on open-edged pillars over a `pit`, give every checkpoint pad a one-crate parapet on three sides, so rest is visible at a glance. For skaters, the parapet tops are ledges that grind by default.
5. Enemy-bounce switch: float a green ! about 4–5 m up over a `pit`, beyond the double-jump reach (≈4.6 m). Circle it with stompable `grunt`s riding `mover` pads, because a stomp bounce (≈3 m) plus a double jump reaches it. Put the checkpoint on the boarding pad, as Crash does at C4.

## Open questions / uncertainties
- Bonus internal split after counter 17 (B-d/B-e compositions are estimates; total 49 is firm).
- Whether the bonus outline frames are boxes. Treated as footing because the counter does not rise when they appear.
- Whether S2-c is a TNT (F2 icon) or a plain box (the D2 caption just calls it a box).
- The exact count of outline Nitros (6 + 1 solid read from F2 icons; D2 shot 11 shows at least 1 solid Nitro + 6 frames).
- Geometry: the "unsteady platform" in D2 2 (P-S1-c) is not shown moving. Its behaviour (sinking, wobbling or crumbling) is unknown.
- Geometry: rat and lizard positions in S1. D2 3 and 4 imply two rats, F2 draws two spiky critters, and the first-wave map lists one rat and two lizards.
- Geometry: statue, log, ring and tilt cycles are not stated in seconds in either guide.
- Geometry: whether the bonus outline bridge (G-B-a) spans a lethal gap. D2 40 does not show what lies below it.
- Geometry: the rat-ring launch height and the green ! position (G-S5-a) cannot be measured from D2 31.
- Page note: the D2 Ruination spreads hold shots 1–17 on p062, 18–35 on p063 and 36–52 on p064. The first-wave source line lists p062 as shots 1–8 and is left unchanged.
