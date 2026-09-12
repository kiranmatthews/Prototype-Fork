import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const observe=process.argv.includes('--observe');
await withSkateRuntime(async ({THREE,server,scene,player:p,level,step,TUNING,Player})=>{
  const defaults={...TUNING};
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const rail=new Rail([new THREE.Vector3(0,7,25),new THREE.Vector3(0,7,-115)]);
  level.rails.push(rail);level.grindRails.push(rail);level.root.add(rail.object);scene.updateMatrixWorld(true);
  const arcs=[-1,1].map(bend=>new Rail(Array.from({length:37},(_,i)=>{const a=i/36*Math.PI;return new THREE.Vector3(bend*35*Math.cos(a),8,-35-35*Math.sin(a));})));
  for(const arc of arcs){level.rails.push(arc);level.grindRails.push(arc);level.root.add(arc.object);}scene.updateMatrixWorld(true);
  TUNING.balanceDrift=0;TUNING.balanceNoise=0;
  const results=[],reference=new Map();
  for(const [shape,activeRail] of [['straight',rail],['left',arcs[0]],['right',arcs[1]]])for(const overlay of [false,true])for(const rendering of [false,true])for(const side of [-1,1]){
    const position=activeRail.pointAt(2).add(new THREE.Vector3(0,.25,0)),heading=activeRail.tangentAt(2);
    p.playerAnimationBridge.setOverlay(overlay?()=>{}:null);
    p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
    p.speed=8;p.vVel=0;p.freeSkate=p.airFromSkate=true;p.state='air';p.grounded=false;
    step(makeInput({grindHeld:true,grindPressed:true,moveX:side}));assert.equal(p.state,'grind');
    p.grindStyle='board';p.grindCrossDir=side;p.balance=.4;p.balanceVel=0;p.commitRenderStep(level);
    const q=new THREE.Quaternion(),last=new THREE.Quaternion(),center=new THREE.Vector3();
    let maximum=0,minY=Infinity,maxY=-Infinity,spikes=[],poses=[];
    for(let i=0;i<240;i++){
      if(rendering){p.applyRenderInterpolation(.5);p.restoreRenderPose();}
      const before=p.headM.rotation.toArray();
      step(makeInput({grindHeld:true}));p.commitRenderStep(level);p.group.updateMatrixWorld(true);
      q.copy(p.headM.quaternion);p.headVisualCenter.getWorldPosition(center);
      if(i>60){
        const tangent=p.grindRail.tangentAt(p.grindT).multiplyScalar(p.grindDir);
        assert.ok(-Math.sin(p.visualYaw)*tangent.x-Math.cos(p.visualYaw)*tangent.z>.98,`body kept the catch heading: ${JSON.stringify({shape,side,overlay,rendering,frame:i,yaw:p.visualYaw,dir:p.grindDir,t:p.grindT,tangent:tangent.toArray(),rail:level.grindRails.indexOf(p.grindRail),expected:level.grindRails.indexOf(activeRail)})}`);
        assert.ok(Math.abs(p.headYawPose)<1.8,'head overtwists to compensate for stale grind facing');
        poses.push(q.clone());const delta=THREE.MathUtils.radToDeg(q.angleTo(last));maximum=Math.max(maximum,delta);
        minY=Math.min(minY,center.y-p.pos.y);maxY=Math.max(maxY,center.y-p.pos.y);
        if(delta>15&&spikes.length<3)spikes.push({frame:i,delta,before,after:p.headM.rotation.toArray()});
      }
      last.copy(q);
      assert.equal(p.state,'grind');
    }
    const key=shape+':'+side;
    if(!overlay&&!rendering)reference.set(key,poses);
    const divergence=Math.max(...poses.map((q,i)=>THREE.MathUtils.radToDeg(q.angleTo(reference.get(key)[i]))));
    results.push({shape,overlay,rendering,side,maximum,verticalRange:maxY-minY,divergence,spikes});
  }
  p.playerAnimationBridge.setOverlay(null);
  if(observe)console.log(JSON.stringify(results,null,2));
  else console.log(`PASS ${results.length} straight/curved, mirrored cross-grind cases with overlay and render restoration: peak turn ${Math.max(...results.map(r=>r.maximum)).toFixed(3)}°/step, render divergence ${Math.max(...results.map(r=>r.divergence)).toFixed(5)}°.`);
  if(!observe)for(const r of results){assert.ok(r.maximum<(r.shape==='straight'?.1:2),`settled grind head oscillates: ${JSON.stringify(r)}`);assert.ok(r.verticalRange<(r.shape==='straight'?.005:.05),'settled head bobs vertically');assert.ok(r.divergence<.01,'render restoration changed procedural head motion');}
  for(const r of [rail,...arcs]){level.rails.splice(level.rails.indexOf(r),1);level.grindRails.splice(level.grindRails.indexOf(r),1);r.object.removeFromParent();}
  Object.assign(TUNING,defaults);
  const replayData=JSON.parse(await readFile(new URL('./fixtures/grind-head-user-replay.json',import.meta.url),'utf8'));
  const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
  const rider=new Player(scene);rider.competitionMode=true;rider.endlessDeaths=replayData.endlessDeaths;rider.setAuthoredPoseOverlay(()=>{});rider.respawn(level,true);
  const replay=new Replayer();replay.begin(replayData);const input=makeInput();let previous=null,peak=0,grindFrames=0;
  for(let frame=0;frame<replayData.frames;frame++){
    rider.restoreRenderPose();replay.feed(input,rider.camDir);rider.step(1/60,input,level);level.update(1/60);input.consumeEdges();rider.commitRenderStep(level);
    if(rider.state==='grind'){
      const q=rider.headM.quaternion.clone();if(previous)peak=Math.max(peak,THREE.MathUtils.radToDeg(q.angleTo(previous)));previous=q;grindFrames++;
    }else previous=null;
    rider.applyRenderInterpolation(.5);
  }
  replay.end();rider.restoreRenderPose();
  assert.ok(grindFrames>100,'replay did not exercise its grinding sequence');assert.ok(peak<30,`replay still flips the head: ${peak} degrees`);
  // Authored head tracks remain the final authority; removing one returns to
  // the independent procedural state rather than feeding the edit into it.
  const authored=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,1.8,-.2));
  const remove=rider.setAuthoredPoseOverlay(({rig})=>rig.jointsById.get('head').node.quaternion.copy(authored));
  rider.step(1/60,makeInput(),level);assert.ok(rider.headM.quaternion.angleTo(authored)<1e-6);remove();
  rider.respawn(level,true);assert.equal(rider.headPitchPose,0);assert.equal(rider.headYawPose,0);
  console.log(`PASS supplied replay: ${grindFrames} grind frames, maximum ${peak.toFixed(2)}° head turn including trick transitions; no repeated flips. Authored head override and reset remain valid.`);
});
