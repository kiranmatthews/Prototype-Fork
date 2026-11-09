# Crash 4 — 3-3 Jetboard Jetty

Sources: GR 3-3 (Gameranx "All Crates & Hidden Gem" guide, id 210355); gamepressure.com Jetboard Jetty walkthrough
(totals, bonus size, hidden gem, tape); LP1 1:12:00–1:20:52 (archive.org PS4 completionist longplay, Part 1),
read as 2.5 s and 2 fps frames at 854×480, plus crops of the HUD crate counter.

Evidence level: the total (196), the bonus size (29), and the running counts 3 → 70 → 110/111/115 → 174/175/176
were **read from the HUD**. The section split follows GR's tallies, which agree with every HUD reading up to
174. GR's later 194/197 is one too high (see Open questions). Crate **types** were read from frames where the
icons are legible: the opening dock rows, the bonus stacks, the raft stacks, the green-path Nitro/TNT/? stacks,
the phase TNT and the outline crates. Large parts of the on-foot opening, the late raft ride, the green path and
the third jetboard run are only resolved to group level, and their counts come from GR. Those clusters are marked `x` and
low confidence. Run facts: 3 deaths (sea mine at 1:15:35; two more around 1:17:28). All six gems were awarded,
including ALL boxes.

## Crash 4 crate and device legend (used in this file)

| Mark | Type (JSON key) | What it is / does |
|---|---|---|
| W | wood | plain crate, fruit |
| ? | question | fruit (sometimes a life) |
| B | bounceWumpa | crate with a gold wumpa emblem. GR calls it a "bounce crate". Each bounce pays fruit, as the C2 striped crate does, and it is a springboard |
| R | reinforced | metal-banded X-frame "strong crate" (GR). Needs a body slam (or a blast). Counted |
| M | iron | pale grey-cyan metal crate. Unbreakable footing, **not counted** (gamepressure: the hidden gem sits on "metal boxes") |
| T / N | tnt / nitro | both **count**. TNT: a stomp starts the fuse. Nitro: any touch explodes it |
| ! | switch | iron ! box (not counted). Materialises outline crates |
| G! | switchGreen | Nitro detonator. Destroys every Nitro still standing, and they **are added to the count** |
| o | outline | wireframe crate until its ! is hit |
| P / Pt | phase / phaseTnt | translucent blue crates that are solid only in one Lani-Loli phase |
| F | fire | dark crate with brass vents that jet flame (GR "fire crate") |
| C | checkpoint | counted |
| x | unknown | type not resolvable in the frames |

Devices: **jetboard** (forced-forward water vehicle with boost; this level's analogue of our skateboard),
**raft** (barrel raft that carries Crash past docks in side view), **Lani-Loli mask** (phase-shift between two
states of platforms and crates), **colored-gem pad** (green pad: rides an optional route only if the Green Gem from
2-3 Hit the Road is owned).

## At a glance

| Field | Value |
|---|---|
| Theme | Pirate shipwreck cove at night: cave docks, sunken ships, coin hoards |
| Camera | Into-screen on foot. Behind-the-rider on the 3 jetboard runs. Side view on the raft rides and in the bonus |
| Total boxes | **196** (HUD n/196; gamepressure 196; ALL gem awarded LP1 1:20:52.5). GR ends at "197/197", an off-by-one |
| Per route | main 145 · bonus 29 · green-gem path 22 · secret/death 0 |
| Checkpoints | at least 5 observed: pier beside the bonus pad, a dock mid raft ride, pier before jetboard 2, the green-pad dock, the dock before jetboard 3 |
| 1UP / Aku | none identified (GR lists none) |
| TNT | at least 1 (bonus pyramid ×3 + stack ×1, raft dock ×1, green path ×3, phase TNT ×1 visible) |
| Nitro | 3 paid by the end detonator (incl. a 2-stack seen on the raft), plus at least 2 in green-path stacks |
| ! / outline | ! iron box in the bonus, on the raft ride, and under the dropping platforms. Outline rows in the bonus, on the raft and on the last dock |
| Reinforced | 4 (pier, beside C) + 2 (path to jetboard 3) |
| Iron (uncounted) | landmark stacks of 2–4 on the raft ride; 2×3 block on the pier = hidden gem perch |
| Gems | 40/60/80 % fruit, ALL boxes, ≤ 3 deaths, hidden gem (jump onto the 6 iron blocks left of the pier checkpoint, LP1 1:15:12.5). The green-gem path requires the Green Gem from 2-3 |
| Flashback tape | on the pier beside the bonus pad (LP1 1:13:27.5). Gamepressure: needs no deaths up to it |
| Enemies / hazards | swinging/rolling walkway hazards, spiked rollers on docks, sea mines and whirlpools (jetboard), cannons (green path), Louise (end mini-boss) |
| Difficulty notes | GR: the jetboard runs are the easy part. The all-box risks are the green-path gem requirement, the bounce-crate order, and the ! under the dropping platforms. Missing a crate on jetboard 3 forces a restart from the jetboard start |

## Route skeleton

```
START (cave docks, on foot) ──33──▶ JETBOARD 1 ──8──▶ PIER [C1][tape][BONUS pad]
                                                         │
                                                         ├──▶ BONUS 29 (side view) ──▶ back to pier
                                                         ▼
RAFT RIDE 1 (side view, docks pass by) ──32 (incl. C2 on a dock)──▶ PIER [C3][R R R R]  (M-block = hidden gem)
                                                                        │
JETBOARD 2 (mines, whirlpools) ──8──▶ DOCK [C4][green pad] ──green gem──▶ CANNON RAFT 22 ──▶ back to dock
                                                         │
LANI-LOLI PIER (phase) ──11──▶ dropping platforms over a ! ──24──▶ DOCK [o][C5][o]
                                                                        │
JETBOARD 3 + docks ──17──▶ LOUISE (mini-boss) ──▶ G! detonator +3 Nitro ──▶ EXIT

cumulative: 33 · 41 · 42 · 71 · 103 · 108 · 117 · 139 · 150 · 174 · 193 · 196
```

## Section-by-section map

### S1 — Start → jetboard 1 (33; GR 33; HUD 3/196 at 1:12:22)

```
 START dock ─[x][x x]─ plank walkway ═══  rock ledge→[W W]   (swinging hooks / rolling log)  dock [? W ?]
   ─ rope climb ─ boulder path ─ dock ─[x..]─ ship-hull door ─▶ jetboard launch
   (25 more crates in groups of 1–4 along walkway edges and dock centres)
```

| id | position | composition | arrangement | access | tags | why it is here | evidence |
|---|---|---|---|---|---|---|---|
| S1-a | first metres off the spawn dock | x×3 | single then pair | walk, spin | ON-PATH TEACH | the counter hits 3 within ~5 s of control, so breaking a box is the first thing the player does after moving | LP1 1:12:19–1:12:23 (HUD 1→3) · high |
| S1-b | rock outcrop right of the walkway | W×2 | pair on a raised rock | jump, spin | DETOUR PAIR | a one-hop side step. It shows early that the walkway edges hold crates | LP1 1:12:30–31 · medium |
| S1-c | dock after the rolling-log hazard | ?, W, ? | row | walk, spin | ON-PATH ROW TIMED | reward placed straight after the first timed hazard. One spin takes the row | LP1 1:12:51 · medium |
| S1-d | rest of the walkways, rope climb, boulder path, dock to the hull door | x×25 | small groups | walk, jump, spin | ON-PATH EDGE-BAIT | steady pacing crates between hazards. Group sizes not resolvable | GR 33; LP1 1:12:35–1:13:12 · low |

Rhythm: a cave walkway alternates timed hazards (swinging hooks, a rolling log) with small crate groups on the
far side of each. This is the only on-foot stretch before the first vehicle run, and its density
(33 crates in about 55 s) is the highest in the level.

### S2 — Jetboard 1 (8; cumulative 41)

```
 ═══ water ═══  [x]   [x]  [x]   [x]  [x]   [x]  [x]   [x]   (floating at jump height, on the boost line) ─▶ pier
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S2-a | over the water | x×8 | floating line | vehicle, jump | SPEED-LINE FLOAT-LINE ON-PATH | the first vehicle crates are generous: all sit on the line you are already riding, visible from far away. They teach jumping the board into crates | GR 42 (= 33 + 8 + C); LP1 1:13:15–1:13:22 · medium |

### S3 — Pier hub: C1, tape, bonus pad (1; cumulative 42)

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S3-a | pier at the end of jetboard 1 | C | single beside the bonus pad | walk | CHECKPOINT BONUS | the checkpoint sits next to the bonus pad, so a failed bonus costs nothing. In the run it was broken **after** the bonus (HUD 70 → 71) | LP1 1:13:25, 1:14:11 · high |

### B1 — Bonus round (29; HUD 29/29 at 1:14:00, main counter 70 after transfer)

```
 side view, over water
 [T]                                   [T]               [x][x]   [x]
 [W]   o o o o o o o o o   [F] [T][?][T] [F]     [x] [x]
 [!]   ~~~~~~~~~~~~~~~~    [?][W] ...           ~~~~~~~~~ ─▶ exit
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| B1-a | bonus start | T, W (on an iron !) | stack T/W/! | jump, switch | SWITCH EXPLOSIVE-MIX TOOL BONUS | the TNT is the key. Its blast reaches the ! underneath and materialises the outline row. GR: stay airborne by double-jumping off nearby crates until it blows | LP1 1:13:32–40; GR 71 · medium |
| B1-b | right of the stack, over water | o×9 (8–9 seen) | row | switch → walk | OUTLINE BRIDGE BONUS | the switch's reward is also the floor: the outline row is both the crates and the bridge | LP1 1:13:35–45 · low |
| B1-c | centre | T×3, ?×2, W×2, F×2 | TNT pyramid with fire crates on its flanks | jump, spin | EXPLOSIVE-MIX SUPPORT-ORDER BONUS | GR: break the side fire crates before lighting the TNT | LP1 1:13:45–55; GR · low |
| B1-d | to the exit | x×9 | floating pairs and singles | jump, double-jump | FLOAT-LINE BONUS | airborne pickups that reward the double jump | LP1 1:13:50–1:14:00 · low (split estimated) |

### S4 — Raft ride 1 (32; cumulative 103; GR 103)

```
 side view; the barrel raft runs left→right past docks
 dock[W W]  hull-dock[? / W][W]   raft:[M/W]  dock[C2]  rollers ^^ [T]  raft:[N/N on W/W]  [M M M M]  … [!] o o … barriers ⌐⌐
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S4-a | dock at the raft launch | W×2 | pair | walk, spin | ON-PATH | pickup at the launch point | LP1 1:14:14 · medium |
| S4-b | dock beside the ship hull | ?, W×2 | ? on W + W | jump, spin | ON-PATH STACK | must be hit while the raft passes: a timing check from a moving platform | LP1 1:14:23 · medium |
| S4-c | on the raft | W×2 (+iron on top) | iron-on-wood stacks | spin, body-slam | TOOL STACK TIMED | iron crates riding on wood. Breaking the wood drops the iron into a step, and the iron marks the raft from afar | LP1 1:14:26–38 · medium |
| S4-d | dock beside the path | C | single | jump | CHECKPOINT TIMED | a checkpoint you must hop off the raft to break, so even saving is a timing test | LP1 1:14:29–32 ("CHECKPOINT") · high |
| S4-e | dock with spiked rollers | T | single | jump | EXPLOSIVE-MIX TIMED | stomp it as the raft passes. The raft carries you out of the blast | LP1 1:14:32 (fuse 2) · medium |
| S4-f | on the raft | W×2 under N×2 | N/N on W/W | spin | EXPLOSIVE-MIX SUPPORT-ORDER | Nitro on top of collectibles. Spin the wood from the side and stay clear of the falling Nitro. The Nitro are paid by the final detonator | LP1 1:14:40–41 · medium |
| S4-g | late ride | x×21 (incl. outline crates) | groups on docks and raft | switch, slide, spin | SWITCH OUTLINE TIMED | GR: hit the ! metal block to make more crates appear, slide-jump under low barriers, spin to keep pace | GR 103; LP1 1:14:44 · low |

### S5 — Pier before jetboard 2 (5; cumulative 108; GR 108)

```
   [M M M]        [C3]   [R R R R]
   [M M M]  ← hidden gem on top       → jetboard 2 launch
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S5-a | pier | C | single | walk | CHECKPOINT | save before the second vehicle run | LP1 1:15:10–20 · high |
| S5-b | right of C3 | R×4 | row | body-slam | REINFORCED COUNT-TRAP | strong crates beside the checkpoint test the body slam. The mirror-image 2×3 iron block on the left holds the hidden gem (LP1 1:15:12.5) | GR 108; gamepressure · medium |

### S6 — Jetboard 2 (9; cumulative 117; HUD 110 at 1:15:21.5, 111 at 1:15:23, 115 at 1:15:32.5)

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S6-a | water among sea mines and whirlpools | x×8 | floating line | vehicle, jump | SPEED-LINE FLOAT-LINE TEST | the jetboard-1 grammar again, now threaded between mines. The run's death (1:15:35) came after its 7th crate | LP1 1:15:21.5–35 · medium |
| S6-b | dock with the green pad | C | single | walk | CHECKPOINT ROUTE-SPLIT | the checkpoint sits at the fork, so the optional path never costs progress | LP1 1:16:12.5 · high |

### G — Green-gem path (22; cumulative 139; GR 139)

```
 green pad ▶ coin-hoard island ▶ raft past docks and cannon heaps (side view)
   dock:[N/T/?]   cannons ⊙⊙  [T]·[N/T/?]   …  ▶ green pad back to the dock (pink doors)
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| G-a | dock | N, T, ? | N on T on ? | timed, spin | EXPLOSIVE-MIX ROUTE-SPLIT | a collectible buried under both explosives. The bottom ? cannot be taken cleanly | LP1 1:16:40 · medium |
| G-b | among the cannons | N, T×2, ? | N/T/? stack beside a loose T | jump, timed | CHAIN TOOL ROUTE-SPLIT | stomp the loose TNT and ride on. Its blast chains through the stack and every crate counts | LP1 1:16:55–57 (fuse 2) · medium |
| G-c | rest of the path | x×15 | groups | walk, spin, timed | ROUTE-SPLIT TIMED | split not resolvable | GR 139 · low |

The HUD hint "FIND THE HIDDEN GREEN GEM IN ANOTHER LEVEL" shows at the pad (LP1 1:16:16). Crash rides the
green platform out at 1:16:21 and back at 1:17:12–20.

### S7 — Lani-Loli pier (11; cumulative 150; GR 147/149/150)

```
 mask ▶ pier ─[x]on P-platform ─[x x x x x x x]─ pier end [B]   (hidden [x] high above, off camera)
       ▶ two dropping platforms with [x] between them, iron [!] underneath
```

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S7-a | on a phase platform | x | single | phase | TEACH TIMED | the first crate that exists only while phased in, taught on a safe pier | GR 147 · medium |
| S7-b | along the pier | x×7 | singles/pairs | walk, spin | ON-PATH | pier crates incl. the one at its end | GR 147 · low |
| S7-c | above the pier end, off camera | x | floating single | bounce | HIGH HIDDEN COUNT-TRAP SUPPORT-ORDER | reachable only by bouncing on the bounce crate first | GR 149 (easy-to-miss) · medium |
| S7-d | pier end | B | single | bounce | TOOL SUPPORT-ORDER | the tool crate for S7-c. Break it last | GR 149 · medium |
| S7-e | between two dropping platforms | x (iron ! below) | single over a switch | switch, timed | SWITCH OUTLINE TIMED | the ! materialises crates two docks later (S8-d, S9-a): the cause sits one section before its effect | GR 150 · medium |

### S8 — Phase docks to jetboard 3 (24; cumulative 174; HUD 174/196 at 1:18:41 = GR 174)

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S8-a | phase docks | P×3, Pt | row of phase crates with a phase TNT | phase, jump | EXPLOSIVE-MIX TIMED | an explosive that exists in one phase only: phase in, stomp, phase out to escape | LP1 1:18:10–12.5 · medium |
| S8-b | phase dock | W, ?, P | row | walk, phase | ON-PATH | half the row needs the mask | LP1 1:18:20 · medium |
| S8-c | path | R×2 | pair | body-slam | REINFORCED | GR's two strong crates | GR 174 · medium |
| S8-d | last dock, right | o | first of two outline crates | switch | OUTLINE COUNT-TRAP | payoff of S7-e. Lost if the ! was skipped | LP1 1:18:39–41 · medium |
| S8-e | remaining docks | x×14 | groups | walk, spin, phase | ON-PATH | split not resolvable | GR 174 · low |

### S9 — Last dock, jetboard 3, arena approach (19; cumulative 193)

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S9-a | last dock | o + C | outline crate beside C5 | switch, walk | OUTLINE CHECKPOINT | the second materialised crate, and the save before the last vehicle run | LP1 1:18:42.5–44.5 (HUD 175, 176, "CHECKPOINT") · high |
| S9-b | jetboard 3 and the docks before Louise | x×17 | floating line + dock groups | vehicle, jump | SPEED-LINE TEST | GR: none are tricky, but one miss means replaying from the jetboard start. The final run checks execution, not search | GR 194 (−1); LP1 1:18:45–1:19:50 · low |

### S10 — Louise and the detonator (3; cumulative 196)

| id | position | composition | arrangement | access | tags | why | evidence |
|---|---|---|---|---|---|---|---|
| S10-a | after the fight | N×3 | detonated by G! | switch | NITRO-SWITCH REWARD | the Nitro the player avoided all level (e.g. the raft stack S4-f) are paid at the very end | GR 197; LP1 1:20:42.5 · medium |

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S1 | swinging hooks, rolling log | across the plank walkways | each hazard is followed by a reward group (S1-c) |
| S2/S6/S9 | open water; sea mines and whirlpools (S6) | jetboard lanes | crate lines mark the safe line, until the mines break it (S6) |
| S4 | spiked rollers on docks | beside the raft path | turn dock crates and TNT (S4-e) into timed hops |
| G | cannons | heaps beside the raft path | share space with the Nitro/TNT stacks |
| S7 | dropping platforms | over water | the crate between them sits on top of the ! (S7-e) |
| S10 | Louise (mini-boss) | arena after jetboard 3 | the fight gates the Nitro detonator |

## Puzzle rooms and dependency chains

1. **Bonus TNT-on-! (B1-a → B1-b).** Setup: TNT on wood on an iron !, outline row over water. Sequence: stomp
   the TNT and stay airborne off nearby crates until it blows. The ! fires and the row materialises. Tempting
   wrong move: stand beside it, or spin the wood out. Loss: bonus crates (and the floor to the rest of them).
   Design: the switch, the bridge and the reward are the same object.
2. **Explosive stack on the green path (G-b).** Nitro on TNT on ?, beside a loose TNT. Correct: light the loose
   TNT and let the chain take the stack. Wrong: spin the ? at the base, which drops TNT and Nitro beside you.
   Loss: a life, plus the gem-path crates on retry. Design: a "buried" collectible is unlocked by a remote
   explosive rather than direct contact.
3. **Bounce crate before hidden crate (S7-c/S7-d).** Correct: bounce up to the off-camera crate, then break the
   bounce crate. Wrong: break the bounce crate on arrival. Loss: 1 crate, so the all-box gem is lost while the
   clear is unaffected.
4. **Cross-section switch (S7-e → S8-d, S9-a).** The ! under the dropping platforms makes two outline crates
   solid on the dock before jetboard 3. Skip it and the gap only shows two docks later, after a checkpoint.
5. **No-recovery vehicle run (S9-b).** Every crate is on the line, but a miss can only be fixed by restarting
   from the checkpoint before jetboard 3.

## Design logic of this level

1. **A vehicle level whose crates are mostly on foot.** The three jetboard runs hold about 33 of 196 crates
   (8 + 8 + part of S9). The search, order and switch puzzles all sit on the docks between them. The vehicle
   is the reward and the breather, and crate density drops when speed rises.
2. **Vehicle crates live on the boost line.** Jetboard crates float over open water where the rider already is.
   They test reaction and jump timing, never discovery. The difficulty ramp comes from hazards (mines,
   whirlpools in run 2), not from hiding crates.
3. **Checkpoint immediately before each forced-speed run** (pier C1/C3, dock C5). A missed vehicle crate is
   retried cheaply, and GR's "restart from the jetboard" warning only bites on the last run.
4. **Moving platforms turn plain crates into timing checks.** On the raft ride even the checkpoint (S4-d) and
   a TNT (S4-e) are on passing docks. Crates riding the raft (S4-c, S4-f) carry iron or Nitro on top, so
   breaking order matters while the platform moves.
5. **Iron crates are scenery with a job.** The tall iron stacks on the raft are landmarks visible across the
   water. The 2×3 iron block on the pier mirrors the reinforced row on the other side of the checkpoint and
   hides the gem. Uncounted crates are used to point at counted ones.
6. **Explosives as deferred crates.** Nitro the player avoids (raft stack) come back as the detonator payout
   after the boss. The green path makes the player use a TNT as a remote key to clear a Nitro-capped stack.
7. **The mask section re-teaches crates.** The first Lani-Loli crate sits on a safe pier (S7-a). Then the mask
   gates a phase TNT (S8-a) and a half-phase row (S8-b). Finally it combines with a SUPPORT-ORDER count trap
   (S7-c/d) and a delayed switch (S7-e).
8. **Optional content is large and gated twice.** The bonus (15 %) is gated by skill. The green path (11 %) is
   gated by progress elsewhere: a colored gem from another level.
9. **Density curve.** About 33 crates/min on the opening walkways, ~30/min on the raft, ~8/run on the jetboards,
   and a final 17-crate run where one miss costs a replay.

## Transfer to the skate game

1. **Boost-line crate trails.** Place single crates floating 1.2–1.6 m above the deck line (full-charge
   ollie ≈ 1.7 m clears one crate). Space them every 8–12 m on a cruise-to-charged line (12–23 m/s). Use 8 per run,
   on the line, no detours. Put a checkpoint 5–10 m before the run starts.
2. **Hazard-threaded second run.** Reuse the same trail but offset 2–3 crates around a lethal obstacle (a Nitro
   or a steel wall-crash block). The safe line and the crate line diverge for 1–2 crates, as with the mines in S6.
3. **Moving-platform stacks.** A platform carrying `steel on wood` columns: plowing the wood at ≥ 13 m/s drops the
   steel into a step. Never place steel at board height on the travel line, since steel at speed is a wall crash.
4. **Deferred Nitro.** Nitro along a skate line are counted. Put the green `nitrobang` after the end gate
   challenge so riding around Nitro never costs the all-box goal (S4-f → S10-a).
5. **Remote-key TNT.** A `Nitro on TNT on ?` stack next to a loose TNT. On the board, the loose TNT lights at
   3–12 m/s and the rider survives (section 4). The chain clears the stack while the rider rolls on, so no stop is needed.
6. **Delayed switch.** A `!` placed on a grind-through spot (switches flip when ground through) that materialises
   a crate row two sections later. Put a checkpoint between them so the cause and its effect are clearly separate.

## Open questions / uncertainties

- **GR off-by-one.** GR's tallies match the HUD exactly at 71, and 174 equals HUD 174 at 1:18:41. Its "194" before
  the boss must be 193 (196 − 3 Nitro), which explains its "/197". The S9 count (19 incl. C5) is therefore derived, not read.
- Crate types are unresolved for S1-d (25), S4-g (21), G-c (15), S8-e (14) and S9-b (17). Their totals are GR's.
- The bonus split (B1-b 9 / B1-c 9 / B1-d 9) is estimated around the HUD total of 29. Whether the TNT blast
  itself triggers the ! (rather than the player bouncing onto it) is inferred from GR's wording.
- The green path's internal layout (beyond two N/T/? stacks and a loose TNT) and its exact cannon behaviour
  were not mapped.
- GR's "4 metal crates" right of the pier checkpoint are taken to be reinforced (counted) crates, because they
  are counted in GR's tally. The 6 "metal blocks" for the gem are uncounted iron.
