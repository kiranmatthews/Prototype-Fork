import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
import {writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const results=[];
try{
 const {createRoundBoulderGeometry}=await server.ssrLoadModule('/src/roundBoulder.ts');
 const {BoulderChase}=await server.ssrLoadModule('/src/boulderChase.ts');
 for(const detail of [28,14]){
  const g=createRoundBoulderGeometry(detail),p=g.getAttribute('position'),ix=g.index,edges=new Map(),v=new THREE.Vector3();
  let minRadius=Infinity,maxRadius=0;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const r=v.length();minRadius=Math.min(minRadius,r);maxRadius=Math.max(maxRadius,r);}
  for(let i=0;i<ix.count;i+=3){
   const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
   const a=new THREE.Vector3().fromBufferAttribute(p,ids[0]),b=new THREE.Vector3().fromBufferAttribute(p,ids[1]),c=new THREE.Vector3().fromBufferAttribute(p,ids[2]);
   assert.ok(b.sub(a).cross(c.sub(a)).dot(a)>0,'every triangle faces out from the rolling centre');
   for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(n=>n===2),'one sealed shell with no split plates or holes');
  assert.equal(p.count-edges.size+ix.count/3,2,'sphere topology');
  assert.ok(minRadius>.98&&maxRadius<=1.00001,'surface relief stays within 2% of the rolling radius');
  let minimumDiameter=Infinity,maximumDiameter=0;
  const direction=new THREE.Vector3();
  for(let i=0;i<360;i++){
   const y=1-2*(i+.5)/360,a=i*2.399963229728653,r=Math.sqrt(1-y*y);direction.set(r*Math.cos(a),y,r*Math.sin(a));
   let lo=Infinity,hi=-Infinity;
   for(let j=0;j<p.count;j++){const d=v.fromBufferAttribute(p,j).dot(direction);lo=Math.min(lo,d);hi=Math.max(hi,d);}
   minimumDiameter=Math.min(minimumDiameter,hi-lo);maximumDiameter=Math.max(maximumDiameter,hi-lo);
  }
  assert.ok(maximumDiameter/minimumDiameter<1.02,'round from all 360 directions, not merely from the front');
  results.push({detail,vertices:p.count,triangles:ix.count/3,minRadius,maxRadius,minimumDiameter,maximumDiameter});g.dispose();
 }
 const radius=8.2,stone={mesh:new THREE.Mesh(),box:new THREE.Box3(),r:radius,speed:0};
 const chase=new BoulderChase({path:[[0,0,80],[0,0,-900]],radius,speed:12,headStart:27},stone,new THREE.Vector3(0,0,0));
 const start=chase.progress,mark=new THREE.Vector3(0,1,0);let previous=start;
 for(let i=0;i<600;i++){
  chase.update(1/60,{x:0,y:0,z:-250});
  assert.ok(Math.abs(stone.mesh.position.y-radius)<1e-8,'centre sits exactly one rolling radius above the floor');
  if(!chase.active)continue;
  const distance=chase.progress-start,theta=distance/radius,point=mark.clone().applyQuaternion(stone.mesh.quaternion);
  assert.ok(Math.abs(point.y-Math.cos(theta))<1e-7&&Math.abs(point.z+Math.sin(theta))<1e-7,'surface rotates by distance/radius');
  assert.ok(Math.abs(stone.box.min.y+.01*radius)<1e-8,'authored collision floor remains unchanged');
  assert.ok(chase.progress>=previous);previous=chase.progress;
 }
 const {HazardVisuals}=await server.ssrLoadModule('/src/hazardVisuals.ts');
 const oldLoad=THREE.TextureLoader.prototype.loadAsync;
 let releasedGeometry=0,releasedTexture=0;
 try{
  const texture=new THREE.Texture();texture.addEventListener('dispose',()=>releasedTexture++);
  THREE.TextureLoader.prototype.loadAsync=async()=>texture;
  const kit=new HazardVisuals(),bodies=Array.from({length:7},()=>new THREE.Mesh()),body=bodies[0];
  for(const b of bodies)kit.rollingBoulder(b,radius);await kit.ready();
  assert.equal(kit.diagnostics.ready,7);assert.deepEqual(kit.diagnostics.errors,[]);
  const round=body.children[0];assert.ok(round);assert.deepEqual(round.scale.toArray(),[radius,radius,radius]);
  for(const b of bodies)for(let i=0;i<2;i++)assert.equal(b.children[0].levels[i].object.geometry,round.levels[i].object.geometry,'all seven stones share their round LOD geometry');
  round.traverse(o=>{if(o.isMesh)o.geometry.addEventListener('dispose',()=>releasedGeometry++);});
  kit.dispose();assert.equal(releasedGeometry,2);assert.equal(releasedTexture,1);assert.equal(body.children.length,0);
  let resolve;const lateTexture=new THREE.Texture();lateTexture.addEventListener('dispose',()=>releasedTexture++);
  THREE.TextureLoader.prototype.loadAsync=()=>new Promise(r=>resolve=r);
  const late=new HazardVisuals(),lateBody=new THREE.Mesh();late.rollingBoulder(lateBody,radius);
  const ready=late.ready();late.dispose();resolve(lateTexture);await ready;
  assert.equal(releasedTexture,2);assert.equal(lateBody.children.length,0,'late texture must not resurrect a disposed boulder');
 }finally{THREE.TextureLoader.prototype.loadAsync=oldLoad;}
 console.log(JSON.stringify({roundness:results,rolling:'600 fixed steps; distance/radius rotation; preserved collision floor',releasedGeometry,releasedTexture}));
 await mkdir('docs/performance',{recursive:true});
 await writeFile('docs/performance/rumblewater-round-boulder.json',JSON.stringify({roundness:results,rollingSteps:600},null,2)+'\n');
}finally{await server.close();}
