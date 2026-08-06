// THE WATER STUDIO — #waterstudio. Live fine-tuning for the coast water:
// every WaterParams knob as a slider, plus the spec's debug toggles (layer
// switches, freeze time, wireframe, reflection/modulation kills, coastline
// debug). Settings persist to localStorage and re-apply to every rebuilt
// water instance (level reloads included), same contract as the other
// studios: tune, Copy JSON, hand it over to be baked.
import { CoastWater, WATER_DEFAULTS, type WaterParams } from "./water";
import { el, sec, note, btn, sliderRow, injectStudioCss } from "./studiokit";

const STORE = "waterStudioV1";

interface Opts {
  getWater: () => CoastWater | null;
  onClose: () => void;
}

interface Field {
  key: keyof WaterParams;
  label: string;
  lo: number;
  hi: number;
  step: number;
}

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "PRIMARY SWELL",
    fields: [
      { key: "amp1", label: "amplitude", lo: 0, hi: 1.2, step: 0.005 },
      { key: "len1", label: "wavelength", lo: 4, hi: 80, step: 0.5 },
      { key: "spd1", label: "speed", lo: 0, hi: 4, step: 0.05 },
    ],
  },
  {
    title: "CROSSING SWELL",
    fields: [
      { key: "amp2", label: "amplitude", lo: 0, hi: 0.8, step: 0.005 },
      { key: "len2", label: "wavelength", lo: 2, hi: 40, step: 0.5 },
      { key: "spd2", label: "speed", lo: 0, hi: 4, step: 0.05 },
    ],
  },
  {
    title: "MEDIUM WAVE",
    fields: [
      { key: "amp3", label: "amplitude", lo: 0, hi: 0.5, step: 0.005 },
      { key: "len3", label: "wavelength", lo: 1, hi: 20, step: 0.25 },
      { key: "spd3", label: "speed", lo: 0, hi: 5, step: 0.05 },
    ],
  },
  {
    title: "RIPPLE",
    fields: [
      { key: "amp4", label: "amplitude", lo: 0, hi: 0.2, step: 0.002 },
      { key: "len4", label: "wavelength", lo: 0.5, hi: 10, step: 0.1 },
      { key: "spd4", label: "speed", lo: 0, hi: 6, step: 0.05 },
    ],
  },
  {
    title: "SHORE WAVE",
    fields: [
      { key: "shoreAmp", label: "amplitude", lo: 0, hi: 1, step: 0.005 },
      { key: "shoreSpeed", label: "speed", lo: 0, hi: 3, step: 0.02 },
      { key: "shoreLenMin", label: "beach length", lo: 1, hi: 12, step: 0.25 },
      { key: "shoreLenMax", label: "deep length", lo: 4, hi: 30, step: 0.5 },
      { key: "shoalLift", label: "shoal lift", lo: 1, hi: 2.2, step: 0.01 },
      { key: "shape2", label: "crest bias", lo: 0, hi: 0.6, step: 0.01 },
      { key: "alongA", label: "vary A", lo: 0, hi: 0.9, step: 0.01 },
      { key: "alongB", label: "vary B", lo: 0, hi: 0.9, step: 0.01 },
    ],
  },
  {
    title: "COLOUR",
    fields: [
      { key: "quant", label: "quantize", lo: 2, hi: 32, step: 1 },
      { key: "brightness", label: "brightness", lo: 0.4, hi: 1.7, step: 0.01 },
      { key: "troughDark", label: "trough navy", lo: 0, hi: 0.7, step: 0.01 },
      { key: "grazeCyan", label: "graze cyan", lo: 0, hi: 1, step: 0.01 },
      { key: "shallowMix", label: "shallow lift", lo: 0, hi: 1, step: 0.01 },
    ],
  },
  {
    title: "BREAKER FOAM",
    fields: [
      { key: "foamWidth", label: "width", lo: 0.2, hi: 2.5, step: 0.05 },
      { key: "foamDrift", label: "drift", lo: 0, hi: 0.8, step: 0.01 },
      { key: "foamStrength", label: "strength", lo: 0, hi: 2, step: 0.02 },
    ],
  },
  {
    title: "SWASH + WET SAND",
    fields: [
      { key: "swashPeriod", label: "period", lo: 2, hi: 16, step: 0.1 },
      { key: "swashRunup", label: "run-up", lo: 0, hi: 10, step: 0.1 },
      { key: "wetDecay", label: "dry time", lo: 1, hi: 30, step: 0.5 },
    ],
  },
  {
    title: "STRUCTURE",
    fields: [
      { key: "lod0Radius", label: "dense radius", lo: 60, hi: 420, step: 5 },
    ],
  },
];

const TOGGLES: { key: string; label: string }[] = [
  { key: "far", label: "FAR" },
  { key: "near", label: "NEAR" },
  { key: "foam", label: "FOAM" },
  { key: "swash", label: "SWASH" },
  { key: "wet", label: "WET" },
  { key: "freeze", label: "FREEZE" },
  { key: "wireframe", label: "WIRE" },
  { key: "reflection", label: "REFL" },
  { key: "modulation", label: "MOD" },
  { key: "coast", label: "COAST" },
];

export function openWaterStudio(opts: Opts): { frame: (dt: number) => void } {
  injectStudioCss();
  const params: WaterParams = { ...WATER_DEFAULTS };
  try {
    const j = JSON.parse(localStorage.getItem(STORE) ?? "null") as {
      params?: Partial<WaterParams>;
    } | null;
    if (j?.params) Object.assign(params, j.params);
  } catch {
    /* fresh start */
  }

  let last: CoastWater | null = null;
  const apply = (): void => {
    const w = opts.getWater();
    if (!w) return;
    Object.assign(w.params, params);
    w.markWavesDirty();
  };
  const save = (): void => {
    localStorage.setItem(STORE, JSON.stringify({ params }));
  };

  const panel = el("div", "pst");
  panel.append(sec("WATER STUDIO"));
  const hint = note("tunes the coast water live — open The Descent to see it");
  panel.append(hint);

  const togRow = el("div", "pst-btns");
  for (const tg of TOGGLES) {
    const b = btn(tg.label, () => {
      const w = opts.getWater();
      if (!w) return;
      const d = w.debug as unknown as Record<string, boolean>;
      d[tg.key] = !d[tg.key];
      b.classList.toggle("pst-on", d[tg.key]);
    });
    b.classList.add("pst-on"); // everything starts enabled except coast/freeze/wire
    if (tg.key === "coast" || tg.key === "freeze" || tg.key === "wireframe")
      b.classList.remove("pst-on");
    togRow.append(b);
  }
  panel.append(togRow);

  const stats = note("");
  panel.append(stats);

  for (const g of GROUPS) {
    panel.append(sec(g.title));
    for (const f of g.fields) {
      panel.append(
        sliderRow(f.label, params[f.key], f.lo, f.hi, f.step, (v) => {
          params[f.key] = v;
          apply();
          save();
        }),
      );
    }
  }

  panel.append(sec("PRESET"));
  const act = el("div", "pst-btns");
  act.append(
    btn("Copy JSON", () => {
      void navigator.clipboard?.writeText(JSON.stringify(params, null, 2));
    }),
    btn("Reset saved", () => {
      localStorage.removeItem(STORE);
      Object.assign(params, WATER_DEFAULTS);
      apply();
    }),
    btn("Close", () => {
      panel.remove();
      opts.onClose();
    }),
  );
  panel.append(act);
  document.body.appendChild(panel);

  let statT = 0;
  return {
    frame(dt: number): void {
      const w = opts.getWater();
      if (w !== last) {
        last = w;
        hint.textContent = w
          ? "live — every change saves; Copy JSON to bake"
          : "no water in this level — open The Descent";
        if (w) apply(); // a rebuilt level gets the saved tuning back
      }
      statT += dt;
      if (w && statT > 0.5) {
        statT = 0;
        stats.textContent =
          `chunks ${w.stats.chunksVisible}/${w.stats.chunksTotal} · ` +
          `near tris ${w.stats.nearTris} (${w.stats.clippedTris} clipped) · ` +
          `sky ${w.skyReady ? "proxy ready" : "loading"}`;
      }
    },
  };
}
