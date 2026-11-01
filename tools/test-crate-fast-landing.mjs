import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Fast crate landing',spawn:[0,.1,10],killY:-20,components:[
 {t:'platform',p:[0,-.5,0],s:[80,1,80]},
 ...['wood','metalbounce','metal','nitro'].map((kind,i)=>({t:'crate',p:[i*8,6,0],kind})),
 {t:'gate',p:[0,0,-30]},
]};
await withSkateRuntime(async({player:p,level,CONST,TUNING})=>{
 p.competitionMode=false;const tuning=JSON.stringify(TUNING);let checks=0;
 const drop=(index,above,xOffset=0)=>{
  p.respawn(level,true);const c=level.crates[index];p.totalDeaths=0;p.freeSkate=p.airFromSkate=false;p.speed=0;p.masks=0;
  p.pos.set(c.mesh.position.x+xOffset,c.box.max.y+above,c.mesh.position.z);p.prevPos.copy(p.pos);
  p.grounded=false;p.state='air';p.vVel=-CONST.maxFallSpeed;p.airGrav='foot';p.trampolineAir=true;
  const input=makeInput();p.rawInput=input;p.step(CONST.fixedStep,input,level);
  return c;
 };
 for(const above of [.01,.1,.45,.84]){
  const wood=drop(0,above);assert.equal(wood.alive,false,`terminal fall skipped wood lid at ${above}`);
  assert.equal(p.vVel,TUNING.crateBounce);checks++;
  const arrow=drop(1,above);assert.ok(arrow.alive);assert.equal(p.vVel,TUNING.arrowBounce);checks++;
  const metal=drop(2,above);assert.ok(metal.alive&&Math.abs(p.pos.y-metal.box.max.y)<.1);assert.equal(p.vVel,0);checks++;
  drop(3,above);assert.ok(p.totalDeaths>0||p.state==='dead','nitro ceased being lethal');checks++;
 }
 // Below-top side scrapes and a clear lateral miss must not earn a stomp.
 for(const [above,offset] of [[-.2,.7],[.01,1.3]]){
  const c=drop(0,above,offset);assert.ok(c.alive);assert.ok(p.vVel<=0);checks++;
 }
 assert.equal(JSON.stringify(TUNING),tuning);
 console.log(`PASS ${checks} terminal-speed crate contacts and misses; normal wood/arrow pops, solid metal and lethal nitro preserved.`);
},{levelEntry:{id:'__crate_fast_landing',name:data.name,data}});
