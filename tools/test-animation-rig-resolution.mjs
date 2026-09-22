import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {resolvePlayerAnimationRig}=await server.ssrLoadModule('/src/animation/bridge.ts');
  const root=new THREE.Group();root.name='root';
  const a=new THREE.Group(),b=new THREE.Group(),first=new THREE.Group(),second=new THREE.Group();
  a.name='branch-a';b.name='branch-b';first.name=second.name='duplicate';
  a.add(first);b.add(second);root.add(a,b);
  const hidden=new THREE.Group();hidden.name='hidden';hidden.visible=false;first.add(hidden);
  root.userData.sculptRuntime={joints:{root:'root',branch:'branch-a',first:'duplicate',alias:'duplicate',hidden:'hidden',missing:'absent',invalid:4},mirrorPairs:[['first','hidden']],deformations:[]};
  let comparisons=0;
  function verify() {
    const entries=Object.entries(root.userData.sculptRuntime.joints).filter(([,name])=>typeof name==='string');
    const expected=entries.map(([id,name])=>[id,root.getObjectByName(name)]).filter(([,node])=>node);
    const expectedParents=new Map(expected.map(([id,node])=>[node,id]));
    const rig=resolvePlayerAnimationRig(root);
    assert.deepEqual(rig.joints.map(j=>[j.id,j.node]),expected);
    for(const joint of rig.joints) {
      let parent=joint.node.parent;while(parent&&parent!==root.parent&&!expectedParents.has(parent))parent=parent.parent;
      assert.equal(joint.parentId,expectedParents.get(parent)??null);
      assert.equal(rig.jointsById.get(joint.id),joint);
    }
    comparisons++;
  }
  verify();
  first.name='renamed';verify();
  a.add(second);verify();
  second.removeFromParent();verify();
  root.userData.sculptRuntime.joints.first='renamed';verify();
  root.userData.sculptRuntime.joints.empty='';const unnamed=new THREE.Group();root.add(unnamed);verify();
  const replacement=new THREE.Group();replacement.name='renamed';root.add(replacement);first.removeFromParent();verify();
  root.userData.sculptRuntime.joints={root:'root'};verify();
  // Work scales with hierarchy size, independent of declared-joint count.
  root.userData.sculptRuntime.joints=Object.fromEntries(Array.from({length:80},(_,i)=>[`alias${i}`,'root']));
  const traverse=root.traverse;let visits=0;
  root.traverse=function(callback){return traverse.call(this,node=>{visits++;callback(node);});};
  const rig=resolvePlayerAnimationRig(root);assert.equal(rig.joints.length,80);
  let count=0;traverse.call(root,()=>count++);assert.equal(visits,count);
  console.log(`PASS ${comparisons} rig lookup/parent comparisons: duplicate and hidden names, aliases, renames, reparenting, late replacement and metadata edits; one traversal for 80 joints.`);
} finally {await server.close();}
