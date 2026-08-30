export interface SpinRingOverride {
  heightOffset: number;
  radiusScale: number;
  lineColorA: number;
  lineColorB: number;
  glowColorA: number;
  glowColorB: number;
  colorPulsePhase: number;
}

/** Browser mirror of Unity's SpinOrbitalRingSettings. */
export interface SpinRingSettingsValue {
  ringCount: number;
  segmentCount: number;
  seed: number;
  radiusScale: number;
  verticalSpread: number;
  minimumTiltDegrees: number;
  maximumTiltDegrees: number;
  selfSpinRadiansPerSecond: number;
  ringInner: number;
  ringOuter: number;
  ringLine: number;
  ringGlow: number;
  ringBright: number;
  alpha: number;
  vary: number;
  sharedLow: number;
  sharedLowRate: number;
  sharedMid: number;
  sharedMidRate: number;
  breathe: number;
  breatheRate: number;
  wavyAmp: number;
  wavyFreq: number;
  wavyRate: number;
  jagAmp: number;
  jagFreq: number;
  jagRate: number;
  depth: number;
  spin: number;
  spinDiff: number;
  swallow: number;
  swallowTo: number;
  swallowFrom: number;
  current: number;
  currentRate: number;
  pulse: number;
  pulseRate: number;
  lineColor: number;
  glowColor: number;
  coolLineColor: number;
  coolGlowColor: number;
  cycleRate: number;
  whiteMix: number;
  ringOverrides: SpinRingOverride[];
}

export interface SavedSpinRingTuning {
  readonly version: 1;
  readonly settings: SpinRingSettingsValue;
}

export const SPIN_RING_STORAGE_KEY = "solProtoSpinOrbitalRingTuning.v1";
export const SPIN_MODEL_PATH = "spin/whirlwind-vixen.glb";
export const SPIN_MODEL_TEXTURE_PATH = "spin/whirlwind-vixen.webp";
export const SPIN_RING_MAX_OVERRIDES = 8;
export const SPIN_PRESENTATION_HZ = 60;
export const SPIN_RING_LINGER_TICKS = 15;

const canonicalOverrides: readonly Readonly<SpinRingOverride>[] = [
  { heightOffset: 1, radiusScale: 0.7150872945785523, lineColorA: 16774313, lineColorB: 16772017, glowColorA: 16747264, glowColorB: 16751872, colorPulsePhase: 0 },
  { heightOffset: 0.8360728025436401, radiusScale: 1.139540433883667, lineColorA: 16759625, lineColorB: 16748888, glowColorA: 16740869, glowColorB: 16750342, colorPulsePhase: 0 },
  { heightOffset: 0.5931559801101685, radiusScale: 1.5776262283325196, lineColorA: 16760396, lineColorB: 16741492, glowColorA: 16731136, glowColorB: 16739584, colorPulsePhase: 0 },
  { heightOffset: 0.49090576171875, radiusScale: 1.229990005493164, lineColorA: 15177727, lineColorB: 9598719, glowColorA: 8915711, glowColorB: 10223871, colorPulsePhase: 0 },
  { heightOffset: -0.668890118598938, radiusScale: 0.6939601302146912, lineColorA: 12550143, lineColorB: 10119423, glowColorA: 12779775, glowColorB: 5570815, colorPulsePhase: 0 },
  { heightOffset: -1, radiusScale: 0.5, lineColorA: 10524335, lineColorB: 8359573, glowColorA: 8026746, glowColorB: 5066061, colorPulsePhase: 0 },
  { heightOffset: 0, radiusScale: 1, lineColorA: 16773594, lineColorB: 14218495, glowColorA: 16736864, glowColorB: 6721023, colorPulsePhase: 0 },
  { heightOffset: 0, radiusScale: 1, lineColorA: 16773594, lineColorB: 14218495, glowColorA: 16736864, glowColorB: 6721023, colorPulsePhase: 0 },
];

// Approved Unity tuning serialized by SpinRingTuning.unity and the saved
// version-1 look-dev file. Older Unity tests still contain superseded values.
export const DEFAULT_SPIN_RING_SETTINGS: Readonly<SpinRingSettingsValue> =
  Object.freeze({
    ringCount: 6,
    segmentCount: 22,
    seed: 62,
    radiusScale: 1.284499168395996,
    verticalSpread: 0,
    minimumTiltDegrees: 3.8228156566619875,
    maximumTiltDegrees: 6.008512496948242,
    selfSpinRadiansPerSecond: 7.508416652679443,
    ringInner: 0.6499999761581421,
    ringOuter: 0.9500410556793213,
    ringLine: 0.04011207073926926,
    ringGlow: 0.18000000715255738,
    ringBright: 4,
    alpha: 1,
    vary: 0.22602605819702149,
    sharedLow: 0.00800000037997961,
    sharedLowRate: 0,
    sharedMid: 0.018647870048880578,
    sharedMidRate: 1.1208343505859376,
    breathe: 0.007108653429895639,
    breatheRate: 0,
    wavyAmp: 0.0036084987223148348,
    wavyFreq: 2.5489373207092287,
    wavyRate: 0.82025146484375,
    jagAmp: 0,
    jagFreq: 4.44208288192749,
    jagRate: -1.7192716598510743,
    depth: 2,
    spin: 0,
    spinDiff: 0,
    swallow: 0,
    swallowTo: 0.009999999776482582,
    swallowFrom: 1.0097004175186158,
    current: 0,
    currentRate: 0,
    pulse: 1.3020074367523194,
    pulseRate: 16,
    lineColor: 16773594,
    glowColor: 16736864,
    coolLineColor: 14218495,
    coolGlowColor: 6721023,
    cycleRate: 10.851839065551758,
    whiteMix: 0,
    ringOverrides: Object.freeze(
      canonicalOverrides.map((value) => Object.freeze({ ...value })),
    ) as unknown as SpinRingOverride[],
  });

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));
const packed = (value: number): number => (Math.round(value) & 0xffffff) >>> 0;
const repeat01 = (value: number): number => ((value % 1) + 1) % 1;

export function copySpinRingSettings(
  value: Readonly<SpinRingSettingsValue>,
): SpinRingSettingsValue {
  return {
    ...value,
    ringOverrides: value.ringOverrides.map((override) => ({ ...override })),
  };
}

function fallbackOverride(settings: Readonly<SpinRingSettingsValue>): SpinRingOverride {
  return {
    heightOffset: 0,
    radiusScale: 1,
    lineColorA: settings.lineColor,
    lineColorB: settings.coolLineColor,
    glowColorA: settings.glowColor,
    glowColorB: settings.coolGlowColor,
    colorPulsePhase: 0,
  };
}

/** Apply SpinOrbitalRingSettings.CopyClamped() ranges exactly. */
export function clampSpinRingSettings(
  input: Partial<SpinRingSettingsValue>,
): SpinRingSettingsValue {
  const d = DEFAULT_SPIN_RING_SETTINGS;
  const n = (key: keyof SpinRingSettingsValue): number =>
    finite(input[key], d[key] as number);
  const out = copySpinRingSettings({ ...d, ...input } as SpinRingSettingsValue);
  out.ringCount = Math.round(clamp(n("ringCount"), 1, 8));
  out.segmentCount = Math.round(clamp(n("segmentCount"), 8, 48));
  out.seed = Math.round(clamp(n("seed"), 0, 999));
  out.radiusScale = clamp(n("radiusScale"), 0.8, 1.6);
  out.verticalSpread = clamp(n("verticalSpread"), 0, 0.8);
  out.minimumTiltDegrees = clamp(n("minimumTiltDegrees"), 0, 80);
  out.maximumTiltDegrees = clamp(n("maximumTiltDegrees"), out.minimumTiltDegrees, 80);
  out.selfSpinRadiansPerSecond = clamp(n("selfSpinRadiansPerSecond"), -60, 60);
  out.ringInner = clamp(n("ringInner"), 0.65, 1.5);
  out.ringOuter = clamp(n("ringOuter"), out.ringInner, 1.5);
  out.ringLine = clamp(n("ringLine"), 0.005, 0.06);
  out.ringGlow = clamp(n("ringGlow"), out.ringLine, 0.18);
  out.ringBright = clamp(n("ringBright"), 0, 4);
  out.alpha = clamp(n("alpha"), 0, 1);
  out.vary = clamp(n("vary"), 0, 0.5);
  out.sharedLow = clamp(n("sharedLow"), 0, 0.04);
  out.sharedLowRate = clamp(n("sharedLowRate"), -16, 16);
  out.sharedMid = clamp(n("sharedMid"), 0, 0.04);
  out.sharedMidRate = clamp(n("sharedMidRate"), -16, 16);
  out.breathe = clamp(n("breathe"), 0, 0.05);
  out.breatheRate = clamp(n("breatheRate"), 0, 6);
  out.wavyAmp = clamp(n("wavyAmp"), 0, 0.08);
  out.wavyFreq = clamp(n("wavyFreq"), 1, 24);
  out.wavyRate = clamp(n("wavyRate"), -16, 16);
  out.jagAmp = clamp(n("jagAmp"), 0, 0.08);
  out.jagFreq = clamp(n("jagFreq"), 1, 24);
  out.jagRate = clamp(n("jagRate"), -16, 16);
  out.depth = clamp(n("depth"), 0.2, 2);
  out.spin = clamp(n("spin"), -6, 6);
  out.spinDiff = clamp(n("spinDiff"), -6, 6);
  out.swallow = clamp(n("swallow"), -2, 2);
  out.swallowTo = clamp(n("swallowTo"), 0.01, 1.08);
  out.swallowFrom = clamp(n("swallowFrom"), out.swallowTo + 0.02, 2);
  out.current = clamp(n("current"), -2, 2);
  out.currentRate = clamp(n("currentRate"), -16, 16);
  out.pulse = clamp(n("pulse"), -2, 2);
  out.pulseRate = clamp(n("pulseRate"), -16, 16);
  out.lineColor = packed(n("lineColor"));
  out.glowColor = packed(n("glowColor"));
  out.coolLineColor = packed(n("coolLineColor"));
  out.coolGlowColor = packed(n("coolGlowColor"));
  out.cycleRate = clamp(n("cycleRate"), -16, 16);
  out.whiteMix = clamp(n("whiteMix"), 0, 1);

  const source = Array.isArray(input.ringOverrides) ? input.ringOverrides : d.ringOverrides;
  out.ringOverrides = Array.from({ length: SPIN_RING_MAX_OVERRIDES }, (_, index) => {
    const fallback = canonicalOverrides[index] ?? fallbackOverride(out);
    const candidate = source[index] ?? fallback;
    const radius = finite(candidate.radiusScale, fallback.radiusScale);
    return {
      heightOffset: clamp(finite(candidate.heightOffset, fallback.heightOffset), -2, 2),
      // Version-1 files predating radiusScale deserialize it as zero in Unity;
      // preserve Unity's implicit 1× migration for those files.
      radiusScale: clamp(radius > 0 ? radius : 1, 0.5, 1.75),
      lineColorA: packed(finite(candidate.lineColorA, fallback.lineColorA)),
      lineColorB: packed(finite(candidate.lineColorB, fallback.lineColorB)),
      glowColorA: packed(finite(candidate.glowColorA, fallback.glowColorA)),
      glowColorB: packed(finite(candidate.glowColorB, fallback.glowColorB)),
      colorPulsePhase: repeat01(finite(candidate.colorPulsePhase, fallback.colorPulsePhase)),
    };
  });
  return out;
}

export function createPostSpinRingSettings(
  active: Readonly<SpinRingSettingsValue>,
): SpinRingSettingsValue {
  return clampSpinRingSettings({
    ...copySpinRingSettings(active),
    swallow: 0,
    swallowTo: 0.01,
    swallowFrom: 1.01,
    current: 1.188,
    currentRate: 16,
    pulse: 0.892,
    pulseRate: 16,
    cycleRate: 10.85,
    whiteMix: 0,
    alpha: 1,
  });
}

type Listener = (value: Readonly<SpinRingSettingsValue>) => void;

function readStored(): SpinRingSettingsValue {
  if (typeof localStorage === "undefined")
    return copySpinRingSettings(DEFAULT_SPIN_RING_SETTINGS);
  try {
    const source = localStorage.getItem(SPIN_RING_STORAGE_KEY);
    if (!source) return copySpinRingSettings(DEFAULT_SPIN_RING_SETTINGS);
    const parsed = JSON.parse(source) as Partial<SavedSpinRingTuning>;
    if (parsed.version !== 1 || !parsed.settings) throw new Error("unsupported spin tuning");
    return clampSpinRingSettings(parsed.settings);
  } catch (error) {
    console.warn("Ignoring invalid spin-ring tuning", error);
    return copySpinRingSettings(DEFAULT_SPIN_RING_SETTINGS);
  }
}

export class SpinRingSettings {
  private current = readStored();
  private readonly listeners = new Set<Listener>();

  get value(): Readonly<SpinRingSettingsValue> {
    return this.current;
  }

  patch(patch: Partial<SpinRingSettingsValue>): void {
    this.current = clampSpinRingSettings({ ...this.current, ...patch });
    this.persistAndNotify();
  }

  updateRing(index: number, patch: Partial<SpinRingOverride>): void {
    const rings = this.current.ringOverrides.map((ring) => ({ ...ring }));
    const selected = Math.max(0, Math.min(SPIN_RING_MAX_OVERRIDES - 1, Math.round(index)));
    rings[selected] = { ...rings[selected], ...patch };
    this.patch({ ringOverrides: rings });
  }

  replace(value: Partial<SpinRingSettingsValue>): void {
    this.current = clampSpinRingSettings(value);
    this.persistAndNotify();
  }

  reset(): void {
    this.current = copySpinRingSettings(DEFAULT_SPIN_RING_SETTINGS);
    this.persistAndNotify();
  }

  serialize(pretty = true): string {
    return JSON.stringify(
      { version: 1, settings: this.current } satisfies SavedSpinRingTuning,
      null,
      pretty ? 2 : undefined,
    );
  }

  importJson(source: string): void {
    const parsed = JSON.parse(source) as Partial<SavedSpinRingTuning>;
    if (parsed.version !== 1 || !parsed.settings)
      throw new Error("Expected a version 1 spin orbital-ring tuning file.");
    this.replace(parsed.settings);
  }

  subscribe(listener: Listener, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private persistAndNotify(): void {
    try {
      localStorage.setItem(SPIN_RING_STORAGE_KEY, this.serialize(false));
    } catch {
      /* Live tuning remains available when storage is blocked or full. */
    }
    for (const listener of this.listeners) listener(this.current);
  }
}

export const spinRingSettings = new SpinRingSettings();
