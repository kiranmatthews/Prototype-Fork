import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const source=process.argv[2]??process.env.JAK_REFERENCE_MOTION_FILE;
if(!source)throw new Error('Pass the local motion.json exported by extract-jak-motion.mjs');
const bank=JSON.parse(await readFile(source,'utf8'));
await withSkateRuntime(async({server,player:p,level,THREE,TUNING})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=createJakDirectSuite(a.createPlayerStarterAnimationSuite(binding.definition),binding.definition,bank);
  const skeletonRoot=new THREE.Group(), nodes=new Map();
  for(const joint of binding.definition.joints) {
    const node=new THREE.Group();node.name=joint.nodeName;node.position.fromArray(joint.rest.position);
    node.quaternion.fromArray(joint.rest.quaternion);node.scale.fromArray(joint.rest.scale);
    (joint.parentId?nodes.get(joint.parentId):skeletonRoot).add(node);nodes.set(joint.id,node);
  }
  const isolated=a.RigBinding.fromDefinition(skeletonRoot,{...binding.definition,sockets:[]});
  const segments=[['shoulderLeft','elbowLeft','Larm','Lforarm'],['elbowLeft','wristLeft','Lforarm','sk_lhand'],
    ['shoulderRight','elbowRight','Rarm','Rforarm'],['elbowRight','wristRight','Rforarm','sk_rhand'],
    ['hipLeft','kneeLeft','Lthigh','Lknee'],['kneeLeft','ankleLeft','Lknee','Lankle'],
    ['hipRight','kneeRight','Rthigh','Rknee'],['kneeRight','ankleRight','Rknee','Rankle']];
  let maxDirectionError=0,samples=0;
  for(const clip of suite.clips.filter(c=>c.metadata?.jakDirect)) {
    const ref=bank.clips[clip.metadata.jakSourceClip];
    const sourceFrames=clip.id==='player.jak-short-land'?[...ref.samples.slice(0,ref.frames),...bank.clips['jump-land'].samples.slice(50)]
      :clip.id==='player.jak-soft-land'?ref.samples.slice(50):ref.samples;
    for(let frame=0;frame<sourceFrames.length;frame++) {
      const pose=a.sampleComposedClip(clip,Math.min(clip.duration,frame/60*Number(clip.metadata.jakSourceTimeScale??1)),a.createProceduralMotionContext());
      isolated.applyPose(pose);isolated.root.updateMatrixWorld(true);
      for(const [j,c,s,t] of segments) {
        // Ledge catches already use a slowed source clock and a deliberate
        // rebound-to-hang tail, rather than raw source frames throughout.
        if(clip.metadata.jakLedgeSettle&&frame/(sourceFrames.length-1)>.62)continue;
        // The airborne finish deliberately opens earlier than the source's
        // ground-roll exit. Completion/continuity are checked by the live
        // UI-tuning and rubber-motion regressions; retain exact source checks
        // for the unadapted gathering and tuck.
        if(clip.id==='player.jak-flip'&&frame>Math.round((sourceFrames.length-1)*.60))continue;
        const got=isolated.joints.get(c).getWorldPosition(new THREE.Vector3()).sub(isolated.joints.get(j).getWorldPosition(new THREE.Vector3())).normalize();
        const want=new THREE.Vector3().fromArray(sourceFrames[frame][t].p).sub(new THREE.Vector3().fromArray(sourceFrames[frame][s].p)).normalize();
        if(clip.id==='player.jak-flip') {
          // D completes the source's final 23 degrees before contact. The
          // articulated limbs must still follow the source under that turn.
          const sourceHip=new THREE.Quaternion().fromArray(sourceFrames[frame].hips.q)
            .multiply(new THREE.Quaternion().fromArray(bank.bind.hips.q).invert());
          want.applyQuaternion(isolated.joints.get('hips').getWorldQuaternion(new THREE.Quaternion()).multiply(sourceHip.invert()));
        }
        maxDirectionError=Math.max(maxDirectionError,got.angleTo(want));
      }
      assert.ok(Object.values(pose.scalars).every(Number.isFinite));samples++;
    }
  }
  assert.ok(maxDirectionError<.001,`retarget bone directions changed ${maxDirectionError}`);
  const runtime=createCharacterAnimationRuntime(p,suite), results=[];
  let minimumSole=Infinity, maximumPlantedSole=-Infinity, liveApexDirectionError=0,minimumSoleFrame;
  for(const [name,hold,move,second] of [['tap',1,0,false],['full',35,0,false],['double',35,0,true],['running recovery',18,1,false]]) {
    p.enterLevel('jak-direct');p.respawn(level,true);p.freeSkate=false;p.onFootJumpStudy=JAK_DIRECT_PHYSICS;runtime.restart();
    let peak=0,air=-1,land=-1,secondFrame=-1,secondY=0,secondPeak=0,maxSpeed=0;const clips=new Set();
    for(let frame=0;frame<800;frame++) {
      const input=makeInput({moveY:move&&frame<170?move:0,jumpPressed:frame===40,jumpHeld:frame>=40&&frame<40+hold,jumpReleased:frame===40+hold});
      if(second&&air>=0&&secondFrame<0&&!p.grounded&&p.vVel<2){secondFrame=frame;input.jumpPressed=input.jumpHeld=true;}
      if(frame===secondFrame+1&&secondFrame>=0){input.jumpReleased=true;secondY=p.pos.y;}
      p.step(1/60,input,level);level.update(1/60);clips.add(runtime.activeClipId);
      if(!p.grounded&&air<0)air=frame;if(air>=0&&p.grounded&&land<0)land=frame;
      peak=Math.max(peak,p.pos.y);if(secondFrame>=0&&frame>secondFrame)secondPeak=Math.max(secondPeak,p.pos.y-secondY);
      maxSpeed=Math.max(maxSpeed,p.walkVelocity.length());
      if(name==='full'&&!p.grounded&&p.footStudyFrame===20) {
        p.group.updateWorldMatrix(true,true);
        // D now has deliberate joint follow-through. Verify that the rendered
        // hierarchy matches that composed pose, without a second legacy layer.
        isolated.applyPose(runtime.lastSampledPose);isolated.root.updateMatrixWorld(true);
        for(const [j,c,s,t] of segments) {
          const point=id=>p.riderG.worldToLocal(binding.joints.get(id).getWorldPosition(new THREE.Vector3()));
          const got=point(c).sub(point(j)).normalize();
          const want=isolated.joints.get(c).getWorldPosition(new THREE.Vector3())
            .sub(isolated.joints.get(j).getWorldPosition(new THREE.Vector3())).normalize();
          liveApexDirectionError=Math.max(liveApexDirectionError,got.angleTo(want));
        }
      }
      if(p.grounded&&!p.charging) {
        p.group.updateWorldMatrix(true,true);let planted=Infinity;
        for(const {sole} of p.proceduralFootwear) {
          const vertices=sole.geometry.getAttribute('position');
          for(let i=0;i<vertices.count;i++)planted=Math.min(planted,new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(sole.matrixWorld).y);
        }
        if(planted<minimumSole){minimumSole=planted;minimumSoleFrame={name,frame,clip:runtime.activeClipId,time:runtime.diagnostics.timelineTime,footSpeed:p.walkVelocity.length(),root:p.pos.y};}
        maximumPlantedSole=Math.max(maximumPlantedSole,planted);
      }
      assert.equal(p.freeSkate,false,'on-foot D accidentally mounted a board');
      assert.ok(p.pos.toArray().every(Number.isFinite));
    }
    assert.equal(air,40+hold,'D must retain release-to-jump');assert.ok(land>air);
    assert.equal(runtime.activeClipId,'player.idle','recovery/pacing failed to finish');
    const height=velocity=>{let y=0,max=0;while(velocity>0){velocity-=TUNING.riseGravity/60;y+=velocity/60;max=Math.max(max,y);}return max;};
    if(name==='full')assert.ok(Math.abs(peak-height(TUNING.jumpVelocity))<.03);
    if(name==='tap')assert.ok(Math.abs(peak-height(THREE.MathUtils.lerp(TUNING.jumpMinVelocity,TUNING.jumpVelocity,1/24)))<.03);
    if(second){assert.ok(clips.has('player.double-jump'));assert.ok(Math.abs(secondPeak-height(TUNING.doubleJumpVelocity))<.04);}
    if(move){assert.ok(clips.has('player.jak-run-land'));assert.ok(clips.has('player.run-stop'));}
    results.push({name,peak,airtime:(land-air)/60,secondPeak,maxSpeed,clips:[...clips]});
  }
  // Keep the user's established hold-to-skate gesture in D, then hand the
  // mounted controller to the separately tested original board path.
  p.enterLevel('jak-direct');p.respawn(level,true);p.freeSkate=false;p.onFootJumpStudy=JAK_DIRECT_PHYSICS;runtime.restart();
  let mounted=false,boardAir=false;
  for(let frame=0;frame<220;frame++) {
    p.step(1/60,makeInput({moveY:1,jumpPressed:frame===35,jumpHeld:frame>=35&&frame<125,jumpReleased:frame===125}),level);
    level.update(1/60);mounted ||= p.freeSkate;boardAir ||= p.airFromSkate&&!p.grounded;
    if(p.freeSkate)assert.equal(runtime.activeClipId,null,'direct pose overrode skating');
  }
  assert.ok(mounted&&boardAir,'hold-to-skate and release-to-ollie must both remain available');
  assert.ok(liveApexDirectionError<.001,`a legacy layer changed the live source pose: ${liveApexDirectionError}`);
  assert.ok(minimumSole>=-.002,`direct motion penetrated the supporting floor: ${minimumSole} ${JSON.stringify(minimumSoleFrame)}`);
  runtime.dispose();
  console.log('PASS D direct source retarget, release-to-jump, double jump, recovery and pace-to-idle',JSON.stringify({samples,maxDirectionError,liveApexDirectionError,minimumSole,maximumPlantedSole,results},null,2));
},{levelEntry:{id:'jak-direct',name:'Direct Jak test',data:{v:1,name:'Direct Jak test',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}}});
