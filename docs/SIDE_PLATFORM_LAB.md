# Side Platform Lab

The second side-scrolling test course: **Side Platform Lab** (`side-platform-lab`,
`src/levels/side-platform-lab.ts`). [Side Pipe Lab](SIDE_ON_PIPES.md) is about halfpipes seen across
their section and carries the platforming objects that fitted between them. This one carries **every
other platforming object the game has**, one station each, so that each can be played on its own.

Direct link: `?playtest&level=side-platform-lab`. In the menu it is `Side Platform Lab`.

It is 1,781 m long and is laid out like the other lab: one east travel zone on a single plane (z = 0,
held by two unseen walls), seen from the south through the same long lens, so it reads left to right and
flat. There are **29 stations**. Each opens on a checkpoint (36 in all: `K` and `L` warp between them),
shows its object once where a mistake is cheap, and then once more with something at stake. Stations 1
to 21 are walked; 22 to 28 are a board line; the last is the prizes.

Everything below was measured with the real player in this engine. `npm run check:side-platform`
(`tools/test-side-platform-lab.mjs`) plays every station and the whole course, and
`tools/side-platform-lab-bot.mjs` is the scripted player it uses.

## The stations

Distances are from each station's start; heights are over its floor.

| # | Station | x | What is there | What it asks |
|---|---|---|---|---|
| 1 | Ramps | 0–50 | a `ramp` rising east 1.5 m in 6 (yaw −90), a block, a `ramp` falling east (yaw 90); then a 1.3 m kicker to a 4 m gap | walk them; **jump** off the kicker (a walker is not thrown by a ramp: run off it and he falls 0.5 m short) |
| 2 | Rolling ground | 50–98 | a 32 m `terrain` strip, splined through +0.9, −0.4 and +1.1 m and bumped (no kerbs: seen from the side, the near one hides him to the chest) | run it |
| 3 | Timber road | 98–144 | a 30 m `woodpath` on its own bamboo scaffold over a drop, humped 1.4 m | run it; boxes on the hump |
| 4 | Rocks and a log | 144–202 | a `log` (1.1 m), four `rock` boulders (0.9, 1.7, 2.5, 1.3 m) overlapped into a ridge, an `idol` (1.8 m), a `wallpath` wall (1.1 m) | a tap over the log and up each boulder, a held jump over the statue |
| 5 | Ice | 202–262 | a 14 m ice sheet (`slip`, `iceGrip` 0.12); an 8 m ice chute down 2 m (`slipGravity`) onto a 10 m run-out and a 3.5 m gap | slide; a tap at the brink |
| 6 | Deep sand | 262–302 | 12 m of `groundSpeedLimit` 2.4; then 6 m of it with boxes standing in it | wade: the 40 m take 9.8 s |
| 7 | Water | 302–352 | a pool to swim, 22 m long and 2.65 m deep, a ramp in and a ramp out; then 4 m of water that kills | swim; a tap over the second |
| 8 | Arrows and steel | 352–400 | `empty` boxes, a `multihit` box, a wooden arrow (`bouncy`) at a 4.6 m wall, a deck of three steel crates (`metal`), a steel block (the `metal` part), a steel arrow (`metalbounce`) at a 6 m wall | a hop at each wall comes down on its arrow; **Jump held** onto the steel arrow (20 m/s against 16) |
| 9 | Explosives | 400–460 | a mask; a `tnt` between four wooden boxes; a `nitro`; a `nitrobang`; a `nitro` under a 2.6 m roof, a life on the roof | jump onto the TNT and leave (3 s: it takes its four neighbours); jump the nitro; **spin the green `!`**, which clears every nitro, the one under the roof included |
| 10 | Spin bridges | 460–512 | an 8 m `spinbridge` leaf; a 10 m one with `hold` 4 | spin beside each: the first lies down for good, the second for four seconds, and then it is let go; see [spin bridges](#spin-bridges) |
| 11 | Rope bridges | 512–580 | a 22 m suspended deck (`bridgeSpan` boards, hand ropes, bearer ropes); a 20 m one with two rotten boards (`crumble`) | run: the deck gives 0.5 m under a runner, 0.8 m under a body stood at its middle, 1.4 m when jumped on; a rotten board shakes for 1 s and falls |
| 12 | Trampolines | 580–632 | a rope `trampoline` set in the floor; one on four piles over a pit, against a 5 m wall | walk onto the first (it gives 0.4 m under you) and hop on it; jump onto the second with **Jump held at the landing**; see [trampolines](#trampolines) |
| 13 | Rope swings | 632–740 | a `ropeswing` over a trench; two in a row over a drop, half a round apart; one whose anchor ferries 8 m each way | see [rope swings](#rope-swings) |
| 14 | Moving decks | 740–832 | a wheel of two decks (`orbit`); a sliding springboard (`bounce`) under a 3 m shelf; a turntable (`spin`); a lift with a brazier (`lit`) | see [moving decks](#moving-decks) |
| 15 | Pendulums | 832–916 | four swinging ACROSS the line (one; two half a beat apart; one over deep sand), then one swinging ALONG it | pass each of the four as its bob leaves the line (high is off the line, low is on it); see [pendulums](#pendulums) for the fifth |
| 16 | Rolling stones | 916–976 | a `stone` rolling 9 m each way ALONG the line at 5 m/s (`axis` x); one rolling across it at 6 m/s | jump the first as it comes (the top of a tap over it); pass behind the second |
| 17 | Fire | 976–1030 | two `torch`es; a `firetiki` head breathing across the line; two more out of step, one turning; 4 m of lava | pass each head as its breath stops (a 5 s round: cool for 2.7 s, a warning for 0.8 s, fire for 1.15 s); a tap over the lava |
| 18 | Thorns | 1030–1070 | three `thorn` patches 7 m apart, the last two wide | a tap over each (a landing has 2 m of run before the next) |
| 19 | The bull | 1070–1116 | a mask; a `charger` on a 20 m floor of its own | wait off its floor until it has charged; spin it while it stands dizzy (it is harmless then) |
| 20 | The turret | 1116–1166 | a steel crate; two holes 1.6 m deep; a `sentry`; a wall at its back | see [the turret](#the-turret) |
| 21 | The bird | 1166–1200 | a `moa` | spin it |
| 22 | Ropes | 1200–1270 | a 13 m `rope` over a trench; a 21 m one over a drop (it snaps after 3 s of grinding) | jump, **Grind**; you come off its far end on the board |
| 23 | Speed pad | 1270–1374 | a `speedpad` (22 m/s, riders only), its green chevrons running east; a 2×2 wall of boxes; a 3 m ramp down | mounted (Jump held with a direction for 0.55 s), over the pad at 21.9 m/s, through the boxes at 20.9 |
| 24 | Ferrying rail | 1374–1424 | a 12 m `rail` travelling 4.6 m each way over a 19 m drop | pull back to a stop; jump with Grind as its west end comes to the brink; off its east end onto the floor |
| 25 | Trick gate and trick rail | 1424–1520 | a `trickgate` (kickflip); a `trickrail` (heelflip) | an ollie and **Spin with the stick at rest** in the air that goes through the gate; an ollie, **Spin with the stick right**, and Grind at the rail the flip makes real |
| 26 | The spine | 1520–1564 | a 1.2 m step; a `grindosaurus` walking 3 m each way | pull back to a stop and get onto the step; jump with Grind onto its back as it comes west; ride it off the east end |
| 27 | The ball | 1564–1595 | a side-on pipe with an `angryball` in it | drop in; spin as the ball comes; pop out east |
| 28 | Glass and the board trip | 1595–1645 | two glass panes and a hung sign (`breakable`); a `tumblezone` with `checkpointTrip` between two posts | ride through all three; the plane takes your board and puts you on your feet |
| 29 | Portals and prizes | 1645–1757 | a `returnportal` over a 32 m chasm; an arrow under a door in the air (`airOnly`) to a `cloudRoad` with the blue `colouredgem` and a portal back; a steel arrow up to the ledge the `bonusplatform` stands on; the `crystal`; the `gate` | see [the finale](#the-finale) |

### Spin bridges

A leaf stands upright at a brink and is spun down across the gap. It is a floor only once it lies flat.

- **A body on the ground is held at the hinge while the leaf falls.** The upright leaf's wall retires the
  moment it is spun, and the leaf is a floor only when it has landed, 0.7 s later. A runner or a rider who
  spun it from the bank without slowing used to be off the brink and under it by then. He is now held a
  body's width short of the hinge for the fall: nothing smacks or trips him, he keeps his speed, and he
  goes on as it lands. A body in the air is not held: a jump with the spin in it goes on over the hinge
  and comes down on the leaf.
- **A timed leaf is a sprung one.** In the last sixth of a second of its hold it is drawn down a little,
  and then it is let go: it whips up, nearly half of the way in the first fifth of its fold.
- **It throws what it meets**, standing on it or in the air over it, on foot or on the board: up, and back
  over the hinge, to come down 3 m behind it on the bank it was spun from. The further out he stood the
  higher he goes: 2.5 m from beside the hinge, 4.7 m from the middle of this 10 m leaf, 7 m from its far
  end, and down within a second. The carry that brought him back is spent in the landing: a walker stops
  within a stride of where he comes down, and a rider keeps his board and lands rolling back the way he
  came at 6 m/s. The leaf comes up behind the body it threw and does not stand upright, a wall again,
  until he is clear of it.
- **Late for it**, a body that reaches the hinge while the leaf is on its way up is stopped there: the
  hinge is shut again the moment it is let go.

### Trampolines

Every `trampoline` is a rope one unless its course gives it a housing of its own: a knotted net lashed
into a timber frame, exactly as big as its pad.

- It is **walked on like a floor**, and the net gives under a walker (0.4 m at the middle of a 5 m one).
  It goes down no further than whatever lies under it: a net laid on a solid floor does not sag.
- **A body that lands on it is thrown**: 16 m/s here, 3.9 m up. **With Jump held at the landing** it is
  thrown a quarter harder: 20 m/s, 6.1 m. In the air, a second press of Jump is the double jump; keep it
  held from there down onto the net.
- The whole of the pad throws, frame and all, as the plain pad did.
- A board that rolls onto one catches in the ropes and trips. Jumped onto, it is thrown like a walker.
- The second net here stands against a 5 m wall. The plain bounce comes up 1.1 m short and comes back
  down on the net; the held one clears the top with a metre to spare.

### Rope swings

A rope hangs 6 m from an anchor 8 m over the floors, 5 m out from the brink it is jumped from, and
swings 3.4 m each way on a round of 4.6 s.

- **A tap jump off the brink runs into it whenever it is on the near side of straight down when he gets
  there**, three quarters of a second after he sets off. To the eye: jump as it swings toward you. Of 32
  jumps begun at points all round its swing, the 19 begun as it swung toward him caught it, and 12 of the
  13 begun as it swung away missed (the other was begun as it turned at the near end). Begun in the first
  third of its way back from the far end, it can still be on the far side when he arrives.
- A wider swing is harder, not easier: at 0.85 rad the rope's end lifts out of reach at the near end of
  its swing, and the catch is two slices of a third of a second in each round.
- Let go (Jump), a body is thrown up and steers itself 6.8 m on. The pair are 9.3 m apart and half a round
  apart, so the first is at the far end of its swing when the second is at the near end of its own, 2.5 m
  off: let go there and the second is caught in the air.
- The fourth is a ferry. Its anchor travels 8 m each way on a round of 7.9 s and the rope under it barely
  swings. A tap off the brink meets a rope that is 1 to 3 m out; it turns at the near end 2.2 m out and is
  within reach for about a second as it does. It turns at the far end 4 m short of the floor: let go
  within 5.8 m of the floor.

### Moving decks

- **A walker slower than 6 m/s is held at the brink of a drop that would kill him** (he teeters). A deck he
  is to step onto therefore has to be under his first step: a deck that stops 10 cm short of the floor
  cannot be walked onto, only jumped onto or run onto. Here the wheel's decks lap the floor's edge by
  5 cm at each end of their turn, the turntable's ends lap both brinks when it lies along the line, and
  the lift fills its shaft from wall to wall (a 20 cm gap beside a deck is somewhere to fall into).
- **The wheel** (`orbit: [5, 3.2]`, `axis: 'z'`) turns one way only: a deck comes over the top going west,
  down past the west floor, under, and up past the east floor. It is stepped onto as it comes level with
  the west floor and ridden under, 3.2 m down, for 6.3 s.
- **The springboard** (`bounce: 16`) throws a body 3.75 m up, and a running body is 5.5 m on before it is
  down to the 3 m shelf. It slides 1.3 m each way and no further from the wall than its middle can throw
  him. It is 0.8 m high: it is landed on from a jump (a running tap pressed 5.6 m short of where it will
  be).
- **The turntable** (`spin: 20`) lies along the line every 9 s and is under both brinks for a second
  either side of that. Across the line it is a 3.6 m island, a tap from either floor.
- **The lift** (`lit`) carries a brazier, which is a light and nothing else.

### Pendulums

- A pendulum at `yaw` 90 swings across the line. From the side its swing cannot be seen, only its height:
  high is off the line, low is on it. Its gallows stands 7.2 m before and behind the line, off any floor
  6 m deep, so each post here has a plinth.
- A pendulum at `yaw` 0 swings along the line, and the side view shows all of it. The fifth is one: 6 m
  long, 1.1 rad each way, on a round of 6.3 s. Its bob is at head height or lower for a second in every
  three, anywhere within 4.7 m of its post, and up out of the way for two: the 9.4 m under it are run
  while it is up, starting half a second before it has risen clear. It hangs 0.9 m behind the line, so
  that its posts stand behind him and not through him.

### The turret

An orb flies 0.7 m over the floor at 10.5 m/s, one every 2.7 s, and the turret sees 32 m. It fires only
at what it can see: shown nothing, it waits.

- On one line, anything that stands between you and it hides you all the way back. Cover along the way is
  therefore a **hole in the floor**: 1.6 m down, against the wall nearest the turret, you are out of its
  sight and the orb in flight passes over your head. (At 1.2 m its muzzle, a metre up, still sees a body
  in the hole.)
- The holes are 7 m apart: out of one as an orb passes over it, and you are in the next before another
  arrives. The last is 3 m short of the turret. Out in the open an orb is jumped: a tap pressed a third of
  a second before it arrives.
- It sees behind itself as well. A 1.5 m wall at its back keeps the next station's checkpoint out of its
  sight; without it, a player warped there is shot in the back.

### The finale

- A door on the ground is sunk 0.3 m into it: what a portal tests is the point at a walker's feet, and
  that is on the floor.
- A jump over the arrow passes under the door in the air (3.2 m up; a tap's feet rise 2.3). A bounce on
  the arrow goes into it, and comes out on the cloud 14 m up, where the gem is and the portal back.
- The steel arrow stands 3.4 m short of the bonus ledge, so that a jump over it is down again before the
  ledge's underside. The stone on the ledge is 1.05 m high and is entered by a jump onto it.

## What the course found out

Rules that were not written down before this course was built, each measured here.

- **Low roofs.** An underside 1.7 to 2.0 m up makes the ground under it read as there and not there; at
  2.3 m a jump under it ends inside the slab. 2.6 m is clean, and a jump under it rises 1.16 m: a nitro
  (1.15 m) under one cannot be jumped.
- **Boxes over a jump.** A jump that passes within a stride of a floating box is drawn up into it and cut
  short. A row meant to be reached from a bounce hangs 3 m clear of where the next jump begins.
- **An arrow stands against its wall.** A jump at the wall comes down on it and the bounce goes up the
  face.
- **Boulders are domes.** A `rock`'s top is a little under its height and its sides fall away: stood in a
  row they leave crevices, so these overlap by a quarter of a metre. A `log` and an `idol` are obstacles
  only: neither has a top to stand on.
- **A checkpoint on a board line.** A board cruises at 12 m/s, and under 12.5 it trips over a checkpoint
  and does not bank it. A rider banks one by spinning it as he passes, by stomping it, or by arriving
  above 12.5 m/s (the pad, a descent, or the accelerator held).
- **In a board's air the stick left or right spins him.** A flip is thrown with the stick at rest or
  pressed for the flip alone; a direction held on into the landing is a landing half turned.
- **A stone needs flat ground under all of its run**: the slab the crossing stone rolls on is 24 m deep.

## What is not here

Four component types are in neither lab: `pipe` and `outline` are old save formats that load as other
parts; `worldmap` is the campaign's map table; `comboorb` starts a run that has to reach the gate in one
combo, which a bench of twenty-nine stops cannot honour. Loops are a mesh field, not a type: one needs a
second lane beside the first and 30 m/s, and this course is one line. West, north and south travel zones
are camera directions, not objects, and every side-scrolling stretch in this game reads left to right.

## Changing it

Stations are built in order in the level source, each from where the last ended, so a station can be
lengthened without moving anything by hand. Each exports its span, its checkpoints and its named places
(`STATIONS`), which the test and the scripted player read. After a change:

```bash
npm run check:levels
```

```bash
npm run check:side-platform
```
