import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {crossingPilot} from './carlisle-crossing-pilot.mjs';
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,runs=api.CARLISLE_RELAY_CROSSINGS,point=api.carlislePoint,rows=[];
const grades=runs.map(run=>{
 for(const slope of run.slopes){
  const drop=point(slope.from,run.y)[1]-point(slope.to,run.y)[1];
  assert.ok(Math.abs(drop-(slope.to-slope.from)*slope.grade)<.001,'slippery pitch is not forward downhill');
 }
 for(let s=run.a;s<run.b;s+=.5){
  const [l,r]=run.bounds(s);
  assert.equal(point(s,run.height(s,l),l)[1],point(s,run.height(s,r),r)[1],'sideways bank returned');
  assert.ok(point(s+.5,run.y)[1]<=point(s,run.y)[1]+1e-6,'uphill recovery hump');
 }
 return {name:run.name,degrees:Math.atan(run.grade)*180/Math.PI,drop:point(run.a,run.y)[1]-point(run.b,run.y)[1],slopes:run.slopes};
});
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
 const drift=[];
 for(const index of [0,12,19]){
  const run=runs[index],slope=run.slopes.reduce((a,b)=>a.to-a.from>b.to-b.from?a:b),s=slope.from+2;
  const heading=new THREE.Vector3(...point(s+1,0)).sub(new THREE.Vector3(...point(s,0))).setY(0).normalize();
  const speeds=[];
  for(const moveY of [0,-1]){
   p.respawn(level,true,false,{position:new THREE.Vector3(...point(s,run.y+.12)),heading});
   for(let f=0;f<45;f++){const input=makeInput({moveY});p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);}
   speeds.push(p.walkVelocity.dot(heading));
   assert.ok(p.grounded&&!p.isBailing&&p.groundHit?.slipGravity,'gravity check left its slide');
  }
  assert.ok(speeds[0]>3&&speeds[1]<speeds[0],'downhill gravity or uphill resistance missing');
  drift.push({name:run.name,neutralForwardSpeed:speeds[0],uphillInputForwardSpeed:speeds[1]});
 }
 const out=process.env.CARLISLE_OUT??'docs/carlisle-relay/slippery';await mkdir(out,{recursive:true});
 await writeFile(`${out}/crossings.json`,JSON.stringify({contacts,lethal,grades,drift,rows},null,2)+'\n');
 assert.ok(rows.every(r=>r.finished&&!r.failed&&r.wetFrames>0),'a slick crossing has no continuous input-only route');
 console.log(`PASS ${rows.length} continuous crossings, ${contacts} support probes and ${lethal} lethal obstacle contacts.`);
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
