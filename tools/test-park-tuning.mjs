import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,Player,Level,scene,TUNING,CONST})=>{
 const {TUNING_RANGES,TUNING_INFO,TUNING_SECTIONS}=await server.ssrLoadModule('/src/tuning.ts');
 const {parkCruiseSpeed,parkChargedSpeed}=await server.ssrLoadModule('/src/skateParkTuning.ts');
 const {speedSkateFovTarget}=await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
 const defaults={...TUNING},keys=Object.keys(TUNING).filter(k=>k.startsWith('park'));
 for(const key of keys){const r=TUNING_RANGES[key];assert.ok(TUNING_INFO[key]);assert.equal(TUNING_SECTIONS.flatMap(s=>s.keys).filter(k=>k===key).length,1);assert.ok(Math.abs((TUNING[key]-r.min)/r.step-Math.round((TUNING[key]-r.min)/r.step))<1e-7,key+' default off slider steps');}
 const course=new Level(scene,{id:'future-freecam-test',name:'Future skate park',data:{skatepark:true,spawn:[0,.1,100],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[600,1,600]}]}});
 scene.updateMatrixWorld(true);const p=new Player(scene);p.endlessDeaths=true;const step=input=>{p.step(CONST.fixedStep,input,course);input.consumeEdges();};
 function reset(park=true){course.skatepark=park;p.competitionMode=false;p.rawInput=makeInput();p.respawn(course,true,true,{position:new THREE.Vector3(0,.1,100),heading:new THREE.Vector3(0,0,-1)});p.freeSkate=true;p.speed=park?0:12;p.groundHit=p.queryGround(course);p.rideNormal.copy(p.groundHit.normal);step(makeInput());}
 function motor(park,charged,frames){reset(park);const input=makeInput({jumpHeld:charged,jumpPressed:charged});for(let i=0;i<frames;i++)step(input);return p.speed;}
 function ollie(park,hold=.25){reset(park);p.speed=12;const input=makeInput({jumpHeld:true,jumpPressed:true});for(let i=0;i<Math.round(hold/CONST.fixedStep);i++)step(input);const y=p.pos.y;step(makeInput({jumpReleased:true}));assert.equal(p.state,'air');const initial=p.vVel;let peak=p.pos.y,t=0;for(let i=0;i<200&&!p.grounded;i++){step(makeInput());peak=Math.max(peak,p.pos.y);t+=CONST.fixedStep;}assert.ok(p.grounded,'ollie did not land');assert.equal(p.isBailing,false);return {height:peak-y,time:t,initial};}
 const normalSpeed=[motor(false,false,100),motor(false,true,100)],normalJump=ollie(false,.5);
 assert.ok(normalSpeed[0]>10&&normalSpeed[1]>20, `platform fixture did not skate: ${normalSpeed}`);
 const baseCruise=motor(true,false,100),baseCharge=motor(true,true,100),baseJump=ollie(true);
 assert.ok(Math.abs(baseCruise-11.303)<.02);assert.ok(Math.abs(baseCharge-15.3289)<.02);
 TUNING.parkCruiseSpeedScale=1.2;TUNING.parkChargeSpeedScale=1.6;TUNING.parkAccelerationScale=1.4;
 assert.ok(motor(true,false,100)>baseCruise*1.19);assert.ok(motor(true,true,100)>baseCharge*1.59);
 assert.deepEqual([motor(false,false,100),motor(false,true,100)],normalSpeed,'park speed edits changed platforming');
 Object.assign(TUNING,defaults);const slow=motor(true,true,12);TUNING.parkAccelerationScale=2;assert.ok(motor(true,true,12)>slow*1.7,'acceleration slider ineffective');
 Object.assign(TUNING,defaults);TUNING.parkOllieHeight=1.5;const high=ollie(true);assert.ok(Math.abs(high.height/baseJump.height-1.5)<.03);assert.ok(Math.abs(high.time-baseJump.time)<.035,'height changed hangtime');
 TUNING.parkOllieHangtime=1.5;const float=ollie(true);assert.ok(Math.abs(float.height-high.height)<.06);assert.ok(Math.abs(float.time/baseJump.time-1.5)<.08);
 assert.deepEqual(ollie(false,.5),normalJump,'park ollie edits changed platforming');
 Object.assign(TUNING,defaults);TUNING.parkOllieChargeTime=.8;const half=ollie(true,.4),full=ollie(true,.85);assert.ok(full.initial>half.initial+.8,'charge duration capped by platform .4 s');assert.ok(Math.abs(full.height-baseJump.height)<.04);
 // Every speed profile gets its complete camera zoom, without platform endpoints.
 for(const [cruise,charge] of [[1,1],[1.2,1.6],[2,.5]]){TUNING.parkCruiseSpeedScale=cruise;TUNING.parkChargeSpeedScale=charge;assert.equal(speedSkateFovTarget(parkCruiseSpeed(),true,parkCruiseSpeed(),parkChargedSpeed(),6),0);if(parkChargedSpeed()>parkCruiseSpeed())assert.equal(speedSkateFovTarget(parkChargedSpeed(),true,parkCruiseSpeed(),parkChargedSpeed(),6),6);}
 // Vert launch velocity/gravity must ignore all ordinary-ollie settings.
 reset();p.rideNormal.set(0,0,-1);p.parkVelocity.set(0,18,0);p.startParkAir(true,3);const vert=[p.vVel,p.parkFlightGravity];TUNING.parkOllieHeight=3;TUNING.parkOllieHangtime=2;p.parkVelocity.set(0,18,0);p.startParkAir(true,3);assert.deepEqual([p.vVel,p.parkFlightGravity],vert);
 // Recorded edits travel with the replay; historical takes ignore live park tweaks.
 const {Recorder,Replayer}=await server.ssrLoadModule('/src/replay.ts');
 Object.assign(TUNING,defaults);const rec=new Recorder();rec.start('jungle-cup');rec.record(makeInput());TUNING.parkOllieHeight=1.7;rec.record(makeInput());const take=rec.export(),replay=new Replayer();
 TUNING.parkOllieHeight=2;replay.begin(take);assert.equal(TUNING.parkOllieHeight,1);replay.feed(makeInput());replay.feed(makeInput());assert.equal(TUNING.parkOllieHeight,1.7);replay.end();assert.equal(TUNING.parkOllieHeight,2);
 const legacy=structuredClone(take);for(const key of keys)delete legacy.tuning[key];legacy.tuningChanges=[];replay.begin(legacy);assert.equal(TUNING.parkOllieHeight,1);replay.end();assert.equal(TUNING.parkOllieHeight,2);
 Object.assign(TUNING,defaults);course.dispose();
 console.log('PASS: 12 live park controls, independent cruise/charge/acceleration and height/time, long charge duration, future non-competition skatepark, unchanged platform trajectories and vert launch.');console.log(JSON.stringify({baseCruise,baseCharge,baseJump,high,float,normalSpeed,normalJump}));
});
