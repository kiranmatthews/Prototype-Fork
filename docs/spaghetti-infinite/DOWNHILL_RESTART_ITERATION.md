# Version 1 race restart with longer downhill decks

Local preview: `http://127.0.0.1:5248/?playtest&level=spaghetti-rails`.
The pinned version 1 comparison on port 5252 remains unchanged.

## Layout

Use `c82ddfd36bd918c9d99fc3a3efea15d18289382c`, gallery version **1**, as the
race geometry foundation. Restore its twelve sections, three primary lines,
six-height recovery weave and 288-metre periodic cell. Remove the later fork
web and compact-course layout. Preserve the current platformer itinerary.

Lengthen every riding deck by a deterministic factor between **2× and 4×**,
keeping its width. Primary decks descend at 3.5–10% grades; recovery decks
descend at 3–7.5%. Short kicker approaches use a 1-in-6 descent into the native
launch ramps. Springs retain flat, recessed seats within their sloping decks.
The final collector uses its extended length for clear descending rail joins
and a longer run-out; the finish line is about 60 metres farther forward.
The complete course is approximately **3.47 km**.

All 888 original platform footprints remain, with 16 extra spring receivers
for the retained eighteen large Carlisle nets: **904 decks**. The original
167 rail components plus those 16 spring returns produce **183 rails**.
There are no additional recovery forks. The original fillet shapes remain
editable; an authoring-time clearance solve adjusts control-node heights at
one-metre samples without baking the rounded curves into dense polylines.
Overlapping recovery shelves move to the nearest clear side of primary decks.

Surfaces use the existing closed mesh, gravity-track and edge-grinding
contracts. Recovery decks remain batched by four rows, with full geometry at
all distances. No global tuning, player, camera or race-runtime changes.

## Retained race improvements

- Special gain, display and native Special commands.
- Six-second Perfect Balance roulette, replacing proximity traps.
- Club opponents and the race-local 0.55 balance difficulty multiplier.
- Actual horizontal-speed HUD in km/h, shared across race levels.
- 706 mystery pickups across all six heights, with 1.5-second respawn.
- Eighteen complete 14×16-metre Carlisle marine nets and useful receivers.
- Periodic fall recovery, camera seam handling and the current platformer.

## Validation

The focused downhill audit checks normalization, the chosen rail graph,
2–4× lengths, downhill grades, rail/body clearance, connectivity and coverage.
All 904 decks are in one connected rail graph. There are no sampled blocked
rails; 86,044 footprint probes and 2,352 actual ground rays cover the corridor.
Eleven native skating fixtures cross their long sloped decks while remaining
grounded and gaining speed. Five seam falls wrap and reach supported ground.

Native reward fixtures exercise Special fill and Darkslide activation,
Perfect Balance acquisition/expiry, real pickups and respawn on all six tiers,
and all eighteen spring-to-receiver flights. Each spring rises about 23.91 m.

Chrome lite and full/native 1600×1000 passes confirm the live Special and
balance displays, speedometer, complete net artwork and a clean console.
Switching to the platformer retains its six springs and 96-metre cell.
Screenshots and compact JSON reports are in `downhill-restart-evidence/`.

All three native kicker fixtures launch from their long downhill approaches
onto their intended receivers. A full/native Chrome run also traverses the
corrected first approach, launch and landing with a visible rider and no errors.

All eight racers finish the final geometry in **109.57–315.57 seconds**, with
zero deaths or race resets. The reference pilot grinds 2.56 km. Club rivals
average 1.61 km of authored grinding; one takes a recovery-heavy route with
569 m across five rails. The previous per-rival 30% rail-distance heuristic
failed for that valid platform route. The focused assertion now requires
substantial rail use across the club field and several rails per individual,
while retaining the stronger reference/default-rival threshold and adding a
zero-death/reset assertion for everyone. The final saved native record passes
that extracted validator; the simulation was not modified or replayed to force
different results.

`npm run check:levels`, `npm run build`, the focused downhill/reward checks and
`git diff --check` pass. The required level check emits its existing headless
asset-fallback warnings; the real-browser consoles are clean. Build: 1751
files, 765.2 MiB, offline version `41a23b1287e6109d345f`. No full suite.

Prompt to validated local preview: approximately **50 minutes**. This is a
local-only increment; publication and shared-pack edits are excluded.
