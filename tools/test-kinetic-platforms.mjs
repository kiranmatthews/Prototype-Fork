import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Kinetic deck contact fixture',spawn:[4,.2,3],killY:-30,components:[
 {t:'mover',nm:'Orbiting turntable',p:[0,0,0],s:[24,1,24],axis:'y',amp:0,speed:.35,orbit:[4,6],spin:25},
 {t:'gate',p:[0,0,-100]}]};
await withSkateRuntime(async({level,player:p,CONST,THREE,server})=>{
 p.competitionMode=false;p.endlessDeaths=true;
 for(let i=0;i<30;i++){p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);}
 assert.ok(p.grounded);const m=level.movers[0];
 // Player.step consumes the previous Level.update. Measure both poses at
 // the same fixed tick, before advancing the platform again.
 const local=p.pos.clone().applyMatrix4(m.carry).applyMatrix4(m.mesh.matrixWorld.clone().invert());let maxDrift=0;
 for(let i=0;i<240;i++){
  p.step(CONST.fixedStep,makeInput(),level);
  assert.ok(p.grounded,'stationary rider fell from rotating deck');
  const now=p.pos.clone().applyMatrix4(m.mesh.matrixWorld.clone().invert());maxDrift=Math.max(maxDrift,Math.hypot(now.x-local.x,now.z-local.z));
  level.update(CONST.fixedStep);
 }
 assert.ok(maxDrift<.03,`rotation carry drift ${maxDrift}`);
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const captured=level.captureData();assert.ok(normalizeCustomLevelData(captured));
 assert.deepEqual(captured.components[0].orbit,[4,6]);assert.equal(captured.components[0].spin,25);
 for(const invalid of [{orbit:[NaN,3]},{orbit:[200,3]},{spin:Infinity},{spin:181},{bounce:-1},{bounce:NaN}]){
  assert.equal(normalizeCustomLevelData({...data,components:[{...data.components[0],...invalid}]}),null);
 }
 const rails=level.surfaceEdgeRails.filter(r=>level.surfaceEdgeOwners.get(r)===m.mesh);assert.equal(rails.length,4);
 const rail=rails[0],at=rail.totalLength*.5,position=rail.pointAt(at),heading=rail.tangentAt(at);position.y+=.15;
 p.pos.copy(position);p.settle(level,heading);p.pos.copy(position);p.prevPos.copy(position);p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
 p.step(CONST.fixedStep,makeInput({grindHeld:true,grindPressed:true}),level);assert.equal(p.state,'grind');
 for(let i=0;i<20;i++){level.update(CONST.fixedStep);p.step(CONST.fixedStep,makeInput({grindHeld:true}),level);assert.equal(p.state,'grind');assert.ok(p.grindRail.closest(p.pos).distance<.2);}
 console.log(JSON.stringify({riderSeconds:4,maxDrift,rotatingGrind:true,roundTrip:true,invalidMotionRejected:true}));
},{levelEntry:{id:'__kinetic',name:data.name,data}});

// Supported approaches keep their normal movement: feet walk, wheels trip.
const entry={v:1,name:'Native spring approach',spawn:[0,.12,0],killY:-30,components:[
 {t:'platform',p:[0,-.5,-4],s:[20,1,14]},
 {t:'mover',p:[0,.02,-15],s:[15,.6,16],axis:'x',amp:3,speed:.55,bounce:44.5},
 {t:'gate',p:[0,0,-100]}]};
await withSkateRuntime(async({level,player:p,CONST})=>{
 p.competitionMode=false;p.endlessDeaths=true;
 for(const phase of [0,7,53])for(const board of [false,true]){
  p.respawn(level,true);level.time=phase;level.update(0);p.freeSkate=board;p.speed=board?12:0;
  const launch=p.trampolineLaunchId;
  for(let i=0;i<240&&p.pos.z>-18&&!p.isBailing;i++){
   p.step(CONST.fixedStep,makeInput({moveY:1}),level);level.update(CONST.fixedStep);
   assert.equal(p.trampolineLaunchId,launch,'supported approach auto-bounced');
  }
  assert.equal(p.isBailing,board,`wrong supported contact at mover phase ${phase}`);
  if(!board)assert.ok(p.pos.z<-17&&p.grounded,'walk-on lost support');
 }
 console.log('PASS walking and grounded board-trip entries at three mover phases.');
},{levelEntry:{id:'__spring_entry',name:entry.name,data:entry}});
