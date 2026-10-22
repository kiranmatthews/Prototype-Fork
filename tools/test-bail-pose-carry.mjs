import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
const server = await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
  const { BailPoseCarry, BAIL_POSE_CARRY_SECONDS } = await server.ssrLoadModule('/src/character/bailPoseCarry.ts');
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const { ELASTIC_LENGTH_CONTROLS } = await server.ssrLoadModule('/src/animation/elasticity.ts');
  let cases = 0, maxVelocityError = 0;
  for (const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,1),new THREE.Vector3(.4,.3,-.6).normalize()])
    for (const speed of [-6, 0, 8]) {
      const carry = new BailPoseCarry(), nodes = Array.from({length:14},()=>new THREE.Object3D());
      const values = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,1]));
      const bridge = {deformationValue:id=>values[id],modulateDeformations:f=>{for(const id in f) values[id]*=f[id];}};
      const world = new THREE.Matrix4(), rootQ = new THREE.Quaternion(), waist = new THREE.Vector3(), spin = new THREE.Vector3(), drift = new THREE.Vector3();
      assert.equal(carry.begin(spin,drift),false);
      const pose = t => {
        for (let i=0;i<nodes.length;i++) nodes[i].quaternion.setFromAxisAngle(axis,.3+speed*t);
        for (const [id] of ELASTIC_LENGTH_CONTROLS) values[id]=1+.3*t;
        rootQ.setFromAxisAngle(axis,.7+speed*t);world.compose(new THREE.Vector3(),rootQ,new THREE.Vector3(1.18,1.36,1.18));
        waist.set(t*1.5,t*.4,-t*.8);
      };
      pose(0);carry.record(nodes,world,waist,bridge,1/60);
      pose(1/60);carry.record(nodes,world,waist,bridge,1/60);
      assert.equal(carry.begin(spin,drift),true);
      assert.ok(spin.distanceTo(axis.clone().multiplyScalar(speed))<1e-10);
      assert.ok(drift.distanceTo(new THREE.Vector3(1.5,.4,-.8))<1e-10);
      const outgoing=nodes[0].quaternion.clone(),target=new THREE.Quaternion().setFromAxisAngle(axis,-.5);
      for (const n of nodes) n.quaternion.copy(target);
      for (const [id] of ELASTIC_LENGTH_CONTROLS) values[id]=.9;
      carry.apply(nodes,bridge,0);
      assert.ok(nodes[0].quaternion.angleTo(outgoing)<1e-7,'zero-time release changed the outgoing pose');
      assert.ok(Math.abs(values['deform.torso.length']-1.005)<1e-12,'outgoing segment stretch was lost');
      carry.restore();for(const n of nodes) assert.ok(n.quaternion.angleTo(target)<1e-7,'carry was not reversible');
      const h=1e-6;
      carry.apply(nodes,bridge,h);
      const change=nodes[0].quaternion.clone().multiply(outgoing.clone().invert());
      const velocity=new THREE.Vector3(change.x,change.y,change.z).multiplyScalar(2/h);
      maxVelocityError=Math.max(maxVelocityError,velocity.distanceTo(axis.clone().multiplyScalar(speed)));
      assert.ok(velocity.distanceTo(axis.clone().multiplyScalar(speed))<.001,'release cancelled outgoing joint velocity');
      // A newly installed hand/rig must never receive a stale pose from the
      // outgoing object. Final expiry leaves the live target fully in charge.
      carry.restore();nodes[4]=new THREE.Object3D();nodes[4].quaternion.copy(target);
      carry.apply(nodes,bridge,.05);assert.ok(nodes[4].quaternion.angleTo(target)<1e-7);
      carry.restore();for(const n of nodes)n.quaternion.copy(target);
      carry.apply(nodes,bridge,BAIL_POSE_CARRY_SECONDS);
      assert.equal(carry.active,false);for(const n of nodes)assert.ok(n.quaternion.angleTo(target)<1e-7);
      carry.reset();assert.equal(carry.begin(spin,drift),false);
      assert.ok(carry.tracked.every(n=>n===null)&&carry.carriedNodes.every(n=>n===null),'reset retained an old rig');
      carry.record(nodes,world,waist,bridge,1/60);
      const wrist=nodes[4];nodes[4]=null;carry.record(nodes,world,waist,bridge,1/60);
      nodes[4]=wrist;wrist.quaternion.setFromAxisAngle(axis,1.2);
      carry.record(nodes,world,waist,bridge,1/60);carry.begin(spin,drift);
      assert.deepEqual([...carry.carriedRate.slice(12,15)],[0,0,0],'a returning joint inherited stale velocity');
      cases++;
    }
  const motion=new BailMotion(),spin=new THREE.Vector3(2,1,-3),travel=new THREE.Vector3(1,2,3);
  motion.begin('side',spin,37);motion.step(1/60,new THREE.Quaternion(),spin,false,0,0,1,travel);
  const before={angles:[...motion.angles],velocity:[...motion.velocity],strain:[...motion.strain],seed:motion.seed};
  motion.resume(spin.set(3,0,-1),travel.set(2,4,1));
  assert.deepEqual({angles:[...motion.angles],velocity:[...motion.velocity],strain:[...motion.strain],seed:motion.seed},before,'resume invented a fresh kick/random pose');
  assert.deepEqual(motion.previousSpin,spin);assert.deepEqual(motion.previousTravel,travel);
  console.log(JSON.stringify({passed:true,cases,maxVelocityError,finiteReleaseSeconds:BAIL_POSE_CARRY_SECONDS,keepsSegmentStretch:true,resumeAddsNoImpulse:true}));
} finally { await server.close(); }
