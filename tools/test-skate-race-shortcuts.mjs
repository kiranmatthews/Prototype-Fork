import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Race fall and shortcut fixture',spawn:[0,20.1,12],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,19.5,-20],s:[8,1,80]},
 {t:'platform',p:[10,-.5,-20],s:[40,1,90]},
 {t:'crate',kind:'empty',p:[15,0,-15]},
 {t:'gate',p:[0,0,20],yaw:180},
 ...[[0,20,15],[0,20,-60],[60,10,-60],[60,0,-60],[0,0,-60],[0,0,20]].map(p=>({t:'camnode',p}))],
 skateRace:{v:1,racers:8,seed:2,line:[[0,20,15,8],[0,20,-60,8],[60,10,-60,10],[60,0,-60,10],[0,0,-60,40],[0,0,20,40]],jumps:[],finishWidth:28,originalLength:250}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'shortcut-fixture');race.start('time-trial');race.phase='running';
 const rider=race.riders[0],heading=new r.THREE.Vector3(1,0,0);
 const place=(position,speed)=>{r.p.resetRacePosition(r.l,position,heading);r.p.speed=speed;rider.progress=rider.anchorProgress=race.course.project(position).s;rider.anchor.copy(race.course.support(r.l,rider.progress));};
 const step=sample=>{r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput(sample));r.p.commitRenderStep(r.l);race.commitRenderStep();};
 let deathEvents=0,returnEvents=0;r.p.onDeath=()=>deathEvents++;r.p.onRespawn=()=>returnEvents++;
 place(new r.THREE.Vector3(3,20,-15),12);const oldProgress=rider.progress;let landed=false,sawAir=false;
 for(let f=0;f<300;f++){
  step({moveX:1});sawAir||=!r.p.grounded;
  assert.equal(rider.recovery,0,'A catchable lower road must not trigger a return');
  if(sawAir&&r.p.grounded&&r.p.pos.y<1){landed=true;break;}
 }
 assert.ok(landed,'The rider must physically land on the lower track');
 assert.equal(rider.falls,0);assert.ok(rider.progress>oldProgress+150,'A landed shortcut must join the lower course branch');
 const basis=r.p.raceInputBasis(r.l);assert.ok(basis.z>.95,'The input spine must select the lower deck after landing');
 assert.equal(deathEvents,0);
 const lives=r.p.lives,deaths=r.p.totalDeaths,trial=r.p.ttActive;
 r.l.raceActorId=0;r.l.breakCrate(r.l.crates[0]);assert.equal(rider.boxes.size,1);
 place(new r.THREE.Vector3(29,0,-15),12);let enteredFall=false,returned=false,firstDeathTime=0;
 for(let f=0;f<600;f++){
  step(enteredFall?{}:{moveX:-1});
  if(r.p.pos.y>-30)assert.equal(r.p.state==='dead',false,'Ordinary falling must remain live above the kill plane');
  if(r.p.state==='dead'&&!enteredFall){enteredFall=true;firstDeathTime=race.elapsed;}
  if(enteredFall&&returnEvents){returned=true;break;}
 }
 assert.ok(enteredFall&&returned,'An uncaught fall must use native fall presentation then return to the track');
 assert.equal(deathEvents,1);assert.equal(returnEvents,1);assert.equal(rider.falls,1);
 assert.ok(race.elapsed-firstDeathTime>=r.CONST.respawnDelay+r.CONST.deathWatchTime-r.dt*2);
 assert.equal(r.p.lives,lives);assert.equal(r.p.totalDeaths,deaths);assert.equal(r.p.ttActive,trial);assert.equal(r.p.ttDied,false);
 assert.equal(rider.boxes.size,1);assert.equal(r.l.crates[0].alive,false);assert.ok(r.p.grounded);assert.ok(Math.abs(r.p.pos.x)<.1);
 console.log(JSON.stringify({shortcut:true,lowerDeckControls:true,nativeFall:true,deathEvents,returnEvents,livesPreserved:true,worldPreserved:true,timeTrialContinues:true}));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'shortcut-fixture'});
