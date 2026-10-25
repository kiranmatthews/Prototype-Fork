import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const bundle=await build({entryPoints:['src/stormSquall.ts'],bundle:true,format:'esm',write:false});
const {StormSquall,sampleStormSquall}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let now=0;const events=[],stopped=[],owner={},other={};
const storm=new StormSquall((gain,rate)=>{const at=now;events.push({at,gain,rate});return ()=>stopped.push(at);});
const glows=[];
for(let i=0;i<240*60;i++){now=i/60;const sample=storm.update(owner,now,.86);assert.ok(sample.glow>=0&&sample.glow<=.86);if(sample.glow>0)glows.push(now);}
assert.ok(events.length>=5&&events.length<=6,'A four-minute storm should have sparse distant rolls');
for(let i=0;i<events.length;i++){
 const e=events[i];assert.ok(e.gain>0&&e.gain<.4&&e.rate>.9&&e.rate<1.05);
 if(i)assert.ok(e.at-events[i-1].at>35,'Thunder must not become a repeating barrage');
 const preceding=glows.filter(t=>t<e.at).at(-1);assert.ok(e.at-preceding>1.4&&e.at-preceding<3.3,'Sound arrives after its cloud glow');
}
storm.stop();assert.equal(stopped.length,events.length);
const cue=sampleStormSquall(0,.86).thunderAt;
const count=events.length;now=cue-.03;storm.update(other,now,.86);now=cue+.01;storm.update(other,now,.86);assert.equal(events.length,count+1);
storm.update(other,now,0);assert.equal(stopped.length,events.length);assert.equal(storm.diagnostics.glow,0);
for(let i=0;i<100;i++)storm.update(other,now,.86);assert.equal(events.length,count+1,'No duplicate cue on repeated frames or resume');
storm.update(owner,cue-1,.86);storm.update(owner,cue+1,0);storm.update(owner,cue+1.02,.86);assert.equal(events.length,count+1,'A cue crossed while paused must stay skipped');
storm.update(other,0,.86);storm.update(other,239,.86);assert.equal(events.length,count+1,'Seek must not replay past storms');
storm.update(other,NaN,.86);assert.equal(storm.diagnostics.time,0);assert.equal(storm.diagnostics.glow,0);
assert.equal(storm.update(other,1,Infinity).glow,0);
const wav=await readFile('public/sfx/weather/rooftop-thunder.wav');assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),44100);assert.equal(wav.readUInt16LE(34),16);
const pcm=wav.subarray(44);let max=0,sum=0,squares=0;
for(let i=0;i<pcm.length;i+=2){const s=pcm.readInt16LE(i)/32768;max=Math.max(max,Math.abs(s));sum+=s;squares+=s*s;}
assert.equal(pcm.readInt16LE(0),0);assert.equal(pcm.readInt16LE(pcm.length-2),0);assert.ok(max<=.65);assert.ok(Math.abs(sum/(pcm.length/2))<.001);
const out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/storm-squall';await mkdir(out,{recursive:true});
await writeFile(out+'/timing.json',JSON.stringify({events,glowFrames:glows.length,finiteVolume:true,pauseAndOwnerTeardown:true,noCatchupOrAutoplayQueue:true,wav:{bytes:wav.length,duration:pcm.length/2/44100,peak:max,rms:Math.sqrt(squares/(pcm.length/2))}},null,2)+'\n');
console.log('PASS sparse light/sound timing, delayed cues, pause/owner/seek cancellation and finite original thunder waveform');
