# Forward spaghetti / periodic vertical corridor — 2 November 2026

Both source-owned Spaghetti Rails levels now use one authored vertical cell,
288 metres tall, repeated visually through fog. Crossing either vertical seam
rebases the rider, camera and render history together. Velocity, race time,
score, lives, pickups and checkpoints keep their state. Only the canonical cell
simulates collision and rewards; neighbouring cells share the native render
assets. Static geometry is batched by material and corridor section, without
simplifying meshes. Dynamic crate/enemy visibility follows the live source.

The race is six 140 m sections; the platformer uses six 96 m sections. Three
forward rail choices cross at different heights, between broad decision decks.
Every rounded rail advances along negative Z. Staggered catch terraces cover
the complete corridor, including seams between tiles, and continuous walls
keep falls inside that coverage. All routes converge on the supported finish.

Each course includes three optional kicker/receiver routes, two longitudinal
halfpipe sections, two descending three-pipe spine cascades, and two Carlisle
springs with elevated reward receivers. The cascades rotate the halfpipes 90°
across the direction of travel, share their lip stations and descend 7 m per
receiver. They use the existing native transfer: after the vert launch, press
and release Jump again while holding toward the next pipe. The platformer adds
five checkpoints, lower-terrace patrols, fruit, boxes and the finish crystal.

## Reproducible focused validation

- `node tools/test-spaghetti-infinite.mjs`: strict rail direction, source/editor
  validation, 661,218 half-metre coverage samples, ten real wrapped falls,
  supported spawns, preserved velocity/lives and unchanged movement tuning.
- `node tools/test-spaghetti-features.mjs`: both spring reward landings, three
  kicker landings, all four forward spine transfers and physical receivers,
  swept containment across the seam, checkpoint and crystal/finish behaviour.
- `node tools/test-spaghetti-rails.mjs --race`: eight production racers finish.
- `node tools/test-spaghetti-rails.mjs --miss`: one explicit fault placement
  below the course, then ordinary inputs recover through the seam and finish
  without a race reset. The injected failure is clearly separate from the
  input-only clean race evidence.
- `npm run check:interpolation`: includes periodic world rebasing while local
  skeletal animation and fractional render interpolation remain unchanged.
- `tools/test-spaghetti-editor.mjs`: live rail height/radius edits, rebuilt
  navigation, exact undo, TEST, and retention of the periodic level metadata.
- `tools/spaghetti-infinite-browser.mjs`: Chrome lite/full native-resolution
  play, seam camera/rider continuity, catch landings, build identity and console
  checks. Separate direct scene views inspect the tunnel looking up and down.
- Required `npm run check:levels`, production build and release-size gate.

The older `docs/spaghetti-rails/` geometry snapshots and validation remain
historical records. Authored user edits and the shared published level pack are
preserved. No `src/tuning.ts` changes and no full `check:all` run.

## Results

All eight racers finished in 37.28–40.75 seconds, using six authored rails each,
with no deaths or race resets. The clean solo pilot took 37.53 seconds; the same
pilot with one deliberately injected wrapped miss took 40.87 seconds, a 3.33 s
time penalty with its clock uninterrupted. Spring launches reached 23.91 m and
landed on both 22 m reward tiers. Both spine cascades recorded the actual native
pipe changes and physical landings on all three bowls.

Chrome full/native 1440×900 measured average/p95 frame times of 25.18/32.30 ms
for the eight-rider race and 16.80/18.00 ms for the platformer. Camera movement
at the seam was under one metre after removing the 288 m coordinate shift.
These local samples include the full existing character/render pipeline; they
are not a frame-rate promise for other hardware. All browser consoles were
clean, and the packaged platformer collected its crystal and entered the real
finished state. Editor height/radius edits changed both rail and navigation,
then exact undo restored both and TEST retained the loop metadata.

The combined production build passed at 803,483,131 bytes. Its local stamp is
`Codex/sol fork · build 11-02 01:28 UTC`; source validation is based on runtime
commit `94ffa727`, integrated over `81615d2c`. Publication has its own build stamp.
Compact reports and reviewed screenshots are in [evidence/](evidence/).
