// A compressed limb and a pulled limb must not play the same squash. Exercise
// production contact waves against known posed axes, including later hits.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import {createServer} from 'vite';
const snapshot=process.argv.find(a=>a.startsWith('--source-snapshot='))?.slice(18);
const reportOnly=process.argv.includes('--report-only');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true},plugins:snapshot?[{
  name:'saved-impact-strain',enforce:'pre',async load(id){
    const rel=path.relative(process.cwd(),id.split('?')[0]);
    if(['src/character/bailMotion.ts','src/character/bailContactPose.ts'].includes(rel))return readFile(path.join(snapshot,rel),'utf8');
  },
}]:[]});
try{
 const {BailMotion}=await server.ssrLoadModule('/src/character/bailMotion.ts');
 const {sampleBailSegmentLoad}=await server.ssrLoadModule('/src/character/bailContactPose.ts');
 const zero=new THREE.Vector3(),q=new THREE.Quaternion(),normal=new THREE.Vector3(0,1,0);
 const root=new THREE.Group(),joints=Array.from({length:14},()=>new THREE.Object3D());
 const positions=[[0,0,0],[0,.8,0],[-.3,.6,0],[-.5,.1,0],[-.7,-.4,0],[.3,.6,0],[.5,.1,0],[.7,-.4,0],[-.2,0,0],[-.2,-.5,0],[-.2,-1,0],[.2,0,0],[.2,-.5,0],[.2,-1,0]];
 joints.forEach((node,i)=>{root.add(node);node.position.fromArray(positions[i]);});root.updateMatrixWorld(true);
 const fresh=()=>{const m=new BailMotion();m.begin('air',zero,414);for(let i=0;i<600;i++)m.step(1/120,q,zero,true,0,0,1);return m;};
 const impact=(m,joint,impulse)=>m.impact(10,normal,new THREE.Vector3(0,-.8,0),joint,{joints,point:new THREE.Vector3().setFromMatrixPosition(joints[joint].matrixWorld),impulse});
 const rows=[];
 for(const [name,force] of [['compression',new THREE.Vector3(0,12,0)],['tension',new THREE.Vector3(0,-12,0)],['glancing',new THREE.Vector3(12,0,0)]]){
   const m=fresh();impact(m,13,force);let min=0,max=0,first=0,firstNear=null,firstFar=null;
   for(let frame=0;frame<600;frame++){
     m.step(1/120,q,zero,true,0,0,1);
     if(frame===0)first=m.strainVelocity[7];
     if(firstNear===null&&Math.abs(m.strain[7])>1e-5)firstNear=(frame+1)/120;
     if(firstFar===null&&Math.abs(m.strain[8])>1e-5)firstFar=(frame+1)/120;
     min=Math.min(min,m.strain[7]);max=Math.max(max,m.strain[7]);
   }
   const settle=Math.max(...m.strain.map(Math.abs),...m.strainVelocity.map(Math.abs));
   rows.push({name,firstVelocity:first,minStrain:min,maxStrain:max,firstNear,firstFar,settle});
   assert.ok(settle<1e-8);assert.ok(firstFar>firstNear+.04,'opposite limb lost its delayed reaction');
 }
 if(!reportOnly){
   assert.ok(rows[0].firstVelocity < -12,'compressive landing needs a readable crush');
   assert.ok(rows[1].firstVelocity > 8,'pulling force must lengthen before recoiling');
   assert.ok(Math.abs(rows[2].firstVelocity)<Math.abs(rows[0].firstVelocity)*.3,'glancing hit should bend more than it shortens');
   assert.ok(rows[0].maxStrain>.02&&rows[1].minStrain<-.01,'elastic recoil missing');
   // Driving the knee toward a trailing ankle compresses the same segment
   // from its other end; the impulse direction reverses with the struck end.
   const proximal=fresh();impact(proximal,12,new THREE.Vector3(0,-12,0));
   proximal.step(1/120,q,zero,true,0,0,1);
   assert.ok(Math.abs(proximal.strainVelocity[7]-rows[0].firstVelocity)<1e-8,
     'proximal contact used the distal loading direction');
 }
 // Independent posed-axis oracle: rotations/translations preserve the axial
 // load, scaling/mirroring changes the physical direction but not its sign rule.
 let oracleCases=0,oracleError=0;
 if(sampleBailSegmentLoad){
   const start=joints[12],end=joints[13],impulse=new THREE.Vector3(0,12,0),a=new THREE.Vector3(),b=new THREE.Vector3();
   for(const scale of [new THREE.Vector3(1,1,1),new THREE.Vector3(-1.2,.7,1.4)])for(let i=0;i<24;i++){
     root.position.set(i*.2,-i*.1,3);root.rotation.set(i*.13,i*.07,-i*.11);root.scale.copy(scale);root.updateMatrixWorld(true);
     const rotation=new THREE.Quaternion().setFromEuler(root.rotation),force=impulse.clone().applyQuaternion(rotation);
     a.setFromMatrixPosition(start.matrixWorld);b.setFromMatrixPosition(end.matrixWorld).sub(a).normalize();
     const expected=b.dot(force.clone().normalize());
     for(const fromEnd of [false,true]){
       const load=sampleBailSegmentLoad(start,end,force,fromEnd);oracleError=Math.max(oracleError,Math.abs(load-expected*(fromEnd?1:-1)));oracleCases++;
     }
   }
   assert.ok(oracleError<1e-12);
   assert.equal(sampleBailSegmentLoad(null,end,impulse,true),null);
   assert.equal(sampleBailSegmentLoad(start,start,impulse,true),null);
   assert.equal(sampleBailSegmentLoad(start,end,zero,true),null);
   assert.equal(sampleBailSegmentLoad(start,end,new THREE.Vector3(NaN,0,0),true),null);
 }
 root.position.set(0,0,0);root.rotation.set(0,0,0);root.scale.set(1,1,1);root.updateMatrixWorld(true);
 // Opposing later hits retain the first pulse, stay bounded, and use the same
 // integrated trajectory with one 60 Hz or two 120 Hz updates per frame.
 const a=fresh(),b=fresh();let subdivisionError=0,minLength=1,maxLength=1,instantaneousChange=0;
 const buffers=Object.values(a).filter(ArrayBuffer.isView);
 for(let frame=0;frame<720;frame++){
   if(frame<180&&frame%3===0){
     const force=new THREE.Vector3(frame%9?0:12,frame%6?-12:12,0),joint=frame%12?13:4;
     const before=[...a.strain];for(const m of [a,b])impact(m,joint,force);
     instantaneousChange=Math.max(instantaneousChange,...a.strain.map((v,i)=>Math.abs(v-before[i])));
   }
   a.step(1/60,q,zero,frame>180,0,0,1);b.step(1/120,q,zero,frame>180,0,0,1);b.step(1/120,q,zero,frame>180,0,0,1);
   subdivisionError=Math.max(subdivisionError,...a.strain.map((v,i)=>Math.abs(v-b.strain[i])));
   for(const length of Object.values(a.deformations)){assert.ok(Number.isFinite(length));minLength=Math.min(minLength,length);maxLength=Math.max(maxLength,length);}
 }
 assert.equal(instantaneousChange,0,'contact teleported the current segment length');assert.ok(subdivisionError<1e-10);
 assert.ok(minLength>.65&&maxLength<1.35);assert.ok(Math.max(...a.strain.map(Math.abs),...a.strainVelocity.map(Math.abs))<1e-6);
 assert.ok(Object.values(a).filter(ArrayBuffer.isView).every((v,i)=>v===buffers[i]),'contact grew or replaced buffers');
 const result={passed:true,source:snapshot?'before':'after',rows,oracleCases,oracleError,subdivisionError,instantaneousChange,minLength,maxLength,retainedBytes:buffers.reduce((n,v)=>n+v.byteLength,0)};
 const report=process.argv.find(a=>a.startsWith('--report='))?.slice(9);if(report)await writeFile(report,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{await server.close();}
