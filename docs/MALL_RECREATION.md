# Mall · New York

The playable Mall now uses measured PS1-derived architecture instead of the earlier image-based reconstruction. Select **Mall · New York** in MENU, or open `/?playtest&level=mall`. Add `&lite` for the fast renderer. All files, previews and commits remain local under the slow-network workflow.

WASD/arrow keys steer; hold Space to build speed and release to ollie; E grinds. K/L move between the five checkpoints. M shows developer controls if MENU is hidden.

## Source and provenance

The supplied VGCartography cutaway and [original PS1 footage](https://www.youtube.com/watch?v=n0kosmzFb0A) establish the intended version. The geometry and static art come from [letmynutzgo’s public THPS Mall conversion](https://thpsx.com/creation-details/?obj=958), released 18 July 2018. Its readme credits the original PS1 level to Neversoft, extraction and nodes to letmynutzgo, and conversion scripting to TylerLasagna.

This is a converted PS1 source, not a byte-for-byte retail-disc verification. Its rail nodes and some gameplay details were authored during conversion. The altered cereal boxes, multiplayer nodes and gameplay helper objects are excluded. Third-party asset provenance is recorded in [the art README](../public/mall-reference/README.md); these game assets are not relicensed as Apache source code.

`tools/mall-reference-survey.py` reads bounded collision and literal node records without executing game scripts. `tools/mall-reference-art.py` independently reads SCN/TEX data and decodes the original DXT textures to PNG. The [THPS Blender importer](https://github.com/denetii/io_thps_scene) documents those formats. Archive, member and image hashes are retained in the source data. No executable game code or audio is included.

## Geometry and scale

[src/levels/mall-measured.ts](../src/levels/mall-measured.ts) retains all **8,650 referenced static collision control vertices**. The 9,826 original static triangles comprise 8,678 solid triangles and 1,148 pass-through/detail triangles. A single axis rotation, translation and uniform scale transforms the source coordinates into the fork’s Y-up world. Static vertices already contain world positions; their separate conversion node offsets must not be applied again.

The current provisional scale is **0.045 world metres per source unit**. It is calibrated to the existing visible rider, whose measured standing bounds are about 3.02 m tall. The earlier 0.025 trial passed collision tests but visibly cut through the arcade beams; the collision capsule alone was an inadequate scale reference. The full-render route now measures at least **0.36 m of head clearance** beneath the crossing beam. This establishes clearance for this rider and route, not the original game’s metric unit convention.

The source’s folded entrance, concourses, gallery, angled atrium, escalator, crossed arcade arches, courtyard quarters, canopies, pool, exit passage and parking retain their relative positions and elevations. The converted rail graph preserves **637 unique edges in 127 native paths**, including its closed loops and junctions. Every native rail control point matches its transformed source position within numerical precision.

The source marks only the upper parts of some quarters as VERT. Classification follows smooth connected faces down to their toes and across storage-sector seams, covering 379 source triangles. Three subdivision passes add tangent midpoints without moving the source control vertices. Shared vertical tangents keep straight wall extensions straight. Native contact follows its current mesh, so continuous quarters use overlapping spatial chunks with a 1.2 m halo. Chunk dimensions follow source scale; this keeps the source connections stable and the full level within existing editor limits. The final data has 2,309 components, 60,615 mesh vertices and 68,091 mesh triangles, occupying about 6.93 MB as JSON.

Original static scenery supplies 25 sectors, 208 meshes, 9,750 render triangles, 126 single-pass materials and 125 decoded textures. Native measured surfaces own collision; the original render meshes own appearance. The only shared Level change registers those textures and their unlit materials. Movement, tuning, camera implementation and rail physics are unchanged by this task. Course direction, a lower arcade camera view, five supported checkpoints and a finish gate are level data.

The native wall proxies omit buried spans at continuous floor joins. The first up-escalator previously tripped the board against the deck’s front face just before reaching the landing. The correction splits that proxy at measured floor edges and checks strict support on both sides; exposed deck sides and actual guardrails remain collidable. Source render and collision control vertices stay unchanged.

## Validation

Current evidence is saved in [validation.json](mall/validation.json), including hashes of the frozen runtime used while other chats edited the shared checkout.

The complete full-render route uses normal controller input from the source restart to the parking finish: **83.57 simulation seconds, no bail or death, at least 16.20 m/s after the entrance**. It completed in 83.47 wall-clock seconds at approximately 60 simulation steps per second. Source equality, unchanged tuning and zero console errors are checked. The main route uses the courtyard’s sloped takeoff before clearing its raised lip.

Focused native checks cover source control-point retention, 58 measured surface probes, supported spawn and five checkpoints, editor save/load, curved garden-skirt collision, both courtyard wall airs, and the atrium wall return. A separate data test checks three scales: transition and rail connectivity remain identical, and each version stays below the existing mesh and file-size caps. Rail section tests require the intended source path, a sustained grind and a clean exit, using ordinary controller samples after an initial supported placement.

Both escalators are checked uphill and downhill with ordinary input, no ollie and no in-run placement or speed edits. All four routes retain support across their landings; minimum seam speeds range from 9.45 to 21.00 m/s. The actual inner handrail on the first escalator is separately verified: source path 115, 24 grind frames, 4.50 m travelled and a clean landing back on the ramp. This is distinct from the adjacent display ledge checked in the previous pass.

The production build and required level checks are run locally. MENU selection, K/L warps and reserve-life pit recovery use the real browser. The full suite is not run. Shared runtime changes from other chats are pinned and identified in the evidence; they are excluded from the Mall-only commit.

![Measured arcade at normal gameplay camera](mall/measured-arcade.png)

## Reproduction

- `node tools/test-mall-measured-topology.mjs`
- `node tools/test-mall-measured-surfaces.mjs`
- `node tools/test-mall-measured-verts.mjs`
- `node tools/test-mall-measured-rails.mjs`
- `node tools/test-mall-measured-upper.mjs`
- `node tools/test-mall-measured.mjs`
- `node tools/mall-measured-browser.mjs <local-url> --full`
- `node tools/mall-measured-upper-browser.mjs <local-url>`
- `node tools/mall-smoke.mjs <local-url>`

Set `PLAYWRIGHT_MODULE` when Playwright is installed outside this repository. Use `npm run check:levels` and `npm run build` for the repository’s required checks. The old `mall-pilot.mjs`, `test-mall.mjs`, and their related route tools describe the superseded image-based level at commit `2508077121b87c2b606c515ac025556bd05f44af`; they are historical evidence, not tests of the measured replacement.

## Remaining fidelity work

The goal remains active. The Flying Leap/gallery transfer and the remaining alternate upper routes still need complete input-only traversal evidence. The escalators and one actual escalator handrail now pass isolated input-only checks. The current Flying Leap probe hits the outer gallery rail during descent; it is retained as a failed probe, not successful transfer evidence. Head clearance alone does not settle the final scale. The conversion’s rail graph needs further comparison with original PS1 gameplay. Original destructible directories, glass, box stacks, collectibles, sky and animated water are not fully reproduced; directories and glass are currently pass-through scenery. These limitations prevent calling the recreation a completed literal 1:1 match.
