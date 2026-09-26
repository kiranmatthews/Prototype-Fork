import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
 const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
 const {SkinBoundsKernel}=await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
 const kernel=new SkinBoundsKernel();assert.equal(await kernel.warm(),true);
 for(const [mode,accelerator] of [['JavaScript',null],['WebAssembly',kernel]]){
 const measure=new CharacterInteractionBounds(accelerator),scalar=new CharacterInteractionBounds(null),root=new THREE.Group(),geometry=new THREE.BufferGeometry();
 const positions=[],indices=[],weights=[],morph=[];let seed=123;
 const rand=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let i=0;i<1000;i++){
  const p=[rand()*4-2,rand()*6-3,rand()*2-1];positions.push(...p);morph.push(...p.map(v=>v+.3*rand()));
  indices.push(i%4,(i+1)%4,(i+2)%4,(i+3)%4);
  // Include zero weights, four-way blends, and non-unit sums.
  weights.push(...(i%3===0?[1,0,0,0]:i%3===1?[.3,.2,.1,.4]:[.1,.2,.2,.2]));
 }
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(morph,3),new THREE.Float32BufferAttribute(morph.map(v=>v*.7-.2),3)];
 const bones=Array.from({length:4},()=>new THREE.Bone()),mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
 root.add(mesh);mesh.add(bones[0]);for(let i=1;i<4;i++){bones[i-1].add(bones[i]);bones[i].position.y=.5;}
 mesh.bind(new THREE.Skeleton(bones),new THREE.Matrix4().makeTranslation(.1,.2,.3));
 const expected=new THREE.Box3(),actual=new THREE.Box3();
 let checks=0;
 for(const relative of [false,true])for(let pose=0;pose<30;pose++){
  geometry.morphTargetsRelative=relative;mesh.morphTargetInfluences[0]=(pose%5)/4;mesh.morphTargetInfluences[1]=(pose%7)/6;
  root.position.set(Math.sin(pose),pose*.01,-2);root.rotation.y=pose*.03;
  for(let i=0;i<4;i++){bones[i].rotation.set(pose*.03*(i+1),pose*.02,pose*.04);bones[i].scale.set(1+Math.sin(pose)*.1,1+Math.cos(pose)*.2,1);}
  root.updateWorldMatrix(true,true);mesh.computeBoundingBox();expected.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);
  assert.ok(measure.measure(root,actual));
  if(accelerator){const exact=new THREE.Box3();scalar.measure(root,exact);assert.deepEqual(actual,exact,`bit-exact scalar/kernel ${relative}/${pose}`);}
  assert.ok(expected.min.distanceTo(actual.min)<1e-10&&expected.max.distanceTo(actual.max)<1e-10,`exact skin/morph bounds ${relative}/${pose}`);checks++;
 }
 const compare=()=>{root.updateWorldMatrix(true,true);mesh.computeBoundingBox();expected.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);measure.measure(root,actual);assert.ok(expected.min.distanceTo(actual.min)<1e-10&&expected.max.distanceTo(actual.max)<1e-10);if(accelerator){const exact=new THREE.Box3();scalar.measure(root,exact);assert.deepEqual(actual,exact,'bit-exact scalar/kernel after edits');}checks++;};
 // Warm-cache invalidation: edits must be visible on the very next tick.
 geometry.attributes.position.setXYZ(0,20,10,-8);geometry.attributes.position.needsUpdate=true;compare();
 geometry.attributes.skinWeight.setXYZW(0,.2,.3,.4,.1);geometry.attributes.skinWeight.needsUpdate=true;compare();
 geometry.attributes.skinIndex.setXYZW(0,3,2,1,0);geometry.attributes.skinIndex.needsUpdate=true;compare();
 geometry.morphAttributes.position[0].setXYZ(0,-40,12,5);geometry.morphAttributes.position[0].needsUpdate=true;compare();
 mesh.bindMatrix.makeScale(1.1,.7,1.3);compare();
 mesh.bindMatrix.elements[3]=.001;compare();mesh.morphTargetInfluences[0]=.1;compare();mesh.bindMatrix.elements[3]=0;compare();
 // Affine specialization must fall back independently for perspective in a
 // bone palette or in the final bind inverse, even after an affine warm-up.
 mesh.skeleton.boneInverses[1].elements[7]=.003;compare();
 mesh.skeleton.boneInverses[1].elements[7]=0;compare();
 mesh.bindMatrixInverse.elements[11]=.002;compare();
 mesh.bindMatrixInverse.elements[11]=0;compare();
 // An affine inverse calculated from ordinary transforms can have d=1±ulp.
 // These constant divisors must use native arithmetic at the same multiply
 // point as JS, including negative d and non-unit skin-weight sums.
 for(const divisor of [1+Number.EPSILON,1-Number.EPSILON/2,.7,2,-1.3]){
   mesh.skeleton.boneInverses[1].elements[15]=divisor;
   mesh.bindMatrixInverse.elements[15]=divisor;
   const before=kernel.diagnostics().calls;compare();
   if(accelerator)assert.equal(kernel.diagnostics().calls-before,1,'constant homogeneous divisors must run native');
 }
 mesh.skeleton.boneInverses[1].elements[15]=1;mesh.bindMatrixInverse.elements[15]=1;compare();
 const interleaved=new THREE.InterleavedBuffer(new Float32Array(geometry.attributes.position.count*4),4);
 for(let i=0;i<geometry.attributes.position.count;i++)interleaved.array.set([0,...[0,1,2].map(c=>geometry.attributes.position.getComponent(i,c))],i*4);
 geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,1));compare();
 geometry.attributes.position.setXYZ(0,2,3,4);interleaved.needsUpdate=true;compare();
 const normalizedWeights=new THREE.Uint8BufferAttribute(Array.from({length:4000},(_,i)=>i%4===0?255:0),4,true);
 geometry.setAttribute('skinWeight',normalizedWeights);compare();
 const getter=mesh.getVertexPosition;mesh.getVertexPosition=function(i,v){getter.call(this,i,v);v.x+=.5;return v;};compare();
 mesh.getVertexPosition=getter;
 geometry.attributes.position.setX(0,Infinity);interleaved.needsUpdate=true;
 assert.equal(measure.measure(root,actual),false,'non-finite vertices must retain the invalid-bounds fallback');
 if(accelerator){assert.ok(kernel.diagnostics().calls>=65,'the native kernel must actually measure the eligible poses');assert.ok(kernel.diagnostics().fallbacks.unsupported>=3);assert.ok(kernel.diagnostics().fallbacks.invalid>=1);}
 console.log(`PASS ${mode}: ${checks} full-vertex bounds comparisons with Three.js: skin/morph/deformation, cache invalidation, interleaved/normalized attributes and custom getters.`);
 }
 // Exercise native f64 edge cases against the exact same cached JS loop,
 // including signed zero, subnormal values and negative/non-unit weights.
 const edgeGeometry=new THREE.BufferGeometry(),count=256;
 edgeGeometry.setAttribute('position',new THREE.BufferAttribute(new Float64Array(count*3),3));
 edgeGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
 edgeGeometry.setAttribute('skinWeight',new THREE.BufferAttribute(new Float64Array(count*4),4));
 const edgeBone=new THREE.Bone(),edge=new THREE.SkinnedMesh(edgeGeometry,new THREE.MeshBasicMaterial());edge.add(edgeBone);edge.bind(new THREE.Skeleton([edgeBone]));
 const edgeScalar=new CharacterInteractionBounds(null),edgeNative=new CharacterInteractionBounds(kernel);
 const exactEdge=()=>{edge.updateWorldMatrix(true,true);const expected=edgeScalar.skinnedBounds(edge).clone(),before=kernel.diagnostics().calls;const actual=edgeNative.skinnedBounds(edge).clone();assert.deepEqual(actual,expected);return kernel.diagnostics().calls-before;};
 for(const p of [0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,1.23e-250,-1.23e100]){
  edgeGeometry.attributes.position.array.fill(p);edgeGeometry.attributes.position.needsUpdate=true;
  for(let i=0;i<count;i++)edgeGeometry.attributes.skinWeight.setXYZW(i,i%2?-.5:2,.3,-0,0);
  edgeGeometry.attributes.skinWeight.needsUpdate=true;
  assert.equal(exactEdge(),1,'finite double-precision case must run native');
 }
 for(const invalid of [NaN,Infinity,-Infinity]){
  edgeGeometry.attributes.position.setX(0,invalid);edgeGeometry.attributes.position.needsUpdate=true;
  assert.equal(exactEdge(),0,'nonfinite cached vertices must run JS');
 }
 edgeGeometry.attributes.position.array.fill(Number.MAX_VALUE);edgeGeometry.attributes.position.needsUpdate=true;
 assert.equal(exactEdge(),0,'finite inputs whose blends overflow must return to JS');
 // Morph accumulation can overflow before skinning even when every weight
 // is zero; retaining the JS zero-weight loop still gives finite bounds.
 edgeGeometry.morphTargetsRelative=true;
 edgeGeometry.morphAttributes.position=[new THREE.BufferAttribute(new Float64Array(count*3).fill(Number.MAX_VALUE),3)];edge.updateMorphTargets();edge.morphTargetInfluences[0]=2;
 edgeGeometry.attributes.skinWeight.array.fill(0);edgeGeometry.attributes.skinWeight.needsUpdate=true;
 assert.equal(exactEdge(),0,'morph overflow with zero weights must run original loop');
 edgeGeometry.morphAttributes.position=[];edge.updateMorphTargets();
 edgeGeometry.attributes.position.array.fill(-0);edgeGeometry.attributes.position.needsUpdate=true;
 assert.equal(exactEdge(),1,'all-zero weights and signed-zero coordinates remain eligible');
 for(const divisor of [.7,-1.3,1e-300,1e300]){
   edge.skeleton.boneInverses[0].elements[15]=divisor;edge.bindMatrixInverse.elements[15]=divisor;
   assert.equal(exactEdge(),1,'finite constant divisors preserve zero-weight and signed-zero arithmetic');
 }
 for(const divisor of [0,-0,Number.MIN_VALUE,Infinity,NaN]){
   edge.skeleton.boneInverses[0].elements[15]=divisor;edge.bindMatrixInverse.elements[15]=divisor;
   assert.equal(exactEdge(),0,'zero/nonfinite divisors or reciprocals must retain JS behavior');
 }
 edge.skeleton.boneInverses[0].identity();edge.bindMatrixInverse.identity();
 edgeGeometry.attributes.position.array.fill(1);edgeGeometry.attributes.position.needsUpdate=true;
 for(const field of ['skinWeight','position']){
  const old=edgeGeometry.attributes[field].getX(0);edgeGeometry.attributes[field].setX(0,NaN);edgeGeometry.attributes[field].needsUpdate=true;
  assert.equal(exactEdge(),0);edgeGeometry.attributes[field].setX(0,old);edgeGeometry.attributes[field].needsUpdate=true;
 }
 edge.skeleton.boneInverses[0].elements[0]=NaN;assert.equal(exactEdge(),0);edge.skeleton.boneInverses[0].identity();
 edge.bindMatrixInverse.elements[0]=Infinity;assert.equal(exactEdge(),0);edge.bindMatrixInverse.identity();
 // Direct ABI input avoids creating an oversized scene just to verify the
 // hard memory limit and the fact that measurements never grow per mesh.
 const vertices={positions:new Float64Array(count*3),morphDeltas:[],indices:new Uint32Array(count*4),weights:new Float64Array(count*4),kernelInputsFinite:true,highestWeightedIndex:0};
 for(let i=0;i<count;i++)vertices.weights[i*4]=1;
 const palette=[new THREE.Matrix4()],inverse=new THREE.Matrix4().elements,box=new THREE.Box3();
 const bytesBefore=kernel.diagnostics().workspaceBytes;
 for(let i=0;i<30;i++)assert.equal(kernel.measure(vertices,[],palette,inverse,box,true),true);
 assert.equal(kernel.diagnostics().workspaceBytes,bytesBefore,'workspace reuses memory across meshes/frames');
 vertices.morphDeltas=[new Float64Array(count*3)];
 assert.equal(kernel.measure(vertices,[NaN],palette,inverse,box,true),false);
 assert.equal(kernel.measure(vertices,[Infinity],palette,inverse,box,true),false);
 vertices.morphDeltas=[];vertices.highestWeightedIndex=1;
 assert.equal(kernel.measure(vertices,[],palette,inverse,box,true),false);vertices.highestWeightedIndex=0;
 const beforeMalformed=kernel.diagnostics();
 for(const malformed of [
   {...vertices,positions:new Float64Array(count*3+1)},
   {...vertices,weights:new Float64Array(count*4-1)},
   {...vertices,indices:new Uint32Array(count*4-1)},
   {...vertices,morphDeltas:[new Float64Array(count*3-1)]},
   {...vertices,highestWeightedIndex:NaN},
 ])assert.equal(kernel.measure(malformed,[],palette,inverse,box,true),false,'malformed ABI input must fall back without invoking native');
 assert.equal(kernel.measure(vertices,[],palette,inverse.slice(1),box,true),false);
 assert.equal(kernel.measure(vertices,[],[{elements:inverse.slice(1)}],inverse,box,true),false,'short palette matrices must be rejected');
 assert.equal(kernel.measure(vertices,[],[],inverse,box,true),false,'weighted indices require an existing palette entry');
 assert.equal(kernel.diagnostics().calls,beforeMalformed.calls,'malformed inputs never invoke the kernel');
 assert.equal(kernel.diagnostics().copiedBytes,beforeMalformed.copiedBytes,'malformed inputs are rejected before copying');
 assert.equal(kernel.diagnostics().workspaceBytes,beforeMalformed.workspaceBytes,'malformed inputs cannot grow workspace');
 const bigCount=120000,oversize={positions:new Float64Array(bigCount*3),morphDeltas:[],indices:new Uint32Array(bigCount*4),weights:new Float64Array(bigCount*4),kernelInputsFinite:true,highestWeightedIndex:0};
 assert.equal(kernel.measure(oversize,[],palette,inverse,box,true),false);
 assert.equal(kernel.diagnostics().workspaceBytes,bytesBefore,'oversized meshes must not allocate native memory');
 assert.equal(kernel.diagnostics().fallbacks.oversize,1);
 assert.ok(kernel.diagnostics().workspaceBytes<=8*1024*1024);
 assert.throws(()=>kernel.exports.memory.grow(128),RangeError,'module enforces its 8 MiB maximum independently');
 const failed=new SkinBoundsKernel(async()=>{throw new Error('simulated CSP/module failure');});
 assert.equal(await failed.warm(),false);assert.equal(await failed.warm(),false);
 assert.equal(failed.measure(vertices,[],palette,inverse,box,true),false);
 assert.equal(failed.diagnostics().status,'unavailable');assert.equal(failed.diagnostics().workspaceBytes,0);
 // A helper which compiled successfully can fail later during memory growth
 // or execution. Its resolved warm promise must not claim it is still usable,
 // retain its workspace, or cause an implicit compilation retry.
 for(const failure of ['runtime','growth']){
   let compiles=0,nativeCalls=0;
   const broken=new SkinBoundsKernel(async()=>{
     compiles++;const memory=new WebAssembly.Memory({initial:1,maximum:128});
     if(failure==='growth')memory.grow=()=>{throw new RangeError('simulated allocation failure');};
     return {instance:{exports:{memory,measure(){nativeCalls++;throw new WebAssembly.RuntimeError('simulated trap');}}}};
   });
   assert.equal(await broken.warm(),true);assert.equal(broken.diagnostics().workspaceBytes,65536);
   const n=failure==='growth'?1000:count;
   const input={positions:new Float64Array(n*3),morphDeltas:[],indices:new Uint32Array(n*4),weights:new Float64Array(n*4),kernelInputsFinite:true,highestWeightedIndex:0};
   assert.equal(broken.measure(input,[],palette,inverse,box,true),false);
   assert.equal(broken.diagnostics().status,'unavailable');assert.equal(broken.diagnostics().workspaceBytes,0);
   assert.equal(broken.exports,null);assert.equal(broken.floats,null);assert.equal(broken.integers,null);
   assert.equal(await broken.warm(),false);assert.equal(await broken.warm(),false);
   assert.equal(broken.measure(input,[],palette,inverse,box,true),false);
   assert.equal(compiles,1,'permanently failed helpers never retry compilation');
   assert.equal(nativeCalls,failure==='growth'?0:1,'growth failure stops before the native invocation');
   if(failure==='growth')assert.equal(broken.diagnostics().copiedBytes,0,'growth failure stops before copying');
 }
 const native=globalThis.WebAssembly;
 try{globalThis.WebAssembly=undefined;const unsupported=new SkinBoundsKernel();assert.equal(await unsupported.warm(),false);assert.equal(unsupported.measure(vertices,[],palette,inverse,box,true),false);}finally{globalThis.WebAssembly=native;}
 console.log('PASS exact f64 edge cases, module/runtime/growth failures, overflow fallback, pre-copy ABI validation, workspace reuse and enforced 8 MiB memory bound.');
}finally{await server.close();}
