import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,Player,Level,scene,TUNING,CONST})=>{
 const {TUNING_RANGES,TUNING_SECTIONS}=await server.ssrLoadModule('/src/tuning.ts');
 const {SKATE_PARK}=await server.ssrLoadModule('/src/skateParkPhysics.ts');
 const defaults={...TUNING},keys=Object.keys(TUNING).filter(k=>k.startsWith('park'));
 assert.equal(keys.length,9,'park tuner grew beyond speed/acceleration and five camera controls');
 for(const [park,base] of [['parkCruiseSpeed','cruiseSpeed'],['parkChargeSpeed','maxSpeed'],['parkCruiseAcceleration','chargeDecay'],['parkChargeAcceleration','chargeBoost']])assert.equal(TUNING[park],TUNING[base]);
 for(const key of keys){const r=TUNING_RANGES[key];assert.equal(TUNING_SECTIONS.flatMap(s=>s.keys).filter(k=>k===key).length,1);assert.ok(Math.abs((TUNING[key]-r.min)/r.step-Math.round((TUNING[key]-r.min)/r.step))<1e-7);}
 const course=new Level(scene,{id:'future-park',name:'Future park',data:{skatepark:true,spawn:[0,0,100],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[600,1,600]}]}});scene.updateMatrixWorld(true);const p=new Player(scene);p.endlessDeaths=true;
 function reset(park=true,speed=0){course.skatepark=park;p.competitionMode=false;p.rawInput=makeInput();p.respawn(course,true,true,{position:new THREE.Vector3(0,0,100),heading:new THREE.Vector3(0,0,-1)});p.freeSkate=true;p.speed=speed;p.pos.y=p.prevPos.y=0;p.grounded=true;p.groundHit=p.queryGround(course);p.rideNormal.copy(p.groundHit.normal);}
 function step(input){p.step(CONST.fixedStep,input,course);input.consumeEdges();}
 function run(input,frames=180,park=true,speed=0){reset(park,speed);const trace=[];for(let i=0;i<frames;i++){step(makeInput({...input,jumpPressed:!!input.jumpHeld&&i===0}));trace.push(p.speed);}return trace;}
 const cruise=run({moveY:1}),charge=run({jumpHeld:true});assert.ok(Math.abs(cruise.at(-1)-12)<.002);assert.ok(Math.abs(charge.at(-1)-23)<.002);
 assert.ok(Math.abs(cruise[0]/CONST.fixedStep-10)<.002);assert.ok(Math.abs(charge[0]/CONST.fixedStep-9)<.002);
 // Only no-input rollout borrows platform friction. Compare the whole curve
 // until the platform's dismount threshold, then hold zero on the park board.
 const platform=run({},1800,false,15),park=run({},1800,true,15);
 for(let i=0;i<1800&&platform[i]>.08;i++)assert.ok(Math.abs(platform[i]-park[i])<1e-8,`coast differs at ${i}`);
 assert.equal(p.speed,0);assert.equal(p.freeSkate,true);assert.equal(p.isBailing,false);
 for(let i=0;i<120;i++)step(makeInput());assert.equal(p.speed,0);assert.equal(p.freeSkate,true);
 for(let i=0;i<60;i++)step(makeInput({moveY:1}));assert.ok(p.speed>9.9);
 // Park turning and braking retain their old calibrated response, independent
 // of the camera and the platform's replacement steering/brake settings.
 reset(true,15);p.camDir.set(1,0,0);step(makeInput({moveX:.5,jumpHeld:true}));assert.ok(Math.abs(Math.atan2(p.axisF.x,-p.axisF.z)-SKATE_PARK.turnRate*.5*CONST.fixedStep)<1e-9);
 reset(true,15);step(makeInput({grabHeld:true}));const afterBrake=15-SKATE_PARK.brake*CONST.fixedStep;assert.ok(Math.abs(p.speed-(afterBrake-SKATE_PARK.standingDrag*afterBrake**2*CONST.fixedStep))<1e-9);assert.equal(p.brakeLockT,0);
 // Restored symmetric park ollie, with its original 0.2-second charge.
 reset(true,12);for(let i=0;i<15;i++)step(makeInput({jumpHeld:true,jumpPressed:i===0}));step(makeInput({jumpReleased:true}));const launch=p.vVel;assert.ok(Math.abs(launch-10.9728)<1e-10);
 let peak=p.pos.y;for(let i=0;i<100&&!p.grounded;i++){const vy=p.vVel;step(makeInput());peak=Math.max(peak,p.pos.y);if(!p.grounded)assert.ok(Math.abs(p.vVel-vy+34.29*CONST.fixedStep)<1e-9);}assert.ok(Math.abs(peak-1.75546)<.003);assert.equal(p.isBailing,false);
 const before=run({jumpHeld:true,moveY:1},100,false,12);TUNING.parkChargeSpeed=27;TUNING.parkChargeAcceleration=18;assert.ok(Math.abs(run({jumpHeld:true}).at(-1)-27)<.002);assert.deepEqual(run({jumpHeld:true,moveY:1},100,false,12),before);
 Object.assign(TUNING,defaults);const {Recorder,Replayer}=await server.ssrLoadModule('/src/replay.ts');const rec=new Recorder();rec.start('jungle-cup');rec.record(makeInput());const take=rec.export();take.tuning.parkCamAirLift=0;take.tuning.parkBoardFallGravity=70;take.tuningChanges=[[0,'parkCruiseSpeedScale',2]];const replay=new Replayer();replay.begin(take);replay.feed(makeInput());for(const retired of ['parkCamAirLift','parkBoardFallGravity','parkCruiseSpeedScale'])assert.ok(!(retired in TUNING));replay.end();
 Object.assign(TUNING,defaults);course.dispose();console.log('PASS nine controls; 12/23 m/s, 10/9 m/s²; platform no-input coast with mounted zero; restored park steering/brake/0.2 s ballistic ollie; profile isolation and retired-key filtering.');
});
