import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const settingsSource = await readFile(
  `${root}src/crt-guest/settings.ts`,
  "utf8",
);
const output = ts.transpileModule(settingsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const api = module.exports;

const parameter = (id) => {
  const result = api.getCrtGuestParameter(id);
  assert.ok(result, `Missing CRT Guest parameter ${id}`);
  return result;
};
const presentation = (id, variant = "hd") =>
  api.getCrtGuestParameterPresentation(parameter(id), variant);

assert.equal(
  presentation("interm", "advanced").label,
  "Interlace Mode: OFF, Normal 1-3,6; Interpolation 4-5",
);
assert.equal(
  presentation("interm", "hd").label,
  "Interlace Mode: OFF, Normal 1-3,5; Interpolation 4",
);

assert.deepEqual(parameter("LS").hd, {
  default: 32,
  min: 16,
  max: 64,
  step: 16,
});
assert.equal(presentation("LS").fixedValue, 32);
assert.equal(presentation("LS").fixedDisplay, "32³");
assert.match(presentation("LS").label, /fixed 32³/i);

assert.equal(parameter("bth").hd.min, 1);
assert.match(presentation("bth").hint, /threshold, not a strength/i);
assert.deepEqual(presentation("bth").offControl.targets, [
  { parameterId: "AS", value: 0 },
]);
assert.equal(parameter("AS").hd.min, 0);
assert.match(presentation("AS").label, /0 = Off/);
assert.deepEqual(presentation("CP").offControl.targets, [
  { parameterId: "CP", value: -1 },
]);
assert.match(presentation("CP").hint, /-1 is Guest's Profile Off value/);
assert.deepEqual(presentation("shadowMask").offControl.targets, [
  { parameterId: "shadowMask", value: -1 },
]);
assert.match(presentation("shadowMask").hint, /0 selects the CGWG mask/);

for (const [id, minimum] of [
  ["HSHARPNESS", 1],
  ["SIGMA_HOR", 0.1],
  ["VSHARPNESS", 1],
  ["SIGMA_VER", 0.1],
]) {
  assert.equal(parameter(id).hd.min, minimum, `${id} upstream minimum changed`);
  assert.equal(presentation(id).offControl, null, `${id} must not invent Off=0`);
  assert.match(presentation(id).hint, /not an (?:effect strength|on\/off control)/i);
}

for (const id of ["glow", "bloom", "mask_bloom", "halation"]) {
  assert.equal(parameter(id).hd.min <= 0, true);
  assert.equal(parameter(id).hd.max >= 0, true);
  assert.match(presentation(id).label, /0 = Off/);
  assert.deepEqual(presentation(id).offControl.targets, [
    { parameterId: id, value: 0 },
  ]);
}

for (const id of ["SIZEH", "SIGMA_H", "SIZEV", "SIGMA_V"]) {
  assert.match(presentation(id).hint, /Glow Strength \(glow\) = 0/);
}
for (const id of ["SIZEHB", "SIGMA_HB", "SIZEVB", "SIGMA_VB"]) {
  assert.match(
    presentation(id).hint,
    /Bloom Strength, Mask Bloom, and Halation Strength = 0/,
  );
  assert.match(presentation(id).hint, /Glow Strength = 0 when Magic Glow type 2/);
}

let positiveMinimumCount = 0;
for (const sourceParameter of api.CRT_GUEST_PARAMETER_CATALOG) {
  for (const variant of sourceParameter.variants) {
    const range = sourceParameter[variant];
    if (range.min <= 0) continue;
    positiveMinimumCount += 1;
    assert.ok(
      presentation(sourceParameter.id, variant).hint?.trim(),
      `${sourceParameter.id}:${variant} has a positive upstream minimum but no semantic hint`,
    );
  }
}
assert.ok(positiveMinimumCount > 40, "Positive-minimum audit unexpectedly shrank");

for (const sourceParameter of api.CRT_GUEST_PARAMETER_CATALOG) {
  for (const variant of sourceParameter.variants) {
    const control = presentation(sourceParameter.id, variant).offControl;
    if (!control) continue;
    assert.ok(control.label.trim(), `${sourceParameter.id}:${variant} has an empty Off label`);
    assert.ok(control.status.trim(), `${sourceParameter.id}:${variant} has an empty Off status`);
    for (const target of control.targets) {
      const targetParameter = parameter(target.parameterId);
      assert.ok(
        targetParameter.variants.includes(variant),
        `${sourceParameter.id}:${variant} targets unsupported ${target.parameterId}`,
      );
      assert.equal(
        api.normalizeCrtGuestValue(targetParameter, target.value, variant),
        target.value,
        `${sourceParameter.id}:${variant} has an invalid Off target`,
      );
    }
  }
}

const panelSource = await readFile(`${root}src/crt-guest/panel.ts`, "utf8");
assert.match(panelSource, /getCrtGuestParameterPresentation/);
assert.match(panelSource, /aria-describedby/);
assert.match(panelSource, /"output",\s*\n\s*"fixed-value"/);
assert.match(panelSource, /for \(const target of offControl\.targets\)/);
assert.doesNotMatch(panelSource, /parameter\.id === "LS"/);

console.log(
  "Validated variant-specific CRT labels, fixed LUT semantics, genuine Off controls, and upstream-positive reconstruction/kernel minima.",
);
