import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const report={cases:[]};
await withBlockworksRuntime(r=>{
 const {p,l}=r,record=name=>report.cases.push({name,position:p.pos.toArray(),deaths:p.totalDeaths});
 const stage=position=>{p.respawn(l,true,false,{position:new r.THREE.Vector3(...position),heading:new r.THREE.Vector3(0,0,-1)});r.stepFor(30);assert.ok(p.grounded);};
 const walk=q=>r.walkTo(q,{pace:.45,tolerance:.13,arrivalTolerance:.5,settleFrames:10});
 const hop=q=>{
  r.charge(26);r.releaseJump();let frames=0;
  r.until(()=>p.grounded,()=>({...r.steerToward(q),jumpHeld:++frames===22&&r.distanceTo(q)>2.2}),{maxFrames:210,label:'Deliberate secret-route jump'});
  assert.ok(r.distanceTo(q)<1.9);r.stepFor(10);
 };
 const tuning=JSON.stringify(r.TUNING);
 // Real patrol endpoints must have enough supported width for the enemy body.
 const ray=new r.THREE.Raycaster(),grounds=l.groundMeshes;
 report.enemies=[];
 for(const c of r.source.components.filter(c=>c.t==='enemy'&&c.nm?.startsWith('Wreck encounter'))){
  for(const dx of [-1,1]){
   ray.set(new r.THREE.Vector3(c.p[0]+dx*((c.range??0)+.55),c.p[1]+2,c.p[2]),new r.THREE.Vector3(0,-1,0));
   const hit=ray.intersectObjects(grounds,false).find(h=>Math.abs(h.point.y-c.p[1])<.65);
   assert.ok(hit,`${c.nm}: patrol/body footprint leaves its platform`);
  }
  report.enemies.push(c.nm);
 }
 stage([1004,8.1,-127.8]);r.tick({spinHeld:true});r.stepFor(25);
 assert.ok(l.checkpoints.some(c=>c.active&&Math.abs(c.spawnPos.z+129)<.1));
 const bank=l.currentSpawn.clone(),before=p.totalDeaths;
 r.until(()=>p.totalDeaths>before,()=>({...r.steerToward([1013,8,-133],{pace:.8}),grindHeld:true}),{maxFrames:600,allowDeath:true,label:'Walk off the actual boarding deck'});
 r.until(()=>p.grounded&&p.state==='ride',{}, {maxFrames:1000,allowDeath:true,label:'Recover at the banked checkpoint'});
 assert.equal(p.totalDeaths,before+1);assert.ok(p.pos.distanceTo(bank)<2.1);record('Bilge death and banked checkpoint respawn');
 stage([1003.9,8.1,-118]);r.stepFor(60,{moveX:1});assert.ok(p.pos.x<1004.4);assert.ok(p.grounded);record('Solid cargo collision');
 stage([999,11.9,-276]);
 walk([995.1,11.8,-273.5]);hop([992,12.8,-273.5]);
 walk([991.3,12.8,-274]);hop([987.4,13.8,-278]);walk([986.5,13.8,-279]);
 assert.equal(p.hasCrystal,true);record('Raised crystal route');
 walk([987.6,13.8,-279.5]);hop([992,12.8,-282.5]);hop([996.2,11.8,-279]);
 assert.ok(p.grounded&&Math.abs(p.pos.y-11.8)<.1);record('Crystal loop returns to the refuge');
 walk([1002.7,11.8,-274.6]);hop([1008.5,11.8,-274.6]);
 hop([1009.5,12.5,-278]);assert.equal(l.bonusPlatformAt(p.pos),true);
 assert.deepEqual(l.bonusReturnPoint().toArray(),[1009.5,11.95,-274.5]);record('Deliberate bonus landing');
 // A separate timing check intentionally stays on a crumble until it fails.
 stage([998,12.3,-285.5]);const crumble=l.crumbles.find(c=>Math.abs(c.base.z+285.5)<.1);
 r.until(()=>crumble.state==='fall',{}, {maxFrames:100,allowDeath:true,label:'Crumble warning expires'});assert.notEqual(crumble.state,'idle');record('Loose cargo actually collapses');
 assert.equal(JSON.stringify(r.TUNING),tuning);
 console.log(JSON.stringify({pass:true,...report},null,2));
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL,
 start:[1004,8.1,-112],heading:[0,0,-1],controlFrame:({p})=>p.axisF,endlessDeaths:true,maxFrames:18000})
 .finally(()=>writeFile(process.env.MERCHANT_WRECK_SAFETY_OUTPUT??join(tmpdir(),'wreck-challenges-safety.json'),JSON.stringify(report,null,2)+'\n'));
