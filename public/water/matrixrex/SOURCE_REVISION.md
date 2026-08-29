# MatrixRex Uber Stylized Water

- Source: https://github.com/MatrixRex/Uber-Stylized-Water
- Revision: `950f8b41621588b8c8230f52777a49f10758d85c`
- License: MIT; see `LICENSE.txt` in this directory.
- Upstream baseline: Unity `6000.0.72f1`, Universal Render Pipeline `17.0.4`.

## Vendored runtime subset

- `UberStylizedWater.shader`: upstream generated URP shader, unchanged.
- `Resources/Presentation/Beach/UberShowcase1_Tropical.mat`: the upstream
  `UWa-Template-Tropical` material used by `showcase1`, unchanged and retained
  as the persistent wave-off local-keyword variant.
- `Resources/Presentation/Beach/UberBeachHybrid_RuntimeVariant.mat`: a
  production-owned derivative of the unchanged Tropical material. It enables
  `_ENABLEWAVE` and carries showcase 8 / Wavy 2's exact two-wave defaults so
  the complete shoreline + caustics + wave-on keyword combination is retained
  in standalone Apple Silicon builds. Both persistent materials are protected
  by the build-time variant guard because the WATER panel can toggle waves.
- `Caustic 1.png`: Tropical preset caustics map, unchanged.
- `Noise 1.png`: showcase 4 / Genshin shoreline dissolve mask, unchanged.
- `Noise 3.png`: showcase 8 / Wavy 2 intersection mask, unchanged.
- `Noise 5.png`: original Tropical shoreline mask retained unchanged with the
  persistent template; production deliberately overrides that slot with
  showcase 4's Noise 1.
- `Noise 4.png`: shoreline/surface distortion texture, unchanged.
- `Normal 2.png`: water normal map, unchanged.
- `DemoTerrain/Sand.terrainlayer`, `sand_01_color_2k.png`,
  `sand_01_normal_gl_2k.png`, and `sand1 mask.png`: the unchanged showcase
  TerrainLayer and its textures. The production mesh reads that copied layer
  directly for its maps and authored normal 0.5 / metallic 0 / smoothness 0
  values. The copied TerrainLayer remains unchanged at 4 m; production UVs
  intentionally enlarge the visible texture features by 35% to 5.4 m and
  orient them in the local shoreline frame. The mesh extends the demo's bank
  and submerged-basin construction along the curved course without importing
  the whole demo scene.
- `Assets/Game/Data/SourceLevelPorts/BeachfrontRun_Showcase1Post.asset`: the
  unchanged showcase demo Bloom and screen-space lens-flare profile, renamed
  for the production scene while preserving its serialized parameter values.
- `Resources/SubGraphs/CubeMap.hlsl`: mandatory generated-shader include.
  Its deprecated `_FORWARD_PLUS` variant was migrated to URP 17.5's
  `_CLUSTER_LIGHT_LOOP` spelling; behavior is unchanged and the obsolete
  compatibility warning is eliminated.
- `Resources/Third Party/URP_ShaderGraphCustomLighting-main/CustomLighting.hlsl`:
  mandatory generated-shader include. Forward+ conditionals were migrated to
  the corresponding Unity 6.1+ cluster-light-loop macros to match the local
  CubeMap keyword update. Its Cyanilux MIT license is retained beside it.

The upstream Shader Graph, demo scenes, other template materials, original
planar-reflection scripts, documentation and remaining textures are
intentionally excluded. `BeachOceanPresentation` clones the persistent Tropical
template at runtime, preserving its authored static feature set while exposing
the active showcase parameters through the beach-only tuning panel. Production
keeps showcase 4's animated shoreline generator and Noise 1 mask together with
showcase 8's Noise 3 intersection generator. Their numeric mix, the two
Gerstner waves, lighting, normal/specular, refraction, reflection and caustics
are the later user-authored values. All 17 active wave values—enable, peak RGBA,
and each wave's length, height, speed, X/Z direction and sharpness—are exposed
in the beach WATER panel and JSON preset contract.
The local
planar-reflection presenter is a production-scoped reimplementation of the
documented upstream setup rather than a wholesale demo import.

All 95 production numeric defaults are the user-approved preset exported as
`BeachOcean.water.json` on 2026-08-24 at `12:01:48Z`. The fixed Noise 1/Noise 3
texture assignments and persistent wave variants remain source-controlled; the
unchanged Tropical material remains the shader and wave-off keyword template.
