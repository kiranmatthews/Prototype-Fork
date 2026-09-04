export type ToneMapper = "none" | "neutral" | "aces";
export type BloomDownscale = 2 | 4;
export type Color3 = [number, number, number];
export type ColorMatrix3 = [Color3, Color3, Color3];

export interface VisualGradingValue {
  toneMapper: ToneMapper;
  exposureEV: number;
  contrastPct: number;
  saturationPct: number;
  hueShiftDeg: number;
  temperature: number;
  tint: number;
  colorFilter: Color3;
  lift: Color3;
  gamma: Color3;
  gain: Color3;
  splitShadows: Color3;
  splitHighlights: Color3;
  splitBalancePct: number;
  channelMixer: ColorMatrix3;
}

export interface VisualBloomValue {
  intensity: number;
  threshold: number;
  scatter: number;
  clamp: number;
  tint: Color3;
  highQuality: boolean;
  downscale: BloomDownscale;
  maxIterations: number;
}

export interface VisualVignetteValue {
  intensity: number;
  smoothness: number;
  color: Color3;
  center: [number, number];
  rounded: boolean;
}

export interface VisualTreatmentValue {
  enabled: boolean;
  grading: VisualGradingValue;
  bloom: VisualBloomValue;
  vignette: VisualVignetteValue;
}

export interface VisualTreatmentPatch {
  enabled?: boolean;
  grading?: Partial<VisualGradingValue>;
  bloom?: Partial<VisualBloomValue>;
  vignette?: Partial<VisualVignetteValue>;
}

export interface SavedVisualTreatmentV2 {
  readonly version: 2;
  readonly settings: VisualTreatmentValue;
}

interface LegacyVisualTreatmentV1 {
  enabled?: boolean;
  exposure?: number;
  contrast?: number;
  saturation?: number;
  tintR?: number;
  tintG?: number;
  tintB?: number;
  bloomIntensity?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  vignetteIntensity?: number;
  vignetteSmoothness?: number;
}

export interface VisualTreatmentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const VISUAL_TREATMENT_STORAGE_KEY = "solProtoVisualTreatment.v2";
export const LEGACY_VISUAL_TREATMENT_STORAGE_KEY = "solProtoVisualTreatment.v1";

const DEFAULT_VALUE: VisualTreatmentValue = {
  enabled: false,
  grading: {
    toneMapper: "none",
    exposureEV: 0,
    contrastPct: 0,
    saturationPct: 0,
    hueShiftDeg: 0,
    temperature: 0,
    tint: 0,
    colorFilter: [1, 1, 1],
    lift: [0, 0, 0],
    gamma: [1, 1, 1],
    gain: [1, 1, 1],
    splitShadows: [0.5, 0.5, 0.5],
    splitHighlights: [0.5, 0.5, 0.5],
    splitBalancePct: 0,
    channelMixer: [
      [100, 0, 0],
      [0, 100, 0],
      [0, 0, 100],
    ],
  },
  bloom: {
    intensity: 0,
    threshold: 0.9,
    scatter: 0.7,
    clamp: 65472,
    tint: [1, 1, 1],
    highQuality: false,
    downscale: 2,
    maxIterations: 6,
  },
  vignette: {
    intensity: 0,
    smoothness: 0.2,
    color: [0, 0, 0],
    center: [0.5, 0.5],
    rounded: false,
  },
};

const cloneColor = (color: readonly number[]): Color3 => [
  color[0],
  color[1],
  color[2],
];

export function cloneVisualTreatment(
  value: Readonly<VisualTreatmentValue>,
): VisualTreatmentValue {
  return {
    enabled: value.enabled,
    grading: {
      ...value.grading,
      colorFilter: cloneColor(value.grading.colorFilter),
      lift: cloneColor(value.grading.lift),
      gamma: cloneColor(value.grading.gamma),
      gain: cloneColor(value.grading.gain),
      splitShadows: cloneColor(value.grading.splitShadows),
      splitHighlights: cloneColor(value.grading.splitHighlights),
      channelMixer: value.grading.channelMixer.map(cloneColor) as ColorMatrix3,
    },
    bloom: { ...value.bloom, tint: cloneColor(value.bloom.tint) },
    vignette: {
      ...value.vignette,
      color: cloneColor(value.vignette.color),
      center: [value.vignette.center[0], value.vignette.center[1]],
    },
  };
}

// Neutral remains an identity transform; factory Reset restores the Chrome-tuned look.
export const DEFAULT_VISUAL_TREATMENT: Readonly<VisualTreatmentValue> =
  Object.freeze({
    ...cloneVisualTreatment(DEFAULT_VALUE),
    grading: { ...DEFAULT_VALUE.grading, exposureEV: -0.18, contrastPct: 19.3 },
    bloom: {
      ...DEFAULT_VALUE.bloom,
      intensity: 2.56, threshold: 0.49, scatter: 0.45, clamp: 41521,
      tint: [1.07, 1.02, 1.2] as Color3,
    },
    vignette: {
      ...DEFAULT_VALUE.vignette,
      intensity: 0.29, smoothness: 0.4,
      color: [0.1803921568627451, 0.08235294117647059, 0] as Color3,
    },
  });

const sourcePreset = (patch: VisualTreatmentPatch): Readonly<VisualTreatmentValue> =>
  Object.freeze(clampVisualTreatment({
    ...cloneVisualTreatment(DEFAULT_VALUE),
    enabled: true,
    grading: { ...DEFAULT_VALUE.grading, ...patch.grading },
    bloom: { ...DEFAULT_VALUE.bloom, ...patch.bloom },
    vignette: { ...DEFAULT_VALUE.vignette, ...patch.vignette },
  }));

// Exact active Unity volume values. Advanced controls stay identity until the
// user changes them, so presets remain literal source references.
export const VISUAL_TREATMENT_PRESETS = Object.freeze({
  neutral: Object.freeze(cloneVisualTreatment(DEFAULT_VALUE)),
  unityDefault: sourcePreset({
    grading: { toneMapper: "neutral" },
    bloom: {
      intensity: 0.25,
      threshold: 1,
      scatter: 0.5,
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: { intensity: 0.2, smoothness: 0.2 },
  }),
  coast: sourcePreset({
    grading: { toneMapper: "neutral" },
    bloom: {
      intensity: 0.3,
      threshold: 1,
      scatter: 0.7,
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: { intensity: 0.2, smoothness: 0.2 },
  }),
  bonus: sourcePreset({
    grading: {
      toneMapper: "neutral",
      exposureEV: -0.18,
      contrastPct: 5,
      saturationPct: -4,
      colorFilter: [0.72, 0.88, 1],
    },
    bloom: {
      intensity: 0.68,
      threshold: 0.78,
      scatter: 0.78,
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: {
      intensity: 0.46,
      smoothness: 0.78,
      color: [0.199, 0.124, 0.699],
    },
  }),
  meshy: sourcePreset({
    grading: {
      toneMapper: "neutral",
      exposureEV: -0.22,
      contrastPct: 22,
      saturationPct: 18,
    },
    bloom: {
      intensity: 0.16,
      threshold: 1.05,
      scatter: 0.55,
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: { intensity: 0.22, smoothness: 0.72 },
  }),
} satisfies Record<string, Readonly<VisualTreatmentValue>>);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(
    maximum,
    Math.max(minimum, Number.isFinite(value) ? value : minimum),
  );
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampColor(
  value: unknown,
  fallback: readonly number[],
  minimum: number,
  maximum: number,
): Color3 {
  const source = Array.isArray(value) ? value : fallback;
  return [0, 1, 2].map((index) =>
    clamp(numberOr(source[index], fallback[index]), minimum, maximum),
  ) as Color3;
}

export function clampVisualTreatment(input: unknown): VisualTreatmentValue {
  const source = (input ?? {}) as Partial<VisualTreatmentValue>;
  const grading = (source.grading ?? {}) as Partial<VisualGradingValue>;
  const bloom = (source.bloom ?? {}) as Partial<VisualBloomValue>;
  const vignette = (source.vignette ?? {}) as Partial<VisualVignetteValue>;
  const d = DEFAULT_VALUE;
  const toneMapper: ToneMapper = ["none", "neutral", "aces"].includes(
    String(grading.toneMapper),
  )
    ? (grading.toneMapper as ToneMapper)
    : d.grading.toneMapper;
  const mixerSource = Array.isArray(grading.channelMixer)
    ? grading.channelMixer
    : d.grading.channelMixer;
  const centerSource = Array.isArray(vignette.center)
    ? vignette.center
    : d.vignette.center;
  return {
    enabled: source.enabled === true,
    grading: {
      toneMapper,
      exposureEV: clamp(numberOr(grading.exposureEV, d.grading.exposureEV), -5, 5),
      contrastPct: clamp(numberOr(grading.contrastPct, d.grading.contrastPct), -100, 100),
      saturationPct: clamp(numberOr(grading.saturationPct, d.grading.saturationPct), -100, 100),
      hueShiftDeg: clamp(numberOr(grading.hueShiftDeg, d.grading.hueShiftDeg), -180, 180),
      temperature: clamp(numberOr(grading.temperature, d.grading.temperature), -100, 100),
      tint: clamp(numberOr(grading.tint, d.grading.tint), -100, 100),
      colorFilter: clampColor(grading.colorFilter, d.grading.colorFilter, 0, 2),
      lift: clampColor(grading.lift, d.grading.lift, -0.5, 0.5),
      gamma: clampColor(grading.gamma, d.grading.gamma, 0.1, 4),
      gain: clampColor(grading.gain, d.grading.gain, 0, 4),
      splitShadows: clampColor(grading.splitShadows, d.grading.splitShadows, 0, 1),
      splitHighlights: clampColor(grading.splitHighlights, d.grading.splitHighlights, 0, 1),
      splitBalancePct: clamp(numberOr(grading.splitBalancePct, 0), -100, 100),
      channelMixer: [0, 1, 2].map((row) =>
        clampColor(mixerSource[row], d.grading.channelMixer[row], -200, 200),
      ) as ColorMatrix3,
    },
    bloom: {
      intensity: clamp(numberOr(bloom.intensity, d.bloom.intensity), 0, 5),
      threshold: clamp(numberOr(bloom.threshold, d.bloom.threshold), 0, 4),
      scatter: clamp(numberOr(bloom.scatter, d.bloom.scatter), 0, 1),
      clamp: clamp(numberOr(bloom.clamp, d.bloom.clamp), 0, 65472),
      tint: clampColor(bloom.tint, d.bloom.tint, 0, 4),
      highQuality: bloom.highQuality === true,
      downscale: bloom.downscale === 4 ? 4 : 2,
      maxIterations: Math.round(clamp(numberOr(bloom.maxIterations, 6), 2, 8)),
    },
    vignette: {
      intensity: clamp(numberOr(vignette.intensity, d.vignette.intensity), 0, 1),
      smoothness: clamp(numberOr(vignette.smoothness, d.vignette.smoothness), 0.01, 1),
      color: clampColor(vignette.color, d.vignette.color, 0, 1),
      center: [
        clamp(numberOr(centerSource[0], 0.5), 0, 1),
        clamp(numberOr(centerSource[1], 0.5), 0, 1),
      ],
      rounded: vignette.rounded === true,
    },
  };
}

function migrateLegacy(input: LegacyVisualTreatmentV1): VisualTreatmentValue {
  return clampVisualTreatment({
    ...cloneVisualTreatment(DEFAULT_VALUE),
    enabled: input.enabled === true,
    grading: {
      ...DEFAULT_VALUE.grading,
      exposureEV: numberOr(input.exposure, 0),
      contrastPct: (numberOr(input.contrast, 1) - 1) * 100,
      saturationPct: (numberOr(input.saturation, 1) - 1) * 100,
      colorFilter: [
        numberOr(input.tintR, 1),
        numberOr(input.tintG, 1),
        numberOr(input.tintB, 1),
      ],
    },
    bloom: {
      ...DEFAULT_VALUE.bloom,
      intensity: numberOr(input.bloomIntensity, 0),
      threshold: numberOr(input.bloomThreshold, 0.9),
      scatter: clamp(numberOr(input.bloomRadius, 7) / 10, 0, 1),
    },
    vignette: {
      ...DEFAULT_VALUE.vignette,
      intensity: numberOr(input.vignetteIntensity, 0),
      smoothness: numberOr(input.vignetteSmoothness, 0.2),
    },
  });
}

export interface VisualTreatmentActivity {
  grading: boolean;
  bloom: boolean;
  vignette: boolean;
  any: boolean;
}

const differs = (values: readonly number[], defaults: readonly number[]): boolean =>
  values.some((value, index) => Math.abs(value - defaults[index]) > 1e-5);

export function visualTreatmentActivity(
  value: Readonly<VisualTreatmentValue>,
): VisualTreatmentActivity {
  if (!value.enabled)
    return { grading: false, bloom: false, vignette: false, any: false };
  const g = value.grading;
  const d = DEFAULT_VALUE.grading;
  const grading =
    g.toneMapper !== "none" ||
    Math.abs(g.exposureEV) > 1e-5 ||
    Math.abs(g.contrastPct) > 1e-5 ||
    Math.abs(g.saturationPct) > 1e-5 ||
    Math.abs(g.hueShiftDeg) > 1e-5 ||
    Math.abs(g.temperature) > 1e-5 ||
    Math.abs(g.tint) > 1e-5 ||
    differs(g.colorFilter, d.colorFilter) ||
    differs(g.lift, d.lift) ||
    differs(g.gamma, d.gamma) ||
    differs(g.gain, d.gain) ||
    differs(g.splitShadows, d.splitShadows) ||
    differs(g.splitHighlights, d.splitHighlights) ||
    Math.abs(g.splitBalancePct) > 1e-5 ||
    g.channelMixer.some((row, index) => differs(row, d.channelMixer[index]));
  const bloom = value.bloom.intensity > 1e-4;
  const vignette = value.vignette.intensity > 1e-4;
  return { grading, bloom, vignette, any: grading || bloom || vignette };
}

type Listener = (value: Readonly<VisualTreatmentValue>) => void;

function defaultStorage(): VisualTreatmentStorage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

function readStored(storage: VisualTreatmentStorage | null): VisualTreatmentValue {
  if (!storage) return cloneVisualTreatment(DEFAULT_VISUAL_TREATMENT);
  try {
    const current = storage.getItem(VISUAL_TREATMENT_STORAGE_KEY);
    if (current) {
      const parsed = JSON.parse(current) as Partial<SavedVisualTreatmentV2>;
      if (parsed.version !== 2 || !parsed.settings)
        throw new Error("unsupported visual-treatment tuning file");
      return clampVisualTreatment(parsed.settings);
    }
    const legacy = storage.getItem(LEGACY_VISUAL_TREATMENT_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as {
        version?: number;
        settings?: LegacyVisualTreatmentV1;
      };
      if (parsed.version === 1 && parsed.settings)
        return migrateLegacy(parsed.settings);
    }
  } catch (error) {
    console.warn("Ignoring invalid visual-treatment tuning", error);
  }
  return cloneVisualTreatment(DEFAULT_VISUAL_TREATMENT);
}

export class VisualTreatmentSettings {
  private current: VisualTreatmentValue;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly storage: VisualTreatmentStorage | null = defaultStorage(),
  ) {
    this.current = readStored(storage);
  }

  get value(): Readonly<VisualTreatmentValue> {
    return this.current;
  }

  patch(patch: VisualTreatmentPatch): void {
    const next = clampVisualTreatment({
      enabled: patch.enabled ?? this.current.enabled,
      grading: { ...this.current.grading, ...patch.grading },
      bloom: { ...this.current.bloom, ...patch.bloom },
      vignette: { ...this.current.vignette, ...patch.vignette },
    });
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.current = next;
    this.persistAndNotify();
  }

  reset(): void {
    this.replace(DEFAULT_VISUAL_TREATMENT);
  }

  applyPreset(value: Readonly<VisualTreatmentValue>): void {
    this.replace(value);
  }

  subscribe(listener: Listener, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  serialize(pretty = true): string {
    return JSON.stringify(
      { version: 2, settings: this.current } satisfies SavedVisualTreatmentV2,
      null,
      pretty ? 2 : 0,
    );
  }

  private replace(value: Readonly<VisualTreatmentValue>): void {
    const next = clampVisualTreatment(cloneVisualTreatment(value));
    if (JSON.stringify(next) === JSON.stringify(this.current)) return;
    this.current = next;
    this.persistAndNotify();
  }

  private persistAndNotify(): void {
    try {
      this.storage?.setItem(VISUAL_TREATMENT_STORAGE_KEY, this.serialize(false));
    } catch {
      /* Private browsing can deny storage; live tuning still works. */
    }
    for (const listener of this.listeners) listener(this.current);
  }
}

export const visualTreatmentSettings = new VisualTreatmentSettings();
