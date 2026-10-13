import type { CustomAtmosphereData } from './level';

export const COASTAL_TOWN_TEXTURES = {
  'bay-paving': 'paving-albedo.webp',
  'bay-stucco': 'stucco-albedo.webp',
  'bay-terracotta': 'terracotta-albedo.webp',
} as const;
export const COASTAL_TOWN_ATMOSPHERE: CustomAtmosphereData = {
  fogEnabled: true, fogNear: 160, fogFar: 420, fogColor: '#b9dfe8',
  ambientSky: '#d8eeff', ambientGround: '#c6ad85', ambientIntensity: 1.25,
  sunColor: '#fff0d5', sunIntensity: 1.5, sunDirection: [.65,.7,.3],
  fillColor: '#b8dfe8', fillIntensity: .45, shadowStrength: .62, drawDistance: 380,
  backdrop: 'sky', fallbackTop: '#399beb', fallbackBottom: '#d1f3f0',
  fallbackRidges: false, fallbackStars: false, fallbackSunColor: null,
};
