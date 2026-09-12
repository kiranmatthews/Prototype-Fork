import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,Player,Level,scene,TUNING,CONST})=>{
 const {TUNING_RANGES,TUNING_LABELS,TUNING_SECTIONS,PARK_MOVEMENT_KEYS,PARK_CAMERA_KEYS}=await server.ssrLoadModule('/src/tuning.ts');
 const defaults={...TUNING};
 for(const [base,park] of Object.entries({...PARK_MOVEMENT_KEYS,...PARK_CAMERA_KEYS})){
  assert.equal(TUNING[park],TUNING[base],`${park} default differs from platforming`);
  assert.deepEqual(TUNING_RANGES[park],TUNING_RANGES[base]);
  assert.equal(TUNING_SECTIONS.flatMap(s=>s.keys).filter(k=>k===park).length,1);
  assert.ok(!TUNING_LABELS[park].includes('×'));
 }
 for(const removed of ['parkCruiseSpeedScale','parkChargeSpeedScale','parkAccelerationScale','parkOllieHeight','parkOllieHangtime'])assert.ok(!(removed in TUNING));
 const course=new Level(scene,{id:'future-freecam-test',name:'Future park',data:{skatepark:true,spawn:[0,.1,100],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[600,1,600]}]}});scene.updateMatrixWorld(true);
 const p=new Player(scene);p.endlessDeaths=true;
 function reset(park,speed=12,yaw=0){course.skatepark=park;p.competitionMode=false;p.rawInput=makeInput();p.respawn(course,true,true,{position:new THREE.Vector3(0,0,100),heading:new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw))});p.freeSkate=true;p.speed=speed;p.pos.y=p.prevPos.y=0;p.grounded=true;p.groundHit=p.queryGround(course);p.rideNormal.copy(p.groundHit.normal);p.camDir.copy(p.axisF);p.crateFloor=null;}
 function step(input,park){if(!park){TUNING.chaseCam=1;p.camDir.copy(p.axisF);}p.step(CONST.fixedStep,input,course);input.consumeEdges();}
 function trace(park,script,frames=90,speed=12,yaw=0){reset(park,speed,yaw);const out=[];for(let f=0;f<frames;f++){step(makeInput(script(f)),park);out.push([...p.pos.toArray(),p.speed,...p.axisF.toArray(),p.vVel]);}return out;}
 const scripts={coast:()=>({}),cruise:()=>({moveY:1}),charge:f=>({moveY:1,jumpHeld:true,jumpPressed:f===0}),turn:f=>({moveX:.7,moveY:.7,jumpHeld:true,jumpPressed:f===0}),brake:()=>({grabHeld:true}),pullback:()=>({moveY:-1}),overspeed:()=>({moveY:1})};
 for(const [name,script] of Object.entries(scripts))for(const yaw of [0,1.1]){
  const frames=['brake','pullback'].includes(name)?18:90,speed=name==='overspeed'?35:12;
  const platform=trace(false,script,frames,speed,yaw),park=trace(true,script,frames,speed,yaw);
  for(let f=0;f<frames;f++)for(let k=0;k<park[f].length;k++)assert.ok(Math.abs(park[f][k]-platform[f][k])<1e-8,`${name}, yaw ${yaw}, frame ${f}, component ${k}: ${park[f][k]} vs ${platform[f][k]}`);
 }
 // Holding either brake reaches zero and stays mounted; releasing everything
 // remains stopped, while a fresh directional push builds speed normally.
 for(const input of [{grabHeld:true},{moveY:-1}]){
  reset(true);for(let i=0;i<180;i++)step(makeInput(input),true);assert.equal(p.speed,0);assert.equal(p.freeSkate,true);assert.equal(p.isBailing,false);
  for(let i=0;i<120;i++)step(makeInput(),true);assert.equal(p.speed,0);assert.equal(p.freeSkate,true);
  for(let i=0;i<60;i++)step(makeInput({moveY:1}),true);assert.ok(p.speed>9);assert.equal(p.freeSkate,true);
 }
 reset(true,.1);for(let i=0;i<100;i++)step(makeInput(),true);assert.equal(p.speed,0);assert.equal(p.freeSkate,true);
 // Ordinary air now shares the full platform curve and charge duration.
 function ollie(park,hold){reset(park);const out=[];for(let f=0;f<Math.round(hold/CONST.fixedStep);f++)step(makeInput({jumpHeld:true,jumpPressed:f===0}),park);step(makeInput({jumpReleased:true}),park);assert.equal(p.state,'air');for(let i=0;i<160;i++){out.push([p.pos.y,p.vVel,p.speed]);if(p.grounded)break;step(makeInput(),park);}assert.ok(p.grounded);assert.equal(p.isBailing,false);return out;}
 for(const hold of [1/60,.2,.4,.8]){const a=ollie(true,hold),b=ollie(false,hold);assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(a[i][k]-b[i][k])<1e-8,`${hold}s ollie differs from platforming at ${i}/${k}`);}
 // Absolute edits affect only the park; test independent acceleration/drag and pop.
 const baseline=trace(false,scripts.charge);TUNING.parkMaxSpeed=28;TUNING.parkChargeBoost=18;
 const fast=trace(true,scripts.charge);assert.ok(fast.at(-1)[3]>27.9);assert.deepEqual(trace(false,scripts.charge),baseline);
 Object.assign(TUNING,defaults);const coast=trace(true,scripts.coast);TUNING.parkRollFriction=10;assert.ok(trace(true,scripts.coast).at(-1)[3]<coast.at(-1)[3]-1);
 Object.assign(TUNING,defaults);const jump=ollie(false,.4);TUNING.parkOllieVelocity=14;assert.ok(Math.max(...ollie(true,.4).map(f=>f[0]))>Math.max(...jump.map(f=>f[0]))+.8);assert.deepEqual(ollie(false,.4),jump);
 // The profile is a read-only view: edits never temporarily replace globals.
 const {PARK_MOVEMENT_TUNING}=await server.ssrLoadModule('/src/skateParkTuning.ts');assert.equal(PARK_MOVEMENT_TUNING.ollieVelocity,14);assert.equal(TUNING.ollieVelocity,11);
 const {Recorder,Replayer}=await server.ssrLoadModule('/src/replay.ts');
 Object.assign(TUNING,defaults);TUNING.parkMaxSpeed=28;const rec=new Recorder();rec.start('jungle-cup');rec.record(makeInput());TUNING.parkMaxSpeed=30;rec.record(makeInput());const take=rec.export();TUNING.parkMaxSpeed=34;const replay=new Replayer();replay.begin(take);assert.equal(PARK_MOVEMENT_TUNING.maxSpeed,28);replay.feed(makeInput());replay.feed(makeInput());assert.equal(PARK_MOVEMENT_TUNING.maxSpeed,30);replay.end();assert.equal(PARK_MOVEMENT_TUNING.maxSpeed,34);
 const old=structuredClone(take);old.tuning.parkCruiseSpeedScale=2;old.tuningChanges=[[0,'parkCruiseSpeedScale',3]];replay.begin(old);replay.feed(makeInput());assert.ok(!('parkCruiseSpeedScale' in TUNING));replay.end();
 Object.assign(TUNING,defaults);course.dispose();console.log('PASS absolute defaults/schema, 14 complete motor traces, platform ollie parity, both brakes and idle remain mounted at zero, resume, and park-only edits.');
});
