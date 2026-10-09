import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {normalizeGameInput} from './blockworks-runner.mjs';

await withSkateRuntime(({THREE,Level,Player,CONST,TUNING})=>{
 const scene=new THREE.Scene(),level=new Level(scene,{id:'vert-launch-contact',name:'Vert launch contact',data:{v:1,name:'Vert launch contact',spawn:[0,0,5],killY:-200,
  components:[{t:'platform',p:[0,-100,0],s:[100,1,100]},{t:'gate',p:[0,-99.5,-40]}]}});
 const p=new Player(scene);p.rawInput=makeInput();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(100,100,.1),new THREE.MeshBasicMaterial());wall.rotation.x=-Math.asin(.1);
 scene.add(wall);level.worldSolids.add(wall,{name:'Takeoff transition'});
 const results=[];
 for(const locked of [false,true]){
  p.respawn(level,true);p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=p.vertAir=true;p.pipeHang=locked;p.parkControls=false;
  p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.vertNormal.set(0,0,1);p.speed=0;p.vertLatVel=3;p.vVel=16;
  const radius=Math.max(p.hitboxHalf.x,p.hitboxHalf.z),z=(radius+.06-.1*radius)/Math.sqrt(.99);
  p.worldStepOrigin.set(0,0,z);p.prevPos.copy(p.worldStepOrigin);
  // The swept path contains the last climbing movement, while the new air
  // velocity has already removed that wall-normal component.
  p.pos.copy(p.worldStepOrigin).add(new THREE.Vector3(-3,16,-2.5).multiplyScalar(CONST.fixedStep));
  p.resolveWorldContact(level);
  assert.equal(p.worldContact.surface?.mesh,wall,'the actual capsule must still resolve the wall');
  assert.equal(p.isBailing,false);
  const velocity=p.axisF.clone().multiplyScalar(p.speed).add(new THREE.Vector3(-p.vertLatVel,p.vVel,0));
  results.push({position:p.pos.clone(),velocity});
  if(locked)assert.ok(velocity.distanceTo(new THREE.Vector3(-3,16,0))<1e-8,'a resolved vert launch must keep its current air velocity');
  else assert.ok(velocity.z< -1,'the old displacement-based response must reproduce outward carry');
 }
 assert.ok(results[0].position.distanceTo(results[1].position)<1e-10,'velocity ownership must not weaken the geometric sweep');
 const endWall=new THREE.Mesh(new THREE.BoxGeometry(.1,100,100),new THREE.MeshBasicMaterial());endWall.position.x=-1;scene.add(endWall);level.worldSolids.add(endWall,{name:'Independent end wall'});
 p.respawn(level,true);p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=p.vertAir=p.pipeHang=true;p.parkControls=false;
 p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.vertNormal.set(0,0,1);p.speed=0;p.vertLatVel=8;p.vVel=4;
 p.worldStepOrigin.set(-.41,0,2);p.prevPos.copy(p.worldStepOrigin);p.pos.copy(p.worldStepOrigin).add(new THREE.Vector3(-8,4,0).multiplyScalar(CONST.fixedStep));
 p.resolveWorldContact(level);
 assert.equal(p.worldContact.surface?.mesh,endWall,'real carried air must still hit an independent wall');
 assert.ok(p.pos.x>=-.455);assert.equal(p.vertLatVel,0);assert.ok(Math.abs(p.speed)<1e-8);assert.ok(Math.abs(p.vVel-4)<1e-8);
 level.dispose();for(const mesh of [wall,endWall]){mesh.geometry.dispose();mesh.material.dispose();}

 const pipeData={v:1,name:'Supported pump ownership',spawn:[2,.05,-40],killY:-30,components:[
  {t:'vertramp',p:[0,0,0],pts:[[0,0,0,0],[2,-40,0,0],[0,-80,0,0]],vkind:'half',curve:'spline',rise:3.6,w:4,arc:90,deck:1.2,rails:false,edgeGrinding:false,vert:true},
  {t:'vertramp',p:[40,0,0],pts:[[0,0,0,0],[2,-40,0,0],[0,-80,0,0]],vkind:'half',curve:'spline',rise:3.6,w:4,arc:90,deck:1.2,rails:false,edgeGrinding:false,vert:false},
  {t:'platform',p:[100,-.5,-40],s:[20,1,80]},{t:'gate',p:[100,0,-70]},
 ]};
 const pipes=new Level(new THREE.Scene(),{id:'supported-pump',name:pipeData.name,data:pipeData}),rider=new Player(pipes.scene);rider.rawInput=makeInput();
 for(const [x,expected] of [[2,true],[42,false],[100,false]]){
  rider.respawn(pipes,true,false,{position:new THREE.Vector3(x,.02,-40),heading:new THREE.Vector3(0,0,-1)});
  rider.groundHit=rider.queryGround(pipes);rider.pos.y=rider.groundHit.y;rider.prevPos.copy(rider.pos);rider.rideNormal.copy(rider.groundHit.normal);
  rider.state='ride';rider.grounded=rider.freeSkate=true;rider.speed=8;rider.skateMountT=-1;
  rider.jumpReleaseRearmRequired=true;rider.charging=false;rider.chargeTimer=0;
  if(x!==100){assert.equal(rider.groundHit.halfpipe,undefined);assert.equal(rider.groundHit.mesh.userData.vertRampMesh,true);}
  let previous=makeInput();
  const tick=held=>{const input=normalizeGameInput({moveY:1,jumpHeld:held},previous);previous={...input};rider.step(CONST.fixedStep,input,pipes);pipes.update(CONST.fixedStep);};
  for(let i=0;i<8;i++)tick(true);
  assert.equal(rider.charging,expected,'only a supported vert pipe can reuse the held air press for pumping');
  assert.equal(rider.jumpReleaseRearmRequired,true);
  tick(false);assert.equal(rider.state,'ride');assert.equal(rider.grounded,true);assert.equal(rider.vVel,0,'the immediate air-owned release remains consumed');
  assert.equal(rider.jumpReleaseRearmRequired,false);
  if(expected){
   for(let i=0;i<25;i++)tick(true);assert.ok(rider.charging&&rider.chargeTimer>=TUNING.jumpChargeTime);
   rider.jumpReleaseRearmRequired=true;rider.charging=false;rider.chargeTimer=0;
   for(let i=0;i<30;i++)tick(true);
   assert.ok(rider.charging&&rider.chargeTimer>=TUNING.jumpChargeTime&&!rider.jumpReleaseRearmRequired,
    'a full supported pump must earn a fresh release without lifting the held button');
  }
 }
 pipes.dispose();
});
console.log('PASS vert takeoff velocity and identical sweeps; held-pump ownership on curved vert, road-marked and ordinary floors.');
