export interface SkateboardColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Browser mirror of Unity's SourceSkateboardSettings. Values are metres in
 * board-local space; the directional nose points along local +Z.
 */
export interface SkateboardSettingsValue {
  overallScale: number;
  deckHalfWidth: number;
  deckTailLength: number;
  deckNoseLength: number;
  centralTailTransition: number;
  centralNoseTransition: number;
  tailTaperLongitudinalExponent: number;
  tailTaperTransverseExponent: number;
  noseTaperLongitudinalExponent: number;
  noseTaperTransverseExponent: number;
  tailKickRise: number;
  noseKickRise: number;
  tailKickStart: number;
  noseKickStart: number;
  concaveDepth: number;
  concaveFadeStart: number;
  concaveTipMultiplier: number;
  railBevelRadius: number;
  railBevelSegments: number;
  deckLengthSegments: number;
  deckWidthSegments: number;
  deckThickness: number;
  wheelRadius: number;
  wheelWidth: number;
  wheelTrackHalfWidth: number;
  frontTruckLocalZ: number;
  rearTruckLocalZ: number;
  frontTruckRotationXDegrees: number;
  frontTruckRotationYDegrees: number;
  frontTruckRotationZDegrees: number;
  rearTruckRotationXDegrees: number;
  rearTruckRotationYDegrees: number;
  rearTruckRotationZDegrees: number;
  truckBaseplateWidth: number;
  truckBaseplateLength: number;
  truckBaseplateThickness: number;
  truckHangerRadius: number;
  boardToGroundDistance: number;
  artworkScaleX: number;
  artworkScaleY: number;
  /** Legacy version-1 import alias; normalized settings never serialize it. */
  artworkScale?: number;
  plywoodLightColor: SkateboardColor;
  plywoodDarkColor: SkateboardColor;
  topWear: number;
  bottomWear: number;
  topWearRoughness: number;
  bottomWearRoughness: number;
  bottomArtworkPath: string;
  truckModelPath: string;
  wheelModelPath: string;
  replacementTruckScale: number;
  replacementWheelScale: number;
}

export interface SavedSkateboardTuning {
  readonly version: 1;
  readonly settings: SkateboardSettingsValue;
}

export const SKATEBOARD_STORAGE_KEY = "solProtoSkateboardTuning.v1";
export const SKATEBOARD_DEFAULT_ARTWORK =
  "skateboard/surf-cruiser-orange-sun.webp";
export const SKATEBOARD_DEFAULT_TRUCK = "skateboard/skateboard-truck.glb";
/** Immutable calibration denominator for the normalized owner-supplied GLB. */
export const SKATEBOARD_TRUCK_GLTF_REFERENCE_SCALE = 2.2098000049591066;

// Canonical 2026-08-30 Board Lab export. The versioned JSON is the authority
// for the procedural deck, imported truck orientation/scale, wheels, artwork
// and plywood finish; older Unity/browser defaults are intentionally obsolete.
export const DEFAULT_SKATEBOARD_SETTINGS: Readonly<SkateboardSettingsValue> =
  Object.freeze({
    overallScale: 1,
    deckHalfWidth: 0.23761481046676637,
    deckTailLength: 0.991284191608429,
    deckNoseLength: 0.991284191608429,
    centralTailTransition: -0.5091743469238281,
    centralNoseTransition: 0.31963270902633669,
    tailTaperLongitudinalExponent: 1.7946972846984864,
    tailTaperTransverseExponent: 3.4346325397491457,
    noseTaperLongitudinalExponent: 2.9452407360076906,
    noseTaperTransverseExponent: 1.5014044046401978,
    tailKickRise: 0.035407111048698428,
    noseKickRise: 0.021646762266755105,
    tailKickStart: -0.7771100401878357,
    noseKickStart: 0.6000000238418579,
    concaveDepth: 0.020002305507659913,
    concaveFadeStart: 0.550000011920929,
    concaveTipMultiplier: 0.1499999761581421,
    railBevelRadius: 0.00991834793239832,
    railBevelSegments: 1,
    deckLengthSegments: 100,
    deckWidthSegments: 12,
    deckThickness: 0.02991834655404091,
    wheelRadius: 0.071,
    wheelWidth: 0.101,
    wheelTrackHalfWidth: 0.202,
    frontTruckLocalZ: 0.6424427032470703,
    rearTruckLocalZ: -0.6424426436424255,
    frontTruckRotationXDegrees: 90,
    frontTruckRotationYDegrees: 0,
    frontTruckRotationZDegrees: 0,
    rearTruckRotationXDegrees: 90,
    rearTruckRotationYDegrees: 0,
    rearTruckRotationZDegrees: 0,
    truckBaseplateWidth: 0.051,
    truckBaseplateLength: 0.05000000074505806,
    truckBaseplateThickness: 0.01,
    truckHangerRadius: 0.01,
    boardToGroundDistance: 0.234,
    artworkScaleX: 1.37,
    artworkScaleY: 1.37,
    plywoodLightColor: Object.freeze({
      r: 0.5098039215686274,
      g: 0.3843137254901961,
      b: 0.20784313725490197,
      a: 1,
    }),
    plywoodDarkColor: Object.freeze({
      r: 0.29411764705882354,
      g: 0.13725490196078433,
      b: 0.047058823529411764,
      a: 1,
    }),
    topWear: 0,
    bottomWear: 1,
    topWearRoughness: 0.322637677192688,
    bottomWearRoughness: 0.8415369391441345,
    bottomArtworkPath: SKATEBOARD_DEFAULT_ARTWORK,
    truckModelPath: SKATEBOARD_DEFAULT_TRUCK,
    wheelModelPath: "procedural",
    replacementTruckScale: 4.85,
    replacementWheelScale: 1,
  });

type Listener = (value: Readonly<SkateboardSettingsValue>) => void;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));

function copyColor(value: SkateboardColor): SkateboardColor {
  return { r: value.r, g: value.g, b: value.b, a: value.a };
}

export function copySkateboardSettings(
  value: Readonly<SkateboardSettingsValue>,
): SkateboardSettingsValue {
  return {
    ...value,
    plywoodLightColor: copyColor(value.plywoodLightColor),
    plywoodDarkColor: copyColor(value.plywoodDarkColor),
  };
}

function clampedColor(
  value: Partial<SkateboardColor> | null | undefined,
  fallback: SkateboardColor,
): SkateboardColor {
  return {
    r: clamp(Number(value?.r ?? fallback.r), 0, 1),
    g: clamp(Number(value?.g ?? fallback.g), 0, 1),
    b: clamp(Number(value?.b ?? fallback.b), 0, 1),
    a: 1,
  };
}

/** Apply the same safety ranges as SourceSkateboardSettings.Clamp(). */
export function clampSkateboardSettings(
  input: Partial<SkateboardSettingsValue>,
): SkateboardSettingsValue {
  const d = DEFAULT_SKATEBOARD_SETTINGS;
  const n = (key: keyof SkateboardSettingsValue): number => {
    const candidate = input[key];
    return typeof candidate === "number" && Number.isFinite(candidate)
      ? candidate
      : (d[key] as number);
  };
  const artworkN = (key: "artworkScaleX" | "artworkScaleY"): number => {
    const candidate = input[key];
    if (typeof candidate === "number" && Number.isFinite(candidate))
      return candidate;
    const legacy = input.artworkScale;
    return typeof legacy === "number" && Number.isFinite(legacy)
      ? legacy
      : d[key];
  };
  const out = copySkateboardSettings({ ...d, ...input } as SkateboardSettingsValue);
  delete out.artworkScale;
  out.overallScale = clamp(n("overallScale"), 0.25, 3);
  out.deckHalfWidth = clamp(n("deckHalfWidth"), 0.05, 0.65);
  out.deckTailLength = clamp(n("deckTailLength"), 0.2, 1.8);
  out.deckNoseLength = clamp(n("deckNoseLength"), 0.2, 1.8);
  out.centralTailTransition = clamp(n("centralTailTransition"), -0.9, -0.1);
  out.centralNoseTransition = clamp(n("centralNoseTransition"), 0.1, 0.9);
  out.tailTaperLongitudinalExponent = clamp(n("tailTaperLongitudinalExponent"), 0.25, 8);
  out.tailTaperTransverseExponent = clamp(n("tailTaperTransverseExponent"), 0.25, 8);
  out.noseTaperLongitudinalExponent = clamp(n("noseTaperLongitudinalExponent"), 0.25, 8);
  out.noseTaperTransverseExponent = clamp(n("noseTaperTransverseExponent"), 0.25, 8);
  out.tailKickRise = clamp(n("tailKickRise"), 0, 0.25);
  out.noseKickRise = clamp(n("noseKickRise"), 0, 0.25);
  out.tailKickStart = clamp(n("tailKickStart"), -0.95, -0.05);
  out.noseKickStart = clamp(n("noseKickStart"), 0.05, 0.95);
  out.concaveDepth = clamp(n("concaveDepth"), 0, 0.05);
  out.concaveFadeStart = clamp(n("concaveFadeStart"), 0.1, 0.95);
  out.concaveTipMultiplier = clamp(n("concaveTipMultiplier"), 0, 1);
  out.deckThickness = clamp(n("deckThickness"), 0.003, 0.04);
  out.railBevelRadius = clamp(
    n("railBevelRadius"),
    0,
    Math.min(out.deckThickness * 0.5, out.deckHalfWidth * 0.4),
  );
  out.railBevelSegments = Math.round(clamp(n("railBevelSegments"), 1, 8));
  out.deckLengthSegments = Math.round(clamp(n("deckLengthSegments"), 4, 256));
  out.deckWidthSegments = Math.round(clamp(n("deckWidthSegments"), 3, 64));
  out.wheelRadius = clamp(n("wheelRadius"), 0.025, 0.2);
  out.wheelWidth = clamp(n("wheelWidth"), 0.025, 0.3);
  out.wheelTrackHalfWidth = clamp(n("wheelTrackHalfWidth"), 0.05, 0.65);
  out.frontTruckLocalZ = clamp(
    n("frontTruckLocalZ"),
    0.05,
    out.deckNoseLength - 0.05,
  );
  out.rearTruckLocalZ = clamp(
    n("rearTruckLocalZ"),
    -out.deckTailLength + 0.05,
    -0.05,
  );
  out.frontTruckRotationXDegrees = clamp(n("frontTruckRotationXDegrees"), -180, 180);
  out.frontTruckRotationYDegrees = clamp(n("frontTruckRotationYDegrees"), -180, 180);
  out.frontTruckRotationZDegrees = clamp(n("frontTruckRotationZDegrees"), -180, 180);
  out.rearTruckRotationXDegrees = clamp(n("rearTruckRotationXDegrees"), -180, 180);
  out.rearTruckRotationYDegrees = clamp(n("rearTruckRotationYDegrees"), -180, 180);
  out.rearTruckRotationZDegrees = clamp(n("rearTruckRotationZDegrees"), -180, 180);
  out.truckBaseplateWidth = clamp(n("truckBaseplateWidth"), 0.03, 0.6);
  out.truckBaseplateLength = clamp(n("truckBaseplateLength"), 0.02, 0.4);
  out.truckBaseplateThickness = clamp(n("truckBaseplateThickness"), 0.003, 0.12);
  out.truckHangerRadius = clamp(n("truckHangerRadius"), 0.004, 0.08);
  out.boardToGroundDistance = clamp(n("boardToGroundDistance"), 0.04, 0.6);
  out.artworkScaleX = clamp(artworkN("artworkScaleX"), 0.2, 3);
  out.artworkScaleY = clamp(artworkN("artworkScaleY"), 0.2, 3);
  out.plywoodLightColor = clampedColor(input.plywoodLightColor, d.plywoodLightColor);
  out.plywoodDarkColor = clampedColor(input.plywoodDarkColor, d.plywoodDarkColor);
  out.topWear = clamp(n("topWear"), 0, 1);
  out.bottomWear = clamp(n("bottomWear"), 0, 1);
  out.topWearRoughness = clamp(n("topWearRoughness"), 0, 1);
  out.bottomWearRoughness = clamp(n("bottomWearRoughness"), 0, 1);
  out.bottomArtworkPath = String(input.bottomArtworkPath ?? d.bottomArtworkPath);
  out.truckModelPath = String(input.truckModelPath ?? d.truckModelPath);
  out.wheelModelPath = String(input.wheelModelPath ?? d.wheelModelPath);
  out.replacementTruckScale = clamp(n("replacementTruckScale"), 0.01, 10);
  out.replacementWheelScale = clamp(n("replacementWheelScale"), 0.01, 10);
  return out;
}

function readStoredSettings(): SkateboardSettingsValue {
  if (typeof localStorage === "undefined")
    return copySkateboardSettings(DEFAULT_SKATEBOARD_SETTINGS);
  try {
    const source = localStorage.getItem(SKATEBOARD_STORAGE_KEY);
    if (!source) return copySkateboardSettings(DEFAULT_SKATEBOARD_SETTINGS);
    const parsed = JSON.parse(source) as Partial<SavedSkateboardTuning>;
    if (parsed.version !== 1 || !parsed.settings) throw new Error("unsupported tuning file");
    return clampSkateboardSettings(parsed.settings);
  } catch (error) {
    console.warn("Ignoring invalid skateboard tuning", error);
    return copySkateboardSettings(DEFAULT_SKATEBOARD_SETTINGS);
  }
}

export class SkateboardSettings {
  private current = readStoredSettings();
  private readonly listeners = new Set<Listener>();

  get value(): Readonly<SkateboardSettingsValue> {
    return this.current;
  }

  patch(patch: Partial<SkateboardSettingsValue>): void {
    this.current = clampSkateboardSettings({ ...this.current, ...patch });
    this.persistAndNotify();
  }

  replace(value: Partial<SkateboardSettingsValue>): void {
    this.current = clampSkateboardSettings(value);
    this.persistAndNotify();
  }

  reset(): void {
    this.current = copySkateboardSettings(DEFAULT_SKATEBOARD_SETTINGS);
    this.persistAndNotify();
  }

  serialize(pretty = true): string {
    return JSON.stringify(
      { version: 1, settings: this.current } satisfies SavedSkateboardTuning,
      null,
      pretty ? 2 : undefined,
    );
  }

  importJson(source: string): void {
    const parsed = JSON.parse(source) as Partial<SavedSkateboardTuning>;
    if (parsed.version !== 1 || !parsed.settings)
      throw new Error("Expected a version 1 skateboard tuning file.");
    this.replace(parsed.settings);
  }

  subscribe(listener: Listener, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }

  private persistAndNotify(): void {
    try {
      localStorage.setItem(SKATEBOARD_STORAGE_KEY, this.serialize(false));
    } catch {
      /* Private browsing can deny storage; live tuning still works. */
    }
    for (const listener of this.listeners) listener(this.current);
  }
}

export const skateboardSettings = new SkateboardSettings();
