# Crash 3: Warped — Stage 1 Toad Village  (ケロッパの じょうかまち)

Sources: F3 p013–p014 (book pp.18–21: stage map, Aku advice 1–7, time-attack tips 1–6, checkpoint counts),
F3 p019L (book p.30, medieval bonus-round hint strip, stage 1: boxes ×7, 1UP ×1), F3 p101L (book p.194,
time-trial route "スゴイの01", frames 01–32, staff best 0:39:90), F3 p006L (stage table: bonus ○, trophy
times), F3 p005R (how to read the stage pages), F3 p011 (box legend); P3 p004R–p005L (book pp.5–6, shots 1–12:
masks, slot box, knight, crystal, last two crates, bonus area, time trial). Web corroboration: gamepressure
N. Sane Trilogy "Toad Village" page (total 42, stacked bounce crates warning, bonus = 7 wooden crates incl. a life).

Evidence level:
- Read directly: every crate icon on F3 p013–p014 (zoomed; the 2×2 block in S1 needed a 3–4× zoom to see that
  it is two crates wide), both checkpoint counts (C1 **12**, C2 **32**), all time-trial badges, the bonus strip on
  F3 p019L, the P3 captions, the F3 time-trial captions.
- F3 p005R states the counting rule: a checkpoint number is the number of boxes that have appeared up to that
  checkpoint **including the C box itself**; a number in brackets would add Nitro (none here). The arithmetic
  shows the 7 bonus boxes are included in C2 (12 + 13 main + 7 bonus = 32).
- Badge convention (F3 p005R legend, read directly): red 1 / blue 2 / green 3 square beside a crate = the crate
  becomes a 1/2/3-second time-stop crate in time trial; orange A = it becomes an Aku Aku crate in time trial.
  The drawn icon is the normal-mode crate. F3 draws the slot crate as a plain white cube (legend p011).
- Inferred: exact height of the floating striped crate in S1-c and of the floating bonus crates; whether S1-f's
  Aku crate stands on the road or at its edge.
- Totals reconcile exactly: map sum 42 = F3 C1 12 + C2 32 + S3 10 = gamepressure "destroy all 42 crates".

## At a glance
| Field | Value |
|---|---|
| Theme | Medieval castle town on a sunny hillside: a dirt road between low stone/grass walls, wooden plank bridges over trenches, wading ponds, two stone bridges, castle gate at the end |
| Camera | into-screen corridor, the road curving gently up-right on the map; walls on both edges can be run on (the time-trial line uses them) |
| Total boxes | **42** (F3 map sum; reproduces C1 12 and C2 32; gamepressure 42) |
| Boxes per route | main road **35** · bonus round **7** · no gem path · no death route |
| Checkpoints (F3 cumulative, incl. the C box) | C1 **12** · C2 **32** (includes the 7 bonus boxes) |
| 1UP | 1 crate (bonus round). Lives also come from 3 slot crates if broken while showing the Crash face |
| Aku Aku | 2 (S1 before the first hole run; S2 on stone bridge 1). Both are A-badged, i.e. still masks in time trial |
| Slot crates | 3 (right after C1; the last two boxes before the goal gate) |
| Striped | 5 on the road (S1 three, S2 one, S3 one) + 1 in the bonus |
| TNT / Nitro / ! / outline / iron / arrows | none |
| Time-trial crates | 1-s ×6, 2-s ×2 (10 s total); staff record 0:39:90 |
| Gems | clear gem = all 42 boxes (bonus included; P3 s6: "if the counter box at the end doesn't turn into a gem … did you miss the bonus area?"). No coloured gem |
| Crystal | on stone bridge 2 in S3 (P3 s5) |
| Trophies | sapphire 1:05:00, gold 0:57:50 (F3 p006L) |
| Enemies | goats (ヤギッパ) ×5 walking the road, frogs (ケロッパ) ×3 in wading ponds, sword-swinging "berserker" lab assistants (knights) ×2 |
| Hazards | pits at the road edges (fatal even with a mask — F3 intro), wading ponds that slow running (TA2) |
| Difficulty notes | F3: simple layout, the only enemy worth respecting is the knight; with a mask you can push on near monsters. P3 s4: wait until the knight sticks his sword in the ground, then spin him from behind |

## Route skeleton
```
START ─ S1 (12 incl. C1) ─ C1 ─ S2 (13 main + bonus 7 + C2 = 20) ────────────── C2 ─ S3 (10) ─ GOAL gate
  W|? abreast, S/S sandwich,     slot!, 3-stack, ?, knight, [A] on bridge 1       row of 3 at frog pond,
  S, ?, ~pond~, A, 2x2 block       │                                              4-cluster, knight,
                                   └─ ? pad just past bridge 1 ─ BONUS (7) ─┐      crystal on bridge 2,
                                      returns to the road at the same spot ─┘      ?, 2 slots at the gate
                                   then 6-block at frog pond 1
```
| Section | Boxes | Cumulative |
|---|---|---|
| S1 start → C1 | 12 (incl. C1) | 12 (F3) |
| S2 C1 → C2, main road | 13 (incl. C2) | — |
| Bonus round (from the ? pad in S2) | 7 | 32 at C2 (F3) |
| S3 C2 → goal | 10 | 42 |

## Section-by-section map

### S1 — Start → C1  (F3 cumulative 12)
```
START → (stopwatch) → [W]······[?]  → pits at right edge → [S]  (striped floating above striped,
                     left edge  right edge                  [S]   right side)
      → pit → [S] → ═plank═ → e:goat → [?] → ~~big wading pond~~ (TA2: run on the right wall)
      → [A] → [W][W2]   → pit → C1 → e:goat
              [W][? ]  (2 wide x 2 high, 2-s crate top right)
```
| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S1-a | first stretch after the stopwatch, left edge of the road | wood ×1 | SINGLE | walk/spin | ON-PATH SINGLE TEACH | First input of the game world: hit the box. Set at the edge, not the centre, so the player learns the road is wider than the line of travel | F3 p013L zoom (tv_start) | high |
| S1-b | abreast of S1-a on the right edge | ? ×1 | SINGLE | walk/spin | ON-PATH SINGLE TEACH | Paired across the road with S1-a: to get both you must cross the full width once — the opening teaches sweeping, not running straight | F3 p013L zoom | high |
| S1-c | after the first edge pits, right side | striped ×2 | SANDWICH: one on the ground, one floating above with a gap | bounce | SANDWICH TEACH REWARD SUPPORT-ORDER COUNT-TRAP | F3 advice 1: stand between the two striped boxes and keep jumping — 20 fruit (2 per hit × 5 hits each). Gamepressure (N. Sane): if the lower one is destroyed first the upper one can no longer be reached, so the fruit lesson doubles as the game's first breaking-order lesson | F3 p013L callout 1; gamepressure TV | high (layout) / medium (unreachability claim) |
| S1-d | just before the first plank bridge | striped ×1 | SINGLE | jump on it / spin | ON-PATH SINGLE | Third striped box in a row: reinforces "bounce on these" while the player is still on safe ground | F3 p013L zoom | high |
| S1-e | after the plank and the first goat | ? ×1 | SINGLE | walk | ON-PATH SINGLE ENEMY-LINK | Reward placed just past the first walking enemy | F3 p013L zoom | high |
| S1-f | after the big wading pond (page gutter) | Aku ×1 (A badge) | SINGLE | walk | ON-PATH AKU TIME-TRIAL | First mask, handed out right before the stretch of road-edge pits and C1. F3's intro warns that pits kill even with the mask — the mask is for the goats/knights, not the holes | F3 p013R zoom | high |
| S1-g | right edge after the Aku, before the last pit | wood ×3, ? ×1 (2-s badge on the top-right wood) | GRID 2 wide × 2 high | spin bottom, jump | ON-PATH GRID STACK TIME-TRIAL | First multi-crate block and first time crate. TT tip 3: break only the upper box with the small jump-spin (X+□ together) so no time is lost; target 0:19:00 | F3 p013R zoom ×3 (tv_r_mid); F3 TA3 | high |
| S1-C | after the pit, start of the next straight | checkpoint | SINGLE | walk | CHECKPOINT | C1 at 12 | F3 p013R | high |

S1 is a tutorial strip with no time pressure: two free boxes, a striped "fruit machine", one enemy, one
pond, then the first mask and the first block just before the first real hazard (edge pits). Every crate is on
or beside the road; nothing needs a detour.

### S2 — C1 → C2  (F3 cumulative 32 = 12 + 13 main + 7 bonus)
```
C1 → e:goat → [slot]! → ═plank═ ═plank═ → ~frog pond~ → [W2]  → [?] → e:knight → stone bridge 1 [A]
                                                         [W ]
                                                         [W ]  (3-stack, 2-s crate on top)
   → (? pad → BONUS) → ═plank═ → e:goat → ~frog pond 1~ [W][W1][S]   → ═plank═ → C2
                                                         [?1][W][W1]  (3 wide x 2 high)
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S2-a | a few steps past C1 (goat in between) | slot ×1 | SINGLE | spin at the right moment | ON-PATH TIMED LIFE CHECKPOINT COUNT-TRAP | F3 advice 2: if you dawdle in front of the C box the slot crate can no longer be taken; P3 s3: slot boxes run on a timer and turn into unbreakable steel; break it on the Crash face for a life. Put right after the checkpoint so that a player who stops to admire C1 loses the all-box run | F3 p013R callout 2; P3 p004R s3 | high |
| S2-b | after two plank bridges and the first frog pond | wood ×3 (2-s badge on the top crate) | STACK (3 high) | spin bottom; or a held jump for the top | ON-PATH STACK ENEMY-LINK TIME-TRIAL | F3 advice 3 (pointing at this pond): a monster you knock out flies, and a box in its path breaks — the frog is a projectile aimed at the stack. TT tip 4 / TT frame 15: the 2-s crate is on the third tier; a dashing big jump reaches it | F3 p013R zoom; F3 TA4; F3 p101L fr.15 | high |
| S2-c | just after the stack, before the first knight | ? ×1 | SINGLE | walk | ON-PATH SINGLE | Bait before the knight: collecting it puts the player in the knight's swing zone | F3 p013R | high |
| S2-d | on stone bridge 1, after the knight | Aku ×1 (A badge) | SINGLE | walk | ON-PATH AKU REWARD | Second mask, reward for passing the knight and insurance for the frog ponds and the second knight ahead | F3 p013R zoom; P3 p004R s2 ("two of them in this level") | high |
| S2-e | at frog pond 1, after the bonus pad, a plank and a goat | wood ×4, ? ×1, striped ×1 — top row W, W(1-s), S; bottom row ?(1-s), W, W(1-s) | WALL 3 wide × 2 high | slide from a distance, then bounce the dropped striped | ON-PATH WALL GRID SUPPORT-ORDER ENEMY-LINK TIME-TRIAL | F3 advice 5: the striped box sits on top, and a spin attack would break it — slide into the block from a distance instead, so the striped box drops intact and pays out by bouncing. Three time crates; TT frame 20 breaks three at once with one spin at the centre | F3 p014L zoom; F3 p014R callout 5; F3 p101L fr.20 | high (composition) / medium (which 3 crates fr.20 means) |
| S2-C | after the next plank | checkpoint | SINGLE | walk | CHECKPOINT | C2 at 32 | F3 p014L | high |

### Bonus round (from the ? pad just past stone bridge 1; F3 p019L: boxes ×7, 1UP ×1)
```
? pad → sloped walkway → step · step (small gaps) → walkway [S] ... [W][L] ... [?]  ... [?]━step━[?] → slope → ? pad
                                                                 [W]         [?]
                                                          (W floats one   (floats high)
                                                           crate above)
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| B-a | first long walkway after the step gaps | striped ×1 | SINGLE | bounce | BONUS REWARD TEACH | F3 hint: don't spin it — jump on it for 10 fruit | F3 p019L zoom | high |
| B-b | middle of the walkway | wood ×1, 1UP ×1 | PAIR side by side | spin | BONUS LIFE | The life sits at walking height; P3 s9: "you should have seven lives by now" | F3 p019L zoom; P3 p005L s8–s9 | high |
| B-c | directly above B-b, one crate-gap up | wood ×1 | SINGLE, floating | jump from B-b / bounce | BONUS HIGH SANDWICH | A floating crate over the pair: break the pair and the crate above is still reachable by a jump, or bounce on the pair first | F3 p019L zoom | medium (gap height) |
| B-d | further along, high above the walkway | ? ×1 | SINGLE, floating ~2–3 crates up | jump/bounce | BONUS HIGH | The only crate needing a deliberate high jump in the level | F3 p019L zoom | medium (height) |
| B-e | on the walkway before the last step | ? ×1 | SINGLE | walk | BONUS ON-PATH | Plain pick-up | F3 p019L | high |
| B-f | on the raised last step | ? ×1 | SINGLE | jump | BONUS ON-PATH | Last box before the exit pad | F3 p019L | high |

F3's hint for this strip: there is nothing to fail unless you fall at the very start. P3 s7–s8: the pad is "an
unusual platform in the middle of the path" just after the first bridge; the HUD shows boxes taken / total.

### S3 — C2 → goal  (10; total 42)
```
C2 → ~frog pond 2~ [W1][?1][W1] (row of three)  → [?][S]  → e:knight → stone bridge 2 (crystal)
                                                   [W][?]  (2x2 footprint, striped back right)
   → e:goat → [?] → e:goat → ~last pond~ → [slot]       → castle gate = GOAL
                                               [slot]   (placed diagonally)
```
| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | frog pond 2, right after C2 | wood ×2, ? ×1, all three 1-s badges | ROW (diagonal) | spin the middle | ON-PATH ROW ENEMY-LINK TIME-TRIAL | TT tip 5: spin the middle box and all three break — no need to step left and right (target 0:34:00). TT frames 21–22: spin the oncoming frog so it flies into the left box, jump-spin the other two and hop onto the right wall — "the hardest spot of the course". P3 s11 shows the three "1" crates in a row on a ledge | F3 p014L zoom; F3 TA5; F3 p101L fr.21–22; P3 p005L s11 | high |
| S3-b | after the pond, before the second knight | ? ×2, wood ×1, striped ×1 (striped at the back right) | GRID 2 × 2 footprint | spin, but mind the striped | ON-PATH GRID SUPPORT-ORDER | F3 advice 6: the back-right box is striped — don't spin carelessly (spinning it breaks it for little fruit) | F3 p014R zoom; callout 6 | high |
| S3-c | after the crystal bridge and a goat | ? ×1 | SINGLE | walk | ON-PATH SINGLE | Last ordinary box | F3 p014R | high |
| S3-d | after the last pond, in front of the castle gate | slot ×2 | PAIR placed diagonally | spin quickly | ON-PATH TIMED COUNT-TRAP LIFE | F3 advice 7: take both slot crates fast or all your effort is wasted (they turn to steel and the gem is gone). P3 s6: "these are the last two crates". TT frame 30: the record line threads between them | F3 p014R callout 7; P3 p004R s6; F3 p101L fr.30 | high |

## Enemies and hazards
| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | road-edge pits (blue notches) | right edge before S1-c and again before C1 | Crates stay on the road surface; the pits only punish wide sweeps (S1-b, S1-g sit just before pits) |
| S1 | goat ×1 | after the first plank | Guards S1-e |
| S1 | big wading pond | page gutter between S1-e and S1-f | Slows running (TA2); the mask S1-f waits on the far bank |
| S2 | goat ×1 | just past C1 | Between C1 and the slot crate: dealing with it eats the slot's time window |
| S2 | frog ×1 in pond | before S2-b | Projectile for the 3-stack (advice 3) |
| S2 | knight ×1 | after S2-c, before bridge 1 | P3 s4: wait for the sword to stick in the ground, spin from behind; S2-d mask is the reward |
| S2 | goat, frog ×1 in pond 1 | before and at S2-e | The 6-block stands in the frog's pond |
| S3 | frog ×1 in pond 2 | at S3-a | TT: knock it into the left box of the row |
| S3 | knight ×1 | after S3-b, before the crystal bridge | Guards the crystal, not crates |
| S3 | goats ×2 | either side of S3-c | Escort the last ordinary box |

## Puzzle rooms and dependency chains
**P1 — Striped sandwich (S1-c).** Setup: a striped crate on the ground with a second floating above it. Correct
sequence: stand between, jump repeatedly — the head hits the upper box and the landing bounces off the lower one,
5 hits each. Tempting wrong sequence: spin the lower box first. Loss: fruit (20 → a few) and, per gamepressure,
the upper box becomes unreachable → all-box run lost. Why it works: the first puzzle is also a reward machine, so
the correct order is self-motivating.

**P2 — Slot crate after C1 (S2-a).** Setup: a slot crate a few steps past the checkpoint, a goat in between.
Correct: keep moving, break it while it shows the Crash face (life) — or at least before it turns steel.
Wrong: linger at C1 / fight the goat slowly. Loss: one box → no clear gem. Why: checkpoints invite a pause; the
level punishes that pause once, early, in a cheap place.

**P3 — Frog-pond projectiles (S2-b, S2-e, S3-a).** Setup: every frog pond has a crate group beside it. Correct
(optional): spin the frog so it flies into the crates. Wrong: nothing is lost, it is a shortcut. Why: it plants
the series' "enemies are tools" idea in stage 1; the time trial turns it into a required trick (TT fr.21).

**P4 — Payout order in mixed blocks (S2-e, S3-b, bonus B-a).** Setup: a striped crate on top of / at the back
of plain crates. Correct: slide the bottom row from a distance (S2-e), avoid spinning the striped (S3-b), jump on
the bonus striped. Wrong: spin. Loss: fruit only (the box still counts). Why: teaches that *how* you break a
crate matters, without endangering the all-box goal.

**P5 — Two slot crates at the gate (S3-d).** Same rule as P2 at the moment the player relaxes; P3 s6 explicitly
uses the gate as the all-box audit ("did you miss the bonus area?").

## Design logic of this level
1. **Flat density, no detours.** 35 main-road boxes in groups of 1–6, all on or beside the road. The all-box
   goal differs from the clear goal only by the bonus round (17 % of the total) and three slot crates.
2. **Teaching order:** single box → box on the other edge (sweep) → striped sandwich (bounce + order) → striped
   single → enemy → pond → mask → first 4-block and first time crate → checkpoint → timed crate → stacks with
   an enemy projectile → knight → mask → bonus → 6-block → C2 → row → mixed grid → slot pair. Each new idea appears
   once, alone, before it is combined.
3. **The checkpoint is a trap trigger.** Slot crates sit right after C1 and right before the goal: the two places
   where players naturally stop. It is the only real count trap besides the bonus.
4. **Masks bracket the hazards.** Both masks precede the next enemy cluster (pits + goat before C1; ponds +
   knight 2 after bridge 1). The intro states the limit: masks don't save you from pits.
5. **Ponds are crate stations.** Each frog pond holds or borders a crate group (3-stack, 6-block, row of three),
   so the slowing water, the enemy and the reward share one spot.
6. **Striped crates teach the payout economy** (sandwich 20 fruit, bonus "jump don't spin", 6-block "slide don't
   spin", 4-cluster "don't spin carelessly") — four separate warnings in one stage.
7. **Three equal thirds.** Main-road crates per section 12 / 13 / 10; the bonus inflates C2 to 32.
8. **Time-trial overlay uses height.** Time crates sit on the top of the 2×2 block (small jump-spin to take only
   the top), the third tier of the stack (big dash jump), inside the 6-block and in the row of three: the trial
   is about vertical precision, while the walls flanking the road give the fast line (F3 p101L intro: use the
   walls on both sides, the shortest line wins; frames 02, 06, 10, 17, 27–28 are wall hops).
9. **Bonus = safe surplus.** 7 boxes, a life and two floating crates on a strip where only the opening jump can
   kill; it sits right after the first knight as a breather.

## Transfer to the skate game
1. **Edge pair as an opener (S1-a/b).** Put the first two crates 2–3 m either side of the line, ~10 m apart, on
   foot-friendly ground before the first skate line. On the board below 12.5 m/s they would trip the rider, so the
   opener must be an on-foot lesson or sit where charging to smash speed is natural.
2. **Sandwich with a board-specific trap (S1-c).** Multi-hit crate on the ground, a second multi-hit floating one
   crate-gap (~1.2 m) above. On foot: 10 stomp bounces. On the board at ≥12.5 m/s the lower one is plowed (8 % tax)
   and the upper stays floating at ~2.3 m, above a full-charge ollie (1.7 m) — the gamepressure trap. Use it once,
   with a wooden arrow within reach as the recovery tool, and never on a forced skate line.
3. **Wall-top line + crate rows (walls, S3-a).** Flank a road with low grindable ledges and put a 3-crate row of
   equal height on the road edge: any ≥2-crate row is a rail in our game, so "spin the middle to get all three"
   becomes "grind the row and break all three in one move".
4. **Payout crate on top of a 2-high wall (S2-e).** 3 wide × 2 high, multi-hit top-middle: plowing the bottom row
   (3 crates ≈ 22 % speed loss) lets the top row settle intact, after which the multi-hit pays 5 stomps on foot.
   The correct order is "fast low hit first, then stomp", the opposite of the instinct to stomp from above.
5. **No slot crates in our toolkit:** keep the lesson by placing a crate 2–4 m past every checkpoint on the exit
   line so the first move after a respawn re-engages the rider.
6. **Enemy beside every crate group (ponds).** Body-slam shock radius is ~3.4 m: an enemy within 3 m of a cluster
   lets one slam clear both, the equivalent of the frog projectile.

## Open questions / uncertainties
- Height of the floating striped crate in S1-c and whether the lower one really strands the upper one in the PS1
  original (gamepressure describes the N. Sane remake).
- Which three crates TT frame 20 breaks with one spin (the 6-block is inferred from the pond and clock times).
- The bonus floating crates' exact heights (B-c, B-d).
- Enemy counts are from the map figures; the map may omit a goat or frog that the game has.
