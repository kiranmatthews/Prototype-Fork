export interface VisualTreatmentValue {
  enabled: boolean;
  exposure: number;
  contrast: number;
  saturation: number;
  tintR: number;
  tintG: number;
  tintB: number;
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  vignetteIntensity: number;
  vignetteSmoothness: number;
}

export interface SavedVisualTreatment {
  readonly version: 1;
  readonly settings: VisualTreatmentValue;
}

export const VISUAL_TREATMENT_STORAGE_KEY = "solProtoVisualTreatment.v1";
export const DEFAULT_VISUAL_TREATMENT: Readonly<VisualTreatmentValue> =
  Object.freeze({
    enabled: false,
    exposure: 0,
    contrast: 1,
    saturation: 1,
    tintR: 1,
    tintG: 1,
    tintB: 1,
    bloomIntensity: 0,
    bloomThreshold: 0.72,
    bloomRadius: 4,
    vignetteIntensity: 0,
    vignetteSmoothness: 0.35,
  });

// Reference looks are deliberately global presets, not level-owned state.
// The panel can reproduce the Unity authoring values today without creating
// six competing post stacks; level-specific persistence can layer on later.
export const VISUAL_TREATMENT_PRESETS = Object.freeze({
  neutral: DEFAULT_VISUAL_TREATMENT,
  coast: Object.freeze({
    ...DEFAULT_VISUAL_TREATMENT,
    enabled: true,
    bloomIntensity: 0.3,
    bloomThreshold: 1,
    bloomRadius: 6,
  }),
  bonus: Object.freeze({
    ...DEFAULT_VISUAL_TREATMENT,
    enabled: true,
    exposure: -0.18,
    contrast: 1.05,
    saturation: 0.96,
    tintR: 0.72,
    tintG: 0.88,
    tintB: 1,
    bloomIntensity: 0.68,
    bloomThreshold: 0.78,
    bloomRadius: 8.5,
    vignetteIntensity: 0.46,
    vignetteSmoothness: 0.78,
  }),
  meshy: Object.freeze({
    ...DEFAULT_VISUAL_TREATMENT,
    enabled: true,
    exposure: -0.22,
    contrast: 1.22,
    saturation: 1.18,
    bloomIntensity: 0.16,
    bloomThreshold: 1.05,
    bloomRadius: 6,
    vignetteIntensity: 0.22,
    vignetteSmoothness: 0.72,
  }),
} satisfies Record<string, Readonly<VisualTreatmentValue>>);

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

export function clampVisualTreatment(
  input: Partial<VisualTreatmentValue>,
): VisualTreatmentValue {
  const d = DEFAULT_VISUAL_TREATMENT;
  const n = (key: keyof VisualTreatmentValue): number => {
    const value = input[key];
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : (d[key] as number);
  };
  return {
    enabled: input.enabled === true,
    exposure: clamp(n("exposure"), -2, 2),
    contrast: clamp(n("contrast"), 0.25, 2),
    saturation: clamp(n("saturation"), 0, 2),
    tintR: clamp(n("tintR"), 0, 2),
    tintG: clamp(n("tintG"), 0, 2),
    tintB: clamp(n("tintB"), 0, 2),
    bloomIntensity: clamp(n("bloomIntensity"), 0, 2),
    bloomThreshold: clamp(n("bloomThreshold"), 0, 2),
    bloomRadius: clamp(n("bloomRadius"), 0.5, 16),
    vignetteIntensity: clamp(n("vignetteIntensity"), 0, 1),
    vignetteSmoothness: clamp(n("vignetteSmoothness"), 0.05, 1),
  };
}

type Listener = (value: Readonly<VisualTreatmentValue>) => void;

function readStored(): VisualTreatmentValue {
  if (typeof localStorage === "undefined")
    return clampVisualTreatment(DEFAULT_VISUAL_TREATMENT);
  try {
    const source = localStorage.getItem(VISUAL_TREATMENT_STORAGE_KEY);
    if (!source) return clampVisualTreatment(DEFAULT_VISUAL_TREATMENT);
    const parsed = JSON.parse(source) as Partial<SavedVisualTreatment>;
    if (parsed.version !== 1 || !parsed.settings)
      throw new Error("unsupported visual-treatment tuning file");
    return clampVisualTreatment(parsed.settings);
  } catch (error) {
    console.warn("Ignoring invalid visual-treatment tuning", error);
    return clampVisualTreatment(DEFAULT_VISUAL_TREATMENT);
  }
}

export class VisualTreatmentSettings {
  private current = readStored();
  private readonly listeners = new Set<Listener>();

  get value(): Readonly<VisualTreatmentValue> {
    return this.current;
  }

  patch(patch: Partial<VisualTreatmentValue>): void {
    this.current = clampVisualTreatment({ ...this.current, ...patch });
    this.persistAndNotify();
  }

  reset(): void {
    this.current = clampVisualTreatment(DEFAULT_VISUAL_TREATMENT);
    this.persistAndNotify();
  }

  applyPreset(value: Readonly<VisualTreatmentValue>): void {
    this.current = clampVisualTreatment(value);
    this.persistAndNotify();
  }

  subscribe(listener: Listener, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private persistAndNotify(): void {
    try {
      localStorage.setItem(
        VISUAL_TREATMENT_STORAGE_KEY,
        JSON.stringify({ version: 1, settings: this.current }),
      );
    } catch {
      /* Private browsing can deny storage; live tuning still works. */
    }
    for (const listener of this.listeners) listener(this.current);
  }
}

export const visualTreatmentSettings = new VisualTreatmentSettings();
