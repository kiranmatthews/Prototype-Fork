import assert from 'node:assert/strict';
import * as THREE from 'three';
import {withChiefRuntime} from './crab-chief-harness.mjs';
await withChiefRuntime(async ({l}) => {
  const model=l.boss.model;
  let mesh;
  model.root.traverse(node=>{if(node.isSkinnedMesh)mesh=node;});
  assert.ok(mesh, 'the generated chief surface must be skinned');
  const position=mesh.geometry.attributes.position, weights=mesh.geometry.attributes.skinWeight;
  const indices=mesh.geometry.attributes.skinIndex, vertex=new THREE.Vector3();
  const soles=[];
  for(let i=0;i<position.count;i++) {
    let sum=0;
    for(let component=0;component<4;component++) {
      sum+=weights.getComponent(i,component);
      assert.ok(indices.getComponent(i,component)<mesh.skeleton.bones.length);
    }
    assert.ok(Math.abs(sum-1)<1e-6);
    if(position.getY(i)<.08)soles.push(i);
  }
  assert.ok(soles.length>40, 'the actual broad boot soles were not measured');
  const soleSet=new Set(soles), rest=new THREE.Vector3();
  const states=['idle','slam-tell','slam','recover','hurt','volley','sweep','phase','defeated'];
  let frames=0, minimumY=Infinity, maximumSoleDrift=0;
  for(const side of [true,false]) for(const phase of [1,3]) for(const state of states) {
    for(let frame=0;frame<=24;frame++) {
      const time=frame/4;
      model.pose({state,stateTime:time,time,phase,target:new THREE.Vector3(side?15:-15,0,-12),left:side,
        exposed:state==='recover'&&time>.7,defeated:state==='defeated'});
      assert.deepEqual(model.root.scale.toArray(),[1,1,1]);
      for(let i=0;i<position.count;i++) {
        mesh.getVertexPosition(i,vertex);
        assert.ok(vertex.toArray().every(Number.isFinite),`${state} produced a nonfinite surface`);
        minimumY=Math.min(minimumY,vertex.y);
        assert.ok(vertex.y>-.08,`${state} pushed the generated surface through the floor: ${vertex.y}`);
        if(soleSet.has(i))maximumSoleDrift=Math.max(maximumSoleDrift,vertex.distanceTo(rest.fromBufferAttribute(position,i)));
      }
      frames++;
    }
  }
  assert.ok(maximumSoleDrift<1e-5,'wide generated toes slid out of their planted contacts');
  const settled=[];
  for(const time of [3.5,6,12]) {
    model.pose({state:'defeated',stateTime:time,time,phase:3,target:new THREE.Vector3(),left:true,exposed:false,defeated:true});
    settled.push(mesh.skeleton.bones.flatMap(bone=>bone.matrixWorld.toArray()));
  }
  assert.deepEqual(settled[0],settled[1]);assert.deepEqual(settled[1],settled[2]);
  console.log(`PASS actual Meshy skin: ${frames} motion samples, ${position.count} finite vertices/sample, ${soles.length} planted sole vertices, drift ${maximumSoleDrift.toExponential(2)}m, minimum Y ${minimumY.toFixed(4)}m, normalized skin weights and whole-rig finite defeat settle.`);
});
