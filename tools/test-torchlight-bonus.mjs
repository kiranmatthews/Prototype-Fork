import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney,runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const out=process.env.TORCHLIGHT_OUTPUT??'/tmp/torchlight-crates';await mkdir(out,{recursive:true});
await withThemedBonusRuntime('bonus-nightworks',async r=>{
 const {p,l,THREE}=r;
 if(process.env.TORCHLIGHT_BONUS_BASELINE){
  const before=JSON.parse(await readFile(process.env.TORCHLIGHT_BONUS_BASELINE,'utf8')).data;
  assert.equal(JSON.stringify(r.source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components.filter(c=>c.t!=='crate')));
  assert.deepEqual(Object.fromEntries(Object.entries(r.source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
 }
 assert.equal(l.totalCrates,20);
 if(!process.argv.includes('--negative-only')){
  let positive;
  try{positive=runInputPilot(r,runThemedBonusJourney);}
  catch(error){await writeFile(out+'/bonus-failure.json',JSON.stringify({error:error.message,report:r.report,trace:r.trace},null,2));throw error;}
  assert.equal(positive.state,'finished');assert.equal(positive.cratesBroken,20);assert.equal(positive.deaths,0);assert.ok(positive.gemEarned);
  await writeFile(out+'/bonus.json',JSON.stringify(positive,null,2));
 }
 const reset=(position)=>{p.respawn(l,true,false,position?{position:new THREE.Vector3(...position),heading:new THREE.Vector3(0,0,-1)}:undefined);};
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);
 reset([1,.12,0]); // Stage beyond the arrival delivery for this isolated wrong-order attempt.
 const fuse=runInputPilot(r,runThemedBonusWrongOrder);assert.equal(p.state,'dead');
 await writeFile(out+'/bonus-wrong-fuse.json',JSON.stringify(fuse,null,2));
 reset([27,.12,0]);r.course={...r.course,rooms:[r.course.rooms[1]]};
 let doubleJumpObserved=false;const originalTick=r.tick;
 r.tick=sample=>{const result=originalTick(sample);doubleJumpObserved ||= p.airJumpUsed&&p.doubleJumpAir;return result;};
 const arrow=runInputPilot(r,runThemedBonusWrongOrder);
 r.tick=originalTick;assert.ok(doubleJumpObserved);arrow.actualDoubleJumpFired=true;
 await writeFile(out+'/bonus-wrong-arrow.json',JSON.stringify(arrow,null,2));
 // A real cargo rebound plus an apex double jump must not replace the TNT
 // stack's extra height. The actual animated head controls ordinary bonks.
 reset([18.8,.12,0]);r.stepFor(25);
 const box=name=>l.crates.find(b=>r.source.components[b.mesh.userData.editorIdx]?.nm===name);
 const donor=box('Fuse Store cargo / refuge / 2'),cap=box('Room 1 fuse: upper cap before fuse');
 r.charge(26);r.releaseJump();
 r.until(()=>!donor.alive&&p.vVel>0,()=>r.steerToward(donor.mesh.position,{pace:.65}),{maxFrames:180,label:'stomp ordinary refuge cargo'});
 const contact=p.pos.toArray();r.until(()=>p.vVel<.65,{}, {maxFrames:100,label:'ordinary cargo rebound apex'});
 r.tick({jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.doubleJumpAir&&p.airJumpUsed);
 let maxHead=p.crateBodyBox.max.y,maxFeet=p.pos.y;
 r.until(()=>p.grounded,()=>{maxHead=Math.max(maxHead,p.crateBodyBox.max.y);maxFeet=Math.max(maxFeet,p.pos.y);return r.steerToward([20,0,0],{pace:.35});},{maxFrames:200,label:'ordinary cargo cannot replace timed stack'});
 assert.ok(cap.alive);assert.ok(maxHead<cap.box.min.y);
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);
 await writeFile(out+'/bonus-reset.json',JSON.stringify({countedCrates:20,physicalCrates:l.crates.length,allRestored:true,credit:0,cargoContact:contact,doubleJumpFired:true,maxFeet,maxHead,requiredCapBottom:cap.box.min.y,cargoCannotReplaceFuse:true},null,2));
 console.log(process.argv.includes('--negative-only')?'PASS Fuse Store wrong orders, observed double jumps, cargo exclusion and full retry':'PASS continuous 20-box Fuse Store, both wrong orders, real cargo double-jump exclusion and full retry');
},{maxFrames:16000});
