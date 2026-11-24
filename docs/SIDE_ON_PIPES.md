# Side-on pipes

A halfpipe that a side-scrolling stretch looks **across**: the camera sees its section, the open end
faces the lens, and the pipe is part of the path — in over one lip, out over the other. Walking over a
coping drops you in on the board; **Jump in the hang with the stick held out over the lip** pops you out
again, back on foot. The test course is **Side Pipe Lab** (`side-pipe-lab`,
`src/levels/side-pipe-lab.ts`).

Everything here is opt-in. A `vertramp` or `zone` without `sideOn` behaves exactly as before.

## Data

```ts
// a pipe: one straight, axis-aligned, 90° half
{ t: 'vertramp', vkind: 'half', sideOn: true, p: [crossCentre, floorY, z], len: 6, yaw: 0,
  w: 2.5,                 // flat half-width
  rise: 7,                // nominal radius (the taller wall)
  wallRise: [2.5, 7],     // radius of the west / east wall; 0 = no wall, the flat rolls out that side
  wallDeck: [4, 0] }      // deck depth behind the west / east coping; 0 = a bare lip

// the stretch it stands in
{ t: 'zone', dir: 'E', sideOn: true, p: [...], s: [...] }
```

- `sideOn` on a **vertramp** requires `vkind: 'half'`, no `pts`, `arc` 90, no `lipRise`/`outerBank`, and a
  yaw that is a multiple of 90. It always takes the analytic `Halfpipe` backing (`src/halfpipe.ts`).
  `wallRise` and `wallDeck` are only accepted with it. Sides are `[-cross, +cross]`: west / east at yaw 0.
  Coping rails are off unless `rails: true` (the coping runs into the picture; a rail there is a curb
  across the edge a walker drops in over).
- `sideOn` on an east/west **zone** declares the stretch one line. On the board the heading stays on the
  travel axis and the stick held against travel is the pull-back brake (which rolls to a stop and steps
  off). Without it a reversal is a carve, and on a zero-depth plane a carve has nowhere to go: the board
  rubs the plane wall and keeps rolling. A rail caught there also ignores the direction that was held at
  the catch until it is released: left/right is the balance on every rail, and on a side-on line it is
  also the way you were travelling.
- A pipe stands on nothing of its own. Put a floor block under its whole footprint with its top a few
  centimetres under `floorY`; the filled section the camera sees is seated on that.
- Decks are part of the pipe and have **no side collider**. Butt level floors against the deck's outer
  edge, never against the lip: a solid face at the lip plane pins a rider climbing the last metre of the
  wall and offers him a ledge to grab mid-climb.
- Two pipes whose lips meet at one line and one height are a **spine**. The far pipe can have any radius
  as long as its floor is set so the ridge heights match.
- The picture is a level's own choice. Side Pipe Lab takes it through a **long lens**: one `camnode`
  view with `cameraKeepDistance: true` and `cameraTelephoto: true`, 52 m from the play plane through an
  18° `cameraFov`. That is the frame an 18 m view has through 49° (16.4 m tall, 29 m wide at 16:9), but
  the 6 m of depth behind the line changes scale by 12 % instead of 40 % and a 6° eye shows deck tops as
  an edge, so the course reads flat. See [LEVEL_FILE_FORMAT.md](LEVEL_FILE_FORMAT.md).

## What the player gets

| Moment | Rule |
|---|---|
| Crossing a decked coping from the deck, walking, running or rolling | **Automatic drop-in.** The board is put on the wall up to 0.4 m of arc under the lip, heading in, at `max(0.85 × approach speed, 4 m/s)`. It is *drawn* as one curve: for 0.26 s the picture leaves the deck the way the body was travelling, bends over the coping through the mount animation's hop and joins the rider on the transition, continuous in position and velocity at both ends, while the rig lays over onto the wall. The simulation is not delayed by any of it. |
| On the pipe's surface on foot and moving (jumped in, got up from a spill) | The board mounts as soon as the feet move faster than 1 m/s. |
| Riding | The heading is locked to the cross axis. The stick never turns or brakes the board; any held direction still **carves** the walls for speed, and X held on a wall **pumps**. Circle is still the brake. The swing reverses wherever it dies, low on the transition included. |
| Reaching a lip | The ordinary coping launch: a vertical hang. |
| Hang: **Jump, with the stick held out** over that lip | **The pop-out**, on the spine transfer's own input (the first Jump press-and-release of the hang). Another pipe's mouth beyond the ridge takes the ordinary mirrored **spine transfer**. Otherwise the air leaves the wall as a plain board air drifting out at `vertDrift` (4.5 m/s), if there is something to land on within 0.75 m under the lip's height 1.2 m past it (the pipe's deck, a floor, a ghost slab a `!` has made solid). A ledge higher than the lip is taken once the air has cleared it, while the stick stays held. A bare wall with a drop behind it is never an exit. |
| Landing that pop-out | **On foot.** The air that leaves a pipe ends the board section its drop-in began. X held with a direction is the ordinary push-off and keeps the board. A spine transfer and a rail keep it too. |
| Hang, anything else | Drops back into the pipe. The stick alone does nothing, however long it is held. |
| A second Jump in the same hang | The game's Board Abandon, as in every pipe: the board is thrown and the rider comes down on foot. |
| A direction already held when the air began | Does not spin the rider until it has been released once (it is the travel stick). A fresh direction spins, as in every other air. |
| A solid met in the hang (a `!` floated over the lip) | Stops the climb; the hang stays on its line instead of being pushed out behind the wall. |
| A rail caught on a side-on line with a direction held | That direction does not tip the balance until it has been released once; a fresh left/right balances as on any rail. A rail under about a second long can be ridden on the held stick; a longer one cannot: the needle runs away untouched in about 1.2 s. Let go, then lean. |
| The air off the end of a rail on a side-on line | The stick **along the line, toward travel**, never spins the board: after a grind balanced with left and right the natural next press is on toward travel, and it carries the rider on. The stick against travel is a fresh direction and spins, as in every other air. |
| A lip stall (the grind button held up the wall) with a direction held | The same: that direction does not tip the stall until it has been released once, so the stall settles back **into** the pipe. Left live, the travel stick points out the back of the far wall and throws the rider off behind it in 0.4 s. A fresh direction tips the stall as on any coping. |

Nothing in `src/tuning.ts` changed.

## Measured (real `Player`/`Level`, `tools/side-pipe-probe.mjs` and `tools/test-side-pipe-lab.mjs`)

Walk-in at 9 m/s, right held unless noted.

| Pipe | Result |
|---|---|
| 3.5 / 3.5 m walls, 2.5 m flat half, decks | Drop-in 7.65 m/s. First east launch 18 m/s up; popped out early in the hang it lands about 5 m past the lip, on foot. Exit decks plus the floor behind them want ≥ 7 m of flat. |
| 2.5 m west, 7 m east (a spine) | First swing climbs **4.45 m** of the 7 m wall. The swing back hangs about 7 m over the low west lip, and the second swing clears the east lip by about 3 m of hang: time enough for the Jump. Holding X on the walls clears it on the **first** swing; so does arriving on the board with X held down a 14 m approach (the same work, done early). |
| Second pipe behind that spine, 5 m west wall, 3.5 m decked east wall | The transfer lands on its west wall at 15 m/s and launches off the east lip at 23 m/s. Popped out there it lands 5.6 m past the lip. |
| Landing ramp, 5 m west wall, open east | Rolls out at 23–30 m/s, still on the board: well over the 12.5 m/s crate-smash and wall wipe-out speed. Only for a stretch that is skated. |
| `!` floated on the hang line | Headed from below by the hang. 6 m over a 3.5 m lip is beyond a double jump off the deck (5.5 m head reach) and inside the first west hang of a held-right swing. |
| Rail starting over a bare lip | Caught with the grind button within the usual 2.1 m snap. The grind starts at only 3.5 m/s (a vertical hang has no speed along the rail), which is where the balance needle runs away fastest, so run it **downhill, steepest first**. A straight 19 m rail dropping 4.4 m took 1.65 s and shed a rider who gave no balance input after 1.18 s; dropping 2.6 m in its first 3 m and 1.8 m over the next 9 m, the grind lasts 0.93 s, leaves at 20 m/s and needs none. |
| Grind button held from the drop-in, right held | A 0.8 s lip stall on each coping in turn, never a bail and never an exit. A rail over a lip wants the button pressed in the hang, not held up the wall. |
| No input at all, or a direction alone, decked pipe | The rider never stops and never leaves: every coping launch adds the pipe's pop, so the swing settles at 5–6 m hangs. Leaving is Jump with the stick held out over a lip. |
| A board thrown away in a hang | Two metres long, on a play plane 1.06 m wide. It falls, meets the transition and comes to rest on the flat in about 2 s (see below). |
| **Deep pipe**: 8.5 m west wall, 3.5 m decked east wall, 3 m flat half | The drop-in is seated like any other. 30 m/s on the flat, 27 m/s at the east lip, and the air it launches has **10.5 m** in it over that lip (5.5 m more than the brink it left) and hangs 1.7 s. Popped out three frames into the hang it still rises 9 m, drifts out at 4.5 m/s and lands 6.6 m past the lip, on foot. |
| A box on that hang line | One hung 10.2 m over the lip is headed by the first unpopped hang (feet 9.5 m up). On the hang line itself (0.08 m inside the lip) the popped air takes it too: a mounted rider's crate box is 3.7 m tall and 0.85 m to each side. Hung **1.2 m inside the lip** it is clear of the popped air and still under the hang. |
| **Valley**: 7 m west wall, 28 m flat, 4.5 m decked east wall | 27.5 m/s along the flat: a two-high stack on the line is smashed (12.5 m/s does it), a crab 14 m further on is spun from the board, and the pop-out lands 5.8 m past the east lip. |
| **Cascade**: 3.5 → 5.5 m, then two pipes each 7 m deep behind a shared ridge (5 m and 3.5 m far walls) | A held direction clears the first ridge on the first swing. The second ridge is crossed 7.5 m above it, 1.7 s after the first; the flats run 21, 28 and 32 m/s. The last pop-out lands 7.4 m past its lip. |
| **Rail into a pipe**: the short rail ending 1.3 m over the flat of a pipe whose west wall is 1 m high | The rider leaves the rail at 20 m/s, is in the air 0.27 s and touches down 5.3 m on, still rolling at 20 m/s; an 8 m flat leaves room. Its 3.5 m decked east wall is the exit: the pop-out lands 4 m past it, on foot. |
| **Long rail**: 52 m falling 16.2 m (2.6 m in its first 3 m, then 11°, 22°, 16° and 8°) | Balanced with left and right it takes 2.42 s and leaves at 30.5 m/s. On the held travel stick alone the needle is past the edge and the grind is lost 1.23 s in, over the drop. |

## On foot between the pipes (measured on the same course)

The floors between pipes carry the game's ordinary platforming, on one line. These are the numbers the
expanded course was laid out with.

| Thing | Measured | Layout it asks for |
|---|---|---|
| Run | 9 m/s, reached in 0.75 s (12 m/s²); a full stop from a run takes 1.9 m | a place to wait is ≥ 4 m of fixed floor short of the brink |
| Jump | It leaves the ground when Jump is **let go**. A tap carries 5.25 m; held 14 frames it carries 5.3 m (5.85 m to a landing 1.5 m lower) and takes off 2.1 m after the press | falling stairs: 5 m slabs behind 3 m gaps, 1.5 m apart in height, so each jump lands on a slab's first half |
| `crumble` | sags 0.13 m under the feet through its 0.85 s warning; a runner is across a 5 m slab in 0.56 s | debut over a trench shallow enough to jump out of (1.5 m), then over the drop |
| `trampoline`, `speed` 16 | only an airborne landing launches: 3.7 m. With Jump held through the landing **and the rise** (`amp` 1.4): 7.6 m | a 3 m wall behind it is cleared by any jump onto it, even against the wall itself |
| A ledge near that bounce | a plain bounce grabs any lip within 2.4 m above its apex | hang a bonus perch ≥ 2.5 m over the plain apex and under the held one (here 6.8 m over the net) |
| Wall kicks beside a trampoline | Jump held as you land is also a Jump pressed at the wall: the timed kick takes it | set the level's `wallPlants: false` where a trampoline stands against a wall |
| `mover` on `y` (a lift) | a walker under a descending deck is collected onto it, unhurt | the first lift can rest flush in a 0.5 m recess over solid ground; over a drop let the deck dip 0.4 m under the bank, so boarding is a step down for over a second |
| `mover` on `x` (a ferry), 5.9 m each way at 0.8 rad/s | within 0.45 m of a bank for 0.86 s in every 7.85 s | rest gap 0.1 m; a 0.25–0.5 m gap is walked over at a run |
| `phasepad`, 4 s cycle, lit share 0.6 | lit 2.4 s, strobing through the last 0.9; two pads half a cycle apart overlap for 0.4 s | "when the pad under you starts to strobe, the one ahead has just lit" |
| `crusher` | hangs 4.4 m up; passable while hanging and for the last half of its rise, about 1.6 s in each 3.2 | ≥ 6 m of fixed floor before the first; 5–6 m between two half a cycle apart |
| Watcher (`floater`) | hovers 1.65 m up: a walker passes under it between swoops and a grounded spin does not reach it; a jump-spin does | keep it ≥ 10 m from a brink: the jump that takes it carries 5 m |
| Mossback (`turtle`) | a spin leaves its shell standing in the lane; a stomp bounces 5.2 m | a row 5.7 m up is shell-only (a double jump heads 5.5 m); give it a beat (≥ 13 m) before the next tool |
| Whirler (`spinner`) | blades out 2.2 s, in 1.35 s | a plain floor ≥ 6 m short of it to wait on |
| A stack of boxes in the lane | its cap drops into the lane when the base is spun; a second spin takes it, a hop onto it is a 2.9 m bounce | keep stacks ≥ 9 m back from a brink or a timed footing |

## Authoring rules the test course paid for

- **Keep a pipe that must be read at a glance about 12 m lip to lip.** The view shows 13.4 m ahead of a
  centred rider at 16:9, so the far wall is in frame from the near lip. A pipe that is a run (the 39 m
  valley) can be longer: what matters there is on its flat.
- **A pop-out lands on foot, so the floor past a pipe is ordinary platforming.** Checkpoints, boxes and
  small platforms can follow it directly. The exceptions are the exits that keep the board: a rail's
  landing and an open-sided ramp's run-out. There a rider arrives at 20 m/s or more, a floor crate or
  a **checkpoint** under 12.5 m/s is a tumble, a wall is a wipe-out, and his crate-contact box is about
  3.7 m tall, so "overhead" rows start 3.4 m up (a full on-foot jump heads 3.8 m). End such a stretch
  with the gate or another pipe, not a step.
- **How far a pop-out carries depends on how high the hang was when Jump was pressed**: 2 m out of a low
  hang, 5–7 m from the walls on this course. Give a decked exit ≥ 12 m of plain floor before anything
  that hurts.
- **Steps on an on-foot floor are jumped: keep them ≤ 1.6 m.** A tap jump rises 2.1 m and a held one
  2.7 m; a charged ollie 1.8 m. Walking or rolling into a wall lower than the skater's own reach
  (2.55 m, feet to raised fingertips; he stands 2.8 m) is a bump, never a ledge grab — the hanging body
  would be standing on the floor it never left — so a step is not a way to stop a board.
- **Give a spine a pipe to transfer into, with a lower, decked far wall.** The transfer keeps the board
  and the speed; the second pipe turns that speed into a hang over its far lip, and the pop-out from
  there is the landing. Chained, with each floor well under the ridge before it, the spine is a
  staircase down: every transfer arrives with more than the wall ahead needs.
- **A rail debuts short and steep, then long.** The first is over inside a second and needs nothing; the
  second is a balance exam, and it comes with a checkpoint in front of its pipe.
- **End a rail in a pipe or on the finish floor.** In a pipe: a west wall a metre high with nothing
  behind it, the flat 1.3 m under the rail's end and the rail's end half a metre onto that flat.
- **On a single plane the default stopwatch stands in the only lane**, two strides from the spawn, and a
  time trial strips the checkpoints. Author a `clock` behind the spawn.
- **Float a `!` on the hang line** (0.08 m inside the lip) and out of on-foot reach, over the lip the
  held-right rider only visits on the swing back. A reward meant for an air that is *ridden* hangs
  1.2 m inside the lip instead.
- **Every climb is on foot and every stage of it is a different tool.** Debut each tool alone over safe
  ground or beside a fixed floor to watch it from, then give it a partner: the lift over a drop, the
  ferry with an enemy at its landing, the crusher pair with a crab behind it.
- **A checkpoint stands before each lethal stretch**, not only before each pipe: the falling stairs and
  the crusher gallery have their own.

## Checks

```bash
npm run check:side-pipe
```

`tools/test-side-pipe-lab.mjs` plays the course with the real player — right held, Jump in each east
hang, a wait for each lift, ferry, timed pad, crusher and Whirler (`tools/side-pipe-lab-bot.mjs` reads
each hazard's own clock) — and asserts each claim: the long lens, the drop-ins and the curve they are
drawn on, the pop-outs landing on foot, the stick alone never leaving a pipe, the short first swing and
the transfer, the pumped shortcut, the plunge's air and its box, the falling stairs, both trampoline
bounces, the Mossback's shell, the lifts, ferry, pads and crushers (and that a run which waits for
nothing dies there), every enemy kind, the valley's stack and crab, the switch being the only way out,
the two cascade transfers, the short rail on the travel stick, the long rail lost on it and ridden on the
balance, the grind button held too early, a step that is bumped and not grabbed, a thrown board coming
to rest, the one-line brake and the checkpoint a death returns to.
`npm run check:pipe` covers the unchanged symmetric pipe.

```bash
RL=2.5 RR=7 F=1.5 DR=0 SPINE=2,2,5,3.5,6 MODES=right,right+pop,right+pop+pump node tools/side-pipe-probe.mjs
```

prints the swing-by-swing record for a pipe of any shape (`RL`/`RR` wall radii, `F` flat half-width,
`DL`/`DR` decks, `SPINE=floorY,flatHalf,radius[,eastRadius,eastDeck]` for a pipe beyond the east ridge,
plus `RAIL`, `ENEMY`, `BANG`). `pop` presses Jump once in each east hang.

## What the expansion added to the runtime

Both are opt-in and change nothing for a level that does not ask.

- **`cameraTelephoto`** on a `cameraView` camnode (`src/cameraViews.ts`): a kept follow distance may
  pass the close rig's 18 m, up to 100 m. Only this level sets it.
- **The air off a rail on a side-on line** (`spinStick` in `src/player.ts`): the stick along the line
  toward travel is the travel stick, never a spin. Without it a grind that had been balanced — the
  stick let go — ended with the first press of "right" turning the board sideways for the landing. It
  applies only inside a `sideOn` zone.

## Two shared rules this course changed

Both live outside the side-on code and apply everywhere.

- **Ledge grabs from the ground** (`tryLedgeGrab` in `src/player.ts`). A grounded catch now needs the lip
  above the skater's standing reach, 2.55 m at the baseline stature. The default `ledgeReach` is 2.4 m,
  so with default tuning nothing is grabbed by walking or rolling into it; a level's `ledgeAssist` can
  raise the reach past 2.55 m and bring grounded catches back for lips that tall. Catches in the air
  are unchanged: a jump that comes up short still takes the lip.
- **Discarded boards** (`src/skateboard/discarded.ts`). A deck that no longer fits between two solids —
  here, two metres of board turning across the 1.06 m between the play plane's walls — was met at
  fraction zero by each face in turn, so the resolver handed back the place it started from every step:
  it hung in the air, shivering, while its fall speed grew without limit. It now stops colliding with
  the one face it cannot fit beside and resolves against everything else. Its fall speed is capped at
  60 m/s, and it lands on a halfpipe's transition instead of dropping through it (the pipe's ribbon is
  double-sided with no promised winding; its riding side is now always read as facing up).
