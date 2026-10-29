import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data={v:1,name:'Trampoline controls',spawn:[0,1,0],killY:-30,components:[
 {t:'platform',p:[0,-.5,-200],s:[300,1,700]},
 {t:'trampoline',p:[0,.2,0],s:[24,.6,24],speed:64,amp:1.25},
 {t:'mover',p:[40,.2,0],s:[24,.6,24],axis:'x',amp:0,spin:8,bounce:64},
 {t:'trampoline',p:[80,.2,0],s:[24,.6,24],speed:16,amp:1.25},
 {t:'gate',p:[0,0,-500]},
]};

await withSkateRuntime(async({player:p,level,CONST,TUNING,THREE})=>{
 p.competitionMode=false;
 const original=JSON.stringify(TUNING),dt=CONST.fixedStep,rows=[];
 const tick=(sample={})=>{const input=makeInput(sample);p.rawInput=input;p.step(dt,input,level);level.update(dt);};
 const launch=(x,{board=false,held=true}={})=>{
  p.respawn(level,true,false,{position:new THREE.Vector3(x,1,0),heading:new THREE.Vector3(0,0,-1)});
  p.freeSkate=board;p.speed=board?12:0;p.walkVelocity.set(0,0,0);
  for(let i=0;i<30;i++){tick({jumpHeld:held});if(p.trampolineAir&&p.bounceJump)break;}
  assert.ok(p.trampolineAir&&p.bounceJump,'fixture did not hit the native spring');
  assert.equal(p.freeSkate,board);assert.equal(p.airGrav,'foot','bounce gravity changed');
  return {y:p.pos.y,vy:p.vVel,x:p.pos.x,z:p.pos.z,speed:p.speed};
 };
 for(const x of [0,40])for(const board of [false,true]){
  const start=launch(x,{board});
  for(let i=0;i<30;i++)tick();
  const neutral={x:p.pos.x-start.x,z:p.pos.z-start.z,y:p.pos.y,vy:p.vVel,speed:p.speed};
  assert.ok(Math.abs(neutral.x)<.001);assert.equal(p.freeSkate,board);
  if(board)assert.ok(Math.abs(neutral.speed-start.speed)<1e-8,'neutral input taxed board carry');
  else assert.ok(Math.abs(neutral.z)<.001);
  assert.ok(p.trampolineCameraTarget>.99,'big air did not request the wide camera');
  const sideStart=launch(x,{board});
  for(let i=0;i<30;i++)tick({moveX:1});
  const side=p.pos.x-sideStart.x;
  assert.ok(side>7,'big bounce needs more than the old 4.5 m half-second sidestep');
  assert.ok(Math.abs(p.pos.y-neutral.y)<1e-8&&Math.abs(p.vVel-neutral.vy)<1e-8,'steering changed the vertical arc');
  assert.ok(Math.abs((p.pos.z-sideStart.z)-neutral.z)<1e-8,'side input changed forward carry');
  for(let i=0;i<30;i++)tick({moveX:-1});
  assert.ok(Math.abs(p.pos.x-sideStart.x)<.01,'countersteering cannot undo the sidestep');
  const stop=p.pos.x;for(let i=0;i<6;i++)tick();assert.ok(Math.abs(p.pos.x-stop)<1e-8,'neutral input retained sideways drift');
  if(board){
   const speed=p.speed;for(let i=0;i<15;i++)tick({moveY:-1});
   assert.ok(p.speed<speed-2,'back input cannot shorten a mounted spring arc');
   launch(x,{board:true});tick({jumpReleased:true});
   assert.equal(p.emergencyEjectLandingPending,false,'releasing the bounce boost abandoned without a fresh press');
   tick({jumpPressed:true,jumpHeld:true});for(let i=0;i<8;i++)tick({jumpHeld:true});
   const carry=p.speed;tick({jumpReleased:true});
   assert.equal(p.lastJumpType,'Emergency Eject');assert.equal(p.emergencyEjectLandingPending,true);
   assert.equal(p.freeSkate,false);assert.ok(p.looseBoard);assert.equal(p.doubleJumpAir,false);
   assert.ok(Math.abs(p.speed-carry)<1e-8,'abandon-ship lost the existing forward carry');
   const vy=p.vVel;tick({jumpPressed:true,jumpHeld:true});tick({jumpReleased:true});
   assert.ok(p.vVel<vy,'abandon-ship granted an extra airborne jump');
  }else{
   launch(x);tick({jumpReleased:true});tick({jumpPressed:true,jumpHeld:true});tick({jumpReleased:true});
   assert.equal(p.lastJumpType,'Double Jump');assert.equal(p.doubleJumpAir,true);
   assert.equal(p.emergencyEjectLandingPending,false,'foot bounce tried to abandon a board');
  }
  rows.push({kind:x===0?'static':'moving',board,sidewaysMetresInHalfSecond:side,neutral});
 }
 // Small native springs keep their existing walking air control and camera.
 launch(80,{held:false});tick({moveX:1});
 assert.equal(p.trampolineCameraTarget,0);assert.ok(Math.abs(p.pos.x-80-TUNING.walkSpeed*dt)<.001);
 // An ordinary board ollie retains its input sequence and has no spring steering.
 p.respawn(level,true,false,{position:new THREE.Vector3(-70,.12,0),heading:new THREE.Vector3(0,0,-1)});
 p.freeSkate=true;p.speed=12;for(let i=0;i<12;i++)tick({jumpHeld:true});tick({jumpReleased:true});
 assert.equal(p.boardOllieAir,true);assert.equal(p.trampolineCameraTarget,0);
 const x=p.pos.x;for(let i=0;i<4;i++)tick({moveX:1});assert.ok(Math.abs(p.pos.x-x)<.001);
 tick({jumpPressed:true,jumpHeld:true});tick({jumpReleased:true});assert.equal(p.lastJumpType,'Emergency Eject');
 assert.equal(JSON.stringify(TUNING),original);
 console.log(JSON.stringify({rows,ordinaryOllie:true,footDoubleJump:true,smallSpringUnchanged:true,tuningUnchanged:true},null,2));
 console.log('PASS trampoline sidesteps, countersteering, braking, neutral carry, native arcs and fresh-release abandon-ship.');
},{levelEntry:{id:'__trampoline-controls',name:data.name,data}});
