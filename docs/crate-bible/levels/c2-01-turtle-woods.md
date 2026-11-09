# Crash 2 — Stage 1 Turtle Woods  (ステージ1「あめのジャングル」 — "rainy jungle")

Sources: F2 p021L (header, book p.34), p021R (p.35), p022L (p.36), p022R (p.37), p092L (perfect page,
p.176); D2 p006L shots 1–6, p006R shots 7–13, p007L shots 14–20, p007R shots 21–27, p008L shots 28–35,
p008R shot 42 (blue-gem page); web corroboration: ludo.guide "Level 1 Turtle Woods" (62 boxes, step
list), gamepressure.com N. Sane Turtle Woods page (62 crates, bonus "five wooden crates").

Evidence level: the main course was read crate by crate from the F2 isometric map and confirmed shot by
shot in D2. The bonus count is read from the D2 in-bonus HUD (0 → 3 → 5). The secret course has no F2
map (only the p092L notes and one screenshot), so it is reconstructed from D2 shots 12–22 plus the ludo
step list; its total (27) is derived from the header and is exact, but the split of 6 boxes between two
groups (X-h, X-k) and several box types in it are inferred. The crate wall (S2-c) is the one main-course
count that is derived rather than seen in full (10 = 30 − the other 20; D2 shows 2 rows and 5 top faces).

Extra composition key used in the JSON: `unknown` = a box that is certainly there but whose type icon
could not be read (most likely plain wood).

## At a glance

| Field | Value |
|---|---|
| Theme | Rainy jungle path between stone totems; mud swamps, rat pits; secret course is a side-on cliff with waterfalls |
| Camera | Main: into-screen (F2 「おくスクロール」). Secret course and bonus: side-scroll |
| Total boxes | **62** (F2 p021L 「はこのかず ぜんぶで 62コ」, superscript **32**) |
| Boxes per route | **main 30 / secret 27 / bonus 5**. Conclusion on the superscript: 32 = secret + bonus. Basis: p092L route order "normal → secret → bonus → normal", bonus HUD 0→3→5 (D2 shots 27–30), main tally = 30 exactly |
| Checkpoints | 3 (header C×3, subscript 1): 2 main (S1-f, S2-b) + 1 in the secret course (X-b) |
| 1UP boxes | 0 (header ×0). Lives come from ? boxes: bonus B-b (D2 lives 8→9), secret X-e and X-i, main S3-b |
| Aku Aku | 2, both main (S1-f plaza, S3-a); subscript 0 |
| TNT / Nitro | 0 TNT. 3 Nitro, all in the secret course (X-f), detonated by the green ! at its end |
| ! / outline / iron-bound | green ! ×1 (secret end, steel, not counted); no outline, no iron-bound |
| Arrows | 1 wooden ↑ (secret, X-g); no steel arrows |
| Striped | 4 in the main course (S1-b ×2, S1-d top, S2-c wall top row) |
| Gems | Clear gem: all 62, in the order normal → secret → bonus → normal (p092L). Blue gem: reach the goal without breaking ANY box, C and Aku boxes included → no checkpoints, a one-life run; skip the bonus; the secret course is not needed. The crux is the 10-box wall S2-c |
| Enemies | armadillo アル (main), spiked turtle トゲ・デ・カメンデス (main + secret), rats/moles アナチュール in pits (main), pink ostrich ピンクー and vulture パープー (secret only, F2 p021L) |
| Hazards | Pits (dash-jump practice), mud swamps (slow, no spin, not lethal), rat pits (exit by killing the moles → mushroom trampoline), secret: bottomless gaps, 3 Nitros |
| Difficulty | F2 「かーんたん!!」 (very easy); D2: "introduces basic Crash mechanics" |

## Route skeleton

```
START
  | S1  into-screen ............................ 10   ?  S/S  ?  W/W/S-stack  ?  [A][C]
  +--[stone face on the ground: body slam]--> SECRET (side-scroll) .... 27  (C x1, Nitro x3, wood arrow,
  |                                            2 ostriches, 2 vultures, green ! + lift at the end)
  |   <-- lift returns to the plaza just before the Aku box ------------'
  C1
  | S2 ......................................... 14   ?-mud-stepping x3   C2   wall 2x5
  +--[green ? pad after the 2 turtles]--> BONUS (side-scroll) .... 5 ---> returns in front of the 3 mud boxes
  C2
  | S3 ......................................... 6    [A]  ?-over-turtle  ?x3  ?-in-mud
GOAL                                   main 30 + secret 27 + bonus 5 = 62 = header
```

## Section-by-section map

### S1 — Start → C1  (10 boxes; route runs up the page = into the screen)

```
        [A]      [C]      (?)        S1-e/S1-f  plaza between two stone totems (secret exit lands here)
                   ^
        <stone face slab>            body-slam it -> SECRET
                   ^  e:armadillo
     ===== plank bridge over a pit =====
    [S]                              S1-d  3-stack, bottom->top W W S
    [W]
    [W]
                   ^  pit (D2: "try your dash-jump")   e:armadillo (runs in/out of screen)
   ~pit~  (?)                        S1-c  ? beside the first pit
                   ^
      ~~~~ mud ~~~~                  wade or jump, not lethal
    [S]  floating                    S1-b  striped "sandwich"
    [S]  on the ground
     ---- low stone wall ----
                   ^  e:armadillo (first enemy, F2 POINT1)
          (?)                        S1-a
         START
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| S1-a | right after spawn, left-centre of the path | ?×1 | single | walk/jump | ON-PATH SINGLE TEACH | the very first input of the game is "hit the box"; D2: "hop on the surprise box located conveniently at the start" | F2 p021R; D2 p006L shot 1 | high |
| S1-b | over the low stone wall, beside the first mud patch | striped×2 (one on the ground, one floating directly above) | SANDWICH | jump repeatedly between them | ON-PATH SANDWICH TOOL TEACH REWARD | standing between them and jumping bonks the upper and lands on the lower: 20 fruit (F2 POINT2 「ボヨン、ボヨン」). Teaches the striped crate's per-hit payout before any hazard is near | F2 p021R POINT2 + screenshot (fruit 23); D2 p006L shot 3 ("another two bouncy boxes") | high |
| S1-c | after the mud, where a pit opens beside the path | ?×1 | single at a pit edge | walk/spin | ON-PATH EDGE-BAIT SINGLE LIFE | four fruit lead the eye "up and around to a pit on the left ... and a surprise box" (D2): the first box that sits next to a fall; ? may hold a life | F2 p021R (drawn on the right edge); D2 p006L shot 5 | medium (side differs between sources) |
| S1-d | just before the plank bridge, after a pit | wood×2 + striped×1 | STACK, bottom→top W W S | spin only the middle box, or dash-jump onto the top | STACK SUPPORT-ORDER TOOL TEACH REWARD | breaking the middle box drops the striped onto the bottom box, turning it into a raised bouncer (D2 shot 9); breaking the striped from the side wastes its 10 fruit | F2 p021R POINT3 + inset drawing; D2 p006R shot 9; ludo step 6 | high |
| S1-e | plaza after the stone face (right) | ?×1 | single | walk/spin | ON-PATH SINGLE LIFE | reward right beside the secret entrance; D2: "did you get a free life?" | F2 p021R top; D2 p006R shot 10 | high |
| S1-f | plaza, left and back (against a stone arch) | Aku×1 + C×1 | PAIR (separate singles) | walk/spin | ON-PATH AKU CHECKPOINT | mask + save right where the secret course returns; F2 POINT4 「アクアクじゃ」: always take masks. D2 shot 24 asks "did you bust all the boxes in the secret area?" at this C | F2 p021R top; D2 p007R shots 23–24 | high |

Rhythm: one new idea per screen, each on safe ground first — box, enemy (armadillo), striped sandwich,
mud, pit + edge box, a support-order stack, then the odd stone face that hides the secret course. Six
clusters, ten boxes; nothing here can kill you except the pits.

### SECRET — stone face → lift back to the S1 plaza  (27 boxes; side-scroll, waterfalls; C×1)

Reached by body-slamming the grimacing stone lid on the ground (F2 p021R 「ひみつコースへ」; p092L; D2
shot 11). Order from D2 shots 12–22 and the ludo step list.

```
 left -> right (side view)
 [W] [W] [W]   e:turtle  e:turtle   [W] [C]    e:vulture ---long platform---   [x]   [x x]
     [W]                            [W]                                         X-c   X-d
  X-a (4)                           X-b (3)

     (?)                     ledge [x x x..]          ledge (?)
     (?)  small platform  [↑]   e:ostrich1  e:ostrich2   X-i          e:vulture   [G!][x]  lift ^
  ___N N N___  X-f      X-g     X-h (via ostrich 1)   [x x x] X-j (ground between ostriches)
  X-e over the Nitros                       lower platform [x ..] X-k               X-l
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| X-a | first platform after the drop-in | wood×4 | single, 2-stack, single | spin/jump | ON-PATH ROW TEACH | instant payoff for finding the secret; D2: "clear out the four boxes here" | D2 p006R shot 12; ludo secret step 1 | high (count), medium (types) |
| X-b | platform after two spiked turtles | wood×2 (2-stack) + C×1 | PAIR side by side | spin | ON-PATH CHECKPOINT | "your very first checkpoint in CB2"; placed before the vulture and the Nitro/ostrich gauntlet so the hard half restarts here | D2 p007L shots 14–15; ludo step 3 ("two more boxes and a checkpoint") | high |
| X-c | next platform after the vulture's long platform | 1 box | single | spin | ON-PATH SINGLE | pacing box between jumps | ludo step 5 | medium (type unseen) |
| X-d | the following platform | 2 boxes | PAIR | spin | ON-PATH PAIR | pacing; sets up the slide-jump to the Nitro platform | ludo step 6 | medium (types unseen) |
| X-e | small floating platform above the Nitro floor | ?×2 (one above the other; the upper one is head-bonked from below) | STACK | jump/head-bonk | EDGE-BAIT LIFE REWARD HIGH | D2: "two surprise boxes ... holding a bonus life or two to make up for the Nitro boxes killing you" — lives placed exactly where the player is likely to die | D2 p007L shots 17–18; ludo step 6 ("boxes above the Nitro crates") | high |
| X-f | the ground beneath X-e | Nitro×3 | ROW on the floor of the gap | avoid; detonate with the green ! (X-l) | LOW EXPLOSIVE-MIX NITRO-SWITCH | the first Nitros in the game are a floor you must not fall onto; they only count once the green ! at the end fires | D2 p007L shot 18; D2 p007R shot 22 | high |
| X-g | platform to the right of X-e | wooden ↑×1 | single | arrow bounce, then spin it | TOOL COUNT-TRAP TEACH | the springboard to the next ledge; bouncing on it does not break it, so it is easy to leave behind — F2 p092L note 1: "also break the ↑ box"; D2: "make sure you break the arrow box" | D2 p007L shots 17, 19; F2 p092L note 1; ludo step 7 | high |
| X-h | high ledge reached from ostrich 1's back | ≥3 boxes seen (L/step on a pillar ledge); 3 assigned | STEPPING/stack on a ledge | enemy-bounce (ostrich ducks when approached: jump at once) | HIGH ENEMY-LINK TIMED COUNT-TRAP | the boxes are only reachable in the moment before the ostrich ducks; miss it and the perfect needs a lost life (D2) or a retry (F2) | F2 p092L shot 2 + note 2; D2 p007L shot 19; ludo step 8 | low (count derived, see X-k) |
| X-i | high ledge reached from ostrich 2's back | ?×1 (holds a life) | single | enemy-bounce | HIGH ENEMY-LINK LIFE REWARD | a life as the payoff for the second ostrich jump | D2 p007L shot 20; ludo step 9 | medium |
| X-j | ground between the two ostriches | 3 boxes | ROW | drop back down | BACKTRACK LOW COUNT-TRAP | D2: "go back and break the three boxes on the ground between the two ostriches" — passed underneath while focusing on the ostrich jumps | D2 p007L shot 20; ludo step 10 | medium (types unseen) |
| X-k | lower platform past the ostriches | 3 boxes assigned (derived) | group | drop down | LOW DETOUR | D2: "go to the lower platform and break the boxes down there". Count = 27 − all other secret clusters (X-h + X-k = 6). If this group is the same as X-j, X-h holds all 6 | D2 p007L shot 20 | low |
| X-l | final platform before the lift | green !×1 (not counted) + 1 box | PAIR | spin both | NITRO-SWITCH SWITCH ON-PATH | the switch is placed after the Nitros, so their credit is earned only by surviving them; stomping it "makes all Nitro crates behind you explode" | D2 p007R shot 22; ludo step 12 | high |

Secret tally: 4 + 3 + 1 + 2 + 2 + 3 + 1 + 3 + 1 + 3 + 3 + 1 = 27 (C counted; green ! is a steel block and is
not counted, F2 legend). This course holds almost as many boxes as the whole main course and contains
every hard-to-get box of the level (arrow, two ostrich ledges, the ground trio).

### BONUS — green ? pad in S2 → exit  (5 boxes; side-scroll, floating jungle platforms)

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| B-a | first platform | wood×3 | L: 2-stack + 1 beside | spin/jump | ON-PATH BONUS | "cross the platform, pick up the fruit, break the three boxes and hop over" (HUD 0 → 3) | D2 p007R shot 27; F2 p092L bonus shot | high |
| B-b | a later platform | ?×1 | single | spin | BONUS LIFE REWARD | "a surprise awaits you. Pray for more lives." — gave a life (lives 8 → 9) | D2 p008L shots 29–30 | high |
| B-c | lower platform before the exit lift | 1 box | single | drop down, spin | BONUS DETOUR | last box below the exit line (HUD 5 at the exit) | D2 p008L shot 30 (HUD 5); ludo bonus step 4 | medium (type unseen) |

F2 p092L calls this bonus easy; gamepressure also counts five crates.

### S2 — C1 → C2  (14 boxes)

```
   [W][S][W][W][W]      S2-c wall 2 rows x 5 (best reading), enclosed court between two totems
   [W][W][W][W][?]
         [C]            S2-b  C2 directly in front of the wall
          ^  e:turtle e:turtle   ("jump over the wall and waste the two turtles": a low stone wall)
          ^  e:armadillo, leaning log
  ~~~~ mud ~~~~ (?)     S2-a  ? half-sunk in the mud (far side)
  ~~~~ mud ~~~~ (?)           ? half-sunk in the mud
          (?)                 ? on the bank      <- the bonus exit drops you here
          ^   [green ? pad] -> BONUS (right side)
          ^  e:turtle e:turtle (F2 POINT6: chain stomps give fruit)
          ^  e:turtle (POINT5: stomp to flip, then spin)
         C1
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| S2-a | mud swamp after the bonus pad | ?×3 (1 on the bank, 2 half-sunk in the mud) | STEPPING line across the mud | jump box to box (each stomp breaks it); body-slam from inside the mud if you fall in | STEPPING TOOL ON-PATH TEACH | you cannot spin in mud, so the boxes are the way across; F2 POINT7 「華麗にジャンプ」. D2: "bounce from one box to another" | F2 p022L POINT7; D2 p008L shot 31; ludo steps 12–13 | high (count), medium (? type from F2 icons) |
| S2-b | enclosed court before the wall | C×1 | single | spin | CHECKPOINT ON-PATH | save placed right before the blue-gem crux; on a blue-gem run you must not break it | D2 p008L shot 33; F2 p022L | high |
| S2-c | wall closing the court | 10 boxes: top row W S W W W, bottom row W W W W ? (best reading) | WALL 2 high × 5 wide | break it, or jump over it | WALL BLUE-GEM TOOL ON-PATH | all-box: break all 10. Blue gem: break none — big (dash) jump over, or step once on the top-row striped (F2 p092L: 「一番上の段」 striped as a foothold; the big jump is "relatively safer") | F2 p022L POINT8 + inset (W S W ? faces); F2 p092L blue-gem note; D2 p008L shot 33, p008R shot 42 (5 top faces, second row visible) | medium (count derived = 30 − 20; layout read from two screenshots) |

### S3 — C2 → Goal  (6 boxes)

```
  GOAL
   ^ leaning log    crystal beside the 3rd rat pit (F2 POINT12: must take it)
  ~~ mud ~~ (?)            S3-d  ? in the mud (stepping; body-slam it if you fall in)
   [rat pit x4]
   (?)                     S3-c  3 ? boxes in an L / step
  (?)(?)
        (?)  floating high S3-b  out of reach ...
     e:turtle               ... unless you stomp-flip the turtle and use its belly as a springboard
   [rat pit x2]  (kill both moles -> mushroom trampoline out)
   [A]                     S3-a
  C2
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| S3-a | right after the wall court | Aku×1 | single | spin | AKU ON-PATH | mask before the rat pits ("another tiki mask") | F2 p022R; D2 p008L shot 34 | high |
| S3-b | above a spiked turtle after the first rat pit | ?×1 | single, floating | enemy-bounce (stomp the turtle to flip it, jump on its belly) | HIGH ENEMY-LINK TOOL TEACH LIFE | the only way up is the enemy (F2 POINT10 「届かない…」); spinning the turtle away destroys the tool | F2 p022R POINT10; F2 p092L normal-course note; ludo step 19 | high |
| S3-c | after the turtle | ?×3 | L / step (one on top-left over a pair) | spin/jump | ON-PATH PYRAMID | pacing payout between pits | F2 p022R; ludo step 20 ("break three boxes") | medium (arrangement) |
| S3-d | last mud swamp | ?×1 | single half-sunk in mud | jump onto it; or body-slam it from inside the mud | LOW STEPPING | the S2 lesson repeated without a safety net of three boxes; F2 POINT11 「ボディプレス!」 is the fallback | F2 p022R POINT11 | high |

Main tally: S1 10 + S2 14 + S3 6 = 30 = 62 − 32.

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | armadillo ×3 | after S1-a; after the mud; before the stone face | first spin/jump practice (POINT1); none guard a box directly |
| S1 | low stone wall, mud, two pits | between clusters | S1-b sits just past the wall; S1-c sits at the first pit edge; S1-d stands right before a pit + plank bridge |
| S1 | stone face | on the path before the plaza | the secret entrance itself; the S1-e ? sits right beside it |
| X | spiked turtles ×2 | platforms after X-a | stomp to flip (D2 shot 13 foreshadows using the belly as a trampoline) |
| X | vulture ×2 | end of long platforms (before X-c; before X-l) | timing hazard on the way to boxes, not near them |
| X | Nitro ×3 | floor below X-e | X-e lives sit directly above them |
| X | pink ostrich ×2 | between X-g and X-l | living platforms to the high ledges X-h, X-i; they duck when approached |
| S2 | spiked turtles ×5 (1 + 2 + 2) | before and after the bonus pad | POINT6: chain stomps; turtles guard the court with C2 + wall |
| S2 | mud swamp | S2-a | boxes are the crossing |
| S3 | rat pits ×4 (2 moles each) | before and after S3-b | the mushroom exit is the only way out; no boxes inside pits |
| S3 | spiked turtle | under S3-b | the springboard to the box |

## Puzzle rooms and dependency chains

1. **S1-d support-order stack.** Setup: W/W/S 3-stack on safe ground. Correct: jump, spin on the way down
   beside the middle box → only the middle breaks → the striped drops onto the bottom box → stomp it 10
   times for 10 fruit, then break the base (or dash-jump straight onto the top). Tempting wrong: spin the
   stack at ground level until the striped is low, then spin it too → it breaks from the side for no fruit.
   Loss: fruit only; the box count is unaffected. Why it works: the first stack teaches that support
   matters before any stack is dangerous.
2. **S2-c wall, two goals on one object.** All-box: smash all 10. Blue gem: touch none — dash-jump over
   the two-high wall, or bounce once on the top-row striped (one stomp does not break it). A failed jump
   that breaks a box voids the blue-gem run, which has no checkpoints. Why it works: a closed court
   removes every way around, so the wall is a pure skill gate whose solution depends on the goal.
3. **S3-b enemy as springboard.** Correct: stomp the turtle (flips), jump on its belly, spin at the apex.
   Tempting wrong: spin the turtle first — it is spiked (you get hurt) or, once flipped, a spin sends it off
   screen and the box is unreachable. Loss: one box (and a likely life); all-box requires a death/retry.
4. **X-g arrow count trap.** The arrow bounce is needed to progress, but bouncing does not break it; it
   must be spun as well. Loss: one box; nothing on screen reminds you.
5. **X-h / X-i ostrich ledges (timed).** The ostrich ducks as soon as you come near; dash-jump onto its
   back at once and up to the ledge. Miss → the ledge boxes are gone for this attempt; D2 advises wasting
   a life to restart the secret course from X-b. Then X-j must be collected by dropping back down.
6. **Secret Nitro credit (X-f → X-l).** Nitros count only after the green ! at the very end of the
   secret course; dying before it forfeits that credit for the attempt.
7. **Route order for the clear gem.** Normal → secret → bonus → normal (p092L): the secret course comes
   first because its exit is behind C1 and the bonus pad is after C1.

## Design logic of this level

1. **Teaching order is crate-led.** ? box (hit boxes) → striped sandwich (repeat-bounce payout) → box at a
   pit edge (risk) → support-order stack → hidden entrance → mask + checkpoint → enemy stomp/spin →
   chained stomps → boxes as mud stepping stones → wall → enemy as springboard. Every new crate behaviour
   first appears alone, on solid ground, with no enemy beside it.
2. **Density curve:** main 10 / 14 / 6 per section; the wall alone is a third of the main boxes. The
   secret course (27) nearly equals the main course (30): the all-box goal is mostly an exploration goal.
3. **Crates are traversal tools as often as rewards:** mud stepping boxes (S2-a, S3-d), the stack's top
   striped (S1-d), the secret arrow (X-g), the X-e stack over Nitros.
4. **Lives are risk-priced.** There is no 1UP box; every life is in a ? box at a risky or hidden spot:
   over the Nitro floor (X-e), on an ostrich ledge (X-i), above a turtle (S3-b), in the bonus (B-b).
5. **Enemies are placed as tools beside crates** (turtle under S3-b, ostriches under X-h/X-i), and enemy
   pairs teach chain-stomp fruit (POINT6).
6. **Explosives are quarantined in the optional secret course** (3 Nitro + green ! at its end); the main
   course of the first level has none.
7. **Checkpoint placement:** C1 where the secret course rejoins (D2 asks "did you bust all the boxes back
   in the secret area?" at this box), C2 directly before the wall, the secret C after the first easy third
   of the secret course.
8. **Count traps cluster in the optional route:** arrow (not broken by bouncing), ostrich ledges (timed),
   the ground trio between the ostriches (passed underneath), the lower-platform group (detour).
9. **The blue gem inverts the crate goal.** The same wall that the all-box player smashes is the
   no-break player's main obstacle; the designers put a striped crate in its top row as the intended
   stepping stone and enclosed the wall so it cannot be bypassed.
10. **Hidden entrances are marked, not invisible:** the stone face is a distinct object lying on the path,
   followed immediately by a ? box reward.

## Transfer to the skate game

1. **Striped sandwich → multi-hit bounce column.** Ground multi-hit crate (lid 1.15 m) + a floating
   multi-hit centred ≈ 3 crates higher (underside ≈ 3.4 m, inside the 3 m stomp-bounce arc above the
   lower lid): standing between them and jumping alternately bonks and stomps, 5 + 5 hits. Put it on
   safe ground right after the first plain crate, as S1-b does.
2. **Support-order 3-stack** (wood, wood, multi-hit on top) using our settle rule: breaking the middle
   drops the multi-hit onto the base, making a 2.3 m bounce perch. At ≥12.5 m/s on the board the base is
   plowed, the column settles twice and the multi-hit ends on the ground — teach it on foot first.
3. **Mud stepping stones → crate footing over a low-traction or no-board surface:** 3 crates in a line
   across a swamp/water strip, 2–3 m apart (inside the 5.8 m held-jump range); each stomp breaks the crate,
   so the player must keep moving (as in S2-a).
4. **Closed-court crate wall (2 high × 5 wide = 2.30 m) right after a checkpoint.** On foot the held
   jump (2.97 m peak) clears it; the top row is a 5-crate grindable row, so a charged ollie (1.7 m) cannot
   reach it but a plow at ≥12.5 m/s breaks a 2-crate column. Offer a "no-break" variant with one
   multi-hit in the top row as the stepping stone.
5. **Enemy springboard crate:** hang a ? crate ≈ 5.5–6 m up (above the 4.8 m double-jump reach) over a
   stompable enemy whose bounce gives the extra height; never put a second route to it.
6. **Price lives by risk:** life crates only over hazards, on timed perches or in optional zones; none on
   the default line.
7. **Hidden side route ≈ 45 % of crates,** entered by a body-slam on a marked floor tile, side-scroll
   camera, with its own checkpoint after the first third and a nitrobang at its exit.

## Geometry, obstacles and enemies

Sources for this block: F2 p021R, p022L, p022R, p092L (topology, POINT texts); D2 p006L–p008R shots 1–42 (sizes, behaviour, captions). Widths and heights are estimates in u (one crate), read against crates in the same screenshot where possible (Crash stands ≈ 1.3–1.5 u tall); F2 maps are used for topology only. "Not visible" marks values no source shows.

### Camera and route shape

The main course is into-screen (F2 「おくスクロール」) along a walled jungle corridor about 5–8 u wide (D2 p006R shots 8–9): stone walls and foliage on both sides, so the only ways to die are holes drawn across or beside the path. It winds gently up the F2 pages and turns once in S3 (D2 shot 36, "round the turn"). The secret course and the bonus are side-scroll: the secret runs left → right along a waterfall cliff of separate ledges over a bottomless drop and exits by a one-way lift into the S1 plaza; the bonus is a short run of floating platforms. Every checkpoint sits on a wide enclosed floor (plaza, court) or on a ledge after the secret's opening hops.

- **S1** — into-screen: walled jungle corridor ≈5–8 u wide winding up the map; no side falls; ends in a totem plaza (C1) where the secret lift returns
- **X** — side-scroll: left → right along a waterfall cliff: separate grassy ledges over a bottomless drop; exits by lift into the S1 plaza
- **B** — side-scroll: floating green platforms over a void; the exit pad returns the player to S2 in front of the mud boxes
- **S2** — into-screen: corridor with a mud swamp; ends in an enclosed court between two totems (C2 + crate wall)
- **S3** — into-screen: rat pits along the path, one turn (D2 shot 36), a rock perch, the last mud, a final pit, the exit

### Platforms and gaps (section by section; table per section)

Columns *kind* to *coupling / failure* and *evidence* are observations; *why* is design inference. Platforms are `P-…`, gaps `G-…`; size is width × length (u) where both are visible.

#### S1 — Start → C1 (into-screen walled corridor)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | start corridor (wide floor, walled) | 5–8 wide | 0 | walk | walled both sides; no side falls | REST, TEACH | the first box and the first enemy meet the player on ground they cannot fall off | F2 p021R; D2 p006L shots 1–2, p006R shot 8 (width) — conf. medium |
| G-S1-a | S1 | safe mud patch | 3–4; landing corridor floor | 0 | wade, plain | none / slowed, spin disabled, no death (non-lethal; run-up ≥4) | TEACH | the first floor hazard costs only speed and the spin, and sits beside the striped sandwich, so the lesson is free | F2 p021R; D2 p006L shot 4 ("you don't drown") — conf. medium |
| G-S1-b | S1 | edge pit beside the path (not across it) | 2–3 (hole beside the line); landing not crossed | drop | avoid | none / death if walked into (lethal; run-up n/a) | EDGE-BAIT, TEACH | the first lethal hole is shown beside the route, with a ? box at its lip, before any hole has to be jumped | D2 p006L shot 5 ("a pit on the left (don't jump in)"); F2 p021R draws S1-c on the right — conf. medium (side conflicts) |
| P-S1-b | S1 | long straight runway | 5–8 wide × ≈10+ long | 0 | run; practise the dash (slide) jump | walled | REST, TEACH | D2 calls it a long safe stretch to practise the dash-jump; it ends at the first unavoidable pit | D2 p006R shot 7 — conf. medium |
| G-S1-c | S1 | full-width pit 1 | 2–3; landing corridor floor; the W/W/S stack S1-d just beyond | 0 | running, slide-jump (advised) | none / death (lethal; run-up ≈10 (the runway)) | TEST | the first gap that must be jumped follows its practice runway, and nothing else competes for attention | D2 p006R shot 8 (span estimated; no crate in frame) — conf. low |
| G-S1-d | S1 | pit 2 before the stone face (F2 draws a plank bridge here) | 2–3; landing floor with armadillo 3, then the stone face | 0 | plain, running | enemy waiting on the landing (E-S1-c) / death (lethal; run-up ≈4–6) | TEST | the first combination of two known lessons: a gap whose landing holds an enemy | D2 p006R shot 10 ("jump the pit, atomize the armadillo"); F2 p021R — conf. low (plank vs jump unresolved) |
| P-S1-c | S1 | plaza between two stone totems, closed by a stone arch | ≈8 × 8 | 0 | walk; body-slam the stone face | walled; the secret lift arrives here | CHECKPOINT-PAD, REST | the secret entrance, the mask, C1 and the secret return share one safe floor, so the optional route starts and ends at a save | F2 p021R top; D2 p006R shots 9–11, p007R shots 23–24 — conf. medium |

#### X — Secret course (side-scroll cliff ledges)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-X-a | X | drop-in ledge | ≈6 long | drop in from above | walk | bottomless drop past its edge | REST, BONUS-PAD | the first secret screen pays 4 boxes on safe footing before any side-scroll gap | D2 p006R shot 12 — conf. medium |
| G-X-a | X | bottomless gaps between cliff ledges (×2), a turtle crawling on each landing | 1.5–2; landing ledge ≈3 long with a crawling turtle | 0 (±1) | plain, stomp on landing | turtle patrol on the landing ledge: jump when it is at the far end, or land on it (stomp) / fall = death (lethal; run-up 2–4) | TEST, TIMING-STEP | the first gap coupled to an enemy's position (D2: "jump across when the time is right") | D2 p006R shot 13, p007L shot 14 — conf. medium |
| P-X-b | X | checkpoint ledge | ≈3–4 long | 0 | walk | bottomless both ends | CHECKPOINT-PAD | save after the opening hops, before the vulture / Nitro / ostrich half | D2 p007L shot 15 — conf. medium |
| P-X-c | X | long platform with a vulture at its far end | ≈10+ long | 0 | run; hop the swoop | vulture swoops along it from the far end (E-X-b) | ARENA | the runway length is what gives reaction distance for the flier | D2 p007L shot 16 — conf. medium |
| P-X-d | X | two small ledges (1 box, then 2 boxes) | ≈2–3 each | 0 | plain jumps | bottomless | STEPPING | pacing hops that line up the jump to the perch | ludo steps 5–6 (no D2 shot) — conf. low |
| G-X-b | X | gap onto a floating perch above a Nitro floor | 2–3; landing perch ≈3 × 2 carrying the ?/? stack (X-e) | 0 | slide-jump (D2 explains the dash-jump here) | none / fall onto 3 Nitro = death (lethal; run-up ≈2–3 (short ledge)) | TEST | the dash-jump practised on S1's safe runway is now demanded over explosives | D2 p007L shots 17–18 — conf. medium |
| P-X-e | X | floating perch over the Nitro floor | ≈3 × 2, ≈4 above the floor | +4 above the Nitro floor | stand; head-bonk the upper ? from below | Nitro floor below | PERCH, REWARD | a stable footing over the hazard, where the lives are | D2 p007L shots 17–18 (Nitro crates as ruler) — conf. medium |
| G-X-c | X | drop from the perch to the arrow ledge | ≈3; landing ledge ≈2–3 with the wooden ↑ (X-g) | −2 | plain (down) | none / fall onto the Nitro floor (lethal; run-up perch) | STEPPING | a short downward hop to the tool keeps the Nitro floor under every move | D2 p007L shot 18 — conf. medium |
| G-X-d | X | arrow bounce, then a dash-jump to a small platform | 2–3; landing small platform before the ostriches | up via the arrow, then level | arrow, slide-jump | none / fall (lethal; run-up arrow ledge) | TEST | the arrow lifts the player to the next tier of ledges; the dash-jump is needed again | D2 p007L shots 17, 19 — conf. low |
| P-X-f | X | ostrich floor below high ledge 1 | ledge ≈3 wide, ≈4–4.5 above the floor | +4 to +4.5 | enemy-bounce on the ostrich's back (≈2.5–3 high), then jump to the ledge | the ostrich ducks when approached (closing window) | PERCH, TIMING-STEP | a target above jump height, reachable only by a living step that removes itself | F2 p092L shot 2 + note 2; D2 p007L shots 19–20 — conf. medium |
| G-X-e | X | ledge 1 → ostrich 2's back → ledge 2 | ≈3 per hop; landing ledge 2 (X-i) | level, then up | slide-jump, enemy-bounce | ostrich 2 ducks when approached / drop to the floor; the ledge boxes are lost for this attempt (non-lethal; run-up ledge 1) | TEST, TIMING-STEP | the same living step becomes a moving stepping stone between two ledges | D2 p007L shot 20 — conf. low |
| P-X-g | X | floor between the ostriches + a lower platform | not visible | below the ledge line | drop down | none | BACKTRACK | boxes are placed under the jump line and collected by dropping back | D2 p007L shot 20 — conf. low |
| P-X-h | X | long platform 2 with vulture 2 | ≈10+ long | 0 | run; hop the swoop | vulture swoop | ARENA | a repeat of the flier runway just before the exit | D2 p007R shot 21 — conf. medium |
| P-X-i | X | exit platform: green ! + round lift | ≈4 + lift disc | lift rises to the S1 plaza | ride | one-way lift | REST | the exit is a lift, so the secret cannot be re-entered from its end | D2 p007R shot 22 — conf. high |

#### B — Bonus (side-scroll floating platforms)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | B | floating green platforms | ≈3–4 each | 0 to ±1 | plain jumps | void below | STEPPING, BONUS-PAD | calm side-on footing for the five bonus boxes | D2 p007R shot 27, p008L shots 28–30 — conf. medium |
| G-B-a | B | gaps between bonus platforms | 2–3; landing platform ≈3–4 | 0 to −1 | plain | none / falls out of the bonus (consequence not stated on these pages) (lethality not stated; run-up platform) | STEPPING | low-pressure side-on jumps between payouts | D2 p008L shots 28, 30 — conf. low |
| P-B-b | B | lower platform before the exit pad | not visible | −1 to −2 | drop down | none | DETOUR | the last box sits below the exit line | D2 p008L shot 30 — conf. medium |

#### S2 — C1 → C2 (into-screen; mud and the closed court)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S2-a | S2 | corridor after C1 (first main-course turtle) | ≈5–6 wide | 0 | walk | walled | ARENA, TEACH | the turtle debuts alone on flat ground straight after a save | F2 p022L POINT5; D2 p007R shot 25 — conf. medium |
| P-S2-b | S2 | green ? bonus pad on the right edge | ≈2 | raised pad | step on | none | BONUS-PAD | the bonus entrance follows the turtle pair, so it rewards the chain-stomp lesson | F2 p022L; D2 p007R shot 26 — conf. high |
| G-S2-a | S2 | safe mud swamp crossed on 3 ? boxes | 6–8 (boxes ≈2 apart); landing far bank | 0 (boxes up to +1) | crate-bounce chain | each stomp breaks the box under you: keep moving / fall into the mud: slowed, no spin; body-slam the box from inside; no death (non-lethal; run-up bank) | TEACH, STEPPING | the first consumable footing, laid over a gap that cannot kill | F2 p022L POINT7; D2 p008L shot 31 — conf. medium |
| P-S2-c | S2 | enclosed court between two totems | ≈5 wide, closed both sides | 0 | walk | no way around the 2 × 5 crate wall | CHOKE, CHECKPOINT-PAD | the closed court turns the wall into a pure skill gate (vault or break) | F2 p022L POINT8; D2 p008L shot 33, p008R shot 42 — conf. medium |

#### S3 — C2 → Goal (into-screen; rat pits)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-S3-a | S3 | rat pit 1: sunken walled square (2 moles) | 5–6 square; landing pit floor | −2 to −3 (walls) | drop-down, spin the moles, mushroom trampoline out | moles pop up from the floor; the trampoline exit appears when both are dead / trapped until the moles are killed; no death (non-lethal; run-up n/a (cannot be jumped)) | TEACH, CHOKE | an enforced descent: too wide to jump (D2), not lethal, and the exit is earned by beating the enemies inside | D2 p008L shot 35; F2 p022R POINT9 (×2) — conf. medium |
| P-S3-a | S3 | turn + floor under the floating ? (turtle pacing below it) | ≈5 wide; the ? ≈4–5 up | 0 | stomp the turtle once, bounce off its belly | a spin sends the turtle away and the springboard is gone | ARENA | the springboard enemy patrols directly under its target, just past a turn | D2 p008R shot 36; F2 p022R POINT10 — conf. medium |
| G-S3-b | S3 | rat pit 2 (4 moles) | 5–6 square; landing pit floor | −2 to −3 | drop-down, spin the moles, trampoline out | 4 moles / trapped until the moles are killed (non-lethal; run-up n/a) | TEST | the same trap with twice the moles | D2 p008R shot 38; F2 p022R (×4) — conf. medium |
| P-S3-b | S3 | big rock perch (left) before the last mud | ≈2, ≈1–2 high | +1 to +2 | jump from the rock to the box in the mud | a miss lands in the mud (body-slam fallback, POINT11) | PERCH | a raised take-off makes the lone mud box a one-hop target | D2 p008R shot 39; F2 p022R POINT11 — conf. medium |
| G-S3-c | S3 | last mud swamp with one ? box | 4–5; landing far bank | 0 | crate-bounce | single box that breaks / mud: body-slam the box from inside (non-lethal; run-up rock perch) | TEST | the S2 lesson with one box and no spare | F2 p022R POINT11; D2 p008R shot 39 — conf. medium |
| G-S3-d | S3 | rat pit 3 (4 moles) beside the crystal | 5–6 square; landing pit floor | −2 to −3 | drop-down, spin the moles, trampoline out | 4 moles; the crystal sits at its edge / trapped until the moles are killed (non-lethal; run-up n/a) | TEST | the crystal pulls the player to the lip | D2 p008R shot 40; F2 p022R POINT12 (×4) — conf. medium |
| G-S3-e | S3 | final pit before the exit (on the left) | ≈2 (not measurable); landing exit floor | 0 | plain | none / not stated (assumed death) (lethal; run-up short) | TEST | one last plain jump into the exit | D2 p008R shot 41 ("jump over the pit to the left") — conf. low |

### Jump sequences

| id | section | count | moves | rhythm | max gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 3 | plain (low wall), running, plain | isolated: one jump per screen | 2–3 | ≥4–6 u of flat floor before each | no | a teaching section separates every jump with flat ground, so each can be attempted from a standstill | F2 p021R; D2 p006L shot 3, p006R shots 7–10 |
| J-X-a | X | 3 | plain | even, timed to the turtle patrols | 1.5–2 | P-X-b (checkpoint ledge) | no | short hops whose only difficulty is the occupant of each landing | D2 p006R shot 13, p007L shots 14–15 |
| J-X-b | X | 5 | plain, slide-jump, plain (down), arrow, slide-jump | syncopated: up, across, down, bounce, across | 2–3 | ostrich floor (P-X-f) | no | each hop changes height around a perch over Nitro; pausing is possible, but every pause is above a lethal floor | D2 p007L shots 17–19 |
| J-X-c | X | 4 | enemy-bounce, plain, slide-jump, enemy-bounce | accelerating | ≈3 | ledge 2 or the floor | yes | the ostriches duck when approached, so the climb must be done in one go | F2 p092L note 2; D2 p007L shots 19–20 |
| J-B-a | B | ≈4 | plain | even | 2–3 | every platform | no | the bonus is a calm run of side-on hops | D2 p008L shots 28–30 |
| J-S2-a | S2 | 3 | crate-bounce | even, fast | ≈2 | far bank | yes | each stomp breaks the box under you, so the crossing cannot pause | F2 p022L POINT7; D2 p008L shot 31 |
| J-S3-a | S3 | 2 | plain (from the perch), crate-bounce | even | ≈2 | far bank | yes | rock → box → bank; the box breaks under you | D2 p008R shot 39 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S1-a | S1 | low stone wall across the path (hurdle, ≈0.5–1 u high, estimated) (non-lethal) | across path | static | jump over | S1-b striped sandwich just beyond | TEACH | the game's first required jump has no failure state, and its reward waits on the far side | F2 p021R (slab row); D2 p006L shot 3 ("over the wall") |
| O-X-a | X | Nitro floor (3 Nitro) under the perch (lethal) | in pit (floor of the gap) | static | do not fall, detonated later by the green ! (X-l) | G-X-b, X-e lives above | AREA-DENIAL | turns an ordinary ledge-to-ledge hop into a lethal one without any enemy; the lives sit right above it | D2 p007L shots 17–18 |
| O-S2-a | S2 | low stone wall with two turtles on its far side (non-lethal) | across path | static | jump over, then stomp / spin | E-S2-d | TEST | the hurdle hides the landing's occupants until the jump | D2 p008L shot 32 |
| O-S2-b | S2 | crate wall 2 high × 5 wide closing the court (the blue-gem vault) (non-lethal) | across path (wall to wall) | static | break it (all-box), slide-jump over (D2), one stomp on the top-row striped (F2) | S2-b checkpoint, S2-c crates | TEST, LANE-BLOCK | D2: a plain jump clips the top row, so only the slide-jump or the striped foothold clears it untouched — the advanced move is the intended answer | D2 p008R shot 42; F2 p092L blue-gem note; F2 p022L POINT8 |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | armadillo (アル) #1 | patrol-1D | walks side to side across the corridor right after the first box | spin, stomp, avoid (F2: no need to kill) | on line | TEACH, HURDLE | yes | the first enemy can be dodged by timing as well as attacked, on walled ground with nothing else near | F2 p021R POINT1; D2 p006L shot 2 — conf. medium |
| E-S1-b | S1 | armadillo #2 | patrol-1D | runs along the route axis, toward and away from the camera ("more aggressive") | spin, stomp | on line | TEST | — (repeat) | a patrol along the travel line cannot be passed with a side step; it must be engaged | D2 p006L shot 6 — conf. medium |
| E-S1-c | S1 | armadillo #3 | patrol-1D | waits on the landing side of pit 2, before the stone face | spin, stomp | landing platform | TEST, GUARD | — (repeat) | the first enemy at a landing: jump and fight in one motion | D2 p006R shot 10 — conf. medium |
| E-X-a | X | spiked turtle (トゲ・デ・カメンデス) | patrol-1D | crawls along the small landing ledges | stomp (flips it), flip-then-spin (fails: a spin sends it flying (D2 shot 13)) | landing platform | TIMING-GATE, TEACH | no | in the secret course the turtle debuts on a narrow ledge over a void, harder than its main-course debut in S2; D2 says its belly will later be a trampoline | D2 p006R shot 13, p007L shot 14 — conf. medium |
| E-X-b | X | vulture (パープー) | flier | waits at the far end of a long platform and swoops low along it | jump over | end of a long platform | HURDLE, TIMING-GATE | yes | the platform's length gives reaction distance; the flier is the only hazard on it | D2 p007L shot 16, p007R shot 21 — conf. medium |
| E-X-c | X | pink ostrich (ピンクー) | static (reactive: ducks when approached) | stands under a high ledge and buries its head (crouches) as the player comes near | enemy-bounce (use its back as a step), avoid (fails: a slow approach — it ducks and the step is gone) | below high ledges | TOOL/STEP, TIMING-GATE | yes | a living step with a closing window; failure costs boxes, not a life | F2 p092L note 2; D2 p007L shots 19–20 — conf. medium |
| E-S2-a | S2 | spiked turtle (main-course debut) | patrol-1D | walks the flat corridor just after C1 | stomp, then spin (POINT5) | on line | TEACH | yes | stomp-then-spin is taught on safe ground straight after a save | F2 p022L POINT5; D2 p007R shot 25 — conf. medium |
| E-S2-b | S2 | spiked turtles in a row | patrol-1D | two consecutive turtles on the corridor | chain stomp (POINT6: fruit) | on line | TEST | — (repeat) | a pair invites the chained stomp; the bonus pad follows it | F2 p022L POINT6 — conf. medium |
| E-S2-c | S2 | armadillo | patrol-1D | walks past the mud, by a leaning log | spin, stomp | on line | HURDLE | — (repeat) | a pacing enemy between the mud and the court | F2 p022L — conf. low |
| E-S2-d | S2 | spiked turtles beyond the low wall | patrol-1D | walk on the far side of the low stone wall | stomp, flip-then-spin | landing (behind a hurdle) | GUARD, TEST | — (repeat) | they guard the court and are hidden until the hop over the wall | D2 p008L shot 32 — conf. medium |
| E-S3-a | S3 | moles (アナチュール) in rat pit 1 | burrower/ambusher | pop up from the pit floor | spin (POINT9), bounce off one by the far wall to climb out (D2) | in pit | GATEKEEPER, TOOL/STEP | no | killing every mole opens the exit; their heads are also a step | D2 p008L shot 35; F2 p022R POINT9 — conf. medium |
| E-S3-b | S3 | spiked turtle under the floating ? | patrol-1D | paces underneath the floating ? box | stomp once, then bounce off its belly (fails: spin — sends it flying and the springboard is gone (D2: "without spinning it")) | below a floating crate | TOOL/STEP | — (repeat) | the enemy is the only way up, so its placement is the puzzle | D2 p008R shot 36; F2 p022R POINT10 — conf. medium |
| E-S3-c | S3 | moles in rat pit 2 | burrower/ambusher | pop up from the pit floor | spin | in pit | GATEKEEPER | — (repeat) | the trap repeated with four moles | D2 p008R shot 38; F2 p022R (×4) — conf. medium |
| E-S3-d | S3 | moles in rat pit 3 (beside the crystal) | burrower/ambusher | pop up from the pit floor | spin | in pit | GATEKEEPER | — (repeat) | the crystal draws the player to the pit edge | D2 p008R shot 40; F2 p022R POINT12 (×4) — conf. medium |

### Section beats

- **S1** (gaps 4, enemies 3, hazards 1): ? box at spawn → armadillo crossing the path → low wall hop → striped sandwich → mud patch → edge pit + ? box → armadillo on the route axis → long runway → full-width pit (dash-jump) → W/W/S stack → pit 2 + armadillo on the landing → stone face (secret) → plaza: ?, Aku, C1
- **X** (gaps 8, enemies 6, hazards 1): drop-in ledge (4 boxes) → gap + crawling turtle → gap + crawling turtle → C ledge → long platform + vulture → two small ledges → slide-jump to the ?/? perch over 3 Nitro → drop to the arrow ledge → arrow + slide-jump → ostrich 1 back → high ledge → ostrich 2 back → high ledge → drop: ground trio, lower platform → long platform + vulture → green ! + lift
- **B** (gaps 3, enemies 0, hazards 0): platform: 3 boxes → gap → ? box (life) → gap → lower-platform box → exit pad
- **S2** (gaps 1, enemies 6, hazards 2): turtle alone → turtle pair (chain stomp) → bonus pad → mud swamp: 3 ? stepping boxes → armadillo → low wall + 2 turtles beyond → court: C2 → 2 × 5 crate wall (vault or break)
- **S3** (gaps 5, enemies 11, hazards 0): Aku → rat pit (2 moles) → turn: turtle under the floating ? → 3 ? boxes → rat pit (4 moles) → rock perch → mud ? → crystal + rat pit (4 moles) → final pit → exit

### Geometry and enemy design logic

1. Lethality ramps one step per encounter: a hurdle that cannot fail (O-S1-a) → mud that only slows (G-S1-a) → a lethal hole beside the path with a box at its lip (G-S1-b) → a full-width pit after a practice runway (P-S1-b, G-S1-c) → a pit with an enemy on its landing (G-S1-d).
2. Main-course gaps are short and generous: about three lethal pits of ≈2–3 u, each with ≥4 u of run-up; every other "gap" (two mud swamps, three rat pits) turns failure into delay. The first level punishes with time, not lives.
3. Rat pits are enforced descents and enemy locks: ≈5–6 u walled squares too wide to jump, which the player must enter; the trampoline exit appears only when every mole is dead. Mole count rises 2 → 4 → 4 (G-S3-a, G-S3-b, G-S3-d).
4. Enemy patrol axes escalate: across the path, so it can be timed past (E-S1-a) → along the path, so it must be engaged (E-S1-b) → waiting on a landing, engaged while landing (E-S1-c).
5. The turtle is taught in four steps: alone after C1 (E-S2-a) → a pair for the chain stomp (E-S2-b) → a pair hidden behind a hurdle (E-S2-d) → a springboard under a floating box (E-S3-b).
6. Targets above jump height are reached only with living steps — the turtle's belly in S3 and the ostriches' backs in the secret (P-X-f). The height ceiling is enforced by placing targets just above the jump, not by walls.
7. Timed living steps (the ostriches duck when approached) teach "use it now" with a soft failure: missed boxes and a retry, never a death.
8. The optional side-scroll secret holds every coupled challenge — occupied landings (G-X-a), a flier on a runway (P-X-c), a perch over Nitro (G-X-b), an enemy ladder (J-X-c). The main course keeps its hazards uncoupled.
9. Platform length is set by the enemy on it: the vulture runways are ≈10+ u for reaction distance; the turtle landing ledges are ≈3 u, just long enough to land beside a crawling turtle.
10. Walled corridors remove side falls from the main course, and the ≈5–8 u lane leaves room to steer around enemies, which is why the early enemies are optional (F2 POINT1: no need to kill).
11. Perches appear exactly where precision is needed: the ?/? perch over the Nitro floor and the rock before the last mud box give a stable take-off for a one-shot jump.
12. The closed court makes the 2 × 5 wall unavoidable, and its 2 u height is just above a clean plain jump (D2), so the no-break goal needs the slide-jump or the striped foothold (O-S2-b).
13. Checkpoints sit on wide enclosed floors (plaza, court) or on the secret's first safe ledge after its opening hops — never on a narrow ledge, a mud crossing or inside a pit.

### Geometry transfer to the skate game

1. Opening debut strip: a walled corridor 6–8 m wide (`wall` / `coastwall` sides), a 0.6–1.0 m `platform` hurdle across it as the first jump, then a soft strip (`groundSpeedLimit`, 3–4 m) beside the first multi-hit sandwich, an edge `pit` beside — not across — the path with a crate at its lip, and only then a full-width `pit` 2.3–3.5 m long after ≥10 m of runway (the running full jump covers ≈5.6 m, so the first gap is forgiving by design).
2. Enforced-descent trap pit: a sunken square 6–7 m across whose walls stand more than 7 m above the pit floor (beyond the ≈7.0 m double-jump ledge-grab reach) or end in an overhanging lip, two `grunt`s inside (four in the repeat) and a `trampoline` in a corner as the only exit. It never kills; clearing the enemies is the practical requirement for using the trampoline.
3. Living step to a height target: a `turtle` patrolling ±1–1.5 m directly under a crate whose underside is above ≈5.5 m (beyond double-jump head reach). Measured in this engine: stomping a live `turtle`, or landing on the shell it leaves, bounces like an arrow crate to ≈ 5.2 m above the floor (≈ 7.3 m with Jump held) and re-arms the double jump (≈ 6.9 m, or ≈ 9.05 m held), so put the target's underside 5.6–7.4 m up to make the shell bounce plus double jump the only way (bible XV.10, XVII.7).
4. Side-scroll secret with occupied landings (`zone` dir E): 3–4 m ledges with 2–3 m gaps (well inside the 5.6 m jump), each landing patrolled by a `turtle` with range 1–1.5 m so the jump is timed to its phase; then a ≥12 m runway with a `floater` swooping from its far end (≈1.3 s of warning at 9 m/s), a checkpoint after the first three hops, and a `mover` lift (axis y) as the one-way exit.
5. No-break vault gate: Crash's 2-high wall (2.30 m) is below our 2.85 m full jump, so use a 3-high wall (3.46 m, needs the double jump) spanning a closed 5–6 m court right after a checkpoint, with one multi-hit crate in its top row as the stepping stone.
6. Perch over a hazard: a 3 × 2 m floating `platform` 4.6 m (4 crates) above a floor of Nitro, reached by a ≈3 m jump, holding the life crates; a ledge 2.3 m lower and 3 m on carries the arrow that lifts the player to the next tier.

## Open questions / uncertainties

- Wall S2-c: 2×5 = 10 is the reading that makes main = 30; one D2 shot alone could also be read as 2×4.
- Secret X-h / X-k split (6 boxes between them) and the types of X-c, X-d, X-h, X-j, X-k boxes (not seen;
  assumed wood).
- S1-c side of the path (F2 draws it right of the route, D2 says the pit is on the left).
- Whether the S1-e ? stands just before or just after the stone face (sources order it differently; it is
  adjacent either way).
- Geometry: all widths and heights in the geometry block are estimates read against crates and Crash in D2 screenshots; F2 maps were used for topology only.
- Geometry: pit 2 before the stone face: D2 shot 10 says "jump the pit", F2 draws a plank bridge — possibly a bridge over a pit.
- Geometry: rat pits: F2 marks the mole icons ×2, ×4, ×4 and D2 shots 38 and 40 each say "four moles", so this pass reads 3 pits with 2 + 4 + 4 = 10 moles; the first-wave enemy record (4 pits, 12 moles) is left unchanged.
- Geometry: the final pit (D2 shot 41) may be part of rat pit 3's surround rather than a separate hole.
- Geometry: whether spinning an unflipped spiked turtle hurts the player is not stated (F2: stomp, then spin; D2: a spin sends it flying).
- Geometry: ostrich duck timing and the ledge heights (≈4–4.5 u) are estimates; the lower-platform height in the secret is not visible.
- Geometry: the consequence of falling in the bonus is not stated on these pages.
