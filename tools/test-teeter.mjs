import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, THREE, Level, Player, TUNING }) => {
  const { sampleTeeterMotion, probeTeeterEdge } = await server.ssrLoadModule('/src/teeterMotion.ts');
  const { TUNING_RANGES, TUNING_SECTIONS } = await server.ssrLoadModule('/src/tuning.ts');
  assert.ok(TUNING_SECTIONS.some(s => s.keys.includes('teeterEdgeDistance')));
  assert.ok(TUNING_RANGES.teeterEdgeDistance.min > 0);
  // Oblique lips resolve their actual outward normal, not the nearest ray.
  for (const angle of [.13, .37, 1.1, 2.6, 4.9]) {
    const nx=Math.cos(angle), nz=Math.sin(angle);
    const edge=probeTeeterEdge(.35,(x,z)=>x*nx+z*nz<=.22);
    assert.ok(edge && (edge.x*nx+edge.z*nz)/Math.hypot(edge.x,edge.z)>.9999);
  }
  const saved = { ...TUNING };
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'teeter-test', name: 'Teeter test', data: {
    v: 1, name: 'Teeter test', spawn: [0, .02, 0], killY: -20,
    components: [{t:'platform',p:[0,-.5,0],s:[10,1,10]},
      {t:'platform',p:[0,-3.5,0],s:[30,1,30]},
      {t:'platform',p:[30,-.5,0],s:[10,1,10],yaw:45},
      {t:'gate',p:[0,0,-3]}],
  }});
  scene.updateMatrixWorld(true);
  const p = new Player(scene);
  p.enterLevel('teeter-test'); p.respawn(level, true);
  const place = (x, z, distance) => {
    p.respawn(level, true); p.pos.set(x, 0, z); p.prevPos.copy(p.pos);
    p.grounded = true; p.state = 'ride'; p.freeSkate = false;
    p.speed = 0; p.walkVelocity.set(0,0,0); TUNING.teeterEdgeDistance = distance;
    p.step(1/60, makeInput(), level);
    return p.teetering;
  };
  try {
    assert.equal(place(4.6,0,.2), false, 'small threshold fired too early');
    assert.equal(place(4.6,0,.6), true, 'larger threshold did not warn earlier');
    for (const [x,z] of [[4.8,0],[-4.8,0],[0,4.8],[0,-4.8],[4.8,4.8]]) {
      assert.equal(place(x,z,.35), true, `missed edge ${x},${z}`);
      assert.ok(p.teeterDirection.x*x+p.teeterDirection.z*z > 0,'counterbalance points away from detected lip');
    }
    const diagonal = 4.72 / Math.sqrt(2);
    assert.equal(place(30+diagonal,-diagonal,.2),false,'diagonal trigger fired early');
    assert.equal(place(30+diagonal,-diagonal,.35),true,'diagonal probe missed rotated lip');
    // Real authored overlay must not erase the new pose, move physics or soles.
    const a = await server.ssrLoadModule('/src/animation/index.ts');
    const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
    const rig = a.RigBinding.fromSculptRuntime(p.animationRig.root);
    const runtime = createCharacterAnimationRuntime(p, a.createPlayerStarterAnimationSuite(rig.definition));
    place(4.8,0,.35);
    const start = p.pos.clone();

    for (let frame=0; frame<120; frame++) {
      p.step(1/60,makeInput(),level);
      assert.ok(p.pos.distanceTo(start)<1e-8,'animation moved physical support');
      assert.ok(Math.abs(p.spineG.rotation.z)<.5,'spine accumulated rotation');
      if(frame>45){
        const toeL=p.group.getObjectByName('socket-toe-left').getWorldPosition(new THREE.Vector3());
        const toeR=p.group.getObjectByName('socket-toe-right').getWorldPosition(new THREE.Vector3());
        const delta=toeL.clone().sub(toeR);
        assert.ok(Math.abs(delta.dot(p.teeterDirection))<.008,'one foot leads the other');
        assert.ok(Math.abs(delta.y)<.008,'toe heights disagree');
        for(const side of ['left','right']){
          const toe=p.group.getObjectByName('socket-toe-'+side).getWorldPosition(new THREE.Vector3());
          const heel=p.group.getObjectByName('socket-heel-'+side).getWorldPosition(new THREE.Vector3());
          assert.ok(heel.y-toe.y>.16,'heel is not raised onto tiptoe');
        }
        assert.ok(p.headLookSocket.getWorldDirection(new THREE.Vector3()).y<-.4,'gaze is not down over the edge');
        for(const {sole} of p.proceduralFootwear){
          sole.updateWorldMatrix(true,false);
          const points=sole.geometry.getAttribute('position');let low=Infinity;
          for(let i=0;i<points.count;i++)low=Math.min(low,new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld).y);
          assert.ok(Math.abs(low-p.pos.y-.006)<.008,'toe sole floats or penetrates support');
        }

      }


    }
    assert.ok(Math.abs(p.armL.rotation.x-p.armR.rotation.x)>.05,'arms still flap in sync');
    const facingDot = () => -Math.sin(p.bodyGroup.rotation.y)*p.teeterDirection.x -
      Math.cos(p.bodyGroup.rotation.y)*p.teeterDirection.z;
    assert.ok(facingDot()>.999,'side approach did not turn the chest toward the edge');
    place(30+diagonal,-diagonal,.35);
    for(let f=0;f<60;f++)p.step(1/60,makeInput(),level);
    assert.ok(facingDot()>.999,'rotated edge did not own facing');
    p.freeSkate=true;p.sidePose=1;p.stance=1;
    for(let f=0;f<60;f++)p.syncVisual(makeInput(),1/60);
    assert.ok(facingDot()>.999,'skate stance turned the chest away from the edge');
    p.bodyGroup.rotation.x=.18;
    const deckPosition=p.boardG.getWorldPosition(new THREE.Vector3());
    const deckRotation=p.boardG.getWorldQuaternion(new THREE.Quaternion());
    p.plantTeeterToes(1);
    assert.ok(p.boardG.getWorldPosition(new THREE.Vector3()).distanceTo(deckPosition)<1e-8,'toe planting moved the deck');
    assert.ok(p.boardG.getWorldQuaternion(new THREE.Quaternion()).angleTo(deckRotation)<1e-7,'toe planting tilted the deck');

    p.freeSkate=false;
    // Recovery has an exact finite endpoint and resets the next catch clock.
    p.pos.set(0,0,0); p.prevPos.copy(p.pos);
    for(let frame=0;frame<20;frame++)p.step(1/60,makeInput(),level);
    assert.equal(p.teeterPose,0); assert.equal(p.teeterPhase,0);
    place(4.8,0,.35); p.chargedJump(1/60);p.step(1/60,makeInput(),level);
    assert.equal(p.state,'air');assert.equal(p.teeterPose,0,'jump retained teeter');
    runtime.dispose();
    const neutral=sampleTeeterMotion(1,0,1,1);
    assert.ok(neutral.chestPitch === 0);
    for(const v of Object.values(neutral.deformations))assert.equal(v,1);
    for(let i=0;i<300;i++){
      const m=sampleTeeterMotion(i/60,1,1,0);
      for(const [key,value] of Object.entries(m.deformations)){
        assert.ok(!key.includes('.leg.'),'teeter deformed planted legs');
        assert.ok(Number.isFinite(value)&&value>.85&&value<1.15,'unsafe segment scale');
      }
    }
    console.log('PASS teeter threshold, cardinal/corner direction, authored pose, stationary support, paired toe contacts/raised heels/downward gaze, finite recovery, jump cancellation and bounded segment elasticity');
  } finally { Object.assign(TUNING,saved); level.dispose(); }
});
