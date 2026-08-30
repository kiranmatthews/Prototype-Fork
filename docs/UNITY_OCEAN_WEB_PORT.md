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

1. A curved shoreline ribbon with 128 strips across, extending 6m onto land
   and 120m offshore. The literal Beachfront reference preserves all 371
   source rows plus Unity's 50-sample pre-tail and 400-sample post-tail;
   native web coasts resample their own spline at about 2m without changing
   coordinate handedness.
2. The exact two Unity Gerstner bands on both GPU and CPU. Geometry, normals
   and `sampleWaterSurface()` therefore share one equation.
3. The Unity horizon fill at 105m / 130m / 800m, blending opaque deep water
   into the coast fog.
4. A literal translation of the enabled MatrixRex permutation: exponential
   world-space depth, two-way tangent normals, depth-validated refraction,
   view-parallax dual-sample HDR caustics, the IntersectionFoamGenerator mask,
   displacement-driven wave color, screen-space planar reflection, HDR
   reflect-vector specular, live directional shadows, exact layer alpha/order,
   and Unity-linear fog.
5. A 30%-scale mirrored-camera HDR reflection pass and a full drawing-buffer
   opaque color/depth pass, both sized from actual camera pixels including DPR.
6. Full/lite quality modes, explicit render-target and texture disposal, a
   pure CPU surface sampler, diagnostics and the versioned WATER studio.

`src/coastpost.ts`, `src/unitySmaa.ts`, `src/unityBloom.ts`,
`src/unityColorLut.ts`, and `src/unityPost.ts` own the shared Unity-style post
path. URP SMAA High feeds a lazy HDR Gaussian bloom pyramid; the final pass
applies colored vignette, exposure/tone mapping, the change-driven 32³ RGBA8
LDR LUT and Unity's triangular 8-bit dither before returning linear color to
the final `OutputPass`. The former coast-specific lens-flare/streak pipeline
and its fixed target chain remain removed; the new bloom is the same global
LOOK system used by Bonus and Meshy. Split-screen and `?lite` fall back to the
direct renderer. See `docs/UNITY_VISUAL_TREATMENT.md` for exact profile values,
ordering, performance bounds and diagnostics.

The SMAA algorithm and lookup textures carry their original 2013 MIT notice in
`public/unity/smaa/LICENSE.txt`; `area.png` and `search.png` are lossless PNG
conversions of the corresponding MIT-associated lookup tables. The dither rank
texture is generated deterministically by repo-owned best-candidate code at
runtime. No Unity blue-noise image is redistributed.

## Coast traversal contract

The Unity ocean has no collider, buoyancy, swimming or wave-driven gameplay.
The Descent reproduces Unity's separate coastline contract instead:

- sea level `-0.36m`;
- a continuous textured sand bank plus 16m submerged shelf;
- legal shallows extending 3.5m seaward from the visible line;
- a 0.50m-thick continuous invisible containment edge (0.25m half-thickness)
  from `y=-12` to `y=16`;
- a deep-water death fallback beginning 5.75m seaward, 28m wide, with its
  top at `y=-0.81`;
- `killY=-12` as the final backup.

The ocean remains outside `groundMeshes`; only the sand is ground. The edge is
an oriented continuous-prism narrow phase with the same 0.25m half thickness
as Unity's `OceanEdge_Invisible`. The player performs an earliest-time capsule
sweep over the true spline and endpoint caps, resolves with geometric normals,
then projects only the inward remainder for tangent-preserving glances. It no
longer approximates the curve with axis-aligned wall boxes. The fallback is in
`pitBoxes`. The authored `?coastphysics` query starts on dry sand just inside
the waterline for focused containment and deep-water QA.

## Atmosphere

The coast uses the Unity linear fog (`#94c9e0`, 190-780m), Trilight-derived
ambient colors, warm 1.12 key, 900m far plane, and the existing byte-identical
`sky-coast.png` through Unity's mirrored 180° mapping and fixed horizon
offset. The old camera-height sky-horizon correction is disabled for this
preset.

## Deliberately absent

Unity's underwater keyword, surface-foam feature, shoreline trail and ocean
particle systems are disabled or absent in the source scene, so the web port
does not invent them. The Coast source bloom is available through the shared
LOOK preset, but its separate screen-space lens-flare ghosts and streaks remain
deliberately absent. `?nopost` and `?nopasses` are diagnostic fallbacks, not
alternate authored looks. `?nosmaa`, `?rawoutput`, `?nolut`, and `?nodither`
isolate the shared post stages for parity review.

## Verification

Use `/?touch&oceanreview&oceanoverview` for the frozen Unity visual target,
`/?touch&oceanreview` for the exact gameplay-camera target, and
`/?touch&coastphysics` for the Descent's curved containment/deep-water check.
Add `?lite` or `&lite` to the corresponding query for the fallback. Verify:

- continuous sand/water/foam/horizon with no rectangular edge;
- bright, fine animated HDR specular streaks driven by the exact two-way normal;
- cyan shallows, view-projected dual caustics, broad Noise3 intersection foam,
  and depth-validated refraction;
- the player walks into the shallows and stops at the curved 3.5m edge;
- the ordinary Descent spawn still sees ocean along the high road;
- Slipstream uses the shared two-wave runtime, not its removed plasma shader;
- repeated level switches produce no console/WebGL errors;
- WATER studio reports active reflection/prepass dimensions and stable FPS.
