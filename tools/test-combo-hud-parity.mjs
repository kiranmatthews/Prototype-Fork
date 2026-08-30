import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/comboHud.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const hud = module.exports;

assert.equal(hud.sourceComboPurseTarget(180), 180);
assert.equal(hud.sourceLiveComboText(180, 2), "180  ×2");
assert.notEqual(hud.sourceLiveComboText(180, 2), "360  ×2");
assert.equal(hud.sourceComboBankTotal(180, 2), 360);
assert.equal(hud.sourceComboBankTotal(25, 0), 25);
assert.equal(hud.advanceSourceComboTicker(0, 1000), 90);
assert.equal(hud.advanceSourceComboTicker(999, 1000), 1000);

const previewLabels = hud.projectComboLabels(["Slide"], "Kickflip");
assert.equal(hud.sourceComboLabelLine(previewLabels), "Slide + Kickflip");
assert.equal(hud.sourceLiveComboText(30 + 110, 1 + 1), "140  ×2");
assert.deepEqual(
  hud.projectComboLabels(["Slide", "Kickflip"], "Kickflip"),
  ["Slide", "Kickflip x2"],
);
assert.equal(
  hud.sourceComboLabelLine(["A", "B", "C", "D", "E", "F", "G"]),
  "… + B + C + D + E + F + G",
);
assert.deepEqual(hud.SOURCE_HUD_TRACKING, {
  largeNumber: -6.5,
  trickTitle: 2,
  trickValue: 4,
  word: 0,
});
assert.equal(hud.sourceTrackingPixels(-6.5, 200), -6.5);

const ui = await readFile(`${root}src/ui.ts`, "utf8");
assert.match(ui, /sourceComboPurseTarget\(preview\?\.points \?\? s\.comboPoints\)/);
assert.doesNotMatch(ui, /s\.comboPoints \* s\.comboMult/);
assert.match(ui, /SOURCE_HUD_TRACKING\.trickTitle/);
assert.match(ui, /SOURCE_HUD_TRACKING\.trickValue/);
assert.match(ui, /comboPreview/);
assert.match(ui, /fixedChanged/);
assert.match(ui, /comboBank\(amount: number, labels: string\)/);
const surface = await readFile(`${root}src/gameHudSurface.ts`, "utf8");
assert.match(surface, /SOURCE_HUD_TRACKING\.largeNumber/);
assert.match(surface, /SOURCE_HUD_TRACKING\.trickTitle/);
assert.match(surface, /SOURCE_HUD_TRACKING\.trickValue/);
const player = await readFile(`${root}src/player.ts`, "utf8");
assert.match(player, /get comboHudPreview\(\)/);
assert.match(player, /deckTrickPreviewSequence\+\+/);
assert.match(player, /comboHudActionRevision\+\+/);
assert.match(player, /onComboBank\(amount, sourceComboLabelLine\(this\.comboLabels\)\)/);
const main = await readFile(`${root}src/main.ts`, "utf8");
assert.match(main, /comboPreview = player\.comboHudPreview/);
assert.match(main, /comboActionRevision: player\.comboActionRevision/);

console.log(
  "Validated source combo purse-vs-bank math, exact live/cash-in copy, preview labels, ticker, and authored HUD tracking.",
);
