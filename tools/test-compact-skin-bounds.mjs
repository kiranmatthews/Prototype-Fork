import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {compactSkinBoundsVertices:compact}=await server.ssrLoadModule('/src/character/compactSkinBounds.ts');
 const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
 const {SkinBoundsKernel}=await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
 const make=(count=4096,unique=1024)=>{
  const v={positions:new Float64Array(count*3),indices:new Uint32Array(count*4),weights:new Float64Array(count*4),morphDeltas:[new Float64Array(count*3),new Float64Array(count*3)],kernelInputsFinite:true,highestWeightedIndex:3};
  for(let i=0;i<count;i++){
   const n=i%unique;v.positions.set([Math.sin(n)*2,n%7,Math.cos(n)*3],i*3);
   v.indices.set([n%4,(n+1)%4,0,1],i*4);v.weights.set([.7,.3,0,0],i*4);
   v.morphDeltas[0].set([n%11*.01,-.2,.4],i*3);v.morphDeltas[1].set([.3,n%13*.01,-.1],i*3);
  }
  return v;
 };
 const arrays=v=>[v.positions,v.indices,v.weights,...v.morphDeltas];
 let oracleVertices=0;
 const check=v=>{
  const source=arrays(v),widths=[3,4,4,...v.morphDeltas.map(()=>3)],expected=[],seen=new Set();
  for(let i=0;i<v.positions.length/3;i++){
   // Independent byte-string oracle, retaining first occurrence and -0.
   const key=source.map((a,j)=>Buffer.from(a.buffer,a.byteOffset+i*widths[j]*a.BYTES_PER_ELEMENT,widths[j]*a.BYTES_PER_ELEMENT).toString('hex')).join(':');
   if(!seen.has(key)){seen.add(key);expected.push(source.map((a,j)=>Array.from(a.slice(i*widths[j],(i+1)*widths[j]))));}
  }
  compact(v);assert.equal(v.positions.length/3,expected.length);
  for(let i=0;i<expected.length;i++)arrays(v).forEach((a,j)=>assert.deepEqual(Array.from(a.slice(i*widths[j],(i+1)*widths[j])),expected[i][j]));
  if(expected.length<source[0].length/3)for(const a of arrays(v))assert.equal(a.byteLength,a.buffer.byteLength,'unused tails retained');
  const first=arrays(v);compact(v);assert.ok(arrays(v).every((a,i)=>a===first[i]),'compaction was not idempotent');
  oracleVertices+=expected.length;
 };
 check(make());check(make(4096,4096));check(make(4096,1));
 const edited=make();
 // Same position but different weights, indices or morph deltas must survive.
 edited.weights[1024*4]=.65;edited.indices[2048*4]=3;edited.morphDeltas[1][3072*3]=.33;
 edited.positions[1]=0;edited.positions[1024*3+1]=-0;
 check(edited);
 const offset=make();
 for(const key of ['positions','indices','weights']){
  const a=offset[key],b=new a.constructor(new ArrayBuffer(a.byteLength+a.BYTES_PER_ELEMENT*3),a.BYTES_PER_ELEMENT*3,a.length);b.set(a);offset[key]=b;
 }
 offset.morphDeltas=offset.morphDeltas.map(a=>{const b=new Float64Array(new ArrayBuffer(a.byteLength+24),24,a.length);b.set(a);return b;});check(offset);
 for(const v of [make(32,16),make(131073,1),{...make(),kernelInputsFinite:false}]){
  const before=arrays(v);compact(v);assert.ok(arrays(v).every((a,i)=>a===before[i]),'guarded input was changed');
 }
 const excessive=make(40000,1);excessive.morphDeltas=Array.from({length:16},()=>new Float64Array(120000));
 const prior=arrays(excessive);compact(excessive);assert.ok(arrays(excessive).every((a,i)=>a===prior[i]),'oversized tuples exceeded compaction budget');
 // Valid unused indices can deliberately collide the rolling hash. Exhaust
 // the bounded probe budget and keep every unprocessed vertex exactly.
 const collisions=make(4096,4096);collisions.morphDeltas=[];
 for(let i=0;i<4096;i++){
  collisions.indices.set([0,0,0,0],i*4);collisions.weights.set([1,0,0,0],i*4);
  const words=new Uint32Array(collisions.positions.buffer,i*24,6);let hash=2166136261;
  for(const word of words)hash=Math.imul(hash^word,16777619);
  for(let j=0;j<3;j++)hash=Math.imul(hash,16777619);
  collisions.indices[i*4+3]=hash>>>0;
 }
 const preserved=arrays(collisions).map(a=>a.slice()),copy=Uint32Array.prototype.copyWithin;let keptTail=false;
 Uint32Array.prototype.copyWithin=function(target,start,end){if(end-start>4096)keptTail=true;return copy.call(this,target,start,end);};
 try{compact(collisions);}finally{Uint32Array.prototype.copyWithin=copy;}
 assert.ok(keptTail,'adversarial hashes did not stop at the bounded probe budget');
 arrays(collisions).forEach((a,i)=>assert.deepEqual(a,preserved[i]));
 // Real Three.js skinning is the independent bounds oracle after compaction,
 // including live morph/pose/bind edits and formerly duplicate vertices splitting.
 const data=make(),geometry=new THREE.BufferGeometry(),bones=Array.from({length:4},()=>new THREE.Bone());
 geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
 geometry.setAttribute('skinIndex',new THREE.BufferAttribute(data.indices,4));
 geometry.setAttribute('skinWeight',new THREE.BufferAttribute(data.weights,4));
 geometry.morphAttributes.position=data.morphDeltas.map(a=>new THREE.BufferAttribute(a,3));geometry.morphTargetsRelative=true;
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());mesh.add(bones[0]);for(let i=1;i<4;i++){bones[i-1].add(bones[i]);bones[i].position.y=.3;}
 mesh.bind(new THREE.Skeleton(bones));
 const kernel=new SkinBoundsKernel();assert.ok(await kernel.warm());
 const js=new CharacterInteractionBounds(null),native=new CharacterInteractionBounds(kernel);let comparisons=0,maxError=0;
 const compare=()=>{
  mesh.updateMatrixWorld(true);mesh.computeBoundingBox();const expected=mesh.boundingBox.clone();
  const source=[geometry.attributes.position,geometry.attributes.skinIndex,geometry.attributes.skinWeight,...geometry.morphAttributes.position].map(a=>a.array.slice());
  const a=js.skinnedBounds(mesh).clone(),b=native.skinnedBounds(mesh).clone();assert.deepEqual(a,b);
  const error=Math.max(a.min.distanceTo(expected.min),a.max.distanceTo(expected.max));maxError=Math.max(maxError,error);assert.ok(error<1e-10);
  [geometry.attributes.position,geometry.attributes.skinIndex,geometry.attributes.skinWeight,...geometry.morphAttributes.position].forEach((a,i)=>assert.deepEqual(a.array,source[i],'render geometry was mutated'));
  comparisons++;
 };
 compare();assert.equal(native.skinVertices.get(mesh).positions.length/3,1024);
 for(let i=0;i<40;i++){
  bones.forEach((bone,j)=>{bone.rotation.set(i*.03*(j+1),i*.02,-i*.01);bone.scale.set(1+Math.sin(i)*.1,.9,1.1);});
  mesh.morphTargetInfluences[0]=Math.sin(i)*1.3;mesh.morphTargetInfluences[1]=Math.cos(i)*.7;compare();
 }
 for(const name of ['position','skinIndex','skinWeight']){
  const a=geometry.attributes[name];a.setX(1024,a.getX(1024)+(name==='skinIndex'?1:.1));a.needsUpdate=true;compare();
  geometry.setAttribute(name,a.clone());compare();
 }
 geometry.morphAttributes.position[0].setX(1024,9);geometry.morphAttributes.position[0].needsUpdate=true;compare();
 geometry.morphTargetsRelative=false;compare();geometry.morphTargetsRelative=true;compare();
 geometry.morphAttributes.position.push(geometry.attributes.position.clone());mesh.updateMorphTargets();mesh.morphTargetInfluences[2]=.2;compare();
 mesh.bindMatrix.makeScale(.7,1.2,.9);compare();mesh.bindMatrix.elements[3]=.001;compare();mesh.morphTargetInfluences[0]=.8;compare();
 // Nonfinite geometry keeps every original sample and the exact invalid fallback.
 geometry.attributes.position.setX(0,Infinity);geometry.attributes.position.needsUpdate=true;
 mesh.updateMatrixWorld(true);const original=js.skinnedBounds(mesh).clone(),actual=native.skinnedBounds(mesh).clone();assert.deepEqual(actual,original);
 assert.equal(native.skinVertices.get(mesh).positions.length/3,4096);
 console.log(JSON.stringify({passed:true,oracleVertices,threeComparisons:comparisons,maxError,sourceVertices:4096,compactedVertices:1024,renderGeometryUnchanged:true,transientIndexLimitBytes:1048576}));
}finally{await server.close();}
