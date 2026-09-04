import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const [levelSource, playerSource, mainSource, campaignSource] =
  await Promise.all([
    readFile(`${root}src/level.ts`, "utf8"),
    readFile(`${root}src/player.ts`, "utf8"),
    readFile(`${root}src/main.ts`, "utf8"),
    readFile(`${root}src/campaign.ts`, "utf8"),
  ]);

function sourceFile(name, source) {
  return ts.createSourceFile(
    name,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

const levelFile = sourceFile("level.ts", levelSource);
const playerFile = sourceFile("player.ts", playerSource);
const mainFile = sourceFile("main.ts", mainSource);

function classMethod(file, className, methodName) {
  let result;
  function visit(node) {
    if (
      ts.isClassDeclaration(node) &&
      node.name?.text === className
    ) {
      result = node.members.find(
        (member) =>
          ts.isMethodDeclaration(member) &&
          member.name.getText(file) === methodName,
      );
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(result, `${className}.${methodName} is missing`);
  return result;
}

function topLevelFunction(file, functionName) {
  const result = file.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === functionName,
  );
  assert.ok(result, `${functionName} is missing`);
  return result.getText(file);
}

function evaluateTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", output)(module.exports, module);
  return module.exports;
}

// The durable state projection is deliberately silent. Exercise the real
// method body in a tiny harness so both true and false baselines are guarded.
const projectionMethod = classMethod(
  levelFile,
  "Level",
  "setCommittedCollectibles",
);
const projectionText = projectionMethod.getText(levelFile);
assert.doesNotMatch(
  projectionText,
  /glimmerBurst|collectCrystal|sfx\.|score\(/,
  "loading save data must not replay pickup VFX, sound, or score",
);
const { ProjectionHarness } = evaluateTypeScript(`
  export class ProjectionHarness {
    committedCrystal = false;
    committedBoxGem = false;
    crystalPickup = null;
    gemPickup = null;
    runMode = false;
    ${projectionText}
  }
`);

const owned = new ProjectionHarness();
owned.crystalPickup = { collected: false, group: { visible: true } };
owned.gemPickup = { collected: false, group: { visible: true } };
owned.setCommittedCollectibles({ crystal: true, boxGem: true });
assert.equal(owned.committedCrystal, true);
assert.equal(owned.committedBoxGem, true);
assert.equal(owned.crystalPickup.collected, true);
assert.equal(owned.crystalPickup.group.visible, false);
assert.equal(owned.gemPickup.collected, true);
assert.equal(owned.gemPickup.group.visible, false);

const fresh = new ProjectionHarness();
fresh.crystalPickup = { collected: true, group: { visible: false } };
fresh.setCommittedCollectibles({ crystal: false, boxGem: false });
assert.equal(fresh.committedCrystal, false);
assert.equal(fresh.committedBoxGem, false);
assert.equal(fresh.crystalPickup.collected, false);
assert.equal(fresh.crystalPickup.group.visible, true);

// Run just reset()'s hard-reset branch. Soft reset must leave a pickup earned
// in the current run alone; hard reset must return to the committed baseline.
const resetMethod = classMethod(levelFile, "Level", "reset");
const hardResetStatement = resetMethod.body?.statements.find(
  (statement) =>
    ts.isIfStatement(statement) && statement.expression.getText(levelFile) === "hard",
);
assert.ok(hardResetStatement, "Level.reset lost its hard-reset branch");
const crystalResetWrites = [];
function collectCrystalResetWrites(node) {
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    node.left.getText(levelFile).startsWith("this.crystalPickup.")
  )
    crystalResetWrites.push(node);
  ts.forEachChild(node, collectCrystalResetWrites);
}
collectCrystalResetWrites(resetMethod);
assert.ok(crystalResetWrites.length >= 2, "crystal reset state is not explicit");
for (const write of crystalResetWrites) {
  assert.ok(
    write.pos >= hardResetStatement.pos && write.end <= hardResetStatement.end,
    "a soft reset must not mutate crystal ownership or visibility",
  );
}
const { ResetHarness } = evaluateTypeScript(`
  export class ResetHarness {
    committedCrystal = false;
    crystalPickup = null;
    clockPickup = null;
    comboOrb = null;
    gemG = null;
    gemPickup = null;
    timeTrial = false;
    comboRun = false;
    runModesOn = true;
    root = { remove() {} };
    reset(hard) { ${hardResetStatement.getText(levelFile)} }
  }
`);

const reset = new ResetHarness();
reset.crystalPickup = { collected: true, group: { visible: false } };
reset.clockPickup = { collected: true, group: { visible: false } };
reset.comboOrb = { collected: true, group: { visible: false } };
reset.reset(false);
assert.deepEqual(reset.crystalPickup, {
  collected: true,
  group: { visible: false },
}, "soft death must retain an uncommitted current-run crystal");
assert.equal(reset.clockPickup.collected, true);
assert.equal(reset.comboOrb.collected, true);

reset.reset(true);
assert.equal(reset.crystalPickup.collected, false);
assert.equal(reset.crystalPickup.group.visible, true);
assert.equal(reset.clockPickup.collected, false);
assert.equal(reset.clockPickup.group.visible, true);
assert.equal(reset.comboOrb.collected, false);
assert.equal(reset.comboOrb.group.visible, true);

reset.committedCrystal = true;
reset.crystalPickup.collected = false;
reset.crystalPickup.group.visible = true;
reset.reset(true);
assert.equal(reset.crystalPickup.collected, true);
assert.equal(reset.crystalPickup.group.visible, false);

// Exercise the actual all-box condition: saved ownership suppresses a second
// gem, while an otherwise identical fresh run still materializes one.
let boxGemIf;
function findBoxGemCondition(node) {
  if (
    ts.isIfStatement(node) &&
    node.thenStatement.getText(playerFile).includes("level.awardGem(this.pos)")
  ) {
    if (!boxGemIf || node.getWidth(playerFile) < boxGemIf.getWidth(playerFile))
      boxGemIf = node;
  }
  ts.forEachChild(node, findBoxGemCondition);
}
findBoxGemCondition(playerFile);
assert.ok(boxGemIf, "all-box gem materialization condition is missing");
const boxGemCondition = boxGemIf.expression.getText(playerFile);
assert.match(boxGemCondition, /!this\.gemEarned/);
const { BoxGemHarness } = evaluateTypeScript(`
  export class BoxGemHarness {
    bonusMode = false;
    gemSpawned = false;
    gemEarned = false;
    cratesBroken = 12;
    bonusCrates = 0;
    state = "ride";
    shouldMaterialize(level) { return ${boxGemCondition}; }
  }
`);
const boxGemPlayer = new BoxGemHarness();
const completedBoxes = { runMode: false, totalCrates: 12 };
assert.equal(
  boxGemPlayer.shouldMaterialize(completedBoxes),
  true,
  "a fresh all-box clear must still materialize its gem",
);
boxGemPlayer.gemEarned = true;
assert.equal(
  boxGemPlayer.shouldMaterialize(completedBoxes),
  false,
  "a committed box gem must not materialize again",
);

// Campaign data must win only after every shared Level reset has completed.
const adoption = topLevelFunction(mainFile, "adoptCommittedCampaignProgress");
assert.match(
  adoption,
  /level\.setCommittedCollectibles\(\{[\s\S]*crystal: progress\?\.crystal \?\? false,[\s\S]*boxGem: progress\?\.boxGem \?\? false/,
);
assert.match(
  adoption,
  /player\.setCampaignRelics\([\s\S]*if \(split2p && p2\)[\s\S]*p2\.setCampaignRelics\(/,
  "campaign adoption must project the same saved shelf into both riders",
);
for (const functionName of ["switchLevel", "set2P", "rebuildLevel"]) {
  const body = topLevelFunction(mainFile, functionName);
  const adoptionAt = body.lastIndexOf("adoptCommittedCampaignProgress(");
  const p1ResetAt = body.lastIndexOf("player.respawn(level, true");
  const p2ResetAt = body.lastIndexOf("p2.respawn(level, true");
  assert.ok(p1ResetAt >= 0, `${functionName} lost its P1 hard reset`);
  assert.ok(
    adoptionAt > p1ResetAt && adoptionAt > p2ResetAt,
    `${functionName} must adopt campaign state after all P1/P2 hard resets`,
  );
}

// A time-trial clock and combo orb are replay activators, not one-shot save
// trophies. They intentionally re-arm on a hard reset, and the combo goal can
// still spawn for another attempt after its award has been banked.
assert.match(
  hardResetStatement.getText(levelFile),
  /this\.clockPickup\.collected = false[\s\S]*this\.comboOrb\.collected = false/,
);
const setRunModesText = classMethod(
  levelFile,
  "Level",
  "setRunModesEnabled",
).getText(levelFile);
assert.match(setRunModesText, /on && !this\.clockPickup\.collected/);
assert.match(setRunModesText, /on && !this\.comboOrb\.collected/);
const spawnComboGemText = classMethod(
  levelFile,
  "Level",
  "spawnComboGem",
).getText(levelFile);
assert.doesNotMatch(spawnComboGemText, /committed|comboGemEarned|timeRelic/);
assert.match(
  campaignSource,
  /runModesUnlocked\(levelId: string\): boolean \{[\s\S]{0,180}progress\.cleared && progress\.crystal/,
  "earned combo/time awards must not disable their replay objectives",
);

console.log(
  "Validated committed collectible visibility, reset semantics, and replay objectives.",
);
