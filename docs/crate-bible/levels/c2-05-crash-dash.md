# Crash 2 — Stage 5 Crash Dash  (ゆきだまゴロゴロ, "snowball rolling")

Sources: F2 p030L (stage header, zoomed), F2 p030R–p031R (map, book pp. 53–55, POINT 1–12, Aku Aku tips), F2 p093R (book p. 179: perfect-box order and two bonus cautions — the stage table lists no perfect page, but the map's bonus pointer "ボーナスチャレンジへ 179ページ" leads here); D2 p015L–p016R (book pp. 28–31, shots 1–35 with captions and the bonus HUD counter).

Evidence level:
- Read directly: every crate icon on the F2 map (each crate group sits in a green callout bubble or is drawn on the path; all bubbles zoomed), the header counts, all F2 POINT texts and Aku tips, every D2 caption, and the D2 bonus HUD counter (1 → 2 → 5 → 15 → 17).
- Confirmed by both guides: start crates (D2 s1), the three checkpoint rooms (D2 s4, s10, s25), the crate beside the crystal (D2 s18), the lone right-edge crate (D2 s28 = F2 POINT 10), the three fence groups 2 / 3 / 3 (D2 s33–s35 = F2 POINT 12), and the whole bonus (D2 s19–s23 + F2 p093R).
- Inferred: the start column is two wood crates high (F2 draws it about twice the height of its neighbour; D2 s1 shows a tall wooden column); the exact footprint of fence groups 2 and 3 (L-shape vs. stack); the type of the first bonus crate (already broken in D2 s19, not drawn by F2).
- **Count conflict (small):** F2 draws **4** Nitro crates in the left-side line; D2 s15 says "past the three boxes". F2's 4 closes the header total exactly (see reconciliation), so 4 is used. Neither guide says how (or whether) the player breaks the Nitros for the box gem — see Open questions.

## At a glance
| Field | Value |
|---|---|
| Theme | Snow-dusted jungle temple path; a giant snowball-boulder rolls after Crash. No enemies at all |
| Camera axis | Toward-camera chase: Crash runs at the camera with the boulder filling the top of the screen (F2/D2 screenshots); bonus round is side-scroll |
| Total boxes | **44** (F2 p030L header; superscript **17**) |
| Boxes per route | Main course **27** (incl. 4 Nitro, 3 C, 1 1UP) · Bonus **17** (D2 HUD counter 0→17; = header superscript) · no secret, gem or death route |
| Reconciliation | Main 6 + 3 + 5 + 13 = 27 = 44 − 17 exactly; bonus 1 + 1 + 3 + 10 + 2 = 17 exactly |
| Checkpoints | 3, all main (header subscript 0). Each sits in a roofed shelter where the boulder stops (Aku tip on F2 p030R) |
| 1UP | 2 (subscript 1): one at the first goal fence (main), one sandwiched between two TNT in the bonus |
| Aku Aku | **0** — the stage has no mask crate |
| TNT / Nitro | TNT 2 (bonus only) · Nitro 4 (main, a line along the left edge) |
| ! / outline / iron-bound | none / none / none |
| Arrows | wood 0 · steel arrow blocks 2 (bonus only, uncounted) |
| Striped | 5 (1 in the C2 room, 4 as bonus footing) |
| Gems | 1 clear gem = all 44 boxes. F2 p093R order: normal course → bonus → normal course |
| Crystal | On the path just after the last wooden bridge, beside a lone crate. F2 POINT 8: the stage cannot be backtracked, so take it on the way |
| Enemies | none |
| Hazards | Boulder (four releases, one from each shelter); pits/holes across the path; land mines (ドッカン地雷: not lethal, launch and slow you so the boulder gains); electric fences (lethal, alternate sides, POINT 4); wooden bridges (the boulder rips the first, falls off the second); Nitro line; speed pads (blue arrow plates — help, POINT 9) |
| Difficulty notes | A clear only needs forward running. The box gem turns the chase into a time bank: the Aku tip on p031R says you cannot break every box unless you are so far ahead that the boulder drops out of view, and POINT 11 says missing a single speed pad makes the perfect "basically impossible" |

## Route skeleton
```
START HUT (3)  --boulder 1-->  pits, mines  -->  ROOF ROOM 1: ?/? + C1   (6 cum)
   --boulder 2-->  mines, chasm, drop-off zig-zag, 3-mine line, fences  -->  ROOF ROOM 2: S + ? + C2   (9)
   --boulder 3-->  mines, 2 quick pits, fences L-R-L, bridge 1 (ripped), NITRO x4 (left edge), pits,
                   bridge 2 (boulder falls)  -->  crystal + W  (14 main)
        `-- ? plate == BONUS (17): W? | W in steel sandwich | TNT/1UP/TNT | 6 ? over 4 striped | W/W  ==> back
   speed pads x2  -->  ROOF ROOM 3: W/? + C3/?   (18 main; 35 with bonus)
   --boulder 4-->  pits, mines, lone W on right edge, boosters, fence, pits, bridge 3,
                   FENCE 1 (W+1UP) - FENCE 2 (W ? ?) - FENCE 3 (?/? ?)  -->  GOAL   (27 main; 44 total)
```

## Section-by-section map

### S1 — Start hut → C1 room  (6 boxes; cumulative 6)
```
 [START HUT, roofed]   W   ?        W = 2-high wood column, ? single (inside the hut, before the chase)
                       W
        | boulder 1 released as you leave
        |  ~~pit~~ (POINT 2: "a hole appears", go left then jump)   ~~pit~~   ~~pit~~
        |  m        m   (mines, POINT 3: run right of them)
        v
 [ROOF ROOM 1]    ?    C1          ? on ? column; the C crate is nearer the entrance
                  ?
```
| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S1-a | inside the roofed start hut, before the boulder moves | wood ×2, ? ×1 | 2-high wood column beside a single ? | walk, spin, jump | ON-PATH STACK PAIR TEACH | Free crates in the only calm moment of the stage: the player learns to collect quickly before the chase (D2 s1: break them, "then get ready to run") | F2 p030R bubble (zoom); D2 s1 | high (presence), medium (2-high) |
| S1-b | roofed room 1, where boulder 1 stops | ? ×2, checkpoint ×1 | ? stacked on ?, C crate in front | walk, spin; may need a step back | CHECKPOINT STACK BACKTRACK REWARD | The shelter is the reward for surviving; the impact of the boulder can knock Crash forward past the boxes onto the C crate, so the guide tells you to go back for the "surprise boxes" | F2 p030R bubble (zoom); D2 s4 caption | high |

Rhythm: one long sprint with pits and mines and no crates at all between the hut and the room. The only crates are where the boulder cannot reach.

### S2 — C1 → C2 room  (3 boxes; cumulative 9)
```
 [ROOF ROOM 1] --boulder 2-->  m (centre)  m (bear right)  ~~chasm~~  drop-offs (zig-zag)
               m m m (line of 3 - jump it)   |fence|  |fence|  (POINT 4: zig-zag)
 [ROOF ROOM 2]   S   ?   C2
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S2-a | roofed room 2 | striped ×1, ? ×1, checkpoint ×1 | striped and ? side by side, C crate in front | walk, spin; striped pays per stomp (up to 10) | CHECKPOINT PAIR REWARD | Same shelter-reward grammar as S1-b; the striped crate pays most to a player who stands and stomps — only possible here, where the boulder has stopped | F2 p030R bubble (zoom: vertical slats = striped) + p031L top (C drawn in the room); D2 s10 caption | high |

### S3 — C2 → crystal and bonus plate  (5 boxes; cumulative 14 on the main course)
```
 [ROOF ROOM 2] --boulder 3--> m(right) m m(left)  ~pit~ ~pit~ (POINT 5: two in a row, land the 2nd on the LEFT)
   |fence| L - R - L   ==bridge 1== (boulder rips it up behind you)
   ~pit~   N                         Nitro line hugs the LEFT edge (POINT 6: keep right, memorise)
             N
               N
                 N    ~pit~   ~pit~
   ==bridge 2== (POINT 7: boulder falls off here - "now you can relax")
   crystal(left)   [W](right)    (?)=bonus plate    >> >> speed pads
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | after bridge 1, between two pits, left half of the path | Nitro ×4 | diagonal line along the left edge | none needed — avoid (no green ! in the stage) | ROW CHASE SPEED-LINE TEST COUNT-TRAP | A lane-restrictor, not a reward: at full sprint with the boulder behind, the player must already be in the right-hand lane because a pit follows immediately. F2 tells you to memorise them. The 4 crates close the header total, so they are counted boxes (see Open questions) | F2 p031L map + POINT 6; D2 s15 ("three boxes") | high (line), medium (4 vs 3) |
| S3-b | just past bridge 2, beside the crystal | wood ×1 | single, right side of the path | walk, spin | ON-PATH SINGLE REWARD | Marks the end of the chase: "home free". Paired with the crystal so the player slows down here — the stage forbids backtracking (POINT 8), so anything skipped is lost | F2 p031L (zoom); D2 s18 ("crystal … along with another box") | high |

### B — Bonus round (? plate after the crystal; 17 boxes; side-scroll)
```
 steel walk:  [W?]   [M]                 [⇑]          fruit column
                     [W]  <- wood between a steel block above and a steel arrow below
                     [⇑]
 small platforms -> [T]     land BESIDE the top TNT, jump and spin the middle crate
                    [L]
                    [T]
 gap:   [?][?][?][?][?][?]      top row: stomp ?1..?5, keep ?6
           [S][S][S][S]         bouncy footing over the gap: 10 stomps each, then ?6 with a held jump
 red platform:  [W]
                [W]   -> exit
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| B-a | first crate of the bonus | wood? ×1 | single | walk, spin | ON-PATH SINGLE BONUS | Starts the counter; nothing asked | D2 s19 caption (HUD already 1) | low (type) |
| B-b | steel walkway | wood ×1 (+ steel block above, steel arrow below, uncounted) | crate sandwiched in a vertical steel column | spin from the side (cannot be stomped: steel lid) | SANDWICH SINGLE TEACH BONUS | Teaches "spin, don't stomp" in a safe place — the same move the last fences demand under pressure; time it so you pass the column cleanly | D2 s19 shot + caption (zoom) | high |
| B-c | after two small platforms | TNT ×2, life ×1 | 3-high column TNT / 1UP / TNT | jump up beside the column and spin the middle crate; landing on the top TNT starts its fuse | STACK EXPLOSIVE-MIX SANDWICH LIFE TEST REWARD SUPPORT-ORDER | The life is the prize for a precise mid-air spin. F2's fallback — stomp a TNT and let the blast take the 1UP crate — keeps the box count but forfeits the life, so the column separates the box goal from the life reward | D2 s21 caption; F2 p093R caution ① | high |
| B-d | across a gap | ? ×6, striped ×4 | two-tier row: 6 ? on top, 4 striped below as footing | stomp along the top five ?, drop to the striped crates and stomp each ten times, finish on the 6th ? with a held jump to reach the far ledge | ROW STEPPING BRIDGE SUPPORT-ORDER TOOL TEST BONUS | The whole bonus in one puzzle: every crate is also a step. Breaking the 6th ? too early removes the launch to the far side; leaving a striped crate unbroken loses its count (F2: check that you stomped ten times before moving on) | D2 s22 shot + caption (+10 on the counter); F2 p093R caution ② | high |
| B-e | final red platform | wood ×2 | 2-high column | spin or stomp | STACK REWARD BONUS | A last easy pair so the round ends on success | D2 s23 (counter 15 → 17) | high |

### S4 — C3 room → goal  (13 boxes incl. the room; main 27 / total 44)
```
 >> >> (speed pads, F2 p031L)  [ROOF ROOM 3]   W   C3       C crate sits ON a ? crate
                                               ?   ?
   --boulder 4-->  ~pit~ ~pit~ m(left)   m m (left) m (right)   ~pit~ [W] <- lone crate, RIGHT edge of a narrow footing (POINT 10)
   >> >> boosters over fruit -> m (trap)   ~pit~ (jump on the right: fence left)   ~pit~ ~pit~   ==bridge 3==
   |fence 1| L : [L][W]        run right of the fence, spin back left
         |fence 2| R : [W][?][?]   run left, spin back right
   |fence 3| L : [?][?] stacked + [?]   run right, spin back left, jump    --> GOAL
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S4-a | roofed room 3 (start of the final chase) | wood ×1, ? ×2, checkpoint ×1 | two 2-high columns: W on ?, C on ? | walk, spin (C can be hit directly or dropped by breaking its ?) | CHECKPOINT STACK REWARD | Last calm crates; the checkpoint itself rides on a crate, a small support-order wrinkle | F2 p031R bubble; D2 s25 shot + caption | high |
| S4-b | after the third pit cluster, right edge of a narrow footing just past a pit | wood ×1 | single | sidestep right and spin while running | EDGE-BAIT SINGLE CHASE TIMED COUNT-TRAP | The first crate placed under pursuit: hitting it costs a lateral move at the lip of a pit while the boulder gains. F2 flags it as the crate perfect-runners miss | F2 p031R POINT 10; D2 s28 | high |
| S4-c | fence 1 (left side) | life ×1, wood ×1 | pair on the ground in front of the fence | run past on the right, spin back left | ON-PATH PAIR LIFE CHASE TIMED COUNT-TRAP | The main-course life sits against a lethal fence on the side you must avoid: only a banked lead buys the spin | F2 p031R (zoom) + POINT 12; D2 s33 ("two boxes") | high |
| S4-d | fence 2 (right side) | wood ×1, ? ×2 | three on the ground, L-shaped | run past on the left, spin back right | ON-PATH CHASE TIMED COUNT-TRAP | Mirror of S4-c: the side of the hazard alternates, so each group demands the opposite spin | F2 p031R (zoom); D2 s34 ("three boxes") | high (count), medium (footprint) |
| S4-e | fence 3 (left side), just before the goal | ? ×3 | 2-high ? column + one ? beside it | run right, spin back left, then jump to safety | STACK CHASE TIMED COUNT-TRAP | Final exam: three crates, one of them high, a step before the goal — the last place a slow player loses the gem | F2 p031R (zoom); D2 s35 ("Hello Box Gem!") | high (count), medium (stack) |

Prose: the final chase contains 9 of the stage's 10 "under pursuit" crates (S4-b to S4-e). Everything before it is a sprint with crates only in shelters. Speed pads appear only here and in the approach to room 3, which is exactly where the crates need the extra time.

## Enemies and hazards
| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| all | boulder (×4: from the hut, room 1, room 2, room 3) | fills the lane behind Crash; stops in front of each roofed room; the third falls off bridge 2 | Crates live only where the boulder stops (hut, rooms, after bridge 2) — except in S4, where crates are placed in its path on purpose |
| S1–S4 | pits / holes (about 15–20 drawn) | across the path, often in pairs, sometimes as a gap between bridge-like slabs | S4-b sits on the lip of one; the Nitro line sits between two |
| S1–S4 | land mines | singles, pairs and a line of three | Never next to crates; they punish route errors by slowing you (POINT 3), which is what costs crates later |
| S2, S3, S4 | electric fences | alternate left/right; POINT 5 makes you land on the left because a fence follows | In S4 the fences become crate holders (S4-c/d/e) |
| S3 | wooden bridges | bridge 1 is ripped up by the boulder; bridge 2 ends the chase | Crystal and S3-b sit just past bridge 2 |
| S3 | Nitro ×4 | left edge between two pits | A crate type used purely as a hazard |
| S3, S4 | speed pads | 2 before room 3, more in S4 (POINT 9, 11) | The resource that pays for S4's crates |

## Puzzle rooms and dependency chains
- **P1 — Bonus TNT/1UP/TNT column (B-c).** Setup: a 1UP crate between two TNT, three high. Correct: land next to the column, jump and spin the middle crate, walk away from nothing. Tempting wrong: landing on the top TNT (fuse starts while you stand on the column) or spinning the bottom TNT (instant blast). Loss: the box still counts if a blast takes it, but the life is lost — F2 even recommends that sacrifice if the spin fails. Why it works: one object, two goals with different costs (count vs. life).
- **P2 — The ?-over-striped bridge (B-d).** Setup: six ? floating above four striped crates that are the only footing over a gap. Correct: break ?1–?5 from above, then clear the striped row with ten stomps each, and use ?6 last as the high launch to the exit ledge. Tempting wrong: breaking ?6 early (no launch left) or hopping off a striped crate before it breaks (crate lost). Loss: the crate count for the gem (an unbroken striped crate) and possibly the exit itself (neither guide says whether the far ledge can be reached without ?6). Why: the crates are simultaneously reward, footing and tool, so their order is the puzzle.
- **P3 — The time bank (S4).** Setup: lone edge crate + three fence groups placed on the dangerous side of each obstacle while the final boulder chases. Correct: hit every speed pad and no mine from room 3 onward, then sidestep and spin at each group. Tempting wrong: treating the speed pads as optional or drifting onto mines. Loss: all-box only (the clear is easy). Why: the stage converts earlier execution into later crate access; F2's Aku tip states the rule outright.
- **P4 — Checkpoint on a crate (S4-a).** Minor: the C crate sits on a ? crate; breaking the ? drops the C. Nothing is lost either way.

## Design logic of this level
1. **Crates avoid the pursuer.** 14 of the 27 main-course crates sit where the boulder cannot be: the start hut (3), three roofed rooms (3 + 3 + 4) and the spot after the boulder falls (1). The first two chases contain no crate on the run at all.
2. **Shelter = checkpoint + 2–3 crates.** Every boulder segment ends in a roofed room with a C crate and a small group; the room is both the rest stop and the payout. The boulder's impact can push you past the group, so the room adds a tiny backtrack (D2 s4).
3. **Density curve rises only at the end.** Main crates per section: 6, 3, 5, 13. The last chase is the only one that places crates in the danger lane (9 crates), turning the finale into the crate exam.
4. **Crates on the "wrong" side.** Under pursuit, every crate sits off the safe line: S4-b on a pit lip to the right, the fence groups in front of fences on the side the player would avoid. The intended move is run past, then spin back — always toward danger.
5. **Speed as currency.** Speed pads (POINT 9) and mines (POINT 3) modulate the lead; F2's Aku tip and POINT 11 make the lead the price of the last crates. The all-box goal and the clear goal are different games on the same track.
6. **Explosives as lanes, not puzzles, on the main course.** The only explosives on the run are four Nitros along one edge — a memorised lane restriction between two pits. The bonus holds the real explosive puzzle (P1).
7. **The bonus is the bank.** 17 of 44 crates (39 %) sit in a calm side-scroll room, more than the first three chase sections combined (14). It is also where the stage teaches the spin-from-the-side (B-b) needed at the fences.
8. **No mask anywhere.** Aku Aku would add little: the boulder, pits and fences kill outright. The stage's only safety device is distance.
9. **Lives reward the hardest crates.** One 1UP is the middle of a TNT sandwich (precision), the other is the first fence crate (time bank).
10. **No backtracking turns misses into permanent losses.** POINT 8 warns the crystal must be taken in passing; the same applies to S4-b and the fences — a missed crate means replaying from room 3.

## Transfer to the skate game
1. **Chase shelters.** For a pursuer segment (rolling hazard behind the rider), place a roofed checkpoint room every ~150–250 m holding a checkpoint and 2–3 crates; leave the chase lane empty in the first two segments. Rider cruise 12 m/s → a 200 m segment lasts ~15 s, matching Crash Dash's rhythm.
2. **Smash cost = lead cost.** On the board, plowing a plain crate at ≥ 13 m/s costs ~20 % speed. In a chase, one crate on the line is therefore a real decision. Use at most one lane crate per ~50 m in the final segment, always beside a hazard (pit lip, fence), never in the safe lane.
3. **Fence groups.** Put 2–3 crates (≤ 2-high, top 2.30 m) 1–2 crate widths in front of a lethal side hazard, alternating sides every ~25–35 m. Precede the run with 2 boost pads (or a downhill) so the player can bank 30–60 m of lead. On foot the move is "pass, then spin back" (spin reach +0.8 m); on the board it is "carve across at ≥ 13 m/s and plow".
4. **Nitro lane.** A diagonal line of 4 Nitro hugging one edge, 2–3 crate widths apart, followed by a pit within ~10 m, forces a committed lane at speed. Keep collectibles away from it; any board touch kills.
5. **Bonus bank with a support-order bridge.** Mirror B-d: a top row of 6 crates floating one crate above a row of 4 multi-hit crates that bridge a 4–5 m gap. On foot it is a stomp chain (14 m/s bounce ≈ 3 m) where the last top crate is the launch; on the board the lower row is a one-way grind bridge that is consumed as ridden, so place the exit ledge so a perfect grind exit still lands — or the player loses the far side.
6. **TNT sandwich off the skate line.** A TNT/life/TNT column (3-high, top 3.46 m: double-jump height) placed beside, not on, the board line; a board contact at ≥ 13 m/s with TNT kills, so it must be an on-foot precision prize.

## Open questions / uncertainties
- **Nitro crates and the box gem.** The 4 Nitros are needed to reach 44 (27 main = 23 non-Nitro + 4), yet neither guide tells the player to break them, D2 awards the box gem right after the fence crates, and the stage has no green ! crate. Possibly the pursuing boulder detonates them (which would count), or they are counted on paper only. Not resolved from the sources.
- D2 s15 says three Nitro crates; F2 draws four.
- Type of the first bonus crate (B-a) is not visible in either guide.
- Fence groups 2 and 3: counts are certain (D2 captions), the exact footprint (L-shape vs. stack) is medium confidence.
- The start column height (2) is inferred from drawing proportions and D2 s1; the total would still close only with 3 crates there.
- Pit and mine counts are approximate (drawn as scenery; not every one is captioned).
