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
| Aku | 1 box (between two fire-statue pairs, before C3). Loose masks (not boxes) float above a steel arrow (S2), inside the gem-course "ape room", and after the green ! |
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
| Difficulty | F2 rating こりゃたいへん. F2 p099R calls the box perfect easy ("just clear the normal course properly") apart from the ! / green-! business. The gem course is "insanely hard" and has no boxes |

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
| S1-a | first platform after the opening fire statue | wood ×4, Nitro ×1 (hidden behind) | 2×2 pile with a Nitro tucked behind it | spin from the front only; F2 forbids the body slam here | ON-PATH EXPLOSIVE-MIX HIDDEN SUPPORT-ORDER TEACH | The level's thesis in one pile: the box you want sits next to one you must not touch. A wide spin or a body slam next to the pile sets off the hidden Nitro. Breaking the pile from the front exposes it | F2 p071R POINT1 + screenshot; D2 shot 2 ("all four boxes … cleverly hidden Nitro") | high |
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
| S2-c | platform beside a steel arrow; a loose Aku mask floats above the arrow | TNT ×1 (F2 icon; D2 calls it "the box") | single next to the arrow block | break it, then bounce on the arrow to grab the mask | TOOL EXPLOSIVE-MIX AKU | The arrow is a tool to reach a mask that floats out of reach. The adjacent TNT means you mustn't linger while bouncing | F2 p071R zoom; D2 shot 10 | medium |
| S2-d | the ! room (POINT3) | Nitro ×7 (1 solid + 6 outline that the ! turns into Nitro) | ring of outlines around the ! block | hit the ! only for the perfect; the green ! later destroys them | SWITCH OUTLINE NITRO-SWITCH EXPLOSIVE-MIX COUNT-TRAP | **A switch that makes the room more dangerous.** F2 and D2 both say don't press it unless you're going for all boxes. The outline Nitros count toward the total, so the perfect forces you to arm a trap, walk out of it, and detonate it with the green ! at the end | F2 p071R POINT3 + screenshot; D2 shot 11 | high |
| S2-e | end of the monkey ledge | checkpoint ×1 | single, next to the green-gem platform | walk | CHECKPOINT ROUTE-SPLIT | The save sits at the gem-course entrance | F2 p071R; D2 shot 13; F2 p099R screenshot | high |

### GEM COURSE — green-gem platform at C2 (0 boxes; F2 p099R; D2 shots 13–30)
No boxes (F2 p099R says so explicitly; D2 shots 14–29 show none). Contents: log-throwing gorillas at range, collapsing and tilting platforms, a fire run, and an "ape-faced room" with fruit and a loose Aku mask (D2 26). The hidden gem is near the end (D2 29). A return green-gem pad then drops you back on the main route beside the S4-d ?/? stack (D2 30, 52). For the bible: an optional route can be a pure skill test with **no** box obligation, so the all-box player has no reason to suffer it.

### S3 — C2 → C3  (4; F2 p072L; D2 shots 36–48)
```
 e:fire-statues L+R (POINT4) ─ 4 rotating platforms (POINT5) ─▶ [BONUS ? pad] on a pillar
   ─ pillar: e:monkey [?/?] ─ fire lane ─ crumbling platforms between statue pairs (POINT6) ─ [Aku] ─ statues ─ [C3] [N]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | pillar next to the bonus pad, guarded by a monkey that hops pillar to pillar | ? ×2 | 2-high stack | follow the monkey, spin it, then the stack | ENEMY-LINK STACK ON-PATH | The crate pillar is also the monkey's route. Kill the monkey first or it knocks you off | F2 p072L; D2 shot 45 | high |
| S3-b | small platform between two pairs of fire statues | Aku ×1 | single | jump in during a fire gap, grab, and jump on before the next burst | AKU TIMED ON-PATH | The only mask box in the stage, placed in the fire run where one burn would otherwise end the run. The Aku tip says to learn the statue timing | F2 p072L zoom (Aku-face box); D2 shot 47 | high |
| S3-c | walled platform after the statue lanes | checkpoint ×1 | single (a Nitro sits at the platform edge, counted in S4-a) | walk | CHECKPOINT | Save before the Nitro/rat "mess" | F2 p072L; D2 shot 48 | high |

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

## Open questions / uncertainties
- Bonus internal split after counter 17 (B-d/B-e compositions are estimates; total 49 is firm).
- Whether the bonus outline frames are boxes. Treated as footing because the counter does not rise when they appear.
- Whether S2-c is a TNT (F2 icon) or a plain box (D2 caption "break the box").
- The exact count of outline Nitros (6 + 1 solid read from F2 icons; D2 shot 11 shows at least 1 solid Nitro + 6 frames).
