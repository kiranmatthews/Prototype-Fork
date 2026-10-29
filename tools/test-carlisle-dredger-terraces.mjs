import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {relayPilot} from './carlisle-relay-pilot.mjs';
import {crossingPilot} from './carlisle-crossing-pilot.mjs';

const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,point=api.carlislePoint,rows=[];
assert.ok(!data.components.some(c=>/Dredger (bucket|wheel|side boarding)/.test(c.nm??'')));
await withSkateRuntime(async({level,player:p,CONST,TUNING,THREE})=>{
 const tuning=JSON.stringify(TUNING);p.competitionMode=false;p.endlessDeaths=true;
 for(const phase of [0,7,53]){
  level.time=phase;level.update(0);p.totalDeaths=0;
  p.respawn(level,true,false,{position:new THREE.Vector3(...point(1770,16.12)),heading:new THREE.Vector3(...point(1775,0)).sub(new THREE.Vector3(...point(1770,0)))});
  const pilot=relayPilot({player:p,level,THREE,makeInput,jumps:api.CARLISLE_RELAY_JUMPS,stops:api.CARLISLE_RELAY_STOPS,walk:api.CARLISLE_RELAY_WALK,point,startS:1770});
  const samples=[];let frame=0,maxRiseSnap=0,exit=null,completed=false;
  for(;frame<60*60;frame++){
   if(!exit&&p.grounded&&p.pos.y>point(1864,47)[1]&&pilot.events.filter(e=>e.launch).length===2)exit=crossingPilot(api.CARLISLE_RELAY_CROSSINGS.find(r=>r.name.startsWith('Dredger upper terrace')),point);
   const control=exit?.({at:p.pos.toArray(),velocity:p.walkVelocity.toArray(),side:p.axisL.toArray(),grounded:p.grounded,spring:p.trampolineAir,vy:p.vVel});
   if(control?.done){completed=true;break;}
   const before=p.pos.clone(),vy=p.vVel,input=control?makeInput(control.input):pilot.input();p.rawInput=input;
   p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   const sample={frame,position:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,vy:p.vVel,target:pilot.target?.name};
   assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),JSON.stringify(sample));
   assert.equal(p.totalDeaths,0,JSON.stringify(sample));
   assert.ok(!(vy>0&&p.grounded),'landed through a floor while rising: '+JSON.stringify(sample));
   if(p.grounded){maxRiseSnap=Math.max(maxRiseSnap,p.pos.y-before.y);assert.ok(p.pos.y-before.y<(exit ? .45 : .06),'grounded upward teleport: '+JSON.stringify(sample));}
   if(frame%30===0)samples.push(sample);
  }
  const launches=pilot.events.filter(e=>e.launch).map(e=>e.launch);
  assert.ok(completed,'terrace route did not reach its upper exit');
  assert.deepEqual(launches,['Dredger terraces · 1','Dredger terraces · 2']);
  const outgoing=p.trampolineAir&&p.vVel>15&&p.surfaceName==='Dredger discharge · 1';
  assert.ok(outgoing||(p.grounded&&p.surfaceName?.startsWith('Dredger upper terrace')),JSON.stringify({position:p.pos.toArray(),surface:p.surfaceName,grounded:p.grounded}));
  rows.push({phase,seconds:frame/60,launches,maxRiseSnap,outgoing,position:p.pos.toArray(),samples});
 }
 assert.equal(JSON.stringify(TUNING),tuning);
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
await mkdir('docs/carlisle-relay/slippery',{recursive:true});
await writeFile('docs/carlisle-relay/slippery/terrace-traversal.json',JSON.stringify({rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({samples,...row})=>row),null,2));
console.log('PASS continuous input-only terrace climb at three phases; no ascending floor catches, upward snaps, bails or deaths.');
