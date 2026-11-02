import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Scoped rail balance',spawn:[0,.1,10],killY:-30,components:[{t:'platform',p:[0,-1,-80],s:[50,2,240]},{t:'rail',p:[0,7,25],pts:[[0,0],[0,-140]]},{t:'gate',p:[0,0,-180]}],
 skateRace:{v:1,racers:8,seed:1,line:[[0,0,15,30],[0,0,-180,30]],jumps:[],finishWidth:20,originalLength:195}};
await withSkateRuntime(async({THREE,server,scene,player:p,level,step,TUNING,CONST})=>{
 const tuning=JSON.stringify(TUNING),rail=level.rails[0];scene.updateMatrixWorld(true);
 const duration=(scale,held=0)=>{
  level.skateRace.grindBalanceScale=scale;
  const position=rail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=rail.tangentAt(2);
  p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
  p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
  // Identical entry fixture isolates native balance response from the catch
  // window; the course tests separately cover real rail captures.
  p.enterGrind(rail,rail.closest(position),level);assert.equal(p.state,'grind');
  p.balance=TUNING.balanceEntryLean;p.balanceVel=0;p.noisePhase=0;
  let frames=0;while(p.state==='grind'&&frames<480){step(makeInput({grindHeld:true,moveX:held}));frames++;}
  assert.ok(p.isBailing,'A non-countered grind still has a real failure boundary');return frames*CONST.fixedStep;
 };
 const normal=duration(undefined),explicitNormal=duration(1),easier=duration(.55),wrong=duration(.55,1);
 assert.equal(normal,explicitNormal);assert.ok(easier>normal*1.3);assert.ok(wrong<easier*.65);
 assert.equal(JSON.stringify(TUNING),tuning);
 console.log(JSON.stringify({normal,explicitNormal,easier,wrong,tuningUnchanged:true}));
},{levelEntry:{id:'scoped-rail-balance',name:data.name,data}});
