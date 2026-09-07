import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/mapLevelPresentation.ts', import.meta.url), 'utf8');
// Exercise the dependency-free transition and clock without constructing the
// renderer-owned presentation (its actual GPU path is browser-smoke-tested).
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText.replace(/^import .*;\n/gm, '');
const { MapDeckFlip, MapLevelPresentation, MAP_DECK_FLIP_SECONDS: duration, mapTrialTime } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
globalThis.TIME_MEDALS = ['gold', 'silver', 'bronze'];
globalThis.TIME_MEDAL_COLORS = {gold: 0xf8c64e, silver: 0xc6d5e2, bronze: 0xc98246};
for (const [medal, expected] of [[null, 0], ['bronze', 1], ['silver', 2], ['gold', 3]]) {
  const labels = [];
  const ctx = new Proxy({ fillText: text => labels.push(text) }, {get: (obj, key) => obj[key] ?? (() => {})});
  const trialTexture = {image: {width: 768, height: 800, getContext: () => ctx}};
  MapLevelPresentation.prototype.paintTrial.call({trialTexture}, {medal, targets: {gold:60, silver:69, bronze:78}});
  assert.deepEqual(labels.filter(label => ['GOLD','SILVER','BRONZE'].includes(label)), ['GOLD','SILVER','BRONZE']);
  assert.equal(labels.filter(label => label === 'EARNED').length, expected);
  assert.equal(labels.length, 7, 'exactly one heading and three label/value rows');
}
const data = key => ({ key, name: key, earned: [false, false, false, false], trialUnlocked: false, times: [], target: 60 });
const flip = new MapDeckFlip();
flip.select(data('a')); assert.equal(flip.active, false);
flip.select(data('b')); assert.equal(flip.active, true);
flip.step(duration * .49); assert.equal(flip.shown.key, 'a', 'printing changed while still facing the player');
flip.step(duration * .02); assert.equal(flip.shown.key, 'b', 'hidden-face swap missed');
flip.select(data('c')); flip.step(duration * .5);
assert.equal(flip.shown.key, 'b', 'late input snapped the visible printing');
assert.equal(flip.active, true, 'late input needs its own reveal');
flip.step(duration); assert.equal(flip.shown.key, 'c'); assert.equal(flip.active, false);
flip.select({ ...data('c'), earned: [true, false, false, false] });
assert.equal(flip.active, false, 'progress refresh restarted the selection animation');
assert.equal(flip.shown.earned[0], true);
flip.select(data('d')); flip.step(-1); assert.equal(flip.phase, 0);
flip.select(data('a'), true); assert.equal(flip.active, false); assert.equal(flip.shown.key, 'a');
assert.equal(mapTrialTime(65.8), '1:05.80');
assert.equal(mapTrialTime(59.999), '0:59.99');
assert.equal(mapTrialTime(undefined), '—:——.——');
assert.equal(mapTrialTime(NaN), '—:——.——');
for (const factory of ['createSkateboardPresentation(', 'Level.crystalMesh()', 'Level.gemMesh()', 'Level.gemMesh(1, COMBO_GEM_TINT)', 'Level.timeRelicMesh()']) assert.ok(source.includes(factory), `missing game-owned asset: ${factory}`);
assert.doesNotMatch(source, /new THREE.WebGLRenderer/, 'map cards must share the existing renderer');
assert.doesNotMatch(source, /PERSONAL BESTS|MEDAL TARGETS|"1st"|"2nd"|"3rd"/, 'race card must contain only one medal list');
assert.match(source, /earned \? 'EARNED' : mapTrialTime\(targets\[tier\]\)/, 'earned medals replace obsolete target times');
assert.match(source, /renderer\.setRenderTarget\(oldTarget, oldFace, oldMip\)/);
assert.match(source, /renderer\.setScissorTest\(scissorTest\); renderer\.autoClear = autoClear/);
const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
assert.match(main, /worldMapUI\?\.draw\(context.renderer, dt, size, context.target\);\s*gameInterface.draw/, '3D cards must be before CRT and touch/cursor ink');
assert.match(main, /worldMapUI\?\.draw\(renderer, dt\);\s*if \(!showHud\) return/, 'lite needs map geometry even with gameplay HUD hidden');
console.log('Validated map deck hidden-face swaps, queued navigation, clock formatting, asset reuse and CRT routing.');
