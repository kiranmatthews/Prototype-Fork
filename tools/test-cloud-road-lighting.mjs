import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
import {createHash} from 'node:crypto';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {bakeCloudOptics,createCloudRoadMaterial,cloudRoadLightingDiagnostics:stats}=await server.ssrLoadModule('/src/cloudRoadLighting.ts');
 const circle=Array.from({length:113},(_,j)=>[Math.sin(j/112*Math.PI*2)*4,Math.cos(j/112*Math.PI*2)*3]);
 const optics=bakeCloudOptics(circle,circle,0,1);
 assert.ok(optics.every(v=>v.length===2&&v.every(n=>Number.isFinite(n)&&n>=0&&n<=1)));
 assert.deepEqual(optics[0],optics[112],'The contour seam must have identical light values');
 assert.ok(optics[0][0]>.8&&optics[56][0]<.04,'Sunlight must penetrate the thin crown and be absorbed through the body');
 assert.ok(optics[56][1]>optics[56][0]*5,'Broad scattering keeps the shaded body readable');
 const angle=.73,c=Math.cos(angle),s=Math.sin(angle),rotated=circle.map(([x,y])=>[c*x-s*y,s*x+c*y]);
 const rotatedOptics=bakeCloudOptics(rotated,rotated,-s,c);
 optics.forEach((v,i)=>v.forEach((n,k)=>assert.ok(Math.abs(n-rotatedOptics[i][k])<1e-10,'Optical depth must follow rotated loop frames')));
 assert.deepEqual(stats(),{owners:0,textures:0,baseBytes:0,mipBytes:0});
 const start=performance.now(),a=createCloudRoadMaterial(),noiseBuildMs=performance.now()-start,b=createCloudRoadMaterial();
 const shader=()=>({uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>\n#include <normal_fragment_begin>\n#include <opaque_fragment>'});
 const sa=shader(),sb=shader();a.onBeforeCompile(sa);b.onBeforeCompile(sb);
 const texture=sa.uniforms.uCloudNoise.value;assert.equal(texture,sb.uniforms.uCloudNoise.value);
 assert.equal(stats().textures,1);assert.equal(stats().owners,2);assert.equal(stats().mipBytes,1198372);
 assert.equal(texture.wrapR,THREE.RepeatWrapping);assert.equal(texture.minFilter,THREE.LinearMipmapLinearFilter);assert.equal(texture.generateMipmaps,true);
 const hash=data=>createHash('sha256').update(data).digest('hex');const firstHash=hash(texture.image.data);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);
 a.dispose();a.dispose();assert.equal(stats().owners,1);assert.equal(disposed,0,'A material cannot dispose another owner\'s noise');
 b.dispose();assert.equal(disposed,1);assert.equal(stats().textures,0);
 const again=createCloudRoadMaterial(),sc=shader();again.onBeforeCompile(sc);
 assert.equal(hash(sc.uniforms.uCloudNoise.value.image.data),firstHash,'Reloads must produce exactly the same static cloud field');
 const {createCloudRoad}=await server.ssrLoadModule('/src/cloudRoad.ts');
 const sections=Array.from({length:81},(_,i)=>({point:new THREE.Vector3(Math.sin(i*.03)*7,Math.cos(i*.02)*3,-i),normal:new THREE.Vector3(0,1,0),across:new THREE.Vector3(1,0,0),halfWidth:7}));
 const root=createCloudRoad(sections);root.updateMatrixWorld(true);
 let bakedBytes=0,previous;
 for(const mesh of root.children.filter(m=>m.userData.cloudRoadVisual)){
  const geo=mesh.geometry,attr=geo.attributes.cloudOptics;assert.ok(attr.normalized&&attr.array instanceof Uint8Array);
  assert.equal(attr.count,geo.attributes.position.count);bakedBytes+=attr.array.byteLength;
  if(previous)assert.deepEqual(Array.from(previous.slice(-226)),Array.from(attr.array.slice(0,226)),'Visibility chunks must share identical boundary lighting');
  previous=attr.array;geo.dispose();
 }
 const fringe=root.children.find(m=>m.userData.cloudRoadFringe);assert.ok(fringe?.isInstancedMesh&&fringe.count>0);
 assert.equal(fringe.userData.raySamples,8);assert.equal(fringe.material.depthWrite,false);
 assert.equal(fringe.material.uniforms.uCloudNoise.value,sc.uniforms.uCloudNoise.value,'Wisps must reuse the mesh noise upload');
 assert.ok(fringe.instanceMatrix.array.every(Number.isFinite));
 const m=new THREE.Matrix4(),scale=new THREE.Vector3();for(let i=0;i<fringe.count;i++){fringe.getMatrixAt(i,m);scale.setFromMatrixScale(m);assert.ok(scale.x<=2.00001&&scale.y<=.80001&&scale.z<=.50001,'Ray domains remain tightly bounded');}
 let instanceDisposals=0;fringe.addEventListener('dispose',()=>instanceDisposals++);
 fringe.geometry.dispose();fringe.geometry.dispose();assert.equal(instanceDisposals,1,'The proxy geometry must release its instance buffer exactly once');
 fringe.material.dispose();fringe.material.dispose();
 root.children[0].material.dispose();again.dispose();assert.equal(stats().owners,0);assert.equal(stats().textures,0);
 console.log(JSON.stringify({noiseBuildMs,noiseSha256:firstHash,sharedMipBytes:1198372,fixtureBakedBytes:bakedBytes}));
 console.log('PASS optical depth, scattering, rotated frames, seamless chunks, deterministic filtered noise and reference-counted disposal');
}finally{await server.close();}
