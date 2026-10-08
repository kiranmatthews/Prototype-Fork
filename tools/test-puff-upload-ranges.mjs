import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {WebGLAttributes} from 'three/src/renderers/webgl/WebGLAttributes.js';
import {createServer} from 'vite';

// Exercise Three's actual upload/range-consumption code with byte-addressable
// mock GPU buffers. The reference is a full copy of every rendered CPU prefix.
export async function checkPuffUploads(PuffSystem,preset){
 const reports=[];
 for(const quality of ['high','medium','low']){
  const scene=new THREE.Scene(),system=new PuffSystem(64),camera=new THREE.PerspectiveCamera(60,1,.1,100);
  system.attach(scene);system.setQuality(quality);camera.position.set(0,2,10);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);
  const buffers=new Map(),bound=new Map(),rangeArrays=new WeakMap(),rangeObjects=new WeakMap();
  let bytes=0,fullEquivalent=0,updates=0,allocations=0;
  const gl={FLOAT:5126,UNSIGNED_SHORT:5123,ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,
   createBuffer(){const b={};buffers.set(b,null);return b;},bindBuffer(target,b){bound.set(target,b);},deleteBuffer(b){buffers.delete(b);},
   bufferData(target,array){allocations++;buffers.set(bound.get(target),new Uint8Array(array.buffer,array.byteOffset,array.byteLength).slice());},
   bufferSubData(target,offset,array,start,count){
    assert.notEqual(count,undefined,'live puffs must not fall back to whole-buffer uploads after Three consumes the previous range');
    assert.ok(count>0);const n=count*array.BYTES_PER_ELEMENT;bytes+=n;fullEquivalent+=array.byteLength;updates++;
    buffers.get(bound.get(target)).set(new Uint8Array(array.buffer,array.byteOffset+start*array.BYTES_PER_ELEMENT,n),offset);
   }};
  let attributes=WebGLAttributes(gl);const hash=createHash('sha256');
  const styles=['add','alpha','darken','softAdd'];
  for(let frame=0;frame<240;frame++){
   if(frame===80||frame===160)system.clear();
   if(frame%12===0)for(const [i,blend] of styles.entries())for(let j=0;j<2;j++)
    system.spawn({...preset,blend,life:[.3,.8]},i*.2,1,j*.2,{seed:frame*100+i*10+j+1,groundY:0});
   system.update(1/60,camera);
   if(frame===120){attributes=WebGLAttributes(gl);buffers.clear();bound.clear();}
   for(const mesh of scene.children.filter(o=>o.isMesh&&o.visible)){
    const geometry=mesh.geometry,index=geometry.getIndex(),count=geometry.drawRange.count;
    assert.ok(count>0);let vertices=0;for(let i=0;i<count;i++)vertices=Math.max(vertices,index.array[i]+1);
    for(const [attribute,used,target] of [[geometry.getAttribute('position'),vertices*3,gl.ARRAY_BUFFER],[geometry.getAttribute('color'),vertices*4,gl.ARRAY_BUFFER],[index,count,gl.ELEMENT_ARRAY_BUFFER]]){
     assert.equal(attribute.updateRanges.length,1);assert.ok(attribute.updateRanges[0].count>=used);
     if(rangeArrays.has(attribute)){assert.equal(attribute.updateRanges,rangeArrays.get(attribute));assert.equal(attribute.updateRanges[0],rangeObjects.get(attribute));}
     else{rangeArrays.set(attribute,attribute.updateRanges);rangeObjects.set(attribute,attribute.updateRanges[0]);}
     const cpu=new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,used*attribute.array.BYTES_PER_ELEMENT);
     hash.update(cpu);
     // Some simulation frames can pass without drawing. The next upload must
     // still reproduce every referenced vertex, colour and index exactly.
     if(frame%7===0)continue;
     attributes.update(attribute,target);
     const gpu=buffers.get(attributes.get(attribute).buffer);
     assert.deepEqual(gpu.subarray(0,cpu.length),cpu);
    }
   }
  }
  assert.ok(updates>500);assert.ok(bytes<fullEquivalent*.2,'sparse effects should upload their live data, not their pool capacity');
  reports.push({quality,updates,allocations,bytes,fullEquivalent,geometryHash:hash.digest('hex')});
  for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}
 }
 return reports;
}

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try{
 const {PuffSystem,PUFF_PRESETS}=await server.ssrLoadModule('/src/puffs.ts');
 console.log(JSON.stringify({pass:true,reports:await checkPuffUploads(PuffSystem,PUFF_PRESETS.dustLand)}));
}finally{await server.close();}
