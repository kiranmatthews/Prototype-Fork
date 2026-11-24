# Side-on pipes

A halfpipe that a side-scrolling stretch looks **across**: the camera sees its section, the open end
faces the lens, and the pipe is part of the path — in over one lip, out over the other. The test course
is **Side Pipe Lab** (`side-pipe-lab`, `src/levels/side-pipe-lab.ts`).

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
| Crossing a decked coping from the deck, walking, running or rolling | **Automatic drop-in.** The board is put on the wall up to 0.4 m of arc under the lip, heading in, at `max(0.85 × approach speed, 4 m/s)`. |
| On the pipe's surface on foot and moving (jumped in, got up from a spill) | The board mounts as soon as the feet move faster than 1 m/s. |
| Riding | The heading is locked to the cross axis. The stick never turns or brakes the board; any held direction still **carves** the walls for speed, and X held on a wall **pumps**. Circle is still the brake. The swing reverses wherever it dies, low on the transition included. |
| Reaching a lip | The ordinary coping launch: a vertical hang. |
| Hang, stick held **out** over that lip | The air is carried across it: a mirrored **spine transfer** if another pipe's mouth is beyond the ridge; otherwise a plain board air drifting out at `vertDrift` (4.5 m/s) if there is something to land on within 0.75 m under the lip's height 1.2 m past it (the pipe's deck, a floor, a ghost slab a `!` has made solid). A ledge higher than the lip is taken once the air has cleared it. A bare wall with a drop behind it is never an exit. |
| Hang, stick neutral or held in | Drops back into the pipe. |
| A direction already held when the air began | Does not spin the rider until it has been released once (it is the travel stick). A fresh direction spins, as in every other air. |
| A solid met in the hang (a `!` floated over the lip) | Stops the climb; the hang stays on its line instead of being pushed out behind the wall. |
| A rail caught on a side-on line with a direction held | That direction does not tip the balance until it has been released once; a fresh left/right balances as on any rail. |
| A lip stall (the grind button held up the wall) with a direction held | The same: that direction does not tip the stall until it has been released once, so the stall settles back **into** the pipe. Left live, the travel stick points out the back of the far wall and throws the rider off behind it in 0.4 s. A fresh direction tips the stall as on any coping. |

Nothing in `src/tuning.ts` changed.

## Measured (real `Player`/`Level`, `tools/side-pipe-probe.mjs` and `tools/test-side-pipe-lab.mjs`)

Walk-in at 9 m/s, right held unless noted.

| Pipe | Result |
|---|---|
| 3.5 / 3.5 m walls, 2.5 m flat half, decks | Drop-in 7.65 m/s. First east launch 18 m/s up, carried out, lands about 5 m past the lip. Exit decks plus the floor behind them want ≥ 7 m of flat. |
| 2.5 m west, 7 m east (a spine) | First swing climbs **4.45 m** of the 7 m wall. The swing back hangs about 7 m over the low west lip, and the second swing clears the east lip and transfers. Holding X on the walls clears it on the **first** swing; so does arriving on the board with X held down a 14 m approach (the same work, done early). |
| Landing ramp, 5 m west wall, open east | Rolls out at 23–30 m/s: well over the 12.5 m/s crate-smash speed. |
| `!` floated on the hang line | Headed from below by the hang. 6 m over a 3.5 m lip is beyond a double jump off the deck (5.5 m head reach) and inside the first west hang of a held-right swing. |
| Rail starting over a bare lip | Caught with the grind button within the usual 2.1 m snap. The grind starts at only 3.5 m/s (a vertical hang has no speed along the rail), which is where the balance needle runs away fastest, so run it **downhill, steepest first**. A straight 19 m rail dropping 4.4 m took 1.65 s and shed a rider who gave no balance input after 1.18 s; dropping 2.6 m in its first 3 m and 1.8 m over the next 9 m, the grind lasts 0.93 s, leaves at 20 m/s and needs none. |
| Grind button held from the drop-in, right held | A 0.8 s lip stall on each coping in turn, never a bail and never an exit. A rail over a lip wants the button pressed in the hang, not held up the wall. |
| No input at all, decked pipe | The rider never stops: every coping launch adds the pipe's pop, so the swing settles at 5–6 m hangs. Leaving needs the stick held out over a lip. |

## Authoring rules the test course paid for

- **Keep pipes about 12 m lip to lip.** The widest side view (`cameraFollowDistance: 18`,
  `cameraKeepDistance: true`) shows 13.4 m ahead of a centred rider at 16:9, so the far wall is in frame
  from the near lip.
- **Nothing a board can trip on stands on a floor a pipe exits onto.** The rider leaves a pipe still on
  the board; under 12.5 m/s a floor crate — or a **checkpoint** — on the riding line is a tumble. His
  crate-contact box is about 3.0 m tall, so "overhead" rows start 3.4 m up (a full on-foot jump heads
  3.8 m).
- **Start each on-foot stretch with a catch ledge.** A 2.1 m step is over a charged ollie (1.7 m) and
  inside the ledge grab (2.4 m): the board is stopped and its rider climbs up by the hands. Checkpoints
  and small platforms go after it. Keep the first 2.4 m of the ledge bare: the rider's contact box
  reaches a metre ahead and 3 m up, so from the floor below it clips a box standing near the edge and
  trips him before the hands can catch.
- **On a single plane the default stopwatch stands in the only lane**, two strides from the spawn, and a
  time trial strips the checkpoints. Author a `clock` behind the spawn.
- **Float a `!` on the hang line** (0.08 m inside the lip) and out of on-foot reach, over the lip the
  held-right rider only visits on the swing back.

## Checks

```bash
npm run check:side-pipe
```

`tools/test-side-pipe-lab.mjs` plays the course with the real player on held right and asserts each
pipe's claim: the drop-ins, the short first swing and the transfer, the pumped shortcut, the crab, the
switch being the only way out, the rail, the grind button held too early, the one-line brake and the
checkpoint a death returns to.
`npm run check:pipe` covers the unchanged symmetric pipe.

```bash
RL=2.5 RR=7 F=1.5 DR=0 SPINE=2,2,5 MODES=right,right+pump node tools/side-pipe-probe.mjs
```

prints the swing-by-swing record for a pipe of any shape (`RL`/`RR` wall radii, `F` flat half-width,
`DL`/`DR` decks, `SPINE=floorY,flatHalf,radius` for a landing ramp beyond the east ridge, plus `RAIL`,
`ENEMY`, `BANG`).
