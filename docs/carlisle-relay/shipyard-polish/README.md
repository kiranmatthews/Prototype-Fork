# Carlisle Coast — shipyard polish basis

Local review: <http://127.0.0.1:5483/docs/carlisle-relay/shipyard-polish/index.html>

The approved direction is an Outer Banks working harbour at early night: dark navy ocean and sky, navy painted steel, burnt-orange marine nets and machinery, weathered timber, and small orange lamps. Yellow hazard-striping and the earlier sunny wash are superseded. Broad, exaggerated platformer silhouettes keep machinery legible from the bounce camera.

## Deliverables and provenance

- `screenshots/`: 20 native 1920 × 1080 captures of the authored greybox, covering all 18 course sections and two views of the boat bonus. `captures.json` records cameras, source commit, positions and console checks.
- `concepts/`: the 20 current screenshot-based imagegen paintovers. `concepts.json` records exact prompts and original generated files. Revision 1's six daylight concepts remain in `superseded-daylight/` for provenance and are excluded from the gallery.
- `props/`: 12 isolated imagegen references; `props.json` records prompts, intended uses and triangle budgets.
- `../../../art/carlisle-shipyard/`: textured Tripo GLBs, generation records, actual credit ledger, procedural net source, fitted net assembly, and the local 3D workshop. The model manifest records actual triangles, embedded texture dimensions and model bounds.
- `gallery-qa.json` and `build-qa.json`: browser and production-build evidence. Native front/back mesh captures and viewer checks live in the art library's `review/` folder.

These are authoring assets for the next polish pass. They are not added to the game's shipped asset pack or collision geometry. The greybox remains the exact authority for gaps, route, height, grinding, bounce physics and camera behaviour. Paintovers may suggest scenery beyond the route, but do not authorize filling a required gap or moving a landing.

## Three-act visual structure

| Area | Metres | Distinctive art treatment | Main kit pieces |
| --- | ---: | --- | --- |
| Foam steps | 0–180 | Receiving quay; first linked net berths | Net housing, boathouse, piles, lanterns |
| Scissor groyne | 180–390 | Long crossing cargo booms above open water | Crane, rotary hub, piles |
| Lift and skip | 390–605 | Boat-lift slipway and staggered net cradles | Hoist, net housing, skiff |
| Surf sockets | 605–825 | Modular pontoon pockets and separated net basins | Net housing, piles, lanterns |
| Twin winches | 825–1040 | Two huge opposed drums driving moving decks | Winch, cable spool, hoist |
| Beacon chimney | 1040–1280 | A tall beacon with a readable vertical net ladder | Beacon, net housing, crane |
| Tide dial | 1280–1510 | Circular dry-dock turntable and pump machinery | Rotary hub, pump, winch |
| Pinwheel handoffs | 1510–1745 | Opposing rotating gantries with moving ends | Rotary hub, crane, net housing |
| Dredger terraces | 1745–1980 | Stepped maintenance terraces and large sea pipes | Pump, hoist, piles |
| Cross thread springs | 1980–2220 | Cross-water deck transfers over narrow shipping lanes | Net housing, crane, skiff |
| Counterweight stacks | 2220–2460 | Heavy sliding ballast and ship-lift framing | Hoist, winch, spool |
| Harbour scissors | 2460–2700 | Swingbridges and interleaved loading arms | Rotary hub, crane, piles |
| Storm fingers | 2700–2910 | Exposed breakwater fingers with open diagonal leaps | Piles, lantern, net housing |
| Helical turbine | 2910–3130 | A twisting maintenance structure with radial decks | Rotary hub, pump, crane |
| Pendulum pier | 3130–3350 | Suspended work platforms beneath pendulum cranes | Crane, hoist, net housing |
| Rigging slingshot | 3350–3570 | Nets launching into sparse high grind cables | Net housing, winch, spool |
| Broken crown | 3570–3790 | Fragmented crane tops and exposed cable transfers | Crane, spool, beacon |
| Homecoming cable | 3790–4000 | Long tow-cable descent into the finish quay | Winch, beacon, boathouse |
| Springtide Skippers | Bonus | Small nets, shallow skiffs and moving flat ferry decks | Skiff, net housing, piles, lantern |
| Spring skiff close view | Bonus | Smaller-scale net fittings and the homeward ferry | Skiff, net housing, piles |

Act I establishes a sheltered working boatyard. Act II exposes larger, legible industrial mechanisms. Act III thins the built scenery around the route so the long airborne transfers and mandatory grinds read clearly over dark water.

## Integration constraints for the polish pass

1. Retain the existing collider and platform motion for every playable surface. Dress around it with visual-only meshes. Test the full platform sweep so cranes, ropes and railings cannot intrude into a landing or grind line.
2. Keep dark ocean beneath the route. Piles may support a deck visually; large solid scenery must not fill mandatory water gaps, especially in the final three sections.
3. Ordinary road and platform edges continue to grind. A decorative beam or net frame does not change that policy.
4. The skiff's open flat deck is the landing surface. Fit its hull below the existing moving platform and use the current platform motion; do not add boat bobbing to the collider in this art pass.
5. Tripo's automatic metre estimates are starting points, not authored gameplay dimensions. Inspect `models.json` bounds, orient each mesh, then fit visual geometry to the existing surface. Keep the original GLBs intact.
6. The generated machinery is a rigid textured prop. Whole-object mounting motion is available; independently turning drums, gears or booms requires deliberate local part separation in the future polish pass.
7. Lanterns and beacon windows include painted lighting in their textures. Add actual emissive/window lights deliberately during environment integration; the generated GLBs do not supply a lighting system.
8. Use the complete geometry at every viewing distance. No camera-distance mesh replacements or silhouette-reducing swaps were introduced.

## Reproducing this authoring work

`tools/carlisle-shipyard-capture.mjs` captures the source course through the game's local developer API. `tools/carlisle-shipyard-tripo.mjs --dry-run` validates the paid batch without submitting it. Generation is explicitly one asset at a time, followed by preview review; completed result records prevent accidental duplicate submission. `tools/carlisle-shipyard-review.mjs` runs the focused gallery/3D review and exports the two procedural-net GLBs. Run the browser tool through the shared heavy-job lease; use `--gallery-only` for gallery changes. `tools/carlisle-shipyard-index.mjs` validates GLB headers, finite geometry, triangle budgets, embedded PBR textures and bounds, and produces the manifest and billed ledger.

The user authorized generation and upload/download, up to 3,000 credits, then specified existing API balance first and existing Max plan credits for any further work. No purchase of additional API usage is authorized. The planned twelve P1 image-to-model calls total 600 credits; actual billed usage is recorded in the art library's ledger.
