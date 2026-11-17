import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney,runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const out=process.env.TEMPLE_CRATES_OUTPUT??'/tmp/temple-crates';await mkdir(out,{recursive:true});
await withThemedBonusRuntime('bonus-jungle-terraces',async r=>{
 const {p,l,THREE}=r;
 if(process.env.TEMPLE_CRATES_BONUS_BASELINE){
  const before=JSON.parse(await readFile(process.env.TEMPLE_CRATES_BONUS_BASELINE,'utf8')).data;
  assert.equal(JSON.stringify(r.source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components.filter(c=>c.t!=='crate')));
  assert.deepEqual(Object.fromEntries(Object.entries(r.source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
 }
 assert.equal(l.totalCrates,29);assert.equal(l.crates.length,30);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let maxFloorError=0;
 for(const b of l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm?.startsWith('Reliquary cargo /')))
  for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   ray.set(b.mesh.position.clone().setY(3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;
   const h=l.raycastGround(ray)[0];assert.ok(h);maxFloorError=Math.max(maxFloorError,Math.abs(h.point.y-b.box.min.y));
  }
 assert.ok(maxFloorError<.04);
 try{
  const positive=runInputPilot(r,runThemedBonusJourney);
  assert.equal(positive.state,'finished');assert.equal(positive.cratesBroken,29);assert.equal(positive.deaths,0);assert.ok(positive.gemEarned);
  await writeFile(out+'/bonus.json',JSON.stringify({...positive,maxFloorError},null,2));
 }catch(error){await writeFile(out+'/bonus-failure.json',JSON.stringify({error:error.message,report:r.report,trace:r.trace},null,2));throw error;}
 const reset=position=>p.respawn(l,true,false,position?{position:new THREE.Vector3(...position),heading:new THREE.Vector3(1,0,0)}:undefined);
 const original=r.course;
 reset([1,.12,0]);
 let actualDoubleJump=false;const tick=r.tick;r.tick=sample=>{const result=tick(sample);actualDoubleJump ||= p.airJumpUsed&&p.doubleJumpAir;return result;};
 const finite=runInputPilot(r,runThemedBonusWrongOrder);r.tick=tick;assert.ok(actualDoubleJump);
 await writeFile(out+'/bonus-wrong-finite.json',JSON.stringify({...finite,actualDoubleJump},null,2));
 reset([25,.12,0]);r.course={...original,rooms:[original.rooms[1]]};
 const bridge=runInputPilot(r,runThemedBonusWrongOrder);assert.equal(p.state,'dead');
 await writeFile(out+'/bonus-wrong-bridge.json',JSON.stringify(bridge,null,2));
 reset([59,.12,0]);r.course={...original,rooms:[original.rooms[2]]};
 const fuse=runInputPilot(r,runThemedBonusWrongOrder);assert.equal(p.state,'dead');
 await writeFile(out+'/bonus-wrong-fuse.json',JSON.stringify(fuse,null,2));
 reset([13.7,.12,0]);r.stepFor(25);
 const box=name=>l.crates.find(b=>r.source.components[b.mesh.userData.editorIdx]?.nm===name);
 const donor=box('Reliquary cargo / finite-exit / 1'),cap=box('Room 1 finite: upper cap');
 r.charge(26);r.releaseJump();
 r.until(()=>!donor.alive&&p.vVel>0,()=>r.steerToward(donor.mesh.position,{pace:.65}),{maxFrames:180,label:'ordinary delivery rebound'});
 r.until(()=>p.vVel<.65,{}, {maxFrames:100,label:'delivery rebound apex'});
 r.tick({jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.doubleJumpAir&&p.airJumpUsed);
 let maxHead=p.crateBodyBox.max.y;
 r.until(()=>p.grounded,()=>{maxHead=Math.max(maxHead,p.crateBodyBox.max.y);return r.steerToward([14,0,0],{pace:.35});},{maxFrames:200,label:'cargo height cannot replace the finite stack'});
 assert.ok(cap.alive);assert.ok(maxHead<cap.box.min.y);
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);
 await writeFile(out+'/bonus-reset.json',JSON.stringify({physical:30,counted:29,allRestored:true,credit:0,actualCargoDoubleJump:true,maxHead,capBottom:cap.box.min.y},null,2));
 console.log('PASS continuous Ember Reliquary all-box journey, all three wrong orders, cargo height exclusion and full retry');
},{maxFrames:16000});
