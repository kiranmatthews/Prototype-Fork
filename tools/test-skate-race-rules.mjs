import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const fixture={v:1,name:'Race rules fixture',spawn:[0,.1,15],killY:-12,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-45],s:[30,1,150]},
 {t:'crate',kind:'mystery',p:[0,0,-10]}, {t:'crate',kind:'empty',p:[4,0,-10]},
 {t:'crate',kind:'tnt',p:[-4,0,-10]}, {t:'crate',kind:'nitro',p:[8,0,-10]},
 {t:'gate',p:[0,0,-100]}, {t:'camnode',p:[0,0,15]}, {t:'camnode',p:[0,0,-120]}],
 skateRace:{v:1,racers:8,seed:19,line:[[0,0,15,30],[0,0,-100,30]],jumps:[],finishWidth:28,originalLength:86.4661654135}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {HudVisibilityState}=await r.server.ssrLoadModule('/src/hudVisibility.ts');
 const {CampaignStore}=await r.server.ssrLoadModule('/src/campaign.ts');
 const registry=await r.server.ssrLoadModule('/src/level.ts');
 const campaign=new CampaignStore();campaign.startEphemeral();const id='slipstream-race';
 const race=new SkateRace(r.scene,r.p,false,levelId=>campaign.runModesUnlocked(levelId));race.attach(r.l,id);
 assert.equal(race.hud().timeTrialUnlocked,false);
 race.start('time-trial');assert.equal(race.phase,'grid');assert.equal(race.mode,'race');
 race.reset('time-trial');assert.equal(race.mode,'race');assert.equal(r.p.ttActive,false);
 race.step(r.dt,{raceTrialStartPressed:true});assert.equal(race.phase,'grid');assert.equal(race.mode,'race');
 race.start('race');race.phase='running';
 const input={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinPressed:false,grindHeld:false,itemPressed:false};
 const tick=(n=1)=>{for(let i=0;i<n;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,input);}};
 assert.ok(registry.normalizeCustomLevelData(fixture));
 for(const patch of [{racers:9},{finishWidth:-1},{line:[[0,0,0,0]]},{seed:NaN},{jumps:[{takeoff:[0,0,0],landing:[Infinity,0,0]}]}])assert.equal(registry.normalizeCustomLevelData({...fixture,skateRace:{...fixture.skateRace,...patch}}),null);
 for(const id of ['slip','slipstream-continuous','slipstream-2','astra-chimeworks'])assert.equal(registry.findLevel(id).id,'slipstream-race');
 assert.equal(r.l.checkpoints.length,0);assert.equal(r.l.crystalPickup,null);assert.equal(r.l.clockPickup,null);assert.ok(r.l.startWarpPosition==null);
 assert.ok(!r.l.groundMeshes.some(m=>m.userData.finishPad));
 const oldLives=r.p.lives,oldDeaths=r.p.totalDeaths,oldFruit=r.p.fruit;
 // Every actor gets independent credit; an AI opening a box cannot award the human.
 const [item,empty,tnt,nitro]=r.l.crates;
 r.l.raceActorId=1;r.l.breakCrate(item);assert.ok(race.riders[1].item);assert.equal(race.riders[0].boxes.size,0);
 r.l.reviveRaceCrate(item,race.homes.get(item));r.l.raceActorId=0;r.l.breakCrate(item);assert.ok(race.riders[0].item);assert.equal(race.riders[0].boxes.size,0);
 r.l.reviveRaceCrate(item,race.homes.get(item));r.l.breakCrate(item);assert.equal(race.riders[0].boxes.size,0);
 r.l.breakCrate(empty);assert.equal(race.riders[0].boxes.size,1);assert.equal(r.p.fruit,oldFruit);
 // Shields consume one hit; contact hazards and explosives use an intact recovery.
 const human=race.riders[0];r.p.invulnTimer=0;human.shield=0;human.knockGrace=0;human.item='shield';assert.ok(race.useItem());
 r.p.raceHooks.hazard('blast');assert.equal(human.shield,0);assert.equal(r.p.skateCameraBailing,false);
 human.knockGrace=0;r.p.invulnTimer=0;r.p.raceHooks.hazard('blast');assert.equal(r.p.skateCameraBailing,true);assert.ok(!r.p.breakApart?.active);
 for(let frame=0;frame<600&&r.p.skateCameraBailing;frame++)tick();
 assert.equal(r.p.skateCameraBailing,false,'intact recovery must settle within ten seconds');assert.equal(r.p.boardRolling,false,'A recovered racer must remain on foot until choosing to remount');
 // Falling returns to the last supported centre, with world and tally intact.
 // The longer physical recovery can cross the ordinary crate refill timer.
 // Start this independent fall/reset check with a freshly broken crate.
 r.l.reviveRaceCrate(empty,race.homes.get(empty));r.l.raceActorId=0;r.l.breakCrate(empty);
 const anchor=human.anchor.clone(),elapsed=race.elapsed,boxes=human.boxes.size;
 r.p.pos.y=r.l.killY-1;r.p.state='air';r.p.grounded=false;tick();assert.ok(human.recovery>0);while(human.recovery>0)tick();
 assert.ok(r.p.pos.distanceTo(anchor)<1);assert.ok(race.elapsed>=elapsed+r.CONST.respawnDelay+r.CONST.deathWatchTime);assert.equal(human.boxes.size,boxes);assert.equal(empty.alive,false);
 // Real item actors create and resolve their collision fields.
 human.item='shock-shell';human.knockGrace=0;r.p.speed=0;race.riders[1].item=null;race.riders[1].itemCooldown=1000;race.riders[1].player.invulnTimer=0;race.riders[1].knockGrace=0;
 race.riders[1].player.resetRacePosition(r.l,r.p.pos.clone().add(new r.THREE.Vector3(2,0,0)),new r.THREE.Vector3(0,0,-1));race.riders[1].player.invulnTimer=0;race.riders[1].progress=race.course.project(race.riders[1].player.pos).s;race.riders[1].recovery=0;race.riders[1].shield=0;
 const normalDrive=race.drive;race.drive=()=>input;assert.ok(race.useItem());tick(100);race.drive=normalDrive;assert.ok(race.riders[1].player.skateCameraBailing);
 human.item='banana';assert.ok(race.useItem());human.item='red-shell';assert.ok(race.useItem());human.item='mushroom';assert.ok(race.useItem());assert.ok(human.boost>0);
 assert.equal(r.p.totalDeaths,oldDeaths);assert.equal(r.p.lives,oldLives);assert.equal(r.p.fruit,oldFruit);
 // Real spin and descending-foot contacts knock the opponent off their board.
 const duel=(stomp=false)=>{
  race.reset('race');race.phase='running';
  for(const a of race.riders){const at=new r.THREE.Vector3(a.id<2?0:10,0,a.id<2?0:-25-a.id*4);if(a.id===0){at.x=stomp?0:-1.2;at.y=stomp?2:0;}
   a.player.resetRacePosition(r.l,at,new r.THREE.Vector3(0,0,-1));a.player.invulnTimer=0;a.progress=race.course.project(at).s;a.knockGrace=0;}
  if(stomp){r.p.state='air';r.p.grounded=false;r.p.vVel=-6;}else input.spinPressed=true;
  tick();input.spinPressed=false;assert.ok(race.riders[1].player.skateCameraBailing,stomp?'stomp contact':'spin contact');
  if(stomp)assert.ok(r.p.vVel>0,'stomp rebounds the attacking rider');
 };
 duel();duel(true);
 // Completing all unique boxes awards the gem in the actual result payload.
 tnt.raceOwner=7;tnt.fuse=1;
 race.reset('race');assert.equal(tnt.raceOwner,undefined,'A retry must clear the previous explosive owner');race.phase='running';let wonResult=null;race.onFinish=v=>wonResult=v;r.l.raceActorId=0;
 for(const box of r.l.crates){if(box.nitro||box.tnt)r.l.detonate(box);else r.l.breakCrate(box);}
 assert.equal(race.riders[0].boxes.size,r.l.totalCrates);
 r.p.resetRacePosition(r.l,new r.THREE.Vector3(0,0,-100.1),new r.THREE.Vector3(0,0,-1));race.riders[0].progress=114;tick();
 assert.ok(wonResult?.won);assert.ok(wonResult?.boxGem);
 assert.equal(campaign.runModesUnlocked(id),false);
 campaign.commitClear(id,{crystal:true,boxGem:true,comboGem:true});assert.equal(campaign.levelProgress(id).crystal,false);
 campaign.commitRaceResult(id,{won:false,boxGem:true});assert.equal(campaign.levelProgress(id).crystal,false);assert.equal(campaign.levelProgress(id).boxGem,true);
 assert.equal(campaign.runModesUnlocked(id),false);assert.equal(race.hud().timeTrialUnlocked,false);
 campaign.commitRaceResult(id,{won:true,boxGem:false});assert.equal(campaign.levelProgress(id).crystal,true);assert.equal(campaign.levelProgress(id).raceWon,true);
 assert.equal(campaign.runModesUnlocked(id),true);assert.equal(race.hud().timeTrialUnlocked,true);
 // A real crossing finishes the solo trial without a crystal award.
 race.reset('time-trial');race.phase='running';race.riders[0].progress=114;r.p.pos.set(0,0,-100.1);tick();assert.equal(race.phase,'finished');assert.equal(r.p.hasCrystal,false);
 const hud=new HudVisibilityState().update({mode:'race',fruitCollectionRevision:99,inventoryHeld:true,hasEarnedRelic:true,nowMs:1});assert.ok(Object.values(hud).every(v=>v===false));
 const {Recorder,Replayer,isReplayFile}=await r.server.ssrLoadModule('/src/replay.ts');
 const tuningBefore=JSON.stringify(r.TUNING),recorder=new Recorder();recorder.start('slipstream-race');
 recorder.record({...input,itemPressed:true,raceTrialStartPressed:true});const take=recorder.export();assert.ok(isReplayFile(take));
 const replay=new Replayer();replay.begin(take);const decoded={};assert.ok(replay.feed(decoded));replay.end();
 assert.equal(decoded.raceTrialStartPressed,true);assert.equal(decoded.itemPressed,true);assert.equal(decoded.raceStartPressed,false);assert.equal(JSON.stringify(r.TUNING),tuningBefore);
 race.reset('race');race.step(r.dt,decoded);assert.equal(race.mode,'time-trial');assert.equal(race.phase,'countdown');
 // View culling must never suspend the other seven simulations.
 race.reset('race');race.phase='running';
 const camera=new r.THREE.PerspectiveCamera(50,16/9,.1,400);camera.position.set(0,5,-180);camera.lookAt(0,5,-220);race.updateView(camera);
 assert.ok(race.riders.slice(1).every(a=>!a.scene.visible));const positions=race.riders.slice(1).map(a=>a.player.pos.clone());tick(120);
 assert.ok(race.riders.slice(1).every((a,i)=>a.player.pos.distanceTo(positions[i])>1),'Off-camera rivals must keep moving');
 console.log('PASS race schema, old links, per-rider crates, shields, nonfatal stun, return delay, item fields, finish crossing, time trial, HUD and win-only awards');
}, {modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'race-fixture'});
