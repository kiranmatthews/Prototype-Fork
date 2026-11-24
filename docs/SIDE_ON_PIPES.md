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
| A rail caught on a side-on line with a direction held | That direction does not tip the balance until it has been released once; a fresh left/right balances as on any rail. |
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

## Authoring rules the test course paid for

- **Keep pipes about 12 m lip to lip.** The widest side view (`cameraFollowDistance: 18`,
  `cameraKeepDistance: true`) shows 13.4 m ahead of a centred rider at 16:9, so the far wall is in frame
  from the near lip.
- **A pop-out lands on foot, so the floor past a pipe is ordinary platforming.** Checkpoints, boxes and
  small platforms can follow it directly. The exceptions are the exits that keep the board: a rail's
  landing and an open-sided ramp's run-out. There a rider arrives at 20 m/s or more, a floor crate or
  a **checkpoint** under 12.5 m/s is a tumble, a wall is a wipe-out, and his crate-contact box is about
  3.0 m tall, so "overhead" rows start 3.4 m up (a full on-foot jump heads 3.8 m). End such a stretch
  with the gate or another pipe, not a step.
- **Steps on an on-foot floor are jumped: keep them ≤ 1.6 m.** A tap jump rises 2.1 m and a held one
  2.7 m; a charged ollie 1.8 m. Walking or rolling into a wall lower than the skater's own reach
  (2.55 m, feet to raised fingertips; he stands 2.8 m) is a bump, never a ledge grab — the hanging body
  would be standing on the floor it never left — so a step is not a way to stop a board.
- **Give a spine a pipe to transfer into, with a lower, decked far wall.** The transfer keeps the board
  and the speed; the second pipe turns that speed into a hang over its far lip, and the pop-out from
  there is the landing.
- **On a single plane the default stopwatch stands in the only lane**, two strides from the spawn, and a
  time trial strips the checkpoints. Author a `clock` behind the spawn.
- **Float a `!` on the hang line** (0.08 m inside the lip) and out of on-foot reach, over the lip the
  held-right rider only visits on the swing back.

## Checks

```bash
npm run check:side-pipe
```

`tools/test-side-pipe-lab.mjs` plays the course with the real player — right held, Jump in each east
hang — and asserts each pipe's claim: the drop-ins and the curve they are drawn on, the pop-outs landing
on foot, the stick alone never leaving a pipe, the short first swing and the transfer, the pumped
shortcut, the crab, the switch being the only way out, the rail, the grind button held too early, a
step that is bumped and not grabbed, a thrown board coming to rest, the one-line brake and the
checkpoint a death returns to.
`npm run check:pipe` covers the unchanged symmetric pipe.

```bash
RL=2.5 RR=7 F=1.5 DR=0 SPINE=2,2,5,3.5,6 MODES=right,right+pop,right+pop+pump node tools/side-pipe-probe.mjs
```

prints the swing-by-swing record for a pipe of any shape (`RL`/`RR` wall radii, `F` flat half-width,
`DL`/`DR` decks, `SPINE=floorY,flatHalf,radius[,eastRadius,eastDeck]` for a pipe beyond the east ridge,
plus `RAIL`, `ENEMY`, `BANG`). `pop` presses Jump once in each east hang.

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
