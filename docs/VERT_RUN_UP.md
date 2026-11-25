# Running up a vert on foot

A walker who runs up a transition that ends vertical runs out of slope: past about 60° a running foot no
longer holds. What he does there depends on one measurement of the wall and on nothing else: **the height
of the lip above that point**. For a `vertramp` of radius `rise` with a straight section `lipRise` above
its curve that is `rise / 2 + lipRise`.

| Lip above the 60° point | What he does | Takes | Where it leaves him |
|---|---|---|---|
| up to **3.0 m** | **climbs out**. A plain quarter's lip is by his knees by then and he bounds over it, arms swinging; a lip at his hips or his chest he takes in his hands and goes over between his arms; a lip over his head is two steps up the wall, a hand and then the other on the coping, and a mantle | 0.5 s (plain quarter) to 0.9 s (3 m) | on the deck 1 m past the lip, running at 4.4 m/s |
| up to **3.9 m** | **leaps and catches the lip** at the top of the jump, at the full stretch of his arms, and sags onto them | 0.4–0.7 s | in the game's own ledge hang: the ordinary clamber, drop and grip timer from there |
| higher | **leaps, and misses**. The same leap, a metre of it; his fingers stop short; he slides down the face looking back over his shoulder, the transition takes his feet, he goes over onto his back with his legs in the air and skids out along the flat; sits up, looks at the lip, gets up | 2.6 s | stood on the flat about 4 m back from the face, his to move again |

The bands are the wall's alone (`vertRunOutcome` in `src/vertRunUp.ts`): the same wall always ends the same
way, whatever stride he arrives on. They come from where he is drawn when the wall stops his run (pelvis
about 1.5 m over the 60° point), the metre his leap is worth, and the 1.4 m from his pelvis to a lip his
hands can hold with no stretch in his arms.

## When it happens

All of these, or the wall is only a wall:

- on foot and grounded on a `vertramp`, running **up** it at 4 m/s or more with a direction held. Letting
  go of the stick before the wall is not a run at it. (A side-on pipe never sees this: it puts a walker on
  his board as he crosses its edge.);
- a lip with a standable deck behind it, at least 0.9 m deep, with room on it for him. A fence-top quarter
  with no deck is left alone;
- not while charging a jump, sliding, crawling, swimming, teetering or bailing, and not in a level that sets
  `ledgeGrabs: false`.

Nothing changes on the board. A skater rides the same wall exactly as before.

Under a face that stands up straight the move begins a stride before the 60° point: the run would otherwise
carry his head (it is 0.8 m across) into the wall before his feet ran out of slope.

## Authoring

- **A quarter the route climbs on foot** wants its lip within 3.0 m: any radius up to 6 m with no straight
  section, or a 2.5 m curve with up to 1.75 m of straight above it. It costs a runner half a second and
  reads as a step up, so it can be the step itself on an uphill stretch.
- **A wall to hang from** is 3.1–3.9 m. The hang is the ordinary one: Jump or the stick toward the deck
  clambers up, away drops, and it lets go by itself after `ledgeGrabTime`.
- **A wall that turns a walker back** is 4.0 m or more, and it costs him 2.6 s and four metres. Make it
  plainly taller than the last wall he got up (the yard's last wall is 1.15 m over the one before it), and
  leave 3 m or more of flat in front of it: he comes to rest about 1.8 m out from the foot of the curve.
  On a shorter flat he is braked to stop on what there is; with none at all the wall is left alone.
- The deck behind the lip is the landing. Keep the first metre of it clear: a box standing there blocks the
  move altogether, and one standing in the run-up stops the run.

Side Pipe Lab's **wall yard** (behind the start, walking west) is four walls of the same 2.5 m curve, each
on the last one's deck: 1.25 m (vaulted), 2.6 m (climbed), 3.75 m (caught) and 4.9 m (missed).

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
  by; the paths and poses are authored to leave it nothing to do, and the test holds them to that.

## Checks

```bash
npm run check:vert-run-up
```

`tools/test-vert-run-up.mjs` asserts the rule, the plan on walls from a 1.2 m kicker to a 9 m face, the
three clips, and then the real Player on eleven fixture walls with the shipped clip presentation: each
wall ends the way its measurement says, every time, and ends where it should (on the deck running, in the
hang and from it up the ordinary clamber, back on the flat); the drawn pelvis is where the plan has it from
the first frame, with no pop into the move or out of it; a hand that holds is on the coping; and the head
guard never has more than 3 cm to do. `npm run check:side-pipe` runs it after the course test.

Review by eye is frame by frame in the real game (`?launchReview`, one fixed step at a time). Stepped that
way the run's own drawing has caught up with the controller point when the move begins; in play it trails
it by about two steps. The move begins from wherever he is drawn, so both are seamless, but a still from a
stepped review shows the first frame a little further up the wall than play does.
