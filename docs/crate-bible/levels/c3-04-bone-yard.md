# Crash 3 — Stage 4 Bone Yard  (どたばた ジュラシックぬま)

Sources: F3 p033–p035 (stage map, book pp. 58–63), F3 p040L (bonus challenge, book p. 72),
F3 p102R (time-trial route "スゴイの04", 32 frames), F3 p032 (Jurassic-theme tips and monster list,
book pp. 56–57), F3 p011 (crate legend); P3 p008R–p010L (shots 48–69, incl. bonus, time trial and
Red Gem Path); gamepressure N. Sane Bone Yard page (total and bonus count only, corroboration).

Evidence level:
- **Read directly (F3 icons, zoomed):** every crate bubble except the checkpoint-1 bubble; checkpoint
  counts 11 / 19 / 28 / 58 (59); the bonus header (×14 boxes, ×2 lives) and its side-view diagram;
  time-crate badges (red 1 s, blue 2 s, green 3 s) and the orange "A" badges (crates that become Aku
  crates in Time Trial).
- **Derived:** the final section (C58 → goal) is not labelled; it is the sum of its four bubbles.
  Level total 66 = 58 (C58, Nitro excluded) + 4 + 4 Nitro; it matches gamepressure (66, bonus 14).
- **Blurred / inferred:** the checkpoint-1 bubble sits in the book gutter and is motion-blurred: one
  tall (2-stack) shape, one single crate and the C crate are visible; the count (3 crates + C) is forced
  by the "11" label, the crate types are unreadable (`wood?` below). Chase/free boundaries are
  inferred from which F3 time-trial frames show the triceratops and from Prima captions.
- **Unidentified map icons (not crates):** small dark "pedestal with raised arms" icons on the strip
  before C28, a red spiky figure on the diagonal before C58, red discs on the gem course.

## At a glance

| Field | Value |
|---|---|
| Theme | Jurassic swamp forest: tar, lava/magma pools and flame jets, clinging tall grass (まとわり草), fallen logs |
| Camera axis | **Mixed.** Chase 1 (start → C19) and chase 2 (C58 → goal) run **toward the camera** with a triceratops behind; the middle (C19 → C58) runs **into the screen** at walking pace; bonus is a side view |
| Total boxes | **66** (derived from F3 checkpoint labels + last section; gamepressure: 66) |
| Boxes per route | main **52** (48 + 4 Nitro) · bonus **14** · red-gem (secret) course **0** · death route none |
| Checkpoints | 4 counted C crates (C1 "11", C19 "19", C28 "28", C58 "58 (59)") + 2 steel C-blocks on the gem course (uncounted) |
| 1UP | 1 crate (bonus, on the steel platform); bonus header promises ×2 lives |
| Aku | 1 crate (floating, right after C19); in Time Trial three crates become Aku crates (S1-b, S3-a, S3-e) |
| TNT / Nitro | 3 TNT (all in S3) / 4 Nitro (1 beside C28, 3 in chase 2) |
| ! / outline | 1 steel ! (floating) + 5 outline crates (S4); 1 green ! at the very end (S5) |
| Iron-bound / arrows | 0 iron-bound; 1 wooden arrow (bonus); steel-crate platform in the bonus (uncounted) |
| Striped / slot | 9 striped (7 main, 2 bonus) / 2 slot (S1, S2) |
| ? / wood | 12 ? (6 main, 6 bonus) / 21 wood (17 main, 4 bonus) + 3 `wood?` (CP1 bubble, type unreadable) |
| Gems | Clear gem: all 66 boxes (green ! must be pressed before the goal — it appears in front of you, Prima 59). Secret gem (ひみつダイヤ): finish the **red-gem course**, which needs the red gem from stage 12 Deep Trouble |
| Enemies | Triceratops chaser (ドタバタトプス, invincible, smashes boxes); pterodactyls (バサバサプテラ, touch = carried off) |
| Hazards | lava/magma pools and flame jets (left/right alternation, Prima 50), tar, clinging grass (slows you in a chase), logs, steps down, TNT, Nitro |
| Time trial | 7 time crates = 12 s (3+1+2+2+1+1+2); 3 TT Aku crates; staff best 1:14:60 (F3 p102R); relic targets printed in the header: sapphire 1:47:00, gold 1:40:20 |
| Difficulty notes | F3: the first chase stage of Crash 3 (the triceratops replaces Crash 2's polar bear; being caught is death). Perfect run is easier once the speed shoes are owned |

Composition keys used in the JSON: standard keys, plus `wood?` = a counted crate whose type cannot be
read (blurred icon); `uncounted` lists steel/switch objects that are not part of the box total;
`ttBadges` gives each cluster's time-trial badges ({"1": n} seconds, {"A": 1} = Aku in Time Trial).

## Route skeleton

```
START (cave mouth)                                            ▼ = toward camera, ▲ = into screen
 │ ▼ CHASE 1 — triceratops behind ────────────────────────────────────────────────
 │ S1  wood, trio (chase trigger), log + striped, wood+slot, CP bubble ......... 11  (C1)
 │ S2  wood+striped+slot, pterodactyls over tar, 2×2 block ..................... 19  (C19)
 │ ── chase ends at C19 ──
 │ ▲ FREE SECTION (walking pace)
 │ S3  floating Aku, TNT, TNT 2-stack, 3-stack, wood ........................... 28  (C28)
 │       └─ red-gem branch at the log just before C28 ─► RED-GEM COURSE (0 boxes,
 │          2 steel C-blocks, own goal + secret gem; does not rejoin)
 │ S4  ?+Nitro+2 striped, BONUS LIFT ─► B (14) ─► back, power stone, ! + 5 outlines,
 │     3-wood line, 3-stack + wood at a drop ........................... 58 (59 with Nitro)  (C58)
 │ ▼ CHASE 2 — triceratops again
 │ S5  ?, striped in grass, 3 Nitro along the right edge, green ! + 2 striped .... 62 (66)
GOAL
```

| Section | Mode | Boxes (non-Nitro / Nitro) | Cumulative (F3) |
|---|---|---|---|
| S1 start → C1 | chase | 11 / 0 | 11 |
| S2 C1 → C19 | chase | 8 / 0 | 19 |
| S3 C19 → C28 | free | 9 / 0 | 28 |
| S4 C28 → C58 (main) | free | 16 / 1 | — |
| B bonus (from S4) | side view | 14 / 0 | 58 (59) with S4 |
| S5 C58 → goal | chase | 4 / 3 | derived 62 (66) |
| G red-gem course | chase | 0 / 0 | — |

## Section-by-section map

Legend: W wood · ? question · A Aku · L life · S striped · ↑ wooden arrow · T TNT · N Nitro ·
! steel switch · G! green switch · o outline · $ slot · C checkpoint · x unknown type ·
superscript ¹²³ = time-crate value in Time Trial · `*` = becomes an Aku crate in Time Trial ·
`A/B` = A stacked on B (top first).

### S1 — Start → C1  (cumulative 11)

```
 route runs TOWARD the camera: top = far = start; the triceratops comes out of the cave behind you
 ┌ cave mouth ───────────────────────────────┐
 │ START   (TT: bazooka the stopwatch on an upper ledge)
 │   W                                         S1-a
 │   W    W*                                   S1-b (two in front,
 │          W                                       one back-right)
 └───────────────────────────────────────────┘  ← triceratops bursts out
 ══════ fallen log (jump) ══════
    S³                                          S1-c  sits at the landing
    W¹  $                                       S1-d
    ~ steps down (TT 05: a crate waits at the foot of a drop) ~
    x/x   x     C                               S1-e + S1-f (blurred bubble)
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S1-a | first crate, just past the start | W×1 | single | walk, spin | ON-PATH SINGLE | a free first hit before anything is at stake; it pulls the player forward into the cave mouth where the trio waits | F3 p033R zoom | medium |
| S1-b | cave mouth: two crates in front, one back-right | W×3 (one is a TT Aku) | loose trio | walk, spin | ON-PATH CHASE TEACH TIME-TRIAL | the chase trigger: the player stops to smash three crates and the triceratops breaks out of the cave behind him (Prima 49), so the first chase starts while the player is "looking down". In TT one of them is the first Aku crate, spun the instant the clock starts (F3 TT 02) | F3 p033R "A" bubble zoom; P3 p008R shot 49; F3 p102R 01–02 | high |
| S1-c | right after the first fallen log | S×1 (TT 3 s) | single | spin (one hit) or leave to the dino | ON-PATH SINGLE CHASE TIME-TRIAL | placed where the player lands after jumping the log, so a sloppy jump runs into it; F3 mask hint 1 says to spin crates that block the line. A striped crate's extra fruit is a temptation the chase forbids | F3 p033R zoom (green 3 badge), mask hint 1 | high |
| S1-d | next on the line | W×1 (TT 1 s) + $×1 | pair | spin | ON-PATH PAIR CHASE TIMED TIME-TRIAL | a slot crate cycles its face and turns to steel if not broken quickly: in a chase there is no time to wait for a good face — a deliberate "you can't have everything" crate | F3 p033R zoom | high |
| S1-e | beside the C1 crate | x×3 (`wood?`: a 2-stack + a single) | 2-stack + single | spin | ON-PATH CHASE STACK | crates next to the checkpoint reward a player who has built a lead; Prima calls this area a brief rest | F3 p033 gutter (blurred), forced by label 11 | low (types), medium (count) |
| S1-f | on the chase path | C | single | spin/jump | CHECKPOINT CHASE | a checkpoint inside the chase so a death late in chase 1 does not restart the whole run | F3 p033 gutter "11コ"; P3 p008R shot 51 | high |

Rhythm: S1 is a corridor of singles and pairs, every one on or beside the racing line, separated by
a log and steps down. Nothing is explosive. The crates work as **snags**: they sit at landings
(after the log, at the foot of a drop — F3 TT 05 "after landing, don't catch on the boxes"), and the
guide's rule for the whole level is that a missed crate is smashed by the triceratops and still
counts (F3 p032L tip 2; Prima 52 "let the Triceratops stomp 'em... you still get credit").

### S2 — C1 → C19  (cumulative 19)

```
    W   S   $                                   S2-a (entering the lower curve, p033L)
    e:pterodactyl ×2 over a tar stretch   ~lava patch~
    W ?                                         S2-b  2×2 block (top row W ?,
    ? W                                               bottom row ? W)
    ── path curves left ──
    C                                           S2-c  C19 — chase 1 ends here
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S2-a | entering the second strip (top-right of p033L) | W×1, S×1, $×1 | loose group | spin | ON-PATH CHASE TIMED | repeats S1's vocabulary (plain, striped, slot) now under pterodactyl attack; TT 06 says to sidestep both the pterodactyls and the crates | F3 p033L route crop | medium |
| S2-b | on sand/grass after the tar stretch | W×2, ?×2 | 2×2 block (2 wide, 2 high) | spin bottom row, jump on top | ON-PATH GRID STACK CHASE | the only multi-row structure in chase 1: it cannot be cleared by one spin and is hard to jump toward the camera, so it is the chase's one "stop or skip" decision; its two ? are the chase's best fruit, and the dino credits it if skipped | F3 p033L zoom (combo2) | high |
| S2-c | left end of the curve | C | single | walk | CHECKPOINT | marks the end of chase 1 and is the respawn for the explosive free section | F3 p033L "19コ"; P3 p009L shot 53 | high |

### S3 — C19 → C28  (cumulative 28) — free section, into the screen

```
   C19 ─► A* (floating over its shadow disc)    S3-a
              T                                 S3-b
              T/T                               S3-c  2-stack
              W²/?/W                            S3-d  3-stack (top→bottom)
              W*                                S3-e
   strip: ~lava~ ══log══ "grass" "fire-jet?" ~lava~ ══log══ ← red-gem branch (P.63)
              C                                 S3-f  C28
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S3-a | immediately after C19 | A×1 | floating single (shadow drawn) | jump | AKU HIGH ON-PATH TIME-TRIAL | the main course's only Aku crate, floating so it must be taken on purpose, and placed right before the three TNTs and the lava/grass stretch. TT 11: small-jump over the near box, then small-jump again to break the Aku | F3 p033L zoom; P3 p009L shot 53; F3 p102R 11 | high |
| S3-b | next | T×1 | single on open ground | stomp then run | ON-PATH SINGLE TEACH EXPLOSIVE-MIX | first TNT of the stage, alone and with room to escape: F3 mask hint 2 — never slide or spin TNT; stomp it and get clear within 3 s | F3 p033L zoom; mask hint 2 | high |
| S3-c | next | T×2 | 2-stack | stomp the top, escape (the blast chains to the lower one) | ON-PATH STACK TEST CHAIN | the same mechanic doubled; TT 12 instead long-jumps over it (slide, then jump) | F3 p033L zoom; F3 p102R 12 | high |
| S3-d | next | W×2, ?×1 (top W is TT 2 s) | 3-stack W/?/W | spin the base (top drops) or jump-spin the top | ON-PATH STACK TIME-TRIAL | first tall stack, right after the TNTs, rewarding the player with a ? once the explosives are handled; F3 TA2: in TT jump-spin time boxes that sit on top of boxes while moving forward | F3 p033L zoom (blue 2 on top); F3 p102R 13–14 | high |
| S3-e | near the gutter, before the next strip | W×1 (TT Aku) | single | spin | ON-PATH SINGLE TIME-TRIAL | ordinary crate in normal play; in TT it is the third Aku, giving invincibility for exactly the grass/magma stretch that follows (TT 13–20) | F3 p033L zoom ("A" badge); F3 p102R 13–14 | high |
| S3-f | top of the strip, after the last log | C | single | walk | CHECKPOINT ROUTE-SPLIT | checkpoint right after the red-gem branch point (the branch leader points at the log just before it) | F3 p033R "28コ" | high |

Rhythm: the free section front-loads safety (checkpoint, then Aku) and then teaches TNT in two steps.
The strip after S3-e has no crates at all: lava patches, logs and grass tufts are the content, and
the red-gem course leaves from its last log.

### S4 — C28 → C58  (cumulative 58; 59 with Nitro) — free section, includes the bonus

```
   C28  ?²  N  S/S                              S4-a (same bubble as the C crate)
   ─► bonus lift (P.72) ─► B (14) ─► back
   power stone (near the flowing lava)
   !  (steel, floating over its shadow)         S4-b + o o o o o (5 floating outlines)
   ── turn; diagonal run toward the camera ──
   W   W   W¹   (diagonal line, right side)     S4-c
   W¹/W/?   W          (at a step down)         S4-d, S4-e
   C                                            S4-f  C58 "58 (59)"
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S4-a | beside the C28 crate | ?×1 (TT 2 s), S×2, N×1 | ? beside a Nitro; two striped one above the other | spin carefully / stomp | ON-PATH EXPLOSIVE-MIX TIME-TRIAL | first Nitro of the stage, sitting among ordinary crates right after a checkpoint: F3 mask hint 3 — the slightest touch sets it off, so spin carefully. Prima 64: in TT the 2-s box "lies half-buried near the Nitro" | F3 p033R zoom; P3 p009R shot 64 | high (types), medium (striped stacking) |
| S4-b | lava-river area after the bonus lift and the power stone | o×5; uncounted: steel ! | ! floating over its shadow; 5 outlines floating as a loose cluster | jump into the ! from below, then collect the materialised crates | SWITCH OUTLINE HIGH DETOUR | a switch puzzle staged over the lava: hit the floating ! and five crates appear in the air (Prima 56; Prima suggests a body slam for extra height when they are out of reach). TT 21/TA3: the ! spawns no time boxes, ignore it | F3 p034R zoom; P3 p009L shot 56; F3 p102R 21 | high |
| S4-c | on the diagonal, right side | W×3 (last is TT 1 s) | loose diagonal line | spin while passing | ON-PATH ROW TIME-TRIAL | a pacing line that steers the player to the right lane; TT 22: keep right and don't forget the 1-s box on the right | F3 p034R zoom; F3 p102R 22 | high |
| S4-d | at a step down | W×2, ?×1 (top is TT 1 s) | 3-stack W/W/? | spin the base / jump-spin the top | ON-PATH STACK TIME-TRIAL | a stack at the landing of a drop, the second "landing snag"; TT 23: drop from the middle so you don't catch on the boxes | F3 p034R zoom; F3 p102R 23 | high |
| S4-e | beside S4-d | W×1 | single | spin | ON-PATH SINGLE | fills the landing so a sideways drop also meets a crate | F3 p034R zoom | high |
| S4-f | same bubble | C | single | walk | CHECKPOINT CHASE | the respawn point immediately before chase 2 (the dino is back within ~2 s in the TT frames) | F3 p034R "58コ (59コ)"; F3 p102R 23–24 | high |

The bonus lift (Prima 55, a stump platform with a ? icon) is on the free section's upper run;
F3 sends the bonus to book p. 72 "from p. 61". The 14 bonus boxes are inside the 58.

### S5 — C58 → Goal  (derived: 62; 66 with Nitro) — chase 2

```
 chase 2: triceratops behind again (toward the camera)
   e:pterodactyl ×2 on ledges   ~lava~
   ?²                                           S5-a
   "grass" S "grass"                            S5-b  stepping box over まとわり草
   e:pterodactyl (ledge)   ~lava~
                         N
                      N                         S5-c  along the right edge
                   N
   "grass"   ~magma~
   G!   S   S                                   S5-d
   GOAL  (TT: press up while falling → enter the time gate without landing)
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S5-a | on the diagonal after the pterodactyls | ?×1 (TT 2 s) | single | spin | ON-PATH SINGLE CHASE TIME-TRIAL | a lone fruit crate inside the chase; Prima 65: the TT 2-s box here is easy only with a big lead on the dinosaur | F3 p034R zoom; P3 p009R shot 65 | high |
| S5-b | inside a patch of clinging grass | S×1 | single | double jump onto it, or go round on the right | ON-PATH TOOL STEPPING CHASE TIME-TRIAL | a crate used as an island: the grass grabs Crash and costs lots of time (F3 TA4), standing on the crate skips it | F3 p034R zoom (TA4 bubble) | high |
| S5-c | right edge, diagonal line | N×3 | loose diagonal line along the edge | avoid; detonated by S5-d | CHASE EXPLOSIVE-MIX COUNT-TRAP | Nitros narrow the chase lane to the left half; F3 mask hint 4: go left here, then jump the magma so as to avoid the grass. They only count via the green ! | F3 p034L zoom; mask hint 4 | high |
| S5-d | last crates before the goal | S×2; uncounted: green ! | ! and two striped spread on the path | spin the ! while running | NITRO-SWITCH ON-PATH CHASE COUNT-TRAP | the stage's final count check placed inside the chase: F3 mask hint 5 — for a perfect you must have shaken off the triceratops by here, otherwise there is no time to hit the green ! and collect the gem; Prima 59: spin it and the gem appears in front of you | F3 p034L zoom; mask hint 5; P3 p009R shot 59 | high |

Chase 2 has the fewest collectible crates of any section (4) but the most dangerous ones (3 Nitro)
and the hardest count requirement (the green ! with a lead).

### B — Bonus challenge  (14 boxes, ×2 lives) — side view, entered from S4

```
                                      ↑
                                      W
           S  (floating ~4 crates up) ?                  L  ?
                                      W               ▓▓▓▓▓▓▓▓  steel-crate platform
                         W            ?
                         ?         ▁▁▁▁ (top step)               W
  stump ▁▁▁▁▁▁▁S▁▁▁      ?     ▁▁▁▁                             ?
               B-a     ▁▁▁▁▁  ▁▁▁▁                  ▁▁▁▁▁▁▁▁   ▁▁▁▁▁   exit stump
                       B-b    B-c (5-stack)         B-d        B-e
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| B-a | first ledge | S×2 | one striped on the ground, one floating about four crate-heights above it | bounce on the lower to reach the upper | SANDWICH COLUMN-BOUNCE TEACH | the striped crate as a high-bounce footing: each stomp pays fruit and lifts you toward the floating twin | F3 p040L diagram | high |
| B-b | lower ledge | W×1, ?×2 | 3-stack W/?/? | spin the base, jump | STACK | easy fruit stack | F3 p040L | high |
| B-c | top of three rising steps | ↑×1, W×2, ?×2 | 5-stack ↑/W/?/W/? | remove lower crates until the arrow rests on one crate, then bounce | STACK TOOL SUPPORT-ORDER | the tool is on top of the stack you must dismantle: Prima 61 — spin the lower crates until the arrow box sits on a single crate; F3 hint — holding jump on an arrow box bounces higher | F3 p040L; P3 p009R shots 61–62 | high |
| B-d | raised steel platform | L×1, ?×1 | pair on steel | arrow bounce from B-c | HIGH REWARD LIFE | the payoff for solving B-c; unreachable without the arrow | F3 p040L; P3 p009R shot 62 | high |
| B-e | last ledge | W×1, ?×1 | wood just above a ? | spin/jump | STACK SANDWICH | a last easy pair before the exit | F3 p040L | medium (drawn with a small gap) |

### G — Red-gem course  (0 boxes) — secret route, chase

Entered at the log just before C28 by standing on the red-gem pad (needs the red gem from stage 12,
which also brings the super double jump). A long toward-camera chase through lava, clinging grass and
water currents that speed Crash up (Prima 69), with pterodactyls on ledges and two **steel C-blocks**
(uncounted). It ends at its own goal with the secret gem; it does not rejoin the main course.
F3 hint A: come back after learning the tornado spin; hint B: go right or jump-spin the pterodactyl;
hint C: ride the water current for speed. No crate bubbles anywhere on F3 p035.

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1, S2, S5, G | triceratops (chaser) | appears from the cave after S1-b; again at C58 | smashes every crate it reaches; missed crates still count (F3 p032L, Prima 52/57); Aku crates must be broken by Crash himself (F3 p032L) |
| S2 | pterodactyls ×2 | over the tar stretch | crates (S2-a) and birds share the lane; dodge both by moving left/right (TT 06) |
| S4, S5 | pterodactyls ×3 | perched on ledges along the diagonal | no crate link; touch = carried off |
| S1–S5 | lava/magma pools and flame jets | alternate left/right in chases (Prima 50) | S5-c Nitros sit on the right while the safe line is left |
| S2 | tar stretch | before S2-b | slows the approach to the 2×2 block |
| S5, G | clinging grass | chase lanes | S5-b crate is the island above it |
| S1 | fallen logs, steps down | chase 1 | S1-c and the TT-05 crate sit on the landings |
| S3, S4 | TNT ×3, Nitro ×1 | free section | taught singly, then stacked, then mixed |

## Puzzle rooms and dependency chains

**P1 — Arrow on a tower (bonus B-c → B-d).** Setup: a 5-stack with a wooden arrow on top; the
reward (1UP + ?) sits on a steel platform above the next ledge. Correct: break the lower crates from
the side until the arrow rests on one crate, jump on it, hold jump, land on the steel. Tempting wrong:
bouncing on the arrow while it is still high (it is not reachable) or destroying the arrow itself
(spin into it) — the platform then has no access. Loss: 2 boxes and a life for this attempt.
Why it works: it turns the gravity rule of stacks into a tool lesson in a risk-free room.

**P2 — Green ! at the end of chase 2 (S5-d).** Setup: three Nitros line the right edge of the final
chase, the green ! is the last object before the goal. Correct: survive chase 2 with a lead, spin the
! on the way past. Wrong: arriving with the dino on your heels — you can only run. Loss: the 4 Nitros
of the stage (all-box gem), not the clear. Why it works: the only real count trap of a chase level is
made a speed requirement, not a precision one.

**P3 — TNT ladder (S3-a → S3-b → S3-c).** Setup: floating Aku, TNT single, TNT 2-stack. Correct:
take the Aku, stomp TNT and back off, stomp the top of the stack and back off. Wrong: sliding or
spinning the TNT (instant blast). Loss: a life (the Aku absorbs one mistake). Why it works: the
mask is placed exactly where the stage first asks for explosive handling.

**P4 — Floating switch over lava (S4-b).** Setup: a steel ! floating above its shadow and five
outlines. Correct: jump into the ! from below, then collect the materialised crates. Wrong: skipping
it. Loss: 5 boxes (all-box only). In TT the switch is pure waste (TA3).

**Chain rule of the level (count logic).** Crates skipped in a chase are smashed by the triceratops
and credited, except that the Aku crate must be broken by Crash to get the mask. So the all-box goal
never demands a risky stop inside a chase; the free section and the bonus carry the precision work.

## Design logic of this level

1. **Two-speed density curve.** Chase 1 holds 17 crates + 2 checkpoints and zero explosives; the free
   section holds 23 crates (incl. all 3 TNT) + C28/C58 + 1 Nitro, with the only Aku and the ! group,
   plus the 14-crate bonus; chase 2 holds only 4 crates but 3 Nitros. Risk moves out of the chase
   and into the walking section, then comes back as lane hazards in the last chase.
2. **Chase crates are snags, not rewards.** They sit at landings — after the log (S1-c), at the foot
   of drops (TT 05, S4-d) — so a careless jump runs into them. The guide's advice is spin through or
   ignore; nothing in a chase is behind a wall or on an edge.
3. **The chaser cleans up.** Because missed crates are credited, the designers can scatter crates on
   the racing line without making the all-box goal a death trap. The Aku is the exception (must be
   broken by hand), which is why the main Aku sits in the free section, not in a chase.
4. **Crates trigger the chase.** The start trio (S1-b) is placed so the player stops to smash it and
   the dinosaur bursts out behind him (Prima 49) — crates as a pacing device for a scripted beat.
5. **Checkpoints mark mode changes.** C1 is a breather inside chase 1; C19 ends chase 1 and is
   followed immediately by the Aku; C28 follows the explosives and the gem branch; C58 sits at the
   drop where chase 2 begins.
6. **Explosive teaching order:** TNT single → TNT 2-stack → Nitro inside an ordinary group (S4-a) →
   Nitros as lane blockers in a chase (S5-c) → green ! at the exit (S5-d).
7. **Mask before hazard.** The floating Aku (S3-a) comes right before the TNTs and the lava/grass
   strip; it floats, so collecting it is a deliberate act.
8. **Time-trial overlay re-uses crate positions as power-up timing.** Three ordinary positions
   (S1-b, S3-a, S3-e) become Aku crates in TT so a clean run is invincible for precisely the
   grass/magma stretch after S3 (TT 13–20); seven time crates (12 s) sit mostly on stack tops and at
   the right lane, steering the TT line.
9. **Secret route without crates.** The red-gem course carries no boxes, so the secret gem is a pure
   speed/route reward and the all-box total is independent of it.
10. **Sparse structures.** Only six multi-crate structures on the main course (the blurred 2-stack
    at C1, the 2×2, the TNT 2-stack, two 3-stacks, the C28 striped pair); the rest are singles and
    pairs — consistent with a level in which half the length is spent running from something.
11. **Bonus as a support-order lesson.** The bonus room's centrepiece puts the tool (arrow) on top of
    the stack that hides it, with the reward unreachable otherwise.

## Transfer to the skate game

1. **Chase "skate tax".** In a toward-camera skate chase (rider ≈ 18–23 m/s), put single crates on the
   racing line every 30–40 m (≈ 1.5–2 s). Plowing at ≥ 13 m/s costs ~20 % speed each, so three
   smashes in a row drop 20 m/s to ~10 m/s, below smash speed — the fourth crate trips the rider.
   If we add a chaser, let it destroy and credit skipped crates (Bone Yard rule) so the all-box goal
   never forces a chase death.
2. **Island over slow ground (S5-b).** Lay a 3-crate row (3.5 m long, top 1.15 m) across a slow-surface
   patch: a full-charge ollie (1.7 m) reaches the row, the grind consumes all three (contents awarded)
   and carries speed over the patch. On foot a double jump onto a single crate does the same.
3. **Lane-side Nitro line (S5-c).** Three Nitros in a diagonal along one edge of a ~6 m chase lane,
   one crate apart: at 20 m/s the rider has about 1 s to commit to the other half. Never on the
   racing line (touch = death); credit them with a green ! at the chase exit.
4. **Green ! as the chase finale (S5-d).** Put the `nitrobang` 2–3 s before the chase ends, on the
   racing line, so a slide or a grind-through flips it without stopping; the all-box run then needs a
   lead, not a stop.
5. **Mask, then TNT ladder, in the slow part (S3).** After the chase, place a mask crate floating one
   crate above the path (tap jump 1.1–1.3 m reaches it), then TNT single, then a TNT 2-stack (top
   2.3 m). On the board 3–12 m/s only lights the fuse while ≥ 13 m/s kills, so keep the ladder in a
   flat, post-checkpoint section, never after a downhill.
6. **Arrow-on-tower bonus (B-c).** A 5-stack with a wooden arrow on top (top 5.76 m, unreachable).
   Breaking the four crates below lets the arrow settle to one crate up (top 2.3 m, plain jump), then
   the arrow (3.9 m, held 6.1 m) reaches a steel ledge ~5 m up holding a life and a ? crate. Arrow
   crates are blast-immune, so a careless TNT can't destroy the tool.
7. **Landing snags.** Put one crate on the landing spot of each drop or log jump in a fast section:
   on foot it teaches "spin on landing"; on the board it is a choice between a charged plow and a
   sidestep.

## Geometry, obstacles and enemies

Sources for this block: F3 p033–p035 maps (strip 1 and strip 2 on p033R, the p033L route, the p034R upper path and C58 drop, the p034L chase-2 end, the p035 gem course, all at native resolution); F3 p032L–R (book pp.56–57: Jurassic tips — clinging grass, missed boxes broken by the triceratops, box snags — and the monster list: triceratops ドタバタトプス, pterodactyl バサバサプテラ, wave lab assistant ウェーブ研究員); F3 p040L (bonus side view and hint); F3 p102R (time-trial frames 05–28 and captions 01–29); P3 p008R s48–s52, p009L s53–s58, p009R s59–s65, p010L s66–s69, p010R s70. Unit u = one crate. The F3 paths are stylised (≈3–4 crate icons wide): widths come from P3 and TT screenshots where a crate is in frame, otherwise from the map, and are ranges. The "why" column is design inference.

### Camera and route shape
- **Toward-camera chase (S1–S2)**: start → C19, Crash runs down a ≈3–5 u corridor toward the camera with the triceratops behind (P3: "backward" areas).
- **Into-screen free section (S3–S4)**: C19 → C58 at walking pace; the route turns back at the C19 curve and runs into the screen along a flat band and strip 2. The lava-river area around the floating ! is seen from the side (P3 s56, TT 21). The upper path turns at its right end and descends a diagonal toward the camera.
- **Toward-camera chase (S5)**: a one-way step-down above C58 (the triceratops is drawn at its foot) starts chase 2, which runs to the goal.
- Bonus: side view on ledges. Red-gem course: a narrower toward-camera chase strip with water currents, entered from a pad beside the log before C28; it ends at its own goal.

### Platforms and gaps (section by section; table per section)

**S1 — start → C1 (chase 1)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | wide floor: cave mouth at the start, yellow dirt path between root and rock walls (walled) | ≈4–5 wide (P3 s49: three crates fill about half of it) | 0 | walk, spin | — | REST | The only calm ground before the chase: breaking the trio here releases the triceratops from the cave behind you (P3 s49), so the player starts the chase while looking down at crates | P3 p008R s49; F3 p033R strip 1 (stopwatch on a raised ledge; triceratops drawn at the mouth) · high |
| P-S1-b | S1, S2 | corridor: chase path running toward the camera between wavy rock and bark walls (walled) | ≈3–5 wide (P3 s51 ≈3–4; TT 05 ≈3); map ≈3 crate icons | 0, with step-downs | run toward the camera | — | — | A narrow lane where every hazard is met head-on and nothing can be revisited; the wumpa trail points the way (P3 s50) | P3 p008R s50–s52; F3 p033R strip 1; F3 p102R fr.05 · medium |
| G-S1-a | S1 | hurdle: fallen log across the full path (not lethal) | log ≈1 thick across the full width; landing path with the striped crate S1-c at the landing; run-up cave-mouth run-up (several u) | 0 (clear a log ≈1 high; not measured) | plain | chaser (triceratops) behind / snag = the triceratops catches you (death) | TEACH | The first chase obstacle spans the width, so it must be jumped; the striped crate waits at the landing, so a sloppy jump runs into a snag. Nearby: S1-c, E-S1-a. | F3 p033R strip 1; F3 p032L tip 2 · medium |
| G-S1-b | S1 | lava patches on alternating edges of the chase path (left, right, left) (lethal) | ≈1–2 across (a third to half of the path) × ≈1–2 along; landing the open side of the path; run-up continuous run | 0 | walk + plain — steer to the open side; hop if late | chaser behind; flame geyser at the edge (P3 s50) / death unless protected (TT 19–20) | RHYTHM | P3 s50: without guiding fruit, an obstacle on the left usually follows one on the right — the chase is a slalom, never a full-width block in chase 1. Crates S1-c and S1-d sit beside two of the patches. Nearby: S1-c, S1-d, O-S1-b. | F3 p033R strip 1; P3 p008R s50 · medium |
| G-S1-c | S1 | drop-down: raised slab ending in a step down across the path, with grass patches and the CP1 crates below (not lethal) | full width; landing tan ground with clinging-grass patches and the CP1 crates (landing snags); run-up chase run | ≈−1 (not measured) | drop | chaser behind / caught by the triceratops if you snag on landing (death) | — | TT 05: at a step, don’t jump — just drop, and don’t snag on the boxes after landing. A crate stands at the foot of the drop. Nearby: S1-e, S1-f. | F3 p033R strip 1; F3 p102R fr./cap. 05 · medium |
| P-S1-c | S1 | corridor: checkpoint stretch (C1) (walled) | ≈3–4 wide (P3 s51) | 0 | run | — | CHECKPOINT-PAD, REST | P3 s51: rest briefly in these areas; the respawn sits inside the chase so a late death does not replay the whole run | P3 p008R s51; F3 p033 gutter (CP1 bubble) · medium |

**S2 — C1 → C19 (chase 1)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-S2-a | S2 | lava patch at one edge of a grey stretch (lethal) | ≈1–2 across; landing the open side; run-up chase run | 0 | walk + plain | two perched pterodactyls just before; chaser behind / death unless protected (TT 19–20) | — | A single edge patch after the bird ambush. Nearby: E-S2-a. | F3 p033L route · medium |
| G-S2-b | S2 | drop-down: raised tan block ending in a step across the path, the 2×2 block below (not lethal) | full width; landing tan ground with the 2×2 block S2-b on it (landing snag); run-up chase run | ≈−1 (not measured) | drop | chaser behind / caught by the triceratops if you snag on the block (death) | — | The only multi-row crate structure of chase 1 stands at the foot of a drop (TT 10 shows it right below the raised step): stop and break it, or steer past while the dinosaur credits it. Nearby: S2-b. | F3 p033L route; F3 p102R fr.10 · medium |
| P-S2-a | S2 | wide floor: long darker grey stretch (unlabelled) (walled) | path width × several screens | 0 | run | — | — | A plain run between the 2×2 and the curve to C19 | F3 p033L route · low |
| P-S2-b | S2 | wide floor: curve to the left ending at C19 on a tan band with grass edges (grass edges) | band ≈4–5 wide | 0 | walk | — | CHECKPOINT-PAD | The chase ends at the curve; the route turns back along the band into the screen, so the checkpoint marks the change of camera and pace | F3 p033L route; P3 p009L s53 · medium |

**S3 — C19 → C28 (free)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S3-a | S3 | wide floor: flat dirt band (into the screen) holding the floating Aku, the TNT single, the TNT 2-stack and the 3-stack (grass edges) | ≈4–5 wide (P3 s53) | 0 | walk, stomp, back off | — | ARENA, TEACH | Open ground with room to back away from a lit TNT: the explosive ladder is taught where escape is easy. TT 12 shows a tall flame pillar behind the TNT 2-stack, so the open side is in front | P3 p009L s53; F3 p033L route; F3 p102R fr./cap. 11–14 · medium |
| P-S3-b | S3 | corridor: strip 2 (into the screen) with lava patches, grass clumps, two fallen logs and two wave-assistant puddles (walled) | ≈3–4 wide (map) | 0 | walk, jump | — | — | A free-walking gauntlet of every obstacle type with no crates on it: the strip itself is the content (first-wave reading) | F3 p033R strip 2 · medium |
| G-S3-a | S3 | hurdle: fallen log lying diagonally across the path beside a lava patch (not lethal) | log ≈1 thick across the path; landing path beside a lava patch; run-up ≈3–5 | 0 (clear a log ≈1 high; not measured) | plain | lava patch at its side / blocked (no death); a stray jump can land in the lava beside it | — | The diagonal log pushes the jump toward the lava side. Nearby: E-S3-a. | F3 p033R strip 2 · medium |
| G-S3-b | S3 | lava patches at the edges of strip 2 (lethal) | ≈1–2 across; landing the open side; run-up walking pace | 0 | walk + plain | logs and grass nearby / death unless protected (TT 19–20) | — | At walking pace the same patches that formed the chase slalom are easy: the free section rehearses the vocabulary | F3 p033R strip 2 · medium |
| G-S3-c | S3 | clinging-grass patches (まとわり草) across the path (slows; catches the feet) (not lethal) | ≈2–4 along (the TT frames show the path carpeted); landing path beyond; run-up walking pace | 0 | plain + spin-extended — one jump over it, or spin through (P3: jump and spin) | none here (no chaser) / slowed, no death in the free section | — | F3 tip 1: jump over the grass in one go or mow it with the tornado spin; in the free section it only costs time, so it is learned before chase 2 | F3 p032L tip 1; F3 p033R strip 2; F3 p102R fr.15–16 · medium |
| G-S3-d | S3 | hurdle: second fallen log across the path, with the red-gem pad beside it (not lethal) | log ≈1 thick; landing path to C28; run-up ≈3–5 | 0 (clear a log ≈1 high; not measured) | plain | red-gem pad (secret route) beside it / blocked (no death) | — | The secret route leaves from a log: a landmark the player has already learned to read as "jump here". Nearby: S3-f, P-S3-c. | F3 p033R strip 2 (red-gem leader); P3 p009L s54, p010L s66 · medium |
| P-S3-c | S3 | red-gem pad (faceted disc) on the ground beside log 2 (open) | ≈1 across | 0 | stand on it | — | BONUS-PAD | A route split marked by geometry the player already reads (a log) | P3 p009L s54, p010L s66 · high |
| P-S3-d | S3 | wide floor: C28 floor at the top of strip 2 (Nitro and striped pair beside the checkpoint) (walled) | path width | 0 | walk | — | CHECKPOINT-PAD | The respawn is placed right after the gem branch and right before the first Nitro | F3 p033R (C28 bubble) · medium |

**S4 — C28 → C58 (free)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S4-a | S4 | tree-stump platform (bonus lift) at the path edge (open) | ≈1.5 across | +≈0.5 (not measured) | jump on | — | BONUS-PAD | A raised stump beside lava and a grass strip; a wave assistant stands next to it on F3 | P3 p009L s55, p009R s60; F3 p034R top · high |
| P-S4-b | S4 | wide floor: flowing-lava area — dark ground crossed by bands of flowing lava, with the floating ! and five outlines (open to the lava streams) | not measurable (side-on view in P3 s56 and TT 21) | 0 | jump between bands | — | ARENA | The switch puzzle is staged over lethal ground: hitting the floating ! from below means jumping on footing between lava bands (Prima: body slam for height if the boxes are out of reach) | P3 p009L s56; F3 p034R; F3 p102R fr.21 · medium |
| G-S4-a | S4 | lava stream bands crossing the ground of the flowing-lava area (lethal) | ≈1–2 each (not measured); landing dark ground between bands; run-up walking pace | 0 | plain | floating ! above the area / death unless protected (TT 19–20) | — | Bands, not patches: the first full-width lava in the level is met at walking pace before chase 2 uses it. Nearby: S4-b. | P3 p009L s56; F3 p102R fr.21 · low |
| P-S4-c | S4 | corridor: upper path past the power stone (crystal), turning at its right end and descending a diagonal toward the camera (walled) | path ≈3–4 wide (map) | 0, then down the diagonal | walk | — | — | The turn brings the camera back to a toward-camera view right before chase 2 | F3 p034R top and middle · medium |
| G-S4-b | S4 | drop-down: raised dark ledge ending in a step across the diagonal; the triceratops is drawn at its foot (not lethal) | full width; landing C58 floor with a 3-stack and a single crate (landing snags); run-up diagonal walk | ≈−1 to −2 (not measured) | drop | chase 2 begins at the drop / caught by the triceratops if you snag on landing (death) | — | TT 23: when dropping, fall from the centre so you do not snag on the boxes. The mode change is a one-way drop into the chase, with crates on the landing. Nearby: S4-d, S4-e, S4-f. | F3 p034R middle (triceratops icon at the step); F3 p102R fr./cap. 23–24 · medium |
| P-S4-d | S4 | wide floor: C58 floor at the foot of the drop (walled) | path width | 0 | land, run | — | CHECKPOINT-PAD, LANDING | The respawn of chase 2 is the landing of the drop, among crates; the dinosaur reappears about two seconds after it in the TT frames | F3 p034R (C58 bubble); F3 p102R fr.23–24 · medium |

**S5 — C58 → goal (chase 2)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S5-a | S5 | corridor: chase-2 diagonal running toward the camera, with grass bands, lava patches and pterodactyl perches at its edges (walled) | ≈3–4 wide (map ≈4 crate icons) | 0 | run toward the camera | — | — | The same corridor as chase 1 but with full-width bands and a three-way choke: chase 2 is the test of what the free section taught | F3 p034R–p034L routes; P3 p009L s57–s58 · medium |
| G-S5-a | S5 | lava band across the path (lethal) | ≈1 along (TT frame twenty-five; P3 shots fifty-seven and sixty-five); landing path beyond, often with a crate on it; run-up chase run | 0 | plain | chaser behind / death unless protected (TT 19–20) | — | The first full-width lava in a chase: a small hop is enough, but the crate behind it is a snag. Nearby: S5-a. | F3 p102R fr.25; P3 p009L s57, p009R s65 · medium |
| G-S5-b | S5 | clinging-grass patch across most of the path (slows; caught = death), with the striped crate standing in it and a safe zone on the right (lethal) | ≈3–5 along (a wide grass field in TT frames twenty-six and twenty-seven); landing safe zone on the right (P-S5-b) or the striped crate (P-S5-c); run-up chase run | 0 | plain + double — two small jumps through the right safe zone, or a double jump onto the striped crate | chaser behind / death: the triceratops catches you in the grass (F3 tip 1) | — | TA4: the grass costs a lot of time — go right, or double-jump onto the box. TT 26–27: move right a little early and avoid the grass with two small jumps in the safe zone. The crate is an island over slow ground. Nearby: S5-b, P-S5-b, P-S5-c. | F3 p034R TA4; F3 p102R fr./cap. 26–27; F3 p032L tip 1 · medium |
| P-S5-b | S5 | wide floor: grass-free safe zone along the right side of the grass field (wall on the right) | ≈1–1.5 wide (estimate) | 0 | two small jumps | — | SAFE-ISLAND | A narrow clean lane beside the slow patch: the expert line, readable in advance (TT 26: change to the right line a little before) | F3 p102R cap. 26–27 · medium |
| P-S5-c | S5 | crate-built: the striped crate as a stepping box in the grass (open) | 1 × 1, top ≈1 | +1 | double jump onto it | — | STEPPING | A crate used as footing over slow ground (TA4: double-jump onto the box) | F3 p034R TA4 bubble · high |
| G-S5-c | S5 | big lava patch over the right two thirds of the path, followed by three Nitros along the right edge (lethal) | ≈2–3 across (two thirds of the path); landing the left third of the path (≈1–1.5); run-up chase run | 0 | walk — hold the left third | chaser behind; Nitro line S5-c / death (lava or Nitro) | — | Mask hint 4: pass on the left here. The lane shrinks to one third of the path for several u, the narrowest point of the chases. Nearby: S5-c, O-S5-a. | F3 p034L route + mask hint 4 · medium |
| G-S5-d | S5 | three-way choke: lava on the left edge, lava on the right edge, a clinging-grass clump between them (lethal) | ≈1–2 each (map); landing path beyond the choke; run-up chase run | 0 | plain — small jumps over the magma, left to right | chaser behind / death in the lava; caught in the grass | — | Mask hint 4: jump over the magma so as to avoid the grass; TT 29: small-jumping the magma from left to right is faster than a big jump over the grass. Two wrong answers and one right one, at chase speed. Nearby: S5-d. | F3 p034L route + mask hint 4; F3 p102R cap. 29 · medium |
| G-S5-e | S5 | wide lava patch across the full path (lethal) | ≈2–3 along (TT frame twenty-eight); landing path to the green ! and the goal; run-up chase run | 0 | running | chaser behind / death unless protected (TT 19–20) | — | The widest chase gap comes last, after the lane-narrowing beats. Nearby: S5-d. | F3 p102R fr.28 · low |

**B — bonus, side view (F3 p040L)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | B | wide floor: first bonus deck, holding the striped sandwich (ground striped near its far end, its twin floating above) (open front edge) | ≈7.5 long; floating crate’s underside ≈3.9 above the ledge | 0 | walk, bounce | — | REST | The striped crate is the high-bounce footing that reaches its floating twin | F3 p040L diagram · high |
| G-B-a | B | drop-down: step down to ledge 2 (no gap) (not lethal) | 0; landing ledge 2 (≈4.3) with the 3-stack; run-up ≈7 | −0.5 | drop | none / not a failure (it is the route) | — | A plain step down | F3 p040L · medium |
| P-B-b | B | stairs: three overlapping slabs each ≈0.5 higher, rising from ledge 2 to the top slab (open) | ≈1.5 each | +0.5 ×3 | plain hops | — | STEPPING | A climb to the tool: the 5-stack with the arrow on top stands on the top slab | F3 p040L · medium |
| P-B-c | B | top slab holding the 5-stack ?/W/?/W/arrow (arrow top ≈4.8 above the slab) (open) | ≈2 | +1.5 above ledge 2 | slide the bottom crates, then jump on the arrow | — | STEPPING | The arrow is out of reach until the stack below it is dismantled (F3 hint: slide from a little further away to break only the bottom crate) | F3 p040L diagram + hint · high |
| G-B-b | B | short gap to ledge 4 (not lethal) | ≈0.4–0.5; landing ledge 4 (≈6); run-up top slab | 0 | plain | none / falling ends the bonus (no life lost) | — | A token gap between the tool and the reward | F3 p040L · medium |
| P-B-d | B | wide floor: fourth bonus deck, under the floating steel shelf (open) | ≈6 long | 0 | walk | — | ARENA | The reward block hangs over it, out of reach from its floor | F3 p040L · medium |
| P-B-e | B | steel block (reward shelf) floating above ledge 4, carrying the 1UP and a ? (open) | 3 wide × ≈1.8 tall, notched at its lower left; underside ≈0.7 and top ≈2.5 above ledge 4 | +2.5 | arrow bounce | — | LANDING | Only the arrow bounce reaches its top; the notch and the gap under it show it floats, so it cannot be climbed | F3 p040L diagram; P3 p009R s62 · high |
| G-B-c | B | two short gaps down to ledge 5 (W resting on a ?) and the exit ledge (not lethal) | ≈0.4 and ≈0.9; landing ledge 5 (≈4), exit ledge (≈6); run-up ledge 4 | −1, then −0.5 | plain | none / falling ends the bonus (no life lost) | — | Two easy steps down to the exit stump | F3 p040L · medium |

**G — red-gem course (F3 p035; P3 p010L)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-G-a | G | corridor: narrow diagonal chase strip toward the camera with steel C markers (walled) | narrower than the main chases (map ≈2–3 crate icons) | 0, with steps near the end | run toward the camera | — | — | The secret route squeezes the chase lane and fills it with every hazard; it holds no crates | F3 p035R–p035L; P3 p010L s66–s69 · medium |
| P-G-b | G | water current strips (blue streams) along the strip (open) | stream ≈1 wide × ≈2–3 long (map) | 0 | run in the current | — | — | Hint C / P3 s69: ride the current to speed up and outrun the dinosaur — a speed boost placed inside the chase | F3 p035R hint C; P3 p010L s69 · medium |
| G-G-a | G | lava basins across the strip (lethal) | ≈3–4 along (a curved lava band across the path in P3 shot sixty-eight); landing path beyond; run-up chase run | 0 | double — super double jump | chaser behind / death unless protected (TT 19–20) | — | P3 s68: the super double jump (earned with the red gem in stage 12) clears obstacles like this — the secret route assumes the new move | P3 p010L s68; F3 p035R hint A · medium |
| G-G-b | G | clinging-grass clumps across the strip (slows) (lethal) | ≈1–3; landing path beyond; run-up chase run | 0 | spin-extended + plain | chaser behind / death: caught by the triceratops in the grass | — | Hint A: the course is all magma and clinging grass; come back after learning the tornado spin | F3 p035R hint A; P3 p010L intro · medium |

### Jump sequences

| id | section | count | moves | rhythm | widest gap | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 4 | plain + walk + drop | even (alternating sides) | ≈1–2 | C1 stretch (P3 s51: rest briefly) | yes | Log, lava left, lava right, step down onto grass and crates: one beat per obstacle, sides alternating, with the pursuer forbidding a stop | F3 p033R strip 1; P3 p008R s50–s52; F3 p102R cap. 05 |
| J-S2-a | S2 | 3 | plain + drop | syncopated (bird swoops) | ≈1–2 | C19 (the chase ends) | yes | Pterodactyl swoops are dodged left or right (TT 06), then a lava patch and a drop onto the 2×2 block | F3 p033L route; F3 p102R fr./cap. 06–10 |
| J-S3-a | S3 | 4 | plain + slide-jump + spin | even | — (crate hurdles) | band after the 3-stack | no | TT line: small jump over the near crate, small jump again into the floating Aku, slide then long jump over the TNT 2-stack, small jump-spin into the 3-stack top | F3 p102R cap. 11–14 |
| J-S3-b | S3 | 4 | plain + spin | even | ≈2–4 (grass patch) | C28 | no | Strip 2: log, lava, grass (one jump or a spin), log with the red-gem pad — the chase vocabulary at walking pace | F3 p033R strip 2; F3 p032L tip 1 |
| J-S5-a | S5 | 6 | drop + plain + double | accelerating | ≈2–3 (lava patch) | none until the goal | yes | Drop from the centre at C58, hop the lava band, two small jumps through the right safe zone (or a double jump onto the striped crate), hold the left third past the lava and Nitros, small jumps over the magma left to right, a wide pool, then the green ! | F3 p034R TA4; F3 p034L mask hint 4; F3 p102R cap. 23–29 |
| J-B-a | B | 6 | plain + drop + arrow | even | ≈1 | ledge 4 and the steel shelf | no | Step down, three slab hops, dismantle the stack, arrow bounce onto the steel shelf, two short gaps to the exit: the bonus tests order, not jumping | F3 p040L; P3 p009R s61–s62 |
| J-G-a | G | 5 | double + spin-extended + plain | even | ≈3–4 (lava band) | steel C markers | yes | Estimated from the map: lava pools across the strip need the super double jump while chased, grass the tornado spin; the count is a map estimate | F3 p035R–p035L; P3 p010L s68 |

Chase sequences cannot stop (the pursuer), but each beat is short and the hazards alternate sides; the long, committed jumps are reserved for the secret course, which assumes the super double jump.

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S1-a | S1, S2, S3, S4, S5, G | lava / magma: patches at the path edges, bands across the path, flowing stream bands, basins (lethal) | flank in chase 1 (alternating sides); across path in chase 2, the lava river and the gem course | static (the lava river flows) | go around (steer to the open side), jump over, walk through while masked (TT 19–20) | chaser, clinging grass, Nitro line, crates at landings | AREA-DENIAL, RHYTHM, TEST | Escalates from edge patches you steer round (chase 1) to full-width bands you must hop (lava river, chase 2) to pools that need the super double jump (gem course) | F3 p033–p035 maps; F3 p102R fr.19–20, 25, 28 + cap. 19–20; P3 p008R s50, p009L s56–s58, p010L s68 |
| O-S1-b | S1, S3, S5 | flame geysers at the path edge (and a tall flame pillar behind the TNT 2-stack) (lethal) | flank: at one edge of the path | erupt (cycle not stated); P3 s50: a left obstacle usually follows a right one | go around on the far side, wait for the eruption to end | lava patches, TNT 2-stack (TT 12), grass (P3 s58) | AREA-DENIAL, TIMING-GATE | Side hazards that keep the line in the middle third and alternate sides | P3 p008R s50, p009L s58; F3 p102R fr.12, 18 |
| O-S1-c | S1, S3, G | fallen logs across the path (static blocker) (not lethal) | across path | static | jump over | striped crate at the landing (S1), lava beside a diagonal log (S3), red-gem pad (S3) | RHYTHM, TEACH | The one full-width obstacle of chase 1, then reused as landmarks in the free strip and to mark the secret route | F3 p033R strips 1–2; F3 p035; P3 p009L s54 |
| O-S1-d | S1, S2, S4, S5 | crates as static blockers (snags) at landings and on the chase line (not lethal) | on platform: at the foot of drops and just past logs | static | spin it, jump over, drop from the centre (TT 23), leave it to the triceratops (credited) | step-downs, logs, chaser | TEST, LANE-BLOCK | F3 tip 2: a box on the path snags Crash so he cannot advance. Because the pursuer breaks and credits missed crates, crates can sit on landings as obstacles without making the all-box goal a death trap | F3 p032L tip 2; F3 p102R cap. 04–05, 23; P3 p008R s52 |
| O-S3-a | S1, S3, S5, G | clinging grass (まとわり草) (not lethal) | across path: patches at the S1 step foot, carpets in strip 2, a field in chase 2, the middle of the final choke | static; catches the feet and slows | jump over in one go, tornado spin through, jump and spin (P3), safe zone on the right (TT 26–27) | chaser (caught = death), striped stepping crate, lava on both sides (final choke) | AREA-DENIAL, TEST | Harmless at walking pace, deadly in a chase: it is shown as small patches, rehearsed in the free strip, then tested with the pursuer behind | F3 p032L tip 1; F3 p034R TA4; F3 p102R fr.15–16, 26–27; P3 p008R intro, p009L s58 |
| O-S3-b | S3 | TNT ladder: a TNT, then a TNT 2-stack, on open floor (lethal) | on path, on the flat band | 3-s fuse after a stomp | stomp and back off, slide then long-jump over the 2-stack (TT 12) | floating Aku just before, flame pillar behind the 2-stack | TEACH, TEST | Explosives are taught on the widest flat floor, with a mask placed right before them | F3 p033L route; F3 p102R cap. 12; F3 mask hint 2 (first-wave reading) |
| O-S5-a | S5 | Nitro line: three Nitros along the right edge of the chase lane (lethal) | flank: right edge, after the big lava patch | static | keep left (mask hint 4) | big lava patch, chaser | LANE-BLOCK | Crates as walls: the Nitros and the lava leave one third of the lane at chase speed | F3 p034L route + mask hint 4 |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | triceratops (ドタバタトプス) | pursuer | bursts out of the cave when the start trio is broken and runs behind Crash toward the camera until C19 (through S2); smashes every crate it reaches (credited); cannot be beaten | outrun (avoid) (fails: stopping to spin all the crates (P3 s52); getting caught in clinging grass (F3 tip 1); snagging on a crate after a drop (TT 05)) | behind (pursuer), released at the cave mouth | PURSUER | yes | The chase is triggered by crates, so it begins while the player is looking down | F3 p032R; P3 p008R s49, s52; F3 p033R strip 1 · high |
| E-S2-a | S2 | pterodactyl (バサバサプテラ; two, perched) | flier (perches, then swoops across the path) | perched on wooden perches at the path edge; in the chase they swoop low across the path at head height in front of Crash (TT 06–09: wingspan about the path width) | jump-spin, dodge left or right, double-jump over (P3 s70) (fails: touching one: carried off = death) | flank: perched at the corridor edge, swooping across the line | AMBUSH, HURDLE | no | A flank ambusher that crosses the lane while the chaser removes the option to wait | F3 p032R; F3 p033L route; F3 p102R fr./cap. 06–09 · high |
| E-S3-a | S3 | wave lab assistant (ウェーブ研究員; in a dark puddle) | burrower/ambusher (rises out of a puddle) | approaches with only its head above the surface, then suddenly rears up and covers you | spin when its head comes near, stomp (jump on it), body slam, dash past (TA) (fails: walking into it as it rears up) | on line: puddle in the middle of strip 2, grass either side | AMBUSH | yes | Met alone, at walking pace, in the free section; never in a chase on the map | F3 p032R; F3 p033R strip 2 · medium |
| E-S3-b | S3 | wave lab assistant | burrower/ambusher (rises out of a puddle) | as E-S3-a | spin when its head comes near, stomp (jump on it), body slam, dash past (TA) (fails: walking into it as it rears up) | on line between log 2 (red-gem pad) and C28 | AMBUSH | no | Repeats the ambush beside the secret-route landmark | F3 p033R strip 2 · medium |
| E-S4-a | S4 | wave lab assistant | burrower/ambusher (rises out of a puddle) | as E-S3-a | spin when its head comes near, stomp (jump on it), body slam (fails: walking into it as it rears up) | guarding the bonus lift (beside the stump platform) | GUARD, AMBUSH | no | Guards the bonus entrance | F3 p034R top · medium |
| E-S4-b | S4 | wave lab assistant | burrower/ambusher (rises out of a puddle) | as E-S3-a | spin when its head comes near, stomp (jump on it), body slam (fails: walking into it as it rears up) | on line on the upper path near the power stone | GUARD, AMBUSH | no | Guards the crystal path | F3 p034R top and middle · medium |
| E-S5-a | S5 | triceratops | pursuer | reappears at the step-down above C58 and chases to the goal (TT 24: back about two seconds after the drop) | outrun (avoid) (fails: arriving at the green ! with the triceratops on your heels (mask hint 5: no time to hit it); grass; snagging after the drop) | behind (pursuer), from the drop above C58 | PURSUER | no | Its return is tied to a geometry change (a one-way drop) and its pressure is what makes the green ! a count trap | F3 p034R middle (icon at the step); F3 p102R fr.24; F3 p034L mask hint 5 · high |
| E-S5-b | S5 | pterodactyl (four, on perches along the chase-2 diagonal) | flier (perches, then swoops across the path) | as E-S2-a; one at the left edge just after C58, two at the right edge further down, one at the right edge near the end | jump-spin, dodge left or right, double-jump over (fails: touching one: carried off = death) | flank: perches at alternating edges of the chase lane | AMBUSH, HURDLE | no | More birds than chase 1, spread along the whole run | F3 p034R lower part; F3 p034L route · medium |
| E-G-a | G | triceratops | pursuer | chases the length of the secret strip | outrun, outrun by riding the water currents (hint C) (fails: grass; lava) | behind (pursuer) | PURSUER | no | The secret route is one long chase | F3 p035R; P3 p010L s68–s69 · high |
| E-G-b | G | pterodactyl (≈6 on perches; one stretch with three perches in a row at alternating edges) | flier (perches, then swoops across the path) | as E-S2-a | go round on the right, jump-spin (hint B), double-jump over (P3 s70) (fails: touching one) | flank: perches on both edges of the narrow strip | AMBUSH, HURDLE | no | The densest bird placement, on the narrowest lane | F3 p035R–p035L, hint B; P3 p010R s70 · low |

### Section beats

| section | beats | gaps | enemies | hazards |
|---|---|---|---|---|
| S1 | cave mouth: W, then the trio (chase trigger) → triceratops bursts out → log (jump), striped at the landing → lava left → lava right → W + slot → step down onto grass and crates → C1 ("rest briefly") | 3 | 1 | 5 |
| S2 | W + striped + slot → two perched pterodactyls swoop → lava patch → step down onto the 2×2 block → long grey stretch → curve → C19 (chase ends) | 2 | 3 | 2 |
| S3 | floating Aku → TNT → TNT 2-stack (flame pillar behind) → 3-stack → A-wood → strip 2: lava → diagonal log by lava → wave assistant → grass → log + red-gem pad → wave assistant → C28 | 4 | 2 | 5 |
| S4 | ? + Nitro + striped pair at C28 → bonus lift (wave assistant beside it) → lava-river bands + floating ! + 5 outlines → upper path, wave assistant, crystal → turn and descend the diagonal → 3-wood line → step down (the triceratops appears) → C58 crates at the landing | 2 | 2 | 2 |
| S5 | pterodactyl perches → lava band + ?(2) → grass field: right safe zone or striped stepping crate → big lava right + three Nitros (keep left) → lava / grass / lava choke → wide lava pool → green ! + two striped → goal | 5 | 5 | 5 |
| B | stump → ledge with the striped sandwich → step down → 3-stack → three rising slabs → 5-stack with the arrow on top (dismantle) → arrow bounce to the steel shelf (1UP + ?) → two short gaps → exit stump | 3 | 0 | 0 |
| G | red-gem pad by the log → chase strip with a steel C → grass and lava alternating → log → water currents (speed) → three perches in a row → lava pools (super double jump) → steel C → steps → secret gem | 2 | 7 | 3 |

Counts are computed from the records above (gaps = G records, including hurdles and drop-downs; enemies = individuals, the triceratops counted once per chase section; hazards = obstacle records active in the section). The G enemy count (triceratops + ≈6 birds) is a map estimate.

### Geometry and enemy design logic
1. **Two speeds, two geometries.** The chases run down narrow ≈3–5 u corridors toward the camera with hazards at the edges; the free section uses wider flat floors for explosives (the TNT ladder) and a switch puzzle over the lava river.
2. **Chase 1 never closes the lane except with a log.** Lava patches and geysers alternate sides (P3 s50) and leave half the path open; the only full-width obstacles are a fallen log and step-downs, both answered by one short move.
3. **Drops commit the player and carry crates on the landing.** Every step-down (S1, S2, the C58 drop) has crates at its foot; TT 05 and 23: drop without jumping, from the centre, and do not snag. The landing snag is the chase’s typical crate placement.
4. **The pursuer makes crate snags fair.** Missed crates are smashed and credited by the triceratops (F3 tip 2), so crates can stand on the chase line as obstacles, and the all-box goal never forces a stop inside a chase.
5. **Clinging grass is taught in the order slow → deadly.** Small patches at the S1 step, carpets in the free strip (harmless at walking pace), a field in chase 2 with a stepping crate and a safe lane, the middle of the final choke, and the whole gem course.
6. **The free section rehearses the chase vocabulary at walking pace.** Strip 2 holds lava patches, logs, grass and ambushers and no crates, so the obstacle language is learned where failure is cheap.
7. **Full-width lava appears late.** Bands are first met at walking pace in the lava-river area, then in chase 2 (a ≈1 u band, a ≈2–3 u pool), then as pools needing the super double jump on the secret course.
8. **Enemies match the pace.** Pterodactyls (flank ambushers that swoop across the lane) live in the chases, the wave assistants (puddle ambushers) only in the free section, and the invincible triceratops supplies the pressure.
9. **Mode changes are geometry changes.** Chase 1 ends at the C19 curve where the route turns back into the screen; chase 2 starts at a one-way step-down above C58. Both are checkpoints.
10. **The finale narrows the lane.** A big lava patch and three Nitros leave one third of the path, then a lava | grass | lava choke offers two wrong answers and one right one, followed by the green ! — the stage’s count check placed at its tightest point.
11. **The bonus is safe geometry around an order puzzle.** Steps of ≈0.5 u, gaps under 1 u and a floating steel shelf reachable only by the arrow once the stack below it is dismantled.
12. **The secret course is harder geometry, not more crates:** a narrower strip, more birds, water currents as speed boosts, steel checkpoints and pools that assume the super double jump from stage 12.
13. **Time-trial masks are placed as geometry keys.** Three crates become Aku crates so that invincibility covers exactly the grass and magma stretch after the TNT ladder (TT 13–20: landing in magma is fine while masked).

### Geometry transfer to the skate game
1. **Pursuer runs with a walking break.** Use the level-data `boulderChase` with two runs separated by `shelters`: run 1 down a 3.5–6 m (3–5 u) corridor with hazards on alternating edges and one full-width hurdle; a free section with the explosives and the switch puzzle; run 2 starting with a one-way 1.2–2.3 m drop. Missed crates should be credited when the pursuer breaks them, or kept off the chase line.
2. **Landing snags at drops.** Put one crate on the landing of each 1.2–2.3 m step-down, slightly off-centre: on foot it teaches "drop, don’t jump"; on the board a plow at ≥ 13 m/s costs ≈ 20 % speed, so a chase line should hold at most two in a row.
3. **Slow patch with an island and a safe lane.** In a chase, cover two thirds of the lane with slow ground, stand a crate in it as an island (top 1.15 m: inside a full ollie’s 1.78 m apex and a plain jump on foot), and leave a 1.2–1.5 m clean lane along one wall, visible early.
4. **Perched flank ambusher.** A `floater` (hovers 1.65 m, swoops every 2.6 s within 12 m along and 6 m across) on a perch at the corridor edge plays the pterodactyl; place them on alternating edges, never on the landing of a drop.
5. **Final squeeze before the goal.** Lava `pit`s on both edges with a slow patch between them, and a Nitro line along one edge after a wide lava patch, 2–3 s before the `nitrobang` and the gate: the lane narrows to ≈1.2 m at chase speed, and the count check sits at the tightest point.
6. **Arrow-on-tower bonus geometry.** Keep the bonus footing trivial (0.5 m steps, gaps ≤ 1 m) and put the difficulty in the order. Build the reward shelf from steel crates (crate tops cannot be ledge-grabbed, unlike platforms) with its top 5–5.8 m above the floor, inside the arrow-gate window (4.7–6.6 m, bible XV.2): an arrow resting on one crate (lid 2.30 m) launches ≈ 3.77 m above its lid (≈ 6.1 m), while the arrow on top of a 5-stack (lid 5.76 m) is above the floor double jump (4.59 m) until the stack below it is reduced.

## Open questions / uncertainties

- CP1 bubble (S1-e): three crates are forced by the label; types unreadable in the gutter blur.
- Exact start of chase 2: the dinosaur is visible from TT frame 24 (after the S4-d drop); S4-c could
  already be inside the chase.
- S4-a: the two striped crates are drawn one above the other; whether they are a true 2-stack or
  two crates at different positions is not clear at map scale.
- Bonus lives ×2 vs one visible 1UP crate: the second life presumably comes from a ? crate.
- B-e: drawn as a wood crate with a small gap above a ?; read as a 2-stack.
- Unidentified icons (dark pedestal figures on the strip before C28; red spiky figure before C58;
  red discs on the gem course) — treated as hazards/decoration.
- Prima suggests a body slam to gain height for the materialised crates in S4-b; F3 gives no detail.
- **Geometry:** The dark robed figures on dark squares on the F3 map are read as wave lab assistants (F3 p032R monster list: they rise from water); this resolves the first-wave "pedestal" icons with medium confidence. The red spiky figure before C58 is the triceratops icon marking where chase 2 starts.
- **Geometry:** A dark spiky object in the blurred stretch after CP1 (F3 p033 gutter) is unidentified (flame vent?).
- **Geometry:** The long darker grey stretch before C19 is unlabelled; the first-wave reading "tar" is not confirmed by F3’s tips, which mention only grass, lava and logs.
- **Geometry:** Flame-geyser cycles are not stated; lava and grass sizes are map estimates; drop heights are not measured.
- **Geometry:** The red discs on the gem course are not explained by F3 or P3.
- **Geometry:** Hole and step counts in the gem course and the bird count there are map estimates.
