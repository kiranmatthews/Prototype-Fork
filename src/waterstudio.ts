// THE WATER STUDIO — #waterstudio. Live fine-tuning for the coast water:
// every WaterParams knob as a slider, layer toggles, and the comparison
// modes (geometry only / raw sky texture / texture+modulation / locked
// camera influence / labelled sky atlas). Settings persist to localStorage
// and re-apply to every rebuilt water instance; Copy JSON hands the tuning
// back for baking.
import { CoastWater, WATER_DEFAULTS, type WaterParams } from "./water";
import { el, sec, note, btn, sliderRow, injectStudioCss } from "./studiokit";

const STORE = "waterStudioV2";

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
    title: "REFLECTION FIELD",
    fields: [
      { key: "stableElev", label: "elevation", lo: 0.5, hi: 1, step: 0.005 },
      { key: "stableBias", label: "shore bias", lo: 0, hi: 1, step: 0.01 },
      { key: "camInfluence", label: "camera pull", lo: 0, hi: 0.15, step: 0.005 },
      { key: "uScale", label: "world U scale", lo: 0.05, hi: 2, step: 0.01 },
      { key: "vScale", label: "world V scale", lo: 0.1, hi: 2.5, step: 0.01 },
      { key: "distort", label: "distortion", lo: 0.3, hi: 4, step: 0.05 },
      { key: "worldU", label: "drift U", lo: 0, hi: 0.01, step: 0.0001 },
      { key: "worldV", label: "drift V", lo: 0, hi: 0.005, step: 0.0001 },
      { key: "palette", label: "palette size", lo: 4, hi: 64, step: 1 },
    ],
  },
  {
    title: "COLOUR",
    fields: [
      { key: "brightness", label: "brightness", lo: 0.4, hi: 1.7, step: 0.01 },
      { key: "troughDark", label: "trough navy", lo: 0, hi: 0.7, step: 0.01 },
      { key: "grazeCyan", label: "graze cyan", lo: 0, hi: 1, step: 0.01 },
      { key: "shallowMix", label: "shallow lift", lo: 0, hi: 1, step: 0.01 },
    ],
  },
  {
    title: "SHORE EVENT (one cycle: breaker -> foam -> swash -> wet)",
    fields: [
      { key: "foamPhase", label: "foam phase", lo: 0, hi: 1, step: 0.01 },
      { key: "swashPhase", label: "swash phase", lo: 0, hi: 1, step: 0.01 },
      { key: "swashRetreat", label: "retreat length", lo: 0.1, hi: 0.9, step: 0.01 },
      { key: "swashRunup", label: "run-up", lo: 0, hi: 10, step: 0.1 },
      { key: "wetDecay", label: "dry time", lo: 1, hi: 30, step: 0.5 },
      { key: "foamWidth", label: "foam width", lo: 0.2, hi: 2.5, step: 0.05 },
      { key: "foamStrength", label: "foam strength", lo: 0, hi: 2, step: 0.02 },
    ],
  },
  {
    title: "STRUCTURE (applies on level reload)",
    fields: [
      { key: "alongDensity", label: "shore density", lo: 0.2, hi: 2, step: 0.05 },
    ],
  },
];

const TOGGLES: { key: string; label: string; on: boolean }[] = [
  { key: "far", label: "FAR", on: true },
  { key: "near", label: "NEAR", on: true },
  { key: "foam", label: "FOAM", on: true },
  { key: "swash", label: "SWASH", on: true },
  { key: "wet", label: "WET", on: true },
  { key: "freeze", label: "FREEZE", on: false },
  { key: "wireframe", label: "WIRE", on: false },
  { key: "coast", label: "COAST", on: false },
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
    b.classList.toggle("pst-on", tg.on);
    togRow.append(b);
  }
  panel.append(togRow);

  // the comparison modes from the correction spec
  panel.append(sec("COMPARE"));
  const cmpRow = el("div", "pst-btns");
  const modes: [string, (w: CoastWater) => void][] = [
    [
      "GEOMETRY ONLY",
      (w) => {
        w.debug.texture = false;
        w.debug.modulation = true;
      },
    ],
    [
      "RAW SKY TEXTURE",
      (w) => {
        w.debug.texture = true;
        w.debug.modulation = false;
      },
    ],
    [
      "TEXTURE + MOD",
      (w) => {
        w.debug.texture = true;
        w.debug.modulation = true;
      },
    ],
  ];
  for (const [label, fn] of modes)
    cmpRow.append(
      btn(label, () => {
        const w = opts.getWater();
        if (w) fn(w);
      }),
    );
  const lockBtn = btn("LOCK CAM", () => {
    const w = opts.getWater();
    if (!w) return;
    w.debug.lockCam = !w.debug.lockCam;
    lockBtn.classList.toggle("pst-on", w.debug.lockCam);
  });
  const atlasBtn = btn("SKY ATLAS", () => {
    const w = opts.getWater();
    if (!w) return;
    w.debug.testAtlas = !w.debug.testAtlas;
    atlasBtn.classList.toggle("pst-on", w.debug.testAtlas);
  });
  cmpRow.append(lockBtn, atlasBtn);
  panel.append(cmpRow);

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
        if (w) apply();
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
