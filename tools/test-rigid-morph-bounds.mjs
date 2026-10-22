import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
  const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const measure=new CharacterInteractionBounds(null),point=new THREE.Vector3(),expected=new THREE.Box3();
  let cases=0,seed=721;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function attribute(kind,count=37){
    let a;
    if(kind==='float')a=new THREE.Float32BufferAttribute(new Float32Array(count*3),3);
    else if(kind==='double')a=new THREE.BufferAttribute(new Float64Array(count*3),3);
    else if(kind==='normalized')a=new THREE.Int16BufferAttribute(new Int16Array(count*3),3,true);
    else {
      const normalized=kind==='interleaved-normalized';
      const data=new THREE.InterleavedBuffer(normalized?new Uint16Array(count*5):new Float32Array(count*5),5);
      a=new THREE.InterleavedBufferAttribute(data,3,1,normalized);
    }
    for(let i=0;i<count;i++)a.setXYZ(i,(random()-.5)*.8,(random()-.5)*.8,(random()-.5)*.8);
    return a;
  }
  function compare(mesh){
    expected.makeEmpty();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++)expected.expandByPoint(mesh.getVertexPosition(i,point));
    const box=measure.localBounds(mesh);
    assert.deepEqual([...box.min.toArray(),...box.max.toArray()],[...expected.min.toArray(),...expected.max.toArray()],`case ${cases}`);
    cases++;
  }
  for(const kind of ['float','double','normalized','interleaved','interleaved-normalized'])
  for(const relative of [true,false])for(const targetCount of [0,1,3]){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',attribute(kind));
    geometry.morphTargetsRelative=relative;
    geometry.morphAttributes.position=Array.from({length:targetCount},()=>attribute(kind));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
    compare(mesh);const record=measure.cache.get(mesh),box=record.box;
    for(let frame=0;frame<24;frame++){
      for(let i=0;i<mesh.morphTargetInfluences.length;i++)mesh.morphTargetInfluences[i]=frame%5===0?0:random()*3-1;
      if(frame===4){geometry.attributes.position.setY(0,.45);geometry.attributes.position.needsUpdate=true;}
      if(frame===8&&targetCount){geometry.morphAttributes.position[0]=attribute(kind);}
      if(frame===12)geometry.morphTargetsRelative=!geometry.morphTargetsRelative;
      if(frame===16){geometry.morphAttributes.position.push(attribute(kind));mesh.morphTargetInfluences.push(.35);}
      if(frame===20){geometry.morphAttributes.position.pop();mesh.morphTargetInfluences.pop();}
      compare(mesh);assert.equal(measure.cache.get(mesh),record);assert.equal(record.box,box);
    }
    const native=mesh.getVertexPosition;let offset=4;
    mesh.getVertexPosition=function(i,out){native.call(this,i,out);out.y-=offset;return out;};
    compare(mesh);offset=7;compare(mesh);mesh.getVertexPosition=native;compare(mesh);
    if(targetCount){
      for(const influence of [NaN,Infinity,undefined]){mesh.morphTargetInfluences[0]=influence;compare(mesh);}
      mesh.morphTargetInfluences=undefined;compare(mesh);
    }
    geometry.dispose();mesh.material.dispose();
  }
  const emptyGeometry=new THREE.BufferGeometry();emptyGeometry.setAttribute('position',attribute('float',0));
  const empty=new THREE.Mesh(emptyGeometry);compare(empty);emptyGeometry.dispose();empty.material.dispose();
  console.log(JSON.stringify({passed:true,cases,formats:5,relativeAndAbsolute:true,zeroNegativeAndMultipleWeights:true,
    liveAttributeEdits:true,customReadersAndReturnToNative:true,nonfiniteParity:true,warmRecordsReused:true},null,2));
}finally{await server.close();}
