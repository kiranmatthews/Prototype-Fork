import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");

function compileSettings() {
  const output = ts.transpileModule(read("src/visual-treatment/settings.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: "src/visual-treatment/settings.ts",
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    () => {
      throw new Error("visual-treatment settings unexpectedly imported a module");
    },
  );
  return module.exports;
}

class MemoryStorage {
  values = new Map();
  writes = [];

  getItem(key) {
    return this.values.get(String(key)) ?? null;
  }

  setItem(key, value) {
    const normalizedKey = String(key);
    const normalizedValue = String(value);
    this.values.set(normalizedKey, normalizedValue);
    this.writes.push([normalizedKey, normalizedValue]);
  }
}

const close = (actual, expected, epsilon = 1e-9, message = "") =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${message || "values differ"}: expected ${expected}, got ${actual}`,
  );

const api = compileSettings();
const {
  DEFAULT_VISUAL_TREATMENT: defaults,
  LEGACY_VISUAL_TREATMENT_STORAGE_KEY: legacyKey,
  VISUAL_TREATMENT_PRESETS: presets,
  VISUAL_TREATMENT_STORAGE_KEY: storageKey,
  VisualTreatmentSettings,
  clampVisualTreatment,
  cloneVisualTreatment,
  visualTreatmentActivity,
} = api;

assert.equal(storageKey, "solProtoVisualTreatment.v2");
assert.equal(legacyKey, "solProtoVisualTreatment.v1");
assert.deepEqual(defaults, {
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
});

// Exact source volume values, not browser-tuned approximations.
assert.equal(presets.neutral, defaults);
assert.deepEqual(
  {
    enabled: presets.unityDefault.enabled,
    toneMapper: presets.unityDefault.grading.toneMapper,
    bloom: presets.unityDefault.bloom,
    vignette: presets.unityDefault.vignette,
  },
  {
    enabled: true,
    toneMapper: "neutral",
    bloom: {
      intensity: 0.25,
      threshold: 1,
      scatter: 0.5,
      clamp: 65472,
      tint: [1, 1, 1],
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: {
      intensity: 0.2,
      smoothness: 0.2,
      color: [0, 0, 0],
      center: [0.5, 0.5],
      rounded: false,
    },
  },
);
assert.deepEqual(
  {
    enabled: presets.coast.enabled,
    toneMapper: presets.coast.grading.toneMapper,
    bloom: presets.coast.bloom,
    vignette: presets.coast.vignette,
  },
  {
    enabled: true,
    toneMapper: "neutral",
    bloom: {
      intensity: 0.3,
      threshold: 1,
      scatter: 0.7,
      clamp: 65472,
      tint: [1, 1, 1],
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: {
      intensity: 0.2,
      smoothness: 0.2,
      color: [0, 0, 0],
      center: [0.5, 0.5],
      rounded: false,
    },
  },
);
assert.deepEqual(
  {
    toneMapper: presets.bonus.grading.toneMapper,
    exposureEV: presets.bonus.grading.exposureEV,
    contrastPct: presets.bonus.grading.contrastPct,
    saturationPct: presets.bonus.grading.saturationPct,
    colorFilter: presets.bonus.grading.colorFilter,
    bloom: presets.bonus.bloom,
    vignette: presets.bonus.vignette,
  },
  {
    toneMapper: "neutral",
    exposureEV: -0.18,
    contrastPct: 5,
    saturationPct: -4,
    colorFilter: [0.72, 0.88, 1],
    bloom: {
      intensity: 0.68,
      threshold: 0.78,
      scatter: 0.78,
      clamp: 65472,
      tint: [1, 1, 1],
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: {
      intensity: 0.46,
      smoothness: 0.78,
      color: [0.199, 0.124, 0.699],
      center: [0.5, 0.5],
      rounded: false,
    },
  },
);
assert.deepEqual(
  {
    toneMapper: presets.meshy.grading.toneMapper,
    exposureEV: presets.meshy.grading.exposureEV,
    contrastPct: presets.meshy.grading.contrastPct,
    saturationPct: presets.meshy.grading.saturationPct,
    bloom: presets.meshy.bloom,
    vignette: presets.meshy.vignette,
  },
  {
    toneMapper: "neutral",
    exposureEV: -0.22,
    contrastPct: 22,
    saturationPct: 18,
    bloom: {
      intensity: 0.16,
      threshold: 1.05,
      scatter: 0.55,
      clamp: 65472,
      tint: [1, 1, 1],
      highQuality: true,
      downscale: 2,
      maxIterations: 6,
    },
    vignette: {
      intensity: 0.22,
      smoothness: 0.72,
      color: [0, 0, 0],
      center: [0.5, 0.5],
      rounded: false,
    },
  },
);

// Every v2 field clamps independently, including malformed tuple members.
const clamped = clampVisualTreatment({
  enabled: "yes",
  grading: {
    toneMapper: "future-film",
    exposureEV: 99,
    contrastPct: -999,
    saturationPct: 999,
    hueShiftDeg: -999,
    temperature: 999,
    tint: -999,
    colorFilter: [3, -2, Number.NaN],
    lift: [-9, 9, Number.POSITIVE_INFINITY],
    gamma: [0, 9, Number.NaN],
    gain: [-2, 9, Number.NaN],
    splitShadows: [-1, 2, Number.NaN],
    splitHighlights: [2, -1, Number.NaN],
    splitBalancePct: 999,
    channelMixer: [
      [-999, 999, Number.NaN],
      [999, -999, Number.POSITIVE_INFINITY],
      [Number.NaN, 12, -12],
    ],
  },
  bloom: {
    intensity: 99,
    threshold: -1,
    scatter: 9,
    clamp: -1,
    tint: [9, -1, Number.NaN],
    highQuality: "yes",
    downscale: 3,
    maxIterations: 99,
  },
  vignette: {
    intensity: 9,
    smoothness: 0,
    color: [9, -1, Number.NaN],
    center: [-1, 9],
    rounded: "yes",
  },
});
assert.equal(clamped.enabled, false);
assert.deepEqual(clamped.grading, {
  toneMapper: "none",
  exposureEV: 5,
  contrastPct: -100,
  saturationPct: 100,
  hueShiftDeg: -180,
  temperature: 100,
  tint: -100,
  colorFilter: [2, 0, 1],
  lift: [-0.5, 0.5, 0],
  gamma: [0.1, 4, 1],
  gain: [0, 4, 1],
  splitShadows: [0, 1, 0.5],
  splitHighlights: [1, 0, 0.5],
  splitBalancePct: 100,
  channelMixer: [
    [-200, 200, 0],
    [200, -200, 0],
    [0, 12, -12],
  ],
});
assert.deepEqual(clamped.bloom, {
  intensity: 5,
  threshold: 0,
  scatter: 1,
  clamp: 0,
  tint: [4, 0, 1],
  highQuality: false,
  downscale: 2,
  maxIterations: 8,
});
assert.deepEqual(clamped.vignette, {
  intensity: 1,
  smoothness: 0.01,
  color: [1, 0, 0],
  center: [0, 1],
  rounded: false,
});

// Legacy v1 values migrate without changing their visible grade semantics.
const legacyStorage = new MemoryStorage();
legacyStorage.values.set(
  legacyKey,
  JSON.stringify({
    version: 1,
    settings: {
      enabled: true,
      exposure: -0.75,
      contrast: 1.22,
      saturation: 0.96,
      tintR: 0.72,
      tintG: 0.88,
      tintB: 1.5,
      bloomIntensity: 0.68,
      bloomThreshold: 0.78,
      bloomRadius: 8.5,
      vignetteIntensity: 0.46,
      vignetteSmoothness: 0.78,
    },
  }),
);
const migrated = new VisualTreatmentSettings(legacyStorage);
assert.equal(legacyStorage.writes.length, 0, "loading legacy settings must be read-only");
assert.equal(migrated.value.enabled, true);
assert.equal(migrated.value.grading.toneMapper, "none");
assert.equal(migrated.value.grading.exposureEV, -0.75);
close(migrated.value.grading.contrastPct, 22, 1e-9, "legacy contrast");
close(migrated.value.grading.saturationPct, -4, 1e-9, "legacy saturation");
assert.deepEqual(migrated.value.grading.colorFilter, [0.72, 0.88, 1.5]);
assert.equal(migrated.value.bloom.intensity, 0.68);
assert.equal(migrated.value.bloom.threshold, 0.78);
assert.equal(migrated.value.bloom.scatter, 0.85);
assert.equal(migrated.value.bloom.highQuality, false);
assert.equal(migrated.value.vignette.intensity, 0.46);
assert.equal(migrated.value.vignette.smoothness, 0.78);
assert.deepEqual(migrated.value.grading.channelMixer, defaults.grading.channelMixer);

// The current key wins when both versions exist, and loaded values are clamped.
const currentStorage = new MemoryStorage();
currentStorage.values.set(legacyKey, legacyStorage.values.get(legacyKey));
currentStorage.values.set(
  storageKey,
  JSON.stringify({
    version: 2,
    settings: {
      ...cloneVisualTreatment(defaults),
      enabled: true,
      grading: { ...defaults.grading, exposureEV: 88 },
    },
  }),
);
const loadedCurrent = new VisualTreatmentSettings(currentStorage);
assert.equal(loadedCurrent.value.grading.exposureEV, 5);
assert.equal(loadedCurrent.value.grading.contrastPct, 0);
assert.equal(currentStorage.writes.length, 0, "loading v2 settings must be read-only");

// Patches preserve untouched sections, persist v2, and suppress true no-ops.
const storage = new MemoryStorage();
const settings = new VisualTreatmentSettings(storage);
let notifications = 0;
let lastNotification = null;
const unsubscribe = settings.subscribe((value) => {
  notifications += 1;
  lastNotification = value;
});
settings.patch({ enabled: false });
assert.equal(notifications, 0);
assert.equal(storage.writes.length, 0);
settings.patch({ enabled: true });
assert.equal(notifications, 1);
assert.equal(storage.writes.length, 1);
assert.equal(lastNotification.enabled, true);
settings.patch({ enabled: true });
settings.patch({ grading: { exposureEV: 0 } });
assert.equal(notifications, 1, "equivalent patches must not notify");
assert.equal(storage.writes.length, 1, "equivalent patches must not persist");
settings.patch({ grading: { exposureEV: 99 } });
assert.equal(settings.value.grading.exposureEV, 5);
assert.deepEqual(settings.value.bloom, defaults.bloom);
assert.deepEqual(settings.value.vignette, defaults.vignette);
assert.equal(notifications, 2);
assert.equal(storage.writes.length, 2);
settings.patch({ grading: { exposureEV: 99 } });
assert.equal(notifications, 2, "same clamped result must be a no-op");
assert.equal(storage.writes.length, 2);
const persisted = JSON.parse(storage.values.get(storageKey));
assert.equal(persisted.version, 2);
assert.deepEqual(persisted.settings, settings.value);
assert.deepEqual(JSON.parse(settings.serialize(false)), persisted);
unsubscribe();
settings.patch({ bloom: { intensity: 1 } });
assert.equal(notifications, 2, "unsubscribed listeners must stay detached");

// Presets/settings own their nested tuples rather than aliasing caller state.
const clone = cloneVisualTreatment(presets.bonus);
assert.notStrictEqual(clone.grading, presets.bonus.grading);
assert.notStrictEqual(clone.grading.colorFilter, presets.bonus.grading.colorFilter);
assert.notStrictEqual(clone.grading.channelMixer, presets.bonus.grading.channelMixer);
assert.notStrictEqual(clone.grading.channelMixer[0], presets.bonus.grading.channelMixer[0]);
assert.notStrictEqual(clone.bloom.tint, presets.bonus.bloom.tint);
assert.notStrictEqual(clone.vignette.color, presets.bonus.vignette.color);
assert.notStrictEqual(clone.vignette.center, presets.bonus.vignette.center);
clone.grading.colorFilter[0] = 0;
clone.grading.channelMixer[0][0] = -200;
clone.bloom.tint[0] = 0;
clone.vignette.color[0] = 0;
assert.deepEqual(presets.bonus.grading.colorFilter, [0.72, 0.88, 1]);
assert.deepEqual(presets.bonus.grading.channelMixer[0], [100, 0, 0]);
assert.deepEqual(presets.bonus.bloom.tint, [1, 1, 1]);
assert.deepEqual(presets.bonus.vignette.color, [0.199, 0.124, 0.699]);
const candidate = cloneVisualTreatment(defaults);
candidate.enabled = true;
candidate.grading.colorFilter[0] = 0.25;
const isolated = new VisualTreatmentSettings(null);
isolated.applyPreset(candidate);
candidate.grading.colorFilter[0] = 0.9;
assert.equal(isolated.value.grading.colorFilter[0], 0.25);

// Activity is effective: disabled and zero-strength sub-effects stay neutral.
const activityOf = (patch) => {
  const value = cloneVisualTreatment(defaults);
  value.enabled = patch.enabled ?? true;
  if (patch.grading) Object.assign(value.grading, patch.grading);
  if (patch.bloom) Object.assign(value.bloom, patch.bloom);
  if (patch.vignette) Object.assign(value.vignette, patch.vignette);
  return visualTreatmentActivity(value);
};
assert.deepEqual(activityOf({}), {
  grading: false,
  bloom: false,
  vignette: false,
  any: false,
});
assert.deepEqual(
  visualTreatmentActivity({ ...cloneVisualTreatment(presets.bonus), enabled: false }),
  { grading: false, bloom: false, vignette: false, any: false },
);
assert.deepEqual(
  activityOf({ bloom: { threshold: 4, scatter: 1, highQuality: true } }),
  { grading: false, bloom: false, vignette: false, any: false },
);
assert.deepEqual(
  activityOf({ vignette: { color: [1, 0, 1], center: [0, 1], rounded: true } }),
  { grading: false, bloom: false, vignette: false, any: false },
);
assert.equal(activityOf({ bloom: { intensity: 0.0001 } }).bloom, false);
assert.equal(activityOf({ bloom: { intensity: 0.00011 } }).bloom, true);
assert.equal(activityOf({ vignette: { intensity: 0.0001 } }).vignette, false);
assert.equal(activityOf({ vignette: { intensity: 0.00011 } }).vignette, true);
for (const grading of [
  { toneMapper: "neutral" },
  { exposureEV: 0.01 },
  { colorFilter: [1, 0.99, 1] },
  { lift: [0.01, 0, 0] },
  { splitShadows: [0.51, 0.5, 0.5] },
  { channelMixer: [[99, 0, 0], [0, 100, 0], [0, 0, 100]] },
]) {
  const activity = activityOf({ grading });
  assert.equal(activity.grading, true, JSON.stringify(grading));
  assert.equal(activity.any, true, JSON.stringify(grading));
}
assert.deepEqual(visualTreatmentActivity(presets.bonus), {
  grading: true,
  bloom: true,
  vignette: true,
  any: true,
});

// Keep the one shared panel and its renderer wiring covered alongside runtime state.
const panel = read("src/visual-treatment/panel.ts");
for (const label of [
  "VISUAL TREATMENT",
  "Exposure EV",
  "Contrast %",
  "Saturation %",
  "Tone mapper",
  "Lift · gamma · gain",
  "Split tone · channel mixer",
  "Unity bloom",
  "Threshold (gamma)",
  "Scatter",
  "Vignette",
  "Color filter",
  "Default Unity",
  "Coast Unity",
  "Bonus Unity",
  "Meshy Unity",
])
  assert.ok(panel.includes(label), `LOOK panel control missing: ${label}`);

const main = read("src/main.ts");
assert.ok(main.includes("const visualTreatmentPanel = createVisualTreatmentPanel("));
assert.ok(main.includes("visualTreatmentSettings"));
assert.ok(main.includes("visualTreatmentPanel.setOpen"));
assert.ok(main.includes("visualTreatmentSettings.subscribe"));
assert.ok(main.includes("visualTreatmentActivity"));
assert.ok(main.includes('lookDiagnosticsProbe.id = "look-diagnostics"'));
assert.ok(main.includes("coastPost?.lookDiagnostics ?? null"));
assert.ok(main.includes("getLookDiagnostics: () => coastPost?.lookDiagnostics ?? null"));
assert.match(
  main,
  /function syncSkyBackdropVisibility\(\): void \{[\s\S]*?const skyBridgeFogOnly = current\.id === "sky" && !editorViewActive/,
  "Sky Bridge needs one lifecycle-aware painted-sky visibility policy",
);
assert.match(
  main,
  /syncSkyBackdropVisibility\(\)[\s\S]*?sky\.visible = !LITE && !bonusBackdropActive && !skyBridgeFogOnly/,
  "Sky Bridge still exposes the painted distance dome",
);
assert.match(
  main,
  /skyMist\.visible =[\s\S]{0,180}!skyBridgeFogOnly/,
  "Sky Bridge still exposes the painted horizon mist",
);
assert.match(
  main,
  /function setEditorView\([\s\S]{0,180}editorViewActive = editing;[\s\S]{0,80}syncSkyBackdropVisibility\(\)/,
  "editor entry/exit must resync the Sky Bridge dome",
);
assert.match(
  main,
  /activeSky = level\.skyPreset;[\s\S]{0,260}syncSkyBackdropVisibility\(\)/,
  "level switches must resync the painted-sky policy",
);

console.log(
  "Validated nested LOOK v2 presets, migration, clamping, persistence, isolation and effective-neutral activity.",
);
