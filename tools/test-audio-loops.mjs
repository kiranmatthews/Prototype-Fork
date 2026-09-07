import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const sources=[];
class BufferSource {
  playbackRate={value:1}; loop=false; loopStart=0; loopEnd=0;
  starts=0; stops=0;
  connect(node){this.output=node}
  start(){this.starts++}
  stop(){this.stops++}
}
globalThis.window={addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
globalThis.AudioContext=class {
  state='running'; currentTime=1; destination={};
  createGain(){return{gain:{value:1},connect(){}}}
  createBufferSource(){const node=new BufferSource();sources.push(node);return node}
  async decodeAudioData(){return{length:57932,sampleRate:44100,duration:57932/44100}}
};
globalThis.fetch=async()=>({arrayBuffer:async()=>new ArrayBuffer(0)});
const {sfx}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
await sfx.prepare();
for(const [length,sampleRate] of [[15764,12000],[57932,44100],[63056,48000],[2,48000],[1,48000]]){
  const buffer={length,sampleRate,duration:length/sampleRate};sfx.buffers.set('grindLoop',buffer);
  sfx.setLoop('grind','grindLoop',true,.55,1);
  const channel=sfx.loops.get('grind'),node=channel.src;
  assert.equal(node.buffer,buffer);assert.equal(node.loop,true);assert.equal(node.loopStart,0);
  assert.equal(node.loopEnd,(length>1?length-1:length)/sampleRate);
  assert.ok(node.loopEnd>0&&node.loopEnd<=buffer.duration);
  if(length>1)assert.ok(node.loopEnd<buffer.duration,'full-buffer end can stall on one render block');
  for(let frame=0;frame<500;frame++)sfx.setLoop('grind','grindLoop',true,.55,1);
  assert.equal(sfx.loops.get('grind').src,node,'steady grind restarted the sound');
  assert.equal(node.starts,1);assert.equal(node.playbackRate.value,1);assert.equal(channel.gain.gain.value,.55);
  sfx.setLoop('grind','grindLoop',true,.4,.3);
  assert.equal(node.playbackRate.value,.3,'rate updates accumulated instead of assigning');
  assert.equal(node.loopEnd,(length>1?length-1:length)/sampleRate,'rate update changed the source-time loop boundary');
  sfx.setLoop('grind','grindLoop',false,.55,1);
  assert.equal(node.stops,1);assert.equal(sfx.loops.has('grind'),false);
}
// All managed channels share this guard, including pitched rumble and music.
for(const [id,name,rate] of [['skate','skateLoop',1.1],['wallride','wallrideLoop',1.15],['boulder','grindLoop',.3],['uber','uberMusic',1]]){
  sfx.setLoop(id,name,true,.5,rate);
  const node=sfx.loops.get(id).src;
  assert.equal(node.playbackRate.value,rate);assert.ok(node.loopEnd>0);
  if(node.buffer.length>1)assert.ok(node.loopEnd<node.buffer.duration);
}
sfx.stopLoops();assert.equal(sfx.loops.size,0);
const count=sources.length;
sfx.play('railLand',.7,1,0);
assert.equal(sources.length,count+1);assert.equal(sources.at(-1).loop,false,'one-shot impacts must remain full-length');
assert.equal(sources.at(-1).loopEnd,0);
console.log('Validated safe decoded-sample loop boundaries, stable long grinds, rate/gain updates, stop/restart and untouched one-shots.');
