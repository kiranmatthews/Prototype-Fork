import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

const fixture={id:'hazard-audio-distance',name:'Hazard audio distance',data:{v:1,name:'Hazard audio distance',spawn:[0,.1,0],killY:-50,components:[
 {t:'platform',p:[0,-.5,0],s:[10,1,10]},{t:'gate',p:[0,0,-4]},
]}};
const report=[];
await withSkateRuntime(async({THREE,Level,server})=>{
 const {sfx}=await server.ssrLoadModule('/src/audio.ts');
 const originalPlay=sfx.play;let calls=[];
 sfx.play=(name,volume,rate)=>{calls.push({name,volume,rate});};
 try{
  for(const spec of [
   {kind:'crusher',component:{t:'crusher',p:[500,14,0],s:[3.2,3.6,6.4],cycle:4},range:45,peak:.4,rate:.5,
    source:l=>new THREE.Vector3(l.crushers[0].x,l.crushers[0].restY,l.crushers[0].z),
    trigger:l=>{l.time=4*.5;l.crushers[0].slammed=false;},fired:l=>l.crushers[0].slammed},
   {kind:'phasepad',component:{t:'phasepad',p:[900,7,0],s:[6,.6,6],cycle:4,amp:.5},range:40,peak:.32,rate:1.2,
    source:l=>l.phasePads[0].mesh.position.clone(),trigger:l=>{l.time=3;l.phasePads[0].on=true;},fired:l=>!l.phasePads[0].on},
   {kind:'crumble',component:{t:'crumble',p:[180,9,0],s:[4,.6,6],shake:.1},range:45,peak:.45,rate:.9,
    source:l=>l.crumbles[0].base.clone(),trigger:l=>{l.touchCrumble(0);l.crumbles[0].t=.2;},fired:l=>l.crumbles[0].state==='fall'},
   {kind:'rope',component:{t:'rope',p:[100,10,0],len:10,yaw:90,shake:.1},range:55,peak:.5,rate:1.15,
    source:l=>l.ropes[0].rest[0].clone(),trigger:l=>{l.ropes[0].active=true;l.ropes[0].state='sag';l.ropes[0].t=l.ropes[0].breakTime+.1;},fired:l=>l.ropes[0].state==='break'},
  ]){
   const entry=structuredClone(fixture);entry.id=spec.kind;entry.data.components.push(spec.component);
   const level=new Level(new THREE.Scene(),entry);
   try{
    const at=spec.source(level),samples=[];
    const fire=(dx,dy,dz)=>{
     level.reset(true);level.playerPos.copy(at).add(new THREE.Vector3(dx,dy,dz));spec.trigger(level);calls=[];
     level.update(0);assert.ok(spec.fired(level),spec.kind+' mechanism must still transition even when inaudible');
     const result=calls.map(c=>({...c}));calls=[];level.update(0);
     assert.equal(calls.length,0,spec.kind+' must not replay while resting');
     return result;
    };
    for(const distance of [0,5,20,spec.range-1,spec.range,spec.range+1,1000]){
     const axes=[[distance,0,0],[0,distance,0],[0,0,distance]];
     const results=axes.map(v=>fire(...v));assert.deepEqual(results[0],results[1],spec.kind+' vertical falloff differs');
     assert.deepEqual(results[0],results[2],spec.kind+' X/Z falloff differs');
     if(distance>=spec.range)assert.equal(results[0].length,0,spec.kind+' distant source is still audible');
     else {assert.equal(results[0].length,1);assert.ok(results[0][0].volume<=spec.peak);assert.equal(results[0][0].rate,spec.rate);}
     samples.push({distance,volume:results[0][0]?.volume??0});
    }
    for(let i=1;i<samples.length;i++)assert.ok(samples[i].volume<=samples[i-1].volume,spec.kind+' gets louder with distance');
    const diagonal=spec.range*.75;assert.equal(fire(diagonal,0,diagonal).length,0,'Use radial distance, not an axis-aligned box');
    // Rival physics can temporarily overwrite playerPos; the human listener wins.
    level.reset(true);level.raceAudioListener=at.clone().add(new THREE.Vector3(1000,0,0));level.playerPos.copy(at);spec.trigger(level);calls=[];level.update(0);assert.equal(calls.length,0);
    report.push({kind:spec.kind,axisIndependent:true,radialCutoff:true,mechanismStillTransitions:true,oneCuePerTransition:true,humanListener:true,samples});
   }finally{level.dispose();}
  }
 }finally{sfx.play=originalPlay;}
},{levelEntry:fixture});
await mkdir('docs/ancient-gates/tripo/audio-fix',{recursive:true});
await writeFile('docs/ancient-gates/tripo/audio-fix/distance-check.json',JSON.stringify({passed:true,report},null,2)+'\n');
console.log('PASS local hazard audio: X/Y/Z falloff, silence beyond range, bounded peaks, one cue per transition and unchanged mechanism transitions.');
