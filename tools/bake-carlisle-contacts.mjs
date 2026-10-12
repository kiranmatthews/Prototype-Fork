// Reproduce synchronous contacts from accepted GLB LOD0 surfaces, without textures.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as THREE from 'three';
const specs={coastv2ledge:'carlisle-coast-fidelity/ledge-root',coastv2buttress:'carlisle-coast-fidelity/canyon-buttress',
 coastv2cavewall:'treehouse-trials-v2/cavewall-b',coastv2earthbank:'treehouse-trials-v2/earthbank-b',
 coastcliff:'carlisle-coast/cliff-bay',coastspire:'carlisle-coast/canyon-spire',coastshelf:'carlisle-coast/moss-shelf',
 coastpillar:'carlisle-coast/tiki-pillar',coastarch:'carlisle-coast/temple-lintel',coastbeachrock:'beachfront/stonecliff-bastion'};
const surfaces={},manifest=[];
for(const [kind,file] of Object.entries(specs)){
 const bytes=await fs.readFile(new URL(`../public/${file}.glb`,import.meta.url));
 const jl=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jl)),bin=bytes.subarray(28+jl);
 const widths={5121:1,5123:2,5125:4,5126:4},counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const read=id=>{const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],n=counts[a.type],w=widths[a.componentType],stride=v.byteStride??n*w;
  const start=(v.byteOffset??0)+(a.byteOffset??0),get={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
  if(!get)throw Error(`Unsupported contact accessor ${a.componentType}`);
  return Array.from({length:a.count*n},(_,i)=>bin[get](start+Math.floor(i/n)*stride+(i%n)*w));};
 const parts=[];
 const visit=(id,parent,lod)=>{
  const n=doc.nodes[id],local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));
  const world=parent.clone().multiply(local),level=/LOD1(?:$|[_. ])/.test(n.name??'')?1:/LOD0(?:$|[_. ])/.test(n.name??'')?0:lod;
  if(n.mesh!==undefined&&level!==1)for(const p of doc.meshes[n.mesh].primitives){
   const raw=read(p.attributes.POSITION),vertices=[];
   for(let i=0;i<raw.length;i+=3)vertices.push(...new THREE.Vector3().fromArray(raw,i).applyMatrix4(world).toArray());
   parts.push({vertices,indices:p.indices===undefined?Array.from({length:raw.length/3},(_,i)=>i):read(p.indices)});
  }
  for(const child of n.children??[])visit(child,world,level);
 };
 for(const node of doc.scenes[doc.scene??0].nodes)visit(node,new THREE.Matrix4(),undefined);
 const vertices=[],indices=[];
 for(const p of parts){const offset=vertices.length/3;vertices.push(...p.vertices);indices.push(...p.indices.map(i=>i+offset));}
 const box=new THREE.Box3().setFromArray(vertices),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 for(let i=0;i<vertices.length;i+=3){vertices[i]=+( (vertices[i]-center.x)/size.x).toFixed(7);vertices[i+1]=+((vertices[i+1]-box.min.y)/size.y).toFixed(7);vertices[i+2]=+((vertices[i+2]-center.z)/size.z).toFixed(7);}
 surfaces[kind]={vertices,indices};manifest.push({kind,file:`${file}.glb`,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),vertices:vertices.length/3,triangles:indices.length/3});
}
await fs.writeFile(new URL('../src/carlisleContacts.generated.ts',import.meta.url),`// Exact normalized LOD0 GLB surfaces. Rebuild: node tools/bake-carlisle-contacts.mjs\nexport const CARLISLE_CONTACTS:Record<string,{vertices:number[];indices:number[]}>=${JSON.stringify(surfaces)};\n`);
await fs.writeFile(new URL('carlisle-bonus-assets/contact-manifest.json',import.meta.url),JSON.stringify({version:1,precisionMetresAt30m:0.000003,models:manifest},null,2)+'\n');
console.log(manifest);
