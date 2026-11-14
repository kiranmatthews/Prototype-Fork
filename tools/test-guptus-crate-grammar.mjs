import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runCalderaBonusJourney} from './nightworks-caldera-pilot.mjs';
const out=process.env.GUPTUS_CRATE_OUTPUT??'/tmp/guptus-crates';await mkdir(out,{recursive:true});
if(!process.argv.includes('--bonus-only'))await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,report={harvests:[],maxFloorError:0};
 if(process.env.GUPTUS_BASELINE){
  const before=JSON.parse(await readFile(process.env.GUPTUS_BASELINE,'utf8'));
  assert.equal(JSON.stringify(source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components));
  assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
  report.nonCratesExact=report.settingsExact=true;
 }
 assert.equal(l.crates.length,80);assert.equal(l.totalCrates,112);assert.equal(l.bonusCrateTotal,25);assert.equal(l.checkpoints.length,7);assert.equal(l.enemies.length,4);
 const approaches=[[0,10,13],[9,10,-38],[-8,12,-96],[-8,12,-96],[-8,12,-178],[-8,12,-178],[20,14,-281],[20,14,-281],[26,14,-377],[34,14,-377],[114,14,-386],[114,14,-386],[114,14,-482],[95,24,-536],[120,34,-595],[132,36,-675]];
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [i,q] of approaches.entries()){
  const prefix=`Guptus supply / section ${Math.floor(i/2)+1} / cache ${i%2+1} /`,boxes=l.crates.filter(b=>source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(prefix));assert.equal(boxes.length,5);
  const base=Math.min(...boxes.map(b=>b.box.min.y));
  for(const b of boxes.filter(b=>Math.abs(b.box.min.y-base)<.01))for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   ray.set(b.mesh.position.clone().setY(base+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,prefix+' corner support');report.maxFloorError=Math.max(report.maxFloorError,Math.abs(h.point.y-base));
  }
  ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,3,0)),down);ray.far=6;const floor=l.raycastGround(ray)[0];assert.ok(floor,prefix+' route approach');
  p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);const first=r.frame;let held=false;
  // The widest reading dock requires a 12m foot approach. This deliberately
  // cautious pilot pauses between spins and needs more than 1000 frames.
  try{r.until(()=>boxes.every(b=>!b.alive),()=>{const target=boxes.find(b=>b.alive).mesh.position,spin=p.spinning||!held;held=spin;return{...r.steerToward(target,{pace:p.spinning?.38:0}),spinHeld:spin};},{maxFrames:1800,label:prefix});}
  catch(error){await writeFile(out+'/main-failure.json',JSON.stringify({group:i,position:p.pos.toArray(),spinTimer:p.spinTimer,spinCooldown:p.spinCd,boxes:boxes.map(b=>({name:source.components[b.mesh.userData.editorIdx]?.nm,alive:b.alive,pending:b.pending,position:b.mesh.position.toArray(),base:b.box.min.y})),tail:r.trace.slice(-50)},null,2));throw error;}
  assert.equal(p.totalDeaths,0);assert.ok(!l.runMode&&!l.timeTrial);
  report.harvests.push({name:prefix,count:5,frames:r.frame-first,deaths:0,fromClearedRoute:true});
  await writeFile(out+'/main-progress.json',JSON.stringify(report,null,2));
 }
 assert.ok(report.maxFloorError<.04);p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));assert.ok(l.enemies.every(e=>e.alive));report.reset={crates:80,enemies:4};
 await writeFile(out+'/main.json',JSON.stringify(report,null,2));console.log('PASS all 80 main rewards through 16 separately staged route approaches, supported footprints and reset');
},{modulePath:'/src/levels/nightworks-after-hours.ts',source:m=>m.NIGHTWORKS_AFTER_HOURS_LEVEL,levelId:'nightworks-after-hours',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:36000});
if(!process.argv.includes('--main-only')){
 let journeyActive=true,ferryContact=false,phaseContact=false;
 await withBlockworksRuntime(async r=>{
  const {p,l,THREE}=r;r.id='bonus-nightworks-after-hours';
  if(process.env.GUPTUS_BONUS_BASELINE_MODULE){
   const before=(await r.server.ssrLoadModule(process.env.GUPTUS_BONUS_BASELINE_MODULE)).CALDERA_BONUS_LEVEL;
   await writeFile(out+'/bonus-baseline.json',JSON.stringify(before));
   assert.equal(JSON.stringify(r.source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components.filter(c=>c.t!=='crate')));
   assert.deepEqual(Object.fromEntries(Object.entries(r.source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
  }
  const positive=runInputPilot(r,runCalderaBonusJourney);journeyActive=false;
  assert.equal(positive.state,'finished');assert.equal(positive.cratesBroken,25);assert.equal(positive.deaths,0);assert.ok(positive.gemEarned);assert.ok(ferryContact&&phaseContact,'actual moving and timed contacts');
  await writeFile(out+'/bonus.json',JSON.stringify({...positive,ferryContact,phaseContact},null,2));
  const box=name=>l.crates.find(b=>r.source.components[b.mesh.userData.editorIdx]?.nm===name),arrow=box('Crucible arrow'),life=box('Crucible high life');
  p.respawn(l,true,false,{position:new THREE.Vector3(29,6.12,0),heading:new THREE.Vector3(0,0,-1)});r.stepFor(25);let held=false;
  r.until(()=>!arrow.alive,()=>{const spin=p.spinning||!held;held=spin;return{...r.steerToward(arrow.mesh.position,{pace:p.spinning?.35:0}),spinHeld:spin};},{maxFrames:600,label:'spend arrow before its high reward'});r.stepFor(40);
  r.walkTo([32,6,0],{pace:.3});r.charge(26);r.releaseJump();
  r.until(()=>p.vVel<.65,{}, {maxFrames:80,label:'reach the ordinary jump apex'});
  r.tick({jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.airJumpUsed&&p.doubleJumpAir,'the second jump must actually fire');let maxFeet=p.pos.y,maxHead=p.crateBodyBox.max.y;
  r.until(()=>p.grounded,()=>{maxFeet=Math.max(maxFeet,p.pos.y);maxHead=Math.max(maxHead,p.crateBodyBox.max.y);return{};},{maxFrames:180,label:'double jump without the arrow'});
  assert.ok(life.alive);assert.ok(maxHead<life.box.min.y);assert.equal(p.totalDeaths,0);
  const dispatch=box('Crucible dispatch crate');assert.ok(dispatch.alive);r.walkTo([34.35,6,0],{pace:.25});r.charge(26);r.releaseJump();
  r.until(()=>!dispatch.alive&&p.vVel>0,()=>r.steerToward(dispatch.mesh.position,{pace:.65}),{maxFrames:180,label:'real stomp on the nearby cargo'});
  const cargoContact=p.pos.toArray();r.until(()=>p.vVel<.65,()=>r.steerToward(life.mesh.position,{pace:.7}),{maxFrames:100,label:'cargo bounce apex'});
  r.tick({...r.steerToward(life.mesh.position,{pace:.7}),jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.airJumpUsed&&p.doubleJumpAir);
  let cargoMaxFeet=p.pos.y,cargoMaxHead=p.crateBodyBox.max.y;
  r.until(()=>p.grounded,()=>{cargoMaxFeet=Math.max(cargoMaxFeet,p.pos.y);cargoMaxHead=Math.max(cargoMaxHead,p.crateBodyBox.max.y);return r.steerToward(life.mesh.position,{pace:.7});},{maxFrames:180,label:'cargo bounce and double jump cannot replace arrow'});
  assert.ok(life.alive);assert.ok(cargoMaxHead<life.box.min.y);assert.equal(p.totalDeaths,0);
  p.respawn(l,true);assert.equal(l.crates.length,25);assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);
  await writeFile(out+'/bonus-negative.json',JSON.stringify({arrowLostHighLifeRemains:true,doubleJumpFired:true,maxFeet,maxHead,cargoContact,cargoMaxFeet,cargoMaxHead,cargoCannotReplaceArrow:true,highLifeBottom:life.box.min.y,all25Restored:true,credit:0},null,2));console.log('PASS continuous 25-box Caldera journey, actual ferry/phase contacts, wrong arrow order, cargo alternative and physical retry');
 },{modulePath:'/src/levels/nightworks-caldera-bonus.ts',source:m=>m.CALDERA_BONUS_LEVEL,levelId:'bonus-nightworks-after-hours',controlFrame:()=>({x:0,z:-1}),maxFrames:14000,onTick:(_row,r)=>{if(!journeyActive)return;ferryContact ||= r.p.grounded&&r.p.groundHit?.moverId!==undefined;phaseContact ||= r.p.grounded&&r.p.pos.x>67.5&&r.p.pos.x<74.5&&Math.abs(r.p.pos.y-6)<.05&&r.l.phasePads[0].on;}});
}
