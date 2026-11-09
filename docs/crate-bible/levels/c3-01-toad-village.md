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
START ─ S1 (12 incl. C1) ─ C1 ─ S2 (13 incl. C2, + bonus 7) ─────────────────── C2 ─ S3 (10) ─ GOAL gate
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
| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
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
| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
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
| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
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
| id | position | composition | arrangement | access | tags | why it is here | evidence | confidence |
|---|---|---|---|---|---|---|---|---|
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

## Geometry, obstacles and enemies

Sources for this block: F3 p013–p014 maps (route crops at native resolution, including a zoom of the two edge notches near the start); F3 p013L intro (holes kill even with Aku), F3 p013R TA2 (pond slows running), callout 2 screenshot; F3 p012R (medieval monster list: goat ヤギッパ, frog ケロッパ, berserker lab assistant バーサーカー研究員, with counters); F3 p019L (bonus side view and hint); F3 p101L (time-trial frames 01–32 and captions); P3 p004R s2–s6 and p005L s7–s12. Unit u = one crate. The F3 road is stylised: widths come from screenshots where a crate is in frame and are ranges. In the TT frames ponds and holes both look dark; they are told apart by the captions (池 pond vs 穴 hole), by the ripples of a wading Crash (fr.21) and by the map colours (blue water vs dark pits). The "why" column is design inference.

### Camera and route shape
- **Into-screen walled road for the whole main route**: a sandy road ≈6–9 crates wide between low stone walls (≈1 high and ≈1 thick) that curves gently right (lower-left to upper-right on F3 p013–p014). It narrows twice, to ≈3–4 u, at the two stone bridges, each entered between tall gate posts.
- **No forks.** The only off-route space is the bonus, entered from a pad on the road. The wall tops are a parallel skill lane: the record line rides them, switching walls at holes (F3 p101L intro).
- Bonus: side view along a plank walkway on the castle wall (P3 s8).
- Terrain variety comes from water and holes, not height: the main route has no climbs; the only raised footing is the wall tops, the bonus pad, the stone ledge under the row of three and the bonus walkways.

### Platforms and gaps (section by section; table per section)

**S1 — start → C1**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | wide floor: sandy walled avenue between low stone walls (walled: stone walls ≈1 high, ≈1 thick, runnable) | ≈6–9 wide (P3 s2: a crate is a small fraction of the road); start straight several screens long | 0 | walk | — | REST, TEACH | A wide, flat, enemy-free opening: the W and ? stand on opposite edges, so the first thing learned is that the road is wider than the line of travel | P3 p004R s2; F3 p013L; F3 p101L fr.01–04 · medium |
| P-S1-b | S1, S2, S3 | narrow ledge: the tops of both side walls (open wall top) | ≈1 wide, ≈1 high, the full length of the road except where a hole or house breaks it | +1 | jump up (≈1) and run; drop down, do not jump (cap. 10) | a house doorway snags the feet on the right wall (cap. 13) | STEPPING | A second lane above the road: the record line rides the wall tops to skip ponds and enemies and switches walls at holes (TT caption 02: run the right wall, move to the left wall at the hole). The level offers a skill lane without a fork | F3 p101L intro, fr./cap. 02–03, 06–07, 10, 14, 17–18, 22–24, 27–30; F3 p013R TA2 · high |
| G-S1-a | S1 | floor hole notched into the right edge (the first hole) (lethal) | ≈2–3 across (one third to half of the road) × ≈2–3 along; landing the open left half of the road; run-up start straight (long) | 0 | walk — step round it on the open half; no jump needed | none / death (no protection helps: F3 intro) | TEACH | Observed: the first lethal geometry is a partial-width notch on the side the player just swept to for the ? (S1-b). Inferred: "edges kill" is taught without forcing a jump; it also ends the right wall-top line, so the expert switches walls here (cap. 02). Nearby: S1-b, S1-c. | F3 p013L zoom; F3 p013L intro; F3 p101L cap. 02 · medium |
| G-S1-b | S1 | floor hole notched into the left edge (the second hole) (lethal) | ≈2 across (about a third of the road) × ≈2 along; landing the open right part of the road; run-up ≈5–8 after pit 1 | 0 | walk — step round it | none / death | — | Holes alternate sides, so the road becomes a gentle slalom; the striped sandwich S1-c stands between the two notches, so the bouncing lesson happens between two lethal edges. Nearby: S1-c, S1-d. | F3 p013L zoom · medium |
| P-S1-c | S1 | bridge/plank laid across a trench (brown band across the full width) (walled) | full road width × ≈1–1.5 along | 0 | walk | — | — | One of five plank crossings that punctuate the road at fairly even intervals: a visual beat with no risk (whether the trench beside a plank can be fallen into is not shown) | F3 p013L · medium |
| G-S1-c | S1 | wading pond (safe water) across the full road at the page fold: the big pond (not lethal) | full width × ≈1.5 road widths along (≈9–13 at map scale); landing road beyond, with the Aku crate S1-f; run-up goat stretch | 0 (sunken, wade in and out) | wade + running — wade, or run the right wall top (TA2) | none / slowed, no death (TA2: running speed drops inside the pond) | — | Water that cannot kill comes before any jump test, and it slows the approach to the first mask and the first block. The record line jumps along the curve onto the right wall instead (cap. 06; TA2). Nearby: S1-e, S1-f. | F3 p013L–p013R; F3 p013R TA2; F3 p101L fr./cap. 05–07 · low |
| G-S1-d | S1 | small floor hole notched into the left edge near the Aku and the 2×2 block (lethal) | ≈1–2 across × ≈1–2 along; landing road; run-up not visible | 0 | walk | none / death | — | A last edge reminder before C1; it sits on the side away from the 2×2 block, so a slide or spin into the block does not end in it. Nearby: S1-f, S1-g. | F3 p013R route · low |
| P-S1-d | S1 | wide floor: dry ground with C1 (walled) | ≈6–8 wide | 0 | walk | — | CHECKPOINT-PAD | C1 stands on dry road just after the pond and the block, but the next hole is only a few steps ahead (G-S2-a) | F3 p013R; callout 2 screenshot · medium |

**S2 — C1 → C2**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-S2-a | S2 | floor hole: dark rectangular hole with earth sides in the right half of the avenue just past C1 (lethal) | ≈2–3 across (a third of the road) × ≈1.5–3 along; landing the open left half; run-up ≈2–4 from C1 | 0 | walk — pass on the left half | goat just beyond, then the slot crate / death | — | The respawn point faces a lethal hole; the goat and the slot crate behind it make the player hurry past it (callout 2: dawdle at C1 and the slot crate is lost). Nearby: S1-C, S2-a, E-S2-a. | F3 p013R route + callout 2 screenshot; F3 p101L fr.09 · medium |
| P-S2-a | S2 | bridge/plank: two plank crossings close together after the slot (walled) | full road width each, ≈1–1.5 along, ≈2–4 apart | 0 | walk | — | — | A double beat right after the timed crate | F3 p013R; P3 p004R s3 (dark trench behind the slot crate) · medium |
| G-S2-b | S2 | frog pond (safe water) on one half of the road, beside a giant boulder (not lethal) | ≈3–4 across (half the road) × ≈3–4 along; landing dry strip between the pond and the boulder, where the 3-stack S2-b stands; run-up after the planks | 0 (sunken) | wade + walk — walk the dry strip or wade; TT jumps from the boulder side onto the stack (cap. 15) | frog E-S2-b inside / slowed, no death | — | Pond, boulder, crate stack and frog share one spot: the dry strip is a choke, and advice 3 wants the frog flung into the stack. Nearby: S2-b, E-S2-b, O-S2-a. | F3 p013R route; F3 p101L fr./cap. 14–15 · medium |
| G-S2-c | S2 | floor hole notched into the right edge after the 3-stack (lethal) | ≈1–2 across; landing road; run-up not visible | 0 | walk | none / death | — | An edge notch right before the ? crate that baits the player toward the knight. Nearby: S2-c, E-S2-c. | F3 p013R route · low |
| P-S2-b | S2 | stone bridge 1: a narrower stone causeway entered between two tall gate posts (low parapets and gate posts) | ≈3–4 wide (P3 s5 shows bridge 2) × ≈1–1.5 road widths long | 0 | walk; pass the knight after his swing | — | CHOKE | The road narrows from ≈6–9 to ≈3–4 exactly where the knight stands, so the first real enemy cannot be bypassed widely; the mask S2-d waits on the bridge as the reward | F3 p013R route (knight on the bridge); F3 p101L fr.16 (gate posts); P3 p004R s4–s5 · medium |
| P-S2-c | S2 | round woven bonus pad standing in the avenue just past the first knight (open) | ≈1.5 across | not visible (a low drum) | jump on | — | BONUS-PAD | Placed right after the first knight as a breather; P3 calls it an unusual platform in the middle of the path | P3 p005L s7, s12; F3 p014L; F3 p101L fr.17 · high |
| P-S2-d | S2 | bridge/plank across a trench after the bonus pad (walled) | full road width × ≈1–1.5 | 0 | walk | — | — | Fourth plank beat | F3 p014L · medium |
| G-S2-d | S2 | pond (safe water) spanning nearly the whole road, with the 6-block standing in it (frog pond 1) (not lethal) | nearly full width × ≈4–6 along (map: about one road width); landing C2 on dry road just beyond; run-up goat stretch | 0 (sunken) | wade + walk — wade, or take the plank walkway along its side | frog E-S2-e on the far rim; the 6-block S2-e stands in the water / slowed, no death | — | The biggest crate block stands in slow water, so the slide that advice 5 asks for is set up from the bank. TT 20 shows a plank walkway along one side of the pool: a dry lane past the block. Nearby: S2-e, E-S2-e, S2-C. | F3 p014L route; F3 p101L fr./cap. 20 · medium |
| P-S2-e | S2 | plank walkway along one side of the 6-block pond (open: water on one side) | ≈1 wide × pond length | 0 | walk | — | SAFE-ISLAND | A dry lane beside slow water: wading to the block and walking past it are both offered | F3 p101L fr.20 · low |
| P-S2-f | S2 | wide floor: dry ground with C2 (walled) | ≈6–8 wide | 0 | walk | — | CHECKPOINT-PAD | C2 sits right at the pond exit; a plank and the next pond follow at once | F3 p014L · medium |

**BONUS — side view (F3 p019L)**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | BONUS | bridge/plank walkway along a castle wall (side view): entry ? pad, a curved plank ramp up ≈1, a walkway ≈4 long (open front edge) | ≈4 long | +1 (ramp) | walk | — | REST | A calm start before the only spot where one can fall | F3 p019L diagram; P3 p005L s8 · high |
| G-B-a | BONUS | stepping slabs: two short slabs (≈1 long, each ≈0.3 higher) and then the raised walkway, separated by hairline gaps (not lethal) | <0.5 each; landing ≈1 slabs, then the raised walkway (≈2.5); run-up ≈4 (walkway) | +0.3, +0.3, +≈0.2 | plain | none / falling ends the bonus (no life lost) | TEACH | F3 hint: unless you fall at the start, nothing can fail — these tiny gaps are the only test in the strip | F3 p019L diagram + hint · medium |
| P-B-b | BONUS | raised walkway (open) | ≈2.5 long, ≈0.8 above the first walkway | +0.8 | walk | — | LANDING | Landing for the slab hops | F3 p019L · medium |
| G-B-b | BONUS | drop-down (step off the raised walkway, no gap) (not lethal) | 0; landing the long low walkway; run-up ≈2.5 | −1 | drop | none / not a failure (it is the route) | — | A one-step drop onto the crate walkway | F3 p019L · medium |
| P-B-c | BONUS | wide floor: long low walkway holding the striped, the W + 1UP pair and a W drawn on top of the 1UP (open) | ≈6 long | 0 | walk | — | ARENA | The reward sits on flat footing right after the drop | F3 p019L; P3 p005L s8 · medium |
| P-B-e | BONUS | walkway ≈4 long, a slight step (≈0.2) below the previous one, with a ? on it and a ? floating ≈3 above it (open) | ≈4 long | −0.2 | walk, high jump | — | REST | The floating ? is the only crate in the level that needs a deliberate high jump (≈3 up) or a bounce | F3 p019L · medium |
| P-B-d | BONUS | stairs: two slabs rising ≈0.6 and ≈0.4 with a ? on the second, then a walkway ≈2.5 sloping down to the exit ? pad (open) | ≈1 slabs; walkway ≈2.5 | +0.6, +0.4, then down | plain hops | — | STEPPING, BONUS-PAD | A last pair of hops collects the last ?; the slope returns to the road | F3 p019L; P3 p005L s9 · medium |

**S3 — C2 → goal**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| G-S3-a | S3 | pond (safe water) around the plank right after C2 (frog pond 2); the row of three stands on a raised stone ledge at its far edge (not lethal) | about the full width (wall to wall in TT frame twenty-one) × ≈6–8 along; landing the raised stone ledge with the row of three, then the right wall; run-up C2 floor | 0 (sunken), ledge +≈1 | wade + walk — wade or cross on the plank; TT: jump-spin from the water onto the ledge and the wall | frog flung from the front (E-S3-a) / slowed, no death | — | The row of three stands on a ledge at Crash-head height above slow water: TA5 spins the middle one, TT 21–22 flings the frog into the left end, jump-spins the rest and jumps straight onto the right wall — "the hardest spot of the course". Nearby: S3-a, E-S3-a. | F3 p014L–gutter route; F3 p101L fr./cap. 21–22; P3 p005L s11 · medium |
| P-S3-a | S3 | narrow ledge: raised stone bank carrying the row of three (open) | ≈3 long × ≈1 deep, ≈1–1.5 high (about Crash’s head) | +1 to +1.5 | jump-spin | — | STEPPING | A raised shelf beside the road turns the crate row into a step up to the wall line | P3 p005L s11; F3 p101L fr.22 · medium |
| G-S3-b | S3 | pond (safe water) along the left edge with a frog in it (not lethal) | ≈half the road × ≈5–8 along; landing road beside it; run-up after the row | 0 | wade + walk | frog E-S3-a / slowed, no death | — | The frog that is flung into the row lives here, coming toward the player; the record line runs the right wall beside the pond (TT 23–24). Nearby: S3-a, S3-b. | F3 p014 gutter route; F3 p101L fr.23–24 · medium |
| P-S3-b | S3 | stone bridge 2 entered between tall gate posts (crystal on it) (low parapets, gate posts) | ≈3–4 wide × ≈1.5 road widths long | 0 | walk | — | CHOKE | Same choke as bridge 1, again guarded by a knight at the posts; the crystal is the reward instead of a mask | F3 p014R route; P3 p004R s5; F3 p101L fr.26 · high |
| G-S3-c | S3 | two floor holes notched into the right edge one after the other (lethal) | ≈1–2 across each; landing road; run-up after the ? crate | 0 | walk | goats before and after / death | — | The last lethal edges, flanked by the last two goats; the record line hops from the very edge of the hole onto the right wall (cap. 27–28). Nearby: S3-c, E-S3-d. | F3 p014R route; F3 p101L fr./cap. 27–28 · medium |
| P-S3-c | S3 | wide floor: last stretch along the castle with a dark drop along its left edge (right wall; left edge open to a drop, TT 27, 29) | ≈6–8 wide | 0 | walk | — | — | The run-in to the gate loses its left wall: the last part of the road has an open edge (what lies below is not visible) | F3 p101L fr.27, 29 · low |
| G-S3-d | S3 | last pond (safe water) on the right before the slot pair (not lethal) | ≈half the road; landing road with the two slot crates; run-up not visible | 0 | walk | none / slowed, no death | — | A last slow patch beside the final crates; P3 s6 shows the slot crates at a dark water edge in front of the castle door. Nearby: S3-d. | F3 p014R route; P3 p004R s6 · low |

### Jump sequences

| id | section | count | moves | rhythm | widest gap | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 3 | plain + running + drop | syncopated (wall hop, long curved jump, drop) | not visible (a long jump along the curve onto the right wall) | wall tops (P-S1-b) | no | Time-trial line only: hop to the left wall at pit 1, big jump along the curve over the big pond onto the right wall, drop (not jump) back to the road. Normal play needs none of these jumps | F3 p101L cap. 02, 06, 07, 10 |
| J-S2-a | S2 | 1 | running + held/high | isolated | — (height: third tier of the stack) | dry strip by the boulder | no | A single dash big jump reaches the 2-s crate on the third tier; the only height test of the main road | F3 p101L cap. 15; F3 p013R TA4 (first-wave reading) |
| J-B-a | BONUS | 4 | plain + drop | even | <0.5 | raised walkway P-B-b | no | Three hops over hairline gaps and a drop: the only places to fall in the bonus, as the hint says | F3 p019L |
| J-S3-a | S3 | 3 | spin + plain | accelerating | ≈1 (ledge to wall top) | right wall top | yes | TT hardest spot: spin the oncoming frog into the row, jump-spin the two remaining crates from the water, then jump straight onto the right wall while the frog and the clock press | F3 p101L cap. 21–22 |
| J-S3-b | S3 | 2 | plain | even | ≈1 (hole edge to wall top) | right wall top | no | Pass behind the W to the right wall, hop from the last spot before the hole onto the wall, run to the gate between the slot crates | F3 p101L cap. 27–28, 30 |

Normal play needs no jump on the main road (inferred from the map: every hole is a partial-width notch with open road beside it, the ponds are wadeable, the trenches are planked and the bridges are walked). Jumping is taught by the crates (the striped sandwich S1-c, the stack S2-b) and, for experts, by the wall line.

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S1-a | S1, S2, S3 | floor holes (穴) notched into the road edges or one half of the road (lethal) | flank: cut from the road edge; never across the full width | static | go around on the open half, wall-top line switches walls at a hole | edge crates S1-b, S1-g, C1 (G-S2-a), goats (G-S3-c) | AREA-DENIAL, TEACH | The intro states the level rule: holes are out even with Aku, so the mask is for enemies only; partial width keeps the stage-1 road jump-free | F3 p013L intro; F3 p013L–p014R maps; F3 p101L cap. 02, 27–28 |
| O-S1-b | S1, S2, S3 | wading ponds (池): five or six sunken water patches, one across the full road (not lethal) | across path (the big pond, frog ponds) or on one half | static; running speed drops inside (TA2) | wade through, run the wall top beside it (TA2), jump along the curve onto the wall (cap. 06) | frogs, crate groups S2-b, S2-e, S3-a | AREA-DENIAL, RHYTHM | Slow ground instead of lethal ground: each pond is a crate station with its frog, and the wall tops give the fast way past | F3 p013R TA2; F3 p013–p014 maps; F3 p101L fr.05–07, 14, 20–24 |
| O-S2-a | S2 | giant rock beside a pond (static blocker) (not lethal) | flank: on the road opposite the pond | static | take the dry strip between boulder and pond, TT: left part of the wall until the pond (cap. 14) | pond G-S2-b, 3-stack S2-b, frog E-S2-b | LANE-BLOCK | Boulder and pond squeeze the road to a strip where the stack stands, so the stack and the frog cannot be skirted widely | F3 p101L fr./cap. 14–15 |
| O-S2-b | S2 | house entrance beside the right wall-top lane (snags the feet) (not lethal) | flank: on the wall-top lane | static | jump past it (cap. 13) | wall-top line | TEST | A snag that exists only for the expert lane: the wall line has its own small obstacles | F3 p101L fr./cap. 11–13 |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | goat (ヤギッパ) | patrol-1D | walks a fixed straight line back and forth (left–right or front–back); fixed route, so it can be bypassed without fighting | stomp (jump on it), spin, slide, body slam, avoid (fixed route) | on line just past the first plank, on wide road | TEACH | yes | The first enemy is alone on the widest, flattest ground with room to sidestep; the ? S1-e behind it is its reward | F3 p012R; F3 p013L route · high |
| E-S2-a | S2 | goat | patrol-1D | as E-S1-a, between C1 and the slot crate | stomp (jump on it), spin, slide, body slam, avoid (fixed route) (fails: dawdling: the slot crate turns to steel) | on line between C1 (with its hole G-S2-a) and the slot crate | TIMING-GATE | no | Dealing with it eats the slot crate’s window: the enemy is a timer for a crate | F3 p013R route + callout 2 · high |
| E-S2-b | S2 | frog (ケロッパ) | hopper (hops; shuttles front–back in its pond) | keeps a fixed front–back range like the goat, but steps sideways toward an approaching Crash and attacks; hops intermittently, so it is hard to approach at first | spin, stomp (jump on it), slide, body slam, fling into the stack (advice 3) (fails: walking straight in while it hops) | in the pond beside the 3-stack (in water) | PROJECTILE, GUARD | yes | Debuts alone in its own pond; advice 3 turns it into a projectile aimed at the stack beside it | F3 p012R; F3 p013R route + advice 3 · high |
| E-S2-c | S2 | knight (berserker lab assistant バーサーカー研究員, heavy sword) | static (telegraphed sword swing) | strains to lift the heavy sword (opening), swings a full turn that also covers his back, and the tip can stick in the ground (P3: then run behind him and spin); a missed opening sends the blade tip flying at you | spin from behind after the tip sticks (P3 s4), spin or stomp while he strains to lift (F3), slide, body slam (fails: frontal approach during the swing; passing beside him late (pass a little early)) | on stone bridge 1, between the gate posts | GATEKEEPER, TEACH | yes | The only threat F3 names; he stands where the road narrows to ≈3–4 u, and the mask S2-d is directly behind him | F3 p012R; F3 p013L intro; F3 p013R route; P3 p004R s4; F3 p101L fr.16 · high |
| E-S2-d | S2 | goat | patrol-1D | as E-S1-a | stomp (jump on it), spin, slide, body slam, avoid (fixed route) | on line after the bonus pad and plank | HURDLE | no | Keeps the stretch between the bonus and the 6-block from being empty | F3 p014L route · high |
| E-S2-e | S2 | frog | hopper (hops; shuttles front–back in its pond) | as E-S2-b, on the far rim of the 6-block pond | spin, stomp (jump on it), slide, body slam, fling into the block (fails: walking straight in while it hops) | in the pond with the 6-block (in water) | PROJECTILE, GUARD | no | The biggest crate block shares its pond with a frog | F3 p014L route · high |
| E-S3-a | S3 | frog | hopper (hops; shuttles front–back in its pond) | comes from the front toward the player in the pond just past the row of three | spin it into the row (TT 21), stomp (jump on it), slide, body slam (fails: a slide flings it in a hard-to-aim direction (cap. 21)) | in water, in front of the row of three | PROJECTILE, TOOL/STEP | no | Placed so a spun frog flies into the left end of the row; the time trial makes this a required trick | F3 p014 gutter route; F3 p101L cap. 21–24 · medium |
| E-S3-b | S3 | knight (berserker lab assistant, heavy sword) | static (telegraphed sword swing) | as E-S2-c, between the gate posts of bridge 2 | spin from behind after the tip sticks (P3 s4), spin or stomp while he strains to lift (F3), slide, body slam (fails: frontal approach during the swing) | at the entrance of stone bridge 2 (crystal) | GATEKEEPER | no | The same choke and gatekeeper as bridge 1, now guarding the crystal | F3 p014R route; F3 p101L fr.26 · high |
| E-S3-c | S3 | goat | patrol-1D | as E-S1-a | stomp (jump on it), spin, slide, body slam, avoid (fixed route) | on line after bridge 2, before the ? S3-c | HURDLE | no | Escort for the last ordinary crate | F3 p014R route · high |
| E-S3-d | S3 | goat | patrol-1D | as E-S1-a | stomp (jump on it), spin, slide, body slam, avoid (fixed route) | between hazards: after the two edge holes, before the last pond | HURDLE | no | The last enemy walks between lethal edges and the final crates | F3 p014R route · high |

### Section beats

| section | beats | gaps | enemies | hazards |
|---|---|---|---|---|
| S1 | wide straight: W and ? on opposite edges → edge hole (right) → striped sandwich → edge hole (left) → striped → plank → goat (alone) → ? → big pond (wade, or wall-run) → Aku → small left notch → 2×2 block → C1 | 4 | 1 | 2 |
| S2 | hole in the right half just past C1 → goat → slot crate → two planks → pond + giant boulder + 3-stack + frog (choke) → ? → edge notch → knight on stone bridge 1 (narrow) → Aku → bonus pad → plank → goat → pond with the 6-block + frog (plank walkway beside it) → C2 | 4 | 5 | 4 |
| BONUS | entry pad → plank ramp → three tiny slab gaps → raised walkway → drop → crate walkway (striped, W + 1UP + W, high ?) → ? → two slab hops with ? → slope to the exit pad | 2 | 0 | 0 |
| S3 | plank over pond 2 → row of three on a raised ledge (frog projectile) → frog pond on the left → 4-cluster → knight at stone bridge 2 (crystal) → goat → ? → two right-edge holes → goat → last pond → slot pair placed diagonally → castle gate | 4 | 5 | 2 |

Counts are computed from the records above (gaps = G records, including the wadeable ponds; enemies = individuals; hazards = obstacle records active in the section).

### Geometry and enemy design logic
1. **No mandatory jump on the main road.** Every hole is a notch from one edge or a pit in one half, the ponds can be waded, the trenches are planked and the bridges are walked (inferred from the map). Stage 1 teaches jumping with crates (the striped sandwich, the stack) and leaves gaps out.
2. **Lethal geometry lives at the edges.** Holes are cut from the road edge; the centre line is always safe. The risk comes from sweeping to an edge crate (S1-b, S1-g), and the intro states the rule plainly: a hole kills even with Aku.
3. **Water is the terrain variable.** Five or six ponds slow running but never kill; the first one spans the whole road before any lethal test. Water is shown harmless first, as Crash 2 does with mud (bible IX.4).
4. **Ponds are stations.** Each frog pond holds or borders a crate group (3-stack, 6-block, row of three), so slow ground, an enemy and a reward share one spot, and the frog is a projectile aimed at the crates.
5. **The walls are a second lane.** ≈1-high walls on both sides are runnable; the record line rides them past ponds and enemies and switches walls at holes. A skill route without a fork, with its own small snags (house doorway, hole edges).
6. **Every enemy keeps a territory.** Goats walk fixed straight lines, frogs stay in their ponds, knights stand at bridge entrances; nothing chases. The player decides when to engage, which suits a first stage.
7. **Knights guard chokes.** Both stand where the road narrows from ≈6–9 to ≈3–4 u between gate posts; the telegraph (the strain to lift, the tip stuck in the ground) gives a safe window, and the first knight is followed at once by a mask.
8. **Each enemy kind debuts alone.** Goat on wide flat road → frog alone in its pond → knight alone on a bridge → only then combinations (a goat between C1 and the slot crate, frogs as projectiles).
9. **Checkpoints on dry ground at a hazard exit.** C1 follows the big pond and the block, C2 the 6-block pond; but a hole waits a few steps past C1, so the calm respawn leads straight into the next decision.
10. **Plank crossings are the metronome.** Five full-width planks (1 + 2 + 1 in the main road + 1 after C2) punctuate the road at fairly even intervals, as visual beats with no risk.
11. **The bonus repeats the rule in side view:** the only falls are three tiny slab gaps at the start (the F3 hint says so), then flat walkways and a one-step drop to the crates.
12. **The time trial turns geometry into skill:** walls, holes and ponds become a wall-hopping line, and its hardest spot combines a frog projectile, a crate row on a raised ledge and an immediate jump onto the wall.

### Geometry transfer to the skate game
1. **Edge notches as the first lethal geometry.** On a 7–10 m (6–9 u) road, cut a `pit` 2.3–3.5 m into one edge and 2.3–3.5 m long, the next one 6–9 m further on the other edge; keep the centre line open. On foot nothing needs a jump; at board cruise the notches make a gentle carve. Put the first edge crate right beside the first notch.
2. **Walls as the skill lane.** Line the road with 1.15 m `wall`s on both sides (a full jump apex is 2.85 m; a grind jump 2.4 m): edges grind by default, so a skater rides the wall tops past slow ground and enemies. Break the wall at a notch so the line must switch sides, as the time-trial line does.
3. **Safe-failure water before lethal edges.** Without a slow-water surface, model a pond as a 0.5–0.8 m sunken dip in the road (terrain, no kill) that costs a jump to leave; put the first one across the full width before any lethal notch, and put a crate group and an enemy beside each later one.
4. **Gatekeeper at a bridge choke.** Narrow the road from 8–10 m to 3.5–4.5 m (3–4 u) between two posts and stand a telegraphed enemy there: a `charger` (0.70 s windup) or a `moa` (0.62 s wind-up, 0.9 s harmless recovery) plays the knight. Put a mask crate just past it, and repeat the choke once later with the level’s collectible behind it.
5. **Enemy beside crates as a projectile.** Patrol a `grunt` 2–3 m from a crate row; its carcass can be spun into the crates, the frog trick. Keep it on a short line so the player chooses when to engage.
6. **A hole a few metres past the checkpoint.** Place a 2.3 m wide notch in one half of the road 3–5 m past a checkpoint, with an enemy and a timed reward behind it, so the respawn is calm but the first move is a decision.

## Open questions / uncertainties
- Height of the floating striped crate in S1-c and whether the lower one really strands the upper one in the PS1
  original (gamepressure describes the N. Sane remake).
- Which three crates TT frame 20 breaks with one spin (the 6-block is inferred from the pond and clock times).
- The bonus floating crates' exact heights (B-c, B-d).
- Enemy counts are from the map figures; the map may omit a goat or frog that the game has.
- **Geometry:** The brown plank bands: whether the trench beside a plank can be fallen into, and whether it kills, is not shown (P3 s3 shows a dark trench across the road behind the slot crate).
- **Geometry:** Pond sizes are estimates from F3’s stylised map and the TT frames; which ponds have dry lanes beside them (TT 20 shows a plank walkway at the 6-block pond) is only partly visible.
- **Geometry:** The small left-edge notch near the Aku and the 2×2 block (G-S1-d) and the right-edge notch after the 3-stack (G-S2-c) are drawn small; their size and lethality are inferred from the other notches.
- **Geometry:** The dark drop along the left edge of the last stretch (TT 27, 29) may be a moat or a cliff; not labelled.
- **Geometry:** "No mandatory jump" is inferred from map topology; the game may place a jump the map does not show.
