import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(`${root}src/specialTricks.ts`, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
  },
}).outputText;
const special = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

const fixed = 1 / 60;
const full = () => {
  const meter = new special.SpecialSystem();
  assert.equal(meter.award(special.SPECIAL_POINTS_TO_FULL), true);
  assert.equal(meter.value, 100);
  assert.equal(meter.ready, true);
  return meter;
};
const neutral = (meter) => meter.step(fixed, 0, 0);

{
  const meter = full();
  meter.step(fixed, -1, 0);
  neutral(meter);
  meter.step(fixed, 1, 0);
  assert.equal(meter.peek('flip')?.id, 'kickflip-mctwist');
  assert.equal(meter.peek('grind')?.id, 'darkslide');
  assert.equal(meter.peek('grab'), null);
  meter.commit(meter.peek('flip'));
  assert.equal(meter.peek('flip'), null, 'a committed command is one-shot');
  meter.step(fixed, 1, 0);
  assert.equal(meter.peek('flip'), null, 'a held axis never repeats its edge');
}

{
  const meter = full();
  meter.step(fixed, -1, 0);
  meter.step(fixed, 1, 0); // direct opposite, no neutral frame
  assert.equal(meter.peek('flip')?.id, 'kickflip-mctwist');
}

{
  const meter = full();
  meter.step(fixed, 1, 0);
  neutral(meter);
  meter.step(fixed, 0, -1);
  assert.equal(meter.peek('grab')?.id, 'the-900');
  for (let i = 0; i < 7; i++) meter.step(fixed, 0, -1);
  assert.equal(meter.peek('grab'), null, 'the final direction/button chord has only 0.1 s grace');
}

{
  const meter = full();
  meter.step(fixed, 1, 0);
  neutral(meter);
  meter.step(fixed, -1, 0);
  assert.equal(meter.peek('flip'), null, 'reversed recipes do not match');
}

{
  const meter = full();
  meter.step(fixed, -1, 0);
  neutral(meter);
  for (let i = 0; i < 28; i++) neutral(meter);
  meter.step(fixed, 1, 0);
  assert.equal(meter.peek('flip'), null, 'stale direction one expires');
}

{
  const meter = new special.SpecialSystem();
  meter.award(special.SPECIAL_POINTS_TO_FULL / 2);
  assert.equal(meter.ready, false);
  assert.equal(meter.value, 50);
  for (let i = 0; i < 5 * 60; i++) neutral(meter);
  assert.ok(meter.value < 50 && meter.value > 40, 'partial progress decays gently after idle delay');
  meter.award(special.SPECIAL_POINTS_TO_FULL);
  assert.equal(meter.ready, true);
  for (let i = 0; i < 10 * 60; i++) neutral(meter);
  assert.equal(meter.value, 0);
  assert.equal(meter.ready, false, 'the active window eventually drains away');
  meter.wipe();
  assert.equal(meter.value, 0);
}

{
  // A Player-owned temporary powerup may present and authorize full SPECIAL
  // without changing the earned meter underneath it.
  const meter = new special.SpecialSystem();
  meter.award(special.SPECIAL_POINTS_TO_FULL / 2);
  const earnedValue = meter.value;
  assert.equal(meter.ready, false);
  assert.equal(meter.effectiveValue(true), special.SPECIAL_MAX);
  assert.equal(meter.effectiveReady(true), true);
  assert.equal(meter.value, earnedValue, 'forced full mutated earned progress');
  assert.equal(meter.ready, false, 'forced readiness armed the earned meter');

  meter.step(fixed, -1, 0);
  neutral(meter);
  meter.step(fixed, 1, 0);
  assert.equal(meter.peek('flip'), null, 'partial earned meter authorized a special');
  const forced = meter.peek('flip', true);
  assert.equal(forced?.id, 'kickflip-mctwist');
  meter.commit(forced);
  assert.equal(meter.value, earnedValue, 'forced special commit minted earned meter');
  assert.equal(meter.ready, false);

  // Wiping ordinary combo state cannot revoke an independently live powerup;
  // removing the outside override reveals the correctly wiped base meter.
  meter.wipe();
  assert.equal(meter.effectiveValue(true), special.SPECIAL_MAX);
  assert.equal(meter.effectiveReady(true), true);
  assert.equal(meter.effectiveValue(false), 0);
  assert.equal(meter.effectiveReady(false), false);
}

for (const [category, face] of [
  ['flip', '□'],
  ['grab', '○'],
  ['grind', '△'],
]) {
  const trick = special.SPECIAL_TRICKS.find((candidate) => candidate.category === category);
  assert.ok(trick, `missing ${category} special`);
  assert.ok(trick.controls.includes(face), `${category} uses the wrong THPS face button`);
  assert.ok(trick.points > 0);
}

const player = await readFile(`${root}src/player.ts`, 'utf8');
for (const contract of [
  'SpecialSystem',
  'tryStartSpecialFlip',
  'tryStartSpecialGrab',
  'pendingSpecialGrind',
  "sfx.play('specialTrick'",
]) {
  assert.ok(player.includes(contract), `Player SPECIAL integration missing ${contract}`);
}
assert.match(
  player,
  /get specialMeter\(\)[\s\S]{0,180}effectiveValue\(this\.tripleMaskSpecialActive\)/,
  'triple mask must present full SPECIAL without mutating earned meter',
);
assert.match(
  player,
  /get specialReady\(\)[\s\S]{0,180}effectiveReady\(this\.tripleMaskSpecialActive\)/,
  'triple mask readiness must use the same temporary context as its meter',
);
for (const category of ['flip', 'grab', 'grind']) {
  assert.ok(
    player.includes(`this.special.peek('${category}', tripleMaskSpecial)`),
    `triple mask readiness missing from ${category} command routing`,
  );
}
const uberTick = 'this.uberTimer = Math.max(0, this.uberTimer - dt);';
assert.equal(
  player.split(uberTick).length - 1,
  1,
  'uber timer must advance exactly once across ordinary/rope/hang routes',
);
assert.ok(
  player.indexOf(uberTick) < player.indexOf('this.special.step(dt, input.moveX, input.moveY);'),
  'uber expiry must resolve before SPECIAL command decoding',
);
assert.match(
  player,
  /private die\(\): void \{[\s\S]{0,420}this\.uberTimer = 0;[\s\S]{0,80}this\.state = 'dead';/,
  'death must revoke the triple-mask SPECIAL override immediately',
);

const hud = await readFile(`${root}src/gameHudSurface.ts`, 'utf8');
assert.ok(hud.includes('paintSpecial'), 'pre-CRT HUD must paint the radial SPECIAL meter');
const ui = await readFile(`${root}src/ui.ts`, 'utf8');
assert.ok(ui.includes('hud-special-ready'), 'DOM HUD must expose SPECIAL readiness');

const audio = await readFile(`${root}src/audio.ts`, 'utf8');
assert.ok(audio.includes("specialTrick: 'special-trick.mp3'"), 'SPECIAL sting is not preloaded');
assert.ok(audio.includes('pitchVariance = 0.04'), 'one-shots need an exact-pitch escape hatch');
const sting = await readFile(`${root}public/sfx/special-trick.mp3`);
assert.ok(sting.length > 16_000, 'SPECIAL sting asset is missing or truncated');

// SPECIAL is transient Player state. It must never enter authored component
// data or a no-op editor open/close can mutate the level snapshot.
for (const path of ['src/level.ts', 'src/editor.ts']) {
  const authored = await readFile(`${root}${path}`, 'utf8');
  assert.doesNotMatch(authored, /specialMeter|SpecialSystem/,
    `${path} must not serialize runtime SPECIAL state`);
}

console.log('Validated deterministic SPECIAL meter, THPS command grammar and runtime/HUD hooks.');
