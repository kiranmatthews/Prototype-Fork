import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const relativeFile = "src/levels/jungle-cliff.ts";
const file = path.join(root, relativeFile);
const source = readFileSync(file, "utf8");
const registrySource = readFileSync(path.join(root, "src/level.ts"), "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: file,
}).outputText;
const encoded = Buffer.from(
  `${output}\n//# sourceURL=${pathToFileURL(file).href}`,
).toString("base64");
const { JUNGLE_CLIFF_LEVEL: level } = await import(
  `data:text/javascript;base64,${encoded}`
);

assert.equal(level.v, 1);
assert.match(level.name, /Jungle Cliff/i);
assert.match(registrySource, /id:\s*"jungle-cliff"/);
assert.match(registrySource, /data:\s*JUNGLE_CLIFF_LEVEL/);
assert.equal(level.components.filter((component) => component.t === "gate").length, 1);
assert.ok(level.components.length < 512, "port exceeds the source-level component budget");

const componentsOf = (type) =>
  level.components.filter((component) => component.t === type);

assert.ok(componentsOf("terrain").length >= 2, "winding source route needs terrain ribbons");
assert.ok(componentsOf("platform").length >= 6, "cliff route needs authored ledges");
assert.ok(componentsOf("camnode").length >= 10, "camera spine was not reconstructed");
assert.ok(
  componentsOf("zone").some((zone) => zone.dir === "W" || zone.dir === "E"),
  "side-view cliff section is missing",
);
assert.ok(componentsOf("checkpoint").length >= 3, "source checkpoint cadence was lost");

const crateKinds = new Set(componentsOf("crate").map((crate) => crate.kind));
for (const kind of [
  "life",
  "multihit",
  "metalbounce",
  "mystery",
  "tnt",
  "nitro",
  "mask",
]) {
  assert.ok(crateKinds.has(kind), `source crate family missing: ${kind}`);
}

const points = [level.spawn, ...level.components.map((component) => component.p)];
const xs = points.map((point) => point[0]);
const zs = points.map((point) => point[2]);
assert.ok(Math.max(...xs) - Math.min(...xs) > 120, "cliff/side route is too compressed");
assert.ok(Math.max(...zs) - Math.min(...zs) > 180, "main route lost its long descent/ascent");

const gate = componentsOf("gate")[0];
assert.ok(gate.p[2] < -185, "finish no longer reaches the recovered final corridor");
assert.ok(gate.p[1] > 55, "finish no longer reaches the recovered upper terrace");

assert.doesNotMatch(
  source,
  /\.ig[ab]|\.hkx|\.hka|public\//i,
  "procedural port must not reference redistributed Crash assets",
);

console.log(
  `Validated ${level.name}: ${level.components.length} components, ` +
    `${componentsOf("crate").length} crates, ${componentsOf("camnode").length} camera nodes.`,
);
