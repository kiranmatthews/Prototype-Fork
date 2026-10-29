import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {MeshoptDecoder} from 'meshoptimizer';
export async function surfaceAt(file,u=0,v=0){
 const bytes=await readFile(file),jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
 const bin=bytes.subarray(28+jsonLength),measurement=await measureGlb(file),decoded=new Map();
 await MeshoptDecoder.ready;
 for(const [i,view] of json.bufferViews.entries()){const e=view.extensions?.EXT_meshopt_compression;if(!e)continue;const data=new Uint8Array(view.byteLength);MeshoptDecoder.decodeGltfBuffer(data,e.count,e.byteStride,bin.subarray(e.byteOffset,e.byteOffset+e.byteLength),e.mode,e.filter??'NONE');decoded.set(i,Buffer.from(data));}
 const x=(measurement.min[0]+measurement.max[0])/2+u*measurement.size[0],z=(measurement.min[2]+measurement.max[2])/2+v*measurement.size[2];let top=-Infinity;
 const accessor=index=>{const a=json.accessors[index],b=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],data=[];
  for(let i=0;i<a.count;i++){const row=[];for(let j=0;j<n;j++){const raw=decoded.get(a.bufferView)??bin,offset=(decoded.has(a.bufferView)?0:(b.byteOffset??0))+(a.byteOffset??0)+i*(b.byteStride??n*size)+j*size;row.push(a.componentType===5126?raw.readFloatLE(offset):a.componentType===5125?raw.readUInt32LE(offset):raw.readUInt16LE(offset));}data.push(row);}return data;};
 const visit=(index,parent)=>{const n=json.nodes[index],local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1]))),world=parent.clone().multiply(local);
  if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const vertices=accessor(p.attributes.POSITION).map(a=>new THREE.Vector3(...a).applyMatrix4(world)),indices=p.indices===undefined?vertices.map((_,i)=>i):accessor(p.indices).flat();
   for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3).map(i=>vertices[i]),den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-12)continue;const p=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,q=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;if(p>=0&&q>=0&&p+q<=1)top=Math.max(top,p*a.y+q*b.y+(1-p-q)*c.y);}}
  for(const child of n.children??[])visit(child,world);
 };for(const n of json.scenes[json.scene??0].nodes)visit(n,new THREE.Matrix4());
 if(!Number.isFinite(top))throw Error('No rock support at requested coordinate');return(top-measurement.min[1])/measurement.size[1];
}
export async function measureGlb(file) {
 const bytes=await readFile(file), json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const bounds=new THREE.Box3(), materials=new Set();let triangles=0,vertices=0;
 const visit=(index,parent)=>{const n=json.nodes[index];if(/_LOD[1-9]/.test(n.name??''))return;
  const local=n.matrix?new THREE.Matrix4().fromArray(n.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(n.translation??[0,0,0])),new THREE.Quaternion(...(n.rotation??[0,0,0,1])),new THREE.Vector3(...(n.scale??[1,1,1])));
  const world=parent.clone().multiply(local);
  if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){const a=json.accessors[p.attributes.POSITION];bounds.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(world));vertices+=a.count;triangles+=(p.indices===undefined?a.count:json.accessors[p.indices].count)/3;materials.add(p.material??-1);}
  for(const child of n.children??[])visit(child,world);
 };
 for(const n of json.scenes[json.scene??0].nodes)visit(n,new THREE.Matrix4());
 return {file,bytes:bytes.length,triangles,vertices,materials:materials.size,min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()};
}
if(process.argv[1]?.endsWith('ancient-native-measure.mjs'))for(const file of process.argv.slice(2))console.log(JSON.stringify(await measureGlb(file)));
