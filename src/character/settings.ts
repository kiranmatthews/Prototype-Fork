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
  armThickness: number;
  legThickness: number;
  handSize: number;
  footSize: number;
  earSize: number;
  eyeSize: number;
  ponytailSize: number;
}

export type CharacterProportionKey = keyof CharacterProportionSettingsValue;

export interface CharacterProportionControl {
  readonly key: CharacterProportionKey;
  readonly label: string;
  readonly section: 'Overall' | 'Head & torso' | 'Skeleton' | 'Mass & details';
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SavedCharacterProportions {
  readonly version: 1;
  readonly settings: CharacterProportionSettingsValue;
}

export interface CharacterProportionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CHARACTER_PROPORTION_STORAGE_KEY = 'solProtoCharacterProportions.v1';

export const DEFAULT_CHARACTER_PROPORTIONS: Readonly<CharacterProportionSettingsValue> =
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
    armThickness: 1,
    legThickness: 1,
    handSize: 1,
    footSize: 1,
    earSize: 1,
    eyeSize: 1,
    ponytailSize: 1,
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
    { key: 'neckLength', label: 'Neck length', section: 'Head & torso', min: 0, max: 1.8, step: 0.01 },
    { key: 'torsoLength', label: 'Torso length', section: 'Head & torso', min: 0.62, max: 1.48, step: 0.01 },
    { key: 'torsoWidth', label: 'Torso width', section: 'Head & torso', min: 0.65, max: 1.5, step: 0.01 },
    { key: 'torsoDepth', label: 'Torso depth', section: 'Head & torso', min: 0.65, max: 1.5, step: 0.01 },

    { key: 'shoulderWidth', label: 'Shoulder width', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'hipWidth', label: 'Hip width', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'upperArmLength', label: 'Upper-arm length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'forearmLength', label: 'Forearm length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'thighLength', label: 'Thigh length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },
    { key: 'shinLength', label: 'Shin length', section: 'Skeleton', min: 0.58, max: 1.58, step: 0.01 },

    { key: 'armThickness', label: 'Arm thickness', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'legThickness', label: 'Leg thickness', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'handSize', label: 'Hand size', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'footSize', label: 'Foot size', section: 'Mass & details', min: 0.58, max: 1.62, step: 0.01 },
    { key: 'earSize', label: 'Ear size', section: 'Mass & details', min: 0.5, max: 1.7, step: 0.01 },
    { key: 'eyeSize', label: 'Eye size', section: 'Mass & details', min: 0.55, max: 1.55, step: 0.01 },
    { key: 'ponytailSize', label: 'Ponytail size', section: 'Mass & details', min: 0.45, max: 1.7, step: 0.01 },
  ] satisfies CharacterProportionControl[]);

const CONTROL_BY_KEY = new Map(
  CHARACTER_PROPORTION_CONTROLS.map((control) => [control.key, control]),
);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 1));
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
      { version: 1, settings: this.current } satisfies SavedCharacterProportions,
      null,
      pretty ? 2 : undefined,
    );
  }

  importJson(source: string): void {
    const parsed = JSON.parse(source) as Partial<SavedCharacterProportions>;
    if (parsed.version !== 1 || !parsed.settings) {
      throw new Error('Expected a version 1 Character Lab settings file.');
    }
    this.replace(parsed.settings);
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
      return clampCharacterProportions(parsed.settings);
    } catch (error) {
      console.warn('Ignoring invalid Character Lab proportions', error);
      return copyCharacterProportions(DEFAULT_CHARACTER_PROPORTIONS);
    }
  }

  private persistAndNotify(): void {
    try {
      this.storage?.setItem(CHARACTER_PROPORTION_STORAGE_KEY, this.serialize(false));
    } catch {
      // Live editing remains available when browser persistence is blocked.
    }
    for (const listener of this.listeners) listener(this.current);
  }
}

function defaultStorage(): CharacterProportionStorage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export const characterProportionSettings = new CharacterProportionSettings();
