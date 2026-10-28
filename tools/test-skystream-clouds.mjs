import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {sampleLoop,createLoopMeshData,loopAngleAt,stepLoopMotion,LOOP_TURN}=await server.ssrLoadModule('/src/loopRide.ts');
 const {LoopCameraFraming}=await server.ssrLoadModule('/src/loopCamera.ts');
 const {TUNING}=await server.ssrLoadModule('/src/tuning.ts');
 const shape={radius:34,width:14,offset:-24,kind:'wall'};
 const forces={gravity:TUNING.groundGravity,pump:TUNING.pipePumpGain+TUNING.chargeBoost,friction:TUNING.pipeFriction,drag:TUNING.windDrag,braking:TUNING.turnaround};
 for(let i=0;i<=720;i++){
  const angle=i/720*LOOP_TURN,s=sampleLoop(shape,angle),normal=new THREE.Vector3(...s.normal),tangent=new THREE.Vector3(...s.tangent);
  assert.ok(Math.abs(normal.length()-1)<1e-10&&Math.abs(tangent.length()-1)<1e-10);
  assert.ok(Math.abs(normal.dot(tangent))<1e-10,'The wheel normal is perpendicular to travel');
  const left=new THREE.Vector3(...sampleLoop(shape,angle,-7).point),right=new THREE.Vector3(...sampleLoop(shape,angle,7).point);
  assert.ok(Math.abs(left.distanceTo(right)-14)<1e-9,'The vertical band retains its full road width');
  if(angle>=Math.PI/4&&angle<=Math.PI*1.75)assert.ok(Math.abs(normal.y)<1e-10,'270 degrees must be vertical wall, not a flat Saturn ring');
  if(i>0&&i<720)assert.ok(Math.abs(loopAngleAt(shape,s.point)-angle)<1e-9);
 }
 for(const angle of [0,LOOP_TURN])assert.ok(sampleLoop(shape,angle).normal[1]>.999999&&Math.abs(sampleLoop(shape,angle).tangent[1])<1e-9,'Flat, tangent-continuous entry and exit');
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*1.9,LOOP_TURN]){
  const s=sampleLoop(shape,angle),subject=new THREE.Vector3(...s.point),camera=new THREE.PerspectiveCamera(49,16/9,.1,500);
  camera.position.copy(subject).add(new THREE.Vector3(0,3,5));camera.lookAt(subject);
  new LoopCameraFraming().apply(camera,{normal:new THREE.Vector3(...s.normal),tangent:new THREE.Vector3(...s.tangent)},subject,{distance:5,height:3,pitch:12},1/60);
  assert.ok(camera.up.dot(new THREE.Vector3(...s.normal))>.99999,'The wall-ride camera follows the banked horizon');
  assert.ok(Math.abs(camera.position.distanceTo(subject)-Math.hypot(5,3))<1e-8);
 }
 const mesh=createLoopMeshData(34,14,-24,256,'wall');
 for(let i=0;i<mesh.indices.length;i+=3){
  const [a,b,c]=mesh.indices.slice(i,i+3).map(index=>new THREE.Vector3(...mesh.vertices.slice(index*3,index*3+3)));
  const n=new THREE.Vector3(...mesh.normals.slice(mesh.indices[i]*3,mesh.indices[i]*3+3));
  assert.ok(b.sub(a).cross(c.sub(a)).dot(n)>0,'Every face points toward the riding side');
 }
 for(const dt of [1/30,1/60,1/120]){
  let m={angle:0,speed:50};
  for(let i=0;i<2000&&!m.complete&&m.attached!==false;i++)m=stepLoopMotion(shape,m,dt,1,false,forces);
  assert.ok(m.complete&&m.speed>30,'Normal carried momentum completes the whole band');
 }
 const {createCloudRoad}=await server.ssrLoadModule('/src/cloudRoad.ts');
 const sections=Array.from({length:21},(_,i)=>({point:new THREE.Vector3(0,0,-i),normal:new THREE.Vector3(0,1,0),across:new THREE.Vector3(1,0,0),halfWidth:7}));
 const root=createCloudRoad(sections),ray=new THREE.Raycaster();root.updateMatrixWorld(true);
 for(let z=-1;z>-19;z-=.35)for(const x of [-3,0,3]){
  ray.set(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(root,true)[0];
  assert.ok(hit&&Math.abs(hit.point.y)<.25,'Cloud tops stay visually close to the separate smooth contact layer');
 }
 let triangles=0;root.traverse(o=>{if(!o.isMesh)return;assert.ok(o.userData.visualOnly);const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;
  assert.ok([...p.array,...n.array].every(Number.isFinite));triangles+=o.geometry.index.count/3;o.geometry.dispose();});
 assert.ok(triangles>4000,'Native cloud detail is authored geometry');
 root.children[0].material.dispose();
 console.log('PASS: vertical wedding band, continuous entry/exit, inward winding, 30/60/120 Hz travel, smooth visual clearance, full-detail non-colliding billows.');
}finally{await server.close();}
