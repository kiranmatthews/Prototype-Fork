import { DEFAULT_SKATEBOARD_SETTINGS, SkateboardSettings, type SkateboardSettingsValue } from './settings';

export const MAP_SKATEBOARD_STORAGE_KEY = 'solProtoMapSkateboardTuning.v1';
/** Map-only popsicle deck: matched elliptical tips, kicks and truck spacing. */
export const DEFAULT_MAP_SKATEBOARD_SETTINGS: Readonly<SkateboardSettingsValue> = Object.freeze({
  ...DEFAULT_SKATEBOARD_SETTINGS,
  overallScale: 0.9,
  deckHalfWidth: 0.283,
  deckTailLength: 0.8625,
  deckNoseLength: 0.8625,
  centralTailTransition: -0.493,
  centralNoseTransition: 0.493,
  tailTaperLongitudinalExponent: 2,
  tailTaperTransverseExponent: 2,
  noseTaperLongitudinalExponent: 2,
  noseTaperTransverseExponent: 2,
  tailKickRise: 0.056,
  noseKickRise: 0.056,
  tailKickStart: -0.6,
  noseKickStart: 0.6,
  concaveTipMultiplier: 0.3,
  railBevelRadius: 0.0179,
  railBevelSegments: 4,
  deckLengthSegments: 128,
  deckWidthSegments: 30,
  deckThickness: 0.04,
  wheelWidth: 0.115,
  wheelTrackHalfWidth: 0.185,
  frontTruckLocalZ: 0.474,
  rearTruckLocalZ: -0.474,
  artworkScaleX: 1.583,
  artworkScaleY: 1.023,
  topWear: 0,
  bottomWear: 0,
  topWearRoughness: 0,
  bottomWearRoughness: 0,
  mapTitleSize: 156,
  gripCenterStripe: false,
});
export const mapSkateboardSettings = new SkateboardSettings({
  storageKey: MAP_SKATEBOARD_STORAGE_KEY,
  defaults: DEFAULT_MAP_SKATEBOARD_SETTINGS,
});
