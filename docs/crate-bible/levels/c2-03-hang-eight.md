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

## Geometry, obstacles and enemies

Sources for this block: F2 p026L, p026R, p027L, p093L (topology, POINT texts); D2 p011L–p012R shots 1–39 (sizes, behaviour, captions, and the time-trial timer visible in shots 6–22). Widths are estimates in u (one crate), read against crates in the same top-down screenshot where possible; F2 maps are used for topology only. Segment times come from D2's on-screen timer in one time-trial run and are approximate.

### Camera and route shape

Into-screen throughout (F2 「おくスクロール」): the river channel runs up the map with gentle bends. On-foot legs follow a causeway of square stone tiles in the middle of the channel; board legs use the whole channel width (≈6–8 u, D2 shots 7–9 and 18–21), with jungle banks as walls. Docks mark every mode change and carry the checkpoints. The bonus is a side-scroll treetop course; the gem course has one reversal (the board turns round after the upstream switch and rides back toward the camera, D2 shot 36). D2's timer (time-trial run) reads C1 1:00 → waterfall top 0:37 → C3 dock 0:27 → whirlpools 0:23 → mine line 0:21 → ramp 1 0:18 → crate field 0:16 → goal 0:06.

- **F1** — into-screen: on foot up a causeway of square tiles in a ≈6–8 u river channel; water is lethal; sinking pillars bridge the wider gaps
- **W1** — vehicle: jet board upstream, into-screen; the whole channel is the lane; static mines divide it
- **F2** — into-screen: on foot: tiles, a waterfall step with posts, hippos; ≈10 s from the gem plate to C3 in the D2 timer run
- **B** — side-scroll: red mushroom platforms on tree trunks; a steel-block crawlspace
- **G** — into-screen: gem course: on foot (moving island, hippo, crate bridge, Nitro causeway), then jet board with an about-face (rides back toward the camera)
- **W2** — vehicle: jet board: whirlpool gate, mine slalom, two ramps, moving mines; ≈19–21 s in the D2 timer run (0:27 → 0:06)

### Platforms and gaps (section by section; table per section)

Columns *kind* to *coupling / failure* and *evidence* are observations; *why* is design inference. Platforms are `P-…`, gaps `G-…`; size is width × length (u) where both are visible.

#### F1 — Start → C1 (on foot, tile causeway)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-F1-a | F1 | pipe start + stone pier with three steps up | ≈3 wide | +1 to +3 (steps) | walk; plain jumps up | water on both sides (lethal) | REST | a safe pier to start from, already surrounded by lethal water | F2 p026L; D2 p011L shots 1–2 — conf. medium |
| G-F1-a | F1 | water gap bridged by a sinking round pillar | 2.5–3.5 (pillar ≈1.5 wide in the middle); landing slab ≈2.5–3 | 0 | plain ×2 via the pillar, slide-jump across without waiting (D2) | the pillar sinks after a while and resurfaces (POINT1); cycle not stated / water = death (lethal; run-up pier ≈3–4) | TEACH, TIMING-STEP | the first timed footing, but one long jump bypasses the rhythm — a cautious line and a fast line | F2 p026L POINT1; D2 p011L shot 1 — conf. medium |
| P-F1-b | F1 | square slab tiles in a line | ≈2.5–3 square, 1–2 apart | 0 | plain jumps | water | STEPPING | fixed tiles are the rests between timed crossings | D2 p011L shots 1–4 — conf. medium |
| G-F1-b | F1 | piranha gap between two blocks | 2–3; landing block ≈2.5–3 | 0 | plain (timed), jump-spin in rhythm | the piranha leaps out of the gap on a cycle (D2: wait for it to jump, then go) / bitten or drowned (lethal; run-up block) | TIMING-STEP | an enemy occupies the gap itself rather than a platform | D2 p011L shot 2; F2 p026L — conf. medium |
| P-F1-c | F1 | raised tile carrying the 2 × 2 crate block | ≈3 | +1 | jump up | none | REST, BONUS-PAD | reward and rest right after the piranha | D2 p011L shot 3; F2 p026L inset — conf. medium |
| G-F1-c | F1 | second sinking-pillar gap | 2.5–3.5; landing slab | 0 | plain via the pillar, slide-jump | pillar cycle / water = death (lethal; run-up tile) | TEST | the pillar lesson repeated without a caption | D2 p011L shot 4; F2 p026L — conf. medium |
| P-F1-d | F1 | L-shaped tile run + C1 tile beside a flytrap | tiles ≈2.5 wide | 0 | walk; jump-spin the flytrap from range (POINT2) | the flytrap's lunge reaches the C tile | CHECKPOINT-PAD | the first flytrap is met guarding the checkpoint | F2 p026L POINT2; D2 p011L shots 5–6 — conf. medium |
| P-F1-e | F1 | plank dock with the board | ≈4 | 0 | board pickup | the time-trial clock starts at C1 | REST | a dock is the hinge between the two locomotion modes | D2 p011L shot 6 — conf. high |

#### W1 — C1 → C2 (jet board)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-W1-a | W1 | river channel (board lane) | ≈6–8 wide | 0 | steer; boost | mines and whirlpools divide the lane | ARENA | the whole channel is open, so lanes are defined only by hazards | F2 p026L; D2 p011L shots 7–9 — conf. medium |
| G-W1-a | W1 | whirlpool gate: two pools side by side | gap ≈2–3 between the pools; landing channel | 0 | boost through the middle (POINT4) | the pools pull the board in / sucked in (D2 "flushed": death implied) (lethal; run-up channel) | TEST | a boost gate: the board's one special move is required here | F2 p026L POINT4; D2 p011L shot 8, p011R shot 18 — conf. medium |
| P-W1-b | W1 | dock C2 | ≈4 | 0 | dismount | none | CHECKPOINT-PAD | save at the mode change | D2 p011L shot 10 — conf. high |

#### F2 — C2 → C3 (on foot, hippos)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-F2-a | F2 | dock + tile path past two flytraps | tiles ≈2.5–3 | 0 | pass the first without getting close (POINT5) | bite range | ARENA | a path to learn a planted enemy's reach | F2 p026R POINT5; D2 p011R shot 11 — conf. medium |
| P-F2-b | F2 | waterfall step with three stone posts | posts ≈1 | +2 to +3 in total | plain jumps up | water | STEPPING | the narrowest footing in the stage, but static | F2 p026R; D2 p011R shot 12 — conf. low |
| P-F2-c | F2 | gem plate (hex) at the waterfall top | ≈2 | 0 | stand on it (with the blue gem) | none | BONUS-PAD | the optional route starts from the highest point of the leg | F2 p026R; D2 p011R shot 12 — conf. high |
| G-F2-a | F2 | piranha gap | 2–3; landing tile with the ? box | 0 | jump-spin in rhythm, pass while it is under water (POINT6) | piranha cycle / bitten or drowned (lethal; run-up tile) | TEST | the F1 piranha repeated, now with a box as the landing reward | F2 p026R POINT6; D2 p011R shot 13 — conf. medium |
| G-F2-b | F2 | hippo stepping stone | ≈2–3 each side; landing hippo back ≈2 | 0 | plain ×2 (land and leave at once) | the hippo sinks soon after you land (POINT7; D2: "not a lot of time") / water = death (lethal; run-up tile) | TIMING-STEP | the enemy is the platform, and its timer starts when you land | F2 p026R POINT7; D2 p011R shot 14 — conf. medium |
| G-F2-c | F2 | two hippos, offset (zig-zag) | ≈2–3 per hop; landing hippo, hippo, tile | 0 | plain ×3, turning between the hippos | both sink / water = death (lethal; run-up tile) | TEST, TIMING-STEP | the single hippo doubled and offset: rhythm plus a change of direction (D2: hop on, turn, jump to the next) | F2 p026R POINT8; D2 p011R shot 16 — conf. medium |
| P-F2-d | F2 | tile path + dock C3 | ≈4 | 0 | walk | none | CHECKPOINT-PAD | save at the second board pickup | F2 p026R; D2 p011R shot 17 — conf. high |

#### B — Bonus (side-scroll treetops)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | B | red mushroom platforms on tree trunks | ≈3–4 | ±1 | plain jumps | void below | STEPPING, BONUS-PAD | calm side-on footing for the bonus crates | D2 p012L shots 24–27 — conf. medium |
| P-B-b | B | steel-block ceiling over a platform (crawlspace) | clearance ≈1 | 0 | crawl or slide under (D2) | none | CHOKE, TEACH | the only place in the stage where the slide-under is required | D2 p012L shot 25 — conf. medium |
| G-B-a | B | gaps between mushrooms | 2–3; landing mushroom ≈3 | ±1 | plain | none / falls out of the bonus (consequence not stated) (lethality not stated; run-up mushroom) | STEPPING | low-pressure hops between payouts | D2 p012L shots 25–27 — conf. low |

#### G — Gem course (on foot, then board)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-G-a | G | gem landing tile (two sandwich columns) | ≈3–4 | 0 | stomp the lower boxes to reach the striped | none | REST, BONUS-PAD | a safe arrival before the gem course's hardest footing | D2 p012L shot 29 — conf. medium |
| P-G-b | G | moving island | ≈2 | 0 | wait for it to come toward you, jump on, then on to the hippo (D2) | travels toward the player on a cycle | TIMING-STEP | the gem course adds a moving platform to the stepping-stone grammar | D2 p012L shot 30 — conf. medium |
| G-G-a | G | island → hippo → stairs | ≈2–3 per hop; landing stairs | 0, then +1–2 (stairs) | plain ×2 (timed) | island travel + hippo sink / water = death (lethal; run-up island) | TEST | two kinds of timed footing back to back | D2 p012L shot 30, p012R shot 31 — conf. medium |
| P-G-c | G | stairs to the flytrap and the crate wall | ≈3 wide | +1 to +2 | kill the flytrap, break through the wall | flytrap at the top of the stairs | CHOKE, ARENA | the guard stands where the path narrows | D2 p012R shot 31 — conf. medium |
| G-G-b | G | consumable crate bridge over open water | ≈6–8 overall; crates ≈1 apart; landing next tile | 0 | crate-bounce chain | each stomp breaks the crate — jump to the next at once (F2) / water = death (lethal; run-up tile) | TEST | footing consumed as it is used: no-stop by construction, the Turtle Woods mud chain made lethal | F2 p093L note 1; D2 p012R shot 32 — conf. medium |
| G-G-c | G | Nitro rows around the checkpoint (tile causeway) | row of 4 Nitro ≈1 deep; C strip ≈2 deep; second row ≈1 deep; landing C strip ≈2 × 4, then the pier | 0 | slide-jump ×2 (D2) | none / Nitro = death (lethal; run-up ≈4–6 of causeway) | TEST | the only safe landing between two lethal rows is the save itself | D2 p012R shot 33 — conf. medium |
| P-G-d | G | pier → gem board leg (outlines, floating Nitros, mines, upstream !) | channel ≈6 | 0 | ride; turn round after the ! and ride back | none | ARENA | a board leg built for an about-face | D2 p012R shots 34–36 — conf. medium |
| P-G-e | G | final pier: green ! + gem elevator | ≈4 | 0 | jump off the board, hit the green ! | none | REST | the course ends on a dock, like every other mode change | D2 p012R shots 37–38 — conf. high |

#### W2 — C3 → Goal (jet board, ramps)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-W2-a | W2 | whirlpool gate 2, right after re-boarding | gap ≈2–3; landing channel | 0 | boost through the middle (POINT9) | the pools pull the board in / sucked in (lethal; run-up dock) | TEST | the boost gate returns as the leg's first hazard | F2 p027L POINT9; D2 p011R shot 18 — conf. medium |
| P-W2-a | W2 | yellow jump ramp 1 | ≈1.5–2 | launch | boost just before it for a high arc (POINT10) | floating ? above the landing arc; a moving mine just beyond | TOOL | the board's vertical test, where maximum speed is rewarded | F2 p027L POINT10; D2 p011R shot 20 — conf. high |
| P-W2-b | W2 | yellow jump ramp 2 + log wall across the channel | ramp ≈1.5–2; wall height not visible | launch over the wall | a normal ramp jump (POINT12) | too much speed carries the board into the mines past the wall | TEST | the same object as ramp 1 now asks for restraint | F2 p027L POINT12; D2 p011R shot 21 — conf. high |
| P-W2-c | W2 | dock + tile path to the goal (flytrap) | ≈3–4 | 0 | walk; spin the flytrap | none | REST | the stage ends on foot, past one last guard | F2 p027L; D2 p011R shot 22 — conf. medium |

### Jump sequences

| id | section | count | moves | rhythm | max gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-F1-a | F1 | 6–7 | plain (steps), plain via the sinking pillar or slide-jump, timed plain (piranha), plain, plain via the pillar, plain | syncopated: waits for the pillar and the piranha | 2.5–3.5 | P-F1-c (crate tile), P-F1-d (C1) | no | the causeway alternates fixed tiles (rests) with timed crossings | F2 p026L; D2 p011L shots 1–5 |
| J-F2-a | F2 | 4 | timed plain (piranha), plain onto the hippo, plain onto hippo 2 (turn), plain to the tile | accelerating | 2–3 | tile before C3 | yes | sinking footing removes the option to stop; D2's timer shows ≈1.5–2 s per beat (0:35 → 0:30) | F2 p026R POINT6–8; D2 p011R shots 13–16 |
| J-G-a | G | 3 | plain onto the moving island, plain onto the hippo, plain to the stairs | timed | 2–3 | top of the stairs | yes | a mover then a sinker: both set the timing | D2 p012L shot 30, p012R shot 31 |
| J-G-b | G | ≈3–4 | crate-bounce | even, fast | ≈1 | far tile | yes | a consumable bridge cannot be paused | F2 p093L note 1; D2 p012R shot 32 |
| J-G-c | G | 2 | slide-jump, slide-jump | jump – stop – jump | ≈2–3 (over a 1 u row onto a 2 u strip) | the C strip | no | the checkpoint strip is the rest between two lethal rows | D2 p012R shot 33 |
| J-W2-a | W2 | 2 | ramp (boosted), ramp (normal speed) | board cadence ≈2–3 s per event (D2 timer: whirlpools 0:23, mines 0:21, ramp 1 0:18, field 0:16) | ramp arcs (not measurable) | C3 dock before, goal dock after | no | two ramp jumps with opposite speed demands; the board can stop by turning sideways (POINT11) | F2 p027L POINT10–12; D2 p011R shots 18–21 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-W1-a | W1 | single-file line of 6 floating spiked mines up the middle-left, then mine pairs (lethal) | across path (lane divider) | static | go around | W1-a field before it, W1-c boxes in the safe lane | LANE-BLOCK | the mines mark the danger lane and the boxes the safe lane | F2 p026L; D2 p011L shots 8–9 |
| O-W1-b | W1 | whirlpool pair (boost gate) (lethal) | flank pair with a central gap | constant pull | boost through the middle (POINT4) | W1-b 1UP just past it | TEST | a gate that can only be passed with the board's boost | F2 p026L POINT4; D2 p011L shot 8 |
| O-W1-c | W1 | two mines flanking the 1UP (lethal) | flank | static | thread the gap | W1-b 1UP | TEST | a life used as bait between two hazards | F2 p026L zoom; D2 p011L shot 9 |
| O-W2-a | W2 | whirlpool pair 2 (lethal) | flank pair with a central gap | constant pull | dash through the middle (POINT9) | W2-a boxes just before it | TEST | boxes before the gate, never inside it, keep collecting and boosting separate | F2 p027L POINT9; D2 p011R shot 18 |
| O-W2-b | W2 | diagonal line of 4–5 mines (lethal) | across path (diagonal) | static | slalom: left, then right, then straight (D2) | — | RHYTHM, LANE-BLOCK | a diagonal line turns a straight channel into a slalom | F2 p027L; D2 p011R shot 19 |
| O-W2-c | W2 | moving mine sweeping left–right beyond ramp 1's landing (lethal) | across path (patrol) | continuous sweep (period not stated) | wait (turn the board sideways to stop, POINT11), time the pass | W2-b floating ?, W2-c field | TIMING-GATE | a timing gate on a forced-motion vehicle is fair only because the board can stop | F2 p027L POINT11; D2 p011R shot 20 |
| O-W2-d | W2 | log wall across the channel (lethality not stated) | across path | static | jump it from ramp 2 at normal speed (POINT12) | O-W2-e mines beyond | TEST | a speed-control test: overshooting lands in the mines | F2 p027L POINT12; D2 p011R shot 21 |
| O-W2-e | W2 | two moving mines past the wall (lethal) | across path (patrol) | sweeping (period not stated) | jam left or right, then turbo past them (D2) | O-W2-d | TIMING-GATE | the landing zone of the wall jump is itself a timing gate | F2 p027L; D2 p011R shot 21 |
| O-G-a | G | floating Nitros and mines on the gem board leg (lethal) | on line | static | go around | G-e outlines, G-g switch upstream | LANE-BLOCK | Nitros float where crates usually do, so the ramming habit becomes lethal | D2 p012R shots 35–36 |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-F1-a | F1 | piranha (ピラーニャ) | swimmer (leaps across the gap on a cycle) | jumps out of the water between two blocks and drops back | wait for its leap, then cross (D2), jump-spin in rhythm (POINT6) (fails: jumping into its arc) | in pit (the gap between tiles) | TIMING-GATE | yes | the first enemy is a moving gap occupant on otherwise static footing | D2 p011L shot 2; F2 p026L — conf. medium |
| E-F1-b | F1 | Venus flytrap (ゴックン) | static (planted; lunges) | lunges and bites at short range | jump-spin from a distance (POINT2), spin when it lunges (D2) (fails: walking up to it) | beside the checkpoint tile (guarding crate) | GUARD | yes | a planted enemy teaches reach; it is met alone, at the save | F2 p026L POINT2; D2 p011L shot 5 — conf. medium |
| E-F2-a | F2 | Venus flytraps in a row | static (planted; lunges) | two planted beside the tile path | pass the first without approaching (POINT5), jump-spin (fails: walking into bite range) | flank of the tile path | TEST | — (repeat) | learn the bite distance on the first, use it on the second | F2 p026R POINT5; D2 p011R shot 11 — conf. medium |
| E-F2-b | F2 | piranha | swimmer (leaps across the gap on a cycle) | leaps between tiles | jump-spin in rhythm, pass while it is under water (POINT6) (fails: jumping into its arc) | in pit | TIMING-GATE | — (repeat) | the F1 lesson repeated with a box as the landing reward | F2 p026R POINT6; D2 p011R shot 13 — conf. medium |
| E-F2-c | F2 | hippo (ターマス) | static (living platform; sinks after you land) | floats in the river and plunges soon after being stood on | land and leave at once (POINT7) (fails: staying on it) | in water as a stepping stone | TOOL/STEP, TIMING-GATE | yes | the enemy is footing with a fuse; it is met single before the pair | F2 p026R POINT7; D2 p011R shot 14 — conf. medium |
| E-F2-d | F2 | hippos, offset | static (living platform; sinks after you land) | two in a row, offset sideways | rhythmic double hop with a turn (POINT8, D2) (fails: pausing on either) | in water as stepping stones | TEST, TOOL/STEP | — (repeat) | the single hippo doubled and offset | F2 p026R POINT8; D2 p011R shot 16 — conf. medium |
| E-G-a | G | hippo after the moving island | static (living platform; sinks after you land) | stepping stone between the island and the stairs | land and leave at once (fails: staying on it) | in water as a stepping stone | TOOL/STEP | — (repeat) | the sinker follows a mover | D2 p012L shot 30 — conf. medium |
| E-G-b | G | Venus flytrap at the top of the stairs | static (planted; lunges) | guards the crate wall | spin it (D2) (fails: walking up to it) | guarding crate (the wall) | GUARD | — (repeat) | the guard stands where the path narrows to the wall | D2 p012R shot 31 — conf. medium |
| E-W2-a | W2 | Venus flytrap by the goal | static (planted; lunges) | stands on the tiles before the exit | spin it (D2), jump-spin from range (fails: walking up to it) | exit | GATEKEEPER | — (repeat) | the stage ends with the enemy it began with | F2 p027L; D2 p011R shot 22 — conf. medium |

### Section beats

- **F1** (gaps 3, enemies 2, hazards 0): pipe + pier steps → sinking-pillar gap → piranha gap → 2 × 2 crate tile (mask) → sinking-pillar gap → L tiles → C1 + flytrap → dock: board
- **W1** (gaps 1, enemies 0, hazards 3): staggered 5-crate field → single-file mine line → whirlpool gate (boost) → 1UP between two mines → two striped in the safe lane, mines on the left → dock C2
- **F2** (gaps 3, enemies 6, hazards 0): dock C2 → two flytraps → bonus pad → waterfall posts → gem plate → piranha gap → ? tile → hippo → crystal → two hippos (zig-zag) → dock C3
- **B** (gaps 3, enemies 0, hazards 1): TNT stack on a mushroom → slide under the steel ceiling → 3 boxes → 2 boxes → elevator
- **G** (gaps 3, enemies 2, hazards 2): landing tile: sandwiches → moving island → hippo → stairs: flytrap + crate wall → consumable crate bridge → Nitro row / C / Nitro row → board: outlines + a box by a ramp → floating Nitros + mines → upstream ! → about-face → ride back → pier: green ! → elevator
- **W2** (gaps 1, enemies 1, hazards 5): re-board: 2 boxes → whirlpool gate → diagonal mine line → ramp 1 (boost) → floating ? → moving mine → 2 × 2 field → ramp 2 → log wall → two moving mines → dock → flytrap → goal

### Geometry and enemy design logic

1. Two locomotion modes alternate with docks as hinges, and every dock carries a checkpoint (C1 at the first board, C2 and C3 at the next two docks); no checkpoint sits on timed footing or on the board.
2. On foot the geometry is stepping stones over lethal water: ≈2.5–3 u slabs with 1–3.5 u gaps. Jump length alone is never the test; the coupling is — a sinking pillar (G-F1-a), a piranha in the gap (G-F1-b), a hippo that sinks on landing (G-F2-b), a flytrap's reach (P-F1-d).
3. Each coupling debuts once in a mild form and is then doubled: pillar ×1 → ×2; one flytrap at C1 → two in a row; one hippo → two offset; a piranha in F1 → again in F2.
4. Timed footing can be bypassed by skill: D2 dash-jumps the pillar gap without waiting, and F2's time-trial advice is not to wait for footholds — every timed crossing has a slow safe line and a fast line.
5. Board legs are slaloms on a ≈6–8 u channel: static mine lines are lane dividers (O-W1-a), whirlpool pairs are boost gates (O-W1-b), moving mines are timing gates (O-W2-c), and ramps add the vertical axis (P-W2-a, P-W2-b).
6. The board has a stop verb (turn sideways, POINT11), which is what makes moving-mine timing gates fair on a forced-motion vehicle.
7. Ramp 1 rewards maximum boost (the ? above its arc) and ramp 2 punishes it (mines beyond the log wall): the same object with opposite speed demands, 2–3 s apart.
8. Event cadence from D2's timer: on the board one decision every ≈2–3 s (whirlpools 0:23, mine line 0:21, ramp 1 0:18, field 0:16); on foot through the hippos one beat every ≈1.5–2 s (0:35 → 0:30).
9. The enemies behave as platforms and timers rather than fighters: flytraps are planted, piranhas leap on a cycle inside gaps, hippos are footing with a fuse. Nothing chases.
10. The gem course escalates both grammars: on foot a moving island, a hippo, a consumable crate bridge over lethal water and a checkpoint between two Nitro rows; on the board Nitros floating where crates usually are and an upstream switch that forces an about-face.
11. The bonus teaches a move the main course never needs (sliding under a steel ceiling, P-B-b): side skills live in side rooms.
12. Water is the only killer on foot and the banks wall the board legs, so every hazard is in the channel itself; there are no side drops to manage.

### Geometry transfer to the skate game

1. Causeway over `lethal` water: 3 m square `platform` tiles with 1.2–3.5 m gaps (1–3 crates); bridge one 3.5 m gap with a 1.7 m `phasepad` (cycle 3–4 s, on-share 0.5) — the 5.6 m running jump also clears the whole gap, which keeps a fast line for time trials.
2. Hippo steps: `crumble` pads (shake 0.3–0.5 s, ≈2.3 m wide) standing in the water, first one alone, then two offset 2.5 m sideways and 3 m apart for the zig-zag double; they return after 10 s, so a failed attempt can be retried without a checkpoint.
3. Gap occupant without a new system: a `firetiki` beside a 2.5 m water gap whose sweep crosses the gap every 2–3 s plays the piranha — the jump is timed to its cycle while the tiles stay static.
4. Board slalom on a 7–9 m lane: a single-file row of 6 Nitro crates down the left third as the lane divider (never on the racing line), a boost gate of two `pit`s with a 2.5–3 m gap and a `speedpad` in the gap, and a `stone` patrolling across the lane (axis x) 6–8 m past a kicker's landing as the moving mine; the brake is the stop verb that makes it fair.
5. Ramp pair with opposite demands: kicker 1 with a crate floating above its landing arc that only a near-charged approach (≈23 m/s) reaches; kicker 2 in front of a 1.5–2 m wall with Nitro 10–12 m past it, so a charged launch overshoots into it and a cruise launch (12 m/s, ≈6.6 m of air) lands short.
6. Put a checkpoint on every dock-like transition between foot and board, never on timed footing; keep the board leg itself free of saves (≈20 s per leg, as in W2).

## Open questions / uncertainties

- 14 gem-course boxes are not shown in D2 or described in F2 (G-x); their types and the exact sizes of
  the G-b wall and G-c bridge are unknown.
- Location of the second 1UP (gem course vs the one unseen box of bonus cluster B-a).
- Types of W1-c, W2-a and W2-c boxes (slatted icons may be striped or plain wood).
- The 6th box of B-a (HUD 6 after the first platform, five boxes visible in the screenshot).
- Geometry: tile, gap and channel widths in the geometry block are estimates from D2's top-down shots (crates as ruler).
- Geometry: sinking-pillar and hippo timings are qualitative in both guides; segment times come from D2's on-screen timer in one run.
- Geometry: whether a whirlpool kills outright (D2 "flushed") or only pulls; mine counts per leg are approximate.
- Geometry: the unseen part of the gem course (≈14 boxes, G-x) hides further geometry; the length of the crate bridge (G-G-b) is not visible.
- Geometry: the height of the log wall is not visible (a normal ramp jump clears it).
