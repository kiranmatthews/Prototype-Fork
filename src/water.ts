// Compatibility entry point. The former custom four-wave CoastWater,
// shoreline solver, breaker ribbon, swash and wet-sand implementation was
// intentionally removed. The runtime now comes from the complete Unity
// Beachfront ocean port in unityOcean.ts.
export {
  CoastWater,
  UnityOcean,
  UNITY_OCEAN_DEFAULTS,
  WATER_DEFAULTS,
  type CoastWaterOpts,
  type OceanColor,
  type OceanDebug,
  type OceanQuality,
  type OceanStats,
  type ShoreSample,
  type SurfaceSample,
  type UnityOceanParams,
  type WaterParams,
} from "./unityOcean";
