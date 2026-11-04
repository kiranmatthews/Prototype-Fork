import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import ts from 'typescript';

const source=await readFile(new URL('../../src/jak-lab/compactGeometry.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
const {compactGeometry}=module.exports;
const original=new THREE.BufferGeometry();
original.setAttribute('position',new THREE.Float32BufferAttribute([99,99,99, 1,2,3, 4,5,6, 7,8,9, 99,99,99],3));
const interleaved=new THREE.InterleavedBuffer(new Uint8Array([0,10,20,30,40, 0,50,60,70,80, 0,90,100,110,120,
  0,130,140,150,160, 0,170,180,190,200]),5);
original.setAttribute('color',new THREE.InterleavedBufferAttribute(interleaved,4,1,true));
original.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([999,999,999,999, 0,1,2,3, 4,5,6,7, 8,9,10,11, 999,999,999,999],4));
original.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,0, 2,3,4, 5,6,7, 8,9,10, 0,0,0],3)];
original.morphTargetsRelative=true;
original.setIndex([3,1,2,2,1,3]);original.addGroup(0,3,1);original.addGroup(3,3,0);original.setDrawRange(0,6);
const compact=compactGeometry(original);
assert.equal(compact.getAttribute('position').count,3);
assert.equal(compact.index.count,original.index.count,'all triangles retained');
assert.deepEqual(compact.groups,original.groups);assert.deepEqual(compact.drawRange,original.drawRange);
assert.equal(compact.morphTargetsRelative,true);
for(let i=0;i<original.index.count;i++) {
  const a=original.index.getX(i),b=compact.index.getX(i);
  for(const name of Object.keys(original.attributes))for(let channel=0;channel<original.getAttribute(name).itemSize;channel++)
    assert.equal(original.getAttribute(name).getComponent(a,channel),compact.getAttribute(name).getComponent(b,channel));
  for(let channel=0;channel<3;channel++)assert.equal(original.morphAttributes.position[0].getComponent(a,channel),compact.morphAttributes.position[0].getComponent(b,channel));
}
assert.equal(compact.getAttribute('color').normalized,true);
assert.ok(compact.getAttribute('color').array instanceof Uint8Array);
assert.ok(compact.getAttribute('skinIndex').array instanceof Uint16Array);
assert.deepEqual([...original.index.array],[3,1,2,2,1,3],'source remains immutable');
const unindexed=original.toNonIndexed(),copy=compactGeometry(unindexed);
assert.equal(copy.getAttribute('position').count,6);assert.notEqual(copy.getAttribute('position'),unindexed.getAttribute('position'));
console.log('PASS per-draw vertex compaction preserves exact normalized/interleaved attributes, skin indices, morphs, groups, all triangles and the original geometry');
