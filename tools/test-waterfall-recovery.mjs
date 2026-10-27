import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out='docs/waterfall-climb/runs';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,evidence=[];
 const normalized=(await r.server.ssrLoadModule('/src/level.ts')).normalizeCustomLevelData;
 const valid=normalized(r.source);assert.ok(valid);
 assert.deepEqual(l.captureData().components.filter(c=>c.t==='spinbridge').map(c=>c.hold),r.source.components.filter(c=>c.t==='spinbridge').map(c=>c.hold));
 for(const c of valid.components.filter(c=>c.t==='spinbridge'))assert.ok(c.hold>=1&&c.hold<=60);
 for(const hold of [0,61,'6',null]){
  const data=structuredClone(r.source);data.components.find(c=>c.t==='spinbridge').hold=hold;
  assert.equal(normalized(data),null,`reject invalid hold ${String(hold)}`);
 }
 const wrong=structuredClone(r.source);wrong.components.find(c=>c.t==='platform').hold=5;assert.equal(normalized(wrong),null);
 for(const index of [0,6,9,12,15]){
  const cp=l.checkpoints[index];
  p.respawn(l,true,false,{position:new THREE.Vector3(cp.spawnPos.x-1.1,cp.spawnPos.y,cp.spawnPos.z)});
  r.stepFor(18);assert.ok(p.grounded);r.tick({spinHeld:true});r.stepFor(24);assert.ok(cp.active);
  const lives=p.lives,before=r.snapshot();
  const fallInput=index<7?{moveX:1}:{moveY:-1};
  const edge=index<7?[index===6?57.2:4.3,cp.spawnPos.y-.1,cp.spawnPos.z]
   :[cp.spawnPos.x,cp.spawnPos.y-.1,r.sourceModule.WATERFALL_FACE_Z+5.6];
  r.walkTo(edge,{pace:.25,arrivalTolerance:.3,maxFrames:2200});r.charge();r.releaseJump(fallInput);
  r.until(()=>p.state==='dead',fallInput,{maxFrames:1000,allowDeath:true,label:`leave checkpoint terrace ${index}`});
  r.until(()=>p.state==='ride'&&p.grounded,{}, {maxFrames:500,allowDeath:true,label:`recover to checkpoint ${index}`});r.stepFor(12);
  assert.equal(p.lives,lives-1,'one ordinary life pays for the deliberately missed jump');assert.ok(p.pos.distanceTo(cp.spawnPos)<.15,JSON.stringify(r.snapshot()));
  assert.ok(l.spinBridges.every(b=>b.state==='closed'));
  evidence.push({checkpoint:index,before,after:r.snapshot()});console.log('RECOVERED',index,JSON.stringify(p.pos.toArray()));
 }
 await writeFile(`${out}/recovery.json`,JSON.stringify(evidence,null,2));
 console.log('PASS waterfall hold validation and river/basin/high-cliff checkpoint recovery');
},{modulePath:'/src/levels/waterfall-climb.ts',levelId:'waterfall-climb',source:m=>m.WATERFALL_CLIMB_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:12000});
