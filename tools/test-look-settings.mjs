import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/visual-treatment/settings.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const exports = {};
new Function('exports', code)(exports);
const { VisualTreatmentSettings, clampVisualTreatment, DEFAULT_VISUAL_TREATMENT, VISUAL_TREATMENT_PRESETS } = exports;
const writes = [];
const settings = new VisualTreatmentSettings({ getItem: () => null, setItem: (key, value) => writes.push({ key, value: JSON.parse(value) }) });
let notifications = 0;
settings.subscribe(() => notifications++);
const original = settings.value;
settings.patch({ bloom: { intensity: 1.25 } }, { persist: false });
assert.equal(settings.value.grading, original.grading, 'Unchanged groups retain identity');
assert.equal(settings.value.vignette, original.vignette);
assert.equal(notifications, 1, 'Live preview notifies renderers immediately');
assert.equal(writes.length, 0);
settings.flush(); settings.flush();
assert.equal(writes.length, 1, 'Flush saves once');
assert.equal(notifications, 1, 'Saving does not repeat GPU/DOM notifications');
settings.patch({ bloom: { intensity: 1.5 } }, { persist: false });
settings.patch({ bloom: { intensity: 1.5 } });
assert.equal(writes.length, 2, 'A normal no-op patch commits pending preview');
assert.equal(notifications, 2);
settings.patch({ grading: { exposureEV: 0.25 } });
assert.equal(writes.length, 3, 'Non-panel clients retain synchronous persistence');
assert.deepEqual(writes.at(-1).value.settings, settings.value);

// Compare the incremental path against complete schema normalization for every
// field, including out-of-range values, incomplete vectors and malformed input.
let cases = 0;
for (const preset of Object.values(VISUAL_TREATMENT_PRESETS)) {
  settings.applyPreset(preset);
  for (const group of ['grading', 'bloom', 'vignette']) {
    for (const key of Object.keys(preset[group])) {
      for (const input of [undefined, null, NaN, Infinity, -9999, 9999, 0, 1, true, false, 'aces', [], [0.2, 0.3, 0.4], Array(3), [[100, 10, 0], [2, 90, 3], [0, 10, 80]]]) {
        const patch = { [group]: { [key]: input } };
        const before = settings.value;
        const expected = clampVisualTreatment({ ...before, [group]: { ...before[group], ...patch[group] } });
        settings.patch(patch);
        assert.deepEqual(settings.value, expected, `${group}.${key} input ${String(input)}`);
        cases++;
      }
    }
  }
}
settings.patch({ grading: { exposureEV: 1 } }, { persist: false });
settings.reset();
assert.deepEqual(settings.value, DEFAULT_VISUAL_TREATMENT);
assert.deepEqual(writes.at(-1).value.settings, settings.value);
const denied = new VisualTreatmentSettings({ getItem: () => null, setItem: () => { throw new Error('Storage denied'); } });
denied.patch({ enabled: true }, { persist: false }); denied.flush();
assert.equal(denied.value.enabled, true, 'Storage failure does not break live controls');
console.log(`PASS ${cases} incremental/full-clamp comparisons, shared unchanged groups, immediate preview, deferred/ordinary persistence, reset and denied storage.`);
