// Restored native player collision, with no level-specific exceptions.
import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(({THREE,Level,Player,CONST})=>{
 let supports=0,walls=0;
 for(const id of ['native-surface-fixture','treehouse-trail','waterpark-cup']){
  const scene=new THREE.Scene(),level=new Level(scene,{id,name:id,data:{v:1,name:id,spawn:[0,.02,4],killY:-20,components:[
   {t:'platform',p:[0,-.5,0],s:[30,1,30]},
   {t:'mesh',p:[0,0,0],vertices:[-2,1.8,.4,2,1.8,.4,2,2.6,-.4,-2,2.6,-.4],indices:[0,1,2,0,2,3],solid:false,doubleSided:true,nm:'Scenery above native floor'},
   {t:'platform',p:[6,-.2,0],s:[3,1,3],nm:'Native low step'},
   {t:'gate',p:[12,0,-12]},
  ]}}),p=new Player(scene);p.enterLevel(id);p.rawInput=makeInput();
  try{
   level.prepareWorldSolids();assert.ok(level.worldSolids.surfaces.size>0,'debris retains shared geometry');
   assert.equal(level.groundMeshes.some(m=>m.userData.worldSolidProxy),false,'no level gets extra scenery floors');
   for(const [x,y]of [[0,0],[6,.3]]){
    p.respawn(level,true,false,{position:new THREE.Vector3(x,.02,0)});
    assert.ok(Math.abs(p.queryGround(level).y-y)<1e-6,'native floor and step own support');
    for(let i=0;i<30;i++){p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);}
    assert.ok(p.grounded&&!p.isBailing&&Math.abs(p.pos.y-y)<.02);supports++;
   }
  }finally{level.dispose();}
 }
 for(const yaw of [0,90,180,270])for(const kind of ['platform','wall','wallpath']){
  const a=yaw*Math.PI/180,h=new THREE.Vector3(-Math.sin(a),0,-Math.cos(a));
  const barrier=kind==='wallpath'?{t:kind,p:[0,0,0],pts:[[-3*Math.cos(a),3*Math.sin(a)],[3*Math.cos(a),-3*Math.sin(a)]],w:.2,rise:3}:
   {t:kind,p:[0,kind==='platform'?1.5:0,0],s:[6,3,.2],yaw};
  const scene=new THREE.Scene(),level=new Level(scene,{id:'native-wall-fixture',name:kind,data:{v:1,name:kind,spawn:[0,.02,4],killY:-20,
   components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},barrier,{t:'gate',p:[12,0,-12]}]}}),p=new Player(scene);
  p.enterLevel('native-wall-fixture');p.rawInput=makeInput();p.respawn(level,true,false,{position:h.clone().multiplyScalar(-4).setY(.02),heading:h});
  // Initial fixture velocity is world-aligned, as in the existing native
  // halfpipe cases; respawn's facing hint does not set the free-skate axes.
  p.axisF.copy(h);p.axisL.set(h.z,0,-h.x);
  p.freeSkate=true;p.speed=23;p.skateMountT=-1;p.camDir.copy(h);
  try{
   let bailed=false;const trace=[];
   // Keep the earned approach heading; a fixed Up press would steer a
   // rotated fixture toward the level's default camera lane before impact.
   for(let i=0;i<16;i++){p.step(CONST.fixedStep,makeInput({jumpHeld:true}),level);level.update(CONST.fixedStep);bailed||=p.isBailing;
    trace.push({position:p.pos.toArray(),heading:p.axisF.toArray(),speed:p.speed,state:p.state,grounded:p.grounded});
    assert.ok(p.pos.dot(h)<0,`${kind}/${yaw}: native barrier cannot be crossed`);
   }
   assert.ok(bailed,`${kind}/${yaw}: native frontal impact must bail ${JSON.stringify(trace)}`);walls++;
  }finally{level.dispose();}
 }
 console.log(`PASS ${supports} floor/step cases across three level IDs and ${walls} rotated native wall contacts.`);
});
