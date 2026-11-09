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

## Open questions / uncertainties

- Wall S2-c: 2×5 = 10 is the reading that makes main = 30; one D2 shot alone could also be read as 2×4.
- Secret X-h / X-k split (6 boxes between them) and the types of X-c, X-d, X-h, X-j, X-k boxes (not seen;
  assumed wood).
- S1-c side of the path (F2 draws it right of the route, D2 says the pit is on the left).
- Whether the S1-e ? stands just before or just after the stone face (sources order it differently; it is
  adjacent either way).
