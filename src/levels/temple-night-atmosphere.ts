import type { CustomLevelData } from '../level';

/** Night lighting shared by Temple of Embers and its Ember Reliquary bonus. */
export const TEMPLE_NIGHT_ATMOSPHERE: CustomLevelData['atmosphere'] = {
  fogNear: 28, fogFar: 185, fogColor: '#101f30', drawDistance: 240,
  ambientSky: '#7594bd', ambientGround: '#25332d', ambientIntensity: .78,
  sunColor: '#a1bde9', sunIntensity: .68, fillColor: '#6b93be', fillIntensity: .26,
  shadowStrength: .7, fallbackTop: '#040a19', fallbackBottom: '#172b40',
  fallbackStars: true, fallbackSunColor: null,
};
