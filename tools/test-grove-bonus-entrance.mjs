import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.GROVE_CRATE_OUTPUT??'/tmp/grove-crates';await mkdir(out,{recursive:true});
let enabled=false,entries=0;
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,d=l.bonusPlatformDiagnostics;assert.ok(d);const entry=new THREE.Vector3(d.x,d.topY,d.z),ray=new THREE.Raycaster(new THREE.Vector3(0,d.y+3,d.z),new THREE.Vector3(0,-1,0),0,6),floor=l.raycastGround(ray)[0];assert.ok(floor);
 p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.12,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(25);assert.ok(p.grounded);enabled=true;r.charge(26);r.releaseJump();
 r.until(()=>entries>0,()=>r.steerToward(entry,{pace:Math.min(.7,r.distanceTo(entry)/.8)}),{maxFrames:300,label:'jump onto the refuge bonus platform'});r.stepFor(25);assert.equal(entries,1);assert.equal(p.totalDeaths,0);
 const landed=p.pos.toArray();p.resumeSuspendedLevel(l,l.bonusReturnPoint(),p.captureRunState());r.stepFor(40);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.bonusReturnPoint())<.3);assert.equal(p.totalDeaths,0);assert.ok(l.minefields.fields.every(f=>!f.detonated));
 await writeFile(out+'/entrance.json',JSON.stringify({entries,platform:d,landed,returnPosition:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths,fieldsArmed:true},null,2));console.log('PASS actual refuge bonus entrance once, supported parent return and armed fields');
},{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',maxFrames:600,onTick:(row,r)=>{if(enabled&&r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}});
