import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/audio.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const sources=[],tones=[];let decoding=0,peakDecoding=0;
class BufferSource {
  playbackRate={value:1}; loop=false; loopStart=0; loopEnd=0;
  starts=0; stops=0;
  connect(node){this.output=node}
  disconnect(){this.disconnected=true}
  start(){this.starts++}
  stop(){this.stops++}
}
const listeners=new Map();globalThis.window={addEventListener(type,fn){const list=listeners.get(type)??[];list.push(fn);listeners.set(type,list);}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
globalThis.AudioContext=class {
  state='running'; currentTime=1; destination={};
  async suspend(){this.state='suspended'}
  async resume(){this.state='running'}
  createGain(){return{gain:{value:1,setValueAtTime(v){this.value=v},linearRampToValueAtTime(v){this.value=v},exponentialRampToValueAtTime(v){this.value=v}},connect(node){this.output=node},disconnect(){this.disconnected=true}}}
  createOscillator(){const tone={frequency:{setValueAtTime(v){this.value=v}},connect(node){this.output=node},start(at){this.started=at},stop(at){this.stopped=at},disconnect(){this.disconnected=true}};tones.push(tone);return tone}
  createBufferSource(){const node=new BufferSource();sources.push(node);return node}
  async decodeAudioData(){peakDecoding=Math.max(peakDecoding,++decoding);await Promise.resolve();decoding--;return{length:57932,sampleRate:44100,duration:57932/44100}}
};
globalThis.fetch=async()=>({arrayBuffer:async()=>new ArrayBuffer(0)});
const {sfx}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
await sfx.prepare();
assert.ok(peakDecoding<=2,'startup audio decoder concurrency is bounded');
sfx.countdownBeep();
assert.equal(tones[0].type,'sine');assert.equal(tones[0].frequency.value,880);
assert.ok(Math.abs(tones[0].stopped-tones[0].started-.15)<1e-9);
sfx.setMuted({sfxMuted:true,musicMuted:false});sfx.countdownBeep();
assert.equal(tones[1].output.output.gain.value,0,'clock cue bypassed SFX mute');
tones[0].onended();assert.equal(tones[0].disconnected,true);assert.equal(tones[0].output.disconnected,true);
sfx.setMuted({sfxMuted:false,musicMuted:false});
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
  assert.equal(node.disconnected,true);assert.equal(channel.gain.disconnected,true,'stopped loop gain must leave the audio graph');
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
sources.at(-1).onended();assert.equal(sources.at(-1).disconnected,true);assert.equal(sources.at(-1).output.disconnected,true,'completed one-shot gain must leave the graph');
let requests=0;
globalThis.fetch=async(_url,{signal})=>{requests++;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});};
const interrupted=new sfx.constructor();await Promise.resolve();assert.equal(requests,2);
for(const listener of listeners.get('pagehide'))listener({persisted:false});await interrupted.prepare();
assert.equal(requests,2,'leaving the game cancels queued fetches before a detached document can start them');assert.equal(interrupted.buffers.size,0);
globalThis.fetch=async()=>({arrayBuffer:async()=>new ArrayBuffer(0)});
for(const listener of listeners.get('pageshow'))listener({persisted:true});await interrupted.prepare();assert.ok(interrupted.buffers.size>30,'back-forward restoration resumes missing sounds');
interrupted.ctx.suspend=()=>new Promise(()=>{});
assert.equal(await Promise.race([interrupted.prepareToLeave().then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),100))]),true,'gesture-blocked Safari audio suspension must not block navigation');
console.log('Validated safe decoded-sample loop boundaries, stable long grinds, rate/gain updates, stop/restart and untouched one-shots.');
