# Castle Ghost Train — derelict baths

A 2,250-metre indoor dark ride with 28 chambers and eight chapters. The current
revision takes the haunted castle into a campy, abandoned bathhouse: green
steam and light spill, fluorescent graffiti, wet mosaic tile, water damage,
broken services, rubbish and failing neon. The full checkpoint-taking pilot
travels approximately 2.55 km in 439 seconds without a death.

Play `/?playtest&level=ghost-train`, or choose **Ghost Train** in **Hidden Shores**
from the Island Map or Level Select. The map branch goes down from The Bone
Yard. Its saved identity and immediate availability are unchanged. The map
thumbnail is captured from actual gameplay geometry.

## Play rhythm

- Twenty short collapsed-floor jumps replace long empty approaches. Nearby
  jumps can be linked with earned skating momentum.
- Four moving trains contain 16 real carriages. Their motion spans nine metres;
  compact transfers and marked arrival edges keep the moving targets readable.
- Three required broken-rail sections retain seven separate native grind
  segments. Two optional raised lines offer another route over the baths.
- Ten swinging axes and 15 mechanical food/armour enemies retain their native
  collision and combat behaviour. Enemies stand clear of jump receivers.
- Twenty-three checkpoints shorten retries. Recoverable masks and side boxes
  punctuate the route.
- The train/rail camera looks down far enough to see the next carriage interior.
  Deep decorative doorway arches no longer pass over the following camera.

The authored movement tuning is preserved. The pilot converts its requested
world direction through the same camera input frame the production player
uses; it does not move, teleport or retune the player to clear an obstacle.

## Art and assets

[Production artwork and film references](GHOST_TRAIN_REFERENCES.md) guide the
castle architecture and theatrical bathhouse colour. The original five Meshy
models and nine-model castle kit are joined by four new bathhouse props: tiled
panel, ruined facade, rubbish pile and steam boiler. The new kit totals 5,900
triangles and approximately 0.89 MB of GLBs. Its four geometry/texture pairs and
two corrective texture passes consumed 80 existing Meshy credits. Provenance,
exact prompts, UV preservation and placement notes are in
`tools/ghost-train-assets-v3`.

The generated facade is a closed alcove and is staged beside the route.
Native open masonry defines the actual passage. Runtime dressing includes
crooked retired carts, exposed pipes, shallow stagnant baths, torn tiles,
loose tickets, original spray-painted tags and damp streaks. Thin litter and
tile veneers use quads to stay within the existing import and geometry budgets.

`src/ghostAtmosphere.ts` owns a bounded pool of at most 128 drifting steam
billboards, original graffiti atlases and irregular neon flicker. Surface
emission and local halos make green eyes, carriage lamps and glass visible.
The existing three-spotlight pool supplies coloured light; distant scenery
and steam are culled. Haze sits mainly beside the aisle or below the broken
track, whose real ends have luminous markers.

World surface textures come from Meshy albedo sampled through the original
model UVs. Runtime dampness and stains are separate authored effects. The
ImageGen triptych in `docs/ghost-train-concepts/derelict-baths-v3.png` is a
concept mockup, not a gameplay screenshot. Its exact built-in-tool prompt is
saved beside it. The earlier three chamber concepts remain available.

## Validation

- `tools/test-ghost-train.mjs`: normalization, supported spawn/checkpoints,
  patrol support, actual moving-cart carry, checkpoint banking, pit death and
  respawn, and the native finish gate.
- `tools/test-ghost-train-articulation.mjs`: original Meshy triangles/UVs,
  independent robotic limbs, planted feet, real cart wheels, clockwork motion,
  bounded moving steam, culling and GPU resource disposal.
- `tools/ghost-train-pilot.mjs --journey`: uninterrupted production input from
  spawn through all 23 checkpoints and all eight chapters to the gate, with
  zero deaths. `--phases` covers the carts at three starting phases, required
  rail transfers, three axe timings and all 20 short jumps. `--bonus-only`
  exercises both optional grind routes.
- `tools/ghost-train-gameplay-browser.mjs`: actual full-render cart transfers,
  long crypt rail catches and an axe crossing, with no console errors.
- `tools/ghost-train-v3-browser.mjs`: real keyboard traversal of the opening,
  live steam motion, measured neon variation and frame timing. The local
  1280×720 sample averaged approximately 16.7 ms per frame.
- `tools/ghost-train-v2-browser.mjs`: real production cameras across all eight
  chapters, with supported fixtures and clear asset/texture readiness.

The required level checks and production build are run before publication;
no full suite is used. Current screenshots and machine-readable evidence are
in `docs/ghost-train-evidence/derelict-*`. The first playable rendered revision
was recorded approximately 44 minutes after the brief; traversal refinement,
compatibility checks and publication followed.
