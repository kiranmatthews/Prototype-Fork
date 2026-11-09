# Bone Man / Jak hybrid default animation audit

10 November 2026. Source baseline: `20055006`. The ordinary game now uses the
same D document and Skate presentation as the comparison lab. A/B/C/D remain
available in the lab. Movement, damage, inputs and the live tuner retain their
existing authority.

## Final behaviour

- Restore the first pancake's broad spread, palm orientation and flat impact.
  Retain the 0.26-second anticipation hold inside the existing 0.32-second hang
  and the existing 0.5-second grounded recovery. The low forward roll completes
  before the live idle/run handoff. Its rotation uses evenly sampled, eased
  keys to avoid acceleration changes at uneven pose-key intervals.
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

`npm run check:animation-d` runs 40 independent checks and preserves a separate
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
stationary/running exit, totalling 3,150 frames. Movement and action clocks match
the unmodified controller exactly. All impact limb lengths exceed 1.28× rest;
minimum sampled body clearance is 6 mm, the roll completes forward, and the
grounded recovery returns to the requested locomotion.

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
987,858,074 / 1,000,000,000 bytes. Deployment verification is recorded in the
completed release handoff. This is broad measured regression coverage, not a
claim that every possible input sequence or user-authored level was exercised.
