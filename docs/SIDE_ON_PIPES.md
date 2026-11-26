# Side-on pipes

A halfpipe that a side-scrolling stretch looks **across**: the camera sees its section, the open end
faces the lens, and the pipe is part of the path — in over one lip, out over the other. Walking up to a
coping puts you on the board at the lip, waiting; **Jump, or the stick pressed on again,** drops you in;
**Jump in the hang with the stick held out over the lip** pops you out again, on the board, onto the deck
past it. The test course is **Side Pipe Lab** (`side-pipe-lab`,
`src/levels/side-pipe-lab.ts`), and **Side Pipe Lab (Forward)** (`side-pipe-lab-forward`) is the same
course met head-on, the camera behind the rider ([below](#the-same-course-head-on)).

A stretch is side-on because its **zone** says so. A vert in it is seen across its section because of
where it stands and what shape it is, not because of how it was authored: any straight `vertramp`
standing in a side-on zone with its section along the line (yaw 0 or 180, `arc` 90, no `outerBank`) rides
the analytic profile and gets everything below, a quarter as much as a half, with or without a straight
face above its curve (`lipRise`) or a deck behind its lip. Outside a side-on zone `sideOn: true` on the
vert says the same thing: the course crosses it, whichever way the camera looks. The flag is also what
lets a half carry a per-wall shape (`wallRise`, `wallDeck`).

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

- `sideOn` on a **vertramp** requires no `pts`, `arc` 90 and no `outerBank`. A plain half (no `lipRise`)
  takes it at any yaw that is a multiple of 90; a quarter, or any vert with a `lipRise`, at yaw 0 or 180
  (its section east-west, as in a side-on zone). It always takes the analytic `Halfpipe` backing
  (`src/halfpipe.ts`). `wallRise` and `wallDeck` are only accepted with it, on a half. Sides are `[-cross, +cross]`: west / east at yaw 0.
  Coping rails are off unless `rails: true` (the coping runs into the picture; a rail there is a curb
  across the edge a walker drops in over).
- Any other straight vert in the zone takes the same backing by itself. A **quarter** is the half with one
  side left open: its flat (`w`) runs from `p` to the foot of its one wall, which yaw 0 stands to the east
  and yaw 180 to the west; `deck` is the deck behind that wall's coping. `lipRise` is a straight vertical
  face above the curve: the profile is one line from the flat, round the curve and up the face to the lip,
  and a board rides all of it (straight up or straight down the face). The face is solid to a body in the
  air, however fast: one that was in front of the wall under its lip and is behind it a step later is met
  where it crossed. A hang that leaves the face itself (a hang begins as far as 1.2 m under a lip, so with
  more straight wall than that it begins on the face) rises and falls on the face's own plane, which is
  the lip's line, where the deck behind it begins. That deck is not under a hang, however near: coming
  down, he is met by the face the step he is level with it again, at his own height, his fall turned
  down it. He is never stood on the deck's edge, lifted onto it from just under it, or stopped under it
  on the way up.
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
| Reaching a decked coping along its deck **on foot**, walking or running | **He gets on his board at the lip, and waits.** A run is slowed over the last 2 m of the deck, by where he is on it (20 m/s²), so the coping is arrived at and not run off: he is at a walk (under 2.2 m/s) when he reaches it, whatever he was holding. There the board is under him with its tail set on the coping, and he is in the wait of the next row for as long as he likes; the picture is handed from his run to that stance over 0.26 s. **Jump, or the stick pressed on afresh**, drops him in as below: the 0.16 s lean, then the drawn curve onto the wall under the lip, at 4 m/s. The direction he ran up holding is the run that brought him there, and asks for nothing until it has been let go. **The stick pressed back** steps him off the board, onto his feet on the deck where he stood. A jump thrown before the lip is a jump: he goes out over the pipe on foot. |
| Rolling up to it **already on the board**, slowly (under 8 m/s as the set-up begins) | **He sets his tail on the coping and waits.** Over the last of the deck (0.45 to 2.2 m, as long as a 15 m/s² stop takes) he is slowed by where he is on it, his knees bend and the deck rocks back on its trailing wheels; at the lip those wheels go over the edge, the tail comes down on the deck behind it and he is at rest, nose up over the drop, over his back foot. He stands there the way a skater waits at the top of a ramp: back foot on the tail, front foot a little past the middle of the deck and not out on the nose (his ankles 0.77 m apart, as they are when he rides), nearly upright on soft knees (his hips 9 cm lower than he rides), his arms let down, his head turned 65° to look down the drop. There is no clock, no needle and no points. **Jump, or the stick pressed on into the pipe**, drops him in: a 0.16 s lean (his weight forward, the nose down) and then the ordinary drawn curve onto the wall under the lip, from rest, at 4 m/s. **The stick pressed back** rolls him off the lip onto the deck tail first at 2.6 m/s (the stance changes, so the body does not turn). The direction he arrived holding is the roll that brought him there: it asks for nothing until it has been let go. |
| ...at a roll (8 to 17 m/s; the board's own cruise is 12) | **He drops straight in.** Over the last 1.2 to 2.8 m (about 0.2 s) he is slowed, eased on and eased off, to 55 % of his speed, crouching, with the nose lifted a little and put down again, and goes over the coping at that speed onto the wall (4.5 to 9.5 m/s into it). Nothing pauses it, and once that set-up has begun nothing he presses stops it short of leaving the deck (an ollie popped in it is an ollie: the set-up and its stance end as his wheels leave). |
| ...flat out (17 m/s and up) | **He does not drop in.** He rolls off the edge into a plain board air, level, with all of his speed, and clears the curve: 17 m/s is 4.5 m of travel before he has fallen a 2.5 m wall. The stick that was rolling him there spins nothing until it has been let go. A staircase of verts is therefore one drop-in and then airs: a 5 m wall hands him 23 m/s at its foot. |
| On the pipe's surface on foot (jumped in, got up from a spill) | **On his feet**, like anywhere else: a pipe's surface does not put a board under a walker. Running at its wall is the vert run-up (`docs/VERT_RUN_UP.md`): climbed out of, caught, or come up short on, by the lip's height; a ridge shared with another pipe has no ledge and is always come up short on. X held with a direction is the ordinary push-off. |
| On foot in the air at a lip (jumped to it, fell past it) | An ordinary **ledge catch**, hung from lying along the curve under it (`docs/VERT_RUN_UP.md`). |
| Riding | The heading is locked to the cross axis. The stick never turns or brakes the board; any held direction still **carves** the walls for speed, and X held on a wall **pumps**. Circle is still the brake. The swing reverses wherever it dies, low on the transition included. |
| Reaching a lip | The ordinary coping launch: a vertical hang. |
| Hang: **Jump, with the stick held out** over that lip | **The pop-out**, on the spine transfer's own input (the first Jump press-and-release of the hang). Another pipe's mouth beyond the ridge takes the ordinary mirrored **spine transfer**. Otherwise the air leaves the wall as a plain board air drifting out at `vertDrift` (4.5 m/s), if there is something to land on within 0.75 m under the lip's height 1.2 m past it (the pipe's deck, a floor, a ghost slab a `!` has made solid). A ledge higher than the lip is taken once the air has cleared it, while the stick stays held. A bare wall with a drop behind it is never an exit. |
| Landing that pop-out | **On the board, like any other air**, rolling out at about 4.5 m/s, whatever the stick is doing. Leaving a pipe does not take the board away: he gets off it there the way he gets off it anywhere, by braking (the brake button, or the stick pulled back against the roll) or by letting it roll to a stop. A spine transfer and a rail keep it the same way. |
| Hang, anything else | Drops back into the pipe: onto the curve where it left it, or, off a straight face, onto that face just under the lip. The stick alone does nothing, however long it is held. |
| A second Jump in the same hang, or one in the air of a pop-out or a spine transfer | The game's Board Abandon, as in every pipe: the board is thrown and the rider comes down on foot. The Jump that made the transfer does not count against it. |
| A direction already held when the air began | Does not spin the rider until it has been released once (it is the travel stick). A fresh direction spins, as in every other air. |
| A solid met in the hang (a `!` floated over the lip) | Stops the climb; the hang stays on its line instead of being pushed out behind the wall. |
| A rail caught on a side-on line with a direction held | That direction does not tip the balance until it has been released once; a fresh left/right balances as on any rail. A rail under about a second long can be ridden on the held stick; a longer one cannot: the needle runs away untouched in about 1.2 s. Let go, then lean. |
| The air off the end of a rail on a side-on line | The stick **along the line, toward travel**, never spins the board: after a grind balanced with left and right the natural next press is on toward travel, and it carries the rider on. The stick against travel is a fresh direction and spins, as in every other air. |
| A lip stall (the grind button held up the wall) with a direction held | The same: that direction does not tip the stall until it has been released once, so the stall settles back **into** the pipe. Left live, the travel stick points out the back of the far wall and throws the rider off behind it in 0.4 s. A fresh direction tips the stall as on any coping. |

Nothing in `src/tuning.ts` changed.

How a hang and a transfer are *drawn* — the trail behind the deck on the way up, the tuck and float at
the top, the reach and the brace coming down, and a transfer that winds up, is driven over, runs past
the far wall and is caught — is in `docs/CHARACTER_ELASTICITY.md` (Vert air and spine transfer). None of
it moves the rider, his clock or his contacts: the rows above are the whole of what the pipe does.

The pop-out is drawn up off the wall on a curve. In the hang the whole of him lies along the wall; the
air out over the lip is a level one that lands on its wheels. Over the first 0.3 s of it he comes
upright, eased in and eased out (in a shorter air, over four fifths of the time until his wheels are due
down, and never in under 0.18 s), and goes on doing so across a touchdown that comes sooner. The first
frame of that air turns him a degree or two; left to the ease that lays him onto a wall it turned him
18° to 36°, his board half a metre to a metre from where it had been against his hips.

## Measured (real `Player`/`Level`, `tools/side-pipe-probe.mjs` and `tools/test-side-pipe-lab.mjs`)

Walked to each lip, waited on there and dropped in with Jump (4 m/s onto the wall); right held unless noted.

| Pipe | Result |
|---|---|
| 3.5 / 3.5 m walls, 2.5 m flat half, decks | Dropped in from the wait at 4 m/s, he crosses the flat at 20 m/s. First east launch 16.5 m/s up, a hang 3.5 m over the lip; popped out early in it he lands 3.9 m past the lip, on the board at 4.5 m/s. Exit decks plus the floor behind them want ≥ 7 m of flat. |
| 2.5 m west, 7 m east (a spine) | First swing climbs **3.77 m** of the 7 m wall. The swing back hangs 5 m over the low west lip, and the second swing clears the east lip by 1.8 m, 0.85 s in the air: time enough for the Jump. Holding X on the walls clears it on the **first** swing; so does arriving on the board with X held down a 14 m approach (the same work, done early). |
| Second pipe behind that spine, 5 m west wall, 3.5 m decked east wall | The transfer lands on its west wall at 12.5 m/s and launches off the east lip at 21.7 m/s. Popped out there it lands 5.3 m past the lip. |
| Landing ramp, 5 m west wall, open east | Rolls out at 23–30 m/s, still on the board: well over the 12.5 m/s crate-smash and wall wipe-out speed. Only for a stretch that is skated. |
| `!` floated on the hang line | Headed from below by the hang. 6 m over a 3.5 m lip is beyond a double jump off the deck (5.5 m head reach) and inside the first west hang of a held-right swing. |
| Rail starting over a bare lip | Caught with the grind button within the usual 2.1 m snap. The grind starts at only 3.5 m/s (a vertical hang has no speed along the rail), which is where the balance needle runs away fastest, so run it **downhill, steepest first**. A straight 19 m rail dropping 4.4 m took 1.65 s and shed a rider who gave no balance input after 1.18 s; dropping 2.6 m in its first 3 m and 1.8 m over the next 9 m, the grind lasts 0.93 s, leaves at 20 m/s and needs none. |
| Grind button held from the drop-in, right held | A 0.8 s lip stall on each coping in turn, never a bail and never an exit. A rail over a lip wants the button pressed in the hang, not held up the wall. |
| No input at all, or a direction alone, decked pipe | The rider never stops and never leaves. With nothing held every coping launch adds the pipe's pop, and the swing settles at 5 m hangs (19 m/s at the lip, from the seventh on). A direction held carves the walls as well: the hangs pass 10 m on the fifth and stay between 9 and 13 m. Leaving is Jump with the stick held out over a lip. |
| A board thrown away in a hang | Two metres long, on a play plane 1.06 m wide. It falls, meets the transition and comes to rest on the flat in about 2 s (see below). |
| **Deep pipe**: 8.5 m west wall, 3.5 m decked east wall, 3 m flat half | The drop-in is seated like any other. 29 m/s on the flat, 26 m/s at the east lip, and the air it launches has **10.1 m** in it over that lip (5.1 m more than the brink it left) and hangs 1.7 s. Popped out three frames into the hang it still rises 9.8 m, drifts out at 4.5 m/s and lands 6.5 m past the lip, on the board. |
| A box on that hang line | One hung 10.2 m over the lip is headed by the first unpopped hang (feet 9.6 m up). On the hang line itself (0.08 m inside the lip) the popped air takes it too: a mounted rider's crate box is 3.7 m tall and 0.85 m to each side. Hung **1.2 m inside the lip** it is clear of the popped air and still under the hang. |
| **Valley**: 7 m west wall, 28 m flat, 4.5 m decked east wall | 27 m/s along the flat: a two-high stack on the line is smashed (12.5 m/s does it), a crab 14 m further on is spun from the board, and the pop-out lands 5.6 m past the east lip. |
| **Cascade**: 3.5 → 5.5 m, then two pipes each 7 m deep behind a shared ridge (5 m and 3.5 m far walls) | A held direction clears the first ridge on the first swing, by 1 m: 0.8 s in the air, so have the Jump ready (missed, the next east hang is 5.8 m over the ridge and 1.35 s long). The hang over the second ridge tops out 6.8 m above it, and its Jump comes 1.6 s after the first; the flats run 20, 27 and 32 m/s. The last pop-out lands 7.3 m past its lip. |
| **Rail into a pipe**: the short rail ending 1.3 m over the flat of a pipe whose west wall is 1 m high | The rider leaves the rail at 20 m/s, is in the air 0.27 s and touches down 5.3 m on, still rolling at 20 m/s; an 8 m flat leaves room. Its 3.5 m decked east wall is the exit: the pop-out lands 4 m past it, on the board. |
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
| Letting go of Jump on the way up | cuts the rise at once: the 22.4 m/s launch is down to 9 m/s three frames after the button comes up | the high bounce is Jump held from before the landing to the top of the rise. A wall beside the net changes nothing: with timed wall kicks on, a held bounce 1.1 m from the wall still tops out at 7.4 m |
| `mover` on `y` (a lift) | a walker under a descending deck is collected onto it, unhurt | the first lift can rest flush in a 0.5 m recess over solid ground; over a drop let the deck dip 0.4 m under the bank, so boarding is a step down for over a second |
| `mover` on `x` (a ferry), 5.9 m each way at 0.8 rad/s | within 0.45 m of a bank for 0.86 s in every 7.85 s | rest gap 0.1 m; a 0.25–0.5 m gap is walked over at a run |
| `phasepad`, 4 s cycle, lit share 0.6 | lit 2.4 s, strobing through the last 0.9; two pads half a cycle apart overlap for 0.4 s | "when the pad under you starts to strobe, the one ahead has just lit" |
| `crusher` | hangs 4.4 m up; passable while hanging and for the last half of its rise, about 1.6 s in each 3.2 | ≥ 6 m of fixed floor before the first; 5–6 m between two half a cycle apart |
| Watcher (`floater`) | hovers 1.65 m up: a walker passes under it between swoops and a grounded spin does not reach it; a jump-spin does | keep it ≥ 10 m from a brink: the jump that takes it carries 5 m |
| Mossback (`turtle`) | a spin leaves its shell standing in the lane; a stomp bounces 5.2 m | a row 5.7 m up is shell-only (a double jump heads 5.5 m); give it a beat (≥ 13 m) before the next tool |
| Whirler (`spinner`) | blades out 2.2 s, in 1.35 s | a plain floor ≥ 6 m short of it to wait on |
| A stack of boxes in the lane | its cap drops into the lane when the base is spun; a second spin takes it, a hop onto it is a 2.9 m bounce | keep stacks ≥ 9 m back from a brink or a timed footing |

## The wall yard (behind the start)

Walk west from the start instead of east. Four quarters of the same 2.5 m curve stand on each other's
decks, each with more straight wall above the curve than the last, and nothing else changes between them.
Met on foot, what a runner does at the top of each is decided by the lip's height above the last place his
feet hold (`docs/VERT_RUN_UP.md`): 1.25 m, he bounds over the lip; 2.6 m, he runs two steps up the wall and
mantles out; 3.75 m, he leaps, catches the lip and hangs; 4.9 m, he leaps, comes up short, slides down the
face and is rolled back onto his feet. Nothing in the yard is on the course.

They are not a kind of their own. They are plain `vertramp` quarters with `lipRise` and `deck`, standing
in the course's side-on zone, so they are pipes: ridden at on the board from the east, a wall throws the
rider into the air over its coping, and the stick over the lip with Jump carries that air out onto its
deck; rolled up to from above, each lip is whatever his speed makes it: waited on with the tail set on the
coping, dropped straight into, or flown off.

## Authoring rules the test course paid for

- **Keep a pipe that must be read at a glance about 12 m lip to lip.** The view shows 13.4 m ahead of a
  centred rider at 16:9, so the far wall is in frame from the near lip. A pipe that is a run (the 39 m
  valley) can be longer: what matters there is on its flat.
- **A pop-out lands on the board at about 4.5 m/s, and the player decides what the floor past the pipe
  is.** Braking there puts him on his feet in 0.6 s and 1.7 m (measured on every deck of the lab), so checkpoints,
  boxes and small platforms can follow a deck directly and be played on foot; rolling on, the same floor
  is taken on the board from that speed up to its cruise. Give the landing deck and the floor behind it
  the 7 m, and nothing lethal in the first 3 m past the touchdown. The exits that arrive FAST are a rail's
  landing and an open-sided ramp's run-out. There a rider arrives at 20 m/s or more, a floor crate or
  a **checkpoint** under 12.5 m/s is a tumble, a wall is a wipe-out, and his crate-contact box is about
  3.7 m tall, so "overhead" rows start 3.4 m up (a full on-foot jump heads 3.8 m). End such a stretch
  with the gate or another pipe, not a step.
- **How far a pop-out carries depends on how high the hang was when Jump was pressed**: 2 m out of a low
  hang, 4–7 m from the walls on this course. Give a decked exit ≥ 12 m of plain floor before anything
  that hurts.
- **Steps on an on-foot floor are jumped: keep them ≤ 1.6 m.** A tap jump rises 2.1 m and a held one
  2.7 m; a charged ollie 1.8 m. A lip lower than the skater's own reach above the ground under it
  (2.55 m, feet to raised fingertips; he stands 2.8 m) is never hung from, walked into, rolled into,
  jumped at or ollied at — the hanging body would be standing on the floor — so a step is a bump or a
  landing and never a way to stop a board. A wall between 2.1 and 2.55 m therefore takes the held jump:
  a tap comes up short of it and has no lip to catch.
- **A deck before a lip is a place he stops.** A walker is on his board at the coping and waits there,
  so the drop is his decision, made looking at it: put what he should read from there in view of the
  lip, keep the checkpoint before the deck, and give the deck ≥ 3 m (the run is slowed over its last 2).
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

`tools/test-side-pipe-lab.mjs` plays the course with the real player — right held, Jump at each lip he
is waiting on and in each east hang, a wait for each lift, ferry, timed pad, crusher and Whirler
(`tools/side-pipe-lab-bot.mjs` reads each hazard's own clock) — and asserts each claim: the long lens,
the walker brought to each lip at a walk and put on his board there, the wait (eight seconds of right
held and nothing else leaves him on P0's coping; the stick let go and pressed again drops him in), the
drop-ins and the curve they are
drawn on, the pop-outs landing on the board (stick held or at rest) and the brake putting him on his feet
within a few metres, the stick alone never leaving a pipe, the short first swing and
the transfer, the pumped shortcut, the plunge's air and its box, the falling stairs, both trampoline
bounces, the Mossback's shell, the lifts, ferry, pads and crushers (and that a run which waits for
nothing dies there), every enemy kind, the valley's stack and crab, the switch being the only way out,
the two cascade transfers, the short rail on the travel stick, the long rail lost on it and ridden on the
balance, the grind button held too early, a step that is bumped and not grabbed (walked into, rolled
into, and ollied at off the board at the take's own 5.5 m/s; a 2.4 m wall a tap jump comes up short of
is not caught either, and a 3.2 m one still is), a thrown board coming
to rest, the one-line brake and the checkpoint a death returns to; and two things as they are drawn,
frame to frame: a hang off the straight face of the yard's second wall coming back to that face (no step
on the deck behind the lip, the board turned under 4° and moved under 0.15 m against his hips in any
frame of the way back), and the first frames of the air out of P0.
`npm run check:pipe` covers the unchanged symmetric pipe.

`tools/test-side-pipe-lab-forward.mjs` then holds the forward copy to its claims: the same parts, all
sixteen verts on the analytic backing with no side-on zone round them, the frame east on the course and
west in the yard, the same route bot finishing the course on a stick held forward (in over each lip, out
of each hang, over each ridge, down both rails, with no plane walls keeping it on the centre line), the
four yard walls answered from behind, and the whole width of the floor being play.

The same command then runs `tools/test-vert-air-motion.mjs` (`npm run check:vert-air` on its own), which
films nothing and measures everything: the hang off P0's east lip and the cascade's two transfers on the
real rig — the trail going up and coming down, soles on the deck, nothing popping from one frame to the
next (a turn is held to the pace its own length gives it: the cascade's first has 25 frames, its second
58), the drawn turn against the even one the simulation keeps.

It ends with `tools/test-vert-run-up.mjs` (`npm run check:vert-run-up`): the yard's rule, on fixture walls
of every band. On the board it also rides at a straight-faced wall at five speeds, so the hang tops out
short of the lip, a hand under it, just over it and well over it: each is met by the face it left, at its
own height, with no step on the deck, and is drawn back onto it in one movement. Then it pops out of a
long air and a short one, and holds the first frames of each, and every frame after them, to the one
before.

```bash
RL=2.5 RR=7 F=1.5 DR=0 SPINE=2,2,5,3.5,6 MODES=right,right+pop,right+pop+pump node tools/side-pipe-probe.mjs
```

prints the swing-by-swing record for a pipe of any shape (`RL`/`RR` wall radii, `F` flat half-width,
`DL`/`DR` decks, `SPINE=floorY,flatHalf,radius[,eastRadius,eastDeck]` for a pipe beyond the east ridge,
plus `RAIL`, `ENEMY`, `BANG`). The walker is told to go six frames after he is on the coping (`wait`
leaves him there); `pop` presses Jump once in each east hang.

## The same course, head-on

**Side Pipe Lab (Forward)** (`side-pipe-lab-forward`) is the side-scrolling lab's own component list
without its camera group, so the two cannot drift apart: the same floors, pipes, boxes, hazards and yard,
with the lens behind the rider. What replaces the side view, its travel zone and the two walls that hold
play to one plane:

- **A lane** from the west end to the east end. With no zone over it the lane owns the frame: the camera
  follows from behind looking east, and **forward on the stick is down the course**.
- **A view over the wall yard** (`cameraView`, yaw 90, heading only) that turns the frame round to face
  west, because the yard is played away from the course. The turn is asked for over the 2.5 m behind
  the spawn and passes through the side view; the rig takes about a second to come round, so a walker who
  runs straight back has it behind him again about as he reaches the first wall, 11 m from the spawn. A
  direction held through it keeps its meaning (back from the spawn goes on being west); the next fresh
  press is read against the picture as it then is, where forward is at the walls.
- **Edge walls** at the two sides of the 6 m the floors are deep. The whole width is play: a walker can
  go round a stack, a board carves on the floors between pipes.
- **Its own follow rig** (`cameraRig` 6.5 m back, 7.5 m up, 34° down, 56°; `cameraAirLift: 1`). A pipe
  met head-on has a near wall, and the game's default rig (5 m back, 5 m up) loses the rider behind its
  deck on the way down and out of the top of the frame in a hang. This one rides higher and steeper and
  rises with him, so a hang 10 m over a lip stays in the picture.
- The stopwatch stands beside the lane back to the yard instead of in it (on the side-scrolling plane
  there is nowhere else for it to stand).

Nothing about the pipes is different. Each vert is marked `sideOn`, which outside a side-on zone is what
says the course crosses it, so the moves are the same ones met going into the picture instead of across
it, and every input that names a direction is read against the camera:

| Seen from the side | Seen from behind |
|---|---|
| right to the near coping: on the board at the lip, waiting; Jump or right again drops in, left steps him off | **forward** to the near coping; Jump or **forward** again drops in, **back** steps him off |
| Jump in the far hang, stick held right: the pop-out (or the spine transfer over a shared ridge) | Jump in the far hang, stick held **forward** |
| Jump in the near hang, stick held left: out over the near lip | ...stick held **back** |
| rolled up to a lip on the board, slowly: he waits; right or Jump goes, left rolls him back off it | **forward** or Jump goes, **back** rolls him back off it |
| left/right on a rail: the balance | left/right on a rail: the balance |
| the direction held up a wall spins nothing in the hang until it is let go (it is the travel stick) | left and right in a hang are always a fresh direction: forward and back are travel, and they never spin |

What a forward player has to know that a side-scrolling one does not: **in a pipe the stick does not
steer along it** (the ride is locked to the line across it, exactly as in the side view), so he leaves a
pipe as far off the centre line as he entered it. Both rails and the `!` over the switch pipe hang on the
centre line: line up on the deck before the lip.

Measured by `tools/test-side-pipe-lab-forward.mjs`: the route bot finishes in the same 126.5 s as on the
side-scrolling lab, never more than a centimetre off the centre line with nothing holding it there, with
the same 7 pop-outs, 3 spine transfers and 2 rails; the yard view has come round within 2 s of leaving
the spawn, and forward at the walls takes the first three and fails at the fourth.

## What the expansion added to the runtime

Both are opt-in and change nothing for a level that does not ask.

- **`cameraTelephoto`** on a `cameraView` camnode (`src/cameraViews.ts`): a kept follow distance may
  pass the close rig's 18 m, up to 100 m. Only this level sets it.
- **The air off a rail on a side-on line** (`spinStick` in `src/player.ts`): the stick along the line
  toward travel is the travel stick, never a spin. Without it a grind that had been balanced — the
  stick let go — ended with the first press of "right" turning the board sideways for the landing. It
  applies only inside a `sideOn` zone.

## Shared rules this course changed

They live outside the side-on code and apply everywhere.

- **A ledge is hung from only where there is room to hang** (`tryLedgeGrab`, `catchLedgeMesh` and
  `ledgeHasHangingRoom` in `src/player.ts`). From the ground a catch needs the lip above the skater's
  standing reach, 2.55 m at the baseline stature. The default `ledgeReach` is 2.4 m, so with default
  tuning nothing is grabbed by walking or rolling into it; a level's `ledgeAssist` can raise the reach
  past 2.55 m and bring grounded catches back for lips that tall. In the air the same room is asked
  for under the lip: where there is ground to stand on within that reach below it, under where he would
  hang, the lip is not caught, whether he jumped, ollied or fell to it. (The first step of the course,
  past the roll-in pipe's landing floor, is 1.6 m: caught out of an ollie, he hung from it with his feet
  0.35 m off the floor.) He lands
  on such a step or comes off its face. A lip with more than his reach of drop under it is caught as it
  always was, and a vert's lip has no such rule: under one he lies along the curve, not down a wall.
- **A hang's arms hold still** (`alignAuthoredLedgeHands` in `src/player.ts`). Three things shook them.
  The first two were the hang's own, on every ledge in the game; the third is this kind of course's.
  - When his arms would have to be longer than they are to reach his holds, the hung body is lifted a
    little toward them. That lift was let fall every frame and put back in one step once a glove had
    slipped 2 mm: a sawtooth every third frame, drawn as his wrists and elbows shivering. It now settles
    to what his arms last needed and no lower, and is made up whenever it falls short, by however little.
  - The side an elbow bends to was read again from an arm that had already been solved, so a frame that
    needed that second pass drew both elbows 2 cm from where the frame before had drawn them. It is read
    once, from the clip's own arm.
  - Between the two walls that hold a side-on course to its plane, both gloves were set down on ONE point
    over his head: the check on where a hand may be planted asked for room for a second body beside him,
    and 1.06 m of plane has none. His shoulders are 0.54 m apart, so each sway of his chest in the idle's
    fidget heaved all of him up 18 cm and let him down again. A hand now asks for an arm's width
    (`LEDGE_HAND_HALF`), and his gloves are on the lip 0.64 m apart.

  Hung still under the lip of the yard's third wall, in the game, over 188 steps: his wrists changed
  direction 106 times each and travelled 3.1 and 2.6 m, his elbows 6.9 m, his hips 101 times. Now 5 and 1
  times, 0.32 and 0.34 m, elbows 0.6 m, hips 4 times, which is the idle's own swing of his legs.
- **Discarded boards** (`src/skateboard/discarded.ts`). A deck that no longer fits between two solids —
  here, two metres of board turning across the 1.06 m between the play plane's walls — was met at
  fraction zero by each face in turn, so the resolver handed back the place it started from every step:
  it hung in the air, shivering, while its fall speed grew without limit. It now stops colliding with
  the one face it cannot fit beside and resolves against everything else. Its fall speed is capped at
  60 m/s, and it lands on a halfpipe's transition instead of dropping through it (the pipe's ribbon is
  double-sided with no promised winding; its riding side is now always read as facing up).
