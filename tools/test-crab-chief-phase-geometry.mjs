import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime, chiefInput } from './crab-chief-harness.mjs';
await withChiefRuntime(async ({l,p,server})=>{
  const {ChiefPhaseGeometry}=await server.ssrLoadModule('/src/boss/phaseGeometry.ts');
  const originalBoss=l.boss; l.boss=null;let previous={};
  const tick=sample=>{const input=chiefInput(sample,previous);previous={...input};p.rawInput=input;p.step(1/60,input,l);l.update(1/60);p.commitRenderStep(l);input.consumeEdges();};
  const geometry=new ChiefPhaseGeometry(l.root);
  const originalRails=l.rails.length, originalGround=l.groundMeshes.length;
  const sand=l.groundMeshes.find(m=>(Array.isArray(m.material)?m.material[0]:m.material).userData.unitySandTileMetres)?.material;
  geometry.install({rails:l.rails,groundMeshes:l.groundMeshes,sandMaterial:Array.isArray(sand)?sand[0]:sand});
  assert.equal(l.rails.length,originalRails+1);assert.equal(l.groundMeshes.length,originalGround);
  assert.equal(geometry.tongueRail.grindable,false);
  const mouth=new THREE.Vector3(0,6.4,-23);
  geometry.setTongue(mouth,.5,.5);assert.equal(geometry.tongueActive,false);
  geometry.setTongue(mouth,1,1.2);assert.equal(geometry.tongueActive,true);
  assert.ok(geometry.tongueRail.pointAt(0).distanceTo(geometry.tongueEntry)<1e-5);
  assert.ok(geometry.tongueRail.pointAt(geometry.tongueRail.totalLength).distanceTo(mouth)<1e-5);
  assert.ok(geometry.tongueRail.totalLength>19);
  for(let i=1;i<geometry.tongueRail.points.length;i++)assert.ok(geometry.tongueRail.points[i].y>geometry.tongueRail.points[i-1].y);
  assert.equal(geometry.tongueRail.sharpCornerBetween(0,geometry.tongueRail.totalLength,.65),null);
  // Surface drawn below the rail, never an unsupported invisible grind line.
  const tonguePosition=geometry.tongueMesh.geometry.getAttribute('position');
  const tongueNormal=geometry.tongueMesh.geometry.getAttribute('normal');
  assert.ok(Array.from(tonguePosition.array).every(Number.isFinite));
  assert.ok(tongueNormal.getY(12*8+2)>.75,'upper tongue face winding points into the surface');
  // Normal Player movement must catch and climb the actual tongue identity.
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.12,1)});
  let tongueContact=false,tongueHigh=false,tongueMaxY=0,tongueFrames=0;
  for(let i=0;i<550;i++){
    tick({moveY:1,grindHeld:true});
    if(p.grindRail===geometry.tongueRail){tongueContact=true;tongueFrames++;tongueMaxY=Math.max(tongueMaxY,p.pos.y);if(p.pos.y>5)tongueHigh=true;}
    if(tongueHigh&&p.state==='air')break;
  }
  assert.ok(tongueContact,'normal Player controls never caught the real tongue Rail');
  assert.ok(tongueHigh,'normal grind failed to climb the tongue to the chief');
  assert.equal(p.balanceMeter,null,'assisted tongue still advertises a balance challenge');
  geometry.hideTongue();assert.equal(geometry.tongueRail.grindable,false);
  geometry.setRamp(.5,.5);assert.equal(geometry.rampActive,false);assert.equal(l.groundMeshes.length,originalGround);
  geometry.setRamp(1,1.2);assert.equal(geometry.rampActive,true);assert.equal(l.groundMeshes.length,originalGround+1);
  assert.equal(geometry.sandRamp.userData.vert,false);
  assert.ok(geometry.sandRamp.geometry.index.count/3<128,'mutable ramp accidentally enters the static ground BVH budget');
  const ray=new THREE.Raycaster(new THREE.Vector3(0,20,-11.5),new THREE.Vector3(0,-1,0));
  const rampHit=ray.intersectObject(geometry.sandRamp,false)[0];assert.ok(rampHit&&rampHit.point.y>1.4&&rampHit.point.y<1.6,'drawn sand slope and real ground diverged');
  const rampAtFront=geometry.sandRamp.geometry.getAttribute('position').getY(0);assert.equal(rampAtFront,0);
  // Actual production Player, ordinary supported run-up then held/released
  // board ollie near the lip. Fixture spawn is arranged before input begins.
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.12,7)});
  const flight=[];let released=false,reachedRamp=false;
  for(let i=0;i<450;i++){
    const onRamp=p.groundHit?.mesh===geometry.sandRamp;
    if(onRamp)reachedRamp=true;
    if(!released&&p.pos.z<-17)released=true;
    tick({moveY:1,jumpHeld:!released,spinHeld:released,spinPressed:released&&p.state==='air'});
    if(p.pos.z<-17&&p.pos.z>-25)flight.push({frame:i,z:p.pos.z,y:p.pos.y,speed:p.speed,state:p.state,onRamp});
    if(p.pos.z<-24)break;
  }
  assert.ok(reachedRamp,'production player never rode the formed sand ramp');
  assert.ok(flight.some(f=>f.state==='air'&&f.y>4.2),'sand kicker produced no earned air');
  const naturalFlight=[];
  p.respawn(l,true,false,{position:new THREE.Vector3(0,.12,7)});
  for(let i=0;i<450;i++){
    tick({moveY:1,jumpHeld:true,spinPressed:p.state==='air'});
    if(p.pos.z<-17&&p.pos.z>-25)naturalFlight.push({frame:i,z:p.pos.z,y:p.pos.y,speed:p.speed,state:p.state});
    if(p.pos.z<-24)break;
  }
  assert.ok(naturalFlight.some(f=>f.state==='air'&&f.y>4.1),'speed alone never produced automatic ramp launch');
  assert.ok(naturalFlight.some(f=>f.state==='air'&&f.y>=4&&Math.abs(f.z+24)<3.3),'speed-only launch never reaches the intended upper-chief spin region');
  console.log(JSON.stringify({naturalRampFlight:naturalFlight.filter((_,i)=>i%8===0),tongueContact,tongueHigh,tongueMaxY,tongueGrindSeconds:tongueFrames/60,tongueLength:geometry.tongueRail.totalLength,tongueMouth:mouth.toArray(),launchPoint:geometry.launchPoint.toArray(),rampFlight:flight.filter((_,i)=>i%8===0)},null,2));
  geometry.reset();assert.equal(geometry.rampActive,false);assert.equal(geometry.tongueActive,false);assert.equal(l.groundMeshes.length,originalGround);
  geometry.dispose();assert.equal(l.rails.length,originalRails);assert.equal(l.groundMeshes.length,originalGround);
  assert.ok(!l.root.children.includes(geometry.root)); l.boss=originalBoss;
  console.log('Chief phase geometry: production uphill Rail, native sand kicker, earned ramp air and reset/dispose passed.');
});
