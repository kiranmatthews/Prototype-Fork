import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const rows = [['crate-primer',150,1.2],['switchyard',222,4],['clockwork-gauntlet',276,5.2]], reports=[];
for (const [id,x,y] of rows) {
 let entries=0;
 await withBlockworksRuntime(async r=>{
  const {p,l}=r;
  r.stepFor(30);
  assert.equal(p.grounded,true);
  const parentState=p.captureRunState();
  assert.deepEqual(l.bonusReturnPoint().toArray(),[x,y+.1,0]);
  assert.equal(l.bonusPlatformDiagnostics.x,x);assert.equal(l.bonusPlatformDiagnostics.z,5.4);
  r.walkTo([x,y,3],{pace:.16,maxFrames:1000,label:'walk from the final route through its open boundary'});
  assert.equal(entries,0,'walking into the alcove triggered a bonus');
  const walkEnd=p.pos.toArray();
  r.jumpTo([x,y+1.05,5.4],{pace:.25,chargeFrames:18,arrivalTolerance:1.45,heightTolerance:.15,label:'deliberate jump onto raised bonus stone'});
  r.stepFor(10);
  assert.equal(entries,1,'actual jump landing did not trigger the entrance exactly once');
  assert.equal(l.bonusPlatformAt(p.pos),true);
  const jumpEnd=p.pos.toArray();
  // Keep this local probe in the parent after the real entry signal to test
  // containment. Ordinary gameplay switches to the selected bonus here.
  r.stepFor(100,{moveY:-1});
  assert.ok(p.pos.z>7&&p.pos.z<8,`outer alcove wall confinement: ${JSON.stringify(r.snapshot())}`);
  r.stepFor(100,{moveX:-1});
  assert.ok(p.pos.x>x-4&&p.pos.x<x-3,`side wall confinement: ${JSON.stringify(r.snapshot())}`);
  r.charge(18);r.releaseJump({moveX:-1});
  r.until(()=>p.grounded,{moveX:-1},{maxFrames:180,label:'jump against the closed alcove side'});
  assert.ok(p.pos.x>x-4,'jumping over the bonus stone enables a side-boundary bypass');
  assert.ok(p.pos.z<8&&p.isBailing===false);
  const confined=p.pos.toArray();
  p.resumeSuspendedLevel(l,l.bonusReturnPoint(),parentState);
  r.stepFor(30);
  assert.equal(p.grounded,true);assert.notEqual(p.state,'finished');assert.equal(p.isBailing,false);
  assert.ok(Math.abs(p.pos.y-y)<.15);assert.ok(Math.abs(p.pos.z)<.15);
  // Accounting fixture: all of the main course's boxes alone are insufficient.
  // The selected room's paid count completes the same runtime gem predicate.
  const mainCount=l.totalCrates-l.bonusCrateTotal;
  p.cratesBroken=mainCount;p.bonusCrates=0;
  r.stepFor(2);assert.equal(p.gemSpawned,false,'main-only count incorrectly earns the all-box gem');
  p.bonusCrates=l.bonusCrateTotal;
  r.stepFor(2);assert.equal(p.gemSpawned,true,'selected bonus count does not complete the all-box gem');
  assert.ok(l.gemPickup);
  const gate=l.gateSpec;
  assert.ok(l.gemPickup.group.position.x<gate.x-2.5,'gem is not before the finish plane');
  assert.ok(Math.abs(l.gemPickup.group.position.z)<.2,'gem missed the supported return lane');
  reports.push({id,walkEnd,jumpEnd,confined,entries,return:p.pos.toArray(),mainCount,bonusCount:l.bonusCrateTotal,gem:l.gemPickup.group.position.toArray(),frames:r.frame});
 },{modulePath:'/src/levels/puzzle-trilogy.ts',source:m=>m.PUZZLE_LEVELS.find(row=>row.id===id).data,levelId:id,start:[x,y+.12,0],controlFrame:()=>({x:0,z:-1}),
 onTick:(row,r)=>{if(r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}});
}
await writeFile(join(tmpdir(),'puzzle-bonus-alcoves-evidence.json'),JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
console.log('PASS three actual route-to-alcove walks, deliberate entry jumps, closed branch boundaries, supported returns and an explicit all-box accounting fixture');
