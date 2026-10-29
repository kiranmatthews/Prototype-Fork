import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {CARLISLE_TIDAL_RELAY_LEVEL:data,CARLISLE_RELAY_JUMPS:jumps,carlislePoint:point}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
await withSkateRuntime(async({server,level,player:p,CONST,THREE})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 if(!normalizeCustomLevelData(structuredClone(data))){console.log('Invalid components',data.components.flatMap((c,i)=>normalizeCustomLevelData({...data,components:[structuredClone(c)]})?[]:[{i,t:c.t,nm:c.nm,speed:c.speed,bounce:c.bounce,vertices:c.vertices?.length}]).slice(0,20));}
 assert.ok(normalizeCustomLevelData(structuredClone(data)));
 p.competitionMode=false;p.endlessDeaths=true;
 const tick=input=>{p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();};
 const flights=[];
 for(const phase of (process.env.PHASES??'0').split(',').map(Number))for(const j of jumps){
  level.time=phase;level.update(0);
  const c=data.components.find(c=>c.nm===j.name&&(c.t==='trampoline'||c.t==='mover'));
  const machine=j.moving?level.movers.find(m=>m.mesh.name===j.name):null;
  const start=machine?machine.mesh.position.clone().add(new THREE.Vector3(0,c.s[1]/2+.15,0)):new THREE.Vector3(...c.p).add(new THREE.Vector3(0,.15,0));
  p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});p.totalDeaths=0;p.freeSkate=false;p.speed=0;
  let launched=false,landed=false,peak=p.pos.y,frames=0,launchAt=null,departure=null;
  const targetJump=jumps.find(q=>q.from[0]===j.to[0]),targetMover=targetJump?.moving?level.movers.find(m=>m.mesh.name===targetJump.name):null;
  for(;frames<1000;frames++){
   const target=targetMover?targetMover.mesh.position.clone():new THREE.Vector3(...point(...j.to));
   const dx=target.x-p.pos.x,dz=target.z-p.pos.z,forward=dx*p.axisF.x+dz*p.axisF.z,side=dx*p.axisL.x+dz*p.axisL.z;
   const input=makeInput({moveY:launched?(Math.abs(forward)>1.5?Math.sign(forward):0):0,moveX:launched&&Math.abs(side)>2?Math.sign(side):0,jumpHeld:true});
   const before=p.vVel;tick(input);peak=Math.max(peak,p.pos.y);
   if(!launched&&p.vVel>15&&!p.grounded){launched=true;launchAt=frames;departure=p.pos.toArray();}
   if(launched&&frames>launchAt+8&&((before<0&&p.vVel>15)||p.grounded||p.state==='finished')){landed=true;break;}
   if(p.state==='dead')break;
  }
  const target=targetMover?targetMover.mesh.position:new THREE.Vector3(...point(...j.to));
  const distance=p.pos.distanceTo(target),row={name:j.name,phase,up:j.up,landed,distance:+distance.toFixed(2),peak:+peak.toFixed(1),seconds:+(frames/60).toFixed(2),position:p.pos.toArray(),state:p.state,departure};flights.push(row);
  if(!landed||distance>15){console.log(JSON.stringify(row));break;}
 }
 // Native neutral/held behavior: no horizontal movement without movement input.
 const pad=data.components.find(c=>c.t==='trampoline');let neutral=[];
 for(const held of [false,true]){p.respawn(level,true,false,{position:new THREE.Vector3(...pad.p).add(new THREE.Vector3(0,.15,0)),heading:new THREE.Vector3(0,0,-1)});p.speed=0;p.freeSkate=false;
  for(let f=0;f<20;f++){tick(makeInput({jumpHeld:held}));if(p.vVel>15){neutral.push({held,up:p.vVel,drift:Math.hypot(p.pos.x-pad.p[0],p.pos.z-pad.p[2])});break;}}}
 console.log(JSON.stringify({neutral,padSpeed:pad.speed}));
 assert.equal(neutral.length,2);assert.ok(neutral.every(r=>r.drift<.01));
 assert.ok(neutral.every(r=>Math.abs(r.up-pad.speed*(r.held?1.25:1))<.6));
 const m=level.movers.find(m=>m.spin&&!m.mesh.userData.trampolineBounce),local=new THREE.Vector3(3,1,3),before=local.clone().applyMatrix4(m.mesh.matrixWorld);level.update(.2);
 assert.ok(before.clone().add(level.moverDelta(level.movers.indexOf(m),before)).distanceTo(local.clone().applyMatrix4(m.mesh.matrixWorld))<1e-6);
 const report={flights,neutral,nativePhysics:true,rigidCarry:true};await mkdir('docs/carlisle-relay',{recursive:true});await writeFile('docs/carlisle-relay/native-physics.json',JSON.stringify(report,null,2)+'\n');
 assert.equal(flights.length,jumps.length*(process.env.PHASES??'0').split(',').length);assert.ok(flights.every(f=>f.landed&&f.distance<15));
 console.log(JSON.stringify({flights:flights.length,neutral,maxPeak:Math.max(...flights.map(f=>f.peak)),movers:level.movers.length}));
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
