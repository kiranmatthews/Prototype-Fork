# Running up a vert on foot

A walker who runs up a transition that ends vertical runs out of slope: past about 60° a running foot no
longer holds. What he does there depends on one measurement of the wall and on nothing else: **the height
of the lip above that point**. For a `vertramp` of radius `rise` with a straight section `lipRise` above
its curve that is `rise / 2 + lipRise`.

| Lip above the 60° point | What he does | Takes | Where it leaves him |
|---|---|---|---|
| up to **3.0 m** | **climbs out**. A plain quarter's lip is by his knees by then and he bounds over it, arms swinging; a lip at his hips or his chest he takes in his hands and goes over between his arms; a lip over his head is two steps up the wall, a hand and then the other on the coping, and a mantle | 0.5 s (plain quarter) to 0.9 s (3 m) | on the deck 1 m past the lip, running at 4.4 m/s |
| up to **3.9 m** | **leaps and catches the lip** at the top of the jump, at the full stretch of his arms, and sags onto them | 0.4–0.7 s | in the game's own ledge hang: the ordinary clamber, drop and grip timer from there |
| higher | **leaps, and comes up short**. The same leap, a metre of it; his fingers stop short; he slides down the face looking back over his shoulder, the transition takes his feet and throws him over backwards: onto his seat, up his back, over one shoulder and his hands with his head turned out of the way, feet down under him, and up. One backward roll, onto his feet | 2.1 s | stood on the flat about 4 m back from the face, his to move again |

The bands are the wall's alone (`vertRunOutcome` in `src/vertRunUp.ts`): the same wall always ends the same
way, whatever stride he arrives on. They come from where he is drawn when the wall stops his run (pelvis
about 1.5 m over the 60° point), the metre his leap is worth, and the 1.4 m from his pelvis to a lip his
hands can hold with no stretch in his arms.

**A top with no ledge is always come up short on.** Climbing out and catching both need something behind the
lip: 0.9 m of standable deck with room on it for him. Where there is none he still runs at the wall, and
whatever its height it ends the third way: two verts back to back (a spine: the far side falls away), a
curve at the foot of a face that goes on up (the face is measured all the way up it), a deck too shallow to
stand on, a deck with a box on its first metre. Under a lip that is within his reach he does not leap for
it: he springs a hand's breadth, his palms meet the face under the coping, and he slides back down into the
same roll. The one exception is a ledgeless top no higher than his hips (1.5 m over the 60° point): there is
nothing to leap for, and it is left alone.

These are rules about verts, not about kinds of part. A quarter and a half pipe, a swept bowl wall and a
side-on pipe, with or without a straight face above the curve, are all measured the same way and all end
the same way.

## When it happens

All of these, or the wall is only a wall:

- on foot and grounded on a `vertramp`, running **up** it at 4 m/s or more with a direction held. Letting
  go of the stick before the wall is not a run at it;
- a wall that stands up: a transition that reaches 60° and ends in a lip, or in nothing. A bank that levels
  out is only a slope;
- not while charging a jump, sliding, crawling, swimming, teetering or bailing, and not in a level that sets
  `ledgeGrabs: false`.

That includes the inside of a side-on pipe. Walking up to its lip along the deck still puts him on his
board (on the coping, waiting to be told to go: `docs/SIDE_ON_PIPES.md`), but its surface no longer puts a
board under a walker: jumped into, or down in one after a spill, he
is on his feet, and running at its wall is this. (X held with a direction is the ordinary push-off, there as
anywhere.)

Nothing changes on the board. A skater rides the same wall exactly as before.

## A vert's lip is a ledge

Running up the transition is one way to its lip. Jumping to it, or falling past it, is another, and on foot
it is an ordinary ledge catch, on any vert in any level: the same reach, the same hang, the same clamber,
drop and grip timer as a platform's edge. (Never from the board: a rider over a coping is in the pipe's own
air.) One rule of a platform's edge does not apply: a platform's lip is not hung from where there is ground
within his standing reach under it, because he would be standing there, and a vert's lip is caught at any
height, because under it he does not hang down a wall.

A platform's side is a wall all the way down. A vert's is only a wall as far as its straight section goes:
under that the transition comes out from the face toward him, and a body hung straight down would have its
legs inside it. So under a vert's lip he hangs the way a body does there: straight down a straight face,
and where the face curves away, swung out from under his hands until his hips are off the curve, with his
legs out further still, lying along it. His hands do not move on the coping. Climbing up gathers him back
in.

Under a face that stands up straight the move begins a stride before the 60° point: the run would otherwise
carry his head (it is 0.8 m across) into the wall before his feet ran out of slope.

## Met in the air

A walker who is in the air when he meets a vert's steep face (jumped at it, fell onto it, dropped onto it
from a hang) is never left stood on it. A face is steep here from 53° (a normal under 0.6), and what
happens is read off the same wall the run-up reads:

- its lip is at his feet (within 0.6 m): he is **put on the deck** and runs on;
- its lip is within a ledge catch's reach and it has a ledge: the ordinary **ledge catch**, as above;
- anything else (too high, no ledge, or the catch is cooling down): the **come-up-short**, entered where he
  is. From the straight face it is the slide down and the roll back; landed on the transition itself
  (levelled out past 16°) there is nothing to slide down, and it is the roll alone, begun from where his
  feet are.

Rising or falling makes no difference, and the roll's first frames are eased in from whatever he was doing
in the air.

## Letting go of a ledge

Any hang is left the same way (the stick held away for a beat, on a vert's lip as on a platform's edge):
he gathers on the wall for 0.15 s, **hops off it** (2.4 m/s up, 0.3 m out over 0.16 s) and **drops facing
the ledge**, with the direction he was holding ignored until it has been let go, so the stick that let go
does not also run him off. The clip is the hang's own push-off, paced to the height of the drop so its feet
arrive as the floor does. Under a vert's lip there is no floor: he comes down on the transition, and that is
"met in the air" above, so the drop ends in the come-up-short's roll back onto the flat.

## From these moves back to his feet

Each of these moves places the body itself, and the run, the fall and the idle place it differently. So
the last pose that was drawn is kept, every frame, and wherever one of these hands over (a run-up ending on
the deck or on the flat, a hang let go of, a drop landing, a wall met in the air) every joint is eased from
that kept pose into the new one, and the pelvis from where it was drawn to where the new move has it, over
0.14 to 0.26 s on a curve that is level at both ends. A hang's controller point is at his chest and a
fall's is under his feet, so out of a hang the pelvis is carried across by the fall itself (as far through
as he has fallen) and not by a clock.

## Authoring

- **A quarter the route climbs on foot** wants its lip within 3.0 m: any radius up to 6 m with no straight
  section, or a 2.5 m curve with up to 1.75 m of straight above it. It costs a runner half a second and
  reads as a step up, so it can be the step itself on an uphill stretch.
- **A wall to hang from** is 3.1–3.9 m. The hang is the ordinary one: Jump or the stick toward the deck
  clambers up, away drops, and it lets go by itself after `ledgeGrabTime`.
- **A wall that turns a walker back** is 4.0 m or more, or any wall over 1.5 m with no ledge at its top, and
  it costs him 2.1 s and four metres. Make it plainly taller than the last wall he got up (the yard's last
  wall is 1.15 m over the one before it), and leave 3 m or more of flat in front of it: he comes to rest
  about 1.8 m out from the foot of the curve. On a shorter flat he is braked to stop on what there is; with
  none at all the wall is left alone.
- The deck behind the lip is the landing. Keep the first metre of it clear: a box standing there makes the
  wall one he comes up short on, and one standing in the run-up stops the run.
- **Two pipes sharing a ridge** are a board line (the spine transfer). On foot that ridge is a wall with no
  ledge: a walker down in either pipe comes up short on it and has to leave by the other wall, or get on
  his board.

Side Pipe Lab's **wall yard** (behind the start, walking west) is four walls of the same 2.5 m curve, each
on the last one's deck: 1.25 m (vaulted), 2.6 m (climbed), 3.75 m (caught) and 4.9 m (missed). They are
ordinary verts in a side-on stretch, so everything a board does on a pipe it does on them too: ridden at
from the east they throw a rider into the air over their coping, and the stick over the lip with Jump (the
spine transfer's input) carries that air out onto the deck; rolled up to from above on the board, each lip
is a wait on the coping, a drop-in or an air by how fast he reaches it (`docs/SIDE_ON_PIPES.md`).

## How it is built

- `src/vertRunUp.ts` is plain geometry and numbers, with no renderer in it. The Player samples the real
  surface ahead into a `VertWall` (looking straight down every few centimetres; the steepness is read
  between the middles of the drawn facets, so a wall of eight facets and one of ninety-six measure the
  same), asks for a `VertRunPlan`, and reads one frame off it per step: where the pelvis is drawn, where
  the controller point is, how far through its clip the pose is, and what each hand and foot is holding.
  The plan is fixed the moment it begins. Nothing in it is random or depends on the frame rate.
- The pelvis path starts **exactly where the run had drawn him** and is one curve from there. A climb only
  ever goes up. A leap is a throw: up from the load at one speed, slowing all the way to its top.
- `src/animation/vertRunUp.ts` holds three one-shot clips (`player.vert-climb`, `player.vert-leap`,
  `player.vert-miss`), scrubbed by the plan's own progress. Each clip's moments (hands on, over, loaded,
  caught) are keyed at the plan's, wherever a taller or shorter wall puts them in time. The miss's body
  pitch is read from the same table (`VERT_MISS_ROLL`) the plan takes its pelvis height from.
- Three things depend on where this wall's lip is, so they are left to gameplay and authored neutral in the
  clips: his **look** (the head is level in the poses and is turned to the lip: up at one over him, down at
  a coping by his knees), his **hands' way to it** (the arms reach forward and the hold takes them up or
  down), and **whether he needs his hands at all**.
- After the pose, `Player.alignVertRun` puts the pelvis where the plan has it and solves each holding hand
  onto the coping and each holding foot onto the wall. A planted foot holds for as long as his leg reaches
  it and peels off as the leg straightens; a hand is pushed off as his pelvis passes the height his straight
  arms hold it at.
- When the move ends, the pelvis is drawn for a fifth of a second between where the move would have gone on
  to take it and where the run, the hang or his own feet now have it. A catch enters the game's ledge catch
  at its dead hang, with his hands kept on the coping while his body is eased across.
- His head never goes into the wall or the floor. A guard would move the body out by what the head was in
  by; the paths and poses are authored to leave it nothing to do, and the test holds them to that. His head
  is 0.8 m across, which is what shapes the roll: his hips go over at 1.4 m, on his hands, and he goes over
  one shoulder with his head tipped aside, because straight over the top of it they would have to pass at
  1.6 m.
- A face that stands up straight cannot be seen from above. Where the looks down find a wall with nothing
  behind its top, the wall is looked AT, a hand's breadth higher each time, until a look goes over it: that
  is its height, however far up it goes.
- The hang's lean is drawing only (`Player.alignHangToVertCurve`): the wall under the lip is looked at once
  per hang, and each frame the posed body is swung about the line through his hands, and his thighs about
  the same line, by the least that keeps his hips, knees and heels off it.

## Checks

```bash
npm run check:vert-run-up
```

`tools/test-vert-run-up.mjs` asserts the rule, the plan on walls from a 1.2 m kicker to a 9 m face, the
three clips, and then the real Player on sixteen fixture walls with the shipped clip presentation: each
wall ends the way its measurement says, every time, and ends where it should (on the deck running, in the
hang and from it up the ordinary clamber, back on the flat on his feet); the drawn pelvis is where the plan
has it from the first frame, with no pop into the move or out of it; a hand that holds is on the coping; and
the head guard never has more than 3 cm to do. Four of the walls have no ledge (a shallow deck, a spine, a
face that goes on up, a boxed-in deck) and are come up short on; a hip-high spine is left alone. It then
drops him past four lips on foot, one of them between the two walls of a side-on plane (caught, hung
from with no part of his legs in the wall, hung still for 2.5 s with his wrists, elbows and hips steady,
his gloves a shoulder's width apart and within 4 mm of their holds, his body not heaved to keep them
there and each instant drawn twice drawn the same, climbed out of),
flies him at walls from the air (put on the deck, caught, or slid and rolled, rising or falling), lets go
of a platform's edge and of a vert's lip (the beat on the wall, the hop, the drop facing it, the roll off a
transition), and measures the picture from each of these back to his feet, frame to frame. Then, on the
board, it rolls him up to two lips at twelve speeds and scripts (waiting on the coping and dropped in by
Jump or by the stick, backed out, dropped straight in whatever he presses, an ollie popped in the set-up,
flown off the edge), walks and runs him up to a lip on foot (slowed over the last of the deck, on his
board at the coping with his pelvis never moved more than 0.16 m in a frame, waiting until Jump or a fresh
press of the stick, stepped off again by
the stick pressed back, and a jump thrown from the deck left a jump), and rides him at a quarter (into its
air, and out over its lip onto the deck). Last,
it rides him at a straight-faced wall so that the hang tops out under the lip, at it and over it (met by
the face each time, never by the deck behind it: `docs/SIDE_ON_PIPES.md`), and pops him out of a long air
and a short one, with the picture of each held frame to frame. `npm run check:side-pipe` runs it after
the course test.

Review by eye is frame by frame in the real game (`?launchReview`, one fixed step at a time). Stepped that
way the run's own drawing has caught up with the controller point when the move begins; in play it trails
it by about two steps. The move begins from wherever he is drawn, so both are seamless, but a still from a
stepped review shows the first frame a little further up the wall than play does.
