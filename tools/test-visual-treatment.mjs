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
  "Validated one shared LOOK panel and post pass with global source presets for coast, Bonus and Meshy.",
);
