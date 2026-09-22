# Enemy roster replacement

The complete eight-kind roster now uses new Meshy surfaces generated from
original built-in imagegen designs. The existing enemy identities, patrol
speeds, attack windows, collision boxes, checkpoints and movement tuning remain
intact. All level builders and editor-authored enemy components use the shared
replacement adapter.

| Kind | Model | Motion |
| --- | --- | --- |
| grunt | Coral Crab | Meshy-derived four-beat walk, head/claw follow, elastic defeat |
| spiker | Bristleback | Meshy-derived walk, tail follow, clear top spikes |
| turtle | Mossback | Meshy-derived walk, protected smooth shell, repaired inner sockets |
| charger | Russet Bull | Meshy-derived walk, anticipation, fast charge, finite recovery |
| hopper | Spring Frog | Weighted crouch, takeoff, flight, landing and rebound |
| floater | Violet Watcher | Independent rotor, hover, swoop and body tilt |
| sentry | Ember Sentry | Stationary base, aiming bearing, glowing charge lens, recoil |
| spinner | Brass Whirler | Rotating hub and four retracting blades with safe inset bounds |

## Production and provenance

References and exact built-in imagegen prompts are in `tools/enemies/references/`,
`design-prompts.json` and `designs.json`. The eight Meshy T2 image-to-3D jobs all
succeeded; `tasks.json` records their IDs, hashes and actual consumption. Model
generation used **120 credits**. The account balance was verified at **1,571**
after production; the user had explicitly authorized use of the available
account credits as needed.

The Meshy public rigging API describes humanoids. Its web quadruped flow was
attempted, but browser export encountered a denied third-party tracking request.
That request was not retried or bypassed. Instead, the final walking motion came
from an existing user-owned Meshy quadruped export already in Downloads.
`motion-sources.json` records its archive and Walking FBX hashes. The original
60fps, one-second four-beat foot paths were retargeted with model-specific IK,
flat stance soles, original footfall timing, a centered walking stance and
measured stride speed. These are custom skins carrying genuine Meshy-derived
motion, not untouched Meshy auto-rigs or a generic sine gait.

Final shipping files and source links are inventoried in
`public/enemies/manifest.json`. Each model is below 1 MiB and 10,000 triangles.
The four mechanical/custom assets use compact atlases and explicit pivots or
weighted joints. The bull's redundant overlapping source wraps were removed,
its soft tail shortened, and original corner normals retained. Only its soft
tail has a documented small collision-envelope overhang. The turtle's internal
lining closes source leg-socket cavities exposed by its walk.

Raw provider responses, original GLBs, FBXs and authoring renders stay in ignored
`.img2threejs/enemies/`. No credentials or signed provider URLs are shipped.

## Runtime

`src/enemies/runtime.ts` owns cached loading, independent skeleton/material
instances, source walk playback, custom poses and disposal. Level readiness waits
for enemy assets. Retired levels cannot receive late model attachments; the
last owner releases textures, image bitmaps and geometry. Hidden defeated foes
stop updating their rigs.

Species profiles in `src/enemies/elasticity.ts` use the shared editable character
amplitudes. Deformation acts on individual segments, preserves planted foot
positions and sole orientation, and settles finitely on defeat. Source contact
intervals preserve the four-beat walk. A 0.12-second blend settles walkers into
standing/anticipation poses; defeat and reset cancel that blend. Gameplay roots
are not scaled by animation. Sentry shots originate at the live barrel tip.

## Validation

- `npm run check:enemies`: all eight actual GLBs, semantic nodes, skin weights,
  real walk deformation, texture/triangle budgets, provenance, collision fit,
  spinner sweeps, async ownership, source contacts, finite blends, death/reset,
  all eight combat identities and actual Player collision behavior.
- `node tools/test-meshy-walk-retarget.mjs`: 61 actual skin poses per walker,
  source footfall timing, flat stance feet, floor clearance and exact loop seams.
  This authoring check also requires the local sampled-motion reports.
- Character elasticity, world-map locomotion, mobile residency, idle ropes,
  audio loops, stability reporting, Jungle Cup UI and offline regression checks.
- Browser motion review at `/tools/enemies/motion-review.html` provides front,
  quarter, side and back views, complete cycles, isolated states and frame scrub.
- The isolated port-5291 gameplay harness runs the actual game with real keyboard
  input and engine callbacks. Lite and full-render checks load all eight models.
  Observed crab/spiker spin defeats, turtle stomp, checkpoint activation,
  kill-plane death and respawn at the checkpoint, and the actual finish/results
  transition. The direct game page reports no console errors.

The production build passes in an isolated checkout containing only task-owned
changes. The existing `origin/main` GitHub Pages workflow publishes the result.
No full test suite was requested or run.
