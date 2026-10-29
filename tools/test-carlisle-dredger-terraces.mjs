import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {relayPilot} from './carlisle-relay-pilot.mjs';

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
  const samples=[];let frame=0,maxRiseSnap=0;
  for(;frame<60*60;frame++){
   const before=p.pos.clone(),vy=p.vVel,input=pilot.input();p.rawInput=input;
   p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   const sample={frame,position:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,vy:p.vVel,target:pilot.target?.name};
   assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),JSON.stringify(sample));
   assert.equal(p.totalDeaths,0,JSON.stringify(sample));
   assert.ok(!(vy>0&&p.grounded),'landed through a floor while rising: '+JSON.stringify(sample));
   if(p.grounded){maxRiseSnap=Math.max(maxRiseSnap,p.pos.y-before.y);assert.ok(p.pos.y-before.y<.06,'grounded upward teleport: '+JSON.stringify(sample));}
   if(frame%30===0)samples.push(sample);
   if(pilot.target?.s>1900)break;
  }
  const launches=pilot.events.filter(e=>e.launch).map(e=>e.launch);
  assert.ok(frame<60*60,'terrace route did not reach its upper exit');
  assert.deepEqual(launches,['Dredger terraces · 1','Dredger terraces · 2']);
  assert.equal(p.grounded,true);assert.ok(Math.abs(p.pos.y-48)<.05);
  rows.push({phase,seconds:frame/60,launches,maxRiseSnap,position:p.pos.toArray(),samples});
 }
 assert.equal(JSON.stringify(TUNING),tuning);
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
await mkdir('docs/carlisle-relay/terraces',{recursive:true});
await writeFile('docs/carlisle-relay/terraces/native-traversal.json',JSON.stringify({rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({samples,...row})=>row),null,2));
console.log('PASS continuous input-only terrace climb at three phases; no ascending floor catches, upward snaps, bails or deaths.');
