import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/crt-guest/settings.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const api = module.exports;

const manifest = JSON.parse(
  await readFile(
    `${root}public/crt-guest/provenance/ParameterManifest.json`,
    "utf8",
  ),
);
const expected = manifest.groups.flatMap((group) =>
  group.parameters.map((parameter) => ({ group: group.id, ...parameter })),
);

assert.equal(api.CRT_GUEST_SOURCE_COMMIT, manifest.source.commit);
assert.equal(api.CRT_GUEST_PARAMETER_CATALOG.length, 143);
assert.equal(api.CRT_GUEST_PARAMETER_CATALOG.length, expected.length);
for (let index = 0; index < expected.length; index += 1) {
  const actual = api.CRT_GUEST_PARAMETER_CATALOG[index];
  const reference = expected[index];
  assert.equal(actual.index, index);
  assert.equal(actual.id, reference.id);
  assert.equal(actual.label, reference.label);
  assert.equal(actual.group, reference.group);
  assert.deepEqual(actual.variants, reference.variants);
  for (const variant of ["advanced", "hd"]) {
    const supported = reference.variants.includes(variant);
    const range = actual[variant];
    assert.equal(range !== null, supported, `${reference.id}:${variant}`);
    if (!supported) continue;
    const expectedRange = reference.canonical ?? reference[variant];
    assert.deepEqual(
      range,
      {
        default: expectedRange.default,
        min: expectedRange.min,
        max: expectedRange.max,
        step: expectedRange.step,
      },
      `${reference.id}:${variant}`,
    );
  }
}

const options = {
  storage: null,
  loadStored: false,
  persistChanges: false,
};
const settings = new api.CrtGuestSettings(options);
assert.equal(settings.enabled, false);
assert.equal(settings.variant, "hd");
assert.equal(settings.quality, "exact");
assert.equal(settings.parameterCount, 143);
assert.equal(settings.getValue("internal_res"), 1);
assert.equal(settings.getValue("LS", "advanced"), 32);
assert.equal(settings.getValue("LS", "hd"), 32);
assert.equal(settings.setValue("internal_res", 2, "advanced"), false);
assert.throws(() => settings.getValue("pr"), /Unknown CRT Guest parameter/);

assert.equal(settings.revision, 1);
assert.equal(settings.historyRevision, 1);
assert.equal(settings.setQuality("balanced"), true);
assert.equal(settings.revision, 2);
assert.equal(settings.historyRevision, 1);
assert.equal(settings.setValue("WP", 102), true);
assert.equal(settings.getValue("WP"), 100);
assert.equal(settings.historyRevision, 1);
assert.equal(settings.setVariant("advanced"), true);
assert.equal(settings.historyRevision, 2);
const revisionBeforeHistoryReset = settings.revision;
settings.requestHistoryReset();
assert.equal(settings.revision, revisionBeforeHistoryReset);
assert.equal(settings.historyRevision, 3);

settings.setValue("AS", 0.205, "advanced");
assert.ok(Math.abs(settings.getValue("AS", "advanced") - 0.2) < 1e-9);
settings.setValue("barintensity", -0.0001, "advanced");
assert.equal(settings.getValue("barintensity", "advanced"), 0);
settings.setValue("LS", 64, "advanced");
assert.equal(settings.getValue("LS", "advanced"), 32);

const beforeRejected = settings.snapshot();
const wrongCommit = settings.exportPreset();
wrongCommit.sourceCommit = "wrong";
const rejected = settings.applyPreset(wrongCommit);
assert.equal(rejected.ok, false);
assert.deepEqual(settings.snapshot(), beforeRejected);

const roundTrip = new api.CrtGuestSettings(options);
const applied = roundTrip.importJson(settings.exportJson());
assert.equal(applied.ok, true);
assert.deepEqual(roundTrip.exportPreset(), settings.exportPreset());

const memory = new Map();
const storage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
const persisted = new api.CrtGuestSettings({
  storage,
  loadStored: false,
  persistChanges: false,
});
persisted.setEnabled(false);
assert.equal(persisted.saveToStorage().ok, true);
const restored = new api.CrtGuestSettings({
  storage,
  persistChanges: false,
});
assert.equal(restored.enabled, false);
assert.equal(restored.variant, "hd");
assert.equal(restored.quality, "exact");

let changes = 0;
const unsubscribe = restored.subscribe(() => {
  changes += 1;
});
restored.setQuality("balanced");
unsubscribe();
restored.setQuality("exact");
assert.equal(changes, 1);

console.log(
  "Validated the 143-entry CRT Guest catalog, startup preset, quantization, revisions, import, and persistence.",
);
