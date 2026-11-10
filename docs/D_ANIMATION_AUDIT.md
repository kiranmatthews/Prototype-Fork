# Bone Man / Jak hybrid default animation audit

10 November 2026. Source baseline: `20055006`. The ordinary game now uses the
same D document and Skate presentation as the comparison lab. A/B/C/D remain
available in the lab. Movement, damage, inputs and the live tuner retain their
existing authority.

## Final behaviour

- Keep the first pancake's broad spread, palm orientation and flat impact.
  The anticipation recoils past its coil and holds it alive inside D's own
  floaty 0.55-second hang; the dive eases off it into the unchanged peak fall
  speed. The low forward roll and the rise finish inside D's own 1.15-second
  grounded recovery, before the live idle/run handoff. Every channel is an eased curve baked at an even
  120 Hz cadence, so nothing accelerates at uneven pose-key intervals.
- The pancake no longer freezes on the floor: limbs slap down after the torso
  and bounce, the torso rebounds, and the body gathers back into a tighter
  roll. Actual posed-surface support keeps contact through the turn. The roll
  rocks onto planted soles, loads a crouch and springs past standing before it
  settles. The palms plant on the floor through the gather, the arms tuck
  through the roll, and from the sit-up they play the jump landing's own arm
  sweep at its real pace, finishing over live idle or run for 0.6 seconds
  after control returns. The single jump shares the double jump's independent-limb stretch
  and earlier apex gather; its existing double-jump variant remains separate.
- At the bottom of the slam, both arms and both legs stretch outward rather
  than shorten. The shared `pancake-slam-impact` profile authors 28–40% segment
  extension while the torso flattens. The impact unwinds into the recovery;
  neither the whole skeleton nor the gameplay trajectory is scaled.
- Held X at low mounted speed plays the recovery push for forward, sideways
  and neutral steering. Entry/exit hysteresis follows reachable cruising speed,
  including live tuning and authored soft-ground caps. Finish the stroke and
  return to the charge pose; release still ollies and cancellation still cancels.
- Regular/fakie leading-foot ownership is preserved. Ice retains its native
  balance animation. The transition's foot solve accounts for nonuniform
  character proportions and converges to less than 0.5 mm contact error in the
  tested 30/60/120 Hz cases.
- Reset presentation clocks on respawn, retain the outgoing native pose for
  pickups, and tolerate mounted presentation before the first input sample.
  Native actions and hidden/preview characters retain their presentation.
- Both local players share loaded motion assets but have independent animation,
  scribble and reset state. Saved documents stamped with the new scheme retain
  subsequent edits. Existing motion assets are reused; no binary asset added.

## Coverage

`npm run check:animation-d` runs 41 independent checks and preserves a separate
log/result for each. It is also part of `check:all`, not the Pages build path.

| Area | Coverage |
| --- | --- |
| Foot motion | Idle, walk/run blend, stops, reversals, precision/forward/coyote jumps, double jump, full somersault, live UI physics and segment elasticity |
| Ledges | Catch directions, hanging, shimmy, release, delayed/fresh-input climb, rebound, running exit, crates and blocked ceilings |
| Equipment | Reversible mount/cancel, board clearance, mount/dismount scribbles, moving and stationary pickups, fakie pickups, live dismount gait, abandon ship and respawn |
| Riding | Regular/fakie low-speed X push at 30/60/120 Hz, neutral/side/forward steering, raised UI cruise, soft-ground cap, charge/cancel/release, ice entry/exit and stance continuity |
| Native actions | 29 ownership cases including spins, grabs, deck tricks, manuals, revert, wallride, lip, vert, pipe hang, special launches, ragdoll, recovery, slam, split jump, crawl, slide, teeter, kite, swim, results and world map |
| Course systems | 68 rail-ollie intent cases; rail catch/drop-in, halfpipe/vert, swimming, ledge crates, kite controls/grab/spring/finish, trampoline controls/contact/roll landing and world-map locomotion |
| Lifecycle | Cold mounted start, two independent players, reset during push/mount/dismount, hidden character and Studio preview |

The final slam regression covers 18 combinations of frame rate, drop height and
stationary/running exit, plus a player whose idle stance was never measured,
totalling 5,106 frames. D hangs longer and eases into its fall, but comes
straight down, never exceeds the native peak fall speed and reaches it on a
long drop; after its 1.15-second lock it resumes the very same native
movement, delayed. All impact limb lengths exceed 1.2x rest while the torso
squashes to 0.65x and rebounds; minimum sampled body clearance is 6 mm and the
recovery never leaves the floor. The roll turns forward only, at no more than
0.26 rad per 60 Hz frame and with no change of speed above 0.05 rad per frame.
Landed shoe tips stay within 1.2 cm of their marks through the crouch, the
spring past standing and the handoff. The pelvis and legs reach the idle's own
stance by the end of the lock, so a stationary exit hands over with a head step
under 8 mm while the arms finish their sweep.

D also keys its own slide and slide jump, and carries the body across every
cut into, inside and out of them (`poseInertia.ts`) in place of a crossfade.
The slide regression covers 21 combinations of frame rate and exit: standing
up, running on, a held crouch, a held crawl, the jump landing in a stand or a
run, and a double jump out of it landing in a run. It proves movement
identical to the native presentation frame for frame, a bound on how much any
part's world speed may change in one frame, no sole sinking into the floor,
held soles that stay put while he stands up, a standing touchdown with no
stock landing in it, and that running on out of the jump keeps run speed from
the first frame on the ground through the ordinary running landing.

The follow-up passes nine rubber-motion cases, 18 double-jump transitions,
12 UI-tuning configurations, source-retarget and precision-jump checks. Paired
traces retain exact movement parity; the second jump still lifts the head by
at least 0.39 m in its first three frames. The 8.85 m/s flip threshold is unchanged.

The supplied Haunted Hassle replay covers 2,046 recorded controller frames and
109 moving-pickup gait frames; the gait matches live locomotion without the old
180-degree fakie step-off snap. The Tribal Run replay includes 170 scribble
samples and retains the board-relative reveal below the pelvis.

The complete pre-existing suite comprises 207 leaf commands. It was resumed
after failures so every command ran. Corrected and reran stale fixtures for the
Nightworks loaded rope, double-jump tuck, level-switch flame resources, factory
8.85 m/s flip threshold and camera replay. D-specific fixture corrections cover
the deliberate mount preparation, retained airborne ice carry, slowed ledge
climb and actual descending rail contact.

The old Slipstream camera recording no longer reaches its historical shelves at
fixed frame offsets under the current controller. Its actual lower landing
stays live and all ten fatal falls hold the final 40 airborne frames. Three
additional rotated lower-platform drops reproduce 9/10/9 false-held frames
without trajectory prediction and zero with it; each lands on the actual lower
platform. Camera queries leave movement untouched. No camera runtime changed.

## Browser and release verification

Reviewed the ordinary game entry and comparison lab, lite/full rendering and
normal/MAX native presentation. Final impact, forward inversion, planted feet,
running exit, and regular/fakie recovery pushes were inspected in the browser;
no console errors or warnings. Captures are in this chat's visualization folder,
`d-gameplay-scheme-2026-11-10/`.

Node 22 production build and release-size check pass: 3,465 files,
987,858,870 / 1,000,000,000 bytes after the bottom-settle/jump follow-up. Deployment verification is recorded in the
completed release handoff. This is broad measured regression coverage, not a
claim that every possible input sequence or user-authored level was exercised.
