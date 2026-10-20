import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const line=[[0,0,80,100],[0,0,-130,100]];
const source={v:1,name:'Normal race moveset',spawn:[0,.05,60],killY:-40,components:[
 {t:'platform',p:[0,-.5,0],s:[200,1,300]}, {t:'platform',p:[8,2,-30],s:[8,4,12]},
 {t:'gate',p:[0,0,-125]},...line.map(([x,y,z])=>({t:'camnode',p:[x,y,z]}))],
 skateRace:{v:1,racers:8,seed:1,line,jumps:[],finishWidth:100,originalLength:210}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');const race=new SkateRace(r.scene,r.p);race.attach(r.l,'normal-race-moveset');race.start('time-trial');race.phase='running';
 let previous={};const tick=(sample={})=>{const input=normalizeGameInput(sample,previous);previous=input;r.scene.updateMatrixWorld(true);race.step(r.dt,input);r.p.commitRenderStep(r.l);race.commitRenderStep();};
 const step=(n,s={})=>{for(let i=0;i<n;i++)tick(s);};
 const place=(x,y,z)=>{r.p.resetRacePosition(r.l,new r.THREE.Vector3(x,y,z),new r.THREE.Vector3(0,0,-1));r.p.speed=0;previous={};step(2,{grabHeld:true});step(2);};
 place(0,0,60);assert.equal(r.p.boardRolling,false);const start=r.p.pos.clone();step(60,{moveY:1});assert.ok(r.p.pos.distanceTo(start)>5);assert.equal(r.p.boardRolling,false);
 step(70,{moveY:1,jumpHeld:true});assert.equal(r.p.boardRolling,true);step(160,{grabHeld:true});step(30);assert.equal(r.p.boardRolling,false,'Braking and idling cannot force a remount');
 step(20,{jumpHeld:true});tick();assert.equal(r.p.state,'air');assert.equal(r.p.airFromSkate,false);const low=r.p.vVel;tick({jumpHeld:true});tick();assert.ok(r.p.doubleJumpAir||r.p.vVel>low,'Normal double jump must remain available');step(160);
 place(0,0,60);r.p.freeSkate=true;r.p.speed=18;step(12,{jumpHeld:true});tick();assert.equal(r.p.boardOllieAir,true);step(4);step(2,{jumpHeld:true});tick();
 assert.equal(r.p.emergencyEjectLandingPending,false,'Second jump must retain the board');assert.equal(r.p.boardRolling,true);assert.equal(r.p.airJumpUsed,true);assert.ok(r.p.vVel>0);
 step(2,{jumpHeld:true});tick();
 assert.equal(r.p.emergencyEjectLandingPending,true,'The third jump must abandon the board');assert.equal(r.p.boardRolling,false);
 const thirdPop=r.p.vVel;step(2,{jumpHeld:true});tick();assert.ok(r.p.vVel<thirdPop,'Fourth press cannot add another jump');assert.equal(r.p.doubleJumpAir,false);
 for(let i=0;i<240&&!r.p.grounded;i++)tick();step(120);assert.equal(r.p.boardRolling,false,'Landing must stay on foot');
 step(100,{moveY:1});assert.equal(r.p.boardRolling,false);assert.ok(Math.abs(r.p.walkVelocity.length()-r.TUNING.walkSpeed)<.01);
 place(0,0,-30);step(24,{jumpHeld:true});tick({moveX:1});let caught=false;
 for(let i=0;i<120;i++){tick({moveX:1});if(r.p.state==='hang'){caught=true;break;}}
 console.log(JSON.stringify({ledge:{caught,p:r.p.pos.toArray(),state:r.p.state,ground:r.p.grounded}}));assert.ok(caught,'A real on-foot jump must catch the ledge');
 step(10);tick({jumpHeld:true});step(50);assert.ok(r.p.grounded&&r.p.pos.y>3.9,'Ledge climb must reach supported ground');
 assert.equal(race.riders[0].falls,0);assert.equal(r.p.totalDeaths,0);
 console.log('PASS native walking/running, mount, brake-dismount, foot jump/double jump, board ejection, on-foot landing, ledge grab and climb');
},{modulePath:'/src/levels/slipstream.ts',source:()=>source,levelId:'normal-race-moveset'});
