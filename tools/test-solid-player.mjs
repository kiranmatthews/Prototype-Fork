import assert from 'node:assert/strict';
import {readFile,writeFile}from'node:fs/promises';
import {withBlockworksRuntime}from'./blockworks-runner.mjs';
import {makeInput}from'./jungle-cup-harness.mjs';
const replay=JSON.parse(await readFile(new URL('fixtures/custard-solid-wall-replay.json',import.meta.url),'utf8'));
const approach=JSON.parse(await readFile(new URL('fixtures/custard-solid-wall-approach.json',import.meta.url),'utf8'));
const report={cases:[]};
await withBlockworksRuntime(async r=>{
 const {THREE,Level,Player,server}=r,{CONST}=await server.ssrLoadModule('/src/tuning.ts');
 const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
 const runner=new Replayer();runner.begin(replay);const input=makeInput(),start=approach.frames.find(v=>v.f===6338);
 for(let f=0;f<start.f;f++)runner.feed(input,r.p.camDir);
 r.p.respawn(r.l,true,false,{position:new THREE.Vector3(...start.p),heading:new THREE.Vector3(...start.axis)});
 Object.assign(r.p,{state:'air',grounded:false,freeSkate:true,airFromSkate:true,airMomentum:true,airGrav:'board',speed:start.speed,vVel:start.vy});
 const frames=[];for(let i=0;i<26;i++){runner.feed(input,r.p.camDir);r.p.step(CONST.fixedStep,input,r.l);r.l.update(CONST.fixedStep);r.p.commitRenderStep(r.l);frames.push({frame:start.f+i,p:r.p.pos.toArray(),state:r.p.state,bail:r.p.isBailing,impact:r.p.worldImpactDiagnostics});}
 runner.end();report.replayApproach={frames,world:r.l.worldSolidDiagnostics};
 assert.ok(frames.some(v=>v.bail&&v.impact.last?.name==='Custard spillway outer stone mass'),'the recorded approach produces a real stone-wall ragdoll');
 const hit=frames.find(v=>v.impact.last?.name==='Custard spillway outer stone mass').impact.last;
 assert.ok(new THREE.Vector3(...hit.outgoing).dot(new THREE.Vector3(...hit.normal))>0,'the impact velocity points away from the stone');
 const fixture=(components)=>new Level(new THREE.Scene(),{id:'hard-world-fixture',name:'Hard-world fixture',data:{v:1,name:'Hard-world fixture',spawn:[0,.02,4],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},...components,{t:'gate',p:[0,0,-12]}]}});
 for(const kind of ['platform','mesh','wall','wallpath']){
  let component={t:kind,p:[0,1.5,0],s:[6,3,.12]};
  if(kind==='wall')component.p=[0,0,0];
  if(kind==='wallpath')component={t:'wallpath',p:[0,0,0],pts:[[-3,0],[3,0]],w:.12,rise:3};
  if(kind==='mesh'){const g=new THREE.BoxGeometry(6,3,.12);component={t:'mesh',p:[0,1.5,0],vertices:Array.from(g.attributes.position.array),indices:Array.from(g.index.array),solid:false,tex:'stone'};g.dispose();}
  const level=fixture([component]),p=new Player(new THREE.Scene());p.enterLevel('hard-world-fixture');p.respawn(level,true,false,{position:new THREE.Vector3(0,.02,1),heading:new THREE.Vector3(0,0,-1)});p.freeSkate=true;p.speed=23;
  const take=[];for(let i=0;i<12;i++){p.step(CONST.fixedStep,makeInput({jumpHeld:true,moveY:1}),level);level.update(CONST.fixedStep);take.push({z:p.pos.z,bail:p.isBailing,speed:p.speed,impact:p.worldImpactDiagnostics});}
await writeFile('/private/tmp/solid-player-proof.json',JSON.stringify(report,null,2));assert.ok(take.some(v=>v.bail),kind+' frontal crash must ragdoll');assert.ok(take.every(v=>v.z>0),kind+' body cannot pass through the wall');report.cases.push({kind,take});level.dispose();
 }
 await writeFile('/private/tmp/solid-player-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,replay:hit,cases:report.cases.map(v=>v.kind)}));
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL});
