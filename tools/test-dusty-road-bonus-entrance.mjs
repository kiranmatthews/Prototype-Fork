import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.DUSTY_CRATE_OUTPUT??'/tmp/dusty-crates';await mkdir(out,{recursive:true});let enabled=false,entries=0;
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,entry=new THREE.Vector3(...m.DESERT_BONUS_ENTRANCE),q=new THREE.Vector3(...m.desertPoint(m.DESERT_BONUS_STATION,2.7));
 const ray=new THREE.Raycaster(q.clone().add(new THREE.Vector3(0,3,0)),new THREE.Vector3(0,-1,0),0,6),floor=l.raycastGround(ray)[0];assert.ok(floor);
 p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.12,0)),heading:entry.clone().sub(q).setY(0).normalize()});r.stepFor(30);assert.ok(p.grounded);enabled=true;
 r.stepFor(26,{jumpHeld:true});r.tick({jumpHeld:false});assert.equal(p.state,'air');
 r.until(()=>entries>0,()=>{const distance=Math.hypot(entry.x-p.pos.x,entry.z-p.pos.z);return r.steerToward(entry,{pace:Math.min(.8,distance/.8)});},{maxFrames:360,label:'Jump from the trail onto Cactus Cache'});
 r.stepFor(30);assert.equal(entries,1);assert.equal(p.totalDeaths,0);const landed=p.pos.toArray();
 p.resumeSuspendedLevel(l,l.bonusReturnPoint(),p.captureRunState());r.stepFor(40);assert.ok(p.grounded);assert.ok(p.pos.distanceTo(l.bonusReturnPoint())<.3);assert.equal(entries,1);
 await writeFile(out+'/entrance.json',JSON.stringify({entries,landed,returnPosition:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths},null,2));console.log('PASS normal jump onto the Cactus Cache entrance once and supported parent return');
},{modulePath:'/src/levels/desert-canyon.ts',source:m=>m.DESERT_CANYON_LEVEL,levelId:'bryce-canyon',controlFrame:r=>r.p.raceInputBasis(r.l),maxFrames:600,
 onTick:(row,r)=>{if(enabled&&r.l.consumeBonusLanding(r.p.pos,{enabled:true,grounded:r.p.grounded,jump:row.input.jumpPressed||row.input.jumpReleased,rising:r.p.vVel>.2}))entries++;}});
