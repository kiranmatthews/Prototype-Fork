import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute production input against deterministic event/layout/lifecycle surfaces.
// Capture deliberately fails: movement and release must work through window.
let now = 1000, layoutReads = 0;
class Surface {
  listeners = new Map(); children = []; style = {}; dataset = {}; classes = new Set(); attributes = new Map();
  classList = {
    add: k => this.classes.add(k), remove: k => this.classes.delete(k), contains: k => this.classes.has(k),
    toggle: (k, on) => on ? this.classes.add(k) : this.classes.delete(k),
  };
  addEventListener(t, f) { const a = this.listeners.get(t) ?? []; a.push(f); this.listeners.set(t, a); }
  emit(t, e = {}) { for (const f of this.listeners.get(t) ?? []) f(e); }
  appendChild(e) { this.children.push(e); }
  setAttribute(k, v) { this.attributes.set(k, v); }
  setPointerCapture() { throw Error('capture unavailable'); }
  hasPointerCapture() { return false; }
  blur() {}
  getBoundingClientRect() { layoutReads++; return this.rect ?? { left: 0, top: 0, width: 100, height: 100 }; }
}
const window = new Surface(); window.location = { search: '?touch' }; window.innerWidth = 390; window.innerHeight = 844;
window.visualViewport = new Surface();
const document = new Surface(); document.body = new Surface(); document.head = new Surface(); document.hidden = false;
document.createElement = () => new Surface();
const observers = []; class MutationObserver { constructor(f) { observers.push(f); } observe() {} }
const source = await readFile(new URL('../src/touch.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
const awakeExports = {};
const awakeSource = await readFile(new URL('../src/touchScreenAwake.ts', import.meta.url), 'utf8');
new Function('exports', ts.transpileModule(awakeSource, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(awakeExports);
new Function('require', 'exports', 'window', 'document', 'MutationObserver', 'performance', output)(
  key => key === './touchScreenAwake' ? awakeExports : { sfx: { play() {} } }, exports, window, document, MutationObserver, { now: () => now },
);
const tc = new exports.TouchControls();
const left = document.body.children.find(e => e.className === 'tc-zone tc-left');
const right = document.body.children.find(e => e.className === 'tc-zone tc-right');
const look = document.body.children.find(e => e.className === 'tc-look');
for (const [i, el] of [...tc.btnEls.values()].entries()) el.rect = { left: 200 + i * 120, top: 200, width: 80, height: 80 };
const event = (id, x = 0, y = 0, extra = {}) => ({
  pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, buttons: 1,
  isPrimary: false, timeStamp: now, preventDefault() {}, ...extra,
});
const down = (zone, id, x, y, primary = false) => {
  const e = event(id, x, y, { isPrimary: primary }); window.emit('pointerdown', e); zone.emit('pointerdown', e);
};
const button = (key, id) => { const r = tc.btnEls.get(key).rect; down(right, id, r.left + 40, r.top + 40); };
const move = (id, x, y, extra) => window.emit('pointermove', event(id, x, y, extra));
const up = id => window.emit('pointerup', event(id));
const cancel = id => window.emit('pointercancel', event(id));
const reset = () => tc.releaseAll(true);
const neutral = () => {
  for (const key of ['moveX', 'moveY', 'lookX', 'lookY']) assert.equal(tc[key], 0, key + ' stuck');
  for (const key of ['jumpHeld', 'grabHeld', 'spinHeld', 'grindHeld']) assert.equal(tc[key], false, key + ' stuck');
  for (const el of [...Object.values(tc.arrowEls), ...tc.btnEls.values()]) assert.equal(el.classList.contains('on'), false);
};

for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  down(left, 1, 50, 0); button('x', 2); button('o', 3);
  window.emit(type, event(1)); assert.equal(tc.moveY, 0); assert.equal(tc.jumpHeld, true);
  window.emit(type, event(2)); assert.equal(tc.jumpHeld, false); assert.equal(tc.grabHeld, true);
  window.emit(type, event(3)); neutral(); reset();
}
down(left, 1, 50, 0); button('tri', 2);
document.emit('touchend', { touches: [{ identifier: 999 }] }); assert.equal(tc.moveY, 1); assert.equal(tc.grindHeld, true);
document.emit('touchend', { touches: [] }); neutral(); assert.equal(tc.consumeButtonPress('tri'), true);
reset();

// Native partial lifts recover missing pointer releases without comparing IDs.
down(left, 101, 50, 0); button('x', 202);
const a = {identifier:7,clientX:50,clientY:0}, b = {identifier:8,clientX:480,clientY:240};
document.emit('touchstart', {touches:[a,b],changedTouches:[a,b]});
document.emit('touchend', {touches:[a],changedTouches:[b]});
assert.equal(tc.jumpHeld,false); assert.equal(tc.moveY,1); assert.equal(tc.consumeButtonPress('x'),true);
assert.equal(tc.consumeJumpRelease(),true);
document.emit('touchcancel', {touches:[],changedTouches:[a]}); neutral(); reset();
// Also tolerate native start preceding pointerdown, and ambiguous locations.
document.emit('touchstart', {touches:[a],changedTouches:[a]}); down(left, 101, 50, 0);
document.emit('touchend', {touches:[b],changedTouches:[a]}); assert.equal(tc.moveY,0); reset();
button('x', 201); button('x', 202);
document.emit('touchstart', {touches:[b],changedTouches:[b]});
document.emit('touchcancel', {touches:[a],changedTouches:[b]}); assert.equal(tc.jumpHeld,true,'ambiguous native contact guessed a pointer');
document.emit('touchend', {touches:[],changedTouches:[]}); neutral(); reset();

// Completed taps, reused browser IDs and multiple owners of one button.
button('x', 2); up(2); window.emit('lostpointercapture', event(2));
assert.equal(tc.consumeButtonPress('x'), true); assert.equal(tc.consumeJumpRelease(), true);
assert.equal(tc.consumeButtonPress('x'), false); assert.equal(tc.consumeJumpRelease(), false);
button('x', 2); cancel(2); assert.equal(tc.consumeButtonPress('x'), false); assert.equal(tc.consumeJumpRelease(), false);
button('x', 2); up(2); button('x', 2); cancel(2);
assert.equal(tc.consumeButtonPress('x'), true, 'reused ID cancellation erases a completed tap');
assert.equal(tc.consumeJumpRelease(), true);
button('x', 2); button('x', 3); cancel(2);
assert.equal(tc.jumpHeld, true); assert.equal(tc.consumeButtonPress('x'), true, 'shared button loses its valid owner');
up(3); assert.equal(tc.consumeJumpRelease(), true);
button('x', 2); move(2, 360, 240); assert.equal(tc.grabHeld, true); assert.equal(tc.jumpHeld, false);
cancel(2); assert.equal(tc.consumeButtonPress('x'), false); assert.equal(tc.consumeJumpRelease(), false);
assert.equal(tc.consumeButtonPress('o'), false); reset();
button('x',2); button('tri',3); button('o',2);
assert.equal(tc.jumpHeld,false); assert.equal(tc.grabHeld,true); assert.equal(tc.grindHeld,true);
assert.equal(tc.consumeButtonPress('x'),false,'fresh contact inherits stale ownership');
assert.equal(tc.consumeButtonPress('o'),true); up(2); up(3); reset();

// All sectors and wrap boundaries, radial/angular hysteresis, off-zone moves.
down(left, 1, 50, 50);
for (const [dx, dy, x, y] of [[40,0,1,0],[40,-40,1,1],[0,-40,0,1],[-40,-40,-1,1],[-40,0,-1,0],[-40,40,-1,-1],[0,40,0,-1],[40,40,1,-1],[40,0,1,0]]) {
  move(1, 50 + dx, 50 + dy); assert.deepEqual([tc.moveX, tc.moveY], [x, y]);
}
move(1, 50, 50); move(1, 65, 50); assert.equal(tc.moveX, 0);
move(1, 67, 50); move(1, 61, 50); assert.equal(tc.moveX, 1);
move(1, 59, 50); assert.equal(tc.moveX, 0);
move(1, 90, 50); move(1, 86, 34); assert.equal(tc.moveY, 0, 'boundary jitter changes sector');
move(1, 80, 20); assert.equal(tc.moveY, 1);
move(1, 1000, 50); assert.deepEqual([tc.moveX, tc.moveY], [1, 0], 'capture failure loses off-zone steering');
const readsBefore = layoutReads;
for (let i = 0; i < 2000; i++) move(1, 90, 50);
assert.equal(layoutReads, readsBefore, 'pointer movement forces layout reads');
now += 60000; assert.equal(tc.moveX, 1, 'long intentional holds time out');
up(1); neutral(); move(1, 90, 50); neutral(); reset();

button('o', 2); move(2, 240, 240); assert.equal(tc.grindHeld, true, 'off-zone button slide fails');
const buttonReads = layoutReads;
for (let i = 0; i < 2000; i++) move(2, 243, 243);
assert.equal(layoutReads, buttonReads); up(2); neutral(); reset();

down(look, 4, 100, 100); move(4, 155, 45);
assert.deepEqual([tc.lookX, tc.lookY], [.5, .5]); move(4, 999, -999); assert.deepEqual([tc.lookX, tc.lookY], [1, 1]);
up(4); neutral(); assert.equal(tc.lookCue.classList.contains('on'), false);

// Direct triggers support real holds, fast taps and independent cancellation.
const transfer = tc.triggerEls.get('transfer'), inventory = tc.triggerEls.get('inventory');
down(transfer, 10, 100, 100); right.emit('pointerdown', event(10, 100, 100));
assert.equal(tc.rightTouches.size, 0, 'trigger bubbles into a face button');
assert.equal(tc.transferActive(), true); now += 60000; assert.equal(tc.transferActive(), true);
up(10); assert.equal(tc.transferActive(), false); assert.equal(tc.consumeTransferPress(), true);
down(transfer, 10, 100, 100); cancel(10); assert.equal(tc.consumeTransferPress(), false);
down(inventory, 11, 100, 100); up(11); assert.equal(tc.inventoryActive(), true, 'short inventory tap is invisible');
now += 1000; tc.syncAvailability(); assert.equal(tc.inventoryActive(), true, 'frame stall loses unread inventory tap');
tc.beginFrame(); now += 451; tc.syncAvailability(); assert.equal(tc.inventoryActive(), false);

// Button-started/acquired gestures never become triggers. A flick can finish
// on pointerup if the browser supplied no intermediate move sample.
button('o', 2); now += 50; move(2, 360, 80); assert.equal(tc.transferActive(), false); up(2); reset();
down(right, 2, 100, 500); now += 30; move(2, 360, 240); now += 30; move(2, 360, 100);
assert.equal(tc.transferActive(), false); cancel(2); reset();
down(right, 2, 800, 500); now += 100; window.emit('pointerup', event(2, 800, 400));
assert.equal(tc.transferActive(), true); assert.equal(tc.consumeTransferPress(), true);
down(right, 3, 800, 500); now += 100; move(3, 800, 400); cancel(3);
assert.equal(tc.transferActive(), true, 'cancelled swipe clears another completed swipe');
now += 1000; assert.equal(tc.transferActive(), true, 'frame stall expires unread transfer');
tc.beginFrame(); now += 451; tc.syncAvailability(); assert.equal(tc.transferActive(), false); reset();

for (const type of ['blur', 'pagehide', 'pageshow', 'orientationchange', 'visibilitychange', 'touchcancel']) {
  down(left, 1, 50, 0); button('sq', 2); down(transfer, 10, 100, 100); down(look, 4, 100, 100);
  if (type === 'visibilitychange') { document.hidden = true; document.emit(type); document.hidden = false; }
  else if (type === 'touchcancel') document.emit(type, { touches: [] }); else window.emit(type);
  neutral(); assert.equal(tc.consumeButtonPress('sq'), false); assert.equal(tc.transferActive(), false);
  move(1, 50, 0); move(2, 240, 240); neutral();
}
const graphicsCanvas={closest:()=>true};
down(left,1,50,0); button('x',2); document.emit('webglcontextlost',{target:graphicsCanvas}); neutral();
down(left,1,50,0); button('x',2); neutral();
document.emit('webglcontextrestored',{target:graphicsCanvas});
move(1,50,0); move(2,480,240); neutral();
button('x',2); assert.equal(tc.jumpHeld,true); up(2); reset();
for (const name of ['game-shell-modal', 'game-shell-transitioning', 'game-startup-loading', 'ed-active', 'tool-panel-open', 'character-lab-open', 'animation-studio-open', 'game-field-studio-open', 'world-map-active']) {
  down(left, 1, 50, 0); button('o', 2); document.body.classList.add(name); tc.syncAvailability(); neutral();
  down(left, 3, 50, 0); button('x', 4); neutral(); assert.equal(tc.consumeButtonPress('o'), false);
  document.body.classList.remove(name); observers.forEach(f => f());
}
down(left, 1, 50, 0); button('o', 2); document.body.classList.add('side-panel-left-open'); observers.forEach(f => f());
assert.equal(tc.moveY, 0); assert.equal(tc.grabHeld, true); document.body.classList.remove('side-panel-left-open'); reset();
down(left, 1, 50, 0); button('o', 2); document.body.classList.add('side-panel-right-open'); observers.forEach(f => f());
assert.equal(tc.moveY, 1); assert.equal(tc.grabHeld, false); document.body.classList.remove('side-panel-right-open'); reset();
button('x', 2); up(2); document.body.classList.add('side-panel-right-open'); tc.syncAvailability();
assert.equal(tc.consumeButtonPress('x'), false); assert.equal(tc.consumeJumpRelease(), false);
document.body.classList.remove('side-panel-right-open'); reset();
down(left, 1, 50, 0); window.emit('resize'); assert.equal(tc.moveY, 1, 'identical resize cancels a held finger');
window.innerWidth = 844; window.innerHeight = 390; window.emit('resize'); neutral();
down(left, 1, 50, 0); button('o', 2); tc.setMapMode(true); neutral(); tc.setMapMode(false);
down(left, 1, 50, 0); button('tri', 2); down(left, 10, 0, 50, true);
assert.equal(tc.moveX, -1); assert.equal(tc.grindHeld, false); up(10); neutral(); reset();
left.emit('pointerdown', event(1, 50, 0, { button: 2, pointerType: 'mouse' })); neutral();
left.emit('pointerdown', event(1, NaN, 0)); neutral();
down(left, 1, 50, 0); move(1, 50, 0, { pointerType: 'mouse', buttons: 0 }); neutral();
const pen=event(1,50,0,{pointerType:'pen'});window.emit('pointerdown',pen);left.emit('pointerdown',pen);
move(1,50,0,{pointerType:'pen',buttons:0});neutral();
window.location.search = '?notouch'; assert.equal(exports.touchControlsRequested(), false);

// Execute the real merged Input with the controls, proving a short Jump has
// both edges and that its release cannot pop a still-held keyboard/gamepad X.
const compile = path => readFile(new URL('../' + path, import.meta.url), 'utf8').then(s => ts.transpileModule(s, {
  compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
}).outputText);
const bindings = {}; new Function('exports',await compile('src/inputBindings.ts'))(bindings);
const inputExports = {};
let gamepads = [];
const imports = {
  './touch':exports, './inputBindings':bindings,
  './cameraLook':{shapeLookStick:()=>({x:0,y:0})}, './inputPrompts':{inputPrompts:{update(){}}},
};
new Function('require','exports','window','document','navigator',await compile('src/input.ts'))(
  key=>imports[key],inputExports,window,document,{getGamepads:()=>gamepads},
);
window.location.search='?touch';
const input = new inputExports.Input(), it = input.touch;
for(const [i,el] of [...it.btnEls.values()].entries()) el.rect={left:200+i*120,top:200,width:80,height:80};
const iz = document.body.children.filter(e=>e.className==='tc-zone tc-right').at(-1);
const tap = (key,id=999) => {
  const r=it.btnEls.get(key).rect; iz.emit('pointerdown',event(id,r.left+40,r.top+40)); up(id);
};
tap('x'); input.update(); assert.equal(input.jumpPressed,true); assert.equal(input.jumpReleased,true); assert.equal(input.jumpHeld,false);
input.consumeEdges(); input.update(); assert.equal(input.jumpPressed,false); assert.equal(input.jumpReleased,false);
window.emit('keydown',{code:'Space',repeat:false,preventDefault(){}}); input.update(); input.consumeEdges();
tap('x'); input.update(); assert.equal(input.jumpHeld,true); assert.equal(input.jumpReleased,false,'touch lift releases a held keyboard jump');
input.consumeEdges(); window.emit('keyup',{code:'Space'}); input.update(); assert.equal(input.jumpReleased,true); input.consumeEdges();
window.emit('keydown',{code:'Space',repeat:false,preventDefault(){}}); input.update(); input.consumeEdges();
const xr=it.btnEls.get('x').rect; iz.emit('pointerdown',event(998,xr.left+40,xr.top+40)); input.update(); input.consumeEdges();
window.emit('keyup',{code:'Space'}); input.update(); assert.equal(input.jumpHeld,true); assert.equal(input.jumpReleased,false,'keyboard lift releases a held touch jump');
up(998); input.update(); assert.equal(input.jumpReleased,true); input.consumeEdges();
gamepads=[{index:0,id:'Standard pad',connected:true,axes:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0}))}];
input.update(); input.consumeEdges(); tap('x'); input.update(); assert.equal(input.jumpHeld,true); assert.equal(input.jumpReleased,false);
gamepads[0].buttons[0].pressed=false; input.update(); assert.equal(input.jumpReleased,true); input.consumeEdges();
input.armMenuReleaseGuard(); tap('x'); input.update(); assert.equal(input.jumpPressed,false); assert.equal(input.jumpReleased,false);
input.update(); assert.equal(input.jumpPressed,false,'menu guard leaks a consumed touch tap');
const tr=it.triggerEls.get('transfer'); down(tr,999,100,100); up(999); input.update();
assert.equal(input.transferPressed,true); assert.equal(input.transferHeld,false); input.consumeEdges(); input.update(); assert.equal(input.transferPressed,false);
const p2=new inputExports.Input(true); assert.equal(p2.touch,null,'touch overlay duplicated for player two');
window.emit('keydown',{code:'Space',repeat:false,target:{tagName:'INPUT'},preventDefault(){}});
window.emit('keyup',{code:'Space'}); input.update(); assert.equal(input.jumpReleased,false,'typing in a field emits a gameplay Jump release');

// A consumed charge must abort when its last contact is cancelled. UI drains
// retain that abort until a fixed step consumes it; normal lifts still pop.
iz.emit('pointerdown',event(997,xr.left+40,xr.top+40)); input.update(); input.consumeEdges();
cancel(997); input.update(); assert.equal(input.jumpCancelled,true); assert.equal(input.jumpReleased,false); assert.equal(input.jumpPressed,false);
input.consumeEdges(true); assert.equal(input.jumpCancelled,true,'UI drain loses an unconsumed jump abort');
input.armMenuReleaseGuard(); input.update(); assert.equal(input.jumpCancelled,true); input.consumeEdges();
assert.equal(input.jumpCancelled,false);
iz.emit('pointerdown',event(997,xr.left+40,xr.top+40)); input.update(); input.consumeEdges();
window.emit('keydown',{code:'Space',repeat:false,preventDefault(){}}); input.update(); input.consumeEdges();
cancel(997); input.update(); assert.equal(input.jumpHeld,true); assert.equal(input.jumpCancelled,false,'touch cancellation aborts another held source');
window.emit('keyup',{code:'Space'}); input.update(); assert.equal(input.jumpReleased,true); input.consumeEdges();
iz.emit('pointerdown',event(997,xr.left+40,xr.top+40)); input.update(); input.consumeEdges();
cancel(997); tap('x',996); input.update();
assert.equal(input.jumpCancelled,true); assert.equal(input.jumpPressed,true); assert.equal(input.jumpReleased,true,'cancelled charge erases an independently completed tap');
input.consumeEdges();

console.log('PASS touch ownership, short/completed taps, ID reuse, concurrent cancellation, 8-way hysteresis, 4,000 layout-free moves, capture/native fallback, long holds, triggers, lifecycle/mode/viewport recovery and merged keyboard/gamepad/fixed-step edges');
