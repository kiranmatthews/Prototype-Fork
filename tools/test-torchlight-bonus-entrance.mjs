import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.TORCHLIGHT_OUTPUT??'/tmp/torchlight-crates';await mkdir(out,{recursive:true});
let enabled=false,entries=0;
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,d=l.bonusPlatformDiagnostics;assert.ok(d);assert.equal(l.totalCrates,151);assert.equal(l.bonusCrateTotal,20);
 const entry=new THREE.Vector3(d.x,d.topY,d.z),ray=new THREE.Raycaster(new THREE.Vector3(9,29,-202),new THREE.Vector3(0,-1,0),0,8),floor=l.raycastGround(ray)[0];assert.ok(floor);
 p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.12,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(25);assert.ok(p.grounded);enabled=true;
 r.charge(26);r.releaseJump();r.until(()=>entries>0,()=>r.steerToward(entry,{pace:Math.min(.7,r.distanceTo(entry)/.8)}),{maxFrames:300,label:'jump onto the rope departure bonus platform'});r.stepFor(25);assert.equal(entries,1);assert.equal(p.totalDeaths,0);assert.notEqual(p.state,'finished');
 const landed=p.pos.toArray();p.resumeSuspendedLevel(l,l.bonusReturnPoint(),p.captureRunState());r.stepFor(40);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.bonusReturnPoint())<.3);assert.equal(p.totalDeaths,0);assert.notEqual(p.state,'finished');
 await writeFile(out+'/entrance.json',JSON.stringify({entries,platform:d,stagedApproach:floor.point.toArray(),landed,returnPosition:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths},null,2));console.log('PASS actual rope-departure bonus entrance once and supported parent return without triggering the finish');
},{modulePath:'/src/levels/nightworks.ts',source:m=>m.NIGHTWORKS_LEVEL,levelId:'dark',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:600,onTick:(row,r)=>{if(enabled&&r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}});
