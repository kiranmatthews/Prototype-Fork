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

## Geometry, obstacles and enemies

Sources for this block: the 2 fps LP1 frames of the first wave (agent-C2), re-read for geometry (1:12:15–1:21:15), GR 3-3, GP = gamepressure.com Jetboard Jetty walkthrough, PS = pushsquare.com boss guide (Louise). Sizes are in crates (u) and are estimated against crates and Crash in the same frame; the jetboard and raft sections have few rulers, so their widths are low confidence. Lethality of plain water on foot was never tested in the run and is marked as inferred.

### Camera and route shape

Linear, never crossing itself: three on-foot legs alternate with three jetboard runs, and two side-view raft rides (main and green-gem path) sit between them. Every leg ends on a pier or dock that holds a checkpoint. Water is the only gap type in the whole level.

| section | mode | notes |
|---|---|---|
| S1 | into-screen | cave plank walkways heading into the screen with gentle bends; two rope swings carry the camera forward; ends in the ship-hull room at the jetboard launch |
| S2 | vehicle | behind-the-rider jetboard on a river lane between rock walls (forced forward, steer, boost, jump) |
| S3 | into-screen | short pier hub (checkpoint, tape, bonus pad) |
| B1 | side-scroll | left to right over water |
| S4 | side-scroll | raft ride left to right; the camera tracks the raft and the docks pass in the same plane |
| S5 | into-screen | pier before jetboard 2 |
| S6 | vehicle | lane between ship hulls and wreckage |
| G | side-scroll | green-gem raft past cannon heaps, out and back through green pads |
| S7 | into-screen | Lani-Loli pier: pillar line and phase pads over water |
| S8 | into-screen | phase docks and a narrow stone causeway |
| S9 | vehicle | fenced channel with bends and turns past wrecks and docks |
| S10 | vehicle | open oval pool where the camera frees up for the Louise fight; then the detonator dock on foot (into-screen) |

### Platforms and gaps (section by section; table per section)

Platforms (`P-`) and gaps (`G-`) share each table. For a platform, "coupling / failure" gives its behaviour and edges. For a gap, it gives what couples it in time and what happens on failure. The evidence column ends with the confidence.

**S1**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | wide floor (round spawn deck) | 5–6 across | 0 | walk | static; edges: railed (rope nets) | REST | safe start with the first crates (S1-a) in view | LP1 1:12:17–23 · medium |
| P-S1-b | S1 | corridor (plank walkway over water) | 3–4 wide | +1 (step up to a raised deck) | walk, jump | static; edges: open over water; support posts, lanterns | CHOKE | a 3–4 u lane lets every hazard (anchor, spiked roller) span the full width, so each one must be timed, not side-stepped | LP1 1:12:25–47 · medium |
| P-S1-c | S1 | wide floor (dock) | 5–6 × 4–5 | 0 | walk | static; edges: open | ARENA REST | square dock with room to dodge the first cutlass slash; the reward row [? W ?] (S1-c) stands behind the pirate | LP1 1:12:48–51 · medium |
| P-S1-d | S1 | bridge/plank (narrow bridge into the hull) | ~2 wide | 0 | walk, jump | static, broken into segments; edges: open | CHOKE STEPPING | the narrowest walkway of the level points straight at the hull door; one crate sits on it | LP1 1:13:00–05 · medium |
| P-S1-e | S1 | wide floor (ship-hull room) + launch ramp | 5–6 wide | 0 | walk | static; edges: walled | REST CHECKPOINT-PAD | last crates of the leg; a CHECKPOINT text shows at the launch (1:13:12), so the first vehicle run starts from a save | LP1 1:13:06–12 · medium |
| G-S1-a | S1 | lethal water (stepping slabs) | 1–2; landing rock slabs 2–3 × 2–3; run-up 2–3 | 0 | plain | none; failure: fall into the water (death inferred, not observed); near S1-b | TEACH STEPPING | the first gaps are short and static, on slabs that also carry the W pair (S1-b) | LP1 1:12:30–34 · low |
| G-S1-b | S1 | swing/vine (rope swing 1 over water); lethal | 5–8; landing scaffold ~3 × 3; run-up 1–2 to the rope | 0 to +1 | swing | rope pendulum: release on the forward arc; failure: fall into the water | TEACH | the first long gap is a device crossing, not a jump test | LP1 1:12:36–37.5 · low |
| G-S1-c | S1 | swing/vine (rope swing 2 to a raised scaffold tower); lethal | 5–8; landing scaffold top ~3 × 3; run-up ~2 | +1 to +2 | swing | rope pendulum; failure: fall into the water; near S1-d | TEST | the device repeats with more height after one hazard set | LP1 1:12:54–55.5 · low |
| G-S1-d | S1 | lethal water (segment holes in the plank bridge) | ~1; landing plank segment ~2 wide; run-up 3+ | 0 | plain | none; failure: fall into the water; near S1-d | RHYTHM | small hops on a narrow line just before the vehicle keep the eye on the centre | LP1 1:13:00–03 · low |

**S2**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S2-a | S2 | vehicle lane (river between rock walls) | 8–12 wide | 0 | ride | forced forward (jetboard); edges: rock walls; whirlpools on the flanks | ARENA | the widest lane of the three runs: hazards stay at the edges and the 8 crates float on the centre line | LP1 1:13:13–24 · low |

**S3**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S3-a | S3 | wide floor (pier) | 6–8 × 4–5 | 0 | walk | static; edges: open to water | REST CHECKPOINT-PAD BONUS-PAD | checkpoint, bonus pad and tape share one safe floor right after the first vehicle run | LP1 1:13:25–28 · medium |

**B1**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B1-a | B1 | wide floor (plank deck) | 4–5 × 2 | 0 | walk | static; edges: open | REST | bonus start | LP1 1:13:32 · medium |
| P-B1-b | B1 | moving platform (small hovering raft) | ~2 × 1 | +1 | jump | moves; axis not resolved; edges: open | TIMING-STEP | lifts the player toward the TNT/W/! tower | LP1 1:13:32–36.5 · low |
| P-B1-c | B1 | bridge/plank (row of outline crates made solid) | 8–9 × 1 | 0 | switch, walk | appears when the ! under the TNT fires; edges: open over water | LANDING | the bridge over the water is the reward row itself | LP1 1:13:38–45 · medium |
| P-B1-d | B1 | wide floor (deck under the TNT pyramid) | 5–6 × 2 | 0 | walk | static; edges: open | ARENA | holds the TNT pyramid with fire crates on its flanks (B1-c) | LP1 1:13:45–50 · low |
| G-B1-a | B1 | water under the outline row (bonus); not lethal | 8–9; landing next deck | 0 | crate-bounce, double | the TNT on the W on the ! must blow (3 s) to solidify the row; GR: stay airborne off nearby crates until it does; failure: drop out of the bonus (no life lost, GP); near B1-a, B1-b | TEST | the gap closes only through the explosive switch | LP1 1:13:35–44; GR 71 · medium |
| G-B1-b | B1 | water bridged by the second outline row (bonus); not lethal | ~8; landing exit deck | 0 | crate-bounce, double | second TNT/W/! tower (fuse 3); failure: drop out of the bonus; near B1-d | TEST | the switch-bridge is repeated once in the same room | LP1 1:13:48.5–54.5 · low |

**S4**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S4-a | S4 | moving platform (raft) | 4–5 × 1.5–2 | 0 | ride | raft on barrels; carries the player left to right at about walking pace past the docks (speed not measured); edges: open | SAFE-ISLAND TIMING-STEP | the only safe floor of the ride; the player hops off to docks and must be back before it passes | LP1 1:14:14–1:15:07 · medium |
| P-S4-b | S4 | narrow ledge (docks and hull ledges level with the raft) | 2–4 long × 1–2 deep | 0 to +1 | jump | static (passes by); edges: open | TIMING-STEP | each dock holds crates (S4-a, S4-b, C2 S4-d, TNT S4-e) and is reachable only for a few seconds of raft travel | LP1 1:14:14–35 · medium |
| G-S4-a | S4 | moving-platform crossing (raft to dock and back); lethal | 1–2; landing dock 2–4 × 1–2; run-up raft length 4–5 | 0 to +1 | plain | raft travel: return before the raft has passed; failure: fall into the water (death); near S4-a, S4-b, S4-d, S4-e | TEST | the gap stays short; the difficulty is the moving reference frame | LP1 1:14:14–40 · medium |

**S5**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S5-a | S5 | wide floor (pier) | 6–8 × 4 | 0 | walk | static; edges: open | REST CHECKPOINT-PAD | save between the raft and jetboard 2; the R row and the iron block flank the checkpoint | LP1 1:15:10–20 · medium |
| P-S5-b | S5 | crate-built (uncounted iron crates, 2 wide × 3 high) | 2 × ? footprint, 3 high | +2 to +3 above the raft deck | jump, double | static; edges: open | BONUS-PAD | the tallest climb of the level carries the hidden gem; it stands in the water where the raft ride ends | LP1 1:15:06.5–12.5; GR 108 · medium |
| P-S5-c | S5 | square pad (raised launch platform) | ~3 × 2 | +1 | jump | static; edges: open | CHOKE | a pirate stands on it, so the jetboard launch is gated by one spin | LP1 1:15:13–20 · low |
| G-S5-a | S5 | moving-platform crossing (raft to the top of the iron block); lethal | 1; landing 2-wide iron top; run-up raft length | +2 to +3 | running, double | raft passes the block once; failure: fall into the water; or miss the gem and ride on; near P-S5-b | TEST | the hidden gem is a vertical test timed by the raft | LP1 1:15:06.5–12.5 · low |

**S6**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S6-a | S6 | vehicle lane (between ship hulls) | ~10 wide; 2–4 channels between mines | 0 | ride | forced forward (jetboard); edges: hull walls | CHOKE | the lane is as wide as run 1, but mine fields cut it into 2–4 u channels | LP1 1:15:20–36, 1:15:50–1:16:10 · low |
| P-S6-b | S6 | wide floor (dock with the green pad) | 5–6 × 4 | 0 | walk | static; edges: open | REST CHECKPOINT-PAD | checkpoint at the route split | LP1 1:16:12.5–20 · medium |

**G**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-G-a | G | moving platform (raft) | 4–5 × 2 | 0 | ride | carries the player left to right past cannon heaps; edges: open | SAFE-ISLAND TIMING-STEP | same device as S4, now under cannon fire | LP1 1:16:27–1:17:01 · medium |
| P-G-b | G | narrow ledge (docks beside the raft line) | 2–4 × 1–2 | 0 to +1 | jump | static; edges: open | TIMING-STEP | carry the N/T/? stacks (G-a, G-b) and one pirate | LP1 1:16:39–57 · low |

**S7**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S7-a | S7 | stepping stones (square stone-capped pillars) | ~2 × 2, in a line | 0 | jump | static; edges: open over water | STEPPING TIMING-STEP | the only stepping-stone gauntlet of the level, crossed by swinging anchors and leaping fish | LP1 1:17:22–35 · medium |
| P-S7-b | S7 | phase/timed (phase platforms and round grated pads) | ~2 planks; pads 1.5–2 across | 0 | phase, jump | solid in one Lani-Loli phase only; edges: open | STEPPING TIMING-STEP | the mask's footing rule is taught on short gaps over water | LP1 1:17:35–55; GP · low |
| P-S7-c | S7 | wide floor (pier end) | 4–5 × 3 | 0 | walk | static; edges: open | PERCH | holds the bounce crate under an off-camera crate (S7-c/d) | LP1 1:17:55–59 · medium |
| P-S7-d | S7 | crumbling (two dropping platforms) | ~2 × 2 each | 0 | phase, jump | drop when stood on (GR); a crate sits between them over an iron !; edges: open | TIMING-STEP | a drop-away pair with the switch underneath (S7-e) | GR 150 · low |
| G-S7-a | S7 | lethal water (pillar gaps) | 2–3; landing pillar top ~2 × 2; run-up 1–2 | 0 | plain, running | swinging anchors and leaping fish cross the line; failure: fall or hit: death (the run died here, 1:17:27.5); near S7-a | TEST | short gaps with two crossing hazards: the timing, not the distance, is the test | LP1 1:17:22–35 · medium |
| G-S7-b | S7 | lethal water (phase-platform gaps) | 2–3; landing phase plank or round pad 1.5–2; run-up 1–2 | 0 | phase, plain | platform solidity follows the player's phase; failure: fall into the water; near S7-a, S7-e | TEACH | the mask is taught on gaps no wider than the pillar gaps before it | LP1 1:17:35–55; GP · low |

**S8**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S8-a | S8 | wide floor (stone docks) | 3–4 wide | 0 | walk, phase | static; edges: open | STEPPING | carry the phase crates and phase TNT (S8-a/b) | LP1 1:18:05–27 · medium |
| P-S8-b | S8 | stepping stones (square pillar + round pad) | ~2 × 2 + 1.5–2 round | 0 | jump | static; edges: open | STEPPING | a two-hop reminder of the S7 gauntlet | LP1 1:18:27–31 · low |
| P-S8-c | S8 | corridor (stone causeway with low railings) | ~3 wide | 0 | walk | static; edges: railed | CHOKE | two pirates advance down it toward a TNT placed in front of the player | LP1 1:18:34–37 · medium |
| P-S8-d | S8 | wide floor (plank dock) | 5–6 × 4 | 0 | walk | static; edges: open | REST CHECKPOINT-PAD | outline and strong crates, then C5 before the last vehicle run | LP1 1:18:38–44.5 · medium |
| G-S8-a | S8 | lethal water (pillar + pad hops) | 2–3; landing 2 × 2 / 1.5–2 round; run-up 2 | 0 | plain | anchors swing on both flanks just before; failure: fall into the water; near S8-b | RHYTHM | two hops recall the S7 gauntlet without new elements | LP1 1:18:27–31 · low |

**S9**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S9-a | S9 | vehicle lane (fenced channel) | 6–8 wide; 2–3 between paired whirlpools | 0 | ride | forced forward (jetboard); edges: wooden fences, wreck walls | CHOKE | the narrowest lane of the three runs | LP1 1:18:44–1:19:50 · low |
| P-S9-b | S9 | bouncy (jump ramp with an arrow sign) | ~2 wide | up | ride | static launcher; edges: open | TIMING-STEP | the only authored launch of the runs, over a floating trunk | LP1 1:19:26 · low |
| G-S9-a | S9 | vehicle gate between two whirlpools; lethal | 2–3; landing lane | 0 | ride | whirlpools pull at both sides; failure: death; restart from C5 (GP: any hit restarts the run); near O-S9-c | TEST | the tightest steering gate of the level comes in the last run | LP1 1:19:36.5 · low |
| G-S9-b | S9 | chasm with bounce (ramp jump over a floating trunk); not lethal | 2–4; landing lane; run-up vehicle speed | 0 | ride | ramp at 1:19:26; failure: crash into the trunk (not observed); near P-S9-b | TIMING-STEP | one authored air in a run otherwise flat | LP1 1:19:26 · low |

**S10**

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S10-a | S10 | vehicle lane (oval boss pool) | ~20–25 across | 0 | ride | free steering; edges: wreck walls | ARENA | open water so the player can drag chasers into Louise's tentacle slams | LP1 1:19:52–1:20:42; PS · low |
| P-S10-b | S10 | wide floor (dock with the green ! detonator) | 4–5 × 3 | 0 | walk | static; edges: open | REST | payout of the avoided Nitro after the fight | LP1 1:20:42.5 · medium |

### Jump sequences

| id | section | count | moves | rhythm | widest gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 3 | plain | even | 2 | P-S1-b | no | slab hops teach the water gap at its shortest | LP1 1:12:30–34 |
| J-S1-b | S1 | 4 | plain, swing | syncopated | 5–8 (swing) | P-S1-c | no | rope swing, spiked roller, anchor, roller: each beat is a different verb | LP1 1:12:36–47 |
| J-S1-c | S1 | 4 | swing, plain | accelerating | 5–8 (swing) | P-S1-e | no | swing up, then short plank hops into the hull: the leg speeds up toward the vehicle | LP1 1:12:54–1:13:05 |
| J-B1-a | B1 | 4 | crate-bounce, double | even | - | P-B1-c | yes | GR: stay airborne off nearby crates until the TNT fires the ! and the bridge forms | GR 71; LP1 1:13:38–42 |
| J-S4-a | S4 | 8 | plain | syncopated | 2 | P-S4-a | yes | off the raft, break, back on: the raft sets a beat the player cannot pause | LP1 1:14:14–1:15:07 |
| J-S7-a | S7 | 6 | plain, running | syncopated | 3 | P-S7-c | no | the player can wait on a pillar for an anchor or a fish to pass | LP1 1:17:22–35 |
| J-S7-b | S7 | 5 | phase, plain | even | 3 | P-S7-c | no | phase and jump in alternation | LP1 1:17:35–55 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S1-a | S1 | swinging anchor on a chain | flank, swinging into the walkway | pendulum; period not measured | wait-and-go; lethal | P-S1-b, O-S1-b | TEACH TIMING-GATE | GP: some anchors carry a slashing pirate; touching the pirate, the anchor or the chain kills. Seen first on the flank before any roller | LP1 1:12:28.5, 1:12:39.5–43; GP · medium |
| O-S1-b | S1 | spiked roller (horizontal spiked log between posts) | across path, ~1 u above the planks | spins in place | jump over; lethal | O-S1-a | RHYTHM TEACH | two rollers in ~6 s: the first alone, the second with an anchor beside it | LP1 1:12:39.5–41, 1:12:45–47.5 · medium |
| O-S2-a | S2 | whirlpool | flank of the river lane | constant | go around; lethal | S2-a | TEACH AREA-DENIAL | shown at the edges of the widest lane, where staying central avoids it | LP1 1:13:13–24 · low |
| O-S4-a | S4 | spiked rollers lying along dock tops | on platform | static or spinning (not resolved) | jump over, go around; lethal | S4-e TNT | AREA-DENIAL | turns dock crates and the TNT (S4-e) into short timed hops | LP1 1:14:31–34 · low |
| O-S4-b | S4 | low booms across the raft line | across path, ~1 u above the raft deck | static; approach set by the raft | slide under; lethal | P-S4-a | TEST | the only slide check of the level; GR pairs it with crates (slide-jump under the lower barriers) | LP1 1:14:40–43; GR 103 · medium |
| O-S4-c | S4 | spiked maces sliding in vertical slots along the raft line | across path | cycling up/down; period not measured | wait-and-go, slide under, jump over; lethal | P-S4-a | TIMING-GATE | GP: moving spikes, pass by jumping, crouching or sliding as you prefer | LP1 1:14:54–58; GP · low |
| O-S6-a | S6 | sea mines (spiked balls ~1.5–2 u) in fields of 5–8 | in the lane | static | go around; lethal | O-S6-b, S6-a crates | LANE-BLOCK TEST | the mines break the crate line: safe line and crate line diverge for the first time | LP1 1:15:20–36 · medium |
| O-S6-b | S6 | whirlpools 3–4 u in the lane | in the lane | constant pull | go around; lethal | O-S6-a | AREA-DENIAL | the run's first death (1:15:36) reads as being pulled into a whirlpool | LP1 1:15:33–36 · medium |
| O-S6-c | S6 | fallen mast across the lane | overhead | static | go around; not lethal | — | TEACH | first overhead object; passes above the rider | LP1 1:15:26 · low |
| O-G-a | G | cannons firing balls across the raft line | flank (heaps beside the raft path) | periodic; muzzle flash before the ball | wait-and-go, jump over; lethal | G-a, G-b stacks | TIMING-GATE | a ball lands on the raft line at 1:16:34.5 and 1:16:46.5; the cannons share space with the Nitro/TNT stacks | LP1 1:16:27–57 · low |
| O-G-b | G | swinging anchors | across path | pendulum | wait-and-go; lethal | P-G-a | TIMING-GATE | the S1 hazard returns on the moving raft | LP1 1:16:43.5, 1:17:05 · low |
| O-S7-a | S7 | swinging anchors over the pillar line | across path | pendulum | wait-and-go; lethal | O-S7-b, P-S7-a | TIMING-GATE | the stepping line is timed by the anchors | LP1 1:17:22–35 · medium |
| O-S7-b | S7 | leaping fish crossing the path | across path (from the water) | intermittent leaps | wait-and-go; lethal | O-S7-a | TIMING-GATE | a second crossing rhythm on the same gaps; the run died here once | LP1 1:17:25–29, 1:17:49–55 · low |
| O-S8-a | S8 | swinging anchors on both flanks of the docks | flank | pendulum | wait-and-go; lethal | P-S8-a | TIMING-GATE | a paired version of the S1 anchor | LP1 1:18:19–27 · low |
| O-S9-a | S9 | falling shot with impact rings on the water (mortar/cannon) | in the lane | ring marks the landing spot before the splash | go around; lethal | O-S9-b | TIMING-GATE | anything that falls from above is marked on the water first | LP1 1:18:47.5, 1:19:08.5 · low |
| O-S9-b | S9 | sea mines | in the lane | static | go around, fling into (lure a chaser, GP); lethal | E-S9-a | LANE-BLOCK | GP: lure the pirates into the bombs so one enemy removes two hazards | LP1 1:19:02–13; GP · medium |
| O-S9-c | S9 | whirlpool field (4) and a whirlpool pair | in the lane | constant pull | go around; lethal | G-S9-a | AREA-DENIAL TEST | the pair leaves a 2–3 u gate (G-S9-a) | LP1 1:18:56–58, 1:19:36.5 · low |
| O-S9-d | S9 | cannon battery on the right dock firing across the lane | flank | periodic | wait-and-go, go around; lethal | S9-b crates | TIMING-GATE | the run ends with the green path's cannons, now facing the rider | LP1 1:19:38–42.5 · low |
| O-S9-e | S9 | floating logs and wreck debris; ropes across the lane | in the lane; overhead | static | go around, jump over; not lethal | — | LANE-BLOCK | clutter that narrows the lane between the bigger hazards | LP1 1:18:59.5, 1:19:14–19, 1:19:30.5 · low |
| O-S10-a | S10 | Louise's tentacle slams | across path (arena) | highlighted strip about 2 s before the slam (PS) | go around, fling into (lure chasers under the slam); lethal | E-S10-b | TEST | the boss's attack is the player's weapon when an enemy is dragged under it | LP1 1:19:55–1:20:11; PS · medium |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S1-a | S1 | cutlass pirate (fish-faced pirate with a cutlass) | static | stands on the dock, raises the cutlass and slashes an arc in front (slash at 1:12:49) | spin (fails: walking into the slash arc) | landing platform (dock P-S1-c) | TEACH GUARD | yes | the first enemy is alone on a wide dock with the reward row behind it | LP1 1:12:48–50 · medium |
| E-S1-b | S1 | anchor-riding pirate (GP) | patrol-1D | rides a swinging anchor and slashes; contact with pirate, anchor or chain kills (GP) | avoid (fails: touching the chain) | above / flank | TIMING-GATE | no | an enemy fused with a pendulum hazard | GP · low |
| E-S4-a | S4 | cutlass pirate | static | on a short dock the raft passes; slashes | spin (fails: staying on the raft past the dock) | landing platform (dock beside the raft line) | TIMING-GATE | no | the S1 enemy reused as a timing check from a moving platform | LP1 1:14:33–35.5 · medium |
| E-S5-a | S5 | cutlass pirate | static | stands on the raised launch platform | spin | take-off edge (jetboard launch) | GATEKEEPER | yes | one spin opens the second vehicle run | LP1 1:15:14.5 · low |
| E-G-a | G | cutlass pirate | static | on a dock beside the N/T/? stack | spin (fails: spinning the stack beside it) | guarding crate | GUARD | no | enemy and explosive stack share one small dock | LP1 1:16:40–42 · low |
| E-S8-a | S8 | cutlass pirates x2 (yellow coats) | patrol-1D | walk down the causeway toward the player, swords out | TNT/blast (fails: walking into them) | on line (causeway P-S8-c) | BAIT | no | a lit TNT stands between player and pirates; they walk into the blast (1:18:37) | LP1 1:18:34–37 · medium |
| E-S9-a | S9 | jetboard pirates | chaser | ride boards behind or beside the player | fling into (lure into mines, GP), avoid (fails: letting them ram) | on line | PURSUER TOOL/STEP | no | the chaser is a weapon against the mines, and next against the boss | LP1 1:19:05–07, 1:19:27–35; GP · medium |
| E-S10-a | S10 | Louise (sea monster mini-boss) | mini-boss | tentacle slams with a ~2 s highlighted warning; health bar of 6 segments | fling into (lure chasers under the slams, PS) (fails: attacking her directly, which the board does not allow) | arena | GATEKEEPER | yes | gates the Nitro detonator (S10-a crates on P-S10-b) | LP1 1:19:52–1:20:42; PS · medium |
| E-S10-b | S10 | slow chasers in the arena | chaser | follow the player slowly (PS) | fling into | arena | TOOL/STEP | no | the boss's damage source | PS · low |

### Section beats

- **S1** (gaps 6 · enemies 1 · hazards 4): spawn deck + 3 crates → step up → anchor (flank) → slab hops 1–2 u + W pair → rope swing → spiked roller → anchor + roller → cutlass pirate (dock) → [? W ?] row → rope swing up → scaffold crates → plank bridge 1 u holes → hull-room crates → launch (CHECKPOINT text)
- **S2** (gaps 0 · enemies 0 · hazards 1): launch → 8 floating crates on the centre line → flank whirlpools → pier
- **S3** (gaps 0 · enemies 0 · hazards 0): pier: C1 + tape + bonus pad
- **B1** (gaps 2 · enemies 0 · hazards 2): deck → moving platform → TNT/W/! tower (stay airborne) → outline bridge 8–9 u → TNT pyramid + fire crates → second tower → second outline bridge → exit
- **S4** (gaps 8 · enemies 1 · hazards 3): raft launch dock → raft → dock hops with crates → C2 on a passing dock → spiked rollers + TNT → pirate on a short dock → N/N stack on the raft → low booms (slide) → sliding maces → ! + outline crates → iron block climb (hidden gem) → pier
- **S5** (gaps 0 · enemies 1 · hazards 0): C3 → R x4 → pirate on the launch platform
- **S6** (gaps 0 · enemies 0 · hazards 3): mine fields → whirlpools (death) → mast overhead → 8 crates → dock: C4 + green pad
- **G** (gaps 4 · enemies 1 · hazards 2): green pad → raft past cannon heaps → N/T/? stack + pirate → anchors → N/T/T/? among cannons, loose TNT → green pad back
- **S7** (gaps 8 · enemies 0 · hazards 3): mask (CHECKPOINT text) → pillar line with anchors + leaping fish (death) → phase platforms → round phase pads → pier end: bounce crate under the off-camera crate → dropping platforms over a !
- **S8** (gaps 2 · enemies 2 · hazards 2): phase docks + phase TNT → anchors on both flanks → pillar + round pad → causeway: 2 pirates walk into a lit TNT → dock: outline + strong crates → C5
- **S9** (gaps 2 · enemies 1 · hazards 5): impact rings → mines → whirlpool field → ropes overhead → chasers (lure into mines) → debris → ramp jump → whirlpool pair (2–3 u gate) → cannon battery → dock crates before the arena
- **S10** (gaps 0 · enemies 2 · hazards 1): oval pool: Louise tentacle slams (~2 s warning) → lure the slow chasers under the slams → boss down → green ! detonator: +3 Nitro

### Geometry and enemy design logic

1. Each jetboard run adds one hazard family. J1 has whirlpools only at the flanks of an 8–12 u lane (O-S2-a). J2 puts mines and whirlpools inside a ~10 u lane, cutting 2–4 u channels (O-S6-a/b); the run's first death came here. J3 adds telegraphed impact rings, cannons and chasers in a 6–8 u channel with a 2–3 u whirlpool gate (G-S9-a), and ends in an arena that reuses the chasers as the boss weapon.
2. On foot, every hazard first appears alone on plain planks. An anchor hangs on the flank (1:12:28.5), then a spiked roller stands alone (1:12:39.5), then a roller comes with an anchor (1:12:42–47), and then a lone pirate waits on a wide dock (E-S1-a). Only after that do hazards combine.
3. Water is the only gap type, and on foot it is never crossed by a plain jump longer than about 3 u. Long crossings use devices: rope swings (G-S1-b/c), rafts (P-S4-a, P-G-a), phase platforms (P-S7-b) and the jetboard. Plain jumps stay at 1–3 u (slabs, plank holes, pillars).
4. The raft rides are side views. Gap widths stay fixed at 1–2 u (G-S4-a), and the raft supplies the challenge: it sets a no-stop beat (J-S4-a), and the camera shows each dock before it arrives.
5. Vertical clearance is introduced only on the raft. Booms about 1 u above the deck (O-S4-b) are the level's single slide check, and GR ties crates to them (slide-jump under the lower barriers).
6. The tallest climb is optional. The hidden gem sits on an uncounted 2×3 iron block, 2–3 u above the passing raft (P-S5-b, G-S5-a), so it tests vertical timing from a moving platform without blocking the clear.
7. The S7 pillar line is the only stepping-stone gauntlet. It stacks two crossing rhythms (anchors O-S7-a, leaping fish O-S7-b) on 2–3 u gaps, and it killed the player once. It starts right after the mask pickup, which also saves (CHECKPOINT text 1:17:22), so a retry is cheap.
8. Enemy roles escalate. The S1 pirate teaches (E-S1-a) and the raft pirate gates timing (E-S4-a). The launch pirate keeps the gate (E-S5-a), two causeway pirates walk into a TNT as bait (E-S8-a), and in the last run the chasers become tools against mines and against Louise (E-S9-a, E-S10-b).
9. The vehicle runs telegraph everything that comes from above. Mortar or cannon shots ring the water before they land (O-S9-a), and Louise highlights her slam strip about 2 s ahead (O-S10-a, PS).
10. Lanes narrow run by run while run length grows: about 11 s for J1, about 20 s for J2 (the clean retry) and about 66 s for J3, before the arena. The checkpoint before each run (CHECKPOINT text 1:13:12, C3, C5) pays for the restart that any jetboard hit causes (GP).
11. Crates and geometry agree in J1 and S4, where crates float on the safe line or sit on reachable docks. In J2 the mines push the crate line off the safe line, and in S8 a TNT doubles as the trap for the advancing enemies.
12. Hazards are recycled across modes. The anchor appears on foot (S1), on the raft (G) and over pillars (S7, S8). Cannons fire at the raft (G) and then at the jetboard (S9). Spikes are rollers on foot (S1), logs on the docks (S4) and maces on the raft (S4).

### Geometry transfer to the skate game

1. Three-run skate lane. Run 1 is 10–14 m wide (9–12 crates) with hazards only at the edges and 8 single crates 1.2–1.6 m above the deck on the centre line. Run 2 is the same width with `pit` discs or mine-like hazards that leave 2.5–4.5 m channels. Run 3 is 7–9 m wide with a hazard pair leaving one 2.5–3.5 m gate. At cruise (12 m/s), runs of about 11, 20 and 66 s, as in Crash, are about 130, 240 and 790 m long. Put a checkpoint before each run.
2. Raft section as a `mover`. A 5 × 2 m platform travels at walking pace beside a row of 2.3–4.6 m docks set 1.2–2.3 m from its edge. Docks hold crates, one `grunt` and one TNT, and the player hops off and back in under 2 s. Add a boom with its underside 0.6–0.8 m above the mover deck (below the 0.92 m player box) as the slide check, and never a gap wider than one full jump (5.6 m).
3. Pillar gauntlet. Use 2.3 m square pillars with 2.3–3.5 m gaps over a `pit`, crossed by two `pendulum`s with different periods. Place it right after a checkpoint, since it is the only stepping-stone test of the level.
4. Chaser-as-tool. On the board, a `charger` that follows the rider and dies on contact with a hazard, together with a mine field where luring it clears both, gives the rider a reason to steer near danger on purpose.
5. Enemy walks into TNT. On a 3.5 m causeway, two `grunt`s patrol toward the player with a TNT between them. Stomping the TNT (3 s fuse, 2.75 m blast) while they close in teaches the blast radius without risk to the player.
6. Telegraph everything that falls: ring decals on the deck 1–2 s before an impact (mortar shots, slams), matching the ~2 s warning of Louise.

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
- Geometry: water lethality on foot is inferred (no fall in the run). The rope-swing spans (5–8 u), raft speed, anchor periods and the cannon cycle were not measurable from the frames.
- Geometry: the run's first death (LP1 1:15:36) reads in the frames as being pulled into a whirlpool, not a mine as the crate map states; a second death falls between 1:15:40 and 1:15:50 (cause not visible); the third is on the S7 pillar line at 1:17:27.5.
- Geometry: a CHECKPOINT text appears at the jetboard launch (LP1 1:13:12) with no crate visible; it may be an automatic checkpoint before the first vehicle run.
- Geometry: the anchor-riding pirates are known only from GP; the frames show swinging anchors but no rider was resolved. Enemy names are descriptive (the guides do not name them).
- Geometry: whether the ropes across the J3 lane must be ducked or are scenery, and what the small hovering platform in the bonus does, is unresolved.
