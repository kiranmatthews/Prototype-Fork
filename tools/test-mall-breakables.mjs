import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallBreakableFixtures} from './mall-breakable-fixtures.mjs';
await withBlockworksRuntime(async r=>{
 const {p,l,THREE:T,sourceModule:m}=r,tuning=JSON.stringify(r.TUNING),owner=l.breakableScenery,results=[];
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(m.MALL_LEVEL));
 assert.equal(owner.objects.length,7);assert.equal(owner.objects.filter(o=>o.kind==='sign').length,5);
 const touch=owner.touch.bind(owner);
 for(const f of mallBreakableFixtures){
  const object=owner.objects.find(o=>o.id===f.id);assert.ok(object);assert.equal(object.members.length,f.members);
  assert.ok(object.members.every(m=>m.mesh.name.startsWith(`PS1 Mall scenery ${f.sector}:`)),`${f.label} checksum must hide only its render sector`);
  const q=m.mallPoint(...f.start);q[1]=m.mallSupport(q[0],q[2],q[1]+3)+.1;assert.ok(Number.isFinite(q[1]));
  const heading=new T.Vector3(...f.heading),runs=[];let contact=null;
  for(const enabled of [false,true]){
   owner.touch=enabled?touch:()=>{};
   p.respawn(l,true,false,{position:new T.Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   const trace=[];let bail=false;
   for(let i=0;i<110;i++){
    const speed=p.speed;r.tick({moveY:1,jumpHeld:true});bail||=p.isBailing;
    trace.push([p.pos.x,p.pos.y,p.pos.z,p.speed,p.state]);
    if(enabled&&object.broken&&!contact)contact={frame:i,speedBefore:speed,speedAfter:p.speed,sourcePosition:m.mallSourcePoint(...p.pos.toArray()),fragments:owner.fragmentCount};
   }
   assert.equal(bail,false,`${f.label}: approach must stay playable`);runs.push(trace);
  }
  owner.touch=touch;
  const result={id:f.id,label:f.label,contact,brokenIds:owner.objects.filter(o=>o.broken).map(o=>o.id),movementIdentical:JSON.stringify(runs[0])===JSON.stringify(runs[1])};
  console.log(JSON.stringify(result));assert.ok(contact,f.label);assert.ok(result.movementIdentical,'Scenery must not change native movement');
  assert.deepEqual(result.brokenIds,[f.id]);assert.ok(object.members.every(m=>!m.mesh.visible));
  l.reset(false);assert.ok(object.broken);assert.equal(owner.fragmentCount,0);
  l.reset(true);assert.ok(owner.objects.every(o=>!o.broken&&o.members.every(m=>m.mesh.visible)));
  results.push(result);
 }
 const report={fixtures:results,tuningUnchanged:tuning===JSON.stringify(r.TUNING),softResetKeepsProgress:true,hardResetRestoresAll:true};
 assert.ok(report.tuningUnchanged);
 await writeFile('/private/tmp/mall-recreation/measured/breakables.json',JSON.stringify(report,null,2));
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:2000,controlFrame:r=>r.p.axisF});
