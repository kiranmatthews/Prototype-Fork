import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
 const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
 const measure=new CharacterInteractionBounds(),root=new THREE.Group(),geometry=new THREE.BufferGeometry();
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
  assert.ok(expected.min.distanceTo(actual.min)<1e-10&&expected.max.distanceTo(actual.max)<1e-10,`exact skin/morph bounds ${relative}/${pose}`);checks++;
 }
 const compare=()=>{root.updateWorldMatrix(true,true);mesh.computeBoundingBox();expected.copy(mesh.boundingBox).applyMatrix4(mesh.matrixWorld);measure.measure(root,actual);assert.ok(expected.min.distanceTo(actual.min)<1e-10&&expected.max.distanceTo(actual.max)<1e-10);checks++;};
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
 console.log(`PASS ${checks} full-vertex bounds comparisons with Three.js: skin/morph/deformation, cache invalidation, interleaved/normalized attributes and custom getters.`);
}finally{await server.close();}
