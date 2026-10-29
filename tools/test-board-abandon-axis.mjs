import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const out='docs/carlisle-relay/abandon-axis';
const data={v:1,name:'Abandon axis regression',spawn:[0,.05,0],killY:-200,
 components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]};
await withSkateRuntime(async({player:p,level,CONST,TUNING,THREE})=>{
 const tuning=JSON.stringify(TUNING),dt=CONST.fixedStep,rows=[];
 const frames={S:{f:[0,0,-1],r:[1,0,0],forward:[0,1],side:[1,0]},N:{f:[0,0,1],r:[1,0,0],forward:[0,1],side:[1,0]},
  E:{f:[1,0,0],r:[0,0,-1],forward:[1,0],side:[0,1]},W:{f:[-1,0,0],r:[0,0,-1],forward:[-1,0],side:[0,1]}};
 const run=(mode,dir,stance,command,{sideCarry=0,speed=24}={})=>{
  const frame=frames[dir],forward=new THREE.Vector3(...frame.f),right=new THREE.Vector3(...frame.r);
  p.competitionMode=false;p.enterLevel('abandon-axis');p.respawn(level,true);
  p.pos.set(0,100,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.groundHit=null;p.travelDir=dir;p.stance=stance;
  p.axisF.copy(forward).addScaledVector(right,sideCarry).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.camDir.copy(forward);p.speed=speed;
  p.freeSkate=true;p.airFromSkate=true;p.airGrav='board';p.boardOllieAir=true;p.airMomentum=true;
  const initialVelocity=p.axisF.clone().multiplyScalar(speed);
  const input=command==='neutral'?[0,0]:command==='forward'?frame.forward:command==='reverse'?frame.forward.map(v=>-v):frame.side.map(v=>v*(command==='right'?1:-1));
  const sample={moveX:input[0],moveY:input[1]};
  // Seed the departure's native air state; ordinary and spring variants use
  // the actual fresh key press/release path, vert shares its release action.
  if(mode==='spring'){p.boardOllieAir=false;p.trampolineAir=true;p.bounceJump=true;p.airGrav='foot';p.trampolineLaunchSpeed=64;}
  if(mode==='vert'){
   p.vertAir=true;p.vertNormal.set(forward.z,0,-forward.x);p.vertLatVel=speed;
   p.performBoardAbandon(.25,'Board Abandon',true);
  }else{
   p.step(dt,makeInput({jumpPressed:true,jumpHeld:true}),level);
   for(let i=0;i<5;i++)p.step(dt,makeInput({jumpHeld:true}),level);
  }
  const start=p.pos.clone(),points=[];
  for(let i=0;i<70;i++){
   p.step(dt,makeInput({...sample,...(i===0&&mode!=='vert'?{jumpReleased:true}:{})}),level);
   assert.ok(p.emergencyEjectLandingPending&&!p.freeSkate&&p.state==='air');
   const delta=p.pos.clone().sub(start),velocity=p.axisF.clone().multiplyScalar(p.speed);
   points.push({side:delta.dot(right),along:delta.dot(forward),sideVelocity:velocity.dot(right),alongVelocity:velocity.dot(forward),y:p.pos.y,vy:p.vVel});
  }
  const last=points.at(-1),maxSide=Math.max(...points.map(v=>Math.abs(v.side)));
  if(!sideCarry&&['neutral','forward','reverse'].includes(command)){
   assert.ok(maxSide<1e-8,`${mode}/${dir}/${stance}/${command} invented side travel: ${maxSide}`);
   assert.ok(points.every(v=>Math.abs(v.sideVelocity)<1e-8),'invented lateral velocity');
   if(command==='reverse'&&speed){assert.ok(points[11].alongVelocity>0,'reverse discarded carry immediately');assert.ok(last.alongVelocity<-1,'straight reversal never completed');}
   if(command!=='reverse'&&speed)assert.ok(Math.abs(last.alongVelocity-speed)<1e-8,'straight carry changed');
  }
  if(command==='neutral')assert.ok(p.axisF.clone().multiplyScalar(p.speed).distanceTo(initialVelocity)<1e-8,'neutral discarded actual side carry');
  if(['left','right'].includes(command)){assert.ok(Math.abs(last.side)>5,'side input lost authority');assert.ok(Math.abs(p.speed-speed)<1e-8,'deliberate turn lost departure speed');}
  rows.push({mode,dir,stance,command,sideCarry,speed,maxSide,at12:points[11],last});return points;
 };
 for(const mode of ['ordinary','spring','vert'])for(const dir of Object.keys(frames))for(const stance of [-1,1]){
  const neutral=run(mode,dir,stance,'neutral');
  for(const command of ['forward','reverse']){
   const points=run(mode,dir,stance,command);
   assert.deepEqual(points.map(v=>[v.y,v.vy]),neutral.map(v=>[v.y,v.vy]),'steering changed vertical arc');
  }
 }
 for(const mode of ['ordinary','spring','vert']){
  const left=run(mode,'S',1,'left'),right=run(mode,'S',-1,'right');
  for(let i=0;i<left.length;i++)assert.ok(Math.abs(left[i].side+right[i].side)<1e-8&&Math.abs(left[i].along-right[i].along)<1e-8,'left/right inputs not mirrored');
 }
 for(const sideCarry of [-.35,.35])for(const command of ['neutral','forward'])run('ordinary','S',1,command,{sideCarry});
 for(const command of ['neutral','forward','reverse'])run('ordinary','S',1,command,{speed:0});
 assert.equal(JSON.stringify(TUNING),tuning);
 await mkdir(out,{recursive:true});await writeFile(`${out}/native.json`,JSON.stringify({rows,tuningUnchanged:true,framesPerCase:70},null,2)+'\n');
 console.log(`PASS ${rows.length} abandon cases: straight keyboard axes, both stances, ordinary/spring/vert, all course directions, mirrored steering, real side carry and vertical-arc parity.`);
},{levelEntry:{id:'abandon-axis',name:data.name,data}});
