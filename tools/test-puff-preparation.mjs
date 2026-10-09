import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try{
 const {PuffSystem,PUFF_PRESETS}=await server.ssrLoadModule('/src/puffs.ts');
 const run=(quality,prepared)=>{
  const system=new PuffSystem(64),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
  system.attach(scene);system.setQuality(quality);camera.position.set(1,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  const reserved=new Map();
  const prepare=()=>{
   for(const style of ['alpha','add']){
   const before=scene.children.slice(),proxy=system.createPresentationProxy(style);
   scene.add(proxy);assert.equal(proxy.frustumCulled,false);assert.equal(proxy.userData.shared,true);
   // Three's transparent sorting takes object bounds when present. It must
   // never compute and retain empty bounds on the eventual live geometry.
   const bounds=proxy.geometry.boundingSphere;
   assert.ok(proxy.boundingSphere instanceof THREE.Sphere);assert.notEqual(proxy.boundingSphere,bounds);
   if(!reserved.has(style)){reserved.set(style,proxy.geometry);assert.equal(bounds,null);assert.equal(proxy.geometry.drawRange.count,0);}
   else assert.equal(proxy.geometry,reserved.get(style),'return preparation must reuse the same buffers');
   proxy.removeFromParent();assert.deepEqual(scene.children,before,'preparation must leave no live mesh');
   }
  };
  if(prepared){prepare();prepare();}
  const rows=[],hash=createHash('sha256'),styles=['softAdd','add','alpha','darken'];
  for(let frame=0;frame<240;frame++){
   if(frame===80||frame===160){system.clear();if(prepared)prepare();}
   // Alpha first appears after another blend. Eager creation of its live
   // mesh would reverse a real transparent-sort tie despite equal vertices.
   if(frame%12===0)for(let i=0;i<styles.length;i++){
    if(frame===0&&i>=2)continue;
    for(let j=0;j<2;j++)system.spawn({...PUFF_PRESETS.dustLand,blend:styles[i],life:[.3,.8]},i*.2,1,j*.2,{seed:frame*100+i*10+j+1,groundY:0});
   }
   system.update(1/60,camera);
   const meshes=scene.children.filter(m=>m.isMesh).sort((a,b)=>a.id-b.id);
   for(const mesh of meshes){
    if(mesh.geometry.boundingSphere===null)mesh.geometry.computeBoundingSphere();
    if(!mesh.visible)continue;
    const g=mesh.geometry,index=g.getIndex(),count=g.drawRange.count;let vertices=0;
    for(let i=0;i<count;i++)vertices=Math.max(vertices,index.array[i]+1);
    const key={order:meshes.indexOf(mesh),renderOrder:mesh.renderOrder,blending:mesh.material.blending,src:mesh.material.blendSrc,dst:mesh.material.blendDst,equation:mesh.material.blendEquation,fog:mesh.material.fog,sphere:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius,count};
    rows.push(key);hash.update(JSON.stringify(key));
    for(const [attribute,length]of [[g.getAttribute('position'),vertices*3],[g.getAttribute('color'),vertices*4],[index,count]])hash.update(new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,length*attribute.array.BYTES_PER_ELEMENT));
   }
  }
  if(prepared)for(const geometry of reserved.values())assert.ok(scene.children.some(m=>m.geometry===geometry),'each actual batch must use its prepared buffers');
  for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}
  return{samples:rows.length,hash:hash.digest('hex')};
 };
 const reports=[];
 for(const quality of ['high','medium','low']){
  const original=run(quality,false),prepared=run(quality,true);assert.deepEqual(prepared,original,`${quality} preparation changed particle output, bounds or blend order`);reports.push({quality,...prepared});
 }
 console.log(JSON.stringify({pass:true,reports}));
}finally{await server.close();}
