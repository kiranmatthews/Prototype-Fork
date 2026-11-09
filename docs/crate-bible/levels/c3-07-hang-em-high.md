# Crash 3 — Stage 7 Hang 'em High  (アラビアの あついぶらさがり)

Sources: F3 p048–p049 (stage map, book pp. 88–91), F3 p057L (bonus challenge, book p. 106),
F3 p056 (stage 27, the yellow-gem course that ends in this stage, book pp. 104–105), F3 p104L
(time-trial route "スゴイの07"), F3 p047R (Arabian monster list, book p. 87), F3 p011 (legend);
P3 p014R–p015R (shots 19–36 incl. bonus and time trial); gamepressure N. Sane Hang 'Em High page
(total 95, bonus 20, stage-27 description; corroboration).

Evidence level:
- **Read directly (F3 icons, zoomed):** all crate bubbles; checkpoint counts 11 / 27 / 64; bonus
  header (×20 boxes, ×3 lives) and diagram; time badges and "A" badges; the 17 Nitros drawn on the
  stage-27 course.
- **Blurred / inferred:** the C1 bubble sits in the gutter (two wood-looking crates; the count is
  forced by the "11" label). White cubes in the bonus diagram are identified from Prima captions
  (three slot crates, one TNT).
- **Unreconciled:** F3 prints **64** at C3, but the crates drawn between C2 and C3 (11 on the mesh,
  20 in the bonus, a 2×2 and the C crate) give **63**. No extra bubble was found in the gutter.
- **Total:** gamepressure gives 95. Drawn main route (58 incl. 1 Nitro) + bonus (20) = 78; the
  stage-27 course draws 17 Nitros; 78 + 17 = **95**. The simplest reading: those Nitros belong to
  stage 7's tally and are credited by the green ! in stage 7's final hallway (gamepressure: the secret
  area need not be visited for the clear gem). If the printed 64 were right, the total would be 96.

## At a glance

| Field | Value |
|---|---|
| Theme | Arabian rooftops; overhead wire-mesh hang sections (金網); jump carpets; first Arabian stage ("simple" per F3) |
| Camera axis | into-screen rooftop corridor with two overhead-mesh hang traverses (the long one is drawn running across the screen); side-view bonus |
| Total boxes | **95** (gamepressure; reconstructed 58 main + 20 bonus + 17 Nitro on the stage-27 course) |
| Boxes per route | main **58** (57 + 1 Nitro) · bonus **20** · stage-27 yellow-gem course **17 Nitro** (counted in stage 7, inferred) · death route none |
| Checkpoints | 3 (C1 "11", C2 "27", C3 printed "64" / 63 drawn); stage 27 has none |
| 1UP | no 1UP crates; 3 slot crates in the bonus = the header's ×3 lives |
| Aku | 1 crate (S1-d, high at the first mesh); Time Trial "A" crates: S1-b, S2-c, S3-a |
| TNT / Nitro | 1 TNT (bonus only, used as a switch trigger) / 1 Nitro on the main route (S4-a) + 17 on the stage-27 course |
| ! / outline | end hallway: grey ! + green ! with 2 outline crates; bonus: 2 steel ! + 1 green ! + 1 outline (becomes a wooden arrow) |
| Iron-bound / arrows | 0 iron-bound; 6 steel arrow blocks on the main route (uncounted); 1 wooden arrow (bonus outline) |
| Striped / slot | 0 striped / 5 slot (2 main, 3 bonus) |
| ? / wood | 25 ? (18 main, 7 bonus) / 39 wood (31 main, 8 bonus) |
| Gems | Clear gem: all 95 (the hard-to-see crate above a jump carpet is the classic miss). Yellow gem: only on the stage-27 course (10 time-trial relics needed); not obtainable from stage 7 |
| Enemies | sabre workers (サーベル作業員), magic-carpet researchers (魔法のカーペット研究員), upside-down scorpions on the mesh (サカサソリン), pot-carrying orangutans (オットトウータン) |
| Hazards | gaps between rooftops, holes in the mesh, a hole right after the mesh end, moving platforms |
| Time trial | 10 time crates = 18 s; staff best 0:34:13 (F3 p104L: the easiest Arabian stage); relic targets printed in the header: sapphire 1:28:00, gold 0:53:60 |

`uncounted` / `uncountedFixtures` in the JSON list steel arrows and switches, which are not part of
the box total; `ttBadges` gives each cluster's time-trial badges ({"1": n} seconds, {"A": 1} = Aku).

## Route skeleton

```
START (rooftop, two steel arrows)                                       ▲ into the screen
 S1  W W · 2×2 · steel arrow + carpet researcher · ? · Aku high at the mesh entrance ·
     MESH 1 (hang) · W W (blurred) ......................................................... 11  C1
 S2  orangutan + carpet researcher · stepped group of 6 · jump carpets with a HIDDEN ? above ·
     orangutan platform (steel arrow) · 2×2 + floating ? · carpets · archway ·
     floating ? over two W ..................................................................... 27  C2
 S3  MESH 2 (long hang traverse with a hole): W · ? · ? · $ · carpet researcher on the mesh ·
     W W · scorpion · W W · [under the mesh: bonus platform ─► B (20) ─► back] ·
     mesh end: steel arrow + W W ? before a hole · landing · carpet researcher on a moving
     platform · 2×2 ................................................ 64 printed / 63 drawn  C3
 S4  Nitro/W/$ column · sabre worker · 2×2 · floating ? over a carpet · carpets · orangutan ·
     2×2 · power stone · end hallway: green ! + grey ! + 2 outlines + ? ·
     ◄── stage-27 course joins here · carpet researcher · GOAL
 Y   STAGE 27 (separate portal, no checkpoints): N/N · five floating rows of N N N · yellow gem
     ─► drops into S4 just before the goal
     totals: main 57 + 1 Nitro = 58; + bonus 20 = 78; + stage-27 Nitros 17 = 95
```

| Section | Boxes (non-Nitro / Nitro) | Cumulative (F3) |
|---|---|---|
| S1 start → C1 | 11 / 0 | 11 |
| S2 C1 → C2 | 16 / 0 | 27 |
| S3 C2 → C3 (main) | 16 / 0 | — |
| B bonus (from S3) | 20 / 0 | 64 printed (63 drawn) with S3 |
| S4 C3 → goal | 14 / 1 | derived 77 (78) |
| Y stage-27 course | 0 / 17 | derived 95 |

## Section-by-section map

Legend: W wood · ? question · A Aku · T TNT · N Nitro · ⇑ steel arrow · ↑ wooden arrow ·
! steel switch · G! green switch · o outline · $ slot · C checkpoint · ▭ jump carpet ·
superscript ¹²³ = time-crate value in Time Trial · `*` = Aku crate in Time Trial · `A/B` = A on B.
Sketches read top → bottom in route order.

### S1 — Start → C1  (cumulative 11)

```
 START: ⇑ ⇑ (side by side)
   e:sabre worker      W W                      S1-a
   ? W                                          S1-b  2×2 on the ground (TT Aku inside)
   W ?
   ⇑   e:carpet researcher (TT: stomp him to reach the upper footing)
   ?   (by the archway)                         S1-c
   A²  (high, at the mesh entrance)             S1-d
   ═══════ MESH 1 — hang: grab first, then spin ═══════
   W W  (gutter, blurred)                       S1-e
   C                                            S1-f  C1
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S1-a | first platform, beside the first sabre worker | W×2 | pair | spin | ON-PATH PAIR | first crates next to the first enemy; Prima 20 and F3 TT 01–03: wait for him to turn his back | F3 p048L zoom | high |
| S1-b | next platform | ?×2, W×2 | 2×2 flat block (diagonal ?s) | spin, jump | ON-PATH GRID TIME-TRIAL | the stage's unit block (2×2 recurs five times); in TT one crate is the first Aku | F3 p048L "A" bubble zoom | high |
| S1-c | by the archway after the carpet researcher | ?×1 | single | spin | ON-PATH SINGLE | pacing fruit; the steel arrow before it and the researcher (a stomp-able step in TT 06) give the first vertical choice | F3 p048L zoom | high |
| S1-d | high at the mesh entrance | A×1 (TT 2 s) | single, high | jump-spin before grabbing the mesh | AKU HIGH TIME-TRIAL | the mask is handed out where the first hang section starts (Prima 21: mask on the mesh just before C1); TT 07–08: jump-spin it, then catch the mesh | F3 p048 zoom (blue 2); P3 p014R shot 21; F3 p104L 07–08 | high |
| S1-e | at the mesh exit | W×2 (blurred) | pair | spin | ON-PATH PAIR | landing reward after the first hang | F3 p048 gutter (blurred), forced by label 11 | low |
| S1-f | after mesh 1 | C | single | walk | CHECKPOINT | checkpoint after the first hang traverse | F3 p048 "11コ" | high |

F3 mask hint 1 (mesh): grab the mesh first and spin after; spinning at the moment of grabbing drops
you.

### S2 — C1 → C2  (cumulative 27)

```
   e:orangutan (on a plank)   e:carpet researcher
            ?     W¹                            S2-a  stepped group of 6:
       W²   W     W      W                            left W, ?/W, W/W, front-right W
   ▭ jump carpet   ▭ jump carpet                      (TT 2 s hidden at the back)
                       ?³  ← high above the carpet, off-screen      S2-b
   platform: e:orangutan   ⇑
   ? W   ?  (floating, above-right)             S2-c  2×2 + floating ?  (TT Aku inside)
   W ?
   ▭ ▭ carpets   archway
   ?¹ (floating above)                          S2-d
   W     W
   C  (right after the archway)                 S2-e  C2
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S2-a | beside the orangutan's plank | W×5, ?×1 (TT 2 s + 1 s) | stepped group: left W, centre ?/W, right-centre W/W, front-right W | spin, jump | STACK ENEMY-LINK TIME-TRIAL | a cluster beside an orangutan, which is a tool: TT 11 slides into it so it flies and breaks the 1-s box; F3 monster list — a spin makes it stagger with a pot on its head and it becomes a springboard. Prima TT 32: the 2-s box hides at the back of the group | F3 p048R zoom (step5); F3 p104L 11; P3 p015R shot 32 | medium |
| S2-b | high above the second jump carpet | ?×1 (TT 3 s) | single, floating, out of the default view | held straight-up jump off the carpet | HIGH HIDDEN COUNT-TRAP TOOL TEACH TIME-TRIAL | the signature trap: the F3 header and mask hint 2 both say the perfect gem hinges on the box right above the jump carpet that is hard to see. Prima 22: bounce straight up off the first carpet, hold jump, and off the second hit the box at the top of the screen. TT 14–15: spin at the apex to break the 3-s box and land on the next footing | F3 p048R zoom; header; mask hint 2; P3 p014R shot 22; F3 p104L 14–15 | high |
| S2-c | platform after the orangutan | ?×3, W×2 | 2×2 block (?, W / W, ?) + one ? floating above-right | spin; jump from the block for the floater | GRID FLOAT-LINE HIGH TIME-TRIAL | a ground block with one crate lifted out of spin reach: the block is the step to the floater; TT Aku #2 is in this group | F3 p048R "A" bubble zoom | high |
| S2-d | after the carpets and the archway | ?×1 (TT 1 s), W×2 | ? floating above two separated wood crates | jump on a wood crate, bonk the ? | SANDWICH HIGH TIME-TRIAL | ground crates as steps under a floating reward | F3 p048R "1" bubble zoom | high |
| S2-e | right after the archway on p049L | C | single | walk | CHECKPOINT | checkpoint after the carpet run | F3 p049L "27コ" | high |

F3 mask hint 3: in the into-screen carpet run, jump distances are hard to judge — take big jumps,
one carpet at a time.

### S3 — C2 → C3  (cumulative printed 64; 63 drawn)

```
 C2 ─► MESH 2 (long hang traverse, a rectangular hole near its start) ───────────────────►
   W*    ?²    ?        $          e:carpet researcher     W W    e:scorpion    W W³    W W ?
               (at the  (above     (rides along the mesh)                              (mesh end:
                hole)    the mesh)                                                      ⇑ + hole ahead)
                     ┌──────────────────────────┐
                     │ bonus platform (⇑) under │ ─► B (20) ─► back
                     │ the mesh                 │
                     └──────────────────────────┘
   landing platform ─► archway ─► e:carpet researcher on a moving platform
   ? W                                          S3-h  2×2
   W W
   C                                            S3-i  C3
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S3-a | start of mesh 2 | W×1 | single | spin while hanging | ON-PATH SINGLE TIME-TRIAL | plain crate; in TT it is the third Aku — F3 TA4: with no miss so far it makes you invincible, and the run is about how far you get before it wears off (it ends just past the Nitro column if you dawdle) | F3 p049L zoom; F3 TA4 | high |
| S3-b | on the mesh | ?×1 (TT 2 s) | single | spin while hanging | ON-PATH SINGLE TIME-TRIAL | hang-spin practice target | F3 p049L zoom | high |
| S3-c | at the hole in the mesh | ?×1 | single | spin near the hole | EDGE-BAIT | collecting it means hanging right next to the gap in the mesh | F3 p049L zoom | medium (exact geometry) |
| S3-d | above the mesh line | $×1 | single, above | spin from below | HIGH TIMED | a slot crate where the player can't linger comfortably (hanging) | F3 p049L zoom | high |
| S3-e | on the mesh after the carpet researcher | W×2 | pair | spin | ON-PATH PAIR | collected between a moving enemy and the scorpion | F3 p049L zoom | high |
| S3-f | on the mesh after the scorpion | W×2 (one is TT 3 s) | pair | spin | ON-PATH PAIR TIME-TRIAL | Prima TT 34: the 3-s box on the mesh | F3 p049L zoom; P3 p015R shot 34 | high |
| S3-g | mesh end, beside a steel arrow, hole ahead | W×2, ?×1 | group partly above the arrow | arrow bounce | EDGE-BAIT TOOL HIGH | F3 mask hint 4: bouncing off the arrow and stomping the crate above carries you forward into the hole — stop and look first. The crate turns the arrow's momentum against the player | F3 p049L zoom; mask hint 4 | high |
| S3-h | after the landing and the moving platform | ?×1, W×3 | 2×2 block | spin | ON-PATH GRID | unit block before the checkpoint | F3 p049R zoom | high |
| S3-i | end of the section | C | single | walk | CHECKPOINT | checkpoint after mesh 2 and the bonus | F3 p049R "64コ" (drawn total 63) | high |

The bonus platform (checkered, with a steel arrow) hangs under the mesh; F3 sends it to book p. 106
and Prima shot 24 shows the power crystal near a bonus area right of the mesh (F3 places the power
stone near the end hallway — two different screens or a guide discrepancy).

### S4 — C3 → Goal  (derived 77; 78 with Nitro)

```
   N                                            S4-a  column, top first: Nitro / W¹ / $
   W¹                                                 (C3 crate on the ground beside it)
   $
   e:sabre worker
   W ?    (two 2-high columns: W/W behind, ?/W in front)     S4-b
   W W
   ▭ carpet      ?²  ← floating over the carpet's shadow, high      S4-c
   ▭ ▭ carpets   e:orangutan
   W W                                          S4-d  2×2 on a platform
   ? ?
   power stone
   G!   !                                       S4-e  end hallway
   o o   ?¹   (the ordinary-looking ? is a TT 1-s box)
   ◄── stage-27 course drops in here
   e:carpet researcher
   GOAL
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S4-a | right after C3 | N×1, W×1 (TT 1 s), $×1 | 3-high column N/W/$ | slide (or spin low) the bottom out | SUPPORT-ORDER EXPLOSIVE-MIX STACK TIMED TIME-TRIAL | a daruma-otoshi puzzle (だるま落とし): F3 mask hint 5 — don't panic at the slot; take it out with a slide or the Nitro explodes; Prima 25: spin low or slide under the Nitro. The slot's timer pushes the player to act, the Nitro punishes a jump or a high spin | F3 p049R zoom; mask hint 5; P3 p015L shot 25; P3 p015R shot 35 | high |
| S4-b | after the sabre worker | W×3, ?×1 | two 2-high columns (W/W behind, ?/W in front) | spin | ON-PATH STACK | unit block, seen at an angle | F3 p049R zoom | medium (shape) |
| S4-c | high above a carpet's shadow | ?×1 (TT 2 s) | single, floating | straight-up jump from the carpet | HIGH HIDDEN COUNT-TRAP TEST TIME-TRIAL | the S2-b lesson repeated without the header's warning: mask hint 6 — hard to find, jump straight up from the carpet, the perfect gem is close. TA5: break it while still invincible (larger hit area). Prima 26 suggests a super body slam (sic) | F3 p049R zoom; mask hint 6; F3 TA5; P3 p015L shot 26 | high |
| S4-d | platform after the carpets and an orangutan | W×2, ?×2 | 2×2 block (W W / ? ?) | spin | ON-PATH GRID | unit block, last one | F3 p049R zoom | high |
| S4-e | end hallway after the power stone | o×2, ?×1 (TT 1 s); uncounted: steel !, green ! | two switches, then two outline crates and a ? | spin both !, collect | SWITCH NITRO-SWITCH OUTLINE COUNT-TRAP TIME-TRIAL | the last room checks the switches: the grey ! builds two outline crates, the green ! detonates the Nitros (1 on the main route plus, by the total, the 17 on the stage-27 course). TA6 / TT 29–30: spin-touch the ! in mid-jump and land on the outline spot — the plain-looking box behind is a 1-s box. Prima 27: spin both (!) crates, then the gem at the end | F3 p049R zoom; F3 TA6; F3 p104L 29–30; P3 p015L shot 27 | high |

### B — Bonus challenge  (20 boxes, ×3 lives) — side view, entered from S3

```
                                              G!
         ?                     W                  ?
      ?                      W W W                   ?
   ?        W              W W $ W                      ?
 ?        $ $              ▔▔▔▔▔▔▔        \_/      o      ▓▓▓▓ T ▓▓▓▓  ─► exit pad
 ▁▁▁▁   ▁▁▁▁▁▁▁            raised         bowl   ▁▁▁▁▁        !   (under the walkway)
 start  (! hangs under this ledge)  B-c pyramid       B-d        B-f
        B-a       B-b = rising arc of 4 ?            B-e = 3 ? descending toward B-d
```

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| B-a | first platform | $×2, W×1; uncounted: steel ! hanging below the ledge | two slots side by side, wood on the right one | spin the slots at the right moment | TIMED LIFE STACK BONUS | slot lives (the header's ×3 = the three slots); the ! under the ledge cannot be reached by hand — F3 hint: ! blocks also react to a bazooka shot or a TNT blast | F3 p057L diagram + hint; P3 p015L shot 28 | high |
| B-b | between the first platform and the pyramid | ?×4 | floating arc rising diagonally | jump along the arc | FLOAT-LINE HIGH BONUS | a jump path written in crates | F3 p057L | high |
| B-c | raised platform | W×7, $×1 | pyramid 4/3/1, slot in the bottom row | spin; time the slot | PYRAMID TIMED LIFE BONUS | Prima 28: time the slot box at the bottom of the stack for an extra life; gamepressure: smashing the big cluster pays a life | F3 p057L; P3 p015L shot 28 | high |
| B-d | platform after a bowl-shaped dip, before the walkway | o×1 | single outline → becomes a wooden arrow | materialised by the ! under the walkway | OUTLINE TOOL BACKTRACK BONUS | Prima 30: the shadow box turns into an arrow box for more bounce — the tool for B-e; the player passes it, triggers it from beyond, and comes back | F3 p057L; P3 p015L shot 30 | high |
| B-e | high, descending from a green ! toward B-d | ?×3; uncounted: green ! | floating diagonal line | bounce from the B-d arrow | HIGH FLOAT-LINE REWARD BONUS | reachable only with the arrow; the green ! at the top has no Nitro to detonate in the bonus (purpose unknown) | F3 p057L zoom | high (crates), low (green ! role) |
| B-f | on the steel exit walkway | T×1; uncounted: steel ! under the walkway | TNT on steel above a switch | stomp the TNT (never spin it), step away | CHAIN SWITCH TOOL EXPLOSIVE-MIX BONUS | the only way to press the ! under the walkway is the blast (Prima 29: use the TNT to hit the (!) below; F3 hint: arm TNT by stomping); the ! then turns B-d into an arrow | F3 p057L + hint; P3 p015L shot 29 | high |

### Y — Stage 27 course  (17 Nitro; reached only via the stage-27 portal)

F3 p056: the course carries the same title as stage 7, needs 10 time-trial relics, has **no
checkpoints**, ends at the yellow gem and then drops into stage 7 just before the goal ("stage 7
p. 91"). Gamepressure describes it as jumping successively taller Nitro towers with a carpet.

| id | position | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| Y-a | below a platform edge after the first sabre worker | N×2 | 2-stack | avoid / shoot | ROUTE-SPLIT EXPLOSIVE-MIX | first Nitros, placed under a ledge you jump from | F3 p056L zoom | high |
| Y-b | over carpets and platforms after the jump carpet | N×15 | five floating rows of three | double-jump high off the carpet and tornado-spin over them; shoot the ones on the right while the bazooka still works | ROUTE-SPLIT HIGH EXPLOSIVE-MIX | F3 hint 2: the bazooka is usable up to this platform — don't forget the floating Nitros on the right; hint 3: double-jump high from the carpet, then float over the Nitros with the tornado spin | F3 p056R zoom | high |

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | sabre worker | first platform | beside S1-a; attack when his back is turned |
| S1 | magic-carpet researcher | near the first steel arrow | TT: stomp him for the upper footing (enemy as step) |
| S1, S3 | overhead mesh | mesh 1 and mesh 2 | crates are spun while hanging; grab first, then spin |
| S2 | orangutan ×2 | on a plank; on a platform | tool beside S2-a (projectile / springboard) |
| S2 | carpet researcher | beside the orangutan | TT 11: the flung orangutan can also take him out |
| S3 | carpet researcher | riding along mesh 2 | moving obstacle between S3-d and S3-e |
| S3 | upside-down scorpion | on mesh 2 | between S3-e and S3-f; spin it from a distance (Prima 23) |
| S3 | hole | after the mesh end | S3-g bounce trap |
| S3 | carpet researcher | on a moving platform before C3 | — |
| S4 | sabre worker | after the column | — |
| S4 | orangutan | among the carpets | — |
| S4 | carpet researcher | after the end hallway | — |
| Y | sabre workers ×3, carpet researcher | stage-27 course | bazooka targets (F3 hint 1) |
| all | rooftop gaps, jump carpets, moving platforms | throughout | carpets are tools for the hidden crates S2-b, S4-c |

## Puzzle rooms and dependency chains

**P1 — Daruma-otoshi column (S4-a).** Setup: Nitro on wood on a slot, beside the C3 crate.
Correct: slide (or spin low) into the slot; the column drops one step, then deal with the wood the
same way. Tempting wrong: jumping onto it, or a high spin/attack that reaches the Nitro. Loss: a life;
the Nitro itself is only credited later by the green !. Why it works: the order of removal is the
whole puzzle, and the slot's timer adds pressure.

**P2 — Look above every carpet (S2-b teach, S4-c test).** Setup: a ? crate floats high above a jump
carpet, outside the default camera view. Correct: bounce straight up off the carpet holding jump.
Wrong: using the carpet only to travel forward. Loss: 1 box each (all-box gem). Why it works: the
level states the rule once (header + mask hint 2) and repeats it once silently (mask hint 6).

**P3 — Bonus switch chain (B-f → B-d → B-e).** Setup: TNT on a steel walkway with a ! underneath,
an outline crate before the walkway, three ? crates floating high above it. Correct: pass the
outline, stomp the TNT, step back; the blast presses the !, the outline becomes an arrow; return and
bounce to the three ? crates. Wrong: spinning the TNT (instant blast, no time to clear). Loss: a life,
or the 3 ? + the arrow crate (all-box). Why it works: explosive, switch, outline and arrow chained in
one readable room.

**P4 — Bounce into the hole (S3-g).** Setup: steel arrow at the mesh end, crates above it, a hole
just ahead. Correct: stop, break the crates without riding the arrow's momentum forward. Wrong:
bounce and stomp in one motion. Loss: a life.

**P5 — End-hallway switches and the cross-route Nitros (S4-e, Y).** Setup: grey ! and green ! in the
last hallway; 17 Nitros exist only on the stage-27 course, which drops in after the hallway.
Correct (all-box from stage 7): spin both switches. Wrong: running past (TT does so on purpose).
Loss: 2 outline crates and every Nitro (1 + 17 by the reconstructed total).

## Design logic of this level

1. **First-of-theme restraint.** One Nitro in 58 main-route boxes, and the stage's only TNT is a
   tool inside the bonus. The challenge is height and hanging, not explosives.
2. **Vertical placement is the theme.** Crates float above carpets (S2-b, S4-c), above ground pairs
   (S2-d), above blocks (S2-c), above the mesh (S3-d) and at a mesh hole (S3-c).
3. **One signature count trap, taught then tested.** The crate above the carpet is announced by the
   header and mask hint 2, then repeated in S4 with only a quieter hint.
4. **Mesh crates teach hang discipline.** Crates along both meshes are broken while hanging; the
   guide's first hint is the input order (grab, then spin).
5. **Momentum edge-bait.** At the mesh end, an arrow plus a crate above it turns a reward into a
   launch over a hole.
6. **Enemies as tools.** Carpet researcher as a step (TT 06), orangutan as a projectile (TT 11) or a
   springboard after a spin (F3 monster list), placed right next to crate groups.
7. **The 2×2 block is the rhythm unit.** It appears five times (S1-b, S2-c, S3-h, S4-b, S4-d), roughly
   one per platform, as a predictable fruit beat between vertical challenges.
8. **The bonus is the richest room.** 20 boxes (21 % of the stage) and all three lives, with the
   switch chain as its puzzle.
9. **Cross-route counting.** By the reconstructed total, the 17 stage-27 Nitros count for stage 7 and
   are credited by the green ! in stage 7's last hallway; the secret course is not needed for the
   clear gem.
10. **Checkpoints close traversal modes.** C1 after mesh 1, C2 after the carpet run, C3 after mesh 2
    and the bonus; the last section is the puzzle column, the second hidden crate and the switches.
11. **Time-trial overlay.** Ten time crates (18 s) sit on the high and hidden positions (carpet crates,
    stack backs, the plain box behind the outlines), so the TT line follows the vertical route.

## Transfer to the skate game

1. **Hidden crate above a bouncer.** Put a ? crate 5.5–6 m above a steel arrow (held bounce reaches
   ~6.1 m), outside the default camera frame. Teach it once with a sign or a fruit trail, repeat it
   once later without one: an honest count trap that rewards looking up.
2. **Crates on a rail line (mesh analog).** Hang sections map to our authored rails: crates sitting on
   a rail are smashed at ≥ 12.5 m/s and the grind continues, below that the rider is knocked off. A
   25–30 m rail with 3–4 crates about 5 m apart is a speed-gated "mesh"; a mask crate on the line
   always pops and protects the rest of the run.
3. **Daruma-otoshi under our settle rule.** Our Nitro is exempt from settling, so a Nitro on top
   stays floating when the crates below are slid out: the column turns into a floating Nitro 1–2 crates
   above a plain crate, which is a "don't jump here" trap rather than a removal puzzle. To keep the
   original puzzle, put TNT on top instead (it settles) and check that a settling TNT does not arm.
4. **TNT-blast switch.** TNT on a steel walkway with the ! underneath, out of reach, so only the blast
   can press it (our blast radius 2.75 m). Our spec lists hit, slide and grind-through as ! triggers:
   confirm a blast triggers `bang` before authoring this. The ! materialises an outline that becomes a
   wooden arrow, the tool for three crates floating ~5–6 m up.
5. **Bounce edge-bait.** Steel arrow with a crate stacked above it and a hole 3–5 m ahead: bounce
   (16 m/s) + stomp (14 m/s) carries a running player (9 m/s) well past the arrow, so the reward
   becomes a launch into the hole. Use it only after the player has seen a safe arrow.
6. **2×2 flat block as a mini grind box.** A flat 2×2 (top 1.15 m) is reachable with a full-charge
   ollie (1.7 m); each exposed edge pair is a 2-crate grind row (2.3 m) that consumes its crates.
   Repeating this unit once per platform gives skaters and walkers the same predictable fruit beat.

## Geometry, obstacles and enemies

Sources for this block: F3 p048L–p049R (rooftop topology: walled roof rooms, planks, slabs, jump carpets, the two meshes, mask hints 1–6, time-attack boxes 1–6), F3 p104L (time-trial frames 01–32 and captions), F3 p046–p047 (Arabian tips: stages built like an athletic course, stop on each foothold at first; monster list with behaviour), F3 p057L (bonus side view and hint), F3 p056 (stage-27 course: pads, slabs, carpets, floating Nitro rows); P3 p014R–p015R shots 19–36 (scale: carpets, mesh, column, hallway). Sizes are estimates in u read against crates and Crash in the TT frames and Prima shots; the Famitsu strips give order and topology. "Not visible" marks values no source shows.

### Camera and route shape

An athletic course across rooftops (F3 p046: cloth roofs and carpets as trampolines, unstable footing, "stop on each foothold at first"). The route is a chain of small walled roof rooms — the rests — joined by crossings that are the tests: narrow planks, single floating slabs, pairs of jump carpets, a moving slab and two overhead wire meshes that Crash crosses hanging. Falling between rooftops is death. The camera runs into the screen except along the long second mesh, which TT frames 21–23 and Prima shots 23–24 show side-on, and in the side-view bonus.

- **S1** — into-screen: start slab, two rising slabs, two walled rooms linked by a plank and a slab, an upper ledge, then mesh 1 (short hang traverse into the screen) to C1
- **S2** — into-screen: plank with an orangutan, two pairs of jump carpets (mask hint 3: into-screen distances are hard to judge), an L-room and a U-room, archway, C2
- **S3** — side-scroll along mesh 2, then into-screen: long zig-zag mesh seen side-on (TT 21–23; P3 shots 23–24) with a hole, a riding enemy, a scorpion and the bonus platform hanging below; then a landing, a hole, a moving slab and a room to C3
- **B** — side-scroll: left → right: walkway, rising crate arc, pyramid platform, steps, a bowl-shaped gap, outline platform, steel walkway
- **S4** — into-screen: raised step with the Nitro column, a slab held by a sabre worker, jump carpets, a room, the end hallway (stairs), the stage-27 drop-in, goal arch
- **Y** — into-screen: stage-27 course (the Nitro stretch is shown from the flank in hint 3): walled pads, single slabs, carpets under floating Nitro rows; no checkpoints; drops into S4 before the goal

### Platforms and gaps (section by section; table per section)

Columns *kind* to *coupling / failure* and *evidence* are observations; *why* is design inference. Platforms are `P-…`, gaps `G-…`; sizes are width × length in u (one crate) where visible, and every number is an estimate read against crates or the character in the same picture.

#### S1 — Start → C1 (rooftops, mesh 1)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | wide floor (start slab): flat roof slab with an L-shaped raised step and two steel arrows side by side | ≈5×5 | 0 | walk | edges open; static | REST | a broad, enemy-free start; the arrows are the first vertical tool (their use is not stated — inference: a bounce up the first rise) | F3 p048L (two arrow bubbles at the start slab) — conf. medium |
| G-S1-a | S1 | bottomless pit between rooftops (two stepping slabs) | ≈1 between slabs; landing floating slab ≈2×2, then walled room 1 | +0.5 to +1 per slab (rising) | plain | none / death (fall between roofs) (lethal; run-up ≈3); nearby S1-a | TEACH | first gaps are short, rising steps onto square slabs — the stage's basic crossing shown with nothing else in it | F3 p048L (two white slabs between the start and room 1) — conf. medium |
| P-S1-b | S1 | wide floor (walled roof room 1): sabre worker, stopwatch, two wood crates | ≈4×5 | 0 | walk; spin the worker from behind | edges walled (low parapet ≈0.5–1); static | ARENA | the first enemy is met inside walls, so its sabre is the only danger | F3 p048L; P3 p014R shot 20; F3 p104L 01–03 — conf. medium |
| P-S1-c | S1 | bridge/plank (wooden): plank from room 1 to the U-room | ≈2×5 | 0 | walk | edges open; static | CHOKE | a narrow crossing with open edges between two safe rooms | F3 p048L; F3 p104L 02 (plank floor) — conf. medium |
| P-S1-d | S1 | wide floor (walled U-shaped roof room): two plank ends with a wall stub between them | ≈4×4 | 0 | walk | edges walled; static | REST | turns the route and resets the player between crossings | F3 p048L — conf. medium |
| G-S1-b | S1 | bottomless pit between rooftops (single stepping slab) | ≈1–1.5 on each side of the slab; landing slab ≈2×2, then room 2 | 0 | plain | none / death (fall between roofs) (lethal; run-up end of a plank); nearby P-S1-d, P-S1-e | STEPPING | two hops with a one-slab stop in the middle: the rhythm unit of the rooftops | F3 p048L (white slab between the plank and room 2) — conf. medium |
| P-S1-e | S1 | wide floor (walled L-shaped roof room 2): carpet researcher floating at the far corner, 2×2 crate block, steel arrow by the back wall | ≈6×4 | 0 | walk | edges walled; static | ARENA | the room holds both tools for the climb ahead: the arrow and the floating enemy | F3 p048L; TA1 — conf. medium |
| P-S1-f | S1 | narrow ledge (upper footing with an archway): ? by the arch; the Aku crate floats at the mesh entrance | ≈2–3 wide | +2 to +3 (estimate) | arrow, or enemy-bounce (stomp the carpet researcher, TT 06) | edges walled on one side; static | PERCH | the first height step is offered with two tools, one of them an enemy | F3 p048L TA1; F3 p104L 06 — conf. medium |
| G-S1-c | S1 | monkey-bar mesh (swing/vine-type hang traverse) over a void — mesh 1 | not visible (≈4–8 long; drawn across the gutter); landing walled pad with W W, then C1 | 0 | climb (jump-grab the mesh, hang-move), spin while hanging | grab first, then spin — spinning at the moment of grabbing drops you (mask hint 1) / death (fall into the void) (lethal; run-up jump from the upper ledge); nearby S1-d, S1-e | TEACH | the new traversal is short, into the screen and enemy-free; its one rule is the input order | F3 p048L–p048R mask hint 1; F3 p104L 07–10; P3 p014R shot 21 — conf. medium |
| P-S1-g | S1 | square pad (walled mesh-exit pad): W W, then the C1 crate | ≈3×3 | 0 | walk | edges walled; static | CHECKPOINT-PAD | the save closes the first traversal mode | F3 p048R ("11コ") — conf. high |

#### S2 — C1 → C2 (jump carpets)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S2-a | S2 | bridge/plank (wooden): plank from C1 with an orangutan on it; a carpet researcher hovers beside it; stepped crate group | ≈2×5 | 0 | walk; slide the orangutan (TA2) | edges open; static | CHOKE | an enemy that is also a tool, placed where it cannot be walked around | F3 p048R; F3 p104L 11–13 — conf. medium |
| G-S2-a | S2 | chasm with bounce (two jump carpets) | ≈1–2 between plank, carpets and room; landing carpet ≈2×2, carpet, then the L-room | 0 | bounce pad (jump carpet), held/high (straight-up bounce for the hidden ?) | carpets bounce you on landing, so the run cannot stop until the room (inferred) / death (fall between roofs) (lethal; run-up end of the plank); nearby S2-a, S2-b | TEACH | the bounce pad is taught as a pair; the high bounce it gives is also how the hidden crate is reached | F3 p048R (two carpets, the 3-badge ? above the second); P3 p014R shot 22; F3 p104L 14–15 — conf. medium |
| P-S2-b | S2 | square pad (jump carpet): patterned carpet pads, used in pairs | ≈2×2 each (P3 shot 22) | 0 | bounce pad | edges open; bouncy (bounces on landing; holding jump gives a high bounce) | STEPPING, TIMING-STEP | a forced step: it moves you on whether you are ready or not | P3 p014R shot 22; F3 p046 tips; F3 p104L 14–17 — conf. high |
| P-S2-c | S2 | wide floor (walled L-shaped roof room): orangutan, steel arrow in the inner corner, 2×2 block with a ? floating above-right | ≈5×4 | 0 | walk; arrow to the floater | edges walled; static | ARENA, REST | the landing room after the first carpets holds a second springboard-enemy and an arrow | F3 p048R — conf. medium |
| P-S2-d | S2 | wide floor (walled U-shaped roof room): open-fronted room before the second carpets | ≈4×3 | 0 | walk | edges walled on three sides; static | REST | a rest right before the carpet run that mask hint 3 warns about | F3 p048R — conf. medium |
| G-S2-b | S2 | chasm with bounce (two jump carpets rising to the archway) | ≈1–2; landing wooden landing in front of the archway | +1 to +2 overall (estimate) | bounce pad (jump carpet), plain | no stop on the carpets (inferred) / death (fall between roofs) (lethal; run-up U-room edge); nearby S2-d | TEST | mask hint 3: into the screen, carpet distances are hard to judge — take them one at a time with big jumps | F3 p048R mask hint 3 — conf. medium |
| P-S2-e | S2 | wide floor (landing and archway before C2): floating ? over two wood crates beyond the arch; C2 right after | ≈3×4 | 0 | walk | edges walled (arch block); static | CHECKPOINT-PAD | the save sits behind a doorway after the carpets | F3 p048R–p049L — conf. high |

#### S3 — C2 → C3 (mesh 2, side view)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-S3-a | S3 | monkey-bar mesh (swing/vine-type hang traverse) over a void — mesh 2, long zig-zag | ≈25–35 long (estimate from crate spacing); strip ≈2–3 wide; landing wooden landing at the far end | 0 | climb (hang-move), spin while hanging | carpet researcher rides along it; scorpion clings under it / death (fall into the void) (lethal; run-up jump from the C2 ledge); nearby S3-a, S3-b, S3-d, S3-e, S3-f, E-S3-a, E-S3-b | TEST | the short lesson of mesh 1 becomes a long side-on traverse with two moving enemies and crates spun while hanging | F3 p049L; F3 p104L 19–23; P3 p014R shots 23–24 — conf. medium |
| G-S3-b | S3 | floor hole in the mesh (missing panel) near its start | ≈2×1 (one panel; estimate); landing mesh beyond: the strips on both sides go round the hole | 0 | climb (route round the hole) | a ? floats at the hole (S3-c) / death (fall through) (lethal; run-up —); nearby S3-c | TEACH | the climbing surface itself has a gap: the player must read the mesh as terrain | F3 p049L (rectangular opening in the mesh) — conf. medium |
| G-S3-c | S3 | drop-down from the mesh to the bonus platform | n/a; landing checkered walled pad ≈3×3 with a steel arrow | −3 to −4 (estimate) | drop (let go) | the arrow on the pad leads back up (inferred from the arrow bubble) / not a failure (it is the route into the bonus) (non-lethal; run-up —); nearby B | BONUS-PAD | the optional room hangs directly under the route: letting go is the entrance | F3 p049L (bonus pad under the mesh, arrow bubble, "P.106") — conf. medium |
| P-S3-a | S3 | square pad (walled bonus platform under mesh 2): checkered floor, steel arrow | ≈3×3 | −3 to −4 below the mesh | drop in; arrow back up (inferred) | edges walled; static | BONUS-PAD | the only rest along the long mesh | F3 p049L — conf. medium |
| P-S3-b | S3 | square pad (wooden landing at the mesh end): steel arrow with W W ? partly above it; a hole just ahead | ≈3×3 | 0 | stop, then break the crates | edges open on the hole side; static | LANDING | the reward over the arrow turns the bounce into a launch toward the hole (mask hint 4) | F3 p049L mask hint 4 — conf. high |
| G-S3-d | S3 | floor hole just past the mesh-end landing | not visible (≈2); landing archway and the next roof | 0 | plain (after stopping) | the arrow bounce + stomp carries a moving player into it / death (fall) (lethal; run-up from the landing); nearby S3-g | TEST | a gap that only kills the player who keeps the tool's momentum | F3 p049L mask hint 4 (screenshot: arrow, crate, hole ahead) — conf. medium |
| P-S3-c | S3 | square pad (moving slab): white slab that moves, with a carpet researcher on or beside it | ≈2×2 | 0 | ride | edges open; moving (axis and cycle not visible) | TIMING-STEP | the stage's only moving footing, shared with a floating enemy | F3 p049R (blurred: researcher on a slab) — conf. low |
| G-S3-e | S3 | moving-platform crossing (slab with a carpet researcher) | not visible; landing walled room with the 2×2 | 0 | ride, plain | platform cycle and the hovering enemy / death (fall) (lethal; run-up not visible); nearby S3-h, E-S3-c | TEST | a timing crossing right before the save | F3 p049R — conf. low |
| P-S3-d | S3 | wide floor (walled roof room): 2×2 crate block, then C3 | ≈4×4 | 0 | walk | edges walled; static | CHECKPOINT-PAD | the save closes mesh 2 and the bonus | F3 p049R ("64コ") — conf. high |

#### B — Bonus (side view, under mesh 2)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | B | bridge/plank (long wooden walkway): two slot crates and a wood crate; a steel ! hangs below the first ledge | ≈10 long | 0 | walk | edges open; static | REST | a long safe floor for the slot lives; the ! under the ledge is out of reach by hand (F3 hint: bazooka or TNT blast) | F3 p057L; P3 p015L shot 28 — conf. high |
| P-B-b | B | wide floor (raised deck with the pyramid): pyramid 4/3/1 with a slot in the bottom row | ≈5 long | +1 | step up | edges open; static | REST | the big crate pile sits on its own raised deck | F3 p057L — conf. high |
| P-B-c | B | stairs (two small steps down): two short blocks stepping down | ≈1–2 each | −1 per step | hop down | edges open; static | STEPPING | a short descent before the gap | F3 p057L — conf. medium |
| G-B-a | B | bottomless pit holding a bowl-shaped object | ≈2–3; landing wooden platform with the outline crate | 0 | plain | function of the bowl not stated / ejected from the bonus (series rule) (lethal; run-up short); nearby B-d | STEPPING | the only gap of the bonus sits between the stair and the switch puzzle | F3 p057L (grey bowl between two platforms) — conf. low |
| P-B-d | B | square pad (wooden outline platform): outline crate that becomes a wooden arrow | ≈4 long | 0 | walk past, come back after the ! | edges open; static; switch-made arrow | STEPPING | the tool for the high crates is built here only after the switch beyond is pressed | F3 p057L; P3 p015L shot 30 — conf. high |
| P-B-e | B | bridge/plank (steel walkway): TNT on top; steel ! directly below the walkway; exit pad beyond | ≈6 long | 0 | stomp the TNT, step back | edges open; static | STEPPING | the blast reaches through the walkway to the switch | F3 p057L; P3 p015L shot 29 — conf. high |

#### S4 — C3 → goal

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S4-a | S4 | wide floor (walled roof room; raised wooden stage at one side): C3 crate on the floor; Nitro/W/slot column on the step | ≈4×4; step ≈2 wide | +1 (step) | slide or spin low | edges walled; static | ARENA | the puzzle column stands where the player lands from the save | F3 p049R; P3 p015L shot 25 — conf. high |
| P-S4-b | S4 | bridge/plank (wooden): plank toward the sabre worker's slab | ≈2×3 | 0 | walk | edges open; static | CHOKE | lines up the jump to the occupied slab | F3 p049R — conf. medium |
| G-S4-a | S4 | bottomless pit to a single slab held by a sabre worker | ≈1–2; landing slab ≈2×2 with the worker on it | 0 | plain | the worker swings when facing you; jump when his back is turned / death (fall), or a hit from the sabre (lethal; run-up end of the plank); nearby E-S4-a | TEST | an occupied landing: the stop before the jump is where the timing is read | F3 p049R — conf. medium |
| P-S4-c | S4 | square pad (single floating slab): the sabre worker stands on it | ≈2×2 | 0 | land, spin him from behind | edges open; static | LANDING | the smallest footing in the stage carries an enemy | F3 p049R — conf. medium |
| G-S4-b | S4 | chasm with bounce (jump carpets in a line) | ≈1–2; landing walled room with the orangutan | 0 | bounce pad (jump carpet), held/high (straight up for the hidden ?, mask hint 6) | no stop on the carpets (inferred) / death (fall between roofs) (lethal; run-up from the slab); nearby S4-c | TEST | the S2 lesson repeated without the header warning: the crate above a carpet | F3 p049R mask hint 6; P3 p015L shot 26; F3 p104L 25–28 — conf. medium |
| P-S4-d | S4 | wide floor (walled roof room): orangutan and a 2×2 block; power stone beside | ≈4×4 | 0 | walk | edges walled; static | REST | last plain room before the switch hallway | F3 p049R — conf. medium |
| P-S4-e | S4 | stairs (end hallway): grey ! and green !, two outline crates and a ? | ≈2–3 wide | +2 (estimate) | walk; spin-touch the ! in mid-jump (TA6) | edges walled; static | CHOKE | a narrow indoor hallway focuses the player on the switches | F3 p049R; P3 p015L shot 27; F3 p104L 29–30 — conf. high |
| G-S4-c | S4 | bottomless pit before the goal arch (plank and a slab with a carpet researcher) | not visible; landing goal arch | 0 | plain | the floating enemy on the slab / death (fall) (lethal; run-up not visible); nearby E-S4-c | TEST | one more occupied crossing after the stage-27 course rejoins | F3 p049R — conf. low |

#### Y — Stage-27 course (yellow gem)

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-Y-a | Y | wide floor (walled roof rooms): start pads; three sabre workers across the course | ≈4×4 each | 0 | walk; bazooka the distant worker (hint 1) | edges walled; static | ARENA | the same rooms as stage 7, more enemies | F3 p056L — conf. medium |
| G-Y-a | Y | bottomless pit between rooftops (single slabs and planks) | ≈1–2; landing slabs and pads | 0 | plain | none / death — restart the course (no checkpoints) (lethal; run-up short); nearby Y-a | STEPPING | known crossings, but every fall costs the whole course | F3 p056L–p056R — conf. medium |
| G-Y-b | Y | chasm with bounce (jump carpets under floating Nitro rows) | ≈1–2; landing slabs and walled pads | 0 | bounce pad (jump carpet), double (high off the carpet), spin-extended (tornado spin over the Nitros) | five floating rows of three Nitros above the line / death — restart the course (no checkpoints) (lethal; run-up from the pads); nearby Y-b, O-Y-b | TEST | the carpet bounce now has to clear explosives: same geometry, harder air | F3 p056R hints 2–3 — conf. medium |
| P-Y-b | Y | stepping stones (three slabs descending): slab chain between two walled pads | ≈2×2 each | −0.5 per slab (estimate) | plain hops | edges open; static | STEPPING | a calmer chain between the Nitro carpet stretches | F3 p056R — conf. medium |
| P-Y-c | Y | wide floor (walled roof room with the yellow gem): last pad; the course then drops into stage 7 before its goal | ≈4×4 | 0 | walk | edges walled; static | REST | the reward pad ends the no-checkpoint run | F3 p056R hint 4 — conf. high |

### Jump sequences

| id | section | count | moves | rhythm | max gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 5 | plain, plain, plain, arrow or enemy-bounce, climb (jump-grab the mesh) | even hops, then one vertical | ≈1–1.5 | P-S1-b, P-S1-e (walled rooms) | no | slab hops between rooms, a height step with two tools, then the first grab: each new move appears once, in order | F3 p048L; F3 p104L 06–08 |
| J-S2-a | S2 | 3 | plain (onto carpet 1), bounce pad, held/high (for the hidden ?) | even (one bounce per beat) | ≈1–2 | P-S2-c (L-room) | yes | carpets bounce on landing, so a carpet pair is a forced two-beat sequence between rooms (inferred from the carpet behaviour) | F3 p048R; P3 p014R shot 22; F3 p104L 14–15 |
| J-S2-b | S2 | 3 | bounce pad, bounce pad, plain (onto the landing) | even (one carpet at a time, big jumps — mask hint 3) | ≈1–2 | P-S2-e (C2) | yes | the second pair rises toward the arch; the guide asks for one carpet per jump because into-screen distance misleads | F3 p048R mask hint 3; F3 p104L 17 |
| J-S3-a | S3 | 2 | arrow (stopped), plain (over the hole) | stop-and-go | not visible (≈2) | P-S3-d (C3 room) | no | the mesh-end landing asks the player to stop before using the arrow, then jump the hole as a separate beat | F3 p049L mask hint 4 |
| J-S4-a | S4 | 4 | plain (onto the guarded slab), plain, bounce pad, held/high | syncopated (wait for the worker's back, then bounce) | ≈1–2 | P-S4-d | no | the occupied slab forces a pause that the carpets then remove: wait, then commit | F3 p049R; F3 p104L 25–28 |
| J-B-a | B | 8 | crate-bounce (rising arc of four ?), plain, plain, plain, plain, arrow (materialised wooden arrow), crate-bounce (three ? descending), plain | accelerating up the arc, then stop-and-go at the switch puzzle | ≈2–3 | exit pad | no | the bonus writes its jump path in crates (the arc), then makes the player backtrack to a tool they built | F3 p057L; P3 p015L shots 28–30 |
| J-Y-a | Y | 8 | plain, bounce pad, double (high off the carpet), spin-extended (tornado float over Nitros), plain, plain, bounce pad, bounce pad | even, with no checkpoint to break it | ≈1–2 | walled pads (no checkpoints) | yes | the hardest air of the stage family: carpet bounces that must clear floating Nitro rows, one life per attempt | F3 p056R hints 2–3 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S3-a | S3 | launch trap before a hole (arrow block with crates above it) (lethal) | on platform (mesh-end landing); hole across the path ahead | static; the bounce is player-triggered; the hole is visible from the landing | wait-and-go (stop and look first), avoid (do not stomp with the bounce momentum) | S3-g, G-S3-d | TEST | turns a reward and a tool into the danger: the momentum, not the hole, is the obstacle (mask hint 4) | F3 p049L mask hint 4 — conf. high |
| O-S4-a | S4 | Nitro on top of a wood/slot column (daruma-otoshi) (lethal) | on platform (raised step beside C3) | static; the slot crate cycles and turns to steel if left — the countdown pushes the player | slide under (take the slot out), destroy low (spin low) | S4-a, C3 | TEACH, TEST | removal order is the whole puzzle; a jump or high spin reaches the Nitro | F3 p049R mask hint 5; P3 p015L shot 25 — conf. high |
| O-B-a | B | TNT on the metal walkway above a ! switch (blast switch) (lethal) | on platform (walkway); switch below | 3 s fuse after a stomp; a spin blows it at once (F3 hint) — the count is the warning | destroy (stomp, then step back) | B-f, B-d outline → wooden arrow | TEST | the blast is the only way to press the switch under the walkway | F3 p057L hint; P3 p015L shot 29 — conf. high |
| O-Y-a | Y | Nitro 2-stack under a platform edge (lethal) | below (under the take-off edge) | static | avoid, shoot (bazooka) | G-Y-a | AREA-DENIAL | punishes a short jump off the pad | F3 p056L — conf. high |
| O-Y-b | Y | floating Nitro rows (five rows of three) above the carpet line (lethal) | overhead / across the path (inside the jump arc) | static; visible ahead | jump over (double jump high off the carpet, then tornado-spin float), shoot (bazooka, only up to the hint-2 platform) | G-Y-b carpets | AREA-DENIAL, TEST | explosives placed in the space a carpet bounce passes through | F3 p056R hints 2–3 — conf. high |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | sabre worker (サーベル作業員) | patrol-1D (paces a fixed spot; swinging type) | walks away and back; swings the sabre when facing Crash; the swishing sound marks the swing (TT 03) | spin (when he shows his back), shoot (bazooka as he turns, TT 01–02) (fails: approaching from the front) | on line in walled room 1 | TEACH, TIMING-GATE | yes (inside a walled room, no gap beside him) | a turn-your-back timing enemy taught where only the sword can hurt | F3 p048L; F3 p047R; P3 p014R shot 20; F3 p104L 01–03 — conf. high |
| E-S1-b | S1 | magic-carpet researcher (魔法のカーペット研究員) | flier (floats slowly back and forth on a fixed route) | the least dangerous Arabian monster; wait for it to come close (F3 p047R) | spin, stomp (jump on; doubles as a step to the upper footing, TT 06), body slam | flank (far corner of room 2) | TOOL/STEP, TEACH | yes | the first height step can be climbed off this enemy | F3 p048L TA1; F3 p047R; F3 p104L 06 — conf. high |
| E-S2-a | S2 | pot-carrying orangutan (オットトウータン) | patrol-1D (staggers along the plank carrying pots) | a spin knocks a pot onto its head and it reels — it can then be stood on to jump higher than normal; a slide at its feet kills it at once | slide (fling into the 1-s box, TA2), spin (turns it into a springboard), stomp (jump on) | on line on the plank (choke), next to the stepped crate group | TOOL/STEP, GUARD | no (on a narrow plank with a carpet researcher hovering beside it) | an enemy designed to be used: projectile (slide) or springboard (spin) | F3 p048R TA2; F3 p047R; F3 p104L 11 — conf. high |
| E-S2-b | S2 | magic-carpet researcher (魔法のカーペット研究員) | flier | hovers beside the plank | spin, fling into (a slid orangutan can take it out, TA2) | flank of the plank | HURDLE | — (repeat) | a second target that rewards the orangutan fling | F3 p048R TA2 — conf. medium |
| E-S2-c | S2 | pot-carrying orangutan (オットトウータン) | patrol-1D | on the L-room beside a steel arrow | slide, spin, stomp (jump on) | on line in the L-room | TOOL/STEP | — (repeat) | a springboard next to an arrow: two ways to the floating ? | F3 p048R — conf. medium |
| E-S3-a | S3 | magic-carpet researcher (魔法のカーペット研究員) | flier (moves along the mesh line) | rides along mesh 2 near its first peak | spin (while hanging), avoid (fails: stomp (not possible while hanging)) | on the mesh line (moving) | HURDLE | — (repeat) | a moving blocker on the hang path forces a spin or a wait mid-traverse | F3 p049L; F3 p104L 19–20 — conf. high |
| E-S3-b | S3 | upside-down scorpion (サカサソリン) | chaser (clings under the mesh and crawls toward Crash with a rustle) | touch = hit; F3: spin it from as far away as possible | spin (from a distance) (fails: touching it; stomp (impossible while hanging)) | on the mesh line (mid-traverse) | GUARD, HURDLE | yes (alone on its leg of the mesh, but over a void) | the mesh-only enemy, spin-only: the hang traverse gets its own threat | F3 p049L; F3 p047R; P3 p014R shot 23 — conf. high |
| E-S3-c | S3 | magic-carpet researcher (魔法のカーペット研究員) | flier | on or beside the moving slab before C3 | spin, stomp (jump on) | moving platform | TIMING-GATE | — (repeat) | two cycles on one crossing: the slab and the enemy | F3 p049R — conf. low |
| E-S4-a | S4 | sabre worker (サーベル作業員) | patrol-1D | paces on a single small slab | spin (when he shows his back) (fails: landing in front of him) | landing platform (single slab) | GUARD, TEST | — (repeat) | the S1 timing enemy returns on the smallest footing of the stage | F3 p049R — conf. high |
| E-S4-b | S4 | pot-carrying orangutan (オットトウータン) | patrol-1D | in the room after the carpets | slide, spin, stomp (jump on) | on line in the room | TOOL/STEP | — (repeat) | a last springboard beside the 2×2 block | F3 p049R — conf. medium |
| E-S4-c | S4 | magic-carpet researcher (魔法のカーペット研究員) | flier | on the last slab before the goal arch | spin, stomp (jump on) | landing platform (last slab) | HURDLE | — (repeat) | keeps the very last crossing occupied | F3 p049R — conf. medium |
| E-Y-a | Y | sabre worker (サーベル作業員) ×3 | patrol-1D | one on an early pad, two together on a later pad | shoot (bazooka from just within range, hint 1), spin (fails: approaching from the front) | on line on walled pads | GUARD | — (repeat) | more of the known enemy on a course without checkpoints | F3 p056L hint 1 — conf. medium |
| E-Y-b | Y | magic-carpet researcher (魔法のカーペット研究員) | flier | on a slab after the archway | spin, stomp (jump on) | landing platform | HURDLE | — (repeat) | occupied slab, as in S3/S4 | F3 p056L — conf. medium |

### Section beats

- **S1** (gaps 3, enemies 2, hazards 0): start slab (two steel arrows) → two rising slabs → room 1: sabre worker + W W (wait for his back) → plank → U-room → plank + single slab → room 2: carpet researcher + 2×2 + steel arrow → arrow or enemy bounce to the upper ledge → ? by the arch → Aku high at the mesh entrance → mesh 1 (grab, then spin) → exit pad: W W → C1
- **S2** (gaps 2, enemies 3, hazards 0): plank: orangutan + carpet researcher + stepped group → carpet → carpet (hidden ? above: straight-up held bounce) → L-room: orangutan + steel arrow + 2×2 + floater → U-room → carpet → carpet (mask hint 3) → landing + archway → floating ? over W W → C2
- **S3** (gaps 5, enemies 3, hazards 1): mesh 2 (side view): W, ? → mesh hole (route round; ? at the hole) → slot above the mesh → carpet researcher riding the mesh → W W → scorpion (spin from afar) → W W → [drop to the bonus platform → B → arrow back up] → mesh-end landing: steel arrow + W W ? → stop → hole → archway → moving slab + carpet researcher → room: 2×2 → C3
- **B** (gaps 1, enemies 0, hazards 1): walkway: 2 slots + W; ! hangs below the ledge → rising arc of four ? → raised platform: pyramid 4/3/1 with slot → two steps down → gap with a bowl → outline platform → steel walkway: TNT over the ! (stomp, step back) → back to the outline (now a wooden arrow) → three ? descending from the green ! → exit pad
- **S4** (gaps 3, enemies 3, hazards 1): raised step: Nitro/W/slot column (slide) → sabre worker → plank → slab held by a sabre worker → carpets (hidden ? above: straight up) → room: orangutan + 2×2 → power stone → end hallway (stairs): grey ! + green ! → outlines + ? → (stage-27 drop-in) → plank + slab with a carpet researcher → goal arch
- **Y** (gaps 2, enemies 4, hazards 2): walled pads + sabre worker → slab → pad (Nitro 2-stack under its edge) → plank + arch → carpet researcher on a slab → pad with two sabre workers → carpet → carpet + slab → pad (bazooka limit; Nitros on the right) → three slabs descending → pad → two carpets under Nitro rows → yellow-gem pad → drop into S4

### Geometry and enemy design logic

1. Rest/test alternation is literal: every walled roof room is a rest or an arena, every crossing between rooms (plank, slab, carpet pair, mesh, moving slab) is the test. The F3 theme tip — stop on each foothold at first — describes this rhythm.
2. Each crossing type is shown once in a calm form and then reused harder: slab hops (S1) → an occupied slab (G-S4-a); mesh 1, short and into the screen (G-S1-c) → mesh 2, long, side-on, with a hole and two enemies (G-S3-a/b); carpets as a pair (G-S2-a) → carpets after a guarded slab (G-S4-b) → carpets under Nitro rows (G-Y-b).
3. Jump carpets are forced steps: they bounce on landing, so a carpet pair is a no-stop two-beat sequence (J-S2-a/b). Pairs are short and always end on a walled room, which keeps the forced part brief.
4. The carpet's high bounce is reused as a vertical reward: the hidden ? above a carpet (S2-b, S4-c) costs no extra tool, only the decision to bounce straight up and to look above the frame.
5. Mesh rules escalate from input to terrain to enemies: grab-then-spin (mask hint 1), a hole in the mesh to route around (G-S3-b), a rider on the line and a spin-only scorpion under it (E-S3-a/b).
6. Enemies here are mostly tools or timing checks, not threats: the carpet researcher is a step (TT 06), the orangutan a projectile or springboard (TA2, F3 p047R); only the sabre worker attacks, and only when facing you.
7. Occupied landings are the main enemy placement: a sabre worker on a single slab (E-S4-a), carpet researchers on the moving slab and the last slab (E-S3-c, E-S4-c). The player must read the enemy from the previous footing.
8. Tools can push the player into gaps: the arrow-plus-crate launch toward the hole at the mesh end (O-S3-a) is the stage's one momentum trap, placed after several safe arrows.
9. The bonus hangs directly under the route (G-S3-c): letting go of the mesh is the entrance and an arrow is the way back, so the optional room costs no detour on the map.
10. Checkpoints close traversal modes — C1 after mesh 1, C2 after the carpets, C3 after mesh 2 and the moving slab — while the stage-27 course (Y) uses the same parts with no checkpoint at all: the hardest air has the least recovery.
11. Hazard count is tiny on the main route (one Nitro column, one launch trap): the stage's danger is the fall, and its escalation comes from footing size and forced bounces rather than from obstacles.
12. The time-trial line is a vertical line: hold-jump high bounces, spins at the apex to extend air, catching the mesh out of a jump-spin (TT 07–08, 14–15, 27) — the geometry rewards height control more than speed.

### Geometry transfer to the skate game

1. Rooftop rooms and crossings: walled 5×6 m `platform` rooms with 0.6–1.2 m parapets, linked by 2.3 m-wide planks and single 2.3 m slabs over a `pit` (gaps 1.2–1.7 m, far inside the 5.6 m running jump). Rooms carry checkpoints and enemies; plank and parapet edges grind by default, so a skater gets ledge lines across the same course.
2. Carpet pairs as `trampoline` decks (≈2.3×2.3 m) 1.2–2.3 m apart, always two per run and always ending on a room; put one crate high above the second deck, reachable only with the held-jump bounce (`amp`), outside the default framing; show one such crate openly first, then hide the second (S2-b → S4-c).
3. Mesh analog: we have no hang mesh, so use an authored `rail` or `rope` across a void as the traversal line, with one break to hop (the mesh hole), one `floater` patrolling along it (no stomp, like the spin-only scorpion), crates on the line ≥5 m apart (smashed at ≥12.5 m/s), and a `bonusplatform` below the line that the player reaches by dropping off it.
4. Occupied slab: a single 2.3 m slab after a 1.5 m gap with a `charger` on it; the counter is to wait on the previous room for its telegraphed dash to pass, then jump — the Hang 'em High sabre-worker timing.
5. Launch trap: a steel arrow with a crate floating above it, 3–5 m before a `pit`: arrow (3.77 m) plus stomp (2.87 m) with forward speed carries a running player several metres on, so the reward becomes the fall. Place it only after two safe arrows.
6. Hard variant without checkpoints: reuse the same rooms, slabs and trampolines with floating Nitro rows one crate above the bounce apex; the double jump (+1.74 m) is the counter, as the stage-27 tornado float was in Crash 3.

## Open questions / uncertainties

- C3: printed 64, drawn 63; total 95 (gamepressure) agrees with the drawn crates plus the stage-27
  Nitros, so the label may be a misprint — or one main crate is undrawn and the total would be 96.
- Whether the 17 stage-27 Nitros are in stage 7's tally is an inference from the arithmetic and from
  gamepressure's "no need to visit the secret area".
- S1-e: the gutter bubble is blurred (two wood-looking crates).
- 2×2 blocks: S1-b is flat; S4-b is two 2-high columns; the others' height is unclear at map scale.
- The green ! in the bonus (no Nitros there) — role unknown.
- S3-c geometry (on the mesh at the hole or below it).
- Prima recommends a super body slam for S4-c, which conflicts with F3's straight-up carpet jump.
- Geometry: jump carpets are assumed to bounce automatically on landing (no-stop); no source states it in those words.
- Geometry: mesh 1 length is hidden in the page gutter; mesh 2 length (≈25–35 u) is estimated from crate spacing.
- Geometry: the moving slab before C3 (P-S3-c, G-S3-e) is blurred in the gutter: axis, cycle and whether the carpet researcher rides it are not visible.
- Geometry: the bowl-shaped object in the bonus gap (G-B-a) is unexplained by both guides.
- Geometry: the two steel arrows on the start slab have no stated use.
- Geometry: the return from the bonus platform to the mesh by its steel arrow is inferred from the arrow bubble.
