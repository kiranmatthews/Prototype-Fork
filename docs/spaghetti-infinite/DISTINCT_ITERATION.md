# Distinct local spaghetti courses — 2 November 2026

Local preview only, as requested. The published pack and deployment are untouched.

- Race: `http://127.0.0.1:5248/?playtest&level=spaghetti-rails`
- Platformer: `http://127.0.0.1:5248/?playtest&level=spaghetti-rails-platforming`

## Design

The old common six-section generator is replaced with two independent course
modules. They share the periodic-space and recovery contract, not their routes.

The race runs 3.41 km, with twelve 220–320 m speed sections and thirty-six main
rail alternatives. Long sweepers, over/under crossings, chicanes, speed strips,
item choices, two banking bowls, kickers and a rotated spine sequence favour
momentum and overtaking. Main interchanges are generally three separate 16×24 m
islands; four large platforms include the start, two shared interchanges and
finish. The teal iron cavern and lane markings distinguish the speed route.

The platformer runs about 2.1 km through ten named chapters. Fifty foot jumps
follow individually authored lateral and height patterns on small 12×14 m
chamfered landings. There are three moving ferries, three crumbling ledges,
guarded landings, box balconies, nine checkpoints, two Carlisle springs, three
kickers and two three-part spine transfers. Boarding is optional; foot jump,
double jump, spin and deliberate rail transfers each have a purpose. Amber
lanterns, gold landing marks and a plum cavern identify the reward route.

Six recovery strata sit at −120, −72, −24, 24, 72 and 120 m. The 48 m interval
continues unchanged through the −144/144 m seam: the old empty upper and lower
bands are gone. Six staggered columns partition every longitudinal slice, so
there is actual landing coverage throughout the 96 m corridor. Same-height
neighbours are generally 40–84 m apart; their rails weave between them. Height
exchange rails are distributed along the course instead of crowded at spawn.

Average platform area is about 404 m² in the race and 376 m² in the platformer,
including the complete recovery field. Those are approximately 15% and 24%
smaller than the preceding iteration. Most primary platforming landings are
168 m². The protected full-coverage requirement accounts for the remaining
recovery area; spreading it through all six heights makes each local view sparser.

Recovery cuboids retain their exact closed geometry, collision and grindable
edges. Four rows share a native mesh/BVH, and rails are split into connected
local spans. This bounds queries and reduces scene objects without substituting
simplified meshes. The existing periodic rendering and camera safeguards stay
in place. Rival pilots now use the actual recovery rails on either side of a
wrap and build rolling speed before recatching a slow flat rail. Player tuning
and physics are unchanged.

## Validation

Focused source and real-player checks cover:

- 888 race islands and 608 platformer islands in connected native rail graphs;
  136,808 coverage samples and 5,592 actual ground-collider ray probes.
- All fifty deliberate foot jumps, using normal charged jump/double-jump and
  spin input after a local initial placement; this is not a claim of a complete
  platformer playthrough without fixtures.
- Two Carlisle spring reward landings, three kicker receivers, both pairs of
  forward spine transfers, corridor containment, checkpoint and crystal/finish.
- Twelve native recovery rides, one per tier in each course, crossing local
  rail-span junctions with ordinary balancing input and no mid-run placement.
- An eight-rider race using production controls: 112.40–344.65 seconds, with
  every rider finishing and no deaths or race resets. Recovery costs time.
- Chrome lite and full/native fall/landing camera probes, with no occluded body
  centres, no out-of-frame riders, no heading takeovers and no console errors.
- Full/native gameplay views and editor overview inspection of the final layouts.

Compact evidence is in [distinct-evidence](distinct-evidence/). Required level
checks and the production build are recorded in the local handoff and iteration
log. No full suite or deployment is part of this local iteration.

Reviewed native-resolution views: [race](distinct-evidence/race-route.png),
[platformer](distinct-evidence/platformer-route.png), and
[vertical distribution](distinct-evidence/platformer-overview.png).
