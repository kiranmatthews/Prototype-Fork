import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
try{
 const {HeightFog}=await server.ssrLoadModule('/src/heightFog.ts');
 const {validAtmosphere}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
 const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material),root=new THREE.Group();root.add(mesh);
 let inherited=0;material.onBeforeCompile=()=>inherited++;
 const compile=()=>{const shader={uniforms:{},vertexShader:'#include <worldpos_vertex>',fragmentShader:'#include <fog_fragment>'};material.onBeforeCompile(shader,{});return shader;};
 const camera=new THREE.Vector3(4,90,-200),color=new THREE.Color('#c3cedf'),profile={height:86.3,density:.12,falloff:.22,slope:[0,.029]};
 const first=new HeightFog();first.update(root,camera,profile,color,true);
 const shader=compile(),uniforms=shader.uniforms,key=material.customProgramCacheKey();
 assert.equal(uniforms.uHeightFogProfile.value.y,.12);
 first.dispose();assert.equal(uniforms.uHeightFogProfile.value.y,0,'shared materials must lose fog when leaving the level');
 const second=new HeightFog();second.update(root,new THREE.Vector3(0,60,-900),{...profile,height:52},color,true);
 assert.equal(uniforms.uHeightFogProfile.value.x,52,'a compiled material must adopt its new level uniforms');
 assert.equal(uniforms.uHeightFogCamera.value.y,60);
 assert.equal(material.customProgramCacheKey(),key,'revisiting a level must not wrap the shader twice');
 const revisit=compile();assert.equal(revisit.fragmentShader.match(/varying vec3 vHeightFogWorld/g)?.length,1);assert.equal(inherited,2);
 const successor=new HeightFog();successor.update(root,camera,profile,color,true);second.dispose();
 assert.equal(uniforms.uHeightFogProfile.value.y,.12,'disposing an old level cannot disable its successor');
 successor.update(root,camera,profile,color,false);assert.equal(uniforms.uHeightFogProfile.value.y,0,'inspection disables the extra haze');
 successor.update(root,camera,profile,color,true);successor.disable();assert.equal(uniforms.uHeightFogProfile.value.y,0,'removing the profile clears its live uniforms');
 const contour=[[-900,52],[-400,64],[0,86]];
 assert.ok(validAtmosphere({heightFog:{...profile,contour}}));
 for(const invalid of [[],[[0,1]],[[0,0],[0,2]],[[1,0],[0,0]],[[0,0],[1,2]],[[0,0],[NaN,0]],Array.from({length:17},(_,i)=>[i,0])])
  assert.equal(validAtmosphere({heightFog:{...profile,contour:invalid}}),false,'reject malformed or excessive fog contours');
 successor.update(root,camera,{...profile,contour},color,true);
 assert.equal(uniforms.uHeightFogCount.value,3);assert.deepEqual(uniforms.uHeightFogContour.value.slice(0,3).map(p=>p.toArray()),contour);
 successor.update(root,camera,profile,color,true);assert.equal(uniforms.uHeightFogCount.value,0,'reusing the same material can restore planar fog');
 successor.dispose();mesh.geometry.dispose();material.dispose();console.log('PASS height fog: shared material reuse, level exit, successor ownership and inspection');
}finally{await server.close();}
