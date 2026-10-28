import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {createCloudRoadVolume:create,cloudRoadVolumeDiagnostics:stats,CLOUD_ROAD_VISUAL_DROP:drop}=await server.ssrLoadModule('/src/cloudRoadVolume.ts');
 const straight=Array.from({length:101},(_,i)=>({point:new THREE.Vector3(0,0,-i),normal:new THREE.Vector3(0,1,0),across:new THREE.Vector3(1,0,0),halfWidth:7}));
 const a=create(straight),b=create(straight,4.6);assert.equal(stats().owners,2);assert.equal(stats().textures,2);
 const material=a.children[0].material,texture=material.uniforms.uDensity.value;
 const lighting=material.uniforms.uLight.value;assert.ok(lighting.isDataTexture&&lighting.image.width<=2048&&lighting.image.height<=2048);
 let lightDisposals=0;lighting.addEventListener('dispose',()=>lightDisposals++);
 assert.equal(texture,b.children[0].material.uniforms.uDensity.value);
 const empty=material.uniforms.uEmpty.value.image.data;for(let i=0;i<empty.length;i++)if(texture.image.data[i])assert.equal(empty[i],0,'Skipping must never cross occupied density');assert.equal(texture.wrapR,THREE.RepeatWrapping);
 const {data,width:nx,height:ny,depth:nz}=texture.image;
 const at=(x,y,z)=>data[Math.round((x/22+.5)*(nx-1))+nx*(Math.round((y+6.7)/9.2*(ny-1))+ny*((Math.round(z/23*nz)%nz+nz)%nz))]/255;
 for(let z=0;z<23;z+=.25)for(const x of [-3,0,3]){
  assert.ok(at(x,-.35,z)>.8,'The cloud crown covers the independent riding plane');
  assert.equal(at(x,.4,z),0,'The crown leaves feet and crates visible above the contact plane');
 }
 for(let z=0;z<23;z+=.125)for(let x=-7.3;x<=7.3;x+=.1)
  assert.equal(at(x,drop-.05,z),0,'The complete riding ribbon has clear space below the skater');
 let seamDifference=0,neighborDifference=0;
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const i=x+nx*y;seamDifference+=Math.abs(data[i]-data[i+nx*ny*(nz-1)]);
  neighborDifference+=Math.abs(data[i]-data[i+nx*ny]);
 }
 assert.ok(seamDifference<neighborDifference*1.6,'The periodic join must be no sharper than adjacent density slices');
 let previous;
 for(const mesh of a.children){
  assert.ok(mesh.userData.visualOnly&&mesh.userData.cloudRoadVolume);assert.equal(mesh.material.depthWrite,true);
  assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
  const c=mesh.userData.volumeChunk;
  if(previous){assert.ok(c.start.distanceTo(previous.end)<1e-8);assert.ok(c.startNormal.distanceTo(previous.endNormal)<1e-8);}
  previous=c;
 }
 const {sampleLoop,LOOP_TURN}=await server.ssrLoadModule('/src/loopRide.ts');
 const loop=Array.from({length:257},(_,i)=>{const f=sampleLoop({radius:34,width:14,offset:-24,kind:'wall'},i/256*LOOP_TURN);
  const normal=new THREE.Vector3(...f.normal),tangent=new THREE.Vector3(...f.tangent);
  return {point:new THREE.Vector3(...f.point),normal,across:tangent.clone().cross(normal).normalize(),halfWidth:7};});
 const c=create(loop),frames=c.children[0].material.uniforms.uFrames.value.image.data;
 for(let i=0;i<frames.length;i+=8){
  const q=new THREE.Quaternion(...frames.slice(i+4,i+8));
  const x=new THREE.Vector3(1,0,0).applyQuaternion(q),y=new THREE.Vector3(0,1,0).applyQuaternion(q),z=new THREE.Vector3(0,0,Math.sign(frames[i+3])).applyQuaternion(q);
  assert.ok(Math.abs(x.length()-1)<1e-6&&Math.abs(y.length()-1)<1e-6&&Math.abs(z.length()-1)<1e-6);
  assert.ok(Math.abs(x.dot(y))<1e-6&&Math.abs(y.dot(z))<1e-6,'Volume frames rotate through the vertical wedding band');
 }
 // Query the actual half-float/trilinear map at the rideable plane, including
 // sideways loop frames. This catches interpolation raising clouds into feet.
 let clearanceProbes=0,mapTextures=0,mapDisposals=0,maximumMappingError=0;
 const mappedAt=(cache,point)=>{
  const uv=point.clone().applyMatrix4(cache.transform).sub(cache.min).divide(cache.size);
  if(uv.toArray().some(v=>v<0||v>1))return null;
  const n=cache.resolution.toArray(),p=uv.toArray().map((v,i)=>v*(n[i]-1)),lo=p.map((v,i)=>Math.min(Math.floor(v),n[i]-2)),result=[0,0,0,0];
  const f=p.map((v,i)=>v-lo[i]),d=cache.texture.image.data;
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
   const weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]),index=((lo[0]+x)+n[0]*((lo[1]+y)+n[1]*(lo[2]+z)))*4;
   for(let k=0;k<4;k++)result[k]+=THREE.DataUtils.fromHalfFloat(d[index+k])*weight;
  }
  return result;
 };
 for(const root of [a,b,c])for(const mesh of root.children){
  const cache=mesh.userData.cloudCoordinates;mapTextures++;cache.texture.addEventListener('dispose',()=>mapDisposals++);
  assert.ok(Number.isFinite(cache.stretch)&&cache.stretch>=1);
  assert.ok(!JSON.stringify(mesh.userData).includes('cloudCoordinates'),'Cloning a proxy must not copy its volume data');
  const f=mesh.material.uniforms.uFrames.value.image.data,spacing=mesh.material.uniforms.uSpacing.value;
  const from=Math.max(0,Math.ceil(mesh.userData.volumeChunk.range.x/spacing)),to=Math.min(f.length/8-1,Math.floor(mesh.userData.volumeChunk.range.y/spacing));
  for(let j=from;j<=to;j+=3){
   const i=j*8,point=new THREE.Vector3(...f.slice(i,i+3)),q=new THREE.Quaternion(...f.slice(i+4,i+8)),across=new THREE.Vector3(1,0,0).applyQuaternion(q),normal=new THREE.Vector3(0,1,0).applyQuaternion(q),width=Math.abs(f[i+3]);
   for(const fraction of [-1,-.75,0,.75,1]){
    const x=width*fraction,flat=mesh.material.uniforms.uFlat.value,radius=mesh.material.uniforms.uGutter.value,edge=flat<0?0:Math.min(width-flat,Math.max(0,Math.abs(x)-flat));
    const gutter=flat<0?0:radius-Math.sqrt(Math.max(.01,radius*radius-edge*edge));
    const position=point.clone().addScaledVector(across,x).addScaledVector(normal,gutter),mapped=mappedAt(cache,position);
    assert.ok(mapped,'Every riding point must be inside its coordinate cache');
    const mx=mapped[0]*mapped[3]/7,me=flat<0?0:Math.min(mapped[3]-flat,Math.max(0,Math.abs(mx)-flat));
    const my=mapped[1]-(flat<0?0:radius-Math.sqrt(Math.max(.01,radius*radius-me*me)));
    maximumMappingError=Math.max(maximumMappingError,Math.abs(my));
    assert.equal(at(mapped[0],my+drop,mapped[2]+cache.origin),0,'Cached clouds must remain below the actual contact plane');clearanceProbes++;
    for(const direction of [new THREE.Vector3(.7,.2,-.3).normalize(),normal,across]){
     const shifted=mappedAt(cache,position.clone().addScaledVector(direction,.03));if(!shifted)continue;
     const displacement=Math.hypot(shifted[0]-mapped[0],shifted[1]-mapped[1],shifted[2]-mapped[2]);
     assert.ok(displacement<=cache.stretch*.03+1e-5,'The baked stretch must bound arbitrary map directions');
    }
   }
  }
 }
 const digest=createHash('sha256').update(data).digest('hex');let releases=0;texture.addEventListener('dispose',()=>releases++);
 const dispose=root=>{for(const mesh of root.children)mesh.geometry.dispose();root.children[0].material.dispose();root.children[0].material.dispose();};
 dispose(a);assert.equal(lightDisposals,1);dispose(b);assert.equal(releases,0);dispose(c);assert.equal(releases,1);assert.equal(stats().textures,0);assert.equal(mapDisposals,mapTextures);
 const reloaded=create(straight);assert.equal(createHash('sha256').update(reloaded.children[0].material.uniforms.uDensity.value.image.data).digest('hex'),digest);dispose(reloaded);
 assert.equal(stats().owners,0);console.log(JSON.stringify({densityBytes:data.byteLength,sha256:digest,seamDifference,neighborDifference,clearanceProbes,maximumMappingError,mapTextures,mapDisposals}));
 console.log('PASS full density crown, periodic join, exact loop frames, deterministic reloads and shared-resource disposal');
}finally{await server.close();}
