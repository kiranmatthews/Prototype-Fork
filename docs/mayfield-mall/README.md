# Mayfield Mall — actual source-geometry revision

A roughly 2.23 km conventional course in Maynard Quay’s fourth slot, with ten
checkpoints, a crystal, a time-trial clock and one finish. The save key remains
`maynard-course-4`; the level and preview ID are `mayfield-mall`. It starts on
foot and uses the ordinary walking, jumping, boarding, braking and grinding
controls. No movement tuning or park controller is substituted.

This revision replaces the earlier 800 m interpretation after the user asked
for substantially more actual source geometry, particularly the Mall’s scale,
elevation changes, angles and architecture. The previous pass’s screenshots
and completion times do not describe this revision.

## The four source levels in the playable route

| Source | Actual geometry retained and rearranged |
| --- | --- |
| Mall | Three-storey parking entrance with both quarter pipes, upper galleria, fountain court, long descending escalators, mezzanines, crossrail arcade, angled atrium, great descent and suspended crossing. Original meshes, textures, rails and fitted wall contacts are transformed together. |
| School Miami | Complete gym with basketball floor, skylight roof, banks, rails and hoop quarter; long blue canopy and handicap descent; four complete picnic table/bench/rail clusters. |
| Warehouse | Full eased roll-in, original halfpipe with transfer banks and suspended room, Big Rail and kicker pair, taxi, box stacks, roof trusses and weathered wall bays. |
| Kona | Both spinal-groove minis, the complete timber vert and raised roll-in, original banked snake run and snake-head kiosk. |

The sequence is **Mall parking garage → upper Mall → School gym and canopy descent → Mall arcade →
Warehouse → Kona → angled Mall atrium and descent → exit**. Mall rooms are cut
at new door planes and reordered; the arcade now precedes the angled atrium.
The final atrium is rotated 15°. Source dimensions are mostly 90–115% of their
playable originals, preserving their architectural scale. The upper galleria
is 96% wide and 92% long, the arcade is 108% wide and 95% long, and the final
atrium is uniformly 95%. Warehouse’s roll-in is 205% wide and 115% in height and
length; its halfpipe is 105% and
turned 90°. Kona’s snake run is 95% and turned 90°.

The directory signs, school table clusters, warehouse kicker/rail/taxi/box
assemblies and Kona kiosk have new placements. New concourses, foundations,
portal openings and an outside return court connect these assemblies. Cream,
teal, mauve and coral signs and connective trim carry the Weekenders mall
hangout theme. No show imagery is included.

`MAYFIELD_SOURCE_PROVENANCE` records every imported assembly, source,
transform, cut and triangle count. The route tests require actual ground
contact with all four sources. Whole source triangles remain within the
selected assemblies, apart from intentional door-plane cuts; indexing and
batching retain the geometry at every viewing distance.

## Collision and movement fixes

- Source rails and wall paths rotate with their assemblies; mesh collision
  normals follow the transformed geometry. Original vert contact flags remain.
- The gym has an open second doorway. Connectors meet the actual lower lanes
  of the Mall arcade and final descent rather than their raised centre strips.
- The Kona minis and timber ramp are separated. Their open ends have continuous
  floor support, and the snake-run foundation has entrance and exit portals.
- In conventional controls, leaving an authored vert deck no longer snaps the
  rider metres down a nearly vertical face. The normal airborne/swept contact
  path catches the ramp. Original park controls and global tuning are unchanged.
- Ordinary platform edges retain their default grinding policy. New signs and
  trim are decorative; foundation and portal walls have fitted solid contact.

## Validation and ownership

### Complete circulation repair

The [circulation pass](flow/README.md) adds access to the retained upper decks,
terraces, pavilion, canopy, office and roof. It replaces narrow or incomplete
joins with fitted landings, opens full-width gym entrances, separates the Kona
snake from the mini-pipe approaches, and joins the angled exit to a complete
finish court. Its 2,228.82 m main route still starts in the three-storey garage.

Browser runs finish with all ten checkpoints and the crystal: **247.33 s on
foot without jumping**, and **153.30 s skating at MAX/native resolution**, both
with zero deaths and no console errors. Eighteen side routes are exercised
forward and backward, and nine joins are sampled in five lanes each way.
Current geometry, vert, bonus, recovery and release evidence is in `flow/`.

### After Hours bonus

The question-mark stone beside the Crossrail Arcade checkpoint opens **Bonus:
After Hours**. Jump onto it from the main lane. The roughly 100 m side-view detour has
eight counted crates: preserve the arrow for the high prize counter, operate
the service-bridge switch, then use the finite bounce stack before breaking it.
The backdrop retains 1,083 triangles from the original Mall galleria at full
scale, including its large escalator and mezzanine architecture.

Successful completion banks the crates, fruit and two life crates into the
same parent run and returns to supported arcade ground beyond the entrance.
A failed attempt returns without taking a parent life or adding a parent death,
and the stone remains available for another attempt. Ordinary bonus controls,
crate behavior, rewards and the existing suspended-parent system are reused.

`node tools/test-mayfield-bonus.mjs` checks the editor contract, both campaign
aliases, the 43.52 s input-only all-crate clear, actual jump entrance and supported
return. `node tools/mayfield-bonus-browser.mjs [URL]` exercises lite recovery,
real entrance, failed return, retry, full clear and reward banking with MAX/native
and normal rendering. Evidence is in `bonus/`; `MAYFIELD_BONUS_OUTPUT` selects
an external screenshot/report directory. No shared runtime behavior changed.

### Parking-garage opening

The start now occupies the actual source Mall entrance: three overlapping
storeys, both end quarter pipes, the long sloping return corridors, overhead
decks, rails and original wall architecture. The entrance contributes 171
source components and 12,047 mesh triangles, with 75 solid components. Its
96% width and 92% length match the adjacent galleria transform; vertical scale
is unchanged. Total course length is 2,163.87 m, with 71,035 imported mesh
triangles plus native primitives, paths, rails and connecting architecture.

The start is 36.25 m above the galleria. Ordered camera nodes follow both
reversals through the stacked corridors, and a new checkpoint marks the garage
exit. The route crosses the flat toes of the quarters with ordinary controls;
both vertical transitions also support a skate ascent, launch and return.
The source closed-glass barrier is removed at the entrance to the galleria.

Garage quarter normals now provide continuous contact. Exact side contacts
and fitted wall extensions seal the quarter/wall seams. The existing normal
controller crest launch also recognizes explicitly authored vert meshes with
the skate camera flag, fixing the vertical-lip sticking found on these quarters.
The change leaves park controls and movement tuning intact.

Evidence for the parking addition, before the later circulation repair, is in
[parking/](parking/README.md). Complete input-driven
runs finish in **244.18 s walking / 140.68 s skating**, collecting all ten
checkpoints and the crystal with zero deaths. Both garage quarters and all six
Warehouse/Kona approaches climb, launch and return without bailing. Both
garage side-wall seam probes stay contained.

Use `node tools/test-mayfield-parking.mjs` for the quarter/side-wall checks.
`node tools/mayfield-browser.mjs [URL] --parking --foot --native --recovery`
checks the opening, keyboard checkpoint warps and intentional pit recovery;
omit `--foot` for skating and `--native` for the fast lite renderer.

### Main course — initial source revision, before the garage addition

Recorded checks and screenshots in this directory cover the source editor
contract, campaign/save key, supported spawn and checkpoints, complete walking
and skating routes, six Warehouse/Kona transition approaches, real K/L
checkpoint controls, pit recovery, finish and browser console errors. The final
build report identifies the checked files and release size.

- Native input-only runs: **217.02 s walking / 119.88 s skating**, all nine
  checkpoints and the crystal, zero deaths.
- Packaged Chrome with full rendering: **216.85 s walking**, actual menu
  selection, all checkpoints/crystal/finish, zero deaths or console errors.
- MAX/native 1920×1080: all nine checkpoints, K/L and supported pit recovery.
- Six source ramp approaches: no bails; largest frame displacement **0.545 m**.
- Required level checks and production type-check/build passed. Release output:
  **997,270,749 / 1,000,000,000 bytes**. No geometry detail was reduced to fit.
- The composition contains **58,988 imported mesh triangles** plus original
  native primitives, paths, rails and the new connecting architecture.

Run `node tools/test-mayfield-mall.mjs` (optionally `--skate`),
`node tools/test-mayfield-transitions.mjs`, and
`node tools/mayfield-browser.mjs [URL]` with `--full --foot --menu` or
`--native --tour`. Browser checks accept `PLAYWRIGHT_MODULE` and
`MAYFIELD_OUTPUT`.

Geometry lives in `src/levels/mayfield-mall.ts` and `mayfield-source.ts`.
The shared changes are the existing builtin registration, course-slot name,
preview and time target, and the narrow authored-vert contact correction in
`src/player.ts`. All four original levels and `src/tuning.ts` are unchanged.
The builtin remains directly editable/exportable/restorable. It is source
owned; `public/levels.json` is not replaced or duplicated.
