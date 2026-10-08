import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const report={roundtrips:0,contacts:[]};
await withSkateRuntime(async({THREE,Level,Player,CONST})=>{
 const scene=new THREE.Scene(),level=new Level(scene,{id:'vert-momentum',name:'Vert momentum',data:{v:1,name:'Vert momentum',spawn:[0,0,0],killY:-200,
  components:[{t:'platform',p:[0,-100,0],s:[100,1,100]},{t:'gate',p:[0,-99.5,-40]}]}});
 const p=new Player(scene);p.rawInput=makeInput();
 const vector=()=>{
  const v=p.axisF.clone().multiplyScalar(p.speed).setY(p.vVel);
  if(p.vertAir){v.x-=p.vertNormal.z*p.vertLatVel;v.z+=p.vertNormal.x*p.vertLatVel;}
  if(p.grindExitAir&&p.airFromSkate&&!p.isBailing)v.addScaledVector(p.axisL,p.grindAirLat);
  return v.addScaledVector(p.axisL,p.slideAirLat);
 };
 const close=(a,b,label)=>assert.ok(a.distanceTo(b)<1e-8,`${label}: ${a.toArray()} / ${b.toArray()}`);
 for(const yaw of [0,.6,Math.PI/2,Math.PI])for(const heading of [-1.3,-.2,0,.4,Math.PI/2]){
  p.vertAir=true;p.parkControls=false;p.state='air';p.grounded=false;
  p.vertNormal.set(Math.sin(yaw),0,Math.cos(yaw));p.axisF.set(Math.sin(yaw+heading),0,Math.cos(yaw+heading));p.axisL.set(p.axisF.z,0,-p.axisF.x);
  const target=new THREE.Vector3(7*Math.cos(yaw)-2*Math.sin(yaw),-5,7*Math.sin(yaw)+2*Math.cos(yaw));p.vVel=target.y;
  for(let i=0;i<100;i++){p.setCollisionPlanarVelocity(target);close(vector(),target,'a collision must encode the same velocity exactly once');report.roundtrips++;}
  p.vertTracked=true;p.vertLossT=.31;p.trackVertWall({groundMeshes:[]},CONST.fixedStep);
  assert.equal(p.vertAir,false);close(p.axisF.clone().multiplyScalar(p.speed).setY(p.vVel),target,'ending vert must retain the complete contact velocity');
 }
 const wall=new THREE.Mesh(new THREE.BoxGeometry(100,100,.1),new THREE.MeshBasicMaterial());wall.rotation.x=-Math.asin(.6);wall.name='Sloped contact';scene.add(wall);level.worldSolids.add(wall,{name:wall.name});
 for(const mode of ['vert','grind','slide'])for(const displacement of [true,false])for(const legacy of [true,false]){
  p.respawn(level,true);p.state='air';p.grounded=false;p.vertAir=p.pipeHang=mode==='vert';p.parkControls=false;p.freeSkate=p.airFromSkate=true;
  p.vertNormal.set(0,0,1);p.axisF.set(0,0,-1);p.axisL.set(-1,0,0);p.speed=0;p.vVel=-5;
  p.vertLatVel=mode==='vert'?-8:0;p.grindExitAir=mode==='grind';p.grindAirLat=mode==='grind'?-8:0;p.slideAirLat=mode==='slide'?-8:0;
  const radius=Math.max(p.hitboxHalf.x,p.hitboxHalf.z),z=(radius+.09-.6*radius)/.8;
  p.worldStepOrigin.set(0,0,z);p.prevPos.copy(p.worldStepOrigin);const incoming=vector();p.pos.copy(p.worldStepOrigin).addScaledVector(incoming,CONST.fixedStep);
  const encode=p.setCollisionPlanarVelocity;
  if(legacy)p.setCollisionPlanarVelocity=function(v){const speed=Math.hypot(v.x,v.z),sign=v.x*this.axisF.x+v.z*this.axisF.z<0?-1:1;this.speed=speed*sign;this.axisF.set(v.x/this.speed,0,v.z/this.speed);this.axisL.set(this.axisF.z,0,-this.axisF.x);};
  try{p.resolveWorldContact(level,displacement);}finally{p.setCollisionPlanarVelocity=encode;}
  assert.equal(p.isBailing,false);assert.equal(p.worldContact.surface?.mesh,wall,'exercise the actual shared collider');
  const expected=incoming.clone().addScaledVector(p.worldContact.normal,-incoming.dot(p.worldContact.normal)),stored=vector();
  if(legacy)assert.ok(stored.distanceTo(expected)>1,'the previous write-back must reproduce duplicated or rotated carry');
  else{close(stored,expected,'actual collision response preserves both channels');assert.ok(stored.lengthSq()<=incoming.lengthSq()+1e-8);}
  report.contacts.push({mode,displacement,legacy,incoming:incoming.toArray(),expected:expected.toArray(),stored:stored.toArray(),normal:p.worldContact.normal.toArray()});
 }
 level.dispose();wall.geometry.dispose();wall.material.dispose();
});
await writeFile(join(tmpdir(),'world-vert-momentum.json'),JSON.stringify(report,null,2));
console.log(`PASS ${report.roundtrips} exact velocity round-trips, complete vert handoffs and ${report.contacts.length} real vert/grind/slide contacts with failing legacy controls.`);
