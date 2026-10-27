import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createServer} from 'vite';

// Geometry-only check: the shipped highest-detail trunk, native scenery
// binding and continuous capsule queries. No renderer or texture decode.
const bytes=await readFile(new URL('../public/coastal-town/palm-trunk.glb',import.meta.url));
const jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.toString('utf8',20,20+jsonLength)),binary=20+jsonLength+8;
const node=gltf.nodes.find(n=>n.name==='palm-trunk_LOD0');
assert.ok(node&&!node.matrix&&!node.translation&&!node.rotation&&!node.scale,'source uses the measured identity transform');
const primitive=gltf.meshes[node.mesh].primitives[0];
function accessor(index){
  const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView],width=a.type==='VEC3'?3:1;
  const [size,read]=a.componentType===5126?[4,'readFloatLE']:a.componentType===5125?[4,'readUInt32LE']:[2,'readUInt16LE'];
  assert.ok([5126,5125,5123].includes(a.componentType)&&!a.sparse);
  const stride=view.byteStride??width*size,offset=binary+(view.byteOffset??0)+(a.byteOffset??0),values=[];
  for(let i=0;i<a.count;i++)for(let k=0;k<width;k++)values.push(bytes[read](offset+i*stride+k*size));
  return values;
}
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute(accessor(primitive.attributes.POSITION),3));
geometry.setIndex(accessor(primitive.indices));geometry.computeBoundingBox();
const bounds=geometry.boundingBox.clone(),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);
assert.equal(geometry.index.count/3,1952,'retain every authored trunk triangle');

// Locate the actual wood at each height, including the bend away from the pivot.
const p=geometry.getAttribute('position'),ix=geometry.index;
function section(y){
  const samples=[];
  for(let i=0;i<ix.count;i+=3)for(const [j,k]of [[0,1],[1,2],[2,0]]){
    const a=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+j)),b=new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+k));
    if((a.y<=y&&b.y>y)||(b.y<=y&&a.y>y))samples.push(a.lerp(b,(y-a.y)/(b.y-a.y)));
  }
  assert.ok(samples.length);return new THREE.Box3().setFromPoints(samples).getCenter(new THREE.Vector3());
}
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let binding,world,material;
try{
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {withMotuPalmContact}=await server.ssrLoadModule('/src/levels/motu-palm-contact.ts');
  const {jungleAssetMatrix}=await server.ssrLoadModule('/src/jungleAssets.ts');
  const {WorldSurfaceBinding}=await server.ssrLoadModule('/src/worldSurfaceBinding.ts');
  const {WorldSolids,solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
  const {CARLISLE_CONTACTS}=await server.ssrLoadModule('/src/carlisleContacts.generated.ts');
  const {CarlisleSceneryCollision}=await server.ssrLoadModule('/src/carlisleSceneryCollision.ts');
  const before=JSON.stringify(data),next=withMotuPalmContact(data.components);
  assert.equal(JSON.stringify(data),before,'preparation never mutates the live preview source');
  assert.deepEqual(withMotuPalmContact(next),next,'repeated preparation keeps the same authored data');
  assert.equal(next.length,data.components.length,'no new geometry components');
  for(let i=0;i<next.length;i++){
    const restored={...next[i]};
    if('scenerySolid' in data.components[i])restored.scenerySolid=data.components[i].scenerySolid;else delete restored.scenerySolid;
    assert.deepEqual(restored,data.components[i]);
  }
  const palms=next.filter(c=>c.dkind==='baytrunk'&&c.scenerySolid===true);
  assert.equal(palms.length,13,'five planted ledges and eight reachable deck palms');
  assert.ok(palms.every(c=>c.solid===true),'Player uses the synchronous native contact path');
  assert.deepEqual(CARLISLE_CONTACTS.baytrunk.indices,Array.from(geometry.index.array));
  let templateError=0;
  for(let i=0;i<geometry.attributes.position.array.length;i++)templateError=Math.max(templateError,Math.abs(geometry.attributes.position.array[i]-CARLISLE_CONTACTS.baytrunk.vertices[i]));
  assert.ok(templateError<2e-7,'baked native contact retains the full GLB surface');
  assert.ok(next.filter(c=>c.dkind==='baycrown').every(c=>c.scenerySolid===false),'crowns stay soft');
  const root=new THREE.Group(),ground=[];world=new WorldSolids();
  binding=new WorldSurfaceBinding(root,world,{ground:()=>ground,walls:()=>[],component:()=>undefined});
  material=new THREE.MeshBasicMaterial();const trunks=new THREE.InstancedMesh(geometry,material,palms.length);
  const matrices=palms.map(jungleAssetMatrix);matrices.forEach((m,i)=>trunks.setMatrixAt(i,m));
  const playerContact=new CarlisleSceneryCollision();let playerKernelContacts=0;
  try{
    for(const c of palms)assert.ok(playerContact.add(c));
    assert.equal(playerContact.meshes.length,13);
    for(let i=0;i<palms.length;i++)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const center=section(.16),a=center.clone().add(new THREE.Vector3(dx*.9,0,dz*.9)).applyMatrix4(matrices[i]);
      const b=center.clone().add(new THREE.Vector3(-dx*.9,0,-dz*.9)).applyMatrix4(matrices[i]);a.y=b.y=palms[i].p[1]+.05;
      assert.ok(playerContact.resolve(a,b,.22,1.3),'native Player contact kernel blocks the actual wood');playerKernelContacts++;
    }
  }finally{playerContact.dispose();}
  trunks.userData={jungleAsset:'baytrunk',sceneryLod:0,solidSurface:'none'};root.add(trunks);binding.prepare();
  assert.equal(world.surfaces.size,0,'reproduce existing nonblocking trunk policy');
  root.remove(trunks);trunks.userData.solidSurface='mesh';root.add(trunks);binding.prepare();
  assert.equal(world.surfaces.size,palms.length);
  assert.ok([...world.surfaces].every(s=>s.geometry===geometry),'all contacts share the original complete geometry');
  let contacts=0,clearLedgeSegments=0;
  for(let i=0;i<palms.length;i++)for(const y of [.06,.22,.44,.67,.9])for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const center=section(y),a=center.clone().add(new THREE.Vector3(dx*.9,0,dz*.9)).applyMatrix4(matrices[i]);
    const b=center.clone().add(new THREE.Vector3(-dx*.9,0,-dz*.9)).applyMatrix4(matrices[i]),hit=solidContact();
    assert.ok(world.cast(a,b,{low:0,high:0,radius:.16,ignore:s=>s.instance!==i},hit),`palm ${i}: ${y}m normalized wood contact ${dx}/${dz}`);
    assert.equal(hit.surface.instance,i);assert.ok(hit.fraction<.9);contacts++;
  }
  trunks.visible=false;
  const hiddenCenter=section(.44),hiddenFrom=hiddenCenter.clone().add(new THREE.Vector3(.9,0,0)).applyMatrix4(matrices[0]);
  const hiddenTo=hiddenCenter.clone().add(new THREE.Vector3(-.9,0,0)).applyMatrix4(matrices[0]);
  assert.ok(world.cast(hiddenFrom,hiddenTo,{low:0,high:0,radius:.16,ignore:s=>s.instance!==0},solidContact()),'camera hiding preserves actual contact');
  for(const c of next.filter(c=>c.nm==='Motu / planted circular skate ledge')){
    const [x,y,z]=c.vertices,r=Math.hypot(c.vertices[3]-x,c.vertices[5]-z)+.35;
    for(let i=0;i<32;i++){
      const at=a=>new THREE.Vector3(x+Math.cos(a)*r,y+.05,z+Math.sin(a)*r);
      assert.equal(world.cast(at(i/32*Math.PI*2),at((i+1)/32*Math.PI*2),{low:.3,high:1.3,radius:.22},solidContact()),false,'ledge perimeter stays clear');
      clearLedgeSegments++;
    }
  }
  const report={passed:true,sourceAssetSha256:createHash('sha256').update(bytes).digest('hex'),palms:palms.length,triangles:1952,contacts,playerKernelContacts,templateError,clearLedgeSegments,
    placements:palms.map(c=>({p:c.p,s:c.s,yaw:c.yaw})),sourceUnchanged:true,completeGeometryShared:true,hiddenContact:true};
  await writeFile(process.env.MOTU_PALM_REPORT??'/private/tmp/motu-palm-contact.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{binding?.dispose();world?.dispose();geometry.dispose();material?.dispose();await server.close();}
