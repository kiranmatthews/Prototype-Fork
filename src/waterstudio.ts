// THE UNITY OCEAN STUDIO — #waterstudio. Live controls for every audited
// MatrixRex ocean value plus the render-pass/debug switches. Settings use a
// versioned key so retired CoastWater tunings can never leak into this port.
import {
  CoastWater,
  type UnityOceanParams,
} from "./unityOcean";
import { oceanTuning, defaultOceanDebug, type OceanContext } from './oceanTuning';
import { MAP_OUTLINE_FIELDS, MAP_OUTLINE_BASE_WIDTH_METRES, type MapOutlineKey } from './mapIslandOutline';
import {
  btn,
  el,
  injectStudioCss,
  note,
  sec,
  sliderRow,
  toT,
} from "./studiokit";

interface Opts {
  getWater: () => CoastWater | null;
  getContext: () => OceanContext;
  onChange?: () => void;
  onClose: () => void;
}
export interface WaterStudioHandle { element: HTMLElement; frame: (dt:number) => void; close: () => void }

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

function fieldValue(params: UnityOceanParams, field: Field): number {
  const data = params as unknown as Record<string, unknown>;
  if (field.path.length === 1) return data[field.path[0]] as number;
  const color = data[field.path[0]] as Record<string, number>;
  return color[field.path[1]];
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

export function openWaterStudio(opts: Opts): WaterStudioHandle {
  injectStudioCss();
  const contextName = (context: OceanContext) => context === 'map' ? 'Map Ocean' : 'In-Level Ocean';
  let context = opts.getContext();
  const activeWater = () => opts.getContext() === context ? opts.getWater() : null;
  const initial = opts.getWater();
  if (initial) oceanTuning.apply(initial, opts.getContext());
  let params = oceanTuning.params(context);

  const panel = el("div", "pst water-studio");
  const close = (): void => { panel.remove(); opts.onClose(); };
  panel.dataset.waterStudio = '';
  panel.append(sec("OCEAN TUNING"));
  const tabs = el("div", "pst-btns");
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Ocean context');
  const tabButtons = new Map<OceanContext, HTMLElement>();
  const controls = el('div', 'water-studio-controls');
  controls.id = 'water-studio-controls';
  controls.setAttribute('role', 'tabpanel');
  const hint = note("");
  const stats = note("");
  stats.classList.add("pst-stat");
  const controlSetters: (() => void)[] = [];
  const debugButtons = new Map<DebugKey, HTMLElement>();
  const outlineControls = el('div', 'map-outline-controls');

  const refresh = (): void => {
    params = oceanTuning.params(context);
    panel.dataset.oceanContext = context;
    outlineControls.hidden = context !== 'map';
    controls.setAttribute('aria-label', contextName(context));
    for (const [key, button] of tabButtons) {
      button.classList.toggle('pst-on', key === context);
      button.setAttribute('aria-selected', String(key === context));
      button.tabIndex = key === context ? 0 : -1;
    }
    const water = activeWater(), debug = oceanTuning.debug(context);
    hint.textContent = water
      ? contextName(context) + ' · live · changes save to this profile only'
      : contextName(context) + ' · saved only; visit ' + (context === 'map' ? 'the map' : 'an ocean level') + ' to preview';
    if (oceanTuning.persistenceError) hint.textContent = contextName(context) + ' · storage unavailable; Copy JSON to keep these edits';
    for (const key of DEBUG_KEYS)
      debugButtons.get(key)?.classList.toggle('pst-on', debug[key] ?? (water ? water.debug[key] : defaultOceanDebug(null, key)));
    for (const setter of controlSetters) setter();
  };
  const applySelected = (): void => {
    const water = activeWater();
    if (water) { oceanTuning.apply(water, context); opts.onChange?.(); }
    refresh();
  };
  for (const key of ['map', 'level'] as const) {
    const button = btn(contextName(key), () => { context = key; refresh(); });
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', controls.id);
    button.dataset.oceanTab = key;
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      context = context === 'map' ? 'level' : 'map';
      refresh(); tabButtons.get(context)?.focus();
    });
    tabButtons.set(key, button); tabs.append(button);
  }
  tabs.append(btn("Close", close));
  panel.append(tabs, hint, stats, controls);
  // Control keys must not drive the map/player. M remains the shared debug toggle.
  for (const type of ['keydown', 'keyup'])
    panel.addEventListener(type, event => {
      const key = event as KeyboardEvent;
      if (key.code !== 'KeyM' || (event.target as HTMLElement)?.matches('input,textarea,select')) event.stopPropagation();
    });
  for (const type of ['pointerdown', 'touchstart']) panel.addEventListener(type, event => event.stopPropagation());

  controls.append(sec("RENDER / DEBUG"));
  const debugRow = el("div", "pst-btns");
  for (const key of DEBUG_KEYS) {
    const button = btn(DEBUG_LABELS[key], () => {
      const water = activeWater();
      const current = oceanTuning.debug(context)[key] ?? (water ? water.debug[key] : defaultOceanDebug(null, key));
      oceanTuning.setDebug(context, key, !current); applySelected();
    });
    button.dataset.oceanDebug = key;
    debugButtons.set(key, button); debugRow.append(button);
  }
  controls.append(debugRow);

  outlineControls.append(sec('MAP ISLAND WHITE OUTLINE'));
  outlineControls.append(note(`Separate map accent, not the ocean shader shoreline. Width multiplies the same ${MAP_OUTLINE_BASE_WIDTH_METRES} m band on every island; offset is from the authored beach edge.`));
  for (const key of Object.keys(MAP_OUTLINE_FIELDS) as MapOutlineKey[]) {
    const field = MAP_OUTLINE_FIELDS[key];
    const row = sliderRow(field.label, oceanTuning.outline()[key], field.lo, field.hi, field.step, value => {
      oceanTuning.setOutline(key, value); applySelected();
    });
    row.dataset.mapOutlineField = key;
    const range = row.querySelector<HTMLInputElement>('input[type="range"]');
    const number = row.querySelector<HTMLInputElement>('input[type="number"]');
    range?.setAttribute('aria-label', 'Map island outline: ' + field.label);
    number?.setAttribute('aria-label', 'Map island outline: ' + field.label + ' value');
    controlSetters.push(() => {
      const value = oceanTuning.outline()[key];
      if (number) number.value = String(value);
      if (range) range.value = String(toT(value, field.lo, field.hi, field.step >= 1 ? 1 : 3) * 1000);
    });
    outlineControls.append(row);
  }
  controls.append(outlineControls);

  // Surface appearance first: colours/depth, caustics and reflections matter
  // most for the map view. Both tabs still expose the full audited shader.
  const ordered = [GROUPS[2], GROUPS[6], GROUPS[5], GROUPS[3], GROUPS[4], GROUPS[0], GROUPS[1], GROUPS[7]];
  for (const group of ordered) {
    controls.append(sec(group.title));
    for (const field of group.fields) {
      const row = sliderRow(field.label, fieldValue(params, field), field.lo, field.hi, field.step, value => {
        oceanTuning.setField(context, field.path, value); applySelected();
      });
      row.dataset.oceanField = field.path.join('.');
      const range = row.querySelector<HTMLInputElement>('input[type="range"]');
      const number = row.querySelector<HTMLInputElement>('input[type="number"]');
      controlSetters.push(() => {
        const value = fieldValue(params, field);
        const label = contextName(context) + ': ' + group.title + ' ' + field.label;
        range?.setAttribute('aria-label', label); number?.setAttribute('aria-label', label + ' value');
        if (number) number.value = String(value);
        if (range) range.value = String(toT(value, field.lo, field.hi, field.step >= 1 ? 1 : 3) * 1000);
      });
      controls.append(row);
    }
  }
  controls.append(sec("SELECTED PROFILE"));
  const actions = el("div", "pst-btns");
  actions.append(
    btn("Copy JSON", button => {
      void copyText(oceanTuning.serialize(context)).then(() => {
        const old = button.textContent; button.textContent = "COPIED";
        window.setTimeout(() => { button.textContent = old; }, 900);
      });
    }),
    btn("Reset this ocean", () => { oceanTuning.reset(context); applySelected(); }),
    btn("Close", close),
  );
  controls.append(actions);
  const style = document.createElement('style');
  style.textContent = '.water-studio [role=tablist] { position:sticky; top:0; z-index:2; padding:8px 0; margin-top:0; background:#12151e; } .water-studio [role=tab] { flex:1; min-height:40px; } .water-studio { max-width:100vw; }';
  panel.append(style); document.body.appendChild(panel);
  let last = opts.getWater(), lastContext = opts.getContext(), statTime = 0, smoothFps = 60;
  refresh();
  return {
    element: panel, close,
    frame(dt: number): void {
      const water = opts.getWater(), active = opts.getContext();
      if (water !== last || active !== lastContext) {
        if (active !== lastContext) context = active;
        last = water; lastContext = active;
        if (water) oceanTuning.apply(water, active);
        refresh();
      }
      if (dt > 0) smoothFps += (1 / dt - smoothFps) * Math.min(1, dt * 3);
      statTime += dt;
      if (activeWater() && statTime >= 0.35) {
        statTime = 0;
        const s = water!.stats;
        stats.textContent = contextName(context) + ' · ' + s.quality + ' · ' + Math.round(smoothFps) + ' fps · ' +
          s.verts.toLocaleString() + ' verts · reflection ' + s.reflectionWidth + '×' + s.reflectionHeight +
          ' · prepass ' + s.prepassWidth + '×' + s.prepassHeight;
      } else if (!activeWater()) stats.textContent = 'This tab cannot modify the ocean currently on screen.';
    },
  };
}
