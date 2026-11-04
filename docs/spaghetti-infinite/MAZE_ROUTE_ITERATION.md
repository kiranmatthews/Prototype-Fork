# Lanternworks: an itinerary through the existing maze

Local iteration, 2–3 November 2026. This replaces the straight stepping-stone
box route from `149073f8`. The race remains at its previously approved layout.

The original 616-platform maze is restored, including its six evenly spaced
recovery tiers, small jump courts, ferries, crumbling ledges, kickers and spine
transfers. The extra corridor platforms and relocated recovery shelves are gone.
A 95-stop itinerary uses that architecture: 43 foot jumps, 44 marked rail legs,
six mandatory marine-net launches and the supported arrival walk. It includes
75 forward, ten backward and nine predominantly sideways legs. All 110 ordinary
crates, ten checkpoints and the crystal lie on this marked route. Fruit marks
the travel line; small amber arrows survive collection.

Six excursions leave a jump court, descend into the lower maze, bounce back
through several floors, ride an existing upper weave (often backwards), then
return to the court. The route visits recovery shelves at -40, -24, -8, 8, 24
and 40 metres. Three ordinary connecting rails per excursion provide the
missing links. Their separate boarding mouths avoid catching competing rails.
An authoring-time visibility graph keeps these spans clear of platform
undersides; gameplay uses the resulting native rails. No new platform surface
or movement tuning was introduced.

The trampolines use the complete Carlisle marine housing and elastic net.
Five held-Jump launches rise about 78 metres; the top-storey launch rises about
85 metres. All six reach existing receivers directly, with no wrap required.
The lower weave passes around the nets' rims instead of cutting through them.

An ordered, smoothed 3D camera lane follows the itinerary. Carlisle's launch
camera is enabled specifically for this looping platformer. Its persistent
anchors rebase across the periodic seam in both camera slots. Spring air keeps
its takeoff control frame so crossing another branch cannot turn the player's
inputs mid-flight. Supported recovery releases a stale branch selection. The
race retains its forward camera and existing settings.

## Verification

- Native production Player: all 43 marked foot jumps, 44 rail legs and six
  spring transfers pass. Fixtures use ordinary movement, jump, grind and
  balance inputs after initial placement; this is per-leg evidence, not an
  uninterrupted all-box playthrough.
- Every marked rail passes the body-clearance audit. All 120 crate/checkpoint
  positions have physical ground support, and all 616 platforms remain in one
  connected rail network. Native movement/spin contacts collect all 110 crates
  at 94 stops; checkpoint, crystal and finish triggers pass.
- 52,577 X/Z coverage checks and 2,148 collider rays retain complete fall
  recovery. The sampled platformer misses land within 1.84 seconds. Race
  coverage and periodic behaviour also pass unchanged.
- Chrome lite and full/native: authored-turn views, all six spring transfers,
  deep-wrap and obstructed-fall framing; no console errors. Native/MAX and
  normal presentation screenshots are retained. Apex screenshots pause only
  the visual review at the measured apex; traversal then resumes normally.
- Launch-camera rebasing retains identical framing, orientation and blend
  weight across the 96-metre seam.
- `npm run check:levels`, `npm run build`, and `git diff --check` pass.
  Build: 1,751 files, 765.2 MiB; offline version `611f8ff41c0e611964f4`.

Prompt to validated local preview: approximately **70 minutes**.

The native contact and browser reports are in `maze-route-evidence/`.
The level remains local at
`http://127.0.0.1:5248/?playtest&level=spaghetti-rails-platforming`.
No push, public level-pack change or deployment is part of this iteration.
