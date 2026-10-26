import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
  const {CartGouraudFire}=await server.ssrLoadModule('/src/golf-cart/gouraudFire.ts');
  const fire=new CartGouraudFire(12,'fire lifecycle test'),origin=new THREE.Vector3(2,3,4);
  const velocity=new THREE.Vector3(15,0,0),direction=new THREE.Vector3(1,0,0),matrix=new THREE.Matrix4();
  const matrices=fire.instanceMatrix.array,data=fire.geometry.attributes.flameData.array;
  fire.emit(0,origin,velocity,direction,.1,.35,.32,7,'jet');
  origin.set(100,100,100); // Turning/driving away must not drag an emitted flame with the nozzle.
  fire.present(.05);fire.getMatrixAt(0,matrix);const early=matrix.elements[12];
  assert.ok(early>2&&early<3);
  fire.present(.18);fire.getMatrixAt(0,matrix);const late=matrix.elements[12];
  assert.ok(late>early+1,'cutoff leaves a travelling tail, not a shrinking cone');
  const version=fire.instanceMatrix.version;fire.present(.18);
  assert.equal(fire.instanceMatrix.version,version,'paused rendering must not upload or advance fire');
  fire.present(.33);assert.equal(fire.count,0);assert.equal(fire.visible,false);
  for(let i=0;i<100;i++)fire.emit(1,origin,velocity,direction,.1,.3,.4,i,'fire');
  fire.present(1.2);assert.equal(fire.count,12,'the fixed pool bounds simultaneous fire');
  assert.equal(fire.instanceMatrix.array,matrices);assert.equal(fire.geometry.attributes.flameData.array,data);
  for(const attribute of [fire.instanceMatrix,...Object.values(fire.geometry.attributes)])assert.ok([...attribute.array].every(Number.isFinite));
  let geometries=0,materials=0,batches=0;
  fire.geometry.addEventListener('dispose',()=>geometries++);fire.material.addEventListener('dispose',()=>materials++);fire.addEventListener('dispose',()=>batches++);
  fire.destroy();assert.deepEqual([geometries,materials,batches],[1,1,1]);
  console.log(JSON.stringify({passed:true,travellingTail:[early,late],pauseStable:true,bounded:true,reusedBuffers:true,disposed:true}));
}finally{await server.close();}
