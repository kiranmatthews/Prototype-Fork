import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {warehouseCases,warehouseResult,observeWarehouse,warehouseUV} from './warehouse-reference-cases.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,player:p,CONST,TUNING})=>{
 const geometry=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {WAREHOUSE_REFERENCE_LEVEL:data,warehousePoint:point,WAREHOUSE_SIZE:size}=geometry;
 const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 assert.ok(parseCustomLevelJson(JSON.stringify(data)),'Warehouse must survive the editor contract');
 const level=new Level(scene,{id:'warehouse-reference',name:data.name,data});scene.updateMatrixWorld(true);
 const savedTuning=JSON.stringify(TUNING),results=[]; let bailCause; const bail=p.bail.bind(p); p.bail=(...args)=>{bailCause=args;return bail(...args);};
 const uv=()=>warehouseUV(p,geometry);
 const place=(u,v,y=0,h=[0,0,-1],speed=16)=>{
  p.respawn(level,true,true,{position:new THREE.Vector3(...point(u,v,y)).add(new THREE.Vector3(0,.12,0)),heading:new THREE.Vector3(...h)});
  p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
  p.groundHit=p.queryGround(level);if(p.groundHit)p.rideNormal.copy(p.groundHit.normal);
 };
 const run=(name,at,h,sample,stop,max=700,speed=16)=>{
  place(...at,h,speed);bailCause=null;let last={},jumped=false;
  const r=warehouseResult(name);r.peak=p.pos.y;
  for(let f=0;f<max;f++){
   const q=sample(f,r,uv()),input=makeInput({...q});
   for(const k of ['jump','grind','transfer'])input[`${k}Pressed`]=!!q[`${k}Held`]&&!last[`${k}Held`];
   input.jumpReleased=!q.jumpHeld&&!!last.jumpHeld;last=q;
   const old=p.pos.clone(),wasVert=p.vertAir;
   p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   observeWarehouse(p,r,wasVert,old,geometry);jumped||=!p.grounded;
   if(f%12===0)r.trace.push({f,p:p.pos.toArray(),speed:p.speed,grounded:p.grounded,vert:p.vertAir,state:p.state});
   if(p.isBailing||['dead','gameover'].includes(p.state)){r.failure={f,at:p.pos.toArray(),uv:uv(),state:p.state,bailCause};break;}
   if(stop(f,r,uv(),jumped)){r.ok=true;break;}
  }
  r.end={p:p.pos.toArray(),uv:uv(),speed:p.speed,grounded:p.grounded,state:p.state};results.push(r);return r;
 };
 for(const c of warehouseCases(p,geometry))run(c.name,c.at,c.h,c.sample,c.stop,c.max,c.speed);
 const ground=[];const ray=new THREE.Raycaster();
 for(const [u,v,y]of [[114,287,6.3],[469,389,2.66],[566,159,2.66],[345,22,2.66],[219,80,1.68]]){
  ray.set(new THREE.Vector3(...point(u,v,y+.05)),new THREE.Vector3(0,-1,0));ray.far=15;
  const hits=ray.intersectObjects(level.groundMeshes,false);ground.push({u,v,y:y*size,support:hits[0]?.point.y,mesh:hits[0]?.object.name});
 }
 const cpLine=run('floor checkpoint',[284,289,0],[0,0,-1],()=>({jumpHeld:true,moveY:1}),()=>level.checkpoints[0].active,150,20);
 assert.ok(cpLine.ok,'The floor checkpoint must bank from a normal skating pass');
 const checkpoint=level.currentSpawn.toArray(),deaths=p.totalDeaths;
 // Fault injection below/outside the shell tests the actual pit and native
 // recovery, without opening a hole in the source's closed warehouse floor.
 p.pos.fromArray(point(-20,230,0));p.prevPos.copy(p.pos);p.speed=0;p.vVel=0;p.grounded=false;p.state='air';p.groundHit=null;
 let recovered=false,pitContact=null,recoveryFrames=0;
 for(let f=0;f<650;f++){
  p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);recoveryFrames++;
  if(p.totalDeaths>deaths&&!pitContact)pitContact={p:p.pos.toArray(),pit:level.pitBoxes.findIndex(b=>b.intersectsBox(p.playerBox))};
  if(p.totalDeaths>deaths&&p.grounded&&!p.isBailing&&p.state==='ride'&&p.pos.distanceTo(level.currentSpawn)<.75){recovered=true;break;}
 }
 const recovery={checkpoint,pitContact,recovered,frames:recoveryFrames,deaths:p.totalDeaths-deaths,end:p.pos.toArray()};
 assert.ok(recovered,'Native pit respawn must return to supported checkpoint');assert.equal(recovery.deaths,1);assert.ok(pitContact?.pit>=0);
 const report={tuning:{cruise:TUNING.parkCruiseSpeed,charged:TUNING.parkChargeSpeed},ground,results,recovery};
 if(process.env.WAREHOUSE_REPORT)await writeFile(process.env.WAREHOUSE_REPORT,JSON.stringify(report,null,2));
 for(const r of results)console.log(JSON.stringify({...r,trace:undefined}));console.log(JSON.stringify({ground,recovery}));
 assert.equal(JSON.stringify(TUNING),savedTuning,'Never change shared movement tuning');level.dispose();
 if(!process.argv.includes('--probe'))for(const r of results){assert.ok(r.ok,`${r.name}: ${JSON.stringify(r.failure??r.end)}`);assert.ok(r.maxStep<.85,`${r.name} teleported`);}
 assert.ok(results.find(r=>r.name==='outside bank roll-in').maxStep<.5,'The bank-to-U join must not project the skater across a visible step');
 assert.ok(results.filter(r=>r.name.startsWith('roll-in')).every(r=>r.airFrames===0),'Roll-ins must keep continuous wheel contact');
 for(const g of ground)assert.ok(Math.abs(g.support-g.y)<.03,'Every source box stack must have supported ground');
});
