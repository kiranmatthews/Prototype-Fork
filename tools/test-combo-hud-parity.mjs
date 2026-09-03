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
assert.equal(hud.COMBO_CASH_IN_EXTRA_HOLD_MS, 2000);
assert.equal(hud.COMBO_TIMED_AWARD_SECONDS, 0.25);
assert.equal(hud.comboCashInIsHolding(2999, 3000), true);
assert.equal(hud.comboCashInIsHolding(3000, 3000), false);
assert.equal(hud.comboCashInIsHolding(3001, 3000), false);
assert.deepEqual(hud.advanceComboCashInDisplay(360, 100, 460, true), {
  combo: 360,
  score: 100,
});
assert.deepEqual(hud.advanceComboCashInDisplay(360, 100, 460, false), {
  combo: 327,
  score: 133,
});
assert.equal(hud.advanceConstantComboTicker(100, 106, 24, 1 / 60), 100.4);
assert.equal(hud.advanceConstantComboTicker(105.9, 106, 24, 1 / 60), 106);
assert.equal(hud.advanceConstantComboTicker(2, 0, 24, 1), 0);

for (const hz of [30, 60, 120]) {
  let ticker = hud.createLiveComboTicker(100);
  let elapsed = 0;
  while (elapsed < 0.25 - 1e-9) {
    const dt = Math.min(1 / hz, 0.25 - elapsed);
    ticker = hud.advanceLiveComboTicker(ticker, 106, dt);
    elapsed += dt;
  }
  assert.ok(Math.abs(ticker.displayed - 106) < 1e-9, `${hz} Hz ticker did not land`);
}

for (const hz of [30, 60, 120]) {
  let steady = hud.createLiveComboTicker(100);
  let target = 100;
  let elapsed = 0;
  let nextAward = 0.25;
  let lastRounded = 100;
  let lastChangeAt = 0.25;
  let longestPauseSeconds = 0;
  while (elapsed < 1.2 - 1e-9) {
    const dt = Math.min(1 / hz, 1.2 - elapsed);
    elapsed += dt;
    while (nextAward <= elapsed + 1e-9) {
      target += 6;
      nextAward += 0.25;
    }
    const previous = steady.displayed;
    steady = hud.advanceLiveComboTicker(steady, target, dt);
    assert.ok(steady.displayed >= previous, `${hz} Hz ticker reversed`);
    assert.ok(steady.displayed <= target, `${hz} Hz ticker overshot`);
    const roundedValue = Math.round(steady.displayed);
    if (elapsed >= 0.25 && roundedValue !== lastRounded) {
      longestPauseSeconds = Math.max(longestPauseSeconds, elapsed - lastChangeAt);
      lastChangeAt = elapsed;
      lastRounded = roundedValue;
    }
  }
  assert.ok(
    longestPauseSeconds <= 0.07,
    `${hz} Hz steady grind ticker paused ${longestPauseSeconds}s`,
  );
  assert.equal(steady.pointsPerSecond, 24);
}

let partialTicker = hud.createLiveComboTicker(100);
partialTicker = hud.advanceLiveComboTicker(partialTicker, 106, 1 / 60);
assert.ok(partialTicker.displayed > 100 && partialTicker.displayed < 106);
partialTicker = hud.createLiveComboTicker(250); // fixed revision snaps
assert.deepEqual(partialTicker, {
  displayed: 250,
  target: 250,
  pointsPerSecond: 0,
});
assert.deepEqual(hud.createLiveComboTicker(), {
  displayed: 0,
  target: 0,
  pointsPerSecond: 0,
});

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
assert.deepEqual(
  hud.wrapComboLabelLine(
    "KICKFLIP + HEELFLIP + IMPOSSIBLE",
    21,
    (value) => value.length,
  ),
  ["KICKFLIP + HEELFLIP", "IMPOSSIBLE"],
);
assert.deepEqual(
  hud.wrapComboLabelLine("KICKFLIP + HEELFLIP", 100, (value) => value.length),
  ["KICKFLIP + HEELFLIP"],
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
assert.match(ui, /comboPreview/);
assert.match(ui, /fixedChanged/);
assert.match(ui, /comboBank\(amount: number, labels: string\)/);
assert.match(ui, /performance\.now\(\) \+ COMBO_CASH_IN_EXTRA_HOLD_MS/);
assert.match(ui, /comboCashInIsHolding\(hudNow, this\.comboCashInHoldEnd\)/);
assert.match(ui, /advanceComboCashInDisplay\([\s\S]{0,180}cashInHolding/);
assert.match(ui, /this\.dispScore = cashInFrame[\s\S]{0,100}cashInFrame\.score/);
assert.match(
  ui,
  /setHudReveal\(\s*this\.scorePlateEl,[\s\S]{0,180}this\.comboState === "cashin"/,
  "banking combo points does not reveal the score HUD",
);
assert.match(ui, /else if \(!cashInHolding\)[\s\S]{0,140}cashInFrame\?\.combo/);
assert.match(ui, /advanceLiveComboTicker\(/);
assert.match(ui, /setHUD\(s: HudState, deltaSeconds = 1 \/ 60\)/);
assert.doesNotMatch(ui, /new RooLabel\(this\.trick(?:Line|Total)El/);
assert.doesNotMatch(ui, /["']BAILED!["']/);
assert.doesNotMatch(ui, /rooTrick(?:Line|Total)/);
assert.match(
  ui,
  /\.hud-trickline \{[\s\S]*?font: 400[^;]+['"]Roo['"][^;]+Impact/,
);
assert.match(
  ui,
  /\.hud-tricktotal \{[\s\S]*?font: 400[^;]+['"]Roo['"][^;]+Impact/,
);
const comboBailBody = ui.match(
  /comboBail\(labels: string, pendingPoints: number, multiplier: number\): void \{([\s\S]*?)\n  \}/,
)?.[1] ?? "";
assert.match(comboBailBody, /const hasDisplayedCopy/);
assert.match(comboBailBody, /if \(!hasDisplayedCopy\)/);
assert.match(comboBailBody, /this\.trickPlate\.classList\.add\("hud-trick-bail"\)/);
assert.match(ui, /white-space: normal/);
assert.match(ui, /\.hud-combostack \{[\s\S]*?width: min\(94vw, 1100px\)/);
assert.match(ui, /\.hud-trickplate \{[\s\S]*?position: relative; width: 100%/);
assert.match(ui, /\.hud-boosts \{[\s\S]*?position: relative/);
assert.match(ui, /hud-combo-present \.hud-(?:balance|vbalance)/);
const zeroLeadingRule = ui.match(
  /([^{}]+)\{\s*line-height: 0;\s*\}/,
)?.[1] ?? "";
assert.doesNotMatch(zeroLeadingRule, /hud-trick(?:line|total)/);
assert.doesNotMatch(ui, /\.hud-msg,\s*\.hud-trickplate/);
const bailKeyframes = ui.match(/@keyframes trickbail \{([\s\S]*?)\n      \}/)?.[1] ?? "";
assert.match(bailKeyframes, /translateY\(92px\)/);
assert.match(bailKeyframes, /opacity: 0/);
assert.doesNotMatch(bailKeyframes, /rotate\(/);
const surface = await readFile(`${root}src/gameHudSurface.ts`, "utf8");
assert.match(surface, /SOURCE_HUD_TRACKING\.largeNumber/);
assert.match(surface, /const stableTextWidth = Math\.min\(width \* 0\.94, 1100 \* layout\.scaleX\)/);
assert.match(surface, /drawWrappedPlainText\(ctx, line, stableLineRect/);
assert.match(surface, /color: bailed \? "#ff3b30" : "#ffe08a"/);
const trickPainter = surface.match(/private paintTrick\(([\s\S]*?)\n  private paintBalance/)?.[1] ?? "";
assert.doesNotMatch(trickPainter, /drawRooInRect/);
assert.match(
  trickPainter,
  /const comboFamily = `"\$\{this\.fontFamily\}", Impact/,
);
assert.equal((trickPainter.match(/weight: "400"/g) ?? []).length, 2);
const rooCss = await readFile(`${root}src/roo-text.css`, "utf8");
assert.match(rooCss, /font-family: "Roo"/);
assert.match(rooCss, /RooRegular\.ttf/);
const player = await readFile(`${root}src/player.ts`, "utf8");
assert.match(player, /get comboHudPreview\(\)/);
assert.match(player, /deckTrickPreviewSequence\+\+/);
assert.match(player, /comboHudActionRevision\+\+/);
assert.match(player, /onComboBank\(amount, sourceComboLabelLine\(this\.comboLabels\)\)/);
assert.match(player, /onComboBail\([\s\S]*sourceComboLabelLine\(this\.comboLabels\)[\s\S]*this\.comboPoints[\s\S]*this\.comboMult/);
assert.match(player, /while \(this\.grindTickT >= 0\.25\)[\s\S]{0,180}this\.comboPoints \+= CONST\.ptsGrindTick/);
const main = await readFile(`${root}src/main.ts`, "utf8");
assert.match(main, /comboPreview = player\.comboHudPreview/);
assert.match(main, /comboActionRevision: player\.comboActionRevision/);
assert.match(main, /tricks: sourceComboLabelLine\(player\.comboLabels\)/);
assert.match(main, /ui\.setHUD\(currentHudState\(\), dt\);/);

console.log(
  "Validated combo purse-vs-bank math, multiline plain text, constant live ticker, hold timing, and frozen red bail fall-away.",
);
