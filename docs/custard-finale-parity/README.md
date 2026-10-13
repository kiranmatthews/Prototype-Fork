# Custard Creek — closer to the approved pool matte

The second 3D pass keeps the original playable route and develops the
approved compact pool composition: taller weathered left-bank bluffs, a
lower wooded bend, connected foliage masses, clear jade water, visible
shoreline/submerged stones and a narrow animated foam edge.

Three additional Meshy models use original built-in ImageGen references:

| Asset | Near / far triangles | Web bytes | Prompt |
| --- | --- | --- | --- |
| `public/custard-creek/eroded-cliff.glb` | 10,239 / 1,800 | 1,699,232 | `tools/custard-assets/eroded-cliff-prompt.json` |
| `public/custard-creek/shore-rocks.glb` | 4,572 / 1,371 | 1,460,884 | `tools/custard-assets/shore-rocks-prompt.json` |
| `public/custard-creek/bank-shrub.glb` | 5,996 / 1,798 | 1,987,776 | `tools/custard-assets/bank-shrub-prompt.json` |

This pass consumed **45 credits**, bringing the finale work to **75 / 150**
approved Meshy credits. Original source geometry and UVs are retained, with
shared 2K albedo, 1K normal maps and reduced distant meshes. References and
operation ledgers are retained alongside the prompts.

`tools/custard-assets/measure-finale.mjs` measures the actual imported rock
triangles. It seats the trees and shrubs, records 49 shoreline cross-sections
and builds the waterline foam. Foam contours use at most 9 cm simplification
error; the solid rock geometry is unchanged. Flat water uses boundary strips,
and the bed retains its extra near-shore profile samples. Backing banks stay
closed and sit behind the detailed rock faces.

The pool now renders actual scene reflections in a 512 px target, with moving
fragment normals, depth colour, underwater caustics and animated contact foam.
Reflection captures borrow the existing distant meshes and restore the main
view's full detail, visibility, viewport, render target, XR and shadow state.
Lite mode omits the extra pass. Golden key light, green bounce and clearer
haze fade in around the finale; level exit restores the original fog.

Validation:

- `npm run check:levels` and `npm run build` pass.
- `test-custard-pool.mjs` covers reflection state, paused reuse, camera movement,
  failure cleanup, disposal, lite fallback and restored lighting/fog.
- The scenery tests cover successful, failed and nested reflection LOD captures.
- `test-custard-storyboard.mjs` completes the original 18-box bonus and eight
  main-course water-death probes, including two in the new pool. Each pool
  probe sinks from −28 to −30.72 and respawns with one death.
- The bank still ends at station 2438, before the crest at 2445. All original
  gameplay/non-finale components and other published levels are unchanged.
- Cached, explicitly non-colliding scenery instances are budgeted for their
  fixed bounds/transform work. Procedural/colliding decorations and all hard
  component, mesh and generated-work limits retain their guards.
- Lite mode reaches the actual Custard Creek course-clear screen.
- Three browser resource cycles return to exactly 136 geometries, 106 textures
  and 80 programs. No mist or finale matte is present.

The desktop moving-camera benchmark at 1280 × 720 measured 16.7 ms median and
17.5 ms p95 in the final build (baseline without capture: 16.7 /
17.9 ms). Reflection geometry fell from 1,118,397 to 385,403 triangles. These
are measurements from this desktop, not a mobile performance claim.

`before.jpg` is the previous 3D pass. `after.jpg` and the side views show this
revision in the normal renderer. `verification.json`, `roots.json`, `foam.json`,
`reflection.json`, performance reports and `resources.json` contain the audit
results. The approved source matte remains `waterfall-pool-v4.webp`.
