import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const take=JSON.parse(await readFile(new URL('./fixtures/slipstream-fall-replay.json',import.meta.url),'utf8'));
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');const replayer=new Replayer(),input={};
 const tuning={...r.TUNING},lives=r.p.lives,events=[];let frame=0,lastSupport=0,death=null;
 r.p.onDeath=()=>{death={frame,offFrame:lastSupport,y:r.p.pos.y,boxes:race.riders[0].boxes.size,elapsed:race.elapsed};};
 r.p.onRespawn=()=>{if(death){events.push({...death,returnFrame:frame,returnY:r.p.pos.y,returnBoxes:race.riders[0].boxes.size,returnElapsed:race.elapsed,grounded:r.p.grounded});death=null;}};
 replayer.begin(take);
 try{for(;frame<take.frames;frame++){
  replayer.feed(input,r.p.camDir);r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.p.commitRenderStep(r.l);race.commitRenderStep();
  if(r.p.grounded)lastSupport=frame;
 }}finally{replayer.end();}
 assert.ok(events.length>0,'The supplied recording must recover before it ends');
 const first=events[0];assert.ok(first.y>600,'A high-course fall must not wait for the distant world kill plane');
 assert.ok((first.returnFrame-first.offFrame)*r.dt<5,'An unrecoverable edge fall must return within five seconds');
 assert.ok((first.returnFrame-first.frame)*r.dt>=r.CONST.respawnDelay+r.CONST.deathWatchTime-r.dt,'Keep the ordinary death presentation');
 assert.ok(first.grounded&&first.returnY>800&&first.returnBoxes>=first.boxes&&first.returnElapsed>first.elapsed);
 assert.equal(r.p.lives,lives);assert.equal(r.p.totalDeaths,0);for(const [key,value] of Object.entries(tuning))assert.equal(r.TUNING[key],value);
 const report={recordedFrames:take.frames,events,firstReturnSeconds:(first.returnFrame-first.offFrame)*r.dt,livesPreserved:true,tuningPreserved:true};
 await writeFile(process.env.RACE_FALL_REPORT??join(tmpdir(),'skate-race-fall-replay.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race',endlessDeaths:true});

const line=[[0,120,15,8],[0,120,-60,8],[70,0,-60,10],[20,0,-60,100],[20,0,20,100]];
const lower={v:1,name:'Deep lower-track landing',spawn:[0,120.1,12],startWarpPad:false,killY:-30,components:[
 {t:'platform',p:[0,119.5,-20],s:[8,1,80]}, {t:'platform',p:[20,-.5,-20],s:[100,1,90]}, {t:'gate',p:[20,0,20],yaw:180},
 ...line.map(([x,y,z])=>({t:'camnode',p:[x,y,z]}))],skateRace:{v:1,racers:8,seed:2,line,jumps:[],finishWidth:28,originalLength:300}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p);race.attach(r.l,'deep-shortcut');race.start('time-trial');race.phase='running';
 const rider=race.riders[0],position=new r.THREE.Vector3(3,120,-15);r.p.resetRacePosition(r.l,position,new r.THREE.Vector3(1,0,0));r.p.speed=12;
 rider.progress=rider.anchorProgress=race.course.project(position).s;rider.anchor.copy(race.course.support(r.l,rider.progress));
 let deep=false,landed=false;
 for(let f=0;f<600;f++){
  r.scene.updateMatrixWorld(true);race.step(r.dt,{moveX:1,moveY:0});r.p.commitRenderStep(r.l);race.commitRenderStep();
  deep||=r.p.pos.y<60;assert.equal(rider.falls,0,'A reachable lower track must remain a valid shortcut');
  if(deep&&r.p.grounded&&r.p.pos.y<1){landed=true;break;}
 }
 assert.ok(landed,'The rider must physically land after the 120 m drop');assert.ok(r.p.raceInputBasis(r.l).z>.95);
 console.log('PASS live 120 m lower-track shortcut and lower-branch controls');
},{modulePath:'/src/levels/slipstream.ts',source:()=>lower,levelId:'deep-shortcut'});
