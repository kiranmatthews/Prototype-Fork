import assert from 'node:assert/strict';
import {withBananaBay} from './banana-bay-runtime.mjs';
import {probeSwitchyardOrder} from './test-switchyard-order.mjs';

await withBananaBay(r=>{
  const name=c=>r.source.components[c.mesh.userData.editorIdx]?.nm??'';
  for(const [checkpoint,part] of [[0,'preserve the arrow'],[1,'stomp cargo then retreat']]){
    r.l.reset(true);
    const tool=r.l.crates.find(c=>name(c).includes(part));
    assert.ok(tool,'authored access tool exists');
    r.l.activateCheckpoint(r.l.checkpoints[checkpoint],0);
    r.l.breakCrate(tool,true);
    assert.ok(!tool.alive,'wrong-order fixture consumes the actual tool');
    r.l.reset(false);
    assert.ok(tool.alive,'soft checkpoint recovery restores the unbanked tool');
    assert.equal(r.l.explosions.length,0,'recovery clears pending explosion damage');
  }
  console.log('PASS Banana Bay: checkpoint recovery restores the arrow and TNT decisions.');
});

await withBananaBay(r=>{
  const reports=[];
  for(const kind of ['floor-double','single-support','spent-switch-support']){
    r.l.reset(true);r.l.update(0);
    const start=kind==='spent-switch-support'?[145.3,2.92,0]:[kind==='floor-double'?7.1:3.8,.12,0];
    r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(...start),heading:new r.THREE.Vector3(1,0,0)});
    const pilot=probeSwitchyardOrder(r,kind);let step,count=0;
    while(!(step=pilot.next()).done){assert.ok(count++<3000,'bounded wrong-order probe');r.tick(step.value);}
    assert.ok(step.value.after.reward,'wrong order cannot bypass the high reward dependency');
    reports.push({kind,frames:count,rewardRemains:step.value.after.reward});
  }
  r.l.reset(true);
  assert.ok(r.l.crates.every(c=>c.alive),'bonus retry restores every crate');
  assert.ok(r.l.crates.filter(c=>r.source.components[c.mesh.userData.editorIdx]?.outline).every(c=>c.pending),
    'bonus retry restores the unrevealed circuit');
  console.log('PASS Lifeguard Lockup: native wrong-order inputs and complete retry restoration.',JSON.stringify(reports));
},{bonus:true});
