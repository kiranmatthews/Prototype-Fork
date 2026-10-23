// World-frame invariance and actual acceleration response of the production
// secondary-motion rig. Optional snapshot loading leaves the checkout intact.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const snapshot=process.argv.find(x=>x.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true},plugins:snapshot?[{
 name:'saved-bail-inertia',enforce:'pre',async load(id){const rel=path.relative(process.cwd(),id.split('?')[0]);if(rel==='src/character/bailMotion.ts')return readFile(path.join(snapshot,rel),'utf8');}
}]:[]});
try{
 const {BailMotion}=await server.ssrLoadModule('/src/character/bailMotion.ts');
 const a=new BailMotion(),b=new BailMotion(),q=new THREE.Quaternion(),qb=new THREE.Quaternion();
 const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),1.27);
 const spin=new THREE.Vector3(7,2,-4),rotatedSpin=spin.clone().applyQuaternion(yaw);
 const travel=new THREE.Vector3(0,2,-12),rotatedTravel=travel.clone().applyQuaternion(yaw);
 a.begin('air',spin,25,false,travel);b.begin('air',rotatedSpin,25,false,rotatedTravel);
 let maxPoseError=0,maxLengthError=0;
 for(let i=0;i<180;i++){
  q.setFromEuler(new THREE.Euler(i*.07,i*.02,Math.sin(i*.03)));qb.copy(yaw).multiply(q);
  spin.set(7*Math.cos(i*.03),2,-4*Math.sin(i*.05));rotatedSpin.copy(spin).applyQuaternion(yaw);
  travel.set(3*Math.sin(i*.03),2-i*.08,-12+i*.03);rotatedTravel.copy(travel).applyQuaternion(yaw);
  if(i===35||i===75)for(const m of [a,b])m.impact(13,new THREE.Vector3(.6,.8,0),new THREE.Vector3(.4,-.2,0));
  a.step(1/60,q,spin,false,0,0,1,travel);b.step(1/60,qb,rotatedSpin,false,0,0,1,rotatedTravel);
  for(let j=0;j<a.angles.length;j++)maxPoseError=Math.max(maxPoseError,Math.abs(a.angles[j]-b.angles[j]));
  for(const k in a.deformations)maxLengthError=Math.max(maxLengthError,Math.abs(a.deformations[k]-b.deformations[k]));
 }
 q.identity();spin.set(0,0,0);travel.set(0,0,-12);
 a.begin('air',spin,17,false,travel);b.begin('air',spin,17,false,travel);
 const coasting=travel.clone();let armLag=0,torsoLag=0,sideLag=0;
 for(let i=0;i<30;i++){
  if(i>=10)travel.z=Math.min(0,travel.z+.6);
  a.step(1/60,q,spin,false,0,0,1,travel);b.step(1/60,q,spin,false,0,0,1,coasting);
  armLag=Math.max(armLag,a.angles[6]-b.angles[6]);torsoLag=Math.max(torsoLag,b.angles[0]-a.angles[0]);
  sideLag=Math.max(sideLag,Math.abs(a.angles[8]-b.angles[8]));
 }
 for(let i=0;i<600;i++)a.step(1/60,q,spin,true,0,0,1,travel);
 const settledSpeed=Math.max(...a.velocity.map(Math.abs));
 const settledLength=Math.max(...Object.values(a.deformations).map(v=>Math.abs(v-1)));
 // A newly attached velocity stream is a baseline, not an impact from zero.
 a.begin('side',spin,99);b.begin('side',spin,99);travel.set(20,-8,-30);
 a.step(1/60,q,spin,false,0,0,1,travel);b.step(1/60,q,spin,false,0,0,1);
 const attachError=Math.max(...a.angles.map((v,i)=>Math.abs(v-b.angles[i])));
 // Warm the production spring update with changing orientations and impacts.
 const times=[];spin.set(4,2,3);travel.set(2,-4,-8);
 for(let trial=-12;trial<9;trial++){
  a.begin('forward',spin,trial+100,false,travel);const start=performance.now();
  for(let i=0;i<3000;i++){
   q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP,i*.01);
   if(i%45===0)a.impact(12,new THREE.Vector3(0,1,0));
   a.step(1/60,q,spin,i%90>60,0,0,1,travel);
  }
  if(trial>=0)times.push((performance.now()-start)/3000);
 }
 times.sort((a,b)=>a-b);
 const result={source:snapshot?'before':'after',maxPoseError,maxLengthError,armLag,torsoLag,sideLag,settledSpeed,settledLength,attachError,
  cpu:{scope:'Production BailMotion.step plus orientation and periodic impact; CPU only, 9 x 3000 warm samples. No render, GPU or player collision.',medianStepMs:times[4],samples:times}};
 console.log(JSON.stringify(result,null,2));
 if(!process.argv.includes('--report')){
  assert.ok(maxPoseError<1e-8&&maxLengthError<1e-8,'rotating the whole scene changed the physical reaction');
  assert.ok(armLag>.035&&torsoLag>.01,'braking did not create opposite arm/torso inertia');
  assert.ok(sideLag<1e-8,'straight braking invented a sideways impulse');
  assert.ok(settledSpeed<1e-4&&settledLength<1e-4,'secondary motion kept cycling after rest');
  assert.ok(attachError<1e-9,'new velocity stream produced a false impact');
 }
}finally{await server.close();}
