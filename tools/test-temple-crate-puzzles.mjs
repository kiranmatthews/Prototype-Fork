import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withTempleRuntime} from './temple-test-runtime.mjs';
import {TEMPLE_CRATE_CASES} from './test-jungle-sequel-crates.mjs';
import {runLanternStair} from './temple-embers-pilot.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
const out=process.env.TEMPLE_CRATES_OUTPUT??'/tmp/temple-crates';await mkdir(out,{recursive:true});
await withTempleRuntime(async r=>{
 const {native:n,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE,reports=[];
 const reset=q=>n.p.respawn(n.l,true,false,{position:new THREE.Vector3(...route.toWorld(...q)),heading:new THREE.Vector3(0,0,-1)});
 async function run(name,q,pilot){
  reset(q);r.report={stage:'start',actions:[],evidence:[]};const first=r.frame,tick=r.tick;let actualDoubleJump=false;
  r.tick=sample=>{const result=tick(sample);actualDoubleJump ||= r.p.doubleJumpAir&&r.p.airJumpUsed;return result;};
  try{const gen=pilot(r);let next=gen.next();while(!next.done){r.tick(next.value);next=gen.next();}
   if(name.includes('wrong'))assert.ok(actualDoubleJump,'wrong-order trial must really double jump');
   const result={name,...next.value,frames:r.frame-first,actualDoubleJump};reports.push(result);console.log('PASS',name);
   await writeFile(out+'/puzzles.json',JSON.stringify(reports,null,2));
  }catch(error){await writeFile(out+'/puzzle-failure.json',JSON.stringify({name,error:error.message,report:r.report,trace:n.trace.slice(first)},null,2));throw error;}
  finally{r.tick=tick;}
 }
 for(const [name,index,start,pilot]of TEMPLE_CRATE_CASES)
  await run(name,index?[start[0]+574,start[1]+34.5,start[2]]:start,pilot);
 await run('lantern-stair',[506,34.62,8],r=>runLanternStair(r,puzzleControls(r)));
 await run('lantern-wrong',[520.6,34.62,8],function*(r){
  const c=puzzleControls(r),rewards=r.l.crates.filter(b=>r.source.components.find(s=>s.nm==='Lantern stair: reward for restoring and climbing the steps'&&Math.hypot(s.p[0]-b.mesh.position.x,s.p[2]-b.mesh.position.z)<.5));
  assert.equal(rewards.length,3);const attempts=[];
  for(const timing of [7,3,.5,-1.5]){
   yield* c.stepFor(20);yield* c.walk([520.6,34.5,8],'unrevealed stair approach');yield* c.charge();yield* c.tick({jumpReleased:true});
   yield* c.until(()=>r.p.vVel<=timing,{}, {limit:100,label:'floor jump apex timing'});yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
   const first=r.frame;yield* c.until(()=>r.p.grounded,()=>({...c.steer([523,34.5,8]),jumpHeld:r.p.state==='hang',spinHeld:r.p.pos.y>38.3}),{limit:240,label:'attempt shelf without restoring the metal steps'});
   assert.ok(rewards.every(b=>b.alive));assert.ok(!n.trace.slice(first).some(f=>f.state==='hang'));attempts.push({timing,allRewardsRemain:true});
  }
  assert.ok(r.l.crates.filter(b=>b.metal).every(b=>b.pending));return{attempts,metalStepsStillOutlined:true};
 });
 // The closest new donor is on the neighboring bowl floor, not on the
 // crown court. Try its actual rebound, apex double and clamber in world
 // space so the course's intervening walls participate in the result.
 reset([926.1,69.12,-2.3]);r.report={stage:'crown cargo alternative',actions:[],evidence:[]};
 const c=puzzleControls(r),clear=c.hit(c.crateSpecAt(928,69),'remove the crown arrow before trying the bowl cargo');
 for(const sample of clear)r.tick(sample);
 const spec=b=>n.source.components[b.mesh.userData.editorIdx],donor=n.l.crates.find(b=>spec(b)?.nm==='Ember offering / section 10 / cache 1 / box 4'),cap=n.l.crates.find(b=>spec(b)?.nm==='Crown upper target before destroying its arrow');
 const q=route.toWorld(1107,route.groundAt(1107)+.12,0);n.p.pos.fromArray(q);n.p.state='air';n.p.grounded=false;n.p.speed=n.p.vVel=0;n.p.snapRenderInterpolation();n.stepFor(25);
 const top=donor.box.max.y,startDistance=Math.hypot(cap.mesh.position.x-donor.mesh.position.x,cap.mesh.position.z-donor.mesh.position.z);
 n.charge(26);n.releaseJump();n.until(()=>!donor.alive,()=>n.steerToward(donor.mesh.position,{pace:.65}),{maxFrames:180,label:'stomp the neighboring bowl supply cap'});
 assert.ok(n.p.pos.y>=top-.2&&n.p.vVel>8,'alternative must use a real crate rebound');
 n.until(()=>n.p.vVel<.65,()=>n.steerToward(cap.mesh.position),{maxFrames:100,label:'carry rebound toward the crown'});
 n.tick({jumpHeld:true});n.tick({jumpHeld:false});assert.ok(n.p.doubleJumpAir&&n.p.airJumpUsed);
 n.until(()=>n.p.grounded||n.p.state==='dead',()=>({...n.steerToward(cap.mesh.position),jumpHeld:n.p.state==='hang',spinHeld:n.p.pos.y>74}),{maxFrames:250,allowDeath:true,label:'attempt double-jump and clamber across the bowl wall'});
 assert.ok(cap.alive);reports.push({name:'neighboring-cargo-crown-alternative',startDistance,actualRebound:true,actualDoubleJump:true,capRemains:true,state:n.p.state});
 reset([-14,.12,1.25]);assert.ok(n.l.crates.every(b=>b.alive));assert.ok(n.l.crates.filter(b=>b.bang).every(b=>!b.bangUsed));
 await writeFile(out+'/puzzles.json',JSON.stringify(reports,null,2));console.log('PASS preserved main puzzles, wrong orders, neighboring-cargo alternative and full reset');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',start:[25.9,.12,-2.3],maxFrames:24000});
