// THE UNITY OCEAN STUDIO — #waterstudio. Live controls for every audited
// MatrixRex ocean value plus the render-pass/debug switches. Settings use a
// versioned key so retired CoastWater tunings can never leak into this port.
import { readForkStudioDraft } from './localGameStorage';
import {
  CoastWater,
  UNITY_OCEAN_DEFAULTS,
  type UnityOceanParams,
} from "./unityOcean";
import {
  btn,
  el,
  injectStudioCss,
  note,
  sec,
  sliderRow,
  toT,
} from "./studiokit";

const STORE = "solProtoUnityOceanStudioV1";
const STORE_VERSION = 1;

interface Opts {
  getWater: () => CoastWater | null;
  onClose: () => void;
}

type ColorKey = "shallow" | "deep" | "peak" | "shadow" | "specular" | "intersection";
type ColorChannel = "r" | "g" | "b" | "a";
type NumericKey = {
  [K in keyof UnityOceanParams]: UnityOceanParams[K] extends number ? K : never;
}[keyof UnityOceanParams];
type FieldPath = readonly [NumericKey] | readonly [ColorKey, ColorChannel];

interface Field {
  path: FieldPath;
  label: string;
  lo: number;
  hi: number;
  step: number;
}

interface Group {
  title: string;
  fields: Field[];
}

const n = (
  key: NumericKey,
  label: string,
  lo: number,
  hi: number,
  step: number,
): Field => ({ path: [key], label, lo, hi, step });

const c = (
  key: ColorKey,
  channel: ColorChannel,
  label: string,
  hi = 1,
): Field => ({ path: [key, channel], label, lo: 0, hi, step: 0.001 });

const rgba = (key: ColorKey, label: string, rgbHi = 1): Field[] => [
  c(key, "r", `${label} R`, rgbHi),
  c(key, "g", `${label} G`, rgbHi),
  c(key, "b", `${label} B`, rgbHi),
  c(key, "a", `${label} A`),
];

const GROUPS: Group[] = [
  {
    title: "GERSTNER WAVE 1",
    fields: [
      n("wave1Length", "length", 1, 120, 0.1),
      n("wave1Height", "height", 0, 2, 0.001),
      n("wave1Speed", "speed", -3, 3, 0.01),
      n("wave1DirX", "direction X", -1, 1, 0.001),
      n("wave1DirZ", "direction Z", -1, 1, 0.001),
      n("wave1Sharpness", "sharpness", 0, 2, 0.001),
    ],
  },
  {
    title: "GERSTNER WAVE 2",
    fields: [
      n("wave2Length", "length", 1, 120, 0.1),
      n("wave2Height", "height", 0, 2, 0.001),
      n("wave2Speed", "speed", -3, 3, 0.01),
      n("wave2DirX", "direction X", -1, 1, 0.001),
      n("wave2DirZ", "direction Z", -1, 1, 0.001),
      n("wave2Sharpness", "sharpness", 0, 2, 0.001),
    ],
  },
  {
    title: "BASE / DEPTH",
    fields: [
      ...rgba("shallow", "shallow"),
      ...rgba("deep", "deep"),
      n("depthDistance", "depth distance", 0, 20, 0.001),
      n("distanceStart", "distance start", 0, 100, 0.01),
      n("distanceFade", "distance fade", 0.01, 200, 0.01),
      n("shoreFadeSmoothness", "shore fade", 0, 1, 0.001),
      ...rgba("peak", "wave peak", 2),
    ],
  },
  {
    title: "NORMALS / SPECULAR",
    fields: [
      n("normalStrength", "normal strength", 0, 20, 0.01),
      n("normalPan", "normal pan", -4, 4, 0.01),
      n("normalScale", "normal scale", 0.01, 10, 0.001),
      n("normalDistanceStrength", "distance normal", 0, 20, 0.01),
      ...rgba("shadow", "shadow", 2),
      ...rgba("specular", "specular HDR", 40),
      n("specularSpread", "spec spread", 0, 2, 0.001),
      n("specularHardness", "spec hardness", 0, 1, 0.001),
      n("specularSize", "spec size", 0, 2, 0.001),
    ],
  },
  {
    title: "REFRACTION",
    fields: [
      n("refractionStrength", "strength", 0, 3, 0.001),
      n("refractionDistance", "distance", 0, 5, 0.001),
      n("refractionFade", "fade", 0, 5, 0.001),
    ],
  },
  {
    title: "REFLECTION",
    fields: [
      n("reflectionStrength", "strength", 0, 3, 0.001),
      n("reflectionFresnel", "fresnel", 0, 32, 0.01),
      n("reflectionDistortion", "distortion", 0, 5, 0.001),
    ],
  },
  {
    title: "CAUSTICS",
    fields: [
      n("causticsDepth", "depth", -20, 20, 0.01),
      n("causticsPan", "pan", -5, 5, 0.01),
      n("causticsScale", "scale", 0.01, 10, 0.01),
      n("causticsStrength", "strength", 0, 5, 0.001),
      n("causticsDistortion", "distortion", 0, 5, 0.001),
      n("causticsDistortionScale", "distort scale", 0, 10, 0.01),
      n("causticsStart", "distance start", 0, 100, 0.01),
      n("causticsFade", "distance fade", 0.01, 200, 0.01),
    ],
  },
  {
    title: "INTERSECTION / SHORELINE",
    fields: [
      ...rgba("intersection", "intersection", 4),
      n("intersectionWidth", "width", 0, 5, 0.001),
      n("intersectionDissolve", "dissolve", 0, 10, 0.001),
      n("intersectionScale", "scale", 0.01, 20, 0.01),
      n("intersectionTile", "tile", 0.01, 10, 0.01),
      n("intersectionPanX", "pan X", -5, 5, 0.001),
      n("intersectionPanY", "pan Y", -5, 5, 0.001),
      n("intersectionDistortion", "distortion", 0, 10, 0.001),
      n("intersectionSmoothness", "smoothness", 0, 3, 0.001),
      n("intersectionInvert", "invert", 0, 1, 0.001),
      n("intersectionGradient", "gradient", 0, 3, 0.001),
      n("intersectionEdgeFade", "edge fade", 0, 3, 0.001),
      n("shorelineEnabled", "shore enabled", 0, 1, 1),
      n("shorelineAlpha", "shore alpha", 0, 1, 0.001),
    ],
  },
];

const ALL_FIELDS = GROUPS.flatMap((group) => group.fields);

const DEBUG_KEYS = [
  "water",
  "horizon",
  "reflection",
  "prepass",
  "refraction",
  "caustics",
  "intersection",
  "freeze",
  "wireframe",
] as const;
type DebugKey = (typeof DEBUG_KEYS)[number];

const DEBUG_LABELS: Record<DebugKey, string> = {
  water: "WATER",
  horizon: "HORIZON",
  reflection: "REFLECT",
  prepass: "PREPASS",
  refraction: "REFRACT",
  caustics: "CAUSTICS",
  intersection: "INTERSECT",
  freeze: "FREEZE",
  wireframe: "WIRE",
};

type DebugOverrides = Partial<Record<DebugKey, boolean>>;

function cloneParams(source: UnityOceanParams): UnityOceanParams {
  return {
    ...source,
    shallow: { ...source.shallow },
    deep: { ...source.deep },
    peak: { ...source.peak },
    shadow: { ...source.shadow },
    specular: { ...source.specular },
    intersection: { ...source.intersection },
  };
}

function fieldValue(params: UnityOceanParams, field: Field): number {
  const data = params as unknown as Record<string, unknown>;
  if (field.path.length === 1) return data[field.path[0]] as number;
  const color = data[field.path[0]] as Record<string, number>;
  return color[field.path[1]];
}

function setFieldValue(params: UnityOceanParams, field: Field, value: number): void {
  const data = params as unknown as Record<string, unknown>;
  if (field.path.length === 1) {
    data[field.path[0]] = value;
    return;
  }
  const color = data[field.path[0]] as Record<string, number>;
  color[field.path[1]] = value;
}

function valueAtPath(source: unknown, path: FieldPath): unknown {
  if (!source || typeof source !== "object") return undefined;
  const data = source as Record<string, unknown>;
  const first = data[path[0]];
  if (path.length === 1) return first;
  if (!first || typeof first !== "object") return undefined;
  return (first as Record<string, unknown>)[path[1]];
}

function defaultDebug(water: CoastWater, key: DebugKey): boolean {
  if (key === "water" || key === "horizon") return true;
  if (key === "freeze" || key === "wireframe") return false;
  return water.stats.quality === "full";
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const box = document.createElement("textarea");
  box.value = text;
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  document.execCommand("copy");
  box.remove();
  return Promise.resolve();
}

export function openWaterStudio(opts: Opts): { frame: (dt: number) => void } {
  injectStudioCss();

  const params = cloneParams(UNITY_OCEAN_DEFAULTS);
  let debugOverrides: DebugOverrides = {};
  try {
    const saved = JSON.parse(readForkStudioDraft(localStorage, STORE, 'unityOceanStudioV1') ?? "null") as unknown;
    if (saved && typeof saved === "object") {
      const record = saved as Record<string, unknown>;
      if (record.version === STORE_VERSION) {
        for (const field of ALL_FIELDS) {
          const value = valueAtPath(record.params, field.path);
          if (typeof value === "number" && Number.isFinite(value)) {
            setFieldValue(params, field, value);
          }
        }
        if (record.debug && typeof record.debug === "object") {
          const debug = record.debug as Record<string, unknown>;
          for (const key of DEBUG_KEYS) {
            if (typeof debug[key] === "boolean") debugOverrides[key] = debug[key] as boolean;
          }
        }
      }
    }
  } catch {
    // Malformed or obsolete state is ignored; audited Unity defaults win.
  }

  const save = (): void => {
    localStorage.setItem(STORE, JSON.stringify({
      version: STORE_VERSION,
      params,
      debug: debugOverrides,
    }));
  };

  const applyParams = (water = opts.getWater()): void => {
    if (!water) return;
    Object.assign(water.params, cloneParams(params));
    water.markWavesDirty();
  };

  const applyDebug = (water = opts.getWater()): void => {
    if (!water) return;
    for (const key of DEBUG_KEYS) {
      const override = debugOverrides[key];
      if (override !== undefined) water.debug[key] = override;
    }
    // Debug-backed uniforms and visibility are synchronized by the same API
    // used for parameter changes, so toggles respond before the next frame.
    water.markWavesDirty();
  };

  const panel = el("div", "pst");
  panel.append(sec("UNITY OCEAN STUDIO"));
  const hint = note("open The Descent — audited MatrixRex values apply live");
  panel.append(hint);

  panel.append(sec("RENDER / DEBUG"));
  const debugRow = el("div", "pst-btns");
  const debugButtons = new Map<DebugKey, HTMLElement>();
  const refreshDebugButtons = (water = opts.getWater()): void => {
    for (const key of DEBUG_KEYS) {
      const on = debugOverrides[key] ?? (water ? water.debug[key] : key === "water" || key === "horizon");
      debugButtons.get(key)?.classList.toggle("pst-on", on);
    }
  };
  for (const key of DEBUG_KEYS) {
    const button = btn(DEBUG_LABELS[key], () => {
      const water = opts.getWater();
      const current = debugOverrides[key]
        ?? (water ? water.debug[key] : key === "water" || key === "horizon");
      debugOverrides[key] = !current;
      if (water) {
        water.debug[key] = !current;
        water.markWavesDirty();
      }
      refreshDebugButtons(water);
      save();
    });
    debugButtons.set(key, button);
    debugRow.append(button);
  }
  panel.append(debugRow);

  const stats = note("");
  stats.classList.add("pst-stat");
  panel.append(stats);

  const controlSetters: (() => void)[] = [];
  for (const group of GROUPS) {
    panel.append(sec(group.title));
    for (const field of group.fields) {
      const row = sliderRow(
        field.label,
        fieldValue(params, field),
        field.lo,
        field.hi,
        field.step,
        (value) => {
          setFieldValue(params, field, value);
          applyParams();
          save();
        },
      );
      const range = row.querySelector<HTMLInputElement>('input[type="range"]');
      const number = row.querySelector<HTMLInputElement>('input[type="number"]');
      controlSetters.push(() => {
        const value = fieldValue(params, field);
        if (number) number.value = String(value);
        if (range) {
          const curve = field.step >= 1 ? 1 : 3;
          range.value = String(toT(value, field.lo, field.hi, curve) * 1000);
        }
      });
      panel.append(row);
    }
  }

  panel.append(sec("PRESET"));
  const actions = el("div", "pst-btns");
  actions.append(
    btn("Copy JSON", (button) => {
      void copyText(JSON.stringify(params, null, 2)).then(() => {
        const old = button.textContent;
        button.textContent = "COPIED";
        window.setTimeout(() => { button.textContent = old; }, 900);
      });
    }),
    btn("Reset defaults", () => {
      const defaults = cloneParams(UNITY_OCEAN_DEFAULTS);
      for (const field of ALL_FIELDS) {
        setFieldValue(params, field, fieldValue(defaults, field));
      }
      debugOverrides = {};
      localStorage.removeItem(STORE);
      const water = opts.getWater();
      if (water) {
        for (const key of DEBUG_KEYS) water.debug[key] = defaultDebug(water, key);
      }
      applyParams(water);
      applyDebug(water);
      for (const refresh of controlSetters) refresh();
      refreshDebugButtons(water);
    }),
    btn("Close", () => {
      panel.remove();
      opts.onClose();
    }),
  );
  panel.append(actions);
  document.body.appendChild(panel);

  let last: CoastWater | null = null;
  let statTime = 0;
  let smoothFps = 60;
  refreshDebugButtons();

  return {
    frame(dt: number): void {
      const water = opts.getWater();
      if (water !== last) {
        last = water;
        hint.textContent = water
          ? "live — versioned autosave enabled; Copy JSON to bake"
          : "no Unity ocean in this level — open The Descent";
        if (water) {
          applyParams(water);
          applyDebug(water);
        }
        refreshDebugButtons(water);
      }

      if (dt > 0) smoothFps += (1 / dt - smoothFps) * Math.min(1, dt * 3);
      statTime += dt;
      if (water && statTime >= 0.35) {
        statTime = 0;
        const s = water.stats;
        const reflection = water.debug.reflection
          ? `${s.reflectionWidth}×${s.reflectionHeight} / ${s.reflectionRenders}`
          : "off";
        const prepass = water.debug.prepass
          ? `${s.prepassWidth}×${s.prepassHeight} / ${s.prepassRenders}`
          : "off";
        stats.textContent =
          `${s.quality} · ${Math.round(smoothFps)} fps · `
          + `${s.verts.toLocaleString()} verts / ${s.tris.toLocaleString()} tris · `
          + `${s.shoreSamples} shore samples\n`
          + `reflection ${reflection} · prepass ${prepass}`;
        refreshDebugButtons(water);
      } else if (!water) {
        stats.textContent = "waiting for a coastline ocean instance";
      }
    },
  };
}
