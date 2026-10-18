import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import * as THREE from 'three';

const fixture=new URL('./fixtures/skate-race-finish-visual.json',import.meta.url);
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const results=[];
try{
 const {createRaceFinish}=await server.ssrLoadModule('/src/race/finish.ts');
 for(const width of [12,44,72]){
  const group=createRaceFinish(width);group.updateMatrixWorld(true);
  const meshes=group.children.filter(o=>o.isMesh),triangles=[],materials=new Map();
  const vertex=new THREE.Vector3(),normal=new THREE.Vector3();
  const round=n=>Number(n.toFixed(3))||0;
  for(const mesh of meshes){
   const {geometry:g,material:m}=mesh,normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
   materials.set(m.color.getHexString(),{color:m.color.getHexString(),type:m.type,side:m.side,transparent:m.transparent,opacity:m.opacity,depthWrite:m.depthWrite,fog:m.fog});
   for(let i=0;i<g.index.count;i+=3){
    const corners=[];
    for(let j=0;j<3;j++){
     const index=g.index.getX(i+j);vertex.fromBufferAttribute(g.attributes.position,index).applyMatrix4(mesh.matrixWorld);
     normal.fromBufferAttribute(g.attributes.normal,index).applyNormalMatrix(normalMatrix);
     corners.push([...vertex.toArray(),...normal.toArray(),g.attributes.uv.getX(index),g.attributes.uv.getY(index)].map(round));
    }
    // Preserve winding, vertex normals and UVs, while ignoring draw order.
    triangles.push(JSON.stringify([m.color.getHexString(),corners]));
   }
   assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
  }
  const bounds=new THREE.Box3().setFromObject(group);
  results.push({width,triangles:triangles.length,geometryHash:createHash('sha256').update(triangles.sort().join('\n')).digest('hex'),bounds:[...bounds.min.toArray(),...bounds.max.toArray()].map(round),materials:[...materials.values()].sort((a,b)=>a.color.localeCompare(b.color))});
  if(!process.argv.includes('--record')){
   assert.equal(meshes.length,3,'116 identical authored boxes require only three material draws');
   for(const mesh of meshes){
    assert.ok(mesh.geometry.boundingBox&&mesh.geometry.boundingSphere,'batched culling bounds are explicit');
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     vertex.fromBufferAttribute(mesh.geometry.attributes.position,i);
     assert.ok(mesh.geometry.boundingBox.containsPoint(vertex),'all checker and post vertices remain inside the culling box');
     assert.ok(mesh.geometry.boundingSphere.distanceToPoint(vertex)<1e-6,'all checker and post vertices remain inside the culling sphere');
    }
   }
  }
  for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}
 }
 if(process.argv.includes('--record'))await writeFile(fixture,JSON.stringify({source:'Approved 116-box finish before material batching; geometry hash includes world positions, normals, UVs, winding and material colour at millimetre precision.',results},null,2)+'\n');
 else assert.deepEqual(results,JSON.parse(await readFile(fixture,'utf8')).results,'batching must preserve the approved finish geometry and materials');
 console.log(process.argv.includes('--record')?'Recorded approved finish geometry.':'PASS race finish: approved triangles/materials/footprint at three widths; three draws and conservative culling bounds.');
}finally{await server.close();}
