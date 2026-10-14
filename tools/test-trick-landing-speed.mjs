import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Ground trick reward',spawn:[0,.12,0],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-200],s:[2000,1,2000]},{t:'gate',p:[800,0,-800]}]};
await withSkateRuntime(async({player:p,level,step,TUNING,server})=>{
 const saved={...TUNING},report=[];const tick=v=>step(makeInput(v));
 const fixture=(boost,park=false)=>{TUNING.trickLandBoost=boost;level.skatepark=park;p.respawn(level,true);p.freeSkate=true;p.speed=20;p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.camDir.set(0,0,-1);};
 function hop(kind='flip'){
  for(let i=0;i<27;i++)tick({jumpHeld:true,moveY:1});tick({jumpReleased:true,moveY:1});assert.equal(p.state,'air');
  const flight=[];
  for(let i=0;i<180;i++){
   flight.push(p.pos.toArray());tick({moveY:1,spinPressed:kind==='flip'&&i===0||kind==='late'&&p.vVel<0&&p.pos.y<.25,
    spinHeld:kind==='flip'&&i===0,grabPressed:kind==='grab'&&i===0,grabHeld:kind==='grab'&&i<4});
   if(p.grounded||p.isBailing)return {flight,speed:p.speed,boost:p.trickSpeedBoost,bail:p.isBailing};
  }throw Error('Landing did not resolve');
 }
 try{
  for(const park of [false,true])for(const kind of ['plain','flip','grab']){
   fixture(0,park);const baseline=hop(kind);fixture(1.25,park);const rewarded=hop(kind);
   assert.deepEqual(rewarded.flight,baseline.flight,'ground reward cannot change the flight that earns it');
   assert.equal(rewarded.bail,false);assert.equal(rewarded.boost,kind==='plain'?0:1.25);
   assert.ok(Math.abs(rewarded.speed-baseline.speed-(kind==='plain'?0:1.25))<1e-7);
   report.push({park,kind,boost:rewarded.boost});
  }
  fixture(1.25);for(const expected of [1.25,2.5,3.75,5,5]){const land=hop();assert.equal(land.bail,false);assert.equal(land.boost,expected);}
  const stacked=p.trickSpeedBoost;for(let i=0;i<120;i++)tick({moveY:1,jumpHeld:true});assert.equal(p.trickSpeedBoost,stacked);
  assert.ok(p.speed>TUNING.maxSpeed+3,'charged ground travel preserves earned stacks');
  for(let i=0;i<360;i++)tick({moveY:1,jumpHeld:true});assert.ok(p.trickSpeedBoost<1e-8,'stacks fade after their hold');
  fixture(1.25);hop();tick({grabPressed:true,grabHeld:true});assert.equal(p.trickSpeedBoost,0,'braking clears the reward');
  fixture(1.25);const late=hop('late');assert.equal(late.boost,0,'unfinished/sketchy landings earn no reward');
  fixture(1.25);hop();p.respawn(level,true);assert.equal(p.trickSpeedBoost,0);
  const {Replayer}=await server.ssrLoadModule('/src/replay.ts');const replay=new Replayer();
  replay.begin({v:2,name:'old',level:'test',date:'old',tuning:{},tuningChanges:[],mx:[0],my:[0],b:[0],frames:1,truncated:false});
  assert.equal(TUNING.trickLandBoost,0,'legacy replays do not acquire a new reward');replay.end();assert.equal(TUNING.trickLandBoost,1.25);
  console.log(JSON.stringify({pass:true,landings:report,stackCap:5,plainAndFailureGuards:true,decay:true,brakeReset:true,replayCompatibility:true}));
 }finally{Object.assign(TUNING,saved);}
},{levelEntry:{id:'ground-trick-reward',name:data.name,data}});
