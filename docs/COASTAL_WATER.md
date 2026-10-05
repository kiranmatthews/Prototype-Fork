# Coastal water

The shared ocean now has rolling swells, shoaling crests, moving whitewater,
backwash, and a wet sand transition. It retains the fork's MatrixRex textures,
authored turquoise/blue palettes, reflection/refraction passes, caustics, sky,
and CRT presentation. Sheltered pools and the wreck's moonpool retain their
own colours and use smaller waves.

The reference was [Tidewater](https://github.com/dgreenheck/tidewater), especially
[ShoreWaves](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/ShoreWaves.js)
and [WaterMaterial](https://github.com/dgreenheck/tidewater/blob/main/src/ocean/WaterMaterial.js).
The useful cues are depth-limited shoaling, fronts that slow near land, broken
foam behind a crest, and faster uprush followed by longer drainage. Our
implementation approximates those cues analytically. It does not import
Tidewater's engine, FFT, compute simulations, assets, or shader composition.

## Runtime

- `src/coastalSurf.ts` contains four fixed swell bands and one surf profile,
  with GLSL and CPU counterparts. Horizontal displacement is limited by wave
  amplitude, preventing the old nearly flat surface from sliding metres sideways.
- `UnityOcean.setShoreGeometry` intersects authored meshes with the waterline
  once and builds a half-float signed-distance/direction/seabed-depth texture. Local
  contour distance bends the surf around islands and course turns. Spatial
  bins and a 32 m influence limit bound the search; each texture axis is capped
  at 1024 samples. There is no additional scene pass or per-frame mesh search.
- The same field gives lite rendering shallow colour and shoreline foam when
  depth/refraction passes are disabled. Full rendering keeps the existing
  screen-space depth/refraction path. Both qualities use the same CPU surface
  sampler, including displacement inversion and the thin beach swash film.
- Sand and authored foam accents share the ocean's clock and surf parameters.
  The map retains its original sand/rock blends and shoreline outline controls.
- The map's visual seabed shelves sit deep enough for the swell troughs. Far
  ocean fill uses the same wave bands and camera-distance haze, including the
  sea beneath the original Slipstream course.
- `materialStyle: "water"` is the editor-persistent, non-solid sheltered-water
  material. Rectangles receive a bounded grid; other outlines receive triangle
  subdivision without changing their footprint. Known old published water
  components migrate to the tag, including the creek ribbon when present.
  Water material selection is available in the mesh inspector.
- Ocean passes, render sizing, movement tuning, hazards and swimming rules
  retain their existing interfaces. The CPU sampler supplies the new surface
  height to the existing swimming buoyancy and ripple effects.

## Coverage

Every `CoastWater` consumer inherits the upgrade: the campaign map, source
Beachfront, the native Descent coast, coastal street, Island Hopper,
the Jungle swimming cove, Crab Chief reef, Slipstream scenery, and editor/custom
oceans. Tagged sheltered surfaces include the wreck moonpool and Deadwater
maintenance wells. Recovered park authoring data also carries the tag;
Deadwater Cup deliberately removes those wells and remains drained. Custard
Creek's reaches use the sheltered material; Ghost Train baths use the shared
wave/foam functions with their existing green glow and very small amplitudes.

## Review and checks

`coastal-water-review.html` is a development-only browser review page. It
includes a curved beach and sheltered-pool fixture, actual level views, compile
and first-draw timing, WebGL error reporting, and a GPU/CPU sampler comparison.
`?lite` selects the reduced path, `?cold` uses fresh Three program keys, and
`?verify` runs the sampler comparison. Driver caching can still apply.

The final full fixture at 1280×720 used eight scene/pass programs, reported
303.7 ms for `compileAsync` and 1312.4 ms for its first render call, including
the reflection/refraction views. It reported zero WebGL errors. At 192 GPU
sample points over four wave times, maximum height error was 0.000440 m and
maximum normal component error was 0.000232. These timings describe this
browser session, not a promise for other hardware or the full game's asset
loading time. Actual level reviews use synchronous preparation because
asynchronous GLB completion can dispose materials during Three r166's
`compileAsync` polling; the first render call includes remaining shader work.

Focused checks are `tools/test-coastal-surf.mjs`, the existing ocean
resource/sizing/tuning/formula checks, island foam checks, and swimming checks.
The swim regression exercises spawn → wade → swim → idle → shore, fall
recovery, reset, fast approaches, and editor ocean capture. Required level
validation and the production type-check/build must also pass before release.
The built game's source lab also passed supported spawn, checkpoint warp and
banking, pit death, banked respawn, and the actual finish trigger in the browser.

The broader editor-material fixture has an unrelated Nightworks LOD assertion
(`1 !== 2` at its LOD-count check). The same failure was reproduced with the
unmodified release-base `src/level.ts`; the water-specific editor roundtrip,
material tagging and geometry-footprint checks pass.
