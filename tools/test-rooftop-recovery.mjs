import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m,THREE}=r;
 r.stepFor(5);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.spawnPos)<.2);
 let supported=0;
 for(const roof of m.ROOFTOP_ROOFS)for(let s=roof.a+1;s<=roof.b-1;s+=2){const q=m.rooftopPoint(s);const hits=l.raycastGround(new THREE.Raycaster(new THREE.Vector3(q[0],roof.top+1,-s),new THREE.Vector3(0,-1,0),0,2));assert.ok(hits.some(h=>Math.abs(h.point.y-roof.top)<.02));supported++;}
 reports.push({test:'supported spawn and whole walking line',samples:supported});
 for(let i=0;i<4;i++){assert.equal(p.warpCheckpoint(l,1),true);r.stepFor(4);assert.ok(p.grounded);assert.equal(l.activeCheckpoint,l.checkpoints[i]);}
 const roof=m.ROOFTOP_ROOFS[11],cp=l.activeCheckpoint,lives=p.lives;
 r.walkTo([roof.x+roof.width/2-2,roof.top,cp.spawnPos.z],{pace:.7,tolerance:.5,arrivalTolerance:2});
 const departure=r.frame;
 r.charge(25);r.releaseJump(r.worldDirectionInput([1,0,0]));
 r.until(()=>p.state==='dead',()=>r.worldDirectionInput([1,0,0]),{allowDeath:true,maxFrames:300,label:'jump over the parapet into the alley'});
 const death=r.frame;
 r.until(()=>p.state==='ride'&&p.grounded,{}, {allowDeath:true,maxFrames:300,label:'normal banked checkpoint return'});
 assert.equal(l.activeCheckpoint,cp);assert.ok(p.pos.distanceTo(cp.spawnPos)<1);assert.equal(lives-p.lives,1);
 const returned=r.frame;r.stepFor(25,{moveY:1});assert.ok(p.pos.distanceTo(cp.spawnPos)>1);
 reports.push({test:'pit recovery after four checkpoint warps',fallSeconds:(death-departure)*r.dt,respawnSeconds:(returned-death)*r.dt,livesLost:1,continued:true});
 // K-equivalent returns to the preceding roof and its authored balcony.
 assert.equal(p.warpCheckpoint(l,-1),true);r.stepFor(5);
 const reward=m.ROOFTOP_ROOFS[8],target=[reward.x+reward.width/2+3.4,reward.top,-(reward.a+23)];
 r.until(()=>p.hasCrystal,()=>r.steerToward(target,{pace:.55}),{maxFrames:800,label:'walk the balcony ramp and collect its crystal'});
 assert.equal(p.lives,lives-1);assert.ok(p.grounded);
 r.walkTo([reward.x+reward.width/2+1.1,reward.top,-(reward.a+23)],{pace:.4,tolerance:.3,arrivalTolerance:.8});
 r.charge(24);r.releaseJump(r.worldDirectionInput([-1,0,0]));
 r.until(()=>p.grounded,()=>r.worldDirectionInput([-1,0,0]),{maxFrames:120,label:'hop back over the balcony parapet'});
 assert.ok(p.pos.x<reward.x+reward.width/2-1);assert.equal(p.lives,lives-1);
 reports.push({test:'optional balcony crystal and supported return',crystal:p.hasCrystal,position:p.pos.toArray()});
},{source:m=>m.ROOFTOP_RELAY_LEVEL,levelId:'rooftop-relay',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile('/private/tmp/rooftop-recovery.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
