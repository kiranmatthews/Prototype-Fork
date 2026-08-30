import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [pass, wrapper] = await Promise.all([
  readFile(`${root}src/crt-guest/pass.ts`, "utf8"),
  readFile(`${root}src/coastpost.ts`, "utf8"),
]);

for (const contract of [
  "setInputSize(width: number, height: number)",
  "setOutputSize(width: number, height: number)",
  "setResolution(\n    sourceWidth: number",
  "resizeTarget(targets.main, this.outputWidth, this.outputHeight)",
  "this.outputWidth,\n          this.height,\n          THREE.HalfFloatType",
  "sourceWidth: this.width",
  "outputWidth: this.outputWidth",
]) {
  assert.ok(pass.includes(contract), `CRT resolution contract missing: ${contract}`);
}

for (const contract of [
  'export type CoastPostResolutionMode = "native" | "fixed"',
  "this.resolutionMode === \"fixed\" ||",
  "this.configureComposer(this.inputWidth, this.inputHeight, 1)",
  "this.detachComposerTail()",
  "this.crtPass.render(",
  "this.outputPass.render(",
  "preCrtOverlay({",
  "makePreCrtOverlayRenderer(",
]) {
  assert.ok(
    wrapper.includes(contract),
    `Presentation resolution contract missing: ${contract}`,
  );
}

assert.ok(
  wrapper.indexOf("this.crtPass.render(") <
    wrapper.indexOf("this.outputPass.render(", wrapper.indexOf("private renderFixed")),
  "Fixed path must decode CRT to linear before OutputPass",
);

console.log(
  "Validated decoupled base/output sizing, fixed-path staging and native fallback contracts.",
);
