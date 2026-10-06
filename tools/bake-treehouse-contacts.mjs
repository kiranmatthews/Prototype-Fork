import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const specs={trialsv2riverstonea:'riverstone-a',trialsv2riverstoneb:'riverstone-b',trialsv2riverstonec:'riverstone-c',trialsv2rockstepsb:'rocksteps-b'};
const surfaces={},manifest=[];
for(const [kind,name] of Object.entries(specs)){
 const bytes=await fs.readFile(path.join(root,'public/treehouse-trials-v2',name+'.glb'));
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
 const sizes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const read=id=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],n=counts[a.type],size=sizes[a.componentType],stride=v.byteStride??n*size,start=(v.byteOffset??0)+(a.byteOffset??0),out=[];
  const getters={5120:'readInt8',5121:'readUInt8',5122:'readInt16LE',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'};
  for(let i=0;i<a.count;i++)for(let k=0;k<n;k++)out.push(binary[getters[a.componentType]](start+i*stride+k*size));return out;};
 const parts=[];
 const visit=(id,parent,ancestorLod)=>{
  const node=doc.nodes[id],local=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(
   new THREE.Vector3(...(node.translation??[0,0,0])),new THREE.Quaternion(...(node.rotation??[0,0,0,1])),new THREE.Vector3(...(node.scale??[1,1,1])));
  const world=parent.clone().multiply(local),lod=/LOD1$/.test(node.name??'')?1:/LOD0$/.test(node.name??'')?0:ancestorLod;
  if(node.mesh!==undefined&&lod!==1)for(const primitive of doc.meshes[node.mesh].primitives){
   if((primitive.mode??4)!==4)throw Error('Expected triangle GLB');
   const raw=read(primitive.attributes.POSITION),vertices=[];
   for(let i=0;i<raw.length;i+=3)vertices.push(...new THREE.Vector3(raw[i],raw[i+1],raw[i+2]).applyMatrix4(world).toArray());
   parts.push({vertices,indices:primitive.indices===undefined?Array.from({length:raw.length/3},(_,i)=>i):read(primitive.indices)});
  }
  for(const child of node.children??[])visit(child,world,lod);
 };
 for(const id of doc.scenes[doc.scene??0].nodes)visit(id,new THREE.Matrix4(),undefined);
 const vertices=[],indices=[];
 for(const part of parts){const offset=vertices.length/3;vertices.push(...part.vertices);indices.push(...part.indices.map(i=>i+offset));}
 const box=new THREE.Box3().setFromArray(vertices),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 for(let i=0;i<vertices.length;i+=3){vertices[i]=(vertices[i]-center.x)/size.x;vertices[i+1]=(vertices[i+1]-box.min.y)/size.y;vertices[i+2]=(vertices[i+2]-center.z)/size.z;}
 // Exact visible triangles. Downward undersides cannot be walked on and do
 // not belong in the top-contact instrument; steep risers remain present.
 const kept=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<indices.length;i+=3){a.fromArray(vertices,indices[i]*3);b.fromArray(vertices,indices[i+1]*3);c.fromArray(vertices,indices[i+2]*3);
  const normal=b.sub(a).cross(c.sub(a));if(normal.y>=-1e-9)kept.push(...indices.slice(i,i+3));}
 const used=[...new Set(kept)],remap=new Map(used.map((id,i)=>[id,i])),compact=used.flatMap(id=>vertices.slice(id*3,id*3+3).map(v=>+v.toFixed(7)));
 surfaces[kind]={vertices:compact,indices:kept.map(id=>remap.get(id))};
 manifest.push({kind,file:`treehouse-trials-v2/${name}.glb`,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceTriangles:indices.length/3,contactTriangles:kept.length/3,normalization:{min:box.min.toArray(),size:size.toArray()}});
}
const code=`// Baked from the exact accepted LOD0 GLBs by tools/bake-treehouse-contacts.mjs.\n// Positions use the same normalized frame as JungleAssetKit. No fitted height grids.\nexport const TREEHOUSE_CONTACT_SURFACES = ${JSON.stringify(surfaces)};\n`;
await fs.writeFile(path.join(root,'src/levels/treehouse-contact-surfaces.ts'),code);
await fs.writeFile(path.join(root,'tools/treehouse-trials-assets-v2/contact-bake.json'),JSON.stringify({version:1,surfaces:manifest},null,2)+'\n');

console.log(JSON.stringify(manifest.map(m=>({kind:m.kind,triangles:m.contactTriangles}))));
