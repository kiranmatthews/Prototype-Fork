import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import * as THREE from 'three';

const source=await readFile(new URL('../src/render-quality/worldFrame.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {prepareWorldFrame,finishWorldFrame}=await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const scene=new THREE.Scene();scene.matrixAutoUpdate=false;
const parent=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
scene.add(parent);parent.add(mesh);mesh.position.set(1,2,3);parent.position.x=10;
const render=()=>{if(scene.matrixWorldAutoUpdate)scene.updateMatrixWorld();};
let visits=0;const update=mesh.updateMatrixWorld.bind(mesh);
mesh.updateMatrixWorld=force=>{visits++;update(force);};
for(let frame=0;frame<3;frame++){
 parent.position.x+=2;mesh.position.y+=1;
 const automatic=prepareWorldFrame(scene);
 try{
  render();render();render();
  assert.equal(visits,frame+1,'one hierarchy update shared by all world passes');
  assert.equal(mesh.matrixWorld.elements[12],13+frame*2);
  assert.equal(mesh.matrixWorld.elements[13],3+frame);
  const nested=prepareWorldFrame(scene);render();finishWorldFrame(scene,nested);
  assert.equal(scene.matrixWorldAutoUpdate,false,'nested scope respects prepared pose');
 }finally{finishWorldFrame(scene,automatic);}
 assert.equal(scene.matrixWorldAutoUpdate,true);
}
const automatic=prepareWorldFrame(scene);
try{throw Error('render failed');}catch{}finally{finishWorldFrame(scene,automatic);}
assert.equal(scene.matrixWorldAutoUpdate,true,'render failure restores renderer defaults');
scene.matrixWorldAutoUpdate=false;
const before=visits,manual=prepareWorldFrame(scene);finishWorldFrame(scene,manual);
assert.equal(visits,before,'explicit caller-owned matrices remain untouched');
assert.equal(scene.matrixWorldAutoUpdate,false);
scene.matrixWorldAutoUpdate=true;parent.position.z=22;render();
assert.equal(mesh.matrixWorld.elements[14],25,'standalone/editor renders retain automatic updates');
mesh.geometry.dispose();mesh.material.dispose();
console.log('PASS shared world poses, animated transforms, nested scopes, exception cleanup and standalone rendering');
