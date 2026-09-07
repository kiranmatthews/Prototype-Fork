import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

class Element {
  children = []; listeners = {}; value = ''; textContent = '';
  constructor(tag) { this.tagName = tag; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute() {}
  addEventListener(type, callback) { this.listeners[type] = callback; }
  blur() {}
}
const exports = {};
const code = ts.transpileModule(await readFile(new URL('../src/editorEnvironment.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function('exports', 'document', code)(exports, { createElement: tag => new Element(tag) });
const { EditorEnvironment } = exports;
let data = { v: 1, name: 'Environment regression', spawn: [0, 1, 0], killY: -30, components: [{ t: 'gate', p: [0, 0, -20] }] };
const clone = value => JSON.parse(JSON.stringify(value));
const history = [];
let last = clone(data);
let env;
const commits = () => { history.push(last); last = clone(data); env.sync(); };
env = new EditorEnvironment({
  data: () => data,
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
console.log('PASS environment add/move/resize/rotate/remove, independent patch selection, undo/reset field rebinding');
