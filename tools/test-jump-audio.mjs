import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020}}).outputText
  .replaceAll('import.meta.url', JSON.stringify(new URL('../src/audio.ts', import.meta.url).href))
  .replaceAll('import.meta.env', '({DEV:true,VITE_JAK_REFERENCE_AUDIO:false})');
const nodes = [], fetched = [];
const manifest = {jump: ['jump-1.wav', 'jump-2.wav', 'jump-3.wav'],
  doubleJump: ['jump-double-1.wav', 'jump-double-2.wav', 'jump-double-3.wav']};
let failedFile = '';
globalThis.window = {addEventListener() {}};
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {}});
globalThis.AudioContext = class {
  state = 'running'; currentTime = 1; destination = {};
  createGain() {return {gain: {value: 1}, connect() {}, disconnect() {}};}
  createBufferSource() {
    const node = {playbackRate: {value: 1}, connect() {}, disconnect() {}, start() {this.started = true;}, stop() {}};
    nodes.push(node); return node;
  }
  async decodeAudioData(bytes) {return {bytes, duration: .3};}
};
globalThis.fetch = async url => {
  fetched.push(String(url));
  return {ok: !String(url).endsWith(failedFile || '\0'), json: async () => manifest,
    arrayBuffer: async () => new ArrayBuffer(8)};
};
const {sfx} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
await sfx.prepare();
sfx.playJump();
assert.equal(nodes.at(-1).buffer, sfx.buffers.get('footstep2'));
assert.ok(nodes.at(-1).playbackRate.value >= 1.44 && nodes.at(-1).playbackRate.value <= 1.56);
sfx.ctx.currentTime += .1; sfx.playJump(true);
assert.ok(nodes.at(-1).playbackRate.value >= 1.728 && nodes.at(-1).playbackRate.value <= 1.872);
assert.ok(!fetched.some(url => url.includes('__jak-reference')), 'local audio requested without the dev opt-in');

failedFile = 'jump-double-2.wav'; await sfx.loadLocalJumpReferences();
assert.equal(sfx.jumpAudioSource, 'Project sounds');
assert.equal(sfx.jumpReferences, null, 'partial bank replaced the reliable fallback');
failedFile = ''; await sfx.loadLocalJumpReferences();
assert.equal(sfx.jumpAudioSource, 'Jak placeholders · local');
for (const second of [false, true]) {
  let previous;
  for (let i = 0; i < 12; i++) {
    sfx.ctx.currentTime += .1; sfx.playJump(second);
    const node = nodes.at(-1), key = second ? 'doubleJump' : 'jump';
    assert.ok(node.started && sfx.jumpReferences[key].some(name => sfx.buffers.get(name) === node.buffer));
    assert.notEqual(node.buffer, previous, 'source variation repeated immediately');
    assert.equal(node.playbackRate.value, 1, 'source pitch was randomized twice');
    previous = node.buffer;
  }
}
assert.deepEqual(sfx.jumpAudioPlays, {jump: 13, doubleJump: 13});

const productionCode = code.replaceAll('({DEV:true,VITE_JAK_REFERENCE_AUDIO:false})', '({DEV:false,VITE_JAK_REFERENCE_AUDIO:false})');
const {sfx: production} = await import(`data:text/javascript;base64,${Buffer.from(productionCode).toString('base64')}`);
await production.prepare();
const beforeOptIn = fetched.length;
await production.loadLocalJumpReferences();
assert.equal(fetched.length, beforeOptIn, 'production requested the private development endpoint');
assert.equal(production.jumpAudioSource, 'Project sounds');
await Promise.all([
  production.loadJumpReferenceAudio('./motion-study/jak/audio/'),
  production.loadJumpReferenceAudio('./motion-study/jak/audio/'),
]);
assert.equal(production.jumpAudioSource, 'Jak placeholders');
assert.equal(fetched.length - beforeOptIn, 7, 'concurrent playtest opt-ins duplicated the bank load');
assert.ok(fetched.slice(beforeOptIn).every(url => url.startsWith('./motion-study/jak/audio/')));
production.playJump(true);
assert.ok(production.jumpReferences.doubleJump.some(name => production.buffers.get(name) === nodes.at(-1).buffer));
console.log('PASS semantic launch cues, original fallback, atomic local and published opt-in banks, non-repeating variants, source pitch and shared loading.');
