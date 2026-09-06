import { UNITY_OCEAN_DEFAULTS, type UnityOceanParams } from './unityOcean';

/** Authored ocean look for the elevated island-map camera. */
export function createMapOceanDefaults(): UnityOceanParams {
  return {
    ...UNITY_OCEAN_DEFAULTS,
    shallow: { r: 0.026, g: 0.58, b: 0.57, a: 0.78 },
    deep: { r: 0.008, g: 0.18, b: 0.3, a: 1 },
    peak: { r: 0.57, g: 0.85, b: 0.89, a: 0.35 },
    shadow: { ...UNITY_OCEAN_DEFAULTS.shadow },
    specular: { ...UNITY_OCEAN_DEFAULTS.specular },
    intersection: { ...UNITY_OCEAN_DEFAULTS.intersection },
    wave1Height: 0.08, wave2Height: 0.045,
    normalStrength: 3.2, normalDistanceStrength: 2.4, normalScale: 0.48,
    reflectionStrength: 0.28, reflectionDistortion: 0.28, reflectionFresnel: 2.6,
    depthDistance: 0.72, causticsStart: 38, causticsFade: 150,
    causticsScale: 1.05, causticsStrength: 1.55,
    intersectionWidth: 0.42, intersectionScale: 2.1,
  };
}
