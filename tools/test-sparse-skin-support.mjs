import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const { CharacterInteractionBounds }=await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const fast=new CharacterInteractionBounds(null), reference=new CharacterInteractionBounds(null);
  const root=new THREE.Group(), geometry=new THREE.BufferGeometry();
  const positions=[],weights=[],indices=[],morph=[];let seed=1234;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<480;i++) {
    const point=[rand()*4-2,rand()*6-3,rand()*3-1.5]; positions.push(...point);morph.push(...point.map(x=>x+rand()*.4-.2));
    indices.push(i%4,(i+1)%4,(i+2)%4,(i+3)%4);
    weights.push(...(i%4===0?[1,0,0,0]:i%4===1?[.1,.3,.2,.4]:i%4===2?[-.2,.3,.4,.2]:[0,0,0,0]));
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(morph,3),new THREE.Float32BufferAttribute(morph.map(x=>x*.3),3)];
  const bones=Array.from({length:4},()=>new THREE.Bone()),mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
  root.add(mesh);mesh.add(bones[0]);for(let i=1;i<4;i++){bones[i-1].add(bones[i]);bones[i].position.y=.3;}
  mesh.bind(new THREE.Skeleton(bones),new THREE.Matrix4().makeTranslation(.2,.1,-.3));
  const normal=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(.1,-.2,.3),contact=new THREE.Vector3(),otherContact=new THREE.Vector3();
  const box=new THREE.Box3(),otherBox=new THREE.Box3(),measuredBox=new THREE.Box3();
  const nativeSkin=THREE.SkinnedMesh.prototype.applyBoneTransform, nativeMultiply=THREE.Matrix4.prototype.multiplyMatrices;
  let cases=0, warmPalette=null, warmMatrices=null, fastProducts=0, nativeProducts=0;
  function compare(label,{measured=false,worldReady=false}={}) {
    if(!worldReady)root.updateMatrixWorld(true);
    if(measured){fast.measure(root,measuredBox,true,true,true);reference.measure(root,measuredBox,true,true,true);}
    for(const mode of ['distance','contact','bounds']) {
      const args=[root,normal,origin,mode==='distance'?undefined:contact,mode==='bounds'?box:undefined,measured];
      let products=0;
      THREE.Matrix4.prototype.multiplyMatrices=function(a,b){products++;return nativeMultiply.call(this,a,b);};
      let actual,expected;
      try {
        actual=fast.sampledPlaneDistance(...args);fastProducts+=products;products=0;
        // Force the original Three.js getter without modifying its math.
        // The production fast path must also honor this overridable method.
        const saved=[];
        root.traverse(node=>{if(node.isSkinnedMesh){const method=node.applyBoneTransform;saved.push([node,method]);node.applyBoneTransform=function(i,v){return method.call(this,i,v);};}});
        try {expected=reference.sampledPlaneDistance(root,normal,origin,mode==='distance'?undefined:otherContact,mode==='bounds'?otherBox:undefined,measured);}
        finally {for(const [node,method] of saved)node.applyBoneTransform=method;}
        nativeProducts+=products;
      } finally {THREE.Matrix4.prototype.multiplyMatrices=nativeMultiply;}
      assert.equal(actual,expected,`${label}/${mode}: distance differs from native Three skinning`);
      if(mode!=='distance')assert.deepEqual(contact,otherContact,`${label}: contact changed`);
      if(mode==='bounds')assert.deepEqual(box,otherBox,`${label}: sampled box changed`);
      assert.equal(fast.supportSamples,reference.supportSamples,`${label}: query changed hull samples`);
      cases++;
    }
  }
  for(const relative of [false,true])for(let pose=0;pose<36;pose++) {
    geometry.morphTargetsRelative=relative;mesh.morphTargetInfluences[0]=(pose%7)/5;mesh.morphTargetInfluences[1]=(pose%5-2)/4;
    normal.set(Math.sin(pose)*.3,1,Math.cos(pose)*.4).normalize();
    root.position.set(Math.sin(pose),pose*.01,-2);root.rotation.set(pose*.02,pose*.05,pose*.03);root.scale.set(1.1,.8,-1.2);
    for(let i=0;i<4;i++)bones[i].rotation.set(pose*.03*(i+1),pose*.02,pose*.04);
    compare(`pose ${relative}/${pose}`,{measured:pose%2===0});
    const palette=fast.skinPalettes.get(mesh.skeleton);warmPalette??=palette;warmMatrices??=[...palette];
    assert.equal(palette,warmPalette);for(let i=0;i<palette.length;i++)assert.equal(palette[i],warmMatrices[i],'warm query allocated a bone matrix');
  }
  for(const attribute of ['position','skinWeight','skinIndex']) {
    geometry.setAttribute(attribute,geometry.getAttribute(attribute).clone());compare(`replace ${attribute}`);
    geometry.getAttribute(attribute).setX(0,attribute==='position'?-7:attribute==='skinWeight'?.8:3);
    geometry.getAttribute(attribute).needsUpdate=true;compare(`edit ${attribute}`);
  }
  geometry.morphAttributes.position[0]=geometry.morphAttributes.position[0].clone();compare('morph replacement');
  geometry.morphAttributes.position[0].setY(0,-12);geometry.morphAttributes.position[0].needsUpdate=true;compare('morph edit');
  mesh.bindMatrix.makeScale(1.2,.7,1.1);compare('bind edit');
  for(const divisor of [.7,-1.3,1+Number.EPSILON]) {
    mesh.skeleton.boneInverses[1].elements[15]=divisor;compare('homogeneous divisor');
  }
  mesh.skeleton.boneInverses[1].elements[7]=.003;compare('projective bone inverse');
  mesh.bindMatrix.elements[3]=.01;compare('projective bind');
  root.updateMatrixWorld(true);mesh.bindMatrixInverse.elements[11]=.002;compare('projective bind inverse',{worldReady:true});
  const interleaved=new THREE.InterleavedBuffer(new Float32Array(480*5),5);
  for(let i=0;i<480;i++)interleaved.array.set([0,...[0,1,2].map(c=>geometry.attributes.position.getComponent(i,c)),0],i*5);
  geometry.setAttribute('position',new THREE.InterleavedBufferAttribute(interleaved,3,1));compare('interleaved positions');
  geometry.setAttribute('skinWeight',new THREE.Uint8BufferAttribute(Array.from({length:480*4},(_,i)=>[100,55,60,40][i%4]),4,true));compare('normalized weights');
  geometry.setAttribute('position',new THREE.Int16BufferAttribute(Array.from({length:480*3},(_,i)=>Math.round(Math.sin(i)*20000)),3,true));compare('normalized positions');
  mesh.applyBoneTransform=function(i,v){nativeSkin.call(this,i,v);v.y-=.4;return v;};compare('custom bone transform');
  mesh.applyBoneTransform=nativeSkin;
  const nativeVertex=mesh.getVertexPosition;
  mesh.getVertexPosition=function(i,v){nativeVertex.call(this,i,v);v.x+=.3;return v;};compare('custom vertex getter');mesh.getVertexPosition=nativeVertex;
  // Every query must read live bone and inverse transforms, including when
  // no geometry/version changed and a sibling reuses the same skeleton.
  const sibling=new THREE.SkinnedMesh(geometry,mesh.material);sibling.bind(mesh.skeleton,new THREE.Matrix4().makeTranslation(2,3,1));sibling.position.x=3;root.add(sibling);
  for(let i=0;i<6;i++){bones[1].rotation.y+=.4;mesh.skeleton.boneInverses[2].elements[12]+=.05;compare('shared skeleton '+i);}
  root.remove(sibling);
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array(480*4).fill(0),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(Array.from({length:480*4},(_,i)=>i%4===0?1:0),4));
  const originalBones=mesh.skeleton.bones,originalInverses=mesh.skeleton.boneInverses;
  mesh.skeleton.bones=Array(2000).fill(bones[0]);mesh.skeleton.boneInverses=Array(2000).fill(originalInverses[0]);
  compare('sparse hull with a wide skeleton');assert.equal(fast.skinPalettes.get(mesh.skeleton).length,4,'tiny hull prepared thousands of unused matrices');
  mesh.skeleton.bones=originalBones;mesh.skeleton.boneInverses=originalInverses;
  mesh.skeleton.bones.push(undefined);mesh.skeleton.boneInverses.push(undefined);compare('unused missing bone');
  mesh.skeleton.bones.pop();mesh.skeleton.boneInverses.pop();
  // Shrinking a once-warm palette must not make an invalid used index point
  // to a stale transform retained from an earlier skeleton topology.
  mesh.skeleton.bones.length=mesh.skeleton.boneInverses.length=1;compare('shrunk skeleton');
  geometry.attributes.skinIndex.setX(0,3);assert.throws(()=>fast.sampledPlaneDistance(root,normal,origin,contact,box));assert.throws(()=>mesh.getVertexPosition(0,new THREE.Vector3()));
  geometry.attributes.skinIndex.setX(0,0);geometry.attributes.skinWeight.setY(0,0);geometry.attributes.skinIndex.setY(0,65535);compare('unused invalid index');
  const finite=geometry.attributes.position;
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float64Array(finite.array),3));
  for(const value of [Infinity,NaN,-Infinity]){geometry.attributes.position.array[0]=value;compare('nonfinite position');}
  geometry.setAttribute('position',finite);
  assert.ok(nativeProducts>fastProducts*5,'fixture did not remove repeated matrix products');
  console.log(JSON.stringify({passed:true,cases,exactDistanceContactAndBounds:true,warmPaletteReused:true,fastProducts,nativeProducts,savedProducts:nativeProducts-fastProducts},null,2));
  geometry.dispose();mesh.material.dispose();
}finally{await server.close();}
