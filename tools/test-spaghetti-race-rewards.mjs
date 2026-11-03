import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-race-rewards';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const C=r.sourceModule.SPAGHETTI_RAILS_LEVEL.components;
 const {raceDeckY}=await r.server.ssrLoadModule('/src/levels/spaghetti-race-world.ts');
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const data=r.sourceModule.SPAGHETTI_RAILS_LEVEL;
 assert.ok(normalizeCustomLevelData(data));
 for(const patch of [{rivalSkill:'robot'},{grindBalanceScale:0},{grindBalanceScale:Infinity},{itemRespawnSeconds:0},{itemRespawnSeconds:Infinity},{itemPool:'random'},{itemPool:'rail',vehicle:'golf-cart'}])
  assert.equal(normalizeCustomLevelData({...data,skateRace:{...data.skateRace,...patch}}),null);
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'spaghetti-rails');race.start('time-trial',270327);race.phase='running';
 const report={boxes:r.l.crates.filter(c=>c.mystery).length,special:{},pickups:[],springs:[]};
 const tuning=JSON.stringify(r.TUNING);
 let command=0,filledAt=null;
 for(let frame=0;frame<2400;frame++){
  const input=race.drive(0);
  if(r.p.specialReady&&r.p.state==='grind'&&!command){filledAt=race.elapsed;command=1;}
  if(command===1){Object.assign(input,{moveX:-1,moveY:0,grindHeld:false,grindPressed:false});command=2;}
  else if(command===2){Object.assign(input,{moveX:1,moveY:0,grindHeld:true,grindPressed:true});command=3;}
  r.scene.updateMatrixWorld(true);race.step(r.dt,input);
  if(r.p.specialSequence>0)break;
 }
 report.special={filledAt,meter:r.p.specialMeter,ready:r.p.specialReady,activations:r.p.specialSequence,trick:r.p.activeSpecialName};
 assert.notEqual(filledAt,null,'Ordinary race grinding fills SPECIAL');
 assert.equal(r.p.activeSpecialName,'Darkslide','Earned SPECIAL accepts the real two-direction grind command');
 assert.ok(r.p.specialSequence>0);
 assert.ok(report.boxes>500,'Frequent pickups span the whole network');
 // Collect the new roulette item through real contact, then deliberately
 // hold the wrong balance input for its entire six-second window.
 Object.defineProperty(race,'count',{get:()=>1});race.start('race',270327);race.phase='running';
 let granted=false,steadyFrames=0,expired=false,drifted=false,balanceItemAt=null;
 for(let frame=0;frame<3000;frame++){
  const input=race.drive(0),held=race.riders[0].item;
  input.itemPressed=!granted&&!!held;
  if(held==='perfect-balance'&&!granted&&r.p.state==='grind'){
   const special=r.p.specialMeter;
   assert.ok(race.useItem());assert.equal(r.p.specialMeter,special,'Balance never grants Special');
   assert.equal(r.p.balanceBoostT,6);granted=true;balanceItemAt=race.elapsed;input.itemPressed=false;
  }else if(held==='perfect-balance')input.itemPressed=false;
  if(granted)input.moveX=1;
  const before=r.p.balanceBoostT;
  r.scene.updateMatrixWorld(true);race.step(r.dt,input);
  assert.ok(Math.abs(race.hud().speedKmh-Math.hypot(race.riders[0].velocity.x,race.riders[0].velocity.z)*3.6)<.001);
  if(granted&&r.p.state==='grind'&&before>r.dt+.0001){assert.equal(r.p.balance,0);steadyFrames++;}
  if(granted&&r.p.balanceBoostT===0){expired=true;if(Math.abs(r.p.balance)>.03){drifted=true;break;}}
 }
 report.balance={collectedAt:balanceItemAt,steadyFrames,expired,drifted};
 assert.ok(granted&&steadyFrames>300&&expired&&drifted,'Perfect balance lasts six seconds, then normal balance returns');
 race.reset('time-trial');assert.equal(r.p.balanceBoostT,0,'Restart clears an active balance item');
 for(let tier=1;tier<=6;tier++){
  race.reset('time-trial');race.phase='running';
  const c=C.find(c=>c.nm?.startsWith(`Rail item / Recovery weave / tier ${tier} /`));
  const box=r.l.crates.find(b=>b.mesh.userData.editorIdx===C.indexOf(c));assert.ok(box);
  const railName=c.nm.slice('Rail item / '.length).replace(/ \/ \d+$/,'');
  const rail=r.l.rails.find(r=>r.object.userData.sourceName===railName);assert.ok(rail);
  const closest=rail.closest(new r.THREE.Vector3(c.p[0],c.p[1]+.9,c.p[2]));
  assert.ok(closest.distance<.01);
  const position=rail.pointAt(closest.t-6).add(new r.THREE.Vector3(0,.35,0));
  r.p.resetRacePosition(r.l,position,rail.tangentAt(closest.t-6));r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=22;
  let previous={},collectedAt=null,used=false,returnedAt=null,caught=false;
  for(let frame=0;frame<360;frame++){
   const input=normalizeGameInput({moveY:1,moveX:r.p.state==='grind'?Math.max(-1,Math.min(1,-r.p.balance*3-r.p.balanceVel*.45)):0,
    grindHeld:true,itemPressed:!!race.riders[0].item},previous);previous=input;
   const before=race.riders[0].item;
   r.scene.updateMatrixWorld(true);race.step(r.dt,input);
   if(r.p.grindRail===rail)caught=true;
   if(!box.alive&&collectedAt===null)collectedAt=race.elapsed;
   if(before&&!race.riders[0].item)used=true;
   if(collectedAt!==null&&box.alive){returnedAt=race.elapsed;break;}
  }
  report.pickups.push({tier,caught,collectedAt,used,returnedAt,position:box.mesh.position.toArray()});
  assert.ok(caught&&collectedAt!==null&&used,`Tier ${tier}: actual rail travel must collect and use an item`);
  assert.ok(returnedAt-collectedAt>=1.45&&returnedAt-collectedAt<1.6,'Boxes return for the following racers');
 }
 for(const c of C.filter(c=>c.t==='trampoline')){
  const number=c.nm.split(' / ').at(-1),receiver=r.sourceModule.SPAGHETTI_RACE_ISLANDS.find(s=>s.name==='Race spring prize / '+number);assert.ok(receiver);
  race.reset('time-trial');race.phase='running';
  r.p.resetRacePosition(r.l,new r.THREE.Vector3(c.p[0],c.p[1]+1,c.p[2]+4),new r.THREE.Vector3(0,0,-1));
  r.p.state='air';r.p.grounded=false;r.p.vVel=-2;r.p.speed=20;
  let launched=false,peak=c.p[1],previous={},frames=0;const samples=[];
  for(;frames<360;frames++){
   const input=normalizeGameInput({...r.steerToward(receiver.p),jumpHeld:true},previous);previous=input;
   r.scene.updateMatrixWorld(true);race.step(r.dt,input);
   peak=Math.max(peak,r.p.pos.y);if(r.p.vVel>12)launched=true;
   if(frames%6===0)samples.push({p:r.p.pos.toArray(),state:r.p.state,bail:r.p.skateCameraBailing,hit:r.p.groundHit?.name,rim:r.p.groundHit?.trampolineRim,vy:r.p.vVel});
   if(launched&&r.p.grounded)break;
  }
  report.springs.push({name:c.nm,launched,rise:peak-c.p[1],landing:r.p.pos.toArray(),frames});
  await writeFile(output+'/progress.json',JSON.stringify({...report,samples},null,2));
  assert.ok(launched&&r.p.grounded&&Math.abs(r.p.pos.y-raceDeckY(receiver,r.p.pos.z))<.15&&Math.abs(r.p.pos.x-receiver.p[0])<receiver.w/2&&Math.abs(r.p.pos.z-receiver.p[2])<receiver.d/2,'Race spring reaches its useful forward receiver: '+JSON.stringify(report.springs.at(-1)));
 }
 assert.equal(JSON.stringify(r.TUNING),tuning);
 await writeFile(output+'/rewards.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
