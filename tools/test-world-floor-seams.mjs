import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try{
 const {WorldSolids,solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
 let checks=0;
 for(const yaw of [0,.5,Math.PI/2,Math.PI]){
  const rotate=v=>v.applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
  const query={low:.4,high:1.4,radius:.4,ignoreGround:true,supportNormal:new THREE.Vector3(0,1,0)};
  const ribbon=height=>{
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-5,height,0,5,height,0,-5,height-.5,-8,5,height-.5,-8],3));geometry.setIndex([0,1,2,1,3,2]);
   const mesh=new THREE.Mesh(geometry);mesh.rotation.y=yaw;return mesh;
  };
  for(const height of [.2,.6,.8,1.4]){
   const world=new WorldSolids(),mesh=ribbon(height);world.add(mesh);
   const from=rotate(new THREE.Vector3(0,0,1)),to=rotate(new THREE.Vector3(0,0,-1));
   const prior=world.cast(from,to,query,solidContact());
   const native=world.cast(from,to,{...query,groundStep:.8},solidContact());
   if(height<=.8){assert.equal(native,false,'native floor-follow owns the walkable lip');if(height===.6)assert.equal(prior,true,'reproduce the false ribbon-edge wall');}
   else assert.equal(native,true,'a high overhang must still block the body');
   const belowFrom=rotate(new THREE.Vector3(0,-3,-2)),belowTo=rotate(new THREE.Vector3(0,height-1.5,-2));
   assert.ok(world.cast(belowFrom,belowTo,{...query,groundStep:.8},solidContact()),'underside stays solid');
   checks+=2;world.dispose();mesh.geometry.dispose();mesh.material.dispose();
  }
  const world=new WorldSolids(),box=new THREE.Mesh(new THREE.BoxGeometry(10,.6,8));box.position.copy(rotate(new THREE.Vector3(0,.3,-4)));box.rotation.y=yaw;world.add(box);
  assert.ok(world.cast(rotate(new THREE.Vector3(0,0,1)),rotate(new THREE.Vector3(0,0,-1)),{...query,groundStep:.8},solidContact()),'independent vertical box faces stay solid');checks++;
  world.dispose();box.geometry.dispose();box.material.dispose();
  // On takeoff the upright capsule can touch a tessellation edge even while
  // the feet and velocity are leaving the supporting ramp's plane.
  const slopeWorld=new WorldSolids(),geometry=new THREE.BufferGeometry();
  const vertices=[],indices=[];
  for(let i=0;i<=8;i++)for(const x of [-5,5])vertices.push(x,i*.78,-i);
  for(let i=0;i<8;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  const slope=new THREE.Mesh(geometry);slope.rotation.y=yaw;slopeWorld.add(slope);
  const takeoff=rotate(new THREE.Vector3(0,1.55*.78,-1.55)),air=rotate(new THREE.Vector3(0,1.55*.78+.32,-1.72));
  const airQuery={...query,low:.5,radius:.5};
  assert.ok(slopeWorld.cast(takeoff,air,airQuery,solidContact()),'reproduce the old false takeoff-edge contact');
  assert.equal(slopeWorld.cast(takeoff,air,{...airQuery,groundStep:0},solidContact()),false,'a jump away from its ramp must retain its launch velocity');
  assert.ok(slopeWorld.cast(rotate(new THREE.Vector3(0,-2,-2)),rotate(new THREE.Vector3(0,3,-2)),{...query,groundStep:0},solidContact()),'a fast upward crossing from below must still hit the underside');
  checks+=2;slopeWorld.dispose();geometry.dispose();slope.material.dispose();
 }
 console.log(`PASS ${checks} rotated floor-seam, high-overhang, underside and solid-face checks.`);
}finally{await server.close();}
