# Crash 2 — Stage 3 Hang Eight  (ステージ3「テケテケかわのぼり」 — "pitter-patter up the river")

Sources: F2 p025R (header, book p.43), p026L (p.44), p026R (p.45), p027L (p.46), p093L (perfect page,
p.178); D2 p011L shots 1–10, p011R shots 11–22, p012L shots 23–30, p012R shots 31–39; web
corroboration: gamepressure.com N. Sane Hang Eight page (74 chests; bonus "a total count of 11 chests";
gem-course checkpoint "surrounded by eight explosive chests").

Evidence level: the main course (23) was read crate by crate from the F2 map and reconciles exactly with
the header (74 − superscript 51). The bonus (11) is read from the D2 bonus HUD (0 → 6 → 9, then two more
boxes) and matches gamepressure. The blue-gem ("gem") course has no F2 map; its total (40 = 51 − 11) is
exact, but only 26 of its boxes are visible in D2 shots 28–37 — 14 are unobserved and are carried as one
residual record (G-x). Box types on the water are read from F2 icons: slatted icons are striped (F2
POINT3 names striped boxes in the first water cluster); where the icon is unclear the box is `unknown`.

Extra composition key: `unknown` = a box that is certainly there but whose type was not readable.
Yellow jump ramps, mines, steel blocks and ! / green ! blocks are not boxes and are not counted.

## At a glance

| Field | Value |
|---|---|
| Theme | Jungle river climbed upstream: stepping-stone tiles, sinking round pillars, docks, and a jet-powered surfboard (F2 「サーフボード/RIVER」) |
| Camera | Into-screen throughout (F2 「おくスクロール」), alternating on-foot legs and board legs; bonus is a side-scroll treetop course |
| Total boxes | **74** (F2 p025R 「はこのかず ぜんぶで 74コ」, superscript **51**) |
| Boxes per route | **main 23 / bonus 11 / gem course 40**. Conclusion on the superscript: 51 = gem course + bonus. Basis: p093L perfect order "start with the blue gem: normal → bonus → normal → gem course → normal"; main tally = 23 exactly; bonus 11 (D2 HUD, gamepressure) |
| Checkpoints | 4 (header C×4, subscript 1): main C1 (start of the first board leg), C2, C3 (docks); gem course 1 (between the Nitro rows, G-d) |
| 1UP | 2 (subscript 1): main W1-b (in the first minefield); the other is outside the main course (not seen: gem course or the one unseen bonus box) |
| Aku Aku | 2, both main (F1-a, W1-a); subscript 0 |
| TNT / Nitro | TNT 1 (bonus B-a). Nitro ≥11 in the gem course (8 around its C, ≥3 floating on the water), detonated by the green ! on the gem course's final pier |
| ! / outline | Gem course: ! ×1 (upstream switch, materialises 3 outlines), green ! ×1 (end pier), outline ×3 |
| Arrows / iron-bound | None. Yellow board ramps (not boxes): 2 on the second main board leg, more in the gem course |
| Striped | Main: 3 in W1-a + 2 in W1-c (icon reading); bonus 2; gem course 2 (G-a) |
| Gems | Clear gem #1 (box): all 74 — requires the Turtle Woods blue gem to open the gem course. Clear gem #2 (hidden): no-miss clear within the time limit; the timer appears at C1 (≈1:00) and F2 says to ignore boxes and the bonus |
| Enemies | Venus flytrap ゴックン (jump-spin from a distance), piranha ピラーニャ (leaps between tiles; jump-spin in time with it, or pass while it is under water), hippo ターマス (a stepping stone that sinks if you stay) |
| Hazards | Water = death (Crash can't swim); sinking round stone pillars; floating spiked mines (static lines and moving ones); paired whirlpools (boost through the middle); a log wall (cleared from a ramp) |
| Difficulty | F2 「かーんたん!!」 |

## Route skeleton

```
START (pipe)
  | F1  on foot, tiles ...................... 5   [?A/??] 2x2 block,  C1 by a flytrap  (timer starts)
  |                                               -- board dock --
  | W1  jet-board ........................... 8   5-box stagger (A, ?, 3 S)  mine line  whirlpool gate
  |                                               1UP between mines   S S single file
  C2  dock
  | F2  on foot, tiles ...................... 3   C2  flytrap x2  ? piranha  hippos  C3
  |   +--[green ? plate beside flytrap 2]--> BONUS (side-scroll treetops) ..... 11 --> back to F2
  |   +--[blue-gem plate at the waterfall top]--> GEM COURSE ................. 40 (C x1, Nitro >=11, !, outline x3,
  |         <-- gem elevator back to F2 --------------------------------------'   green ! at the end)
  C3  dock
  | W2  jet-board ........................... 7   S? + ?   whirlpool gate   mine line   ramp -> ? in the air
  |                                               moving mine   2x2 group   ramp -> over the log wall   moving mines
GOAL (flytrap by the goal)               main 23 + bonus 11 + gem 40 = 74 = header
```

## Section-by-section map

### F1 — Start → C1  (5 boxes; on foot over stepping stones)

```
        (board waiting at the plank dock)
   [C]  e:flytrap                    F1-b  C1 beside a Venus flytrap (F2 POINT2: jump-spin from a distance)
    []  []                            L-shaped tiles
    ( ) sinking round pillar          F2 POINT1: it sinks after a while; jump as soon as it surfaces
   [?][A]                            F1-a  2x2 block on a raised tile
   [?][?]
    []  e:piranha (jumps between tiles)
    [] [] []  three steps / pier
  START (pipe)
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| F1-a | raised tile right after the piranha | ?×3 + Aku×1 | GRID 2×2 (top row ? A, bottom row ? ?) | spin/jump | ON-PATH GRID AKU REWARD | "four crates give you some fruit and another Aku Aku": the mask is handed out before the first board leg | F2 p026L inset; D2 p011L shots 2–3 | high |
| F1-b | last tile before the board dock, beside a flytrap | C×1 | single | jump-spin the flytrap from range, then spin the box | CHECKPOINT ENEMY-LINK TIME-TRIAL | save at the board pickup; breaking it starts the time-trial clock (D2 shot 6). F2 p093L: a miss voids the time attack, so this C is useless to the speed-runner | F2 p026L POINT2 + screenshot; D2 p011L shots 5–6 | high |

### W1 — C1 → C2  (8 boxes; first jet-board leg)

```
             (dock -> C2)
          [S]                 W1-c  two striped in single file, right half of the channel
          [S]
      * *                     mines on the left
         (L) *  *             W1-b  1UP mid-channel with two mines tight on its left
     @    @                   paired whirlpools: boost through the gap (F2 POINT4)
       * *
        *                     single-file line of 6 floating mines up the middle-left
        *
        *
     [S]      (?)            W1-a  staggered 5 right after boarding:
         (A)                        back row S ... ?
     [S]   [S]                      middle A, front row S S
    board pickup
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| W1-a | right after boarding | striped×3, ?×1, Aku×1 | staggered 3 rows across the channel (2-1-2) | ram them on the board | ON-PATH SPEED-LINE TEACH AKU GRID | teaches "boxes on the water break by ramming" (F2 POINT3 「体当たりでウハウハ」) — ramming a striped box gives all 10 fruit at once. The stagger makes each box a steering choice | F2 p026L POINT3 + zoom; D2 p011L shot 7 | high (count), medium (types) |
| W1-b | just past the whirlpool gate | 1UP×1 | single, two mines immediately beside it | steer between the mines | LIFE EDGE-BAIT SPEED-LINE REWARD | a life used as bait inside the minefield: "maneuver carefully through the minefield. Grab that extra life" | F2 p026L zoom; D2 p011L shot 9 | high |
| W1-c | last stretch before the dock | striped×2 | single file on the right half; mines on the left | ram | ON-PATH SPEED-LINE PAIR | a safe lane is marked by boxes, the dangerous lane by mines: the boxes double as a guide line | F2 p026L zoom | high (count), low (types) |

### F2 — C2 → C3  (3 boxes; on foot; bonus and gem-course entrances)

```
   [C]  dock, board waiting        F2-c  C3
    hippo  hippo                   POINT8: two in a row, jump rhythmically
    crystal on the tiles
    hippo                          POINT7: it sinks if you stay; jump at once
   [?]                             F2-b  ? on a tile after the piranha
    e:piranha                      POINT6: jump-spin with its rhythm, or pass while it is submerged
   <blue-gem hex plate>            -> GEM COURSE (needs the Turtle Woods blue gem)
    waterfall step, three stone posts
   [green ? plate] e:flytrap       -> BONUS
    e:flytrap                      POINT5: pass the first without getting close
   [C]  dock                       F2-a  C2
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| F2-a | dock at the end of W1 | C×1 | single | spin | CHECKPOINT | "run over and hit the checkpoint to avoid having to go through that whole mess again" | F2 p026R; D2 p011L shot 10 | high |
| F2-b | tile right after the piranha | ?×1 | single | spin/jump | ON-PATH SINGLE ENEMY-LINK | the only box of this leg, placed where the piranha has just been beaten or dodged | F2 p026R zoom; D2 p011R shot 13 | high |
| F2-c | dock before W2 | C×1 | single | spin | CHECKPOINT | save at the second board pickup | F2 p026R; D2 p011R shot 17 | high |

### W2 — C3 → Goal  (7 boxes; second jet-board leg)

```
  GOAL  e:flytrap on the tiles
   dock
       *   *                  two MOVING mines just past the wall: dodge left/right, then boost to the pier
  ===log wall===              POINT12: jump it from the ramp; don't overshoot into the mines
       /^\                    ramp 2
   (?)   [x]                  W2-c  staggered 2x2 between the ramps
   [x]   [x]                  POINT11: turn sideways to stop and wait for the moving mine
        *-->  moving mine     sweeps left/right right beyond W2-b
      (?)                     W2-b  ? hanging in the air: only a boosted ramp jump reaches it
     /^\                      ramp 1   (F2 POINT10: boost just before the ramp)
   *  *  *  *                 diagonal line of 4 mines
     @   @                    paired whirlpools (POINT9: dash through the middle)
      (?)                     W2-a  ? before the whirlpools ...
  [x]                         ... and one box just past the plank dock
  board pickup (C3)
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| W2-a | right after re-boarding, before the whirlpools | unknown×1 (slatted icon) + ?×1 | PAIR, staggered left then right | ram | ON-PATH SPEED-LINE PAIR | warm-up targets before the boost gate: "take out the two boxes, then maneuver past the two whirlpools" | F2 p027L zooms; D2 p011R shots 17–18 | high (count) |
| W2-b | above the landing arc of ramp 1 | ?×1 | single, floating high | boost just before the ramp (F2 POINT10 「ジャンプ台でブーストを使用」) | HIGH TOOL SPEED-LINE TIMED | the vertical test of the board: an unboosted jump passes underneath. A moving mine sweeps just beyond it, so the reward is followed at once by a dodge | F2 p027L POINT10 + zoom; D2 p011R shot 20 | high |
| W2-c | between ramp 1 and ramp 2 | ?×1 + unknown×3 | staggered 2×2 | ram; stop by turning sideways if the moving mine blocks the line (POINT11) | ON-PATH SPEED-LINE TIMED GRID | the last crate field sits in front of the wall ramp and a moving mine: "break these boxes, then boost up the ramp and over the wall" | F2 p027L POINT11 + zoom; D2 p011R shot 21 | high (count), low (types) |

Main tally: F1 5 + W1 8 + F2 3 + W2 7 = 23 = 74 − 51. Board legs hold 15 of the 23 main boxes.

### BONUS — green ? plate in F2 → elevator back  (11 boxes; side-scroll treetops, red mushroom platforms)

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| B-a | first mushroom platform | striped×1 low + 4-stack bottom→top ?, wood, TNT, wood + 1 unseen | STACK 4 + single | break the lower box, then hurry for the upper one while the TNT counts down (F2); D2: take out a lower box, avoid the TNT, back off when it counts down | BONUS STACK SUPPORT-ORDER EXPLOSIVE-MIX TIMED | a support-order stack with a TNT in it: removing the base drops the column and lights the TNT, so the upper box must be taken inside the 3-count | D2 p012L shot 24 (HUD 0), shot 25 (HUD 6); F2 p093L bonus note | medium (6th box unseen) |
| B-b | platform after the steel-block crawlspace | wood×1, striped×1, ?×1 | single + PAIR | spin/jump | BONUS ON-PATH | "more fruit and three boxes on this platform" (HUD 6) | D2 p012L shots 25–26 | high |
| B-c | last two mushrooms before the elevator | ?×2 | two singles on consecutive platforms | jump/spin | BONUS EDGE-BAIT | "two more boxes to break, then jump over to the elevator" (HUD 9 → 11) | D2 p012L shot 27; gamepressure (11) | high |

Gamepressure also mentions a wall of metal crates in the bonus (steel, not counted); D2 shot 25: crawl or
slide under a collection of blocks.

### GEM COURSE — blue-gem plate → gem elevator back to F2  (40 boxes; on foot, then jet-board; C×1)

Reached by standing on the hexagonal gem plate at the top of the waterfall steps when you own the Turtle
Woods blue gem (F2 p093L; D2 shots 12, 28). Order from D2 shots 28–38.

```
 landing tile:  (S)        (S)      <- floating        G-a
                [W]        [W]      <- bounce on these to reach the striped
 moving island -> hippo -> stairs -> e:flytrap  [W W / W W] wall      G-b
 open water:  [W] [W] ...  single-file floating boxes: each stomp breaks one, keep moving   G-c
 tile causeway:  [N][N][N][N]   [C]   [N][N][N][N]       G-d  dash-jump onto the C, then again
 pier -> jet-board:
     (o)  (o)(o)  outlines + [W] by a ramp; "hit the boxes that are in the water"            G-e
     [N] [N] [N]  floating single file, mines around                                        G-f
     [!]  upstream switch -> about-face, ride back, break the 3 filled-in boxes             G-g
     back to the pier: [G!] (all gem-course Nitros blow) -> gem elevator                    G-h
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
| G-a | landing tile of the gem elevator | wood×2 + striped×2 | two SANDWICH columns: a wood box on the tile, a striped floating high above each | stomp the wood boxes (they break) to rise into the striped above | HIGH TOOL SANDWICH ROUTE-SPLIT | "bounce on the lower boxes to the right and left to break the bouncy boxes up in the air": the lower box is a single-use step | D2 p012L shot 29 | high |
| G-b | top of the stairs after the hippo, behind a flytrap | wood×4 (minimum seen) | WALL ≥2 × 2 | kill the flytrap, smash through | WALL ENEMY-LINK ROUTE-SPLIT | the flytrap guards the wall; "spin this Venus Flytrap ... crash through the wall of boxes" | D2 p012R shot 31 | medium (size) |
| G-c | open water after the wall | wood×2 seen | BRIDGE / STEPPING single file of floating boxes | stomp-chain: "after you stomp-break the first box, jump to the next one immediately" (F2) | BRIDGE STEPPING TIMED ROUTE-SPLIT TEST | footing that is consumed as you use it: hesitation = drowning | F2 p093L note 1; D2 p012R shot 32 | high (pattern), low (length) |
| G-d | tile causeway | Nitro×8 + C×1 | ROW of 4 across the path, the C alone on the next tile, ROW of 4 | dash-jump over row 1 onto the C, break it, dash-jump over row 2 | EXPLOSIVE-MIX CHECKPOINT NITRO-SWITCH TEST ROUTE-SPLIT | the checkpoint is the landing pad between two lethal rows ("checkpoint surrounded by eight explosive chests") | D2 p012R shot 33; gamepressure | high |
| G-e | first stretch of the gem board leg | outline×3 + wood×1 (beside a ramp) | outlines along the channel (one left, two in a column); wood by the ramp | ram the real box now; come back for the outlines after G-g | OUTLINE BACKTRACK SPEED-LINE ROUTE-SPLIT | "there are some outlined boxes here, don't worry about them. Hit the boxes that are in the water" | D2 p012R shots 34, 36; F2 p093L note 2 | medium |
| G-f | further upstream among mines | Nitro×3 (minimum seen) | single file mid-channel | steer around | EXPLOSIVE-MIX SPEED-LINE ROUTE-SPLIT NITRO-SWITCH | a Nitro slalom on water: the board's crate-ramming habit is now lethal | D2 p012R shot 35 | high (≥3) |
| G-g | upstream past the mines | ! ×1 (not counted) | single | ram/hit it, then turn round | SWITCH BACKTRACK ROUTE-SPLIT | the switch is placed past its outlines so the player must about-face on the board and ride back through the mines | D2 p012R shots 35–36; F2 p093L note 2 | high |
| G-h | final pier | green ! ×1 (not counted) | single | jump off the board and hit it | NITRO-SWITCH ROUTE-SPLIT | "you'll hear all the Nitro boxes behind you blow" — all gem-course Nitros count only now | D2 p012R shot 37 | high |
| G-x | not shown in the sources | 14 boxes: probably the second 1UP + 13 of unknown type (e.g. more "boxes in the water", the rest of the G-c bridge and G-b wall) | — | — | ROUTE-SPLIT COUNT-TRAP | residual so that the gem course reaches 40 (= 51 − 11) | derived | low |

Gem-course tally: 4 + 4 + 2 + 9 + 4 + 3 + 0 + 0 + 14 = 40.

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| F1 | sinking round pillar | between F1-a and F1-b | crates are on stable tiles only, never on sinking pillars |
| F1 | piranha | between the pier steps and F1-a | F1-a is the reward for passing it |
| F1 | flytrap | beside C1 | guards the checkpoint; jump-spin from range |
| W1 | mine line (6) + mine pairs | after W1-a; flanking W1-b; left of W1-c | the mines mark the danger lane, the boxes the safe lane; the 1UP sits between two mines |
| W1, W2 | paired whirlpools | mid-leg | boost gates; boxes sit before or after them, never inside |
| F2 | flytraps ×2, piranha, hippos ×3 | between C2 and C3 | F2-b sits right after the piranha; the bonus plate sits beside flytrap 2 |
| W2 | 4-mine line, moving mine, 2 moving mines | after W2-a; beyond W2-b; past the wall | every box target is followed by a dodge |
| W2 | log wall | after ramp 2 | cleared by a normal ramp jump; overshooting hits the mines |
| G | hippo, moving island, flytrap, Nitro rows, floating Nitros, mines | gem course | Nitros surround the checkpoint and line the water |

## Puzzle rooms and dependency chains

1. **W2-b boosted ramp target.** Setup: a ? box hangs above ramp 1's landing arc; a moving mine sweeps
   just beyond. Correct: boost right before the ramp → high arc through the box → dodge the mine on
   landing. Tempting wrong: hitting the ramp at cruise speed → you pass under the box. Loss: one box;
   recoverable only by turning the board round and trying again (costs the time-trial gem).
2. **Bonus TNT stack (B-a).** Break the bottom ? → the column drops and the TNT starts its 3-count →
   take the upper box before the blast (F2), or back off and let it blow (D2). Wrong: spinning the TNT
   itself (instant blast). Loss: a life; the fruit in boxes caught by the blast.
3. **G-c consumable bridge.** Every stomp breaks the box you land on. Correct: chain the jumps without
   pausing. Wrong: stopping to line up the next jump. Loss: a life (water).
4. **G-d Nitro-sandwiched checkpoint.** Dash-jump over four Nitros onto the C, break it, dash-jump over
   the next four. The C is both the save and the only safe tile. The Nitros count only after G-h.
5. **G-e → G-g outline backtrack on the board.** Outlines are seen first; the ! is upstream past mines
   and floating Nitros; turn the board round, ride back, break the three new boxes, then return to the
   pier for the green !. Loss if skipped: 3 boxes and (without G-h) every gem-course Nitro.
6. **Two gems pull in opposite directions.** Time-trial gem: never stop, "don't break boxes, use them as a
   guide" (D2 shot 6), skip the bonus. Box gem: return later with the blue gem and take everything.

## Design logic of this level

1. **Board crates are steering targets, not attack targets.** Ramming breaks them, so placement alone
   decides difficulty: staggered 2-1-2 fields (W1-a), single-file pairs (W1-c), offset pairs before a
   gate (W2-a), a 2×2 stagger (W2-c).
2. **Every board crate is paired with a hazard decision:** the 1UP between two mines (W1-b), a box line
   beside a mine line (W1-c), the ramp box followed by a moving mine (W2-b), the last field in front of a
   moving mine and the wall ramp (W2-c). Rhythm: collect → dodge → collect.
3. **Gates are kept clean.** Whirlpool pairs are boost gates; boxes sit just before or after them
   (W2-a), never inside, so boosting and collecting are separate decisions.
4. **One vertical test per board leg at most:** the boosted-ramp box (W2-b) is the only main-course
   crate off the water surface. It teaches "charge before the jump".
5. **On-foot legs carry the checkpoints and few boxes;** board legs carry 15 of the 23 main boxes.
   Checkpoints sit at docks (board pickup/drop), never in the middle of a board leg.
6. **The main course is deliberately light (23 of 74)** because of the time-trial gem; 69 % of the boxes
   sit in the bonus and the gem course, so the speed goal and the all-box goal use different spaces.
7. **Crates as a racing line:** D2's advice for the time trial is to use the boxes as a guide — the box
   lines on the water trace the safe lane between mines.
8. **Lives on the board are bait** (the 1UP is inside the minefield).
9. **The gem course recombines everything learned so far:** single-use boxes as a bridge (TW's mud
   stepping stones made lethal), Nitro rows around a checkpoint, an outline group with its switch
   upstream, Nitros floating where ramming boxes has become a habit, and a green ! at the exit.
10. **Explosives are absent from the main course;** the only TNT is in the bonus and every Nitro is in the
   optional gem course, consistent with stages 1–2.

## Transfer to the skate game

1. **Plow-chain budget.** With the 8 % speed tax per plowed crate, entering a line of n plain crates needs
   v ≥ 12.5 / 0.92^(n−1): 2 crates 13.6 m/s, 3 → 14.8, 4 → 16.1, 5 → 17.4, 8 → 22.4 (the charged
   maximum of 23 plows at most 8; a 30.5 m/s downhill at most 11). So, like W1-a, lay board crate fields
   so a single line hits 2–3 crates (charge needed); give 4–5 in a row only after a downhill. Fields wider than one line (2-1-2
   stagger) make the player choose which crates to plow.
2. **Staggered field geometry:** 5 crates in three rows across a 6–8 m lane, rows 4–6 m apart, offsets of
   2–3 m — at 13–15 m/s that is one steering correction every ≈0.3–0.45 s, the W1-a feel. Follow it with a
   hazard line, not another field.
3. **Bait life between two Nitros** set one crate width (≈1.15 m) either side of it, on the exit line of a
   boost gate (W1-b): only a precise line at speed takes it.
4. **Kicker target:** hang a ? crate above the landing arc of a kicker so that only a full-charge
   approach reaches it; put a moving hazard 1 s past the landing (W2-b). A cruise-speed launch must pass
   cleanly underneath — a miss costs a turnaround, not a death.
5. **Consumable crate bridge = breakable grind rail.** A single-file line of ≥2 touching, equal-height
   crates over a gap is a rail under our rules; grinding breaks each crate as you ride off it and the last
   at the dismount, so the bridge disappears behind the rider (G-c). On foot the same line is a
   stomp-chain (3 m bounce per crate) that also cannot be paused.
6. **Checkpoint between explosive rows (G-d):** a row of 4 Nitro across the lane, the C crate alone on
   the next 3–4 m, another Nitro row — on foot it needs held jumps (5.8 m long); on the board it forces a
   charged ollie and a landing on a short safe strip. Use only in an optional route, as Crash does.
7. **Vehicle backtrack:** outline group first, `bang` 20–30 m further on past hazards, and room to turn the
   board round (G-e → G-g). Our grind/!-trigger rule (a slide or grind-through hits !) lets the switch sit
   on a rail line.
8. **Separate the time-attack line from the all-box load:** keep main board legs light (Hang Eight puts
   only 15 boxes on two whole board legs) and on the racing line; put the dense crate puzzles in optional
   side zones.

## Open questions / uncertainties

- 14 gem-course boxes are not shown in D2 or described in F2 (G-x); their types and the exact sizes of
  the G-b wall and G-c bridge are unknown.
- Location of the second 1UP (gem course vs the one unseen box of bonus cluster B-a).
- Types of W1-c, W2-a and W2-c boxes (slatted icons may be striped or plain wood).
- The 6th box of B-a (HUD 6 after the first platform, five boxes visible in the screenshot).
