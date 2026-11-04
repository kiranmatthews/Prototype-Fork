import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import ts from 'typescript';

async function load(name) {
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=createRequire(import.meta.url),module={exports:{}};
  new Function('require','module','exports',js)(id=>id==='three'?THREE:require(id),module,module.exports);
  return module.exports;
}
const {BackgroundPartSelection}=await load('backgroundParts'),{preciseBounds}=await load('modelBounds');
const geometry=new THREE.BufferGeometry();
geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,3,0,999,999,999],3));
geometry.setIndex([0,1,2]);
const material=new THREE.MeshBasicMaterial();
const mesh=(name,id)=>{const m=new THREE.Mesh(geometry,material);m.name=`sanitized_${id}`;
  m.userData={name,jakSourceNode:id};return m;};
const root=new THREE.Group(),tie=new THREE.Group(),shrub=new THREE.Group(),terrain=new THREE.Group();
tie.name='beach-tie-0';shrub.name='beach-shrub-0';terrain.name='beach-tfrag-normal';
const prop=new THREE.Group();prop.userData={name:'palm.tree.mb',jakSourceNode:2};
const left=mesh('left',20),right=mesh('right',21);right.position.x=10;prop.add(left,right);
const hidden=mesh('pre-hidden',22);hidden.visible=false;hidden.position.x=100;prop.add(hidden);
const wind=mesh('wind-group-4-8',3);wind.position.set(4,1,-2);wind.rotation.y=Math.PI/2;
const plant=mesh('palm.tree.mb',5);plant.position.set(-6,0,3);
tie.add(prop,wind,new THREE.Group());shrub.add(plant);terrain.add(mesh('ground',7));
root.add(tie,shrub,terrain);
const derived=root.clone(true),selection=new BackgroundPartSelection(root,derived);
assert.deepEqual(selection.parts.map(p=>[p.id,p.name,p.kind,p.meshes]),[
  ['node:2','palm.tree.mb','prop',3],['node:3','wind-group-4-8','wind-draw',1],['node:5','palm.tree.mb','shrub',1],
]);
const geometryBefore=[...geometry.getAttribute('position').array],indicesBefore=[...geometry.index.array];
const transforms=[];root.traverse(n=>transforms.push([n,n.position.toArray(),n.quaternion.toArray(),n.scale.toArray(),n.parent]));
selection.select('node:2');
assert.equal(root.children[1].visible,false);assert.equal(root.children[2].visible,false);
assert.equal(derived.children[1].visible,false);assert.equal(wind.visible,false);assert.equal(hidden.visible,false);
assert.deepEqual(preciseBounds(root).min.toArray(),[0,0,0]);assert.deepEqual(preciseBounds(root).max.toArray(),[12,3,0]);
assert.deepEqual(preciseBounds(derived),preciseBounds(root),'comparison isolates the same complete placements');
const gallery=new THREE.Group();gallery.position.set(1000,4,-600);gallery.rotation.y=.9;gallery.scale.setScalar(.003);gallery.add(root);
const bounds=preciseBounds(root);
assert.ok(bounds.min.distanceTo(new THREE.Vector3())<1e-7);assert.ok(bounds.max.distanceTo(new THREE.Vector3(12,3,0))<1e-7,
  'source bounds must ignore native/gallery scale and placement');
selection.select('node:3');
const windBounds=preciseBounds(root);
assert.ok(windBounds.min.distanceTo(new THREE.Vector3(4,1,-4))<1e-7);
assert.ok(windBounds.max.distanceTo(new THREE.Vector3(4,4,-2))<1e-7,'wind node matrix retained');
const beforeInvalid=selection.current;
assert.throws(()=>selection.select('node:999'),/Unknown source scene part/);assert.equal(selection.current,beforeInvalid);
selection.select('');
assert.equal(tie.visible,true);assert.equal(shrub.visible,true);assert.equal(terrain.visible,true);
assert.equal(prop.visible,true);assert.equal(wind.visible,true);assert.equal(hidden.visible,false);
for(const [n,p,q,s,parent] of transforms) {
  assert.deepEqual(n.position.toArray(),p);assert.deepEqual(n.quaternion.toArray(),q);assert.deepEqual(n.scale.toArray(),s);
  if(n!==root)assert.equal(n.parent,parent);
}
assert.deepEqual([...geometry.getAttribute('position').array],geometryBefore);assert.deepEqual([...geometry.index.array],indicesBefore);
assert.equal(prop.children[0].geometry,derived.children[0].children[0].children[0].geometry);
// Bounds still evaluate an articulated mesh's drawn bind-transformed vertices.
const skinGeometry=new THREE.BufferGeometry();skinGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
skinGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(Array(12).fill(0),4));
skinGeometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
const skin=new THREE.SkinnedMesh(skinGeometry,material),bone=new THREE.Bone();skin.add(bone);skin.bind(new THREE.Skeleton([bone]));
bone.position.y=2;
assert.deepEqual(preciseBounds(skin).min.toArray(),[0,2,0]);assert.deepEqual(preciseBounds(skin).max.toArray(),[1,3,0]);
console.log('PASS source prototype identity, complete placements, mirrored isolation/restoration, original transforms/geometry, native-scale bounds, wind matrices and skin bounds');
