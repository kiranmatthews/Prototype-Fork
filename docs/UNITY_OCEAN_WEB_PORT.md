# Unity Beachfront ocean web port

This repository now uses a clean Three.js port of the production Unity
Beachfront ocean. The former web-only four-harmonic shoreline solver, moving
edge, breaker ribbon, swash sheet, wet-sand sheet, sky-atlas reflection and
Slipstream plasma sea are no longer runtime systems.

## Source of truth

The port was measured from the current Unity project at:

- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Runtime/Presentation/BeachOceanPresentation.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Runtime/Presentation/BeachPlanarReflectionPresenter.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Editor/SourceLevelPortSceneBuilder.BeachfrontRun.cs`
- `/Users/kiki/Developer/Board Platformer Unity/Assets/Game/Data/SourceLevelPorts/BeachfrontRun_Showcase1Post.asset`

The five water textures and three sand inputs are byte-identical copies from
MatrixRex Uber Stylized Water revision
`950f8b41621588b8c8230f52777a49f10758d85c`. MatrixRex's MIT license and
source-revision record live beside the web assets in
`public/water/matrixrex/`; hashes and source paths are in `CREDITS.md`.

## Runtime composition

`src/unityOcean.ts` owns:

1. A curved shoreline ribbon resampled at about 2m, 128 strips across,
   extending 6m onto land and 120m offshore.
2. The exact two Unity Gerstner bands on both GPU and CPU. Geometry, normals
   and `sampleWaterSurface()` therefore share one equation.
3. A deep-ocean coverage mesh for the web Descent's 2.5km high-road view.
4. The Unity horizon fill at 105m / 130m / 800m, blending opaque deep water
   into the coast fog.
5. MatrixRex normal/specular detail, shallow/deep color, refracted opaque
   scene color, depth intersection foam, caustics and distorted planar
   reflection.
6. A 30%-scale mirrored-camera reflection pass and a display-resolution
   opaque color/depth pass. Retina DPR does not multiply the Unity Game-view
   contract.
7. Full/lite quality modes, explicit render-target and texture disposal, a
   pure CPU surface sampler, diagnostics and the versioned WATER studio.

`src/coastpost.ts` owns the coast-only Unity post profile: Bloom 1/.3/.7 plus
the approved screen-space lens-flare ghosts, warped flare, horizontal streak
and chromatic dispersion values. It renders at Unity Game-view resolution;
split-screen and `?lite` fall back to the direct renderer.

## Coast traversal contract

The Unity ocean has no collider, buoyancy, swimming or wave-driven gameplay.
The Descent reproduces Unity's separate coastline contract instead:

- sea level `-0.36m`;
- a continuous textured sand bank plus 16m submerged shelf;
- legal shallows extending 3.5m seaward from the visible line;
- a 0.25m continuous invisible containment edge from `y=-12` to `y=16`;
- a deep-water death fallback beginning 5.75m seaward, 28m wide, with its
  top at `y=-0.81`;
- `killY=-12` as the final backup.

The ocean remains outside `groundMeshes`; only the sand is ground. The edge is
in `walls`, and the fallback is in `pitBoxes`. An authored `?oceanreview`
query starts on dry sand ten metres from the waterline for focused QA.

## Atmosphere

The coast uses the Unity linear fog (`#94c9e0`, 190-780m), Trilight-derived
ambient colors, warm 1.12 key, 900m far plane, and the existing byte-identical
`sky-coast.png` through Unity's mirrored 180° mapping and fixed horizon
offset. The old camera-height sky-horizon correction is disabled for this
preset.

## Deliberately absent

Unity's underwater keyword, surface-foam feature, shoreline trail and ocean
particle systems are disabled or absent in the source scene, so the web port
does not invent them. `?nopost` and `?nopasses` are diagnostic fallbacks, not
alternate authored looks.

## Verification

Use `/?touch&oceanreview` for the full beach check and `/?lite&oceanreview`
for the fallback. Verify:

- continuous sand/water/foam/horizon with no rectangular edge;
- fine animated normal streaks without black grazing bands;
- shallow refraction and caustic variation;
- the player walks into the shallows and stops at the curved 3.5m edge;
- the ordinary Descent spawn still sees ocean along the high road;
- Slipstream uses the shared two-wave runtime, not its removed plasma shader;
- repeated level switches produce no console/WebGL errors;
- WATER studio reports active reflection/prepass dimensions and stable FPS.
