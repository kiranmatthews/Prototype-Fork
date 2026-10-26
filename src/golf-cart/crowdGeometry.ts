import * as THREE from 'three';

/** Index the static crowd's identical Float32 tuples, including normals, baked
 * colours and all articulation tags. No tolerance, welding or triangle removal.
 * Call before the geometry is uploaded; instance buffers remain independent. */
export function indexCrowdGeometry(g:THREE.BufferGeometry){
 const attributes=Object.entries(g.attributes).map(([name,a])=>{
  if(!(a instanceof THREE.BufferAttribute)||!(a.array instanceof Float32Array))throw new Error('Crowd indexing requires ordinary Float32 attributes');
  return {name,a,bits:new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length)};
 });
 const original=g.attributes.position.count,indices:number[]=[],unique:number[]=[],lookup=new Map<string,number>();
 const count=g.index?.count??original;
 for(let corner=0;corner<count;corner++){
  const source=g.index?g.index.getX(corner):corner;
  const key=attributes.map(({a,bits})=>Array.from(bits.subarray(source*a.itemSize,(source+1)*a.itemSize)).join(',')).join('|');
  let index=lookup.get(key);
  if(index===undefined){index=unique.length;lookup.set(key,index);unique.push(source);}
  indices.push(index);
 }
 for(const {name,a}of attributes){
  const data=new Float32Array(unique.length*a.itemSize);
  unique.forEach((source,i)=>data.set((a.array as Float32Array).subarray(source*a.itemSize,(source+1)*a.itemSize),i*a.itemSize));
  g.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize,a.normalized).setUsage(a.usage));
 }
 g.setIndex(indices);g.userData.crowdIndex={corners:count,originalVertices:original,vertices:unique.length};return g;
}
