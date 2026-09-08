import { DEFAULT_SKATEBOARD_SETTINGS, SkateboardSettings, type SkateboardSettingsValue } from './settings';

export const MAP_SKATEBOARD_STORAGE_KEY = 'solProtoMapSkateboardTuning.v1';
/** Preserve the existing map-card silhouette until its own profile is edited. */
export const DEFAULT_MAP_SKATEBOARD_SETTINGS: Readonly<SkateboardSettingsValue> = Object.freeze({
  ...DEFAULT_SKATEBOARD_SETTINGS,
  deckHalfWidth: 0.34,
  topWear: 0.6,
});
export const mapSkateboardSettings = new SkateboardSettings({
  storageKey: MAP_SKATEBOARD_STORAGE_KEY,
  defaults: DEFAULT_MAP_SKATEBOARD_SETTINGS,
});
