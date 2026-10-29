import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {crossingPilot} from './carlisle-crossing-pilot.mjs';
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,runs=api.CARLISLE_RELAY_CROSSINGS,point=api.carlislePoint,rows=[];
await withSkateRuntime(async({THREE,level,player:p,CONST,TUNING,server})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(data));
 const tuning=JSON.stringify(TUNING);p.competitionMode=false;p.endlessDeaths=true;
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let contacts=0;
 for(const run of runs)for(let s=run.a+.5;s<run.b;s+=2.5){
  // The existing finish gate owns its raised arrival pad beyond this point.
  if(s>3980)continue;
  const [l,r]=run.bounds(s);
  for(const u of [(l+r)/2,l+2,r-2]){
   const at=point(s,run.height(s,u),u);ray.set(new THREE.Vector3(at[0],at[1]+5,at[2]),down);ray.far=8;
   const hit=ray.intersectObjects(level.groundMeshes,false).find(h=>h.face?.normal.y>.2);
   assert.ok(hit,`hole ${run.name} ${s}/${u}`);
   assert.ok(Math.abs(hit.point.y-at[1])<.2,`overlap/height ${run.name} ${s}/${u}: ${hit.point.y} vs ${at[1]}`);contacts++;
  }
 }
 for(const run of runs){
  const start=Math.max(run.a+1,0),initialU=run.bounds(start).reduce((a,b)=>a+b)/2;
  p.respawn(level,true,false,{position:new THREE.Vector3(...point(start,run.height(start,initialU)+.12,initialU)),heading:new THREE.Vector3(...point(start+2,0)).sub(new THREE.Vector3(...point(start,0)))});
  p.totalDeaths=0;p.masks=0;let wetFrames=0,maxSide=0,maxSpeed=0,finished=false,failed=null,frame=0;
  const samples=[],pilot=crossingPilot(run,point);
  for(;frame<1800;frame++){
   const control=pilot({at:p.pos.toArray(),velocity:p.walkVelocity.toArray(),side:p.axisL.toArray(),grounded:p.grounded,spring:p.trampolineAir,vy:p.vVel});
   const {s,u,v}=control;
   if(control.done){finished=true;break;}
   const input=makeInput(control.input);
   p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   if(p.groundHit?.slipGravity)wetFrames++;
   maxSide=Math.max(maxSide,Math.abs(v));maxSpeed=Math.max(maxSpeed,p.walkVelocity.length());
   if(frame%20===0)samples.push({frame,s,u,y:p.pos.y,velocity:p.walkVelocity.toArray(),state:p.state,wet:!!p.groundHit?.slipGravity});
   if(p.isBailing||['dead','gameover'].includes(p.state)||p.totalDeaths){failed={frame,s,u,state:p.state,ground:p.groundHit?.name};break;}
  }
  const row={name:run.name,finished,failed,seconds:frame/60,wetFrames,maxSide,maxSpeed,position:p.pos.toArray(),samples};rows.push(row);
  console.log(JSON.stringify({...row,samples:undefined}));
 }
 let lethal=0;
 for(const run of runs)for(const h of run.hazards){
  p.respawn(level,true,false,{position:new THREE.Vector3(...point(h.s,h.y+.12,h.u)),heading:new THREE.Vector3(0,0,-1)});p.masks=0;p.invulnTimer=0;p.uberTimer=0;
  p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);
  assert.equal(p.state,'dead',`spikes are harmless: ${run.name}/${h.s}`);lethal++;
 }
 assert.equal(JSON.stringify(TUNING),tuning);
 await mkdir('docs/carlisle-relay/slippery',{recursive:true});
 await writeFile('docs/carlisle-relay/slippery/crossings.json',JSON.stringify({contacts,lethal,rows},null,2)+'\n');
 assert.ok(rows.every(r=>r.finished&&!r.failed&&r.wetFrames>0),'a slick crossing has no continuous input-only route');
 console.log(`PASS ${rows.length} continuous crossings, ${contacts} support probes and ${lethal} lethal obstacle contacts.`);
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
