import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';

class Element {
  children = []; listeners = {}; value = ''; textContent = '';
  constructor(tag) { this.tagName = tag; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  attributes = {};
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  blur() {}
}
const exports = {};
const code = ts.transpileModule(await readFile(new URL('../src/editorEnvironment.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const atmosphereExports = {};
const atmosphereCode = ts.transpileModule(await readFile(new URL('../src/levelAtmosphere.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const nightworksShapes = JSON.parse(await readFile(new URL('../src/nightworksShapes.json', import.meta.url), 'utf8'));
new Function('exports', 'require', atmosphereCode)(atmosphereExports, name => {
  if (name === './nightworksRocks') return { isNightworksSurface: kind => !!kind && Object.hasOwn(nightworksShapes, kind) };
  assert.equal(name, 'three'); return THREE;
});
new Function('exports', 'document', 'require', code)(exports, { createElement: tag => new Element(tag) }, name => {
  assert.equal(name, './levelAtmosphere'); return atmosphereExports;
});
const { EditorEnvironment, straightenOceanShoreline } = exports;
let data = { v: 1, name: 'Environment regression', spawn: [0, 1, 0], killY: -30, components: [{ t: 'gate', p: [0, 0, -20] }] };
const clone = value => JSON.parse(JSON.stringify(value));
const history = [];
let last = clone(data);
let env;
let levelId = "environment-test";
const commits = () => { history.push(last); last = clone(data); env.sync(); };
env = new EditorEnvironment({
  data: () => data,
  levelId: () => levelId,
  cameraFocus: () => [12, 3, -25],
  focus: point => assert.ok(point.every(Number.isFinite)),
  commit: commits,
  number(label, get, set) {
    const row = new Element('number'); row.textContent = label; row.get = get;
    row.edit = value => { set(value); commits(); }; return row;
  },
});
const button = label => {
  const found = env.element.children.find(e => e.tagName === 'button' && e.textContent === label);
  assert.ok(found, `button ${label}`); found.listeners.click();
};
const edit = (label, value) => {
  const row = env.element.children.find(e => e.tagName === 'number' && e.textContent === label);
  assert.ok(row, `field ${label}`); row.edit(value); assert.equal(row.get(), value);
};
button('add ocean at focus');
assert.equal(data.ocean.geometryVersion, 2, 'new oceans need canonical editor coordinates');
edit('ocean y', -2); edit('ocean yaw °', 45); edit('ocean width', 90);
assert.deepEqual(data.ocean.p, [12, -2, -25]);
button('add sand at focus');
edit('sand width', 22); edit('sand y', 8); edit('sand yaw °', 90);
button('add sand at focus');
edit('sand x', -10);
assert.equal(data.unitySand[0].p[0], 12, 'editing one patch must not move another');
button('remove sand patch');
assert.equal(data.unitySand.length, 1);
button('add foam at focus');
edit('foam y', -2); edit('foam half width', 9); edit('foam yaw °', 90);
assert.ok(Math.abs(data.shoreFoam[0].right[2] + 1) < 1e-8);
assert.ok(Math.abs(data.shoreFoam[0].forward[0] - 1) < 1e-8);
button('edit shoreline nodes');
edit('ocean length', 200);
assert.deepEqual(data.ocean.shore.map(p => p[1]), [100, -100]);
edit('shore local x', 3); edit('shore normal °', 90);
button('insert shore node'); assert.equal(data.ocean.shore.length, 3);
button('remove shore node'); assert.equal(data.ocean.shore.length, 2);
button('use straight shoreline'); assert.equal(data.ocean.shore, undefined);
const beforeRemove = clone(data);
button('remove ocean'); button('remove sand patch'); button('remove foam ring');
assert.equal(data.ocean, undefined); assert.equal(data.unitySand, undefined); assert.equal(data.shoreFoam, undefined);
assert.deepEqual(data.components, beforeRemove.components, 'environment edits must preserve gameplay components');
data = beforeRemove; env.render();
for (const row of env.element.children.filter(e => e.get)) assert.ok(Number.isFinite(row.get()), 'undo must bind fields to restored data');
data = clone(history[0]); env.sync();
assert.ok(!env.element.children.some(e => e.textContent === 'ocean width'), 'reset must remove stale fields');
// Scalar/select changes do not alter the form's structure, but must still
// follow restored or canonicalized data instead of retaining render defaults.
const select = label => env.element.children.flatMap(row => row.children).find(input => input.attributes?.['aria-label'] === label);
data.hudMode = 'bonus'; data.jungleAtmosphere = true; env.sync();
assert.equal(select('collection HUD').value, 'bonus');
assert.equal(select('jungle atmosphere').value, 'on');
data = { ...data, hudMode: 'standard', jungleAtmosphere: false }; env.sync();
assert.equal(select('collection HUD').value, 'standard');
assert.equal(select('jungle atmosphere').value, 'off');
data.components = [{ t: 'worldmap', p: [0, 0, 0] }]; env.sync();
assert.ok(!env.element.children.some(e => e.textContent === 'add ocean at focus'), 'map editor must not offer an invalid second ocean');
for (const shore of [[[0, 0, 1, 0], [2, 2, 1, 0], [0, 0, 1, 0]], [[0, 0, 1, 0], [0, .5, 1, 0]]]) {
  const ocean = { geometryVersion: 2, p: [1, 2, 3], length: 20, width: 20, seaward: 1, shore };
  const before = clone(ocean);
  assert.equal(straightenOceanShoreline(ocean), false, 'closed/short shoreline has no legal straight chord');
  assert.deepEqual(ocean, before, 'failed straightening must not mutate the ocean');
}
data = { v: 1, name: 'Atmosphere controls', spawn: [0, 1, 0], killY: -30, components: [{ t: 'gate', p: [0, 0, -20] }] };
env.render();
const choose = (label, value) => { const input = select(label); assert.ok(input, label); input.value = value; input.listeners.change(); };
assert.equal(select('atmosphere settings').value, 'level defaults');
const beforeDefault = clone(data); env.sync(); assert.deepEqual(data, beforeDefault, 'inspection materialized atmosphere defaults');
choose('atmosphere settings', 'custom');
assert.ok(data.atmosphere);
const numberValues = { fogNear: 100, fogFar: 650, ambientIntensity: 1.125, sunIntensity: 2.25, fillIntensity: .75,
  shadowStrength: .4, drawDistance: 800, fallbackSunU: .321, fallbackSunV: .654 };
for (const [key, value] of Object.entries(numberValues)) {
  edit(atmosphereExports.ATMOSPHERE_NUMBERS[key].label, value);
  assert.equal(data.atmosphere[key], value, `numeric atmosphere control ${key} has no authored value`);
}
for (const [key, label] of Object.entries(atmosphereExports.ATMOSPHERE_COLORS)) {
  choose(label, '#123abc'); assert.equal(data.atmosphere[key], '#123abc', `color control ${key} has no authored value`);
}
choose('backdrop', 'fog'); assert.equal(data.atmosphere.backdrop, 'fog');
choose('scene fog', 'off'); assert.equal(data.atmosphere.fogEnabled, false);
choose('fallback stars', 'on'); assert.equal(data.atmosphere.fallbackStars, true);
choose('fallback sun', 'off'); assert.equal(data.atmosphere.fallbackSunColor, null);
assert.ok(!env.element.children.some(row => row.textContent === 'fallback sun vertical'), 'hidden sun left misleading numeric controls');
choose('fallback sun', 'on'); assert.ok(data.atmosphere.fallbackSunColor);
const rawIntensity = 1.7050000000000002;
data.atmosphere.sunIntensity = rawIntensity;
data.atmosphere.ambientSky = [.123456789012345, .456789012345678, .789012345678901];
const precise = clone(data), historyCount = history.length; env.render(); env.sync();
const intensity = env.element.children.find(row => row.textContent === 'sun intensity');
assert.equal(intensity.get(), 1.705, 'numeric atmosphere display exposes floating-point tails');
assert.deepEqual(data, precise, 'formatting mutated captured precision');
const sameColor = select('ambient sky'); sameColor.listeners.change();
assert.deepEqual(data, precise, 'opening the color picker quantized a captured linear color');
assert.equal(history.length, historyCount, 'no-op color/display inspection committed an edit');
choose('scene fog', 'on'); data = clone(history.at(-1)); env.sync();
assert.equal(select('scene fog').value, 'off', 'history restoration left a stale atmosphere selection');
choose('atmosphere settings', 'level defaults'); assert.equal(data.atmosphere, undefined);
assert.ok(!env.element.children.some(row => row.textContent === 'sun intensity'));
levelId = 'sky'; delete data.keepPlayFog; env.render();
assert.equal(select('keep authored fog').value, 'on', 'legacy Sky default is invisible in the inspector');
choose('keep authored fog', 'off'); assert.equal(data.keepPlayFog, false);
levelId = 'ordinary'; data.jungleAtmosphere = true; delete data.keepPlayFog; env.render();
assert.equal(select('keep authored fog').value, 'on', 'Jungle default is invisible in the inspector');
choose('keep authored fog', 'off'); assert.equal(data.keepPlayFog, false);
delete data.jungleAtmosphere; delete data.keepPlayFog;
data.sky = 'night'; data.components = [{t:'platform',dkind:'nightplateau',p:[0,-3,0],s:[8,6,8]},{t:'gate',p:[0,0,-20]}];
env.render();
assert.equal(select('keep authored fog').value, 'on', 'Nightworks inherited material fog is invisible in the inspector');
const nightBefore = clone(data);
choose('atmosphere settings', 'custom');
assert.equal(data.atmosphere.fogNear, 18); assert.equal(data.atmosphere.fogFar, 88);
assert.equal(data.atmosphere.ambientIntensity, .46); assert.equal(data.atmosphere.sunIntensity, .82 * .26);
assert.deepEqual(atmosphereExports.resolveDataAtmosphere(data), atmosphereExports.resolveDataAtmosphere(nightBefore),
  'enabling custom atmosphere changed inherited Nightworks appearance');
choose('keep authored fog', 'off'); assert.equal(data.keepPlayFog, false);
console.log('PASS atmosphere controls, effective defaults, bounded fields, fallback visibility, precise display and history rebinding');
console.log('PASS environment add/move/resize/rotate/remove, independent patch selection, undo/reset bindings, live choices, map ownership and safe shoreline conversion');
