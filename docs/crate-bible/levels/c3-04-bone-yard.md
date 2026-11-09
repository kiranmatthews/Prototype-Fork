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
