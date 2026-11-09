# Crash 2 — Stage 18 Cold Hard Crash  (ゆきやまはつづくよ)

Sources: F2 p067L (stage header), p067R (start to the elevator), p068L–p068R (first side-scroll strips, bonus and death-route doors), p069L–p069R (second side-scroll strips), p070L–p070R (return to 3D, goal), p099L (perfect-clear page: order, bonus and death-route cautions, three screenshots, no map); F2 p015 (box legend). D2 p059 (shots 1–20, bonus counters), p060 (shots 21–40), p061 (shots 41–60, "Alternate Path to Clear Gem and Box Gem"). Web corroboration: gamepressure N. Sane Trilogy page for this level (summary only).

Evidence level:
- **Read directly:** the header (155 boxes, superscript 52; 1UP 4 (sub 3), Aku 2 (sub 0), C 5 (sub 0)); every F2 map strip at zoom; all F2 POINT texts 1–21; the p099L cautions; D2 captions 1–60 and the crate stacks in shots 1, 3, 4, 10, 12–15, 17, 18, 20–23, 26, 32, 37, 39, 43, 44, 46, 48, 50, 51, 53, 55–60.
- **Inferred:** the bonus split (D2 box counters 1 → 5 → 7 → 23/24, then a final TNT stack; gamepressure gives 31 bonus crates for N. Sane); the death-route size (52 − bonus); crate counts inside tall columns that F2 draws as one dark slab.
- **Not reconciled:** F2's main-route drawing accounts for **76** boxes, but the header implies **103** (155 − 52). About 27 main-route boxes cannot be placed from these sources. The likely cause is that F2 under-draws tall columns. For example, D2 shot 18 shows a four-crate Aku column where F2 draws two boxes. The death route is about 3 boxes short (18 visible against 21 inferred).
- Unreadable: the D2 HUD counters on main-route shots (too small); whether the outline frames in D2 shot 55 are crates or steel blocks.

## At a glance
| Field | Value |
|---|---|
| Theme | Ice cavern. Slippery ice, icicles, collapsing wooden bridges, falling stump platforms, rolling disc rocks (えんばん岩) |
| Camera | Into-screen (start → elevator); **side-scroll** for the long middle (C1 → C4, p068–p069); into-screen climb to the goal (C4 → goal). F2 header lists the scroll as おく・よこ (depth + side) |
| Total boxes | **155** (F2 p067L header; N. Sane total 154 per gamepressure). Superscript **52** = off-course boxes |
| Boxes per route | main **103** (header 155 − 52; **76 mapped**, ~27 unlocated) · bonus **≈31** (gamepressure; D2 counters reach 23/24 before the last TNT stack) · death route (ドクロコース) **≈21** (52 − 31; 18 seen in D2) · no secret/warp route |
| Checkpoints | 5, all on the main route: C1 top of the elevator; C2 = [W][W][C] column beside the skull-platform outline; C3 beside a steel block before the hidden-! room; C4 where the camera returns to 3D; C5 on the disc-rock island next to the green ! |
| 1UP | 4 (3 off-course): main 1 behind a Nitro in a wall hollow (POINT14); bonus 1 at the end of the final TNT row; death route 2 (one floating behind an outcrop, one outline crate that solidifies only from the route-end !) |
| Aku | 2 (header sub 0): start column group; tall column after the porcupine/! room. D2 shot 53 also claims an Aku crate in the death route, which conflicts with the header |
| TNT | main ≥ 6 (POINT7 floor TNT; bend-pile TNT; penguin-killer TNT; 2×2 pile with 3 TNT) · bonus ≥ 5 (springboard TNT; the final TNT stack) |
| Nitro | main 6 (3 on the strip-2 ledges: landing ledge, penguin ledge, life hollow; 3 on the narrow path after C4) · death route ≈ 9 (1 + 1 + 2 + ≈5). The green ! at C5 detonates every Nitro, so an all-box run must reach it |
| ! switches | 1 porcupine-triggered ! (materialises steel steps, D2 19); **4 hidden ! blocks behind two ice pillars** that solidify an outline row into wood boxes (POINT12); 1 ! at the end of the death route (solidifies the outline 1UP at the route start); green ! at C5 |
| Outline | main row after the hidden-! room (≈3, all-box only); death route outline 1UP (+ unclear frames in D2 shot 55) |
| Iron-bound | none seen |
| Arrows | wooden arrow 1 (death route, D2 53) · steel arrow 1 (p069L, under the penguin ledge; F2 grey icon, D2 26 pale arrow) |
| Striped | ≥ 9: 4-crate floating stair to the bonus platform; 2 in the Aku column; 2 in the bend pile; ground+floating sandwich before C5 (D2 39); bonus striped launch crates |
| Gems | **Clear gem 1** = all 155 boxes (includes bonus and death route). **Clear gem 2** = finish the death route; its platform appears only if you reach C2 without losing a life ("no-miss to here"). p099L warns that taking the death-route gem means jumping out of the route without breaking everything, so a perfect needs a second pass (choose one per run) |
| Enemies | penguins グリン (sliders, spinners, ledge guards), seals ジョー (slide on ice), porcupines ニック (quill timers), wooden smashers |
| Hazards | stump platforms that drop when stood on (POINT1/19), icicles that fall on approach (POINT5/7), wooden bridges that collapse (POINT6), smasher pillars on ice (POINT10/15), rolling disc rocks crossing the path (POINT19–21), slippery ice everywhere |
| Difficulty | F2 rating こりゃたいへん; D2 calls the box gem "ridiculously hard"; the death route is a no-death gate followed by Nitro fields on slippery ice |

## Route skeleton
```
START (3D, into-screen)
 S1  stump pit ─ [Aku group 5] ─ pit ─ penguins×3 slide ─ PILLAR FIELD (8 crates on steel posts, seals) ─ pit ─ [1 by spinning penguin] ─ seal slope ─ ELEVATOR          mapped 14
     │
 S2  C1 ─ smashers/icicles/falling bridges ─ [striped stair 4 + ? ] ─▶ BONUS platform (big ? panel) ──┐                                              mapped 16
     │   ─ [? + TNT under icicle] ─ [box → porcupine → !] ─ [Aku column 4] ─ steel steps ─ [W W C2]    │
     │                                                       │                                         │
     │                                                       └─▶ SKULL PLATFORM (only if no deaths) ─▶ DEATH ROUTE (≈21) ─▶ clear gem 2 / route-end !
     │                                                                                                    (return to C2 by elevator for the all-box run)
 S3  slides ─ [tall column ≈4] ─ penguin ─ (round the bend) [pile 6 + TNT] ─ penguin [TNT] penguin [?/?] ─ smashers ─ [? + steel ⇑]   mapped 16 incl. C3
 S4  C3 ─ 4 hidden ! behind ice pillars ─ [outline row ≈3] ─ Nitro ledges: [N] [N ?] [W ?/?] [N + 1UP] ─ smasher run ─ [W ? W] ─▶ drop to 3D           mapped 15 incl. C4
 S5  C4 ─ [N N . N] narrow path ─ [TNT/? pile 4] ─ [?] ─ porcupines, disc rock ─ [striped sandwich 2] ─ C5 + green !                                    mapped 11 incl. C5
 S6  disc rocks ─ [? stack 2] ─ steel stairs ─ [?/W column 2] ─ twin disc rocks ─ GOAL                                                                    mapped 4
BONUS (from S2): entry row with TNT springboard (≈5) → striped launch + hidden high crates (≈4) → ? pyramid (≈15) → TNT stack + 1UP (≈7) ≈ 31
```
The F2 perfect order (p099L) is: normal → bonus → normal → death route (afterwards return to its start platform) → normal.

## Section-by-section map

### S1 — Start → elevator → C1 (into-screen)  (mapped 14; F2 p067R)
```
            (behind rocks, left)
            [W][W]                       steel posts (2–4 blocks tall), one crate on each
            [W][A]  <- L-shaped           [W]   [W]      [W]
START ─ (o) ─────────────── ~pit~ ─ e:penguin×3 ─  [W]  e:seal  [W]   [W]  e:seal  ─ ~pit~(o) ─ e:penguin(spin) [W] ─ slope e:seal×3 ─ ELEVATOR
      stump drops                     slide          [W]      [W]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S1-a | on the left bank past the first falling-stump pit, behind rocks | wood ×4, Aku ×1 | L-shaped pair of columns (left 3 high, right 2 high, Aku in the right column) | jump across the stump island, then spin/jump | DETOUR HIDDEN STACK AKU TEACH | Gives the mask before the first enemy gauntlet. It is tucked out of the line of travel, so a careless run starts with no Aku | F2 p067R green bubble; D2 p059 shot 1 ("hit the boxes, gaining an Aku Aku mask") | medium |
| S1-b | the pillar field (POINT3) | 8 single crates (F2 icons wood; screenshots show some ?) | one crate on top of each of 8 steel posts of different heights | jump post to post; seals slide between the posts | HIGH STEPPING ENEMY-LINK TEST | The crates are the reason to climb the posts. F2 advises killing the seals on the floor first, because a slip off a post drops you among them. The field rewards clearing threats before collecting | F2 p067R POINT3 + zoom; D2 shot 3 ("eight pillars"); gamepressure "8 in total" | high (count) |
| S1-c | far side of the second pit, next to a spinning penguin (POINT4) | wood? ×1 | single (D2 shows a tall thin crate) | jump from a post to the penguin, then smash | ENEMY-LINK EDGE-BAIT SINGLE | You must wait for the penguin to stop spinning. The crate sits where you land, so greed while it still spins costs a life | F2 p067R POINT4 screenshot (not on line art); D2 shot 4 | medium-low |

Rhythm: one hidden reward (mask), one vertical collection puzzle (posts and seals), and one enemy-timing crate. The seal slope and the elevator carry no crates; they are pure movement. The penguin trio on the downhill (POINT2) can be spun so the first knocks out the rest.

### S2 — C1 → C2 (side-scroll)  (mapped 16 incl. C1 and the C2 column; F2 p068L–p068R strips A–B)
```
 C1 ─ smasher pair ─ icicles ─ ═falling bridge═ ─ smasher pair ─ icicles ─ ═long bridge═ ─┐
                                                                                [?]       │
                                                                             [S]     ┌──[BONUS ? panel]
                                                                          [S]        │
                                                                       [S]           │
                                                                    [S]  <- floating stair
  ... floor: [?][T] under icicle ─ step ─ [W] e:porcupine ─ [!] ─ (ledge) [W/A/S/S column] ─ ⇑steel steps (made by !) ─ penguins ─ (skull outline) ─ [W][W][C2]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S2-a | top of the elevator | checkpoint ×1 | single | walk | CHECKPOINT ON-PATH | Safe restart before the long side-scroll hazard run | F2 p068L; D2 shot 7 | high |
| S2-b | after the long bridge, rising to the bonus platform | striped ×4, ? ×1 at the top | floating diagonal stair | bounce up crate to crate | FLOAT-LINE STEPPING TOOL BONUS ROUTE-SPLIT | The only way up to the bonus platform. Each stomp pays fruit, and breaking a step from the side loses it as footing, so the stair teaches "stomp, don't spin" | F2 p068R strip A; D2 shot 10 ("stairway of multiple boxes") | medium (types) |
| S2-c | floor below hanging icicles (POINT7) | ? ×1, TNT ×1 | pair, side by side | approach, then retreat | EXPLOSIVE-MIX TIMED PAIR | The icicle falls on the TNT and lights it by itself. If you stand next to it collecting the ?, you die. Back off, let it blow (it takes the ? with it, still counted), then continue | F2 p068R + POINT7 screenshot; D2 shot 16 | high |
| S2-d | raised ledge before the porcupine (POINT8) | wood ×1 (+ ! switch, uncounted) | single crate, porcupine behind it, ! further back | break the box; slide the porcupine | ENEMY-LINK SWITCH SINGLE | Breaking the box frees Nick. Hug the left wall, then slide-kick him into the back so his body triggers the ! block. **The enemy is the projectile that presses the switch**, and the ! materialises the steel steps ahead | F2 p068R POINT8; D2 shot 17 | medium-high |
| S2-e | under an overhang right after the ! | wood (top), Aku, striped, striped (bottom) | 4-high column on the ledge edge | spin the base or bounce the top | STACK AKU SUPPORT-ORDER | The second mask arrives just before the penguin-and-slide section. Spinning the base collapses the column (striped give nothing from the side). Stomping from the top gets the striped fruit first | D2 shot 18 (4 crates); F2 bubble draws only ?/Aku | medium |
| S2-f | beside the red skull-platform outline | wood ×2 over checkpoint ×1 | 3-high column | spin/stomp | STACK CHECKPOINT ROUTE-SPLIT | The death-route gate is placed next to a checkpoint, so the no-death condition is judged at the moment you can most easily save. The C sits at the bottom of a stack, so you must break the stack to save | D2 shots 20, 46; F2 p068R bubble | high |

Rhythm: S2 alternates pure hazard timing (smashers, icicles, bridges: zero crates) with compact crate rooms. Each room introduces one interaction: a stair you stomp, a TNT the environment lights, an enemy you launch into a switch, then a mask column.

### S3 — C2 → C3 (side-scroll, descending)  (mapped 16 incl. C3; F2 p068R strip B → p069L strip 1 → p069R strip 1)
```
 C2 ─ zig-zag ice slides ↓ ─ [W×≈4 column] ─ e:penguin ─ (round the bend) [T] [?][W..pile 6] ─ e:penguin [T] e:penguin [?/?] ─ smashers×3 ─ e:porcupine [?] [⇑steel] → ledge e:penguin ─ [C3][M]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | landing at the bottom of the slides | wood ×≈4 (count inferred) | tall single column on a ledge | one body slam from above | STACK ON-PATH TEACH | The slide drops you onto the column. D2 points out that one body slam clears the whole pile, which teaches slam-from-above on stacked crates | F2 p068R (one tall slab); D2 shot 21 | low (count) |
| S3-b | hidden round a bend after a penguin | wood ×2 (bottom), striped ×2 + ? (middle), ? (top); TNT on the left | stepped pile of 6 + adjacent TNT | break what you need, then light the TNT and back away | HIDDEN PYRAMID EXPLOSIVE-MIX SUPPORT-ORDER | Stomping the striped crates first earns their fruit. The TNT then clears the rest (still counted). Lighting it first wastes the striped fruit | F2 p068R green bubble; D2 shot 22 | medium |
| S3-c | between two penguins on a ledge | TNT ×1 on the floor; ? ×2 stacked on the next ledge | single + 2-stack | stomp TNT, step away | EXPLOSIVE-MIX ENEMY-LINK STACK | D2: kill the first penguin, then light the TNT so its blast kills the second. The level offers the explosive as a weapon before it asks you to avoid explosives later | F2 p068R strip B; D2 shot 23 | high |
| S3-d | after three smasher pillars and a porcupine | ? ×1 (+ steel arrow, uncounted) | single next to a steel arrow block | spin; bounce on the arrow to the penguin ledge | SINGLE ON-PATH TOOL | The crate rewards surviving the smasher corridor. The arrow next to it is the exit upward | F2 p069L strip 1 + POINT10/11; D2 shot 26 (D2 says "crates", so there may be a second) | medium |
| S3-e | start of the hidden-switch room | checkpoint ×1 | single, next to a steel block | walk | CHECKPOINT | Saves before the switch hunt | F2 p069R; D2 shot 27 | high |

### S4 — C3 → C4 (side-scroll)  (mapped 15 incl. C4; F2 p069R strip 1 → p069L strip 2 → p069R strip 2)
```
 C3 [M] ─ e:porcupine e:penguin ─ ICE PILLAR (!!) ─ ICE PILLAR (!!) ─ [o o o → W W W]
   ledge1 [N] e:penguin ─ ledge2 [N] e:penguin [?] ─ ledge3 [W] [?/?] (overhang) ─ ledge4 hollow: [N]|[L] ─ smashers×5 (plate mid-air) ─ [W] [? W] ─ drop to 3D
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S4-a | floor after the two ice pillars | outline ×≈3 → wood when all **four** hidden ! blocks are hit | low row (F2 draws one long slab) | hit the 4 ! blocks behind the pillars (2 per pillar) | OUTLINE SWITCH HIDDEN COUNT-TRAP | The camera angle hides the ! blocks behind the ice pillars. Aku's tip: for a perfect you must find all four. A route runner sees only empty frames | F2 p069R POINT12 + Aku tip; D2 shot 28 | low (count), high (mechanic) |
| S4-b | landing ledge 1 | Nitro ×1 (penguin beside it) | single at the landing spot | short jump | EDGE-BAIT ENEMY-LINK TEST | POINT13: the Nitro sits right next to the landing point. Overjumping kills. It teaches controlled short jumps | F2 p069L POINT13; D2 shot 29 | high |
| S4-c | ledge 2 | Nitro ×1, ? ×1, penguin between | Nitro – penguin – ? on one ledge | stomp the penguin, then hit the ? | EXPLOSIVE-MIX ENEMY-LINK | Spinning the penguin can fling it or you into the Nitro (D2: "don't spin, jump on its head") | F2 p069L; D2 shot 30 | high |
| S4-d | ledge 3 under an overhang | wood ×1, ? ×2 | single + 2-stack | spin/stomp; jump into the opening behind for a fruit grid | STACK DETOUR | A safe breather room between two Nitro ledges, paying fruit | F2 p069L; D2 shot 31 | high |
| S4-e | ledge 4: wall hollow | Nitro ×1 in front, 1UP ×1 behind | Nitro shields a life in a recess | step into the hollow and **jump** to break it; never spin | HIDDEN LIFE EXPLOSIVE-MIX REWARD | POINT14 is a precision test. Any spin chains into the Nitro. D2 adds that the green-! blast will not destroy the life box, so it must be taken by hand | F2 p069L POINT14 bubble; D2 shot 32 | high |
| S4-f | after the 5-smasher dash (POINT15) | wood ×2, ? ×1 | W single, then ? with W stacked behind and above (step) | walk/spin | ROW ON-PATH REWARD | A payout right after the "run through in one go" dash. The Crash plate in mid-air (big jump) is a life item, not a box | F2 p069R strip 2 + POINT15; D2 shot 33 | high |
| S4-g | landing back in 3D | checkpoint ×1 | single on the slope | walk | CHECKPOINT | Saves before the Nitro path | F2 p070L; D2 shot 34 | high |

### S5 — C4 → C5 (into-screen climb)  (mapped 11 incl. C5; F2 p070L, p070R bottom)
```
 C4 ─ e:penguin pit ─ narrow ledges [N][N] . [N] ─ e:porcupine ─ e:penguin ─ [T ?/T T] ─ [?] ─ e:porcupine (pit) ─ disc rock ─ [S floating / S ground] ─ (o)stump ─ island: [C5][G!]
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S5-a | narrow footholds after the first pit (POINT16) | Nitro ×3 | 2 adjacent + 1 further on, all on the path | consecutive jumps | ON-PATH EDGE-BAIT TEST NITRO-SWITCH | The "Nitro alley" on a narrow ledge: hop them in sequence. For the box count they wait for the green ! at C5 | F2 p070L POINT16; D2 shot 35 | high |
| S5-b | behind a penguin (POINT17) | TNT ×3, ? ×1 | 2×2 block: top row TNT + ?, bottom row TNT + TNT | stomp the ? (top right), then light a TNT and back off | EXPLOSIVE-MIX ENEMY-LINK CHAIN SUPPORT-ORDER | F2: kill this penguin with a stomp, because a spin can knock you into the TNT behind. D2: jump on the top-right box first, then a TNT, and give it room | F2 p070L POINT17 + screenshot; D2 shot 37 | high |
| S5-c | just beyond the pile | ? ×1 | single | walk | SINGLE ON-PATH | Tail crate after the explosion | F2 p070L | high |
| S5-d | after two porcupines and a rolling disc rock | striped ×2 (ground + floating above) | SANDWICH | bounce between them, then break the lower | SANDWICH REWARD TOOL | D2: spring up into the floating "multiple box", then break the lower one, for fruit while you wait for the rock to pass | D2 shot 39; F2 p070R draws a grey pair with a red ↕ arrow (unclear) | low-medium |
| S5-e | island between two rolling disc rocks | checkpoint ×1 (+ green ! beside it, uncounted) | single | timed jump to the island | CHECKPOINT NITRO-SWITCH TIMED | The Nitro switch sits by the last checkpoint. Every Nitro in the stage, including the death route's, can be collected late with one hit | F2 p070R POINT19; D2 shots 40–41 | high |

### S6 — C5 → goal  (mapped 4; F2 p070R)
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S6-a | after a disc rock and a penguin | ? (bottom) + wood? (top) | 2-stack (F2 tall slab with ? at the base) | spin | STACK ON-PATH | Pacing crate on the final climb | F2 p070R; D2 shot 43 | medium-low |
| S6-b | against the second steel stair | wood (bottom), steel block wedged, ? (top) | column interleaved with a steel step | climb the steel, break as you go | STACK TOOL | D2: "make your way up busting boxes". The steel stays as footing while the crates break | F2 p070R zoom; D2 shot 44 | medium-low |
| — | twin crossing disc rocks (POINT21), stumps, goal | — | — | jump just before the rocks cross | TIMED | No crates: the finale is a pure timing test | F2 p070R | high |

### BONUS — "plunging level to level" (≈31; F2 p068R door, p099L cautions + screenshot; D2 shots 11–15)
```
 entry platform:  [W][W][W][W][T]   (stand on 2nd and 4th, then stomp T → springboard)
                         ↓ bounce off the lit TNT
 next ledge:   [S]  (top striped launches you off the top of the screen → hidden crates)
               [S]
 floor:   [?][?][?] stepped ? pyramid with TNT inside
          [?][?][?][?]
 exit:    [T][T][T/T][L]  → hit first, second, then top TNT: the blast clears the pile; 1UP and exit
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| B-a | entry platform | ≈4 wood/? + TNT | row | stomp boxes 2 and 4, then the TNT; ride its bounce | BONUS ROW EXPLOSIVE-MIX TOOL | The TNT is a springboard you light and bounce off before it blows | D2 shots 12–13 (counter 1 → 5) | medium |
| B-b | second ledge | striped ×2 + hidden crates above the screen (≈2) | striped column; crates off-screen high | long-jump onto the striped, high-jump from it | BONUS HIGH HIDDEN TOOL COUNT-TRAP | p099L caution 1: crates sit above the visible frame. You only find them by trusting the striped launch | F2 p099L; D2 shot 14 (counter 7) | low (count) |
| B-c | floor | ? ×≈15 incl. TNT | stepped pyramid | stomp downwards | BONUS PYRAMID EXPLOSIVE-MIX | p099L caution 2: stomp the other boxes first for fruit, then the TNT | F2 p099L screenshot; D2 shots 14–15 (counter → 23/24) | low (count) |
| B-d | exit | TNT ×4 (two singles + TNT on TNT) + 1UP | row with a 2-stack | stomp in order first → second → top | BONUS CHAIN LIFE SUPPORT-ORDER | A deliberate chain demolition. The order controls the blast so the life box survives to be taken | D2 shot 15 | medium |

### DEATH ROUTE — skull platform (≈21 inferred, 18 seen; D2 shots 46–60; F2 p068R door, p099L)
Gate: the red skull outline next to C2 becomes a ridable platform only if you arrive without losing a life (D2 46; p099L). The route is green-lit slippery ice with smashers, and is one of the hardest areas in the game.
```
 elevator ↑ ─ [N] skate ─ crushers ─ (o) outline 1UP floating ─ behind outcrop: [L] over [W][W] in a fruit ring ─ porcupines×2
   ─ [↑wood arrow] + floating [A?] (catapult toward smashers) ─ smashers×2 ─ steel pile + (o o o) frames, icicles, seal
   ─ [N] ─ smasher, [N] low + [N] high ─ smashers ─ Nitro field [N][N][N] … [N] (+1 floating) ─ [!] at the end ─ drop: CLEAR GEM 2
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| D-a | first ice run | Nitro ×1 | single on the ice | jump while sliding | ROUTE-SPLIT ON-PATH TEST | Sets the route's theme: Nitros on ice, where your speed is hard to control | D2 shot 48 | high |
| D-b | early platform | outline ×1 → 1UP | floating beside a platform | spin the route-end ! box, then return | ROUTE-SPLIT OUTLINE SWITCH LIFE BACKTRACK COUNT-TRAP | p099L/D2 50, 60: the outline fills only from the ! at the very end, so an all-box run must do the route a second time and walk back to the start | D2 shots 50 + 60 (same spot, now a 1UP) | high |
| D-c | behind the outcrop | 1UP ×1 floating above wood ×2 | float-line inside a ring of fruit | jump around the outcrop | ROUTE-SPLIT HIDDEN LIFE DETOUR | Compensation for the brutal route. D2: "be sure not to miss any" | D2 shots 50–51 | high |
| D-d | before two smashers | wooden arrow ×1 + crate floating high above (Aku per D2) | SANDWICH (arrow under a floating crate) | land from the right, or body-slam to stop; then break | ROUTE-SPLIT SANDWICH TOOL TIMED AKU | Jumping on from the left catapults you into the smashers. The safe solution is a body slam onto the arrow | D2 shot 53 | medium |
| D-e | steel pile under icicles | outline frames ×3–4 (crates or blocks?) | stacked against a steel stair | ! at the route end | ROUTE-SPLIT OUTLINE | Unclear whether these count; gamepressure says two disabled crates in the route | D2 shot 55 | low |
| D-f | after the steel pile | Nitro ×1 | single | jump; don't go too fast on the ice | ROUTE-SPLIT TEST | Speed-control test | D2 shot 56 | high |
| D-g | under a smasher | Nitro ×2 (one low, one high) | staggered pair | slide under the smasher, jump to land between them | ROUTE-SPLIT TIMED TEST | You must land past the first and under the second, a vertical "Nitro gate" | D2 shot 57 | high |
| D-h | final field | Nitro ×≈5 (4 low, 1 floating) | scattered field on ice | jump-slide-jump past three, jump the last; or use the Aku to trigger them | ROUTE-SPLIT TEST AKU | D2's two solutions: bring an Aku and set off one Nitro to clear the field, or thread it by jump-slide-jump | D2 shot 58 | medium |

## Enemies and hazards
| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | falling stump platforms | in pits near the start and before POINT4 | the Aku group is reached by crossing one |
| S1 | penguins ×3 (sliders) | downhill after the Aku group | no crates; spin the first to bowl the rest |
| S1 | seals ×3–4 | wander between the steel posts | guard the 8 post crates. Clear them first |
| S1 | spinning penguin | far bank of the second pit | the S1-c crate sits by its landing spot |
| S2 | smasher pairs, icicles, collapsing bridges | before the striped stair | crate-free timing corridor |
| S2 | icicle over TNT | floor before the porcupine | the environment lights S2-c |
| S2 | porcupine | released by breaking S2-d | slide him into the ! switch |
| S3 | penguins | around the bend pile and the TNT ledge | S3-c TNT used as a weapon |
| S3/S4 | wooden smashers on ice (POINT10, POINT15) | corridors | crates come right after each corridor (S3-d, S4-f) |
| S4 | penguins on Nitro ledges | ledges 1–2 | stomp, never spin, beside Nitros |
| S5–S6 | porcupines (POINT18/20), rolling disc rocks (POINT19/21) | climb to the goal | cross when Nick faces away. Crates sit between rock lanes |
| D | smashers, crushers, icicles, seal, porcupines ×2 | throughout | Nitros placed under/after smashers; the arrow catapults into smashers |

## Puzzle rooms and dependency chains
1. **Porcupine → ! → steel steps (S2-d).** Setup: a crate blocks Nick; the ! is behind him. Sequence: break the box, hug the left wall, slide-kick Nick into the back so he hits the !. Wrong: spinning him early or getting quilled. Loss: the steel steps (D2 19) that lead up toward the skull platform and C2. Design: enemies are tools, and the switch rewards using the enemy, not just avoiding it.
2. **Four hidden ! behind two ice pillars → outline row (S4-a).** Setup: two big ice pillars; two steel ! blocks hide behind each. Correct: walk behind both pillars and hit all four. Wrong: run past, since the frames ahead stay empty and the route still clears. Loss: all-box only (≈3 boxes). Design: the camera itself is the puzzle. Aku's on-screen tip exists because the count trap is otherwise unfair.
3. **Nitro-shielded 1UP (S4-e).** Correct: step into the hollow and jump-break the life box. Wrong: spin (chains the Nitro). The green ! will not destroy the life box. Design: a precision reward in a constrained space.
4. **TNT/? 2×2 pile with penguin (S5-b).** Correct: stomp the penguin, stomp the top-right ?, then light a TNT and retreat. Wrong: spin the penguin into the pile, or light the TNT while standing on top. Loss: life; the ? still counts if blasted.
5. **Death-route two-pass (D-b).** Setup: the outline 1UP near the route start fills only from the ! at the route end, and dropping to the gem exits the route. Correct for the box gem: reach the end, spin the ! (stopping yourself on the ice), walk back to the start, break the 1UP, return by the elevator to C2 and finish the level. For gem 2 you jump down at the end (p099L: choose one per run, or die to return to C2 and redo the route). Design: the hardest route in the game is made doubly demanding for the completionist.
6. **Bonus chain demolition (B-a…B-d).** The TNT is first a springboard, later a demolition charge. Order (stomp normal boxes first, TNT last; trigger the exit TNTs first → second → top) decides fruit and the life.

## Design logic of this level
1. **Most boxes in Crash 2, spread over four distinct grammars:** a 3D collection field (posts), long side-scroll strips with small "rooms", a bonus demolition and a Nitro gauntlet. Crate density spikes in rooms and drops to zero in timing corridors (smashers, icicles, bridges, disc rocks), which keeps the challenges separate.
2. **Crates as the reason to take risks.** The 8 post crates exist only to make you climb unstable footing among seals. Without them the field is skippable.
3. **Explosives move from environmental to tool to obstacle.** First the icicle lights a TNT for you (S2-c). Then you use TNT as a weapon (S3-c) and a springboard (bonus). Later TNT and Nitro are obstacles beside enemies (S4, S5) and on ice (death route).
4. **Enemy and switch coupling.** The porcupine-into-! room and the four camera-hidden ! blocks both make switches a perception puzzle rather than a reflex.
5. **Masks come right before gauntlets.** Aku 1 comes before the first enemy fields; Aku 2 comes just before the slide/penguin/smasher descent. The death route recommends bringing a mask (D2 47, 58), and its arrow sandwich may hold one more.
6. **Checkpoints sit at the start of each camera mode** (elevator top, return to 3D, last island). C2 deliberately sits at the death-route gate, where the no-death condition is checked.
7. **All-box goal vs clear goal diverge sharply.** Clearing needs none of: the hidden !s, the Nitro-shielded life, the bonus, the death route or the outline 1UP. The perfect needs all of them, two passes of the death route, a walk-back, and the green ! at C5 last of all.
8. **Count traps cluster where the camera can't see:** pillars hiding switches, crates above the bonus frame, the outcrop room, and the outline that only the route-end switch fills.
9. **Ice is the difficulty multiplier.** The same Nitro spacing that is trivial on rock becomes lethal when you can't stop. The guide's advice is to jump "at as low speed as possible" (p099L).
10. **Body slam as a stack tool and a brake:** one slam clears the slide-bottom column (S3-a), and a slam is the way to stop on the death route's arrow crate (D-d).

## Transfer to the skate game
1. **Post-top crate field (S1-b) → skate "pillar pick" room:** 8 posts of 2–4 crate heights (2.3–4.6 m) with one crate each, and patrolling enemies on the floor. At our numbers the 2–3 high posts are reachable by full jump or double jump. Make the 4-high ones need a wooden arrow at the field edge (≈6 m with hold). On the board the posts are too narrow to ride, so this is an on-foot pocket.
2. **Environment-lit TNT (S2-c):** hang a falling hazard over a TNT + ? pair. The player must stop short (our TNT fuse is 3 s). For skaters, put the pair on the main line so cruising at 12 m/s past it when the icicle drops is the tempting mistake.
3. **Enemy-as-switch-press:** a crate releases an enemy that can be kicked (slide) into a ! a few metres behind. With our slide this is a natural on-foot puzzle. The ! can then materialise grindable steel steps.
4. **Camera-hidden switches → outline grind rail:** hide four ! blocks behind two pillars, and make the outline row 4–6 crates long and equal height. Once solid it becomes a crate rail (≥ 2 touching crates). Grinding it collects them all, which rewards finding the switches with a satisfying grind payout.
5. **Nitro on ice → Nitro on a downhill skate line:** space Nitros 2–3 crate widths apart on a 20–30 m/s downhill. The tap ollie (0.56 m) can't clear them, so the player must charge ollies early. Add a mask crate on an arrow before the field, as in the death route, so riding into a Nitro with the mask clears the field.
6. **Two-pass route-end switch:** an optional hard branch whose last ! solidifies a 1UP at the branch start. On the board, make the return trip a different line (reverse grind along the branch rail), so the backtrack is fun rather than dead time.
7. **TNT springboard (bonus):** a lit TNT is a 3 s window to stomp-bounce (14 m/s) onto a higher ledge. Pair it with a crate pyramid below that the TNT clears if the player is late.

## Open questions / uncertainties
- **Main-route shortfall of ~27 boxes** (76 mapped vs 103 implied). Candidates: taller columns than F2 draws (slide-bottom column, Aku column, ? stacks near the goal), a longer outline row, and extra crates around D2 26 ("crates"). This needs a longplay or the N. Sane in-game counter per checkpoint.
- Bonus split is estimated from four blurred HUD counters. Only the ≈31 total is corroborated (N. Sane).
- Death route: whether the D2 shot 55 frames are outline crates or outline steel blocks. Also the Aku claim (D2 53) against the header's Aku sub 0. Gamepressure's "two disabled crates in the middle of the route" against D2's "solitary crate back at the start".
- F2 draws the D2-39 striped sandwich as a grey pair with a red ↕ arrow. It may be a moving steel block rather than crates.
- Pillar crate types (F2 wood icons; screenshots suggest some ? crates).
