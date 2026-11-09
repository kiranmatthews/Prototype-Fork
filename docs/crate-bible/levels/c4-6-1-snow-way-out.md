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
| S6-g | checkpoint on a stone pier | C×1 = 1 | single | walk | CHECKPOINT | banks the lagoon's search area: all-box players reload here to retry the waterfall room and the gem pier | LP1 3:10:56; GR 105 | high |

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
| S7-d | checkpoint on a lamp-lit stone platform by the houses | C×1 = 1 | single | walk | CHECKPOINT | placed right after the icefall, the level's most dangerous stretch, so a death there costs only the gold-crate detour | LP1 3:11:34 | high |
| S7-e | beside C4: two ? side by side with a ? above | ?×3 = 3 | pyramid, 2 high | spin | ON-PATH PYRAMID REWARD | reward at the checkpoint after the icefall | LP1 3:11:34-3:11:36 (HUD 116/153) | medium |

### S8 — C4 → C5 (cumulative 122)

| id | position (route order) | composition | arrangement | access | tags | why it is here | evidence | conf. |
|---|---|---|---|---|---|---|---|---|
| S8-a | narrow snowy ledge under falling ice blocks: TNT with a crate stacked on top | T×1 + W×1 = 2 | stack, 2 high | jump, spin | STACK EXPLOSIVE-MIX SUPPORT-ORDER TIMED | jump-spin the upper crate: the TNT starts its fuse instead of going off under you (the fuse ran at 3:11:46) | LP1 3:11:38-3:11:46; GR 109-122 | high |
| S8-b | fenced stone ledge after the falling-ice plank path | x×1 = 1 | single | spin | ON-PATH REWARD | landing reward after the slow-mo crossing | LP1 3:12:00-3:12:02 | low |
| S8-c | unresolved crates on the falling-ice ledges | x×2 = 2 | unresolved | walk | ON-PATH | balance of GR 122 | GR 122 minus mapped | low |
| S8-d | checkpoint on the wooden dock | C×1 = 1 | single | walk | CHECKPOINT | checkpoints close up here (only 6 crates after C4) before the second floe field and the TNT gorge | LP1 3:12:08-3:12:10 (CHECKPOINT text) | medium |

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

## Geometry, obstacles and enemies

Geometry pass (geo-G10). Sources: the first pass's LP1 frames (every 2 s, 0.5 s in the bonus), new 0.5 s grabs at LP1 3:07:40–3:07:48, 3:08:02–3:08:14, 3:09:30–3:09:38 and 3:10:57–3:11:10, GR 6-1, and gamepressure.com (enemy and hazard behaviour). **u = one crate edge**, estimated from crates in the same frame; Crash 4's camera and fish-eye make every width a range. Kind, size and behaviour columns are observations; 'why' columns are design inference. Crash 4 moves used here: double jump, slide-jump and the Kupuna-Wa slow-time mask; no wall-run panels or rails were seen in this level.

### Camera and route shape

A harbour loop that changes camera about every 30–60 s: into-screen for lateral navigation (the causeway, the wall-top path and both floe fields) and side view for timing and height (timed-! climbs, the harbour snipers, the bonus, the waterfall gorge, the icefall and the swing finale). The route never doubles back; the two floe fields (S6, S9) are the only places with free lateral movement, and both hide crates toward the camera. Dark harbour water bounds almost every section, so most gaps are treated as lethal (the run never touches the water, so this is assumed, not shown).

- **S1** — into-screen → side view: Into-screen causeway and stepping stones from the spawn (LP1 3:07:14–3:07:32); the camera swings to a side view for the icy walkway and the two timed-! groups (3:07:34–3:07:46); C1 at the turn (3:07:48).
- **S2** — side view: Side-scrolling harbour, left to right, with depth for the sniper towers and two moored boats (3:07:50–3:08:20).
- **B** — side view: Side-scrolling cave dock (3:08:22–3:09:04).
- **S3** — into-screen: One-crate-wide wall-top path over an ice canyon, then a boardwalk to the moored ship (3:09:08–3:09:24).
- **S4** — cutscene → into-screen → side view: Ship-explosion cutscene (3:09:26–3:09:30); the camera follows the boardwalk to the stone tower, then shows the tower ledge from the side (3:09:31–3:09:38).
- **S5** — side view → into-screen: Side-view waterfall gorge crossed on falling slabs (3:09:40–3:09:54); into-screen dock, single floe and pier (3:09:56–3:10:02).
- **S6** — into-screen (+ toward-camera detour): Into-screen floe lagoon; the S6-a crate requires riding a floe back toward the camera; waterfall room on the left (3:10:04–3:10:56).
- **S7** — side view: Timed-! tower climb and the icefall (3:10:58–3:11:32); C4 on a platform by the houses (3:11:34).
- **S8** — into-screen → high angle: Into-screen narrow ledges under falling ice (3:11:38–3:11:46); a high, near top-down angle on the plank path with falling cubes (3:11:48–3:11:58); oblique ledges to the C5 dock (3:12:00–3:12:08).
- **S9** — into-screen: Second floe field with motorboats crossing in lanes (3:12:10–3:12:58).
- **S10** — side view: Waterfall gorge with rope swings to the exit (3:13:00–3:13:30).

### Platforms and gaps (section by section; table per section)

Platform rows give shape, size in u, height change from the previous footing, edges and behaviour; gap rows give width (with the landing size), height change, the move the run used or a guide names, what couples the gap in time, and the failure. Several 'gaps' in this level are moving-platform crossings: the footing itself falls or drifts, which is what the slow-time mask is for.

#### S1 — Start → C1

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S1-a | S1 | platform: wide floor (snowy cobble causeway over dark water) | 3-4 wide x ~15 long | 0 | — | edges open (water both sides); static | REST TEACH | a wide, safe strip for the slow-time prompt and the first spin before any gap | LP1 3:07:14-3:07:20 (medium) |
| P-S1-b | S1 | platform: stepping stones (snow-capped stone block on posts, then a small floating plank raft) | block ~2x2; raft ~1.5x1.5 | 0 to +1 | — | edges open; block static; raft floats (bob not measurable) | STEPPING TEACH | the first gaps are two short hops over water onto pieces that read as solid; no enemy or timer here | LP1 3:07:22-3:07:24 (medium) |
| P-S1-c | S1 | platform: square pad (snow-topped stone pillar) | ~2.5x2.5 | +0.5 to +1 | running | edges open (ice spikes in the water to the right); static | LANDING STEPPING | the longest S1 jump; the run used slow-mo here, so the mask gets its first practical use on a static gap | LP1 3:07:28-3:07:30 (medium) |
| P-S1-d | S1 | platform: stepped stone tiers | ~3 wide; risers ~1 | +1 per tier (2 tiers) | — | edges open on the water side; static | REST | a short climb carrying the 2-high crate column; recovers the meter between timed groups | LP1 3:07:30-3:07:32 (low) |
| P-S1-e | S1 | platform: corridor (icy walkway on wooden trestles, two decks) | upper deck ~8-10 long x ~2 deep; lower deck one step down | -1 | — | edges railed; static; icy look (no sliding seen) | ARENA TEACH | a railed floor under the 4-crate timed arc: the only skill tested is the timer, not the footing | LP1 3:07:34-3:07:38 (medium) |
| P-S1-f | S1 | platform: perch (scenery pile of stencilled shipping crates, a barrel and a tyre) | ~2 wide x ~1.5 high | +1.5 | plain | edges open; static (not breakable) | PERCH STEPPING | a step that brings the high outline pair (3-4 u above the walkway) into double-jump range during the timer | LP1 3:07:40-3:07:43 (low) |
| P-S1-g | S1 | platform: narrow ledge (wooden scaffold) leading to the C1 ledge | scaffold ~2x2; C1 ledge ~3x3 | -2 (below the walkway end) | — | edges open; static | LANDING CHECKPOINT-PAD | a drop landing ends the timed run on a wide pad under the first crossbow tower | LP1 3:07:44-3:07:48 (low) |
| G-S1-a | S1 | gap: lethal water (causeway to the stepping stones) | 2-3 (landing 2x2 block, then a 1.5x1.5 raft) | 0 to +1 | plain | none; fail: death (assumed; the run never touches the water) | lethal yes; run-up 3-5; near S1-b | the first gaps are short and static, set before any timer or enemy | LP1 3:07:22-3:07:24 (medium) |
| G-S1-b | S1 | gap: lethal water (cobble path to the stone pillar) | 3-4 (landing 2.5x2.5 pillar) | +0.5 to +1 | running | none (the run used slow-mo anyway); fail: death | lethal yes; run-up 2-3; near S1-c | the longest jump of S1 is still static; using slow-mo here rehearses the mask on a gap that does not need it | LP1 3:07:28-3:07:30 (low) |
| G-S1-c | S1 | gap: drop-down (walkway end to the scaffold) | ~3 (landing ~2x2 scaffold) | -2 | running | the second timed group is still running; fail: not visible | lethal not visible; run-up 8-10 (walkway); near S1-g | ends the timed run on a lower pad that leads to C1 | LP1 3:07:44-3:07:46 (low) |

#### S2 — C1 → bonus pad

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S2-a | S2 | platform: round/hex pillar (narrow snow-capped posts) | tops 1-1.5 | 0 to +1 | — | edges open; static | STEPPING CHOKE | tiny tops directly under a sniper tower: every landing is inside the harpoon field, so hops are timed to the volleys | LP1 3:07:50-3:07:54 (low) |
| P-S2-b | S2 | platform: wide floor (moored fishing-boat deck) | ~10 long x ~3 deep; cabin ~3 high | 0 | — | edges railed (gunwales); static (moored) | REST ARENA | the first long rest of S2, shared with a crossbow man on the cabin roof and the first TNT row | LP1 3:07:56-3:08:02 (medium) |
| P-S2-c | S2 | platform: square pad (pole-hung red-plank pads) | ~1.5x1.5 | 0 | — | edges open; hung from poles; the first pass reports one swinging | STEPPING TIMING-STEP | two small pads between long decks, under the next tower | LP1 3:08:02-3:08:04, 3:08:10-3:08:12 (low) |
| P-S2-d | S2 | platform: wide floor (second moored boat, deck and cabin roof) | ~8 long | 0 to +2 (roof) | — | edges railed; static | REST | a rest between the two pad sets | LP1 3:08:04-3:08:06 (low) |
| P-S2-e | S2 | platform: square pad (snowy stone pillar beside the TNT ledge) | ~2x2 | +1 | — | edges open; static | LANDING CHOKE | a landing under a second tower, with two harpoon ropes staked into its own top | LP1 3:08:06-3:08:10 (low) |
| P-S2-f | S2 | platform: stone steps up to the round bonus pad | steps ~2 wide, risers ~1; pad ~2 across | +2 to +3 in total | — | edges open; static | BONUS-PAD | the strong crate sits on the steps just before the pad | LP1 3:08:12-3:08:20 (medium) |
| G-S2-a | S2 | gap: lethal water (post to post) | 2-3 (landing 1-1.5 post tops) | 0 to +1 | plain | crossbow volleys from the tower above; fail: death | lethal yes; run-up 1-2; near S2-a, E-S2-a, O-S2-a | small landings inside a sniper's field: the jump is easy, its timing is not | LP1 3:07:50-3:07:54 (low) |
| G-S2-b | S2 | gap: lethal water (boat deck to pole pads to boat deck) | 2-3 (landing 1.5x1.5 pads) | 0 | plain | pads may swing; a crossbow covers the next tower; fail: death | lethal yes; run-up 3-8 (deck); near S2-c, S2-e | long deck, short pad, short pad, long deck | LP1 3:08:02-3:08:06 (low) |
| G-S2-c | S2 | gap: chasm (snow gap under the rope-hung pads) | 2-3 (landing 1.5-2 pads) | 0 | plain | pad swing; fail: not visible | lethal not visible; run-up 1-2; near S2-d | the last hops before the stone steps and the bonus pad | LP1 3:08:10-3:08:12 (low) |

#### B — Bonus round

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-B-a | B | platform: wide floor (start ledge of wood and snow) | ~5 wide | 0 | — | edges open; static | PERCH SAFE-ISLAND | the safe spot from which the 7-Nitro lid is set off: the bonus opens with a look-before-acting perch | LP1 3:08:22-3:08:28 (medium) |
| P-B-b | B | platform: narrow ledge (iron row M r! M under the Nitro lid) | 3x1 | -1 to -1.5 | — | edges open; static (iron) | TIMING-STEP SAFE-ISLAND | it carries the switch and sits directly under the lid, so it cannot be reached until the lid is gone | LP1 3:08:22-3:08:32 (medium) |
| P-B-c | B | platform: perch (high ledge by the waterfall with the ?/R/R column; tower top with a ?) | ~2-3 wide | +3 to +5 | double | edges open; static | PERCH | height checks reached with double jumps inside the slow-mo window | LP1 3:08:34-3:08:46 (low) |
| P-B-d | B | platform: bridge/plank (arched snow bridge) | ~8 span, apex ~2 above its ends | +2 then -2 | — | edges open; static | STEPPING | a breather arc with a fruit trail between the two Nitro set pieces | LP1 3:08:38, 3:08:56 (low) |
| P-B-e | B | platform: wide floor (snowy platform with the 6-Nitro row and the ? column) | ~8 wide | -2 | — | edges open; static | ARENA | the second lid puzzle: the row fills most of the platform, so the column must be taken from above | LP1 3:08:58-3:09:02 (low) |
| G-B-a | B | gap: chasm spanned by a Nitro row (the lid over the switch row) | ~7 (landing 3x1 iron row) | -1 to -1.5 (onto the iron row once the lid is gone) | plain | the 7-Nitro lid must be detonated from the start ledge first; fail: death (touching Nitro) | lethal yes; run-up n/a; near B-a, B-b | the bonus's first gap is a lid: clear it, then drop onto the switch row | LP1 3:08:22-3:08:30 (medium) |
| G-B-b | B | gap: chasm (up to the high ledges and the tower top) | 3-5 (landing 2-3 wide ledges) | +3 to +5 | double | red-! timer; fail: the timed crates fade; fall back to dock level | lethal not visible; run-up short; near B-b, B-c, B-e | height under a timer | LP1 3:08:32-3:08:48 (low) |

#### S3 — Bonus exit → ship explosion

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S3-a | S3 | platform: corridor (narrow wall-top and plank tops on posts over an ice canyon) | 1-1.5 wide; segments ~2-4 long | 0 (small steps) | — | edges open (deep canyon both sides); static | STEPPING CHOKE | a balance beam with single crates in file: the crate line and the walking line are the same line | LP1 3:09:12-3:09:20 (medium) |
| P-S3-b | S3 | platform: corridor (boardwalk to the moored ship) | ~3 wide | 0 | — | edges railed in part; static | REST | widens before the cutscene | LP1 3:09:22-3:09:24 (medium) |
| G-S3-a | S3 | gap: chasm (ice canyon between plank tops) | ~1 (landing 1-1.5-wide plank) | 0 | plain | none; fail: death | lethal yes; run-up 2-4; near S3-b | short gaps on a one-crate-wide line: the risk is sideways, not distance | LP1 3:09:12-3:09:20 (low) |

#### S4 — Ship explosion → C2

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S4-a | S4 | platform: square pad (stone tower top beside the boardwalk end) | ~3x2, with a ~1-wide ledge on the gorge side | +1 | slide-jump | edges open; static | CHECKPOINT-PAD LANDING | a pad off to the left right after the cutscene, holding C2 and three crates; its gorge-side ledge is the launch point for the falling slabs | LP1 3:09:31-3:09:38; GR 75-79 (medium) |
| G-S4-a | S4 | gap: chasm (boardwalk end to the stone tower on the left) | 2-3 (landing ~3x2 tower top) | +1 | slide-jump | none (right after a cutscene); fail: death (gorge) | lethal yes; run-up 6-10 (boardwalk); near S4-a, S4-b, S4-c | GR names a slide-jump: its extra distance reaches the tower straight off the boardwalk | LP1 3:09:31-3:09:33; GR 75 (low) |

#### S5 — C2 → floating-ice lagoon

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S5-a | S5 | platform: sinking/floating (falling ice slabs descending through the waterfalls) | ~1.5-2 wide | falling (continuous) | running, double | edges open; descend continuously; new slabs replace them | TIMING-STEP STEPPING | the first falling-ice crossing; slow-mo turns a stream of falling footholds into readable steps | LP1 3:09:40-3:09:52 (medium) |
| P-S5-b | S5 | platform: round/hex pillar (ice pillar mid-gorge) | ~2 wide | 0 | — | edges open; static | SAFE-ISLAND REST | the one static rest in the gorge, splitting the crossing into two short no-stop runs | LP1 3:09:46-3:09:48 (low) |
| P-S5-c | S5 | platform: wide floor (lit house balcony, then a railed dock) | balcony ~4x3; dock ~3 wide | -1 to -2 (landing) | — | edges railed; static | LANDING REST | a large landing after the gorge, paid with one crate | LP1 3:09:54-3:09:56 (medium) |
| P-S5-d | S5 | platform: ice (single floe between the dock and the pier) | ~2x2 | -0.5 | — | edges open; floating; cracked surface | TEACH STEPPING | one floe on its own with solid ground on both sides: the ice rule is shown once before the floe field | LP1 3:09:58 (low) |
| P-S5-e | S5 | platform: square pad (stone pier with the flame pyramid) | ~4x3 | +0.5 | — | edges open; static | REST ARENA | a solid rest that holds the inferno-crate lesson and the Flashback tape | LP1 3:09:58-3:10:02 (medium) |
| G-S5-a | S5 | gap: moving-platform crossing (waterfall gorge on falling slabs) | ~12-16 in all; slab spacing 2-3 (landing 1.5-2 slabs; one ~2-wide pillar halfway) | net -1 to -2 | running, double | slabs descend continuously; slow-mo; fail: death | lethal yes; run-up 1 (tower ledge); near S5-a | the first falling-ice set piece, halved by a static pillar | LP1 3:09:40-3:09:54 (low) |
| G-S5-b | S5 | gap: lethal water (dock to pier across one floe) | 1-2 (landing 2x2 floe, then a 4x3 pier) | -0.5 / +0.5 | plain | floe drift; cracked surface; fail: death | lethal yes; run-up 3; near S5-b | a single-floe preview of the lagoon | LP1 3:09:58 (low) |

#### S6 — Lagoon → C3

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S6-a | S6 | platform: ice (frosted floes in drifting rows) | 2x2 to 3x2; rows 5-6 floes wide | 0 (bob) | — | edges open; drift sideways in lanes; frosted surface is safe footing | STEPPING REST | frosted floes are the only safe rests in the lagoon, and the drift decides what is reachable | LP1 3:10:04-3:10:18; gamepressure (medium) |
| P-S6-b | S6 | platform: ice (clear, slippery floes) | ~2x2 | 0 | — | edges open; slippery: Crash keeps sliding after landing | TIMING-STEP | a landing that keeps moving, so the next jump comes almost at once | LP1 3:10:14; gamepressure (medium) |
| P-S6-c | S6 | platform: crumbling (cracked floes) | ~2x2 | 0 | — | edges open; break shortly after landing | TIMING-STEP | forces a no-stop line through mixed floes | LP1 3:10:12-3:10:18 (cracks visible); gamepressure (low) |
| P-S6-d | S6 | platform: crumbling (collapsing wooden pallet behind the moored hull) | ~1.5x1 | 0 | — | edges open; collapses after landing (GR) | STEPPING BONUS-PAD | the only way to the gem pier: a one-shot step hidden behind the hull | LP1 3:10:16-3:10:20; GR (medium) |
| P-S6-e | S6 | platform: narrow ledge (railed pier behind the moored hull) | ~4x2 | +0.5 | — | edges railed; static | SAFE-ISLAND BONUS-PAD | solid ground for the springboard stack and the hidden gem | LP1 3:10:20-3:10:24 (medium) |
| P-S6-f | S6 | platform: moving platform (small rowboat with a lantern fisherman) | ~3x2 | 0 | — | edges gunwales; floating (drift not measurable) | ARENA | a tiny deck shared by an enemy and a crate | LP1 3:10:26-3:10:30 (medium) |
| P-S6-g | S6 | platform: square pad (small stone pier between pilings) | ~2x3 | +0.5 | — | edges pilings; static | PERCH | holds the arrow crate under the high floating pair | LP1 3:10:34-3:10:44 (medium) |
| P-S6-h | S6 | platform: wide floor (shallow shelf, waterfall curtain and hidden wooden room) | room ~4x4 (estimate) | 0 | — | edges walled; static | SAFE-ISLAND | a walled room behind a waterfall: the largest cache sits off the floe line next to the checkpoint | LP1 3:10:46-3:10:52 (low) |
| P-S6-i | S6 | platform: square pad (stone pier with C3) | ~3x3 | 0 | — | edges open; static | CHECKPOINT-PAD | the checkpoint after the lagoon search area | LP1 3:10:56 (medium) |
| G-S6-a | S6 | gap: lethal water (floe to floe) | 1-2 (landing 2x2 to 3x2 floes) | 0 | plain | sideways drift; cracked floes break; clear floes slide; fail: death | lethal yes; run-up 0-2; near S6-a, S6-c | small gaps whose difficulty is the footing and the drift, not the distance | LP1 3:10:04-3:10:18; gamepressure (medium) |
| G-S6-b | S6 | gap: crumble run (pallet to the gem pier) | 1-2 (landing 4x2 pier) | +0.5 | plain | the pallet collapses; fail: death | lethal yes; run-up 0; near S6-b | one-way access to the gem: a crumbling step behind a hull | LP1 3:10:16-3:10:20; GR (low) |
| G-S6-c | S6 | gap: moving-platform crossing (riding a floe back toward the camera) | n/a (drift) (landing the floe itself) | 0 | ride | floe drift; fail: death if you jump off early | lethal yes; run-up 0; near S6-a | the S6-a crate is reached by riding, not by jumping | LP1 3:10:10; GR 86 (medium) |

#### S7 — C3 → C4

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S7-a | S7 | platform: stepped stone steps to a stone hut tower | ~2 wide, risers ~1 | +2 to +3 | — | edges open; static | STEPPING | approach to the timed column, with the red ! on a step | LP1 3:10:57-3:11:00 (low) |
| P-S7-b | S7 | platform: phase/timed (outline column, 3 high, solid only while the red ! runs) | 1x1 x 3 high; permanent ? floating above | +3 | crate-bounce, double | edges open; timed: solid for a few seconds | TIMING-STEP STEPPING | the only stairs to a permanent crate exist only while the timer runs | LP1 3:11:00-3:11:03 (low) |
| P-S7-c | S7 | platform: round/hex pillar (narrow stone and wood pillars in the icefall) | tops ~1x1; spaced 6-8 | 0 | — | edges open; static | PERCH SAFE-ISLAND | observation posts between streams of falling slabs | LP1 3:11:08-3:11:32 (low) |
| P-S7-d | S7 | platform: sinking/floating (falling ice slabs in the icefall streams) | ~1.5 wide | falling | running, double | edges open; continuous descent | TIMING-STEP | the bridges between pillars are moving downward; slow-mo makes them usable | LP1 3:11:10-3:11:32 (low) |
| P-S7-e | S7 | platform: narrow ledge (raised ice ledge with the gold crate) | ~1.5 wide | +2 to +3 above a slab; ~4-5 above the pillar tops | double | edges open; static | BONUS-PAD | a fruit detour above the falling ice, reached from a slab with a double jump | LP1 3:11:10-3:11:20 (low) |
| P-S7-f | S7 | platform: square pad (lamp-lit stone platform with C4) | ~4x3 | 0 | — | edges open; static | CHECKPOINT-PAD REST | a wide pad straight after the icefall | LP1 3:11:34-3:11:36 (medium) |
| G-S7-a | S7 | gap: moving-platform crossing (icefall: pillar to pillar on falling slabs) | 6-8 between pillars (landing 1x1 pillar tops) | 0 net; slabs fall | running, double | slab streams; slow-mo; fail: death | lethal yes; run-up 0-1; near S7-c | the longest gaps of the level, made of moving footing | LP1 3:11:08-3:11:32 (low) |
| G-S7-b | S7 | gap: chasm (slab to the gold-crate ledge) | 2-3 (landing ~1.5-wide ledge) | +2 to +3 (from a slab) | double | slab descent; fail: death | lethal yes; run-up 0; near S7-c | an optional fruit detour that costs a life if missed | LP1 3:11:10-3:11:20 (low) |

#### S8 — C4 → C5

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S8-a | S8 | platform: narrow ledge (snowy cliff ledges) | 1.5-2 wide | 0 to -1 | — | edges open (cliff drop on one side); static | CHOKE | a narrow ledge under falling ice blocks, with the TNT-under-crate stack placed on it | LP1 3:11:38-3:11:46 (low) |
| P-S8-b | S8 | platform: bridge/plank (one-plank path along the cliff, high above the harbour) | ~1.2 wide; broken by 2-3 gaps | 0 | — | edges open; static | CHOKE STEPPING | a one-crate-wide path whose gaps are bridged only by falling ice cubes | LP1 3:11:48-3:11:58 (low) |
| P-S8-c | S8 | platform: sinking/floating (falling ice cubes) | ~1x1 | falling | plain | edges open; drop through the gaps in sequence | TIMING-STEP | a stepping stone you land on while it falls: the hardest slow-mo crossing | LP1 3:11:48-3:11:58 (low) |
| P-S8-d | S8 | platform: narrow ledge (fenced stone ledge, then a stone ledge by the houses) | ~2-3 wide | 0 | — | edges fenced; static | REST ARENA | a rest, then a bomb thrower's ledge | LP1 3:12:00-3:12:06 (low) |
| P-S8-e | S8 | platform: wide floor (wooden dock with C5) | ~6x3 | 0 | — | edges open; static | CHECKPOINT-PAD | the checkpoint at the mouth of the second floe field | LP1 3:12:08-3:12:10 (medium) |
| G-S8-a | S8 | gap: moving-platform crossing (plank-path gaps bridged by falling cubes) | 2-3 per gap; 2-3 gaps (landing 1x1 cube) | 0 to -1 (the cube is falling) | plain | cubes fall in sequence; slow-mo; fail: death | lethal yes; run-up 1-3; near S8-b | the smallest landing in the level, and it is moving down | LP1 3:11:48-3:11:58 (low) |

#### S9 — C5 → exit pier

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S9-a | S9 | platform: moving platform (fisherman's boat beside the dock) | ~3x2 | 0 | — | edges gunwales; floating | ARENA | the first step of the floe field is an enemy-held deck with a 2-stack | LP1 3:12:10-3:12:14 (medium) |
| P-S9-b | S9 | platform: ice (frosted and clear floes) | ~2x2 | 0 | — | edges open; drifting; clear ones slippery | STEPPING | a repeat of S6 with tighter gaps | LP1 3:12:14-3:12:26 (low) |
| P-S9-c | S9 | platform: moving platform (white motorboats) | ~1.5x3 | 0 | ride | edges open; travel in lanes across the field | STEPPING TIMING-STEP | rides between distant piers: the player waits for a boat and boards it | LP1 3:12:22-3:12:26, 3:12:40, 3:12:54-3:12:56 (medium) |
| P-S9-d | S9 | platform: narrow ledge (floating plank pier held by a crossbow man) | ~2.5x6 | 0 | — | edges open; floating | ARENA | a long, narrow pier inside a sniper's line | LP1 3:12:30-3:12:36 (low) |
| P-S9-e | S9 | platform: square pad (raft-dock) | ~4x3 | 0 | — | edges open; floating | REST | a small floating dock carrying two TNT groups, with no room to retreat | LP1 3:12:42-3:12:48 (medium) |
| P-S9-f | S9 | platform: square pad (exit pier) | ~3x3 | +0.5 | — | edges open; static | LANDING | the end of the floe field and of the motorboat ride | LP1 3:12:56-3:12:58 (low) |
| G-S9-a | S9 | gap: lethal water (floe to floe) | 1-1.5 (landing ~2x2 floes) | 0 | plain | drift; clear floes slide; fail: death | lethal yes; run-up 0-2; near S9-b | the S6 rules again with tighter gaps | LP1 3:12:14-3:12:26 (low) |
| G-S9-b | S9 | gap: moving-platform crossing (motorboat rides) | ~10-20 of water crossed while riding (landing ~1.5x3 boat) | 0 | ride | boat lanes: wait for a boat, then board; fail: death | lethal yes; run-up 0; near S9-d, S9-e | the crossing is a wait-and-board decision, not a jump | LP1 3:12:38-3:12:42, 3:12:54-3:12:58 (low) |

#### S10 — Exit pier → exit

| id | section | kind | size / width (u) | height Δ (u) | required move | coupling / failure | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| P-S10-a | S10 | platform: narrow ledge (wooden pier platforms and scaffold) | ~3 wide | 0 to +2 | — | edges open; static | STEPPING | a side-view climb into the gorge | LP1 3:13:00-3:13:06 (low) |
| P-S10-b | S10 | platform: narrow ledge (bracket ledge behind the waterfall) | ~2 wide | +2 to +3 | double | edges open; static | BONUS-PAD | the hidden cache ledge, reached by a big jump through the falling water | LP1 3:13:06-3:13:10 (low) |
| P-S10-c | S10 | platform: narrow ledge (ledge with a stocky longshoreman and the TNT column) | ~3 wide | 0 | — | edges open; static | ARENA | an enemy and a TNT-topped column share a short ledge | LP1 3:13:12-3:13:14 (low) |
| P-S10-d | S10 | platform: moving platform (rope-hung swinging snow-plank platforms) | ~2x2 | 0 to -1 | running | edges open; swing on long ropes (period not measured) | TIMING-STEP STEPPING | the finale's footing moves, and each platform carries a TNT | LP1 3:13:16-3:13:24 (low) |
| P-S10-e | S10 | platform: narrow ledge (small broken bracket ledges and a corner platform) | ~1.5 | 0 | — | edges open; static | SAFE-ISLAND | short rests between swings | LP1 3:13:18-3:13:26 (low) |
| P-S10-f | S10 | platform: wide floor (exit boardwalk with the crate sign and Nitro switch) | ~3 wide | 0 | — | edges railed; static | REST | the end of the level | LP1 3:13:26-3:13:30 (medium) |
| G-S10-a | S10 | gap: chasm (pier to the bracket ledge behind the waterfall) | 3-4 (landing ~2-wide ledge) | +2 to +3 | double | none; fail: fall into the gorge (not visible) | lethal not visible; run-up 2-3; near S10-a | the hidden-cache jump goes through the falling water | LP1 3:13:06-3:13:10 (low) |
| G-S10-b | S10 | gap: swing/vine (rope-hung platforms over the gorge) | 2-4 (landing ~2x2 swinging platforms) | 0 to -1 | running | swing phase plus a lit TNT on the platform; fail: death | lethal yes; run-up 1-2; near S10-d, S10-e | moving footing combined with an explosive timer | LP1 3:13:16-3:13:24 (low) |

### Jump sequences

| id | section | count | moves | rhythm | widest gap (u) | rest | no-stop | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| J-S1-a | S1 | 3 | plain, running | even | 3-4 | P-S1-c, then P-S1-d | no | three hops over water before any hazard; every landing is a place to stop | LP1 3:07:22-3:07:30 |
| J-S1-b | S1 | 4 | plain | even | n/a (above the walkway) | P-S1-e | yes | a timed arc broken in sequence while slow-mo lasts | LP1 3:07:34-3:07:38 |
| J-S1-c | S1 | 3 | plain, double, running | accelerating | 3-4 (up) | P-S1-g, then C1 | yes | hit the switch, climb the pile, double-jump to the high pair and drop to the scaffold inside one timer | LP1 3:07:38-3:07:46 |
| J-S2-a | S2 | 3-4 | plain | syncopated (wait for the volleys) | 3 | P-S2-b | no | hops timed to the harpoon volleys from the tower | LP1 3:07:50-3:07:56 |
| J-S2-b | S2 | 5-6 | plain | long-short-short-long (deck, pad, pad, deck) | 3 | P-S2-d, then P-S2-f | no | decks and small pads alternate | LP1 3:08:02-3:08:12 |
| J-B-a | B | 5-7 | plain, double | accelerating | 3-5 (up) | P-B-c | yes | the timed outlines and the high column are taken in one slow-mo window | LP1 3:08:30-3:08:48 |
| J-B-b | B | 3 | crate-bounce | even | 0 (one column) | P-B-e | yes | stomp down the ? column whose sides touch Nitro | LP1 3:08:58-3:09:01 |
| J-S3-a | S3 | 5-7 | plain | even | ~1 | P-S3-b | no | balance-beam hops with single crates in file | LP1 3:09:12-3:09:20 |
| J-S5-a | S5 | 4-6 | running, double | accelerating (the slabs keep falling) | 2-3 | P-S5-b halfway, then P-S5-c | yes | two no-stop halves split by the ice pillar | LP1 3:09:40-3:09:54 |
| J-S6-a | S6 | 8-12 | plain, ride | syncopated (wait for floes to line up) | 2 | frosted floes, P-S6-e, P-S6-g, P-S6-i | no | a search field: many short hops with optional detours | LP1 3:10:04-3:10:56 |
| J-S7-a | S7 | 4 | crate-bounce, double | even | 0 (vertical) | tower top | yes | bounce up the timed column and take the permanent ? before the stairs fade | LP1 3:11:00-3:11:03 |
| J-S7-b | S7 | 6-8 | running, double | syncopated (perch, read, go) | 6-8 via slabs | pillar tops (P-S7-c), then P-S7-f | no-stop between pillar perches | perch-and-go across the icefall | LP1 3:11:08-3:11:32 |
| J-S8-a | S8 | 3-4 | plain | even (the cube cadence) | 2-3 | P-S8-d | yes | the cubes fall in sequence, so the hops follow their cadence | LP1 3:11:48-3:12:00 |
| J-S9-a | S9 | 6-10 | plain, ride | syncopated | 1.5 (plus rides) | P-S9-d, P-S9-e, P-S9-f | no | floe hops plus waits for motorboats | LP1 3:12:14-3:12:58 |
| J-S10-a | S10 | 4-5 | running, double | syncopated (swing phase) under a 3 s fuse | 3-4 | P-S10-e brackets, then P-S10-f | yes | each lit TNT on a swing forces the next jump inside its fuse | LP1 3:13:16-3:13:28 |

### Obstacles and hazards

| id | section | kind | placement | timing / telegraph | counter | combined with | role | why | evidence |
|---|---|---|---|---|---|---|---|---|---|
| O-S2-a | S2 | turret: crossbow longshoremen firing fish harpoons (lethal: yes) | overhead and flank (two tower tops and a boat-cabin roof) firing across the path | periodic volleys; warning: harpoons already stuck in the boards at C1, and the crossbow is drawn before each shot | wait-and-go, outrun | P-S2-a posts, S2-a crates, S2-b TNT row | TIMING-GATE AREA-DENIAL | a projectile field over small footing: read the volley rhythm, then hop; gamepressure: stop time while the fish are in the air and run under them | LP1 3:07:48-3:08:10; gamepressure (medium) |
| O-S2-b | S2 | tripwire: harpoon ropes left stretched from the towers to the ground and pillar tops (lethal: yes) | across path (diagonal lines) | static once fired | jump over, go around | P-S2-e | LANE-BLOCK | every volley leaves lines across the landing space, so the field changes as the sniper fires (gamepressure: touching the string kills) | LP1 3:07:50-3:07:52, 3:08:06-3:08:10; gamepressure (low) |
| O-B-a | B | explosive lid: a 7-Nitro row bridging the gap directly above the iron switch row (lethal: yes) | across path (at ledge level, over the switch) | static until set off; the chain runs along the row in about a second (HUD 0 -> 4 -> 7) | destroy | B-a, B-b, P-B-b | LANE-BLOCK TEACH | the hazard is also the door: it must be chain-detonated from the start perch before the switch below can be reached | LP1 3:08:22-3:08:30 (medium) |
| O-B-b | B | explosive lid: a 6-Nitro row under the end of a 3-high ? column (lethal: yes) | on platform | static until set off | destroy | B-h, P-B-e | TEST | the column must be stomped down from above before the row is chained from range, because its sides touch Nitro | LP1 3:08:58-3:09:02 (medium) |
| O-S5-a | S5 | falling object: ice slabs falling through the waterfalls (they are also the footholds) (lethal: yes) | on platform | continuous stream at medium speed (not measured) | wait-and-go | S5-a landing crate | TIMING-GATE TEST | the slow-time mask turns a stream of falling footholds into steps; one static pillar halves the crossing | LP1 3:09:40-3:09:52 (medium) |
| O-S5-b | S5 | flame jet: inferno crates breathing fire (lethal: yes) | on platform (the crate pyramid on the pier) | cycle of a few seconds; the flame itself is the telegraph | wait-and-go | S5-b pyramid, Flashback tape | TEACH RHYTHM | hazard and reward are the same object: wait for the flame to stop, then spin | LP1 3:09:58-3:10:02; gamepressure (medium) |
| O-S6-a | S6 | collapsing scenery and slippery ice: cracked floes break, clear floes slide (lethal: yes) | on platform | cracked: shortly after landing; clear: on landing | go around, jump over | G-S6-a, S6-a crate | TEACH AREA-DENIAL | a legible surface code (frosted safe, clear slippery, cracked breaks) taught on a field you can stop in | LP1 3:10:12-3:10:18; gamepressure (medium) |
| O-S6-b | S6 | floating fire: a frozen fish in an ice block with a flame on top (lethal: not visible) | in pit (drifting among the floes) | drifts | go around | S6-c boat | AREA-DENIAL | a drifting obstacle beside the fisherman's boat; its damage was not shown | LP1 3:10:30-3:10:32 (low) |
| O-S7-a | S7 | falling object: icefall slab streams between the pillars (lethal: yes) | between pillars (they are also the footholds) | continuous | wait-and-go | S7-c gold crate | TIMING-GATE TEST | perch on a pillar, watch a stream, then go | LP1 3:11:08-3:11:32 (low) |
| O-S8-a | S8 | falling object: ice blocks crashing onto the narrow ledge (lethal: yes) | overhead (onto the path) | in sequence; warning not visible at a 2 s cadence | outrun | S8-a TNT under a crate | PURSUIT TIMING-GATE | the TNT stack sits exactly where lingering is dangerous | LP1 3:11:38-3:11:46 (low) |
| O-S8-b | S8 | falling object: ice cubes dropping through the plank-path gaps (also the footholds) (lethal: yes) | on path | in sequence; slow-mo | wait-and-go | — | TIMING-GATE TEST | the cubes are the only bridges, and they are moving | LP1 3:11:48-3:11:58 (low) |
| O-S8-c | S8 | collapsing scenery: an enemy destroys the path ahead (location unconfirmed) (lethal: yes) | across path | triggered as you approach | jump over | — | TEST | gamepressure: slow time at the right moment to jump the broken path; not located in the frames (S2 or S8 likely) | gamepressure only (low) |
| O-S9-a | S9 | turret: crossbow longshoreman on the floating plank pier (lethal: yes) | on platform (fires along the pier) | volleys | wait-and-go, destroy | P-S9-d | GATEKEEPER | the pier is a narrow line straight into his aim; the run spins him | LP1 3:12:30-3:12:36 (medium) |
| O-S10-a | S10 | swinging platforms carrying TNT (lethal: yes) | on platform | swing (period not measured) plus the 3 s TNT fuse | wait-and-go, jump over | S10-d, S10-e TNT | RHYTHM TEST | two clocks on one footing: the swing says when you can jump, the fuse says when you must | LP1 3:13:16-3:13:26 (low) |

### Enemies (detailed)

| id | section | kind | archetype | behaviour | counter (what fails) | placement | role | first alone? | why | evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| E-S2-a | S2 | crossbow longshoreman (fish-harpoon sniper) | projectile | perched on a tower above C1 and the posts; fires fish harpoons trailing ropes down across the path at intervals | avoid (fails: standing in the firing line, touching a harpoon rope) | above | PROJECTILE TIMING-GATE | yes (alone on a tower above the C1 pad) | introduces the sniper from a safe pad, with stuck harpoons as the warning | LP1 3:07:48-3:07:54; gamepressure (medium) |
| E-S2-b | S2 | crossbow longshoreman on the moored boat's cabin roof | projectile | fires along the deck that holds the TNT row | avoid, spin (fails: standing in the firing line) | above (cabin roof over the deck) | PROJECTILE GUARD | no | turns the S2 rest deck into a timed space | LP1 3:07:56-3:08:02 (low) |
| E-S2-c | S2 | crossbow longshoreman on the second tower | projectile | covers the stone pillar and the TNT ledge; two of his ropes are staked into the pillar top | avoid (fails: touching the ropes on the landing) | above | PROJECTILE AREA-DENIAL | no | combines projectile timing with a cluttered landing | LP1 3:08:06-3:08:10 (low) |
| E-S6-a | S6 | fisherman with a lantern | static | stands on a tiny drifting rowboat beside a crate | spin (fails: nothing seen) | moving platform | GUARD | yes (alone on his boat) | occupies the only standing space next to the crate, so the crate costs a fight on a small deck | LP1 3:10:26-3:10:30 (medium) |
| E-S7-a | S7 | bomb-throwing longshoreman (yellow coat, blue helmet, lit black bomb) | projectile | stands on the ledge right of the timed tower and lobs bombs with a smoke trail | spin (fails: approaching mid-throw) | landing platform (top of the climb) | GATEKEEPER PROJECTILE | yes (alone on his ledge) | gamepressure: approach while he winds up to throw, then attack | LP1 3:11:04-3:11:06; gamepressure (medium) |
| E-S7-b | S7 | helmeted longshoreman | shielded/armored | a stationary blocker on the steps beside C4 | stomp (fails: attacking from the front) | on line (steps) | GATEKEEPER TEACH | yes (on the C4 pad) | met on a checkpoint pad, so the stomp-only rule is learned where a mistake costs little (gamepressure: hit them from above) | LP1 3:11:36; gamepressure (low) |
| E-S8-a | S8 | bomb-throwing longshoreman | projectile | lobs bombs from a stone ledge by the houses | spin (fails: approaching mid-throw) | landing platform | PROJECTILE GATEKEEPER | no | a second thrower guards the approach to C5 | LP1 3:12:04-3:12:06 (low) |
| E-S9-a | S9 | fisherman on the boat beside the C5 dock | static | stands next to the 2-stack on the deck | stomp, spin (fails: nothing seen) | moving platform | GUARD | no | the first step of the second floe field is an enemy-held deck | LP1 3:12:10-3:12:14 (medium) |
| E-S9-b | S9 | crossbow longshoreman on the floating plank pier | projectile | fires along the narrow pier | spin (fails: approaching in the firing line) | on line (pier) | GATEKEEPER PROJECTILE | no | a sniper met at close range: the run closes the distance and spins him | LP1 3:12:30-3:12:36 (medium) |
| E-S10-a | S10 | stocky longshoreman (helmet or thrower type not resolvable) | static | holds a ~3 u ledge beside the TNT-topped column | spin, stomp (fails: spinning the column while he stands beside it) | guarding crate | GUARD | no | enemy and explosive on one ledge: clear him first, then deal with the TNT | LP1 3:13:12-3:13:14 (low) |

No enemy appears in S1, the bonus, S3, S4 or S5: the timed-! tutorial, the balance-beam path and the first falling-ice crossing are hazard-only. Enemies are archetype-sorted by stretch: snipers in S2 and S9, deck guards on boats in S6 and S9, throwers and a helmeted blocker around C4 and C5.

### Section beats

- **S1** (gaps 3 · enemies 0 · hazards 0): spawn floor + 2 crates → slow-mo prompt + timed trio → stepping stones (2 hops over 2-3 u of water) → running jump to a pillar (3-4 u) → stone tiers + crate column → side view: timed arc of 4 over a railed walkway → timed high pair via a scenery pile + double jump → drop to the scaffold → C1
- **S2** (gaps 3 · enemies 3 · hazards 2): sniper tower above C1 (stuck harpoons as warning) → posts 1-1.5 u under volleys → ? on a pillar → boat deck: TNT row + sniper on the cabin → pole pads x2 → second boat → pillar under a second tower (harpoon ropes) → rope-hung pads → stone steps + strong crate → bonus pad
- **B** (gaps 2 · enemies 0 · hazards 2): perch: detonate the 7-Nitro lid → drop onto the iron switch row (red !) → timed outlines + high column (double jumps) → Nitro pair, Nitro on a crate → second red ! pair at floor level → arched bridge → ? column on the 6-Nitro row (stomp down, chain) → exit pad
- **S3** (gaps 1 · enemies 0 · hazards 0): exit pad + ledge crate → wall-top balance beam (1-1.5 u) with crates in file → boardwalk → post crate → ship-explosion cutscene
- **S4** (gaps 1 · enemies 0 · hazards 0): slide-jump left to the tower (2-3 u, +1) → count-trap crate → C2 + edge crates
- **S5** (gaps 2 · enemies 0 · hazards 2): side view: falling-slab gorge (two halves, pillar rest) → house balcony landing + crate → dock, single floe → inferno-crate pyramid + tape
- **S6** (gaps 3 · enemies 1 · hazards 2): floe field (frosted / clear / cracked) → ride a floe toward the camera for a crate → collapsing pallet to the gem pier (springboard stack) → rowboat fisherman + crate → burning ice block → arrow pier + high pair → waterfall room (7) → C3
- **S7** (gaps 2 · enemies 2 · hazards 1): stone steps + red ! → timed column bounce to a permanent crate → bomb thrower on the ledge → icefall: pillar perches + falling slabs → gold-crate ledge detour → C4 + ? trio → helmeted blocker on the steps
- **S8** (gaps 1 · enemies 1 · hazards 3): narrow ledge under falling ice blocks + TNT under a crate → plank path with falling-cube gaps (slow-mo) → fenced ledge rest → bomb thrower's ledge → C5 dock
- **S9** (gaps 2 · enemies 2 · hazards 1): fisherman's boat + 2-stack → floes (tighter gaps) → floe-riding crate toward the camera → moored boat + ? on pilings → sniper on the floating pier → motorboat ride → raft-dock TNT groups → motorboat ride → exit-pier crates
- **S10** (gaps 2 · enemies 1 · hazards 1): side-view gorge piers → waterfall-ledge cache (double jump) → stocky enemy + TNT column → TNT on a ledge → three swinging platforms with TNT → boardwalk, crate sign, Nitro switch

### Geometry and enemy design logic

1. The mask defines the level's gap vocabulary. Static gaps are short (1-4 u). Every long or hard crossing is a moving-platform crossing whose footing falls or drifts: slabs (S5), slab streams (S7), cubes (S8), floes (S6, S9), boats (S9) and swings (S10). Slow-mo converts a timing problem into a reading problem.
2. The three falling-ice set pieces escalate in a clean order. The gorge (G-S5-a) is 2-3 u slab spacing with a static pillar halfway. The icefall (G-S7-a) has pillars 6-8 u apart and an optional ledge above. The plank path (G-S8-a) is 1x1 cubes on a 1.2 u path with no rest at all.
3. Gaps arrive before enemies. S1 teaches water gaps, the first long jump and two timed groups with no enemy in sight. The first sniper is then shown from the C1 pad, with harpoons already stuck in the boards.
4. Snipers create timed space over small footing. Posts of 1-1.5 u sit directly under the crossbow tower (P-S2-a). The harpoon ropes left after each volley clutter the next landing (O-S2-b).
5. Enemy archetypes are sorted by stretch: projectiles in S2 and S9, deck guards on boats (S6, S9), throwers and a helmeted stomp-only blocker around C4-C5. The helmeted blocker first appears on the checkpoint pad itself (E-S7-b).
6. The floe fields teach a surface code and then test it. A single cracked floe between two piers comes first (P-S5-d). The full field follows, where frosted floes are rests, clear ones slide and cracked ones break. The second field tightens gaps to 1-1.5 u and adds motorboat rides.
7. Rest spacing is short. A solid pier, deck, pillar or boat comes every 2-5 jumps. Every checkpoint sits on a wide pad (3x3 to 6x3 u), and the late checkpoints come close together because the falling-ice stretches kill most.
8. Side view is used for timing and height (timed-! climbs, the gorge, the icefall, the swings); into-screen for lateral choice (floes, the wall-top path). Toward-camera drift is reserved for count traps.
9. Balance beams carry crates but no enemies or timers. The 1-1.5 u wall-top (S3) and the 1.2 u plank path (S8) are the narrowest footing in the level. S3 has single crates in file and nothing else; S8 replaces crates with falling cubes.
10. Hazards and crates share objects. Inferno crates are the hazard (O-S5-b), the S10 swings carry TNT, and the gem stack is a springboard. The geometry around them is plain so the object is the lesson.
11. Height gating stays modest because the double jump is assumed. The high outline pair (3-4 u up) needs a scenery step first. The tallest reaches use tools: the arrow on the stone pier and the bounce off the gem stack.
12. The finale combines two clocks on one footing. Each rope swing has its own phase, and the TNT on it gives a 3 s fuse, so S10 is the only no-stop stretch that is not falling ice.
13. The run never doubles back. Search content is lateral (floe fields) or hidden behind waterfalls next to rests, so the main line stays a single readable path.

### Geometry transfer to the skate game

1. Falling-footing crossing without slow-mo: build it from `mover` platforms that descend at ~1.5 m/s. Space them at most 3 u (≈ 3.5 m) apart, well inside the 5.6 m full jump, and put a static `platform` rest after every 3 movers (the S5 pillar). Do not copy the 6-8 u icefall spacing: it depends on slow-mo and on double jumps from moving footing.
2. Floe field as a skate-free search zone: a 20-30 m wide water `pit` with 2x2 u (2.3 m) `mover` floes drifting sideways at 1-2 m/s. Make 1 in 4 a `crumble` (cracked) and some slippery (clear), with surface colour as the code. Hide one crate on a floe that drifts toward the camera, beside the main −Z line.
3. Sniper over small footing: a `sentry` on a raised tower 6-8 m above a side-scroll zone of 1-1.5 u `platform` posts (1.2-1.7 m tops) spaced 2.3-3.5 m. Show the first sentry from a checkpoint pad with spent projectiles already stuck in the scenery, and keep crates on the far side of its lane.
4. Balance-beam grind line: the 1-1.5 u wall-top maps to a grindable ledge or `rail` 1.2-1.7 m wide over a `pit`. Single crates in file on an authored rail break only at ≥ 12.5 m/s and knock a slower rider off, so put a `speedpad` or downhill before the line, or keep the crates beside the rail rather than on it.
5. Swing finale: three `ropeswing` or `pendulum` platforms (2x2 u) each carrying a TNT. The 3 s fuse forces the player on, and the 2.75 m blast fits inside a 2.3 m platform plus margin. Give each swing a static bracket ledge between them so the fuse is the only pressure.
6. Stomp-only blocker on a checkpoint pad: use a `turtle` (stomp-favoured) or `spiker` variant on the checkpoint platform itself, where a failed spin costs nothing. Only later put one on steps with a drop behind them.

## Open questions / uncertainties

- Exact composition of the S1 timed groups (3/4/2 outlines assumed so S1 totals GR's 17) and of the bonus mid-section
  (B-b…B-g are sized from HUD deltas, types partly unresolved).
- The 2 Nitros paid by the exit switch were never seen on screen. They may be off-route props in the gorge.
- GR's 108 at C4 vs the HUD's 116: adopted the HUD. The S7 timed staircase (5) is inferred from that difference.
- S2-e (5) and S8-c (2) are unresolved balances to GR's tallies; S9-f and S10-a are GR's "4 + 4" with partial frames.
- Whether the green-banded crates behind the second waterfall are bounce (wumpa) crates could not be resolved.
- Geometry: whether the harbour water is lethal everywhere was never shown (the run never touches it); the first pass reads one shallow, wadeable shelf at the waterfall room (3:10:46–3:10:54).
- Geometry: the slab, cube and swing cycle times could not be measured at the available cadence; all timings are qualitative.
- Geometry: GR names a slide-jump for the tower after the ship explosion, but the measured gap (2–3 u, +1) looks within a plain jump; the camera angle may hide extra distance.
- Geometry: gamepressure's "enemy destroys the path ahead" beat (O-S8-c) could not be located in the frames.
- Geometry: the S10 stocky longshoreman could not be classified as a helmet or a thrower type; the run dispatched him with a spin or stomp.
