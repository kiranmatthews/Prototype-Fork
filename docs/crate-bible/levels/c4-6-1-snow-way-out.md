# Crash 4 — 6-1 Snow Way Out

Sources: GR 6-1 (Gameranx "All Crates & Hidden Gem" guide, id 210742); LP1 3:07:14–3:13:44 (archive.org PS4
completionist longplay, **Part 1**), read every 2 s at 854×480, every 0.5 s around the bonus's two Nitro lids, plus
HUD-counter crops and the exit crate sign; gamepressure.com walkthrough for enemy and hazard corroboration only.

**Locating note.** The brief expected this level in Part 2; it is in Part 1. The HUD reads 0/153 at LP1 3:07:16 and the
"Snow Way Out — Level complete" card shows at 3:13:36. The run is a no-death N.Sanely Perfect: all six gems and the
Flashback tape at 3:13:38–3:13:42.

Evidence level: the total (153), the bonus (33) and the 68 transfer were read directly. The counter only shows while
Crash stands still, so main-route anchors are sparse: 2 (3:07:18), 68 (3:09:06), **116** (3:11:36), **133** (3:12:54),
and the exit sign at **147** then **151** (3:13:24–28). GR's tallies fill the gaps. GR's "108 at the checkpoint after
the gold crate" conflicts with the HUD's 116 there. GR's next figure, 122, fits 116 + 6, so GR probably mislabelled
where that tally belongs. Crate types are read where the icons are visible. Elsewhere, groups seen only as fruit bursts
are marked `unknown` with low confidence. Cluster sizes inside the bonus come from HUD deltas between frames.

## Crash 4 crate and device legend (used in this file)

| Mark | Type (JSON key) | What it is / does |
|---|---|---|
| W / ? | wood / question | plain crate / ? crate |
| ↑ | arrowWood | wooden arrow crate: high bounce, breakable |
| R | reinforced | metal-banded X-frame "strong crate": body slam or a blast |
| T / N | tnt / nitro | counted. Nitros count when they explode; any left standing are paid by the exit Nitro switch |
| r! | timedSwitch | red/pink **timed ! box**, not counted. Hitting it makes its pink outline crates solid for a few seconds |
| o(r) | timedOutline | pink outline crate made solid by an r!. Counted only if broken before it fades |
| Au | goldFruit | gold crate with a wumpa emblem. One hit, large fruit payout (GR's "gold fruit crate") |
| F | fire | "inferno" crate that jets flame on a cycle. Wait for the flame to stop, then break it |
| M | iron | unbreakable metal block, not counted. The bonus switch row |
| C | checkpoint | counted |
| G! | switchGreen | Nitro switch at the exit, in front of the **exit crate sign** (shows n/total) |
| x | unknown | type not resolvable from the frames |

Devices: **Kupuna-Wa slow-time mask** (given at the spawn, R2/Triangle), drifting **ice floes** (frosted = safe,
clear = slippery, cracked = break), **falling ice slabs**, **rope-hung swinging platforms**, moored and moving **boats**.

## At a glance

| Field | Value |
|---|---|
| Theme | Frozen harbour town at night: boardwalks, fishing boats, icefalls, waterfalls |
| Camera | Into-screen harbour paths and floe fields; side view for the timed-! climbs, the bonus, the icefall and the waterfall gorge |
| Total boxes | **153** (HUD 0/153, LP1 3:07:16; ALL gem 3:13:38) |
| Per route | main **120** (incl. 2 Nitro paid at the exit) · bonus **33** · secret/death 0. The hidden-gem pier has 6 main-route crates |
| Checkpoints | 5: C1 3:07:48 (17) · C2 tower ≈ 3:09:34 (79) · C3 3:10:56 (105) · C4 3:11:34 (HUD 116; GR 108) · C5 ≈ 3:12:09 (122) |
| 1UP / Aku | none seen |
| TNT | main route 10 (boat deck, dock, falling-ice ledge, two raft groups, the TNT column, TNT on wood, three on swinging platforms); none confirmed in the bonus |
| Nitro | bonus 16 (7-row lid, 3 lower right, 6-row under the ? column); main route 2, never seen, paid by the exit switch |
| Timed ! (red) | S1 ×3 (≈ 9 outlines), bonus ×2–3, S7 ×1 (≈ 5 outlines plus a permanent crate on top) |
| Strong (reinforced) | 1 on the main route (S2-d), 2 in the bonus column (B-e) |
| Arrows | 1 wooden arrow (S6-d) under two floating crates |
| Special | 1 gold fruit crate (S7-c), flame-jetting "inferno" crates in a pyramid (S5-b) |
| Gems | 40/60/80 % fruit, ALL boxes, ≤ 3 deaths, hidden gem: bounce off the top crate of the stack on the pier behind the collapsing platform (LP1 3:10:22) |
| Flashback tape | next to the flame pyramid (LP1 3:10:00) |
| Enemies | crossbow longshoremen firing fish harpoons, helmeted stocky longshoremen who throw (stomp from above), fishermen on boats |
| Hazards | slippery and cracking floes, dark water, falling ice slabs and blocks, swinging platforms, flame crates, TNT |
| Difficulty notes | All-box is a slow-mo resource puzzle: five timed groups plus two Nitro lids. Most of the 35 easy-to-miss crates sit toward the camera or behind waterfalls |

## Route skeleton

```
START [x x] ─ r! floating trio ─ [W/W] ─ [W W] ─ side view: r! arc(4) ─ r! high pair(2) ─ [W] ─ C1 ......... 17
harbour: crossbow tower [? ?? ? W] ─ boat deck [T ? W] ─ boat hops/crane [T x x x] ─ [R] on the steps ─ pad . 35
   └─▶ BONUS 33 (side view): N×7 lid over [M r! M] ─ outlines ─ [?] ─ [N N][N on W] ─ [?/R/R] ─ r! pair
        ─ bridge [x] ─ [? ? ? column on N×6] ─ [x x x] ─▶ 68/153
wall-top boardwalk [x][W][?][x] ─ post [x] ─ (ship explodes) ................................................. 74
   └ turn LEFT, slide-jump: tower [W] (count trap) ─ ledge [W W W] ─ C2 ....................................... 79
falling ice (slow-mo) ─ dock [W] ─ flame pyramid [?F?/F/W] (tape) ............................................ 85
LAGOON: floe → [W] in water toward camera (trap) ─ collapsing plat → pier stack [6] → HIDDEN GEM
   ─ boat [W x] ─ left pier [↑] + 2 floating high ─ waterfall room [7] (trap) ─ C3 ............................ 105
side view: r! staircase(5) + [x] on top ─ icefall: [Au] between two falls ─ C4 + [? ?/?] ................ 116 (HUD)
falling-ice ledge [T under W] ─ plank path (slow-mo) ─ [x] ─ C5 on the dock ................................ 122
FLOES II: boat [?/x] ─ [?] on a drifting floe (trap) ─ moored boat [?] ─ raft [W/? T W] + [T W W]
   ─ (HUD 133) ─ exit pier [4] ......................................................................... 137
waterfall pier [4] (trap) ─ [T/W/W] by enemy ─ [T on W] ─ swinging plats [T] [T] [T] ─ boardwalk [x x]
   ─ EXIT SIGN 151/153 ─ G! (+2 N) ─▶ 153
```

## Section-by-section map

### S1 — Start → C1 (cumulative 17)

```
 (into-screen village path)                         (side view, icy walkway)
 START  [x x]   lantern  o o o  lantern             r!(ledge)    o  o  o  o           o o  (high right)
   │            (r! by the path: crates float          ┌──┐   (arc over the walkway)   ▲
   ▼             left/right of the path)               │  │ ────────────────────────── r!(higher ledge) ── [W] ── C1
 [W/W] pillar   [W W] block under icicles
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S1-a | on the snowy stone path at the spawn, in the first camera view | x×2 = 2 | pair | walk, spin | ON-PATH PAIR TEACH | first input of the level is a spin on two crates; the HUD ticks 0 -> 2 | LP1 3:07:16-3:07:18 (HUD 0/153 -> 2/153) | high |
| S1-b | village path: a red timed ! beside the path; its crates materialise floating left and right of the path by the lantern posts | o(r)×3 = 3 | float-line around posts, floating | switch, timed, jump | ON-PATH FLOAT-LINE SWITCH OUTLINE TIMED TEACH | the 'R2/Triangle: slow time' prompt appears exactly here: the first timed group is the mask's tutorial, on safe ground | LP1 3:07:18-3:07:24 | low |
| S1-c | crate column on a stone pillar beside ice blocks | W×2 = 2 | stack, 2 high | jump, spin | ON-PATH STACK | pacing pair between two switch puzzles | LP1 3:07:28-3:07:30 | low |
| S1-d | two wood crates on a stone block under icicles | W×2 = 2 | pair | walk, spin | ON-PATH PAIR | rhythm crates before the camera turns to side view | LP1 3:07:32 | medium |
| S1-e | side view: second red ! on the left ledge; an arc of pink outlines over the icy walkway turns solid | o(r)×4 = 4 | arc (float-line), floating | switch, timed, jump | FLOAT-LINE SWITCH OUTLINE TIMED TEST | same device, longer reach: the arc is broken in sequence while slow-mo lasts. Stencilled shipping crates nearby are scenery, not boxes | LP1 3:07:34-3:07:38 | low |
| S1-f | third red ! on a higher ledge; two pink outlines float high on the right | o(r)×2 = 2 | pair, high, floating | switch, timed, jump, double-jump | HIGH PAIR SWITCH OUTLINE TIMED TEST | distance and height combined: hit the switch, then climb to the pair before the timer ends | LP1 3:07:38-3:07:44 | medium |
| S1-g | wood crate on a scaffold ledge to the right | W×1 = 1 | single | jump | ON-PATH SINGLE | landing reward after the timed climb | LP1 3:07:46 | medium |
| S1-h | checkpoint on the harbour boardwalk | C×1 = 1 | single | walk | CHECKPOINT | banks the switch tutorial | LP1 3:07:48 (CHECKPOINT text); GR 17 | high |

The opening is a slow-mo primer. The crates that matter are pink outlines that only exist for a few seconds after a red !
is hit. The slow-time prompt appears with the first group. Each later group adds distance (S1-e's arc) or height (S1-f's
high pair). Plain wood crates sit between the timed groups so the player can recover the meter. No enemy is near any timed group.

### S2 — C1 → bonus pad (cumulative 35)

```
 crossbow longshoreman on a tower ──── harpoon line ────▶
     [?] on a stack (far right)  [? ?] on a top-right ledge  [?] on a pillar
 moored boat: [T][?][W] by the cabin door ── boat hops / crane ── dock [T] ── stone steps [R] ── (BONUS pad)
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S2-a | harbour under a crossbow longshoreman on a tower: ? on top of a stack far right, a ?? pair on a top-right ledge, a ? on a pillar | ?×4 + W×1 = 5 | stack + pair + single, high on the right | jump, double-jump | HIGH DETOUR ENEMY-LINK | the crates sit on the far side of the harpoon line: collecting them means crossing the sniper's field of fire (slow-mo helps) | LP1 3:07:50-3:07:54 | low |
| S2-b | deck of a moored fishing boat beside the cabin door | T×1 + ?×1 + W×1 = 3 | row on deck | walk, spin | ON-PATH ROW EXPLOSIVE-MIX | first TNT of the level, next to collectibles: spin the ? and wood first, or stomp the TNT and step away so its blast takes them | LP1 3:07:56-3:08:02 (TNT counting at 3:08:02) | medium |
| S2-c | boat-to-boat hops and a crane load; TNT on a snowy dock | T×1 + x×3 = 4 | scattered on boats and dock | jump, spin | ON-PATH EXPLOSIVE-MIX | pacing crates on the hop targets | LP1 3:08:04-3:08:12 | low |
| S2-d | stone steps up to the bonus platform | R×1 = 1 | single | body-slam | ON-PATH SINGLE REINFORCED | the metal-banded strong crate GR flags: it needs a body slam (or a blast) | LP1 3:08:14-3:08:18 | medium |
| S2-e | unresolved crates of the boat stretch (seen only as fruit bursts at 1 frame per 2 s) | x×5 = 5 | unresolved | walk, jump | ON-PATH | balance of GR's 35 | GR 35 minus mapped clusters | low |

This section introduces the harpoon snipers and the first TNT. The far-right ? group (S2-a) sits inside the sniper's
field of fire, so collecting it means crossing that field. The boat-deck TNT shares a row with a ? and a wood crate. The
strong crate on the steps is GR's "strong crate" and needs a body slam.

### B — Bonus round (33; side view, cave dock)

```
 START pad ── bridge: N N N N N N N  (lid) ─────────────── tower [?]     o o (pink, high right)
              ─────── M  r!  M ──── (iron row under the lid)        [N N]   [N on W]
                                               high ledge [?]/[R]/[R]
                         arched snow bridge [x] ── r!(post) → o o at floor level
                          [?]
                          [?]
 platform: N N N N N N  [?]  ← 3-high ? column at the row's right end ── [x x x] ── EXIT pad
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| B-a | start of the bonus: a bridge carrying 7 Nitro directly above a row of iron blocks with a red ! in the middle | N×7 = 7 | row (lid over the switch row) | timed, spin | ROW EXPLOSIVE-MIX CHAIN SWITCH TEACH | the Nitro row is a lid: the red ! beneath cannot be reached until the whole row is chain-detonated from a safe spot. Nitros count when they explode (HUD 0 -> 4 -> 7) | LP1 3:08:22-3:08:30 (HUD 0/33 -> 7/33) | high |
| B-b | pink outlines at dock level and high right, solid while the bonus red ! runs | o(r)×2 = 2 | pair, floating, floating | switch, timed, jump | FLOAT-LINE SWITCH OUTLINE TIMED | the reward the Nitro lid was guarding | LP1 3:08:30-3:08:34 (HUD 7 -> 9) | low |
| B-c | ? on top of the right-hand tower | ?×1 = 1 | single, high | jump, double-jump | HIGH SINGLE | a height check in slow-mo | LP1 3:08:34-3:08:36 (HUD 9 -> 10) | low |
| B-d | lower right: a Nitro pair, and a Nitro standing on a crate stack | N×3 + W×1 = 4 | pair + stack | timed, spin | EXPLOSIVE-MIX CHAIN | a crate wearing a Nitro hat: detonate from range, the blast takes the crate | LP1 3:08:34-3:08:40 (blast at 3:08:38, HUD 10 -> 14) | low |
| B-e | high ledge: column of a ? on top of two strong (X-braced) crates | ?×1 + R×2 = 3 | stack, 3 high | jump, body-slam | STACK REINFORCED SUPPORT-ORDER HIGH | take the ? first, then body-slam the strong crates; the column is visible for several seconds before it is reachable | LP1 3:08:36-3:08:46 (HUD 14 -> 17 by 3:08:48) | low |
| B-f | second red ! on a post; two pink crates materialise at floor level, plus one more crate | o(r)×2 + x×1 = 3 | pair at floor level | switch, timed | SWITCH OUTLINE TIMED | short-range timed pair, done with the slow-mo still charged | LP1 3:08:48-3:08:54 (HUD 17 -> 20) | low |
| B-g | arched snowy bridge with a fruit arc | x×1 = 1 | single | jump | ON-PATH SINGLE | pacing crate on the bridge apex | LP1 3:08:56-3:08:58 (HUD 20 -> 21) | low |
| B-h | snowy platform: a row of 6 Nitro with a column of 3 ? standing at its right end | ?×3 + N×6 = 9 | column on the end of a Nitro row, 3 high | bounce, timed | STACK EXPLOSIVE-MIX CHAIN SUPPORT-ORDER TEST | the ? column can only be taken from above (stomp down it) because its sides touch Nitro; then the row is chain-detonated (HUD 21 -> 24 -> 30) | LP1 3:08:58-3:09:02.5 | medium |
| B-i | last crates before the exit pad (not resolved in frames) | x×3 = 3 | unresolved | walk | ON-PATH | balance to 33 | LP1 3:09:02.5-3:09:04 (HUD 30 -> 33) | low |

The bonus is a Nitro room built around two lids. First, a 7-Nitro bridge covers the iron row holding the red !: detonate
it from the start ledge and the switch becomes reachable. Last, a ? column stands on the end of a 6-Nitro row: take it
from above, then chain-detonate the row. Nitros count as they explode (HUD 0 → 4 → 7 in one second), so clearing a lid
is itself crate credit. Slow-mo is what makes a chain survivable at close range.

### S3 — Bonus exit → ship explosion (cumulative 74)

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S3-a | left ledge at the bonus exit pad among the stone ruins | x×1 = 1 | single | jump | DETOUR SINGLE | a crate behind the exit pad, easy to leave behind | LP1 3:09:08-3:09:10 | low |
| S3-b | narrow wall-top and plank boardwalk along the ice canyon: single crates in the walking line | W×2 + ?×1 + x×1 = 4 | singles in file | walk, spin | ON-PATH SINGLE | rhythm crates on a 1-crate-wide path; missing one means a fall | LP1 3:09:12-3:09:20 | medium |
| S3-c | small crate on a post, top left, before the moored ship | x×1 = 1 | single | jump | EDGE-BAIT SINGLE | on a post over the water: a small-risk jump | LP1 3:09:22-3:09:24 | low |

A one-crate-wide wall-top and boardwalk with single crates in file. It is a quiet rhythm stretch before the ship-explosion cutscene.

### S4 — Ship explosion → C2 (cumulative 79)

```
   burning wreck (cutscene) ──▶ camera looks ahead ...  but turn LEFT:
   stone tower ◀── slide-jump ── [W] (count trap)
   tower ledge: [W][W][W]·edge  C2 (gold halo)  ── jump ──▶ falling ice
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S4-a | after the ship explodes: turn left and slide-jump onto the stone tower | W×1 = 1 | single | slide, jump | BACKTRACK HIDDEN COUNT-TRAP | placed right after a cutscene, off to the side the camera does not favour | LP1 3:09:34-3:09:38; GR 75 | medium |
| S4-b | snow-capped crates on the tower ledge, one at the ledge edge | W×3 = 3 | row + edge single | walk, spin | ON-PATH EDGE-BAIT | breaks the last crate on the lip just before the falling-ice jump | LP1 3:09:34-3:09:44 | medium |
| S4-c | checkpoint on the tower ledge (gold halo) | C×1 = 1 | single | walk | CHECKPOINT | banks progress before the first falling-ice crossing | LP1 3:09:34; GR 79 | medium |

### S5 — C2 → floating-ice lagoon (cumulative 85)

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S5-a | lit wooden dock after the falling-ice crossing, bottom right | W×1 = 1 | single | walk | ON-PATH SINGLE REWARD | landing reward after the slow-mo crossing | LP1 3:09:54 | medium |
| S5-b | stone pier: crate pyramid (3 at the base, 1, 1) with flame jets bursting from some crates | ?×2 + F×2 + W×1 = 5 | pyramid | timed, spin | ON-PATH PYRAMID TIMED TEACH | the 'inferno' crates breathe fire on a cycle: wait for the flame to stop, then spin. The Flashback tape is beside them | LP1 3:09:58-3:10:02 (tape 3:10:00) | medium |

The falling-ice crossing is done in slow-mo and has no crates. The landing dock gives one crate. Then comes the flame
pyramid, which teaches the "inferno" crate: watch the flame cycle, then spin. The Flashback tape sits beside it.

### S6 — Lagoon → C3 (cumulative 105)

```
                 (camera)                       moored hull
   [W] bobbing ◀─ ride floe back                ┌──────────┐ collapsing plat ─▶ pier: [?][?]/[W] stack ─▶ bounce → HIDDEN GEM
      ▲                                         └──────────┘
   floes ═══ ═══ ═══ ═══ ═══ ▶  boat [W x] (enemy)
   left pier: ┊[↑]┊  ↑↑ two crates float high above
   waterfall (left) ─▶ hidden room [7] ─▶ pier C3
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S6-a | a single wood crate bobbing in the water, right of the floes, reached by riding a floe toward the camera | W×1 = 1 | single, in water, floating | vehicle, backtrack, spin | BACKTRACK LOW COUNT-TRAP | the drift of the floe, not a jump, decides reachability; it sits behind the player's line of sight | LP1 3:10:10; GR 86 | high |
| S6-b | right of the floes: a collapsing platform leads behind a moored hull to a solid pier with a crate stack | ?×3 + W×3 = 6 | stack (2 x 2 base plus top), 2 high | bounce, spin, body-slam | DETOUR STACK TOOL SUPPORT-ORDER ROUTE-SPLIT | the stack is a springboard: bounce off the TOP crate to reach the hidden gem, then smash the stack (6 per GR; about 5 visible) | LP1 3:10:16-3:10:24 (HIDDEN GEM FOUND 3:10:22); GR 87-92 | medium |
| S6-c | small fisherman's boat on the right (lantern enemy aboard) | W×1 + x×1 = 2 | pair on deck | spin | DETOUR ENEMY-LINK | crates share a tiny deck with an enemy | LP1 3:10:26-3:10:30; GR 93-97 | medium |
| S6-d | stone pier on the left: wooden arrow crate between the pilings | ↑×1 = 1 | single | arrow | TOOL SINGLE | springboard to the high pair; break it only after using it | LP1 3:10:34-3:10:40 | high |
| S6-e | two crates floating high above the arrow crate | x×2 = 2 | pair, high, floating | arrow | HIGH PAIR SANDWICH REWARD | classic arrow-and-floating-crate sandwich: only the full bounce reaches them | LP1 3:10:36-3:10:40 (fruit 343 -> 360); GR 93-97 | medium |
| S6-f | hidden wooden room behind a waterfall on the left, before the checkpoint | x×7 = 7 | room cluster | walk, spin | DETOUR HIDDEN COUNT-TRAP | the largest count trap of the level (7) is behind scenery next to a checkpoint | LP1 3:10:46-3:10:52 (fruit 365 -> 402); GR 98-104 | medium |
| S6-g | checkpoint on a stone pier | C×1 = 1 | single | walk | CHECKPOINT |  | LP1 3:10:56; GR 105 | high |

The lagoon is the level's search area. Three of its five clusters are count traps: a crate placed toward the camera, a
pier reached only through a collapsing platform, and a room behind a waterfall. The other two are tool puzzles: the
gem stack used as a springboard, and an arrow crate under a floating pair. GR's tallies fix each cluster's size.

### S7 — C3 → C4 (cumulative 116, HUD)

```
 (side view)       [x]  ← permanent crate on top
                   o
                 o o      ← pink staircase, solid only while the r! runs
   r! (snow)   o o o
 ──────────────────────── icefall ─┐  [Au] on a raised ledge  ┌─ icefall ── lamp platform: C4 [?][?] + [?] above
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S7-a | side view: red ! on the snow; pink outlines form a column/staircase up a tower | o(r)×5 = 5 | column / staircase, 3 high | switch, timed, jump | STEPPING SWITCH OUTLINE TIMED TEST | the materialised crates are the only stairs: break them as you climb or lose the way up | LP1 3:10:58-3:11:04 | low |
| S7-b | a normal crate on top of the materialised column | x×1 = 1 | single, high | switch, timed, jump | HIGH TIMED COUNT-TRAP | the timed stairs lead to a permanent crate: miss the window and it is out of reach | LP1 3:11:02; GR 106-108 | medium |
| S7-c | gold fruit crate on a raised ice ledge between two dark icefalls | Au×1 = 1 | single | jump, timed | DETOUR REWARD EDGE-BAIT | big fruit payout (fruit 413 -> 438) for a detour over falling ice | LP1 3:11:10-3:11:20; GR | high |
| S7-d | checkpoint on a lamp-lit stone platform by the houses | C×1 = 1 | single | walk | CHECKPOINT |  | LP1 3:11:34 | high |
| S7-e | beside C4: two ? side by side with a ? above | ?×3 = 3 | pyramid, 2 high | spin | ON-PATH PYRAMID REWARD | reward at the checkpoint after the icefall | LP1 3:11:34-3:11:36 (HUD 116/153) | medium |

### S8 — C4 → C5 (cumulative 122)

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S8-a | narrow snowy ledge under falling ice blocks: TNT with a crate stacked on top | T×1 + W×1 = 2 | stack, 2 high | jump, spin | STACK EXPLOSIVE-MIX SUPPORT-ORDER TIMED | jump-spin the upper crate: the TNT starts its fuse instead of going off under you (the fuse ran at 3:11:46) | LP1 3:11:38-3:11:46; GR 109-122 | high |
| S8-b | fenced stone ledge after the falling-ice plank path | x×1 = 1 | single | spin | ON-PATH REWARD | landing reward after the slow-mo crossing | LP1 3:12:00-3:12:02 | low |
| S8-c | unresolved crates on the falling-ice ledges | x×2 = 2 | unresolved | walk | ON-PATH | balance of GR 122 | GR 122 minus mapped | low |
| S8-d | checkpoint on the wooden dock | C×1 = 1 | single | walk | CHECKPOINT |  | LP1 3:12:08-3:12:10 (CHECKPOINT text) | medium |

### S9 — C5 → exit pier (cumulative 137)

```
 dock C5 ─ boat [?/x] (enemy) ─ floes ══ ══ [?] riding a floe → toward camera (trap)
   moored boat ─ pilings [?] ─ pier (crossbow) ─ motorboat ride ─ raft: [W/?][T][W] + [T][W][W] ─ (HUD 133) ─ exit pier [4]
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S9-a | fisherman's boat beside the dock: 2-stack on the deck next to the enemy | ?×1 + x×1 = 2 | stack, 2 high | spin, jump | ON-PATH STACK ENEMY-LINK | deck crates shared with an enemy at the start of the second floe field | LP1 3:12:10-3:12:14; GR 123-124 | high |
| S9-b | a single crate riding a floe to the right, drifting toward the foreground | ?×1 = 1 | single, on a floe | vehicle, backtrack, jump | BACKTRACK COUNT-TRAP TIMED | repeat of S6-a with a moving target: ride with it, don't chase it | LP1 3:12:16-3:12:20; GR 125 | high |
| S9-c | glowing ? on the pilings above a moored boat on the left | ?×1 = 1 | single | jump | DETOUR SINGLE | a reason to leave the floes for the moored boat | LP1 3:12:28 | medium |
| S9-d | small floating raft-dock: column of wood over ? beside a TNT and a wood crate | W×2 + ?×1 + T×1 = 4 | L-shaped group, 2 high | spin, timed | DETOUR EXPLOSIVE-MIX STACK | TNT inside a tight group on a raft with no room to retreat: stomp-and-leap timing | LP1 3:12:42-3:12:44 | medium |
| S9-e | same raft area: TNT and two wood in a row | T×1 + W×2 = 3 | row | spin, timed | ROW EXPLOSIVE-MIX | second TNT group on the raft | LP1 3:12:46-3:12:48 (HUD 133 at 3:12:54) | medium |
| S9-f | exit pier at the far side of the floe field: crate stack on a snow-capped platform | x×4 = 4 | stack/group | walk, spin | ON-PATH | GR's 4 crates on the exit pier | LP1 3:12:58-3:13:02; GR 137 | low |

### S10 — Exit pier → exit (cumulative 153)

```
 (side view, waterfall gorge)
 pier ─ behind the waterfall [x x][x x] ─ ledge: e:longshoreman [T]/[W]/[W] ─ under the house [T]/[W]
   ─ rope platforms ≈[T]≈   ≈[T]≈   [T] corner ─ boardwalk [x x] ─ EXIT SIGN (147 → 151/153) [G!] ─ exit
```

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S10-a | side view: behind the waterfall on the pier, crates on a ledge | x×4 = 4 | pair + pair | walk, jump | HIDDEN DETOUR COUNT-TRAP | second waterfall cache: GR's 4 easy-to-miss crates | LP1 3:13:04-3:13:10; GR 138-141 | low |
| S10-b | ledge with a stocky longshoreman: 3-high column with TNT on top of two wood | T×1 + W×2 = 3 | stack, 3 high | spin, jump | STACK EXPLOSIVE-MIX ENEMY-LINK SUPPORT-ORDER | TNT crowns the column next to an enemy: clear the enemy, then let the TNT drop and blow, or spin from below and run | LP1 3:13:12-3:13:14 | medium |
| S10-c | small ledge under a house: TNT on top of a wood crate | T×1 + W×1 = 2 | stack, 2 high | jump | STACK EXPLOSIVE-MIX EDGE-BAIT | TNT lit (3) on a ledge above the gorge; leap away to the swinging platforms | LP1 3:13:16 | medium |
| S10-d | TNT on a rope-hung platform | T×1 = 1 | single | jump, timed | EXPLOSIVE-MIX TIMED | TNT on a swinging footing: light it and leave before the swing brings you back | LP1 3:13:22 (sign 147/153 at 3:13:24) | medium |
| S10-e | TNTs on the swinging platform and on a corner platform | T×2 = 2 | singles | jump, timed | EXPLOSIVE-MIX TIMED | the final gauntlet is TNT on moving footholds | LP1 3:13:24-3:13:26 | medium |
| S10-f | boardwalk before the exit sign | x×2 = 2 | pair | spin | ON-PATH PAIR | last crates in front of the sign (sign 147 -> 151) | LP1 3:13:26-3:13:28 | low |
| S10-g | Nitro switch (green !) in front of the exit crate sign: pays the Nitros left in the level | N×2 = 2 | switch payout | switch | NITRO-SWITCH | 2 Nitro credited at the exit (151 -> 153) | LP1 3:13:28-3:13:30; GR 153 | high |

The finale swaps crates for TNT. Each swinging platform or ledge holds a TNT that has to be lit and escaped on a moving
footing. The exit sign then tells the player the count is 151, and the green ! adds the 2 Nitros that were never on the route.

## Enemies and hazards

| section | enemy/hazard | placement | relation to crates |
|---|---|---|---|
| S2, S9 | crossbow longshoremen (fish harpoons) | towers and piers | S2-a sits beyond the harpoon line; slow-mo lets you run under the shots |
| S6, S9 | fishermen on boats | small boats in the floe fields | share decks with S6-c and S9-a |
| S7, S8, S10 | helmeted / stocky longshoremen | tower top, steps, ledge by the TNT column | must be stomped; one guards S10-b |
| S5, S7, S8 | falling ice slabs / blocks | waterfall chasm, icefall, narrow ledges | crates sit on the safe rests (S5-a, S7-c, S8-a) |
| S6, S9 | floes and dark water | lagoons | water crates are reached by riding floes (S6-a, S9-b) |
| S5 | flame-jet ("inferno") crates | pyramid on the stone pier | the hazard is the crate itself |
| S10 | rope-hung swinging platforms | waterfall gorge | each carries a TNT (S10-d/e) |

## Puzzle rooms and dependency chains

1. **Timed red-! groups (S1-b/e/f, S7-a/b).** Setup: pink outlines become solid crates for a few seconds after a red !
   is hit. Correct: hit the !, use slow-mo, break the crates in path order. In S7, climb the staircase and break the
   permanent crate on top before the stairs fade. Tempting wrong move: break the lowest stairs first, or spend the
   meter before the switch. Lost: the outline crates and the S7 top crate (all-box only). Why it works: one device is
   taught three times on safe ground, then becomes a climb whose payoff is permanent.
2. **Nitro lid over the switch (B-a → B-b).** Setup: 7 Nitro on a bridge directly above an iron row with the red ! in
   its middle. Correct: chain-detonate from the start ledge, then hit the switch. Wrong: going under the bridge for the !
   first. Lost: death, or 7 + 2 bonus crates. Why: the player learns that Nitro can be cleared for credit, not just avoided.
3. **? column on a Nitro row (B-h).** Correct: stomp down the column from above, then detonate the row from range. Wrong:
   spinning the column from the side, which touches the Nitro next to it. Lost: death or 9 crates.
4. **TNT under a crate on a falling-ice ledge (S8-a).** Correct: jump-spin the top crate so the TNT starts its fuse,
   then back away along the ledge. Wrong: working at ground level under the falling ice. Lost: a life (crates survive
   either way). Why: TNT becomes a timing hazard on terrain that already forces you to move.
5. **Springboard stack (S6-b).** Correct: bounce off the top crate to reach the hidden gem, then smash the stack. Wrong:
   smash first. Lost: the hidden gem.
6. **Exit sign and Nitro switch (S10-g).** The sign's live count, 151, plus the switch's 2 Nitros make 153. Leaving
   without pressing the switch costs the box gem.

## Design logic of this level

1. Mask first: the slow-time mask is given at the spawn and the first three red-! groups (S1) are its tutorial on safe ground, before any enemy can punish a slow line.
2. Density curve: 17 / 18 / bonus 33 / 6 / 5 / 6 / 20 / 11 / 6 / 15 / 16. The bonus is 22 % of the level in about 40 s; the stretch after the bonus is deliberately thin while the set pieces (ship explosion, falling ice) play.
3. Seven count traps (35 crates) are off the forward line: tower after a cutscene (S4-a), floe crates that drift toward the camera (S6-a, S9-b), the gem pier (S6-b), two waterfall caches (S6-f, S10-a) and the crate above the timed stairs (S7-b).
4. Water crates are reached by riding a drifting floe, not by jumping: their placement teaches reading the current.
5. Explosive grammar escalates: TNT on a boat deck beside collectibles (S2-b), TNT under a crate (S8-a), TNT crowning a column next to an enemy (S10-b), TNT on swinging platforms (S10-d/e). The main route uses TNT only; Nitro appears in the bonus and as 2 hidden Nitros paid by the exit switch.
6. In the bonus, Nitro is used as a lid: a 7-Nitro bridge over the switch row (B-a) and a 6-Nitro row under a ? column (B-h). Nitros count when they explode, so clearing the lid is itself box credit.
7. Crates as tools: the gem stack is a springboard (S6-b), the arrow crate reaches a floating pair (S6-d/e), and the timed stairs are made of crates (S7-a).
8. Fruit-heavy rewards (gold fruit crate S7-c, flame pyramid S5-b) sit on detours that feed the 80 % fruit gem rather than the box gem.
9. Checkpoints close up late in the level (cumulative 17, 79, 105, 116, 122): the icefall and falling-ice ledges are the death-heavy part, and C4/C5 sit 11 and 6 crates apart.
10. The exit crate sign shows n/153 before the Nitro switch, so a player sees exactly what is missing before committing to the finish.

## Transfer to the skate game

1. **Timed outline arcs on a grind line (S1-e).** Put a `bang` at the start of a rail and a 4–5 crate float-line
   of outlines 1.2–1.7 m above the next 15–20 m of the same line, so the crates are collected by ollies off the grind.
   Our `bang` is permanent. The Crash 4 version needs a timed variant (outlines fade after ≈ 5 s, about 60–70 m at
   cruise speed). Without it, keep the arc permanent but place it over a gap that only a ≥ 12 m/s approach clears.
2. **Nitro lid over a switch row (B-a).** Lay 6–7 Nitro on a ledge directly above a crate row containing a `bang`.
   End a TNT grind row 2–3 m from the lid, so grinding it at ≥ 7 m/s outruns the blast and chains it into the Nitros
   (TNT/Nitro radius 2.75 m). The player then rides back and grinds the exposed row. The route never needs it; the
   all-box run does.
3. **Floe-drift count traps (S6-a, S9-b).** Put a single crate on a slow moving platform that drifts *toward* the camera
   beside a fast line. A rider at 12–23 m/s overshoots it and must turn around or ride with it.
4. **TNT under a plain crate (S8-a) on the board.** A 2-stack with TNT at the base on a skate line is a speed check.
   Above 13 m/s the plow detonates the TNT and kills. At 3–12 m/s a bump lights the fuse and the rider rolls clear; the
   blast (crate break radius ≈ 3.35 m) then takes the top crate. Put it after a downhill, so the safe choice is to brake.
5. **Waterfall caches next to checkpoints (S6-f, S10-a).** Hide a 4–7 crate alcove behind see-through or breakable
   scenery within a few metres of a checkpoint, off-axis from the corridor (−Z), so all-box players re-enter it from
   the checkpoint instead of replaying the section.
6. **Exit sign and Nitro switch.** End each level with a counter sign and a `nitrobang`. Nitro placed purely as dodge
   hazards on fast lines are then credited at the door, so "avoid" and "collect" stop competing.

## Open questions / uncertainties

- Exact composition of the S1 timed groups (3/4/2 outlines assumed so S1 totals GR's 17) and of the bonus mid-section
  (B-b…B-g are sized from HUD deltas, types partly unresolved).
- The 2 Nitros paid by the exit switch were never seen on screen. They may be off-route props in the gorge.
- GR's 108 at C4 vs the HUD's 116: adopted the HUD. The S7 timed staircase (5) is inferred from that difference.
- S2-e (5) and S8-c (2) are unresolved balances to GR's tallies; S9-f and S10-a are GR's "4 + 4" with partial frames.
- Whether the green-banded crates behind the second waterfall are bounce (wumpa) crates could not be resolved.
