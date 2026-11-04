# Branching rail choices — local preview

The approved long courses keep their distinct layouts, lengths and platform
counts: 888 racing islands and 608 platforming islands, including recovery.
This iteration adds choices on 30 primary platforms in each course and on
many recovery islands. It does not reduce either course to 30 platforms.

## Route design

- Racing: 129 optional fork rails, connecting 96 junction platforms. Interchanges
  alternate direct lane changes, shallow descents and steeper drops to lower
  recovery threads. The existing 36 competitive lines remain available.
- Platforming: 99 optional fork rails, connecting 84 junction platforms. Jump
  courts retain their open centres; left-hand mouths lead to lower threads or
  cargo balconies. Three balconies now hold five-box caches.
- Recovery: three interleaved forward threads per height replace the short,
  sideways-heavy zigzags. Forks offer level express lines, one-tier descents or
  two different downhill grades. Ten-metre straight platform approaches give
  native grind capture enough distance at span junctions.
- Six existing kicker approaches become closed sloping meshes. Each loses
  four metres over fourteen metres, using native gravity to earn speed. The
  platforming kickers sit farther forward so their entry rails are useful
  diagonals. No platforms are added to fill the gaps.
- Small departure arrows distinguish level, shallow and steep routes. The
  two platforming spine chains move into a clear transfer lane. Their existing
  three halfpipes and ordinary forward spine-transfer controls are retained.

All new forks and the revised recovery/jump-stitch rails keep a forward
component, with no 90-degree lateral traverse. The six recovery heights and
complete X/Z fall coverage are preserved. Rail mouths remain selectable on
supported platforms; extra rails do not replace the foot-jump takeoffs.

## Runtime scope

The periodic-course rival pilot changes only its control inputs. Slow recovery catches now charge
and release an actual ollie instead of holding Jump released forever. A rider
rolling up at a small landing rim uses ordinary backward recovery and Jump
input to regain support. The pilot builds speed before steering onto a nearby
rail. No player movement, tuning, camera or vertical-loop physics changes.

Rendering uses smaller Y/Z groups for periodic neighbour meshes. Complete
triangles and all attributes are partitioned without decimation or changed
silhouettes. Native-resolution review submits 40–53% fewer triangles than the
initial branching version, at the cost of additional small draw groups.
The source meshes and physics remain unchanged. A focused test verifies exact
triangle/UV/normal/normalized-color preservation across all six neighbours.

## Validation

- All 180 junction platforms have at least two physical forward departures;
  60 are on the primary routes. There are 55 level express forks and 173
  downhill alternatives, including 35 junctions with different descent grades.
- Thirty-five sampled native fork rides finish without deaths. All twelve
  recovery-height/span handoffs catch the next rail and reach its landing.
- All fifty foot jumps pass. Both springs, all three platforming downhill
  kicker jumps, both pairs of forward spine transfers, checkpoint, crystal
  and finish pass with ordinary input. The six sloped run-ins accelerate a
  12 m/s entry to approximately 20.58 m/s before the kicker.
- All 1,496 islands remain connected. 136,808 X/Z coverage samples and 5,592
  actual collision rays find support. Ten deep falls wrap and land safely.
- Eight racers finish in 112.40–383.48 seconds with zero deaths or resets.
  Each records more than half the course length on native authored grind
  paths. Validation measures rail travel instead of requiring one distinct
  rail component per stage; the longer recovery spans legitimately skip them.
- Chrome lite and full/native review checks both courses, eight fall cases,
  visible rider bounds, unchanged forward yaw, and clean browser consoles.
- `npm run check:levels`, `npm run build`, the focused render partition test,
  and the focused gameplay checks pass. No full suite ran. Final offline
  build: `b147751e2b21ab7186aa`.

Prompt to validated local preview: approximately **43 minutes**. Evidence is in
[fork-evidence](fork-evidence/). The first run exposed five obstructed foot
launch points, a spine/shelf interaction, short rail handoff tangents and
stalled rival recovery inputs; each was repaired and the affected checks
rerun. No movement tuning, camera behaviour or shared published pack changed.

Kept local on port 5248 at the user's request. No push or publication.
