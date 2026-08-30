import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

const variants = ["advanced", "hd"];
const stages = [
  "stock",
  "afterglow",
  "pre",
  "variant4",
  "variant5",
  "gaussian-horizontal",
  "gaussian-vertical",
  "bloom-horizontal",
  "bloom-vertical",
  "main",
  "deconvergence",
];
const pointStages = new Set(["stock", "afterglow", "pre"]);

for (const variant of variants) {
  for (const stage of stages) {
    const path = `src/crt-guest/generated/${variant}/${stage}.frag.glsl`;
    const shader = await text(path);
    assert.match(shader, /^#version 300 es/);
    assert.match(shader, /layout\(location = 0\) out (?:highp )?vec4 FragColor;/);
    assert.doesNotMatch(shader, /\b(?:params|global)\./);
    assert.doesNotMatch(shader, /\b(?:do\s*\{|while\s*\()/);
    assert.match(shader, /crtGuestInsideUv/);

    const pointSamples = shader.match(/crtGuestSamplePointBorder\s*\(/g)?.length ?? 0;
    if (pointStages.has(stage)) {
      assert.ok(pointSamples > 1, `${path} must use explicit point sampling`);
    } else {
      assert.equal(pointSamples, 1, `${path} unexpectedly point-samples its inputs`);
      assert.match(shader, /crtGuestSampleLinearBorder\s*\(/);
    }
    if (stage === "pre") {
      assert.match(
        shader,
        /crtGuestSampleLinearBorder\(SamplerLUT[1-4],/,
        `${path} must keep LUT sampling linear`,
      );
    }
    if (stage === "deconvergence") {
      assert.match(
        shader,
        /\[int\(max\(uParams_shadowMask, 0\.0\)\)\]/,
        `${path} must make Guest's shadowMask = -1 sentinel array-safe`,
      );
      assert.doesNotMatch(
        shader,
        /\[int\(uParams_shadowMask\)\]/,
        `${path} must not index the mask-width array with -1`,
      );
    }
  }
}

const generatedApi = await text("src/crt-guest/generated/shaders.ts");
assert.match(generatedApi, /CRT_GUEST_SHADERS/);
assert.match(generatedApi, /CRT_GUEST_STAGE_SAMPLING/);
assert.match(generatedApi, /a62d9cda9140294d22b6da5e4ff4187365890d42/);

const pass = await text("src/crt-guest/pass.ts");
for (const contract of [
  "fourteen fullscreen draws",
  "historyPing",
  "historyClearPending",
  "RGBA16F",
  "configurePreMipmaps",
  "getCrtGuestParameter",
  "EXT_color_buffer_float",
]) {
  assert.ok(pass.includes(contract), `CRT pass is missing ${contract}`);
}

const coastPost = await text("src/coastpost.ts");
const order = [
  "addPass(this.smaaPass)",
  "addPass(this.unityPostPass)",
  "addPass(this.crtPass)",
  "addPass(this.outputPass)",
].map((needle) => coastPost.indexOf(needle));
assert.ok(order.every((index) => index >= 0), "Shared post stages are incomplete");
assert.deepEqual(order, [...order].sort((a, b) => a - b));

const main = await text("src/main.ts");
const html = await text("index.html");
assert.match(main, /createCrtGuestTuningPanel/);
assert.match(main, /crtSettings: crtGuestSettings/);
assert.match(main, /crt-diagnostics/);
assert.doesNotMatch(main, /crt-overlay/);
assert.doesNotMatch(html, /crt-overlay/);
const review = await text("src/crt-guest/review.ts");
assert.match(review, /new CrtGuestPass\(renderer, settings\)/);
assert.match(review, /__crtReview/);
assert.match(await text("crt-review.html"), /src\/crt-guest\/review\.ts/);

const expectedLuts = new Map([
  ["trinitron-lut.png", "bcc8c237eb39ed2a632554959cb4c5e0dd52b59a4922745b46b7525fc6b6b61a"],
  ["inv-trinitron-lut.png", "2acb6633e4dede7f36e3e62b7aa9d0ed76ecfbc5cb7ed7f3f8813dddec0e9145"],
  ["nec-lut.png", "86ec3d2e21138845cb73500e915425582b991e173a4149fa192a62d798382b59"],
  ["ntsc-lut.png", "a23ae9d27d6d5f9073d4a84678187f54758b329387c47686294ea979dcde6d03"],
]);
for (const [file, expected] of expectedLuts) {
  const bytes = await readFile(`${root}public/crt-guest/lut/${file}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, file);
}

const upstreamFiles = [];
for (const variant of variants) {
  const files = await readdir(`${root}tools/crt-guest-web/upstream/${variant}`);
  upstreamFiles.push(...files.filter((file) => file.endsWith(".slang")));
}
assert.equal(upstreamFiles.length, 22);
for (const required of [
  "public/crt-guest/provenance/GPL-2.0.txt",
  "public/crt-guest/provenance/ParameterManifest.json",
  "public/crt-guest/provenance/THIRD-PARTY-NOTICES.md",
  "public/crt-guest/provenance/UNITY-SOURCE-MANIFEST.md",
]) {
  assert.ok((await readFile(`${root}${required}`)).length > 0, required);
}

console.log(
  "Validated the 22-stage WebGL2 shader set, shared post order, exact LUTs, provenance, and CSS-overlay removal.",
);
