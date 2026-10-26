import assert from 'node:assert/strict';
import {withBlockworksRuntime, normalizeGameInput} from './blockworks-runner.mjs';

// Keep a legacy collectible box in this fixture deliberately: winning must be
// the only route to the gem even when an old editor save still has blank crates.
const fixture={v:1,name:'Rally winner reward',spawn:[0,.1,15],killY:-20,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-45],s:[40,1,160]},
 {t:'crate',kind:'mystery',p:[-8,0,-20]}, {t:'crate',kind:'empty',p:[8,0,-20]},
 {t:'gate',p:[0,0,-100]}, {t:'camnode',p:[0,0,15]}, {t:'camnode',p:[0,0,-120]}],
 skateRace:{v:1,racers:8,seed:19,gemReward:'win',line:[[0,0,15,40],[0,0,-100,40]],jumps:[],finishWidth:34,originalLength:115}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {CampaignStore,campaignLevelById}=await r.server.ssrLoadModule('/src/campaign.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {COCONUT_CART_RALLY_LEVEL:rally}=await r.server.ssrLoadModule('/src/levels/coconut-cart-rally.ts');
 assert.equal(normalizeCustomLevelData(fixture).skateRace.gemReward,'win','Editor round-trip retains the winner objective');
 for(const gemReward of ['all','first',true,1])assert.equal(normalizeCustomLevelData({...fixture,skateRace:{...fixture.skateRace,gemReward}}),null);
 assert.equal(rally.skateRace.gemReward,'win');
 assert.equal(rally.components.filter(c=>c.t==='crate'&&c.kind==='empty').length,0,'No small gem crates remain on the rally course');
 assert.ok(rally.components.some(c=>c.t==='crate'&&c.kind==='mystery'),'Weapon pickups remain on the course');
 assert.equal(campaignLevelById('coconut-cart-rally').gemReward,'win');
 assert.equal(campaignLevelById('slipstream-race').gemReward,undefined,'Other race objectives are unchanged');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'coconut-cart-rally');
 const tick=()=>{r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput());};
 const cross=id=>{const rider=race.riders[id];rider.player.resetRacePosition(r.l,new r.THREE.Vector3(id?3:0,0,-100.1),new r.THREE.Vector3(0,0,-1));rider.progress=114;tick();};
 const campaign=new CampaignStore();campaign.startEphemeral();const results=[];
 const run=(mode,{lose=false,allBoxes=false}={})=>{
  race.start(mode,19);race.phase='running';race.elapsed=10;let result;
  race.onFinish=value=>result=value;
  if(allBoxes){r.l.raceActorId=0;for(const crate of r.l.crates)r.l.breakCrate(crate);assert.equal(race.riders[0].boxes.size,r.l.totalCrates);}
  assert.equal(r.p.gemEarned,false,'Crate completion never grants the rally gem during the race');
  if(lose){cross(1);assert.equal(race.riders[1].finish!==null,true);assert.equal(result,undefined,'A rival crossing cannot award the player');}
  cross(0);assert.equal(race.phase,'finished');assert.ok(result);
  assert.equal(result.boxGem,mode==='race'&&!lose);assert.equal(r.p.gemEarned,result.boxGem);
  assert.equal(race.hud().gemReward,'win');assert.equal(race.hud().won,result.won);
  results.push(result);return result;
 };
 const lost=run('race',{lose:true,allBoxes:true});
 campaign.commitRaceResult('coconut-cart-rally',lost);
 assert.equal(campaign.levelProgress('coconut-cart-rally').boxGem,false);
 campaign.commitRaceResult('coconut-cart-rally',{won:false,boxGem:true});
 assert.equal(campaign.levelProgress('coconut-cart-rally').boxGem,false,'Stale crate-based callers cannot persist a losing gem');
 const trial=run('time-trial',{allBoxes:true});assert.equal(trial.won,false);assert.equal(trial.boxGem,false);
 const won=run('race');assert.equal(won.boxes,0);assert.equal(won.totalBoxes,1);assert.equal(won.won,true);
 campaign.commitRaceResult('coconut-cart-rally',{won:true,boxGem:false});
 assert.equal(campaign.levelProgress('coconut-cart-rally').boxGem,true,'Winning persists the gem independently of old box payloads');
 assert.equal(campaign.runModesUnlocked('coconut-cart-rally'),true);
 campaign.commitRaceResult('coconut-cart-rally',{won:false,boxGem:false});
 assert.equal(campaign.levelProgress('coconut-cart-rally').boxGem,true,'Later losses preserve an earned gem');
 campaign.commitRaceResult('slipstream-race',{won:false,boxGem:true});
 assert.equal(campaign.levelProgress('slipstream-race').boxGem,true,'Ordinary skate races retain their all-box gem');
 race.attach({skateRace:null},'flats');
 console.log('PASS rally win-only gem: actual winning/losing/trial crossings, old crates, campaign persistence, unchanged skate-race rewards, source pickups and editor schema',JSON.stringify(results));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'coconut-cart-rally'});
