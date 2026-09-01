export interface CharacterProportionSettingsValue {
  overallScale: number;
  height: number;
  bodyWidth: number;
  bodyDepth: number;
  headSize: number;
  headWidth: number;
  headDepth: number;
  neckLength: number;
  torsoLength: number;
  torsoWidth: number;
  torsoDepth: number;
  shoulderWidth: number;
  hipWidth: number;
  upperArmLength: number;
  forearmLength: number;
  thighLength: number;
  shinLength: number;
  shortsWidth: number;
  shortsHeight: number;
  shortsDepth: number;
  armThickness: number;
  legThickness: number;
  armKnobSize: number;
  legKnobSize: number;
  handSize: number;
  wristRestPitch: number;
  wristRestYaw: number;
  wristRestRoll: number;
  gloveXAcross: number;
  gloveXAlong: number;
  gloveXLift: number;
  footSize: number;
}

export type CharacterProportionKey = keyof CharacterProportionSettingsValue;

export interface CharacterProportionControl {
  readonly key: CharacterProportionKey;
  readonly label: string;
  readonly section: 'Overall' | 'Head & torso' | 'Skeleton' | 'Clothing' | 'Hands' | 'Mass & details';
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SavedCharacterProportions {
  readonly version: 1;
  readonly handRestRevision: 1;
  readonly defaultsRevision?: number;
  readonly settings: CharacterProportionSettingsValue;
  readonly defaults?: CharacterProportionSettingsValue;
}

export interface CharacterProportionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CHARACTER_PROPORTION_STORAGE_KEY = 'solProtoCharacterProportions.v1';
export const CHARACTER_HAND_REST_REVISION = 1 as const;
export const CHARACTER_PROPORTION_DEFAULTS_REVISION = 4 as const;

/** Identity presentation values used by the original Character Lab baseline. */
export const IDENTITY_CHARACTER_PROPORTIONS: Readonly<CharacterProportionSettingsValue> =
  Object.freeze({
    overallScale: 1,
    height: 1,
    bodyWidth: 1,
    bodyDepth: 1,
    headSize: 1,
    headWidth: 1,
    headDepth: 1,
    neckLength: 1,
    torsoLength: 1,
    torsoWidth: 1,
    torsoDepth: 1,
    shoulderWidth: 1,
    hipWidth: 1,
    upperArmLength: 1,
    forearmLength: 1,
    thighLength: 1,
    shinLength: 1,
    shortsWidth: 1,
    shortsHeight: 1,
    shortsDepth: 1,
    armThickness: 1,
    legThickness: 1,
    armKnobSize: 1,
    legKnobSize: 1,
    handSize: 1,
    wristRestPitch: 0,
    wristRestYaw: 0,
    wristRestRoll: 0,
    gloveXAcross: 0,
    gloveXAlong: 0,
    gloveXLift: 0,
    footSize: 1,
  });

/** Source-owned authored silhouette restored by Character Lab's Reset action. */
export const DEFAULT_CHARACTER_PROPORTIONS: Readonly<CharacterProportionSettingsValue> =
  Object.freeze({
    ...IDENTITY_CHARACTER_PROPORTIONS,
    bodyWidth: 1,
    bodyDepth: 1,
    headSize: 1.55,
    headWidth: 1.23,
    headDepth: 1.23,
    neckLength: 0,
    torsoLength: 1,
    torsoWidth: 1.13,
    torsoDepth: 1.22,
    shoulderWidth: 1,
    hipWidth: 0.93,
    upperArmLength: 1.01,
    forearmLength: 1.25,
    thighLength: 1.34,
    shinLength: 1.47,
    shortsWidth: 1.5,
    shortsHeight: 1.5,
    shortsDepth: 1.39,
    armThickness: 1.5,
    legThickness: 1.37,
    armKnobSize: 1.47,
    legKnobSize: 1.37,
    handSize: 1.36,
    wristRestPitch: 15,
    wristRestYaw: -167,
    wristRestRoll: 3,
    gloveXAcross: 0.025,
    gloveXAlong: 0.011,
    gloveXLift: -0.004,
    footSize: 1.53,
  });

export const CHARACTER_PROPORTION_CONTROLS: readonly CharacterProportionControl[] =
  Object.freeze([
    { key: 'overallScale', label: 'Overall size', section: 'Overall', min: 0.72, max: 1.35, step: 0.01 },
    { key: 'height', label: 'Height', section: 'Overall', min: 0.72, max: 1.35, step: 0.01 },
    { key: 'bodyWidth', label: 'Whole-body width', section: 'Overall', min: 0.68, max: 1.42, step: 0.01 },
    { key: 'bodyDepth', label: 'Whole-body depth', section: 'Overall', min: 0.68, max: 1.42, step: 0.01 },

    { key: 'headSize', label: 'Head size', section: 'Head & torso', min: 0.62, max: 1.55, step: 0.01 },
    { key: 'headWidth', label: 'Head width', section: 'Head & torso', min: 0.7, max: 1.42, step: 0.01 },
    { key: 'headDepth', label: 'Head depth', section: 'Head & torso', min: 0.7, max: 1.42, step: 0.01 },
    { key: 'neckLength', label: 'Neck height / gap', section: 'Head & torso', min: 0, max: 1.8, step: 0.01 },
    { key: 'torsoLength', label: 'Torso length', section: 'Head & torso', min: 0.62, max: 1.48, step: 0.01 },
    { key: 'torsoWidth', label: 'Torso width', section: 'Head & torso', min: 0.65, max: 1.5, step: 0.01 },
    { key: 'torsoDepth', label: 'Torso depth', section: 'Head & torso', min: 0.65, max: 1.5, step: 0.01 },

    { key: 'shoulderWidth', label: 'Shoulder width', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'hipWidth', label: 'Hip width', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'upperArmLength', label: 'Upper-arm length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'forearmLength', label: 'Forearm length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'thighLength', label: 'Thigh length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'shinLength', label: 'Shin length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },

    { key: 'shortsWidth', label: 'Shorts width', section: 'Clothing', min: 0.65, max: 1.5, step: 0.01 },
    { key: 'shortsHeight', label: 'Shorts height', section: 'Clothing', min: 0.65, max: 1.5, step: 0.01 },
    { key: 'shortsDepth', label: 'Shorts depth', section: 'Clothing', min: 0.65, max: 1.5, step: 0.01 },

    { key: 'wristRestPitch', label: 'Rest pitch (°)', section: 'Hands', min: -90, max: 90, step: 1 },
    { key: 'wristRestYaw', label: 'Rest yaw (°)', section: 'Hands', min: -180, max: 180, step: 1 },
    { key: 'wristRestRoll', label: 'Rest roll (°)', section: 'Hands', min: -120, max: 120, step: 1 },
    { key: 'gloveXAcross', label: 'Glove X across', section: 'Hands', min: -0.05, max: 0.05, step: 0.001 },
    { key: 'gloveXAlong', label: 'Glove X along', section: 'Hands', min: -0.05, max: 0.05, step: 0.001 },
    { key: 'gloveXLift', label: 'Glove X lift', section: 'Hands', min: -0.015, max: 0.025, step: 0.001 },

    { key: 'armThickness', label: 'Arm thickness', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'armKnobSize', label: 'Arm knob size', section: 'Mass & details', min: 1, max: 1.62, step: 0.01 },
    { key: 'legThickness', label: 'Leg thickness', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'legKnobSize', label: 'Leg knob size', section: 'Mass & details', min: 1, max: 1.62, step: 0.01 },
    { key: 'handSize', label: 'Hand size', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'footSize', label: 'Foot size', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
  ] satisfies CharacterProportionControl[]);

const CONTROL_BY_KEY = new Map(
  CHARACTER_PROPORTION_CONTROLS.map((control) => [control.key, control]),
);

function clamp(value: number, minimum: number, maximum: number, fallback: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback));
}

export function copyCharacterProportions(
  value: Readonly<CharacterProportionSettingsValue>,
): CharacterProportionSettingsValue {
  return { ...value };
}

export function clampCharacterProportions(
  input: Partial<CharacterProportionSettingsValue>,
): CharacterProportionSettingsValue {
  const result = copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
  for (const key of Object.keys(result) as CharacterProportionKey[]) {
    const control = CONTROL_BY_KEY.get(key);
    if (!control) continue;
    const candidate = input[key];
    result[key] = clamp(
      typeof candidate === 'number' ? candidate : result[key],
      control.min,
      control.max,
      result[key],
    );
  }
  return result;
}

type Listener = (value: Readonly<CharacterProportionSettingsValue>) => void;

export class CharacterProportionSettings {
  private current: CharacterProportionSettingsValue;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly storage: CharacterProportionStorage | null = defaultStorage()) {
    this.current = this.read();
  }

  get value(): Readonly<CharacterProportionSettingsValue> {
    return this.current;
  }

  patch(patch: Partial<CharacterProportionSettingsValue>): void {
    this.current = clampCharacterProportions({ ...this.current, ...patch });
    this.persistAndNotify();
  }

  replace(value: Partial<CharacterProportionSettingsValue>): void {
    this.current = clampCharacterProportions(value);
    this.persistAndNotify();
  }

  reset(): void {
    this.current = copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
    this.persistAndNotify();
  }

  serialize(pretty = true): string {
    return JSON.stringify(
      this.savedPayload(false),
      null,
      pretty ? 2 : undefined,
    );
  }

  importJson(source: string): void {
    const parsed = JSON.parse(source) as Partial<SavedCharacterProportions>;
    if (parsed.version !== 1 || !parsed.settings) {
      throw new Error('Expected a version 1 Character Lab settings file.');
    }
    this.replace(this.migrateHandRest(parsed));
  }

  subscribe(listener: Listener, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private read(): CharacterProportionSettingsValue {
    if (!this.storage) return copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
    try {
      const source = this.storage.getItem(CHARACTER_PROPORTION_STORAGE_KEY);
      if (!source) return copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
      const parsed = JSON.parse(source) as Partial<SavedCharacterProportions>;
      if (parsed.version !== 1 || !parsed.settings) throw new Error('unsupported version');
      const handMigrated = this.migrateHandRest(parsed);
      return clampCharacterProportions(this.migrateDefaults(parsed, handMigrated));
    } catch (error) {
      console.warn('Ignoring invalid Character Lab proportions', error);
      return copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
    }
  }

  private persistAndNotify(): void {
    try {
      this.storage?.setItem(
        CHARACTER_PROPORTION_STORAGE_KEY,
        JSON.stringify(this.savedPayload(true)),
      );
    } catch {
      // Live editing remains available when browser persistence is blocked.
    }
    for (const listener of this.listeners) listener(this.current);
  }

  private migrateHandRest(
    saved: Partial<SavedCharacterProportions>,
  ): Partial<CharacterProportionSettingsValue> {
    if (saved.handRestRevision === CHARACTER_HAND_REST_REVISION) return saved.settings ?? {};
    return {
      ...(saved.settings ?? {}),
      wristRestPitch: DEFAULT_CHARACTER_PROPORTIONS.wristRestPitch,
      wristRestYaw: DEFAULT_CHARACTER_PROPORTIONS.wristRestYaw,
      wristRestRoll: DEFAULT_CHARACTER_PROPORTIONS.wristRestRoll,
    };
  }

  private migrateDefaults(
    saved: Partial<SavedCharacterProportions>,
    settings: Partial<CharacterProportionSettingsValue>,
  ): Partial<CharacterProportionSettingsValue> {
    const revision = typeof saved.defaultsRevision === 'number'
      ? saved.defaultsRevision
      : 1;
    if (revision >= CHARACTER_PROPORTION_DEFAULTS_REVISION) return settings;

    // Revision 1 stored a complete snapshot but not the defaults it was based
    // on. That baseline was the identity map above. Newer saves retain their
    // exact source defaults so this comparison remains valid for revision 3+.
    const savedDefaults = saved.defaults ?? IDENTITY_CHARACTER_PROPORTIONS;
    const merged = copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
    for (const key of Object.keys(merged) as CharacterProportionKey[]) {
      const candidate = settings[key];
      const previousDefault = savedDefaults[key];
      if (
        typeof candidate === 'number' &&
        Number.isFinite(candidate) &&
        candidate !== previousDefault
      ) merged[key] = candidate;
    }
    return merged;
  }

  private savedPayload(includeDefaults: boolean): SavedCharacterProportions {
    return {
      version: 1,
      handRestRevision: CHARACTER_HAND_REST_REVISION,
      defaultsRevision: CHARACTER_PROPORTION_DEFAULTS_REVISION,
      settings: this.current,
      ...(includeDefaults
        ? { defaults: copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS) }
        : {}),
    };
  }
}

function defaultStorage(): CharacterProportionStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export const characterProportionSettings = new CharacterProportionSettings();
