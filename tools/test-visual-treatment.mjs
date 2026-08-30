import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const settings = read("src/visual-treatment/settings.ts");
const panel = read("src/visual-treatment/panel.ts");
const post = read("src/unityPost.ts");
const main = read("src/main.ts");

for (const literal of [
  "solProtoVisualTreatment.v1",
  "VISUAL_TREATMENT_PRESETS",
  "coast:",
  "bonus:",
  "meshy:",
  "bloomIntensity",
  "vignetteIntensity",
  "applyPreset",
]) {
  assert.ok(settings.includes(literal), `visual settings contract missing: ${literal}`);
}

for (const label of [
  "VISUAL TREATMENT",
  "Exposure",
  "Contrast",
  "Saturation",
  "Bloom intensity",
  "Bloom threshold",
  "Vignette",
  "Color filter",
  "Coast source",
  "Bonus source",
  "Meshy source",
]) {
  assert.ok(panel.includes(label), `LOOK panel control missing: ${label}`);
}

assert.match(post, /color \+= localBloom\([^;]+\) \* uBloom\.x/);
assert.ok(post.includes("color *= 1.0 - vignette * uVignette.x"));
assert.ok(main.includes("createVisualTreatmentPanel(visualTreatmentSettings)"));
assert.ok(main.includes("visualTreatmentSettings.subscribe"));
assert.ok(
  main.includes("levelPostEnabled ||"),
  "coast and global LOOK enablement must share one post pipeline",
);

console.log(
  "Validated one shared LOOK panel and post pass with global source presets for coast, Bonus and Meshy.",
);
