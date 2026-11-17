import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const report={};
await withThemedBonusRuntime('test',r=>{
 report.earlySpin=runInputPilot(r,runThemedBonusWrongOrder);assert.equal(r.p.state,'dead');
},{start:[1,.12,0]});
await withThemedBonusRuntime('test',r=>{
 const {p,l,THREE}=r,named=name=>l.crates.find(b=>r.source.components[b.mesh.userData.editorIdx]?.nm===name),reward=named('Room 1 fuse: upper cap before fuse');
 const reset=(x=2)=>{p.respawn(l,true,false,{position:new THREE.Vector3(x,.12,0),heading:new THREE.Vector3(1,0,0)});r.stepFor(20);};
 // Isolated reach fixture, separate from the real early-spin death above.
 const missingDonor=()=>{reset();l.breakCrate(named('Room 1 fuse: timed support'),true);l.breakCrate(named('Room 1 fuse: wooden takeoff cap'),true);r.stepFor(120);assert.ok(reward.alive);};
 const attempt=()=>{let maxContact=-Infinity;
  r.until(()=>p.vVel<.65,()=>{maxContact=Math.max(maxContact,p.crateBodyBox.max.y);return {...r.steerToward([8,9,0]),spinHeld:r.frame%18<9};},{maxFrames:120,label:'lost donor reward approach'});
  r.tick({});r.tick({jumpHeld:true});r.tick({jumpReleased:true});
  r.until(()=>p.grounded,()=>{maxContact=Math.max(maxContact,p.crateBodyBox.max.y);return {...r.steerToward([8,0,0]),spinHeld:r.frame%18<9};},{maxFrames:240,label:'ordinary double recovery'});
  return {maxContact,rewardBase:reward.box.min.y,rewardAlive:reward.alive};
 };
 missingDonor();r.walkTo([8,0,0]);r.charge();r.releaseJump();report.floorWithoutDonor=attempt();
 missingDonor();const top=named('Room 1 fuse: refuge reward · upper 2');p.pos.set(top.mesh.position.x,top.box.max.y+.8,0);p.grounded=false;p.state='air';p.vVel=-1;p.snapRenderInterpolation();
 r.until(()=>!top.alive&&p.vVel>10,{jumpHeld:true},{maxFrames:100,label:'fixture stomp on neighboring cargo'});report.neighborWithoutDonor=attempt();
 reset(35);r.charge();r.releaseJump();r.until(()=>p.state==='dead',()=>r.steerToward([43,0,0]),{allowDeath:true,maxFrames:400,label:'skip the bridge switch'});report.skippedSwitch={state:p.state,position:p.pos.toArray()};
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(l.crates.filter(b=>b.pending).length,3);assert.ok(l.outlinedSurfaces.every(s=>!s.active));report.retryRestores=true;
},{controlFrame:()=>({x:0,z:-1}),maxFrames:6000});
await writeFile(process.env.AMBUSH_ORDER_OUTPUT||'/tmp/ambush-crate-order.json',JSON.stringify(report,null,2)+'\n');console.log('Quayside order',JSON.stringify(report));
assert.ok(report.floorWithoutDonor.rewardAlive&&report.neighborWithoutDonor.rewardAlive,'lost TNT must strand the high life');
