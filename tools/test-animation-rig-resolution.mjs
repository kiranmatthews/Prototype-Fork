import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {resolvePlayerAnimationRig,PlayerAnimationBridge}=await server.ssrLoadModule('/src/animation/bridge.ts');
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
  // Length composition must still follow live nodes/policies without building
  // authoring-only rest snapshots when the runtime overlay never requests one.
  const model=new THREE.Group(),upper=new THREE.Group(),lower=new THREE.Group();
  upper.name='upper';lower.name='lower';lower.position.set(1,2,0);upper.add(lower);model.add(upper);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());mesh.position.y=1;upper.add(mesh);
  const policy={controlId:'stretch',jointId:'upper',downstreamJointIds:['lower'],lengthAxis:[0,1,0],min:.55,max:1.75,volume:'none'};
  const metadata={joints:{upper:'upper',lower:'lower'},deformations:[policy]};
  let restReads=0;Object.defineProperty(metadata,'restPose',{get(){restReads++;return {};}});
  model.userData.sculptRuntime=metadata;
  const bridge=new PlayerAnimationBridge(model,model),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
  bridge.setOverlay(({deltaSeconds,applyDeformations})=>{near(deltaSeconds,1/60);applyDeformations({stretch:1.2});});
  for(let frame=0;frame<240;frame++) {
    bridge.prepareLegacyPose();near(lower.position.y,2);near(mesh.scale.y,1);
    bridge.applyOverlay(1/60);near(lower.position.y,2.4);
    bridge.modulateDeformations({stretch:.75});near(lower.position.y,1.8);near(mesh.scale.y,.9);
  }
  assert.equal(restReads,0,'unused authoring snapshots were rebuilt during length composition');
  bridge.prepareLegacyPose();
  policy.max=1.1;bridge.applyDeformations({stretch:1.5});near(lower.position.y,2.2);
  bridge.prepareLegacyPose();policy.max=1.75;policy.lengthAxis=[1,0,0];
  bridge.applyDeformations({stretch:1.3});near(lower.position.x,1.3);near(lower.position.y,2);
  bridge.prepareLegacyPose();policy.lengthAxis=[0,1,0];
  upper.name='renamed';bridge.applyDeformations({stretch:1.4});near(lower.position.y,2);
  metadata.joints.upper='renamed';bridge.applyDeformations({stretch:1.4});near(lower.position.y,2.8);
  bridge.prepareLegacyPose();model.add(lower);
  bridge.applyDeformations({stretch:1.4});near(lower.position.y,2);near(mesh.scale.y,1.4);
  bridge.prepareLegacyPose();upper.add(lower);
  const endpointReplacement=new THREE.Group();endpointReplacement.name='lower';endpointReplacement.position.y=3;
  lower.removeFromParent();upper.add(endpointReplacement);
  bridge.applyDeformations({stretch:1.4});near(endpointReplacement.position.y,4.2);near(lower.position.y,2);
  bridge.prepareLegacyPose();metadata.joints.lower='missing';
  bridge.applyDeformations({stretch:1.4});near(endpointReplacement.position.y,3);near(mesh.scale.y,1);
  assert.equal(restReads,0);
  metadata.joints.lower='lower';
  let prior;
  bridge.setOverlay(context=>{
    const snapshot=context.rig;
    assert.equal(context.rig,snapshot,'one callback must retain the same requested snapshot');
    assert.notEqual(snapshot,prior,'the next callback must see live changes');
    assert.equal(snapshot.jointsById.get('lower').node,endpointReplacement);
    if(prior) {near(prior.jointsById.get('lower').rest.position[1],3);near(snapshot.jointsById.get('lower').rest.position[1],4);}
    prior=snapshot;
  });
  bridge.applyOverlay(1/60);bridge.prepareLegacyPose();endpointReplacement.position.y=4;bridge.applyOverlay(1/60);
  assert.ok(restReads>0,'an explicitly requested authoring snapshot was unavailable');
  bridge.setOverlay(null);mesh.geometry.dispose();mesh.material.dispose();
  console.log(`PASS ${comparisons} rig lookup/parent comparisons, one traversal for 80 joints; 240 nonaccumulating length-composition frames with zero unused rest reads; live policy/axis/rename/reparent/replacement edits and stable per-callback snapshots.`);
} finally {await server.close();}
