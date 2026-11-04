# Race items, compact height and shared speedometer — local preview

This increment follows the user's successive local playtest corrections. The
race now runs approximately 2,266.55 metres, two thirds of its previous length.
Eight intact sections keep long approaches and useful forward forks. Its
physical wrap cell is 48 metres high, with recovery shelves at −12 and +12:
24 metres between heights, including across the seam. This is the two-tier
option the user explicitly selected. The platformer retains its distinct
2.1 km journey, compressed to a 96-metre cell with six recovery heights.

Height compression preserves character size, deck thickness, rail clearance
and curved halfpipe profiles. Main landings retain headroom below recovery
shelves. The native fall/collision model and forward camera remain unchanged.
Each corridor column still has a landing; ghosts share complete source geometry
and now cover the fog distance according to cell height. No distance LODs or
mesh simplification are introduced.

## Racing changes

- Perfect Balance is a roulette item, not a special crate. It gives six seconds
  of the existing perfect grind/manual balance, with the existing green timer.
  TNT, Nitro, banana traps, horn, water bombs and boomerangs leave this course's
  roulette. Other race pools keep their existing items. Seeded draws and the
  two-item no-repeat history remain deterministic.
- Frequent mystery pickups sit on actual rounded rails, forks, interchange
  mouths and recovery routes at both heights. They return after 1.5 seconds,
  allowing following riders to collect them. No extra platforms are added
  for the rail pickups.
- The race HUD again shows earned Special and its portrait ring. Special's
  trick-unlock behavior is unchanged. Its native meter was already earning;
  race-specific DOM and composited-HUD suppression had hidden it.
- All race levels, including kart races and time trials, have a numeric km/h
  speedometer. It reads actual horizontal displacement, excluding vertical
  falling and periodic wrap displacement.
- Only this race uses 55% of normal grind drift/noise. Countersteering and the
  failure boundary remain active. Manual/lip difficulty, global tuning and
  every other course retain their previous behavior.
- Club rivals sample stick corrections less precisely and hesitate more often.
  Their physics are identical to the human's. Native forward hopping recovers
  from a stalled platform rim even if the rider is moving sideways along it.

## Springs and traversal

The race has eighteen large Carlisle marine trampolines, distributed across
both heights and the corridor's width. The platformer has six. Each is 14 by
16 metres and reuses Carlisle's complete housing, elastic ropes, bounds and
impact response. The authored model is cached once per course and shared;
disposal releases the lease and presentation registrations.

Recessed backing gives the ropes space to sag. Launch velocities and forward
receivers match the shorter height differences. The lower-speed race springs
rise about 3.91 metres; platformer springs rise about 7.89 metres. Sloped
run-ins, kickers, stacked rotated halfpipes, foot-jump courts and collectibles
remain native level components.

## Validation and delivery

Compact evidence is saved in `race-items-height-evidence/`. This work is local
only, served at port 5248. No push, publication, shared level-pack replacement,
global tuning edit or primary-checkout source edit is part of this increment.

All eight racers finish in the fixed-seed native run (75.18–323.28 seconds),
without deaths or resets. The human fixture follows native steering inputs.
The seven club rivals finish in 104.97–323.28 seconds; these are not directly
comparable to old finish times because the course and balance difficulty changed.
All 608 race / 616 platformer landings remain connected. Coverage uses 56,497 /
52,577 XZ probes and 2,304 / 2,148 actual collider rays. Eighteen sampled misses
per course land within 1.22 / 1.84 seconds; explicit seam falls preserve momentum.

Fifty foot jumps, all 24 springs, three platformer kickers, both platformer
spine chains and checkpoint/crystal/finish pass. Perfect Balance is collected
through roulette, suppresses native drift for its duration and restores drift
on expiry. Easier race balance extends an identical no-input fixture from
1.42 to 2.18 seconds before bail. Global tuning stays unchanged.

Chrome lite and full/native review shows Special, the live balance timer,
759 mystery boxes and complete Carlisle spring housings. Ordinary skateboard
and kart races show the speedometer. Eight full-render fall cases retain the
character with fixed forward heading and no console errors. Required level
checks and production build pass; no full suite ran. Offline build:
`bf4bd7674c5250d2bbfb`. Prompt-to-validated-build: approximately 86 minutes,
including successive user changes during the iteration.
