import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the production sampler/cache against a deterministic DOM. Canvas is
// counted separately, so a cache hit cannot pass merely by drawing less ink.
const style = () => ({ display: 'block', visibility: 'visible', opacity: '1', backgroundColor: '#123456', borderTopWidth: '1px', borderTopColor: '#fff', borderTopLeftRadius: '3px', borderTopRightRadius: '3px', borderBottomRightRadius: '3px', borderBottomLeftRadius: '3px', fontWeight: '700', fontSize: '20px', fontFamily: 'sans-serif', textAlign: 'left', justifyContent: 'start', paddingLeft: '2px', paddingRight: '2px', letterSpacing: 'normal', color: '#fff', webkitTextStrokeWidth: '0px', webkitTextStrokeColor: '#000', textOverflow: 'ellipsis' });
class Element {
  constructor(className = '', parent = null) {
    this.className = className; this.parentElement = parent; this.tagName = 'SPAN'; this.textContent = ''; this.hidden = false; this.dataset = {};
    this.rect = { x: 10, y: 20, width: 100, height: 30 }; this.style = style(); this.hover = false; this.focus = false;
    this.classList = { toggle() {}, contains: name => this.className.split(' ').includes(name) };
  }
  getBoundingClientRect() { return { ...this.rect }; }
  matches(selector) {
    if (selector === ':hover') return this.hover;
    if (selector === ':focus-visible') return this.focus;
    if (selector === '.game-hud-layer.precrt-composited') return this.className === 'game-hud-layer precrt-composited';
    return false;
  }
  closest(selector) { return selector === '.competition-host' && this.excluded ? this : null; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
}
const body = new Element(), root = new Element('world-map-ui', body), prompt = new Element('input-glyph', root), word = new Element('', root);
prompt.dataset.inputAction = 'jump'; word.textContent = ' Jump ';
let visible = true, paintNodes = [root], glyphNodes = [prompt], wordNodes = [word], fontRevision;
const eventHandlers = new Map();
const fonts = { addEventListener(type, listener) { eventHandlers.set(type, listener); } };
const document = {
  body, fonts, head: { appendChild() {} }, createElement: () => new Element(), querySelector: () => null,
  querySelectorAll(selector) {
    if (selector === '.input-glyph') return glyphNodes;
    if (selector === '[data-prompt-word]') return wordNodes;
    if (selector.includes('.world-map-level-card')) return paintNodes;
    if (selector.includes('.world-map-ui')) return visible ? [root] : [];
    return [];
  },
};
const images = [];
class Image {
  constructor() { this.complete = false; this.naturalWidth = 0; images.push(this); }
  addEventListener() {}
}
const inputPrompts = { family: 'keyboard', resolve: () => ({ url: 'jump.png', label: 'SPACE' }), subscribe() {} };
let paints = 0, composites = 0, cssReads = 0;
class GameHudSurface {
  draw(_size, frame) { paints++; frame.drawExtra(canvas, _size); return true; }
  composite() { composites++; return true; }
}
const calls = [];
const canvas = new Proxy({}, { get(target, key) { return target[key] ?? ((...args) => calls.push([key, ...args])); }, set(target, key, value) { target[key] = value; return true; } });
const context = vm.createContext({ document, window: { innerWidth: 800, innerHeight: 600 }, HTMLElement: Element, Image, Map, Event: class {}, inputPrompts, INPUT_BINDINGS: { jump: {} }, trackPresentationImage() {}, getComputedStyle(element) { cssReads++; return element.style; }, GameHudSurface, paintSilverSecondaryText() {}, secondaryTextSettings: { subscribe(listener) { fontRevision = listener; } } });
for (const path of ['src/inputPromptUI.ts', 'src/gameInterfaceSurface.ts']) {
  const source = (await readFile(new URL(`../${path}`, import.meta.url), 'utf8')).replace(/^import .*$/gm, '').replace(/^export /gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
  vm.runInContext(js, context, { filename: path });
}
const surface = vm.runInContext('new GameInterfaceSurface()', context);
const rendererEvents = new Map();
const renderer = { getPixelRatio: () => 2, domElement: { addEventListener(type, handler) { rendererEvents.set(type, handler); }, removeEventListener() {} } };
const size = { width: 800, height: 600 }, target = {};
const draw = () => surface.draw(renderer, size, target);
const expectRepaint = mutate => { const before = paints; mutate(); draw(); assert.equal(paints, before + 1); draw(); assert.equal(paints, before + 1, 'unchanged ink must reuse the uploaded texture'); };
draw(); draw(); assert.equal(paints, 1); assert.equal(composites, 2);
expectRepaint(() => { root.rect.x += .125; });
expectRepaint(() => { root.style.opacity = '.51'; });
expectRepaint(() => { root.style.opacity = '.52'; }); // Intermediate fade frames cannot freeze.
expectRepaint(() => { root.style.color = '#ffff00'; });
expectRepaint(() => { root.style.textOverflow = 'clip'; });
expectRepaint(() => { root.textContent = 'New map selection'; });
expectRepaint(() => { root.hover = true; });
expectRepaint(() => { root.focus = true; });
expectRepaint(() => { root.className = 'world-map-ui is-moving'; });
expectRepaint(() => { root.rect.width += 1; });
expectRepaint(() => { context.window.innerWidth += 1; });
expectRepaint(() => { size.width += 1; });
expectRepaint(() => { images[0].complete = true; images[0].naturalWidth = 64; });
expectRepaint(() => { eventHandlers.get('loadingdone')(); });
expectRepaint(() => { eventHandlers.get('loadingerror')(); });
expectRepaint(() => { fontRevision(); });
expectRepaint(() => { rendererEvents.get('webglcontextrestored')(); });
expectRepaint(() => { surface.setComposited(true); });
expectRepaint(() => { word.textContent = 'Confirm'; });
expectRepaint(() => { word.style.fontFamily = 'Roo'; });
expectRepaint(() => { prompt.rect.y += .125; });
expectRepaint(() => { body.style.opacity = '.6'; });
expectRepaint(() => { prompt.excluded = true; });
const beforeExcludedRemoval = paints; glyphNodes = []; draw(); assert.equal(paints, beforeExcludedRemoval, 'excluded prompt removal changes no paint inputs');
expectRepaint(() => { wordNodes = []; });
const beforeHidden = paints;
visible = false; draw(); assert.equal(paints, beforeHidden);
visible = true; draw(); assert.equal(paints, beforeHidden + 1, 'revealed ink must not reuse a frame from before it was hidden');
const beforeDirect = paints;
surface.draw(renderer, size, null); assert.equal(paints, beforeDirect + 1, 'direct Retina raster must invalidate 1x offscreen ink');
surface.draw(renderer, size, null); assert.equal(paints, beforeDirect + 1);

// Prompt snapshots are immutable paint evidence even if the DOM changes before
// painting. Shared ancestry is read once for all glyphs/words in one sample.
glyphNodes = [prompt]; wordNodes = [word]; prompt.excluded = false; body.style.opacity = '1'; root.style.opacity = '1';
cssReads = 0;
const frame = vm.runInContext('sampleInputPrompts(document)', context);
assert.equal(cssReads, 5, 'one read per glyph, word and ancestor plus word text style');
const oldWord = frame.words[0].text, oldX = frame.glyphs[0].rect.x;
word.textContent = 'Changed later'; prompt.rect.x += 100;
context.frame = frame;
const readsBeforePaint = cssReads;
vm.runInContext('paintInputPrompts(globalCanvas, document, undefined, frame)', Object.assign(context, { globalCanvas: canvas }));
assert.equal(cssReads, readsBeforePaint, 'painting a snapshot must not reread DOM');
assert.equal(frame.words[0].text, oldWord); assert.equal(frame.glyphs[0].rect.x, oldX);
assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === oldWord));
console.log('PASS exact interface texture reuse, CSS/focus/content/asset/font/viewport/DPR/context invalidation, hidden reveal, prompt snapshot parity and shared ancestor reads');
