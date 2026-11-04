import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
const measure=process.argv.includes('--measure');
await withSkateRuntime(async({server,player:p,level,THREE})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const base=a.createPlayerStarterAnimationSuite(binding.definition);
  const suite=createJakDirectSuite(base,binding.definition,bank);
  const idle=base.clips.find(c=>c.id==='player.idle');
  assert.deepEqual(suite.clips.find(c=>c.id==='player.idle'),idle,'D must use the exact A/B/C idle');
  const runtime=createCharacterAnimationRuntime(p,suite),cases=[];
  const ids=['hips','spine','head','shoulderLeft','shoulderRight','elbowLeft','elbowRight','wristLeft','wristRight',
    'hipLeft','hipRight','kneeLeft','kneeRight','ankleLeft','ankleRight'];
  let nativeIdle;
  for(const kind of ['native-idle','idle','run-stop','walk-stop','tap-land','flip-land','double-land','climb-idle']) {
    p.enterLevel('jak-idle');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy=kind==='native-idle'?null:{...JAK_DIRECT_PHYSICS,flip:kind!=='tap-land'};
    runtime.setDocument(kind==='native-idle'?base:suite);runtime.restart();
    if(kind==='climb-idle') {
      p.pos.set(20,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;
      p.walkVelocity.set(0,0,-4);p.lastVelZ=-4;p.rawInput=makeInput({moveY:1});
      assert.ok(p.tryLedgeGrab(level.walls.find(w=>Math.abs(w.max.y-3.35)<.01),level));
    }
    const rows=[];let second=-1,maxNativePoseError=0,maxNativePointError=0,idleFrames=0;
    for(let f=0;f<420;f++) {
      const moving=kind==='run-stop'||kind==='walk-stop';
      const jumping=kind.endsWith('land'),hold=kind==='tap-land'?3:35;
      const input={moveY:moving&&f>=30&&f<150?(kind==='walk-stop'?.3:1):0,
        jumpPressed:jumping&&f===50,jumpHeld:jumping&&f>=50&&f<50+hold,jumpReleased:jumping&&f===50+hold};
      if(kind==='double-land'&&f>50+hold&&!p.grounded&&second<0&&p.vVel<2){second=f;input.jumpPressed=input.jumpHeld=true;}
      if(second>=0&&f===second+1)input.jumpReleased=true;
      if(kind==='climb-idle'&&f===100)input.jumpPressed=true;
      p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
      const d=runtime.diagnostics;
      // Proportions contain nonuniform scale; normalize decomposed rotations
      // before measuring angular continuity in the final rendered hierarchy.
      const joints=Object.fromEntries(ids.map(id=>[id,{p:binding.joints.get(id).getWorldPosition(new THREE.Vector3()).toArray(),
        q:binding.joints.get(id).getWorldQuaternion(new THREE.Quaternion()).normalize().toArray()}]));
      const row={f,clip:runtime.activeClipId,time:d.timelineTime,blend:d.transitionBlendWeight,
        rest:p.characterUpperArmRestAngleWeight,recovery:d.idleRecoveryWeight,joints};
      if(row.clip==='player.idle'&&row.blend===null&&f>200) {
        idleFrames++;
        assert.equal(row.rest,1,'native resting arm angle was not restored');
        const expected=a.sampleComposedClip(idle,row.time,d.motionContext);
        for(const [id,joint] of Object.entries(expected.joints))if(joint.quaternion) {
          maxNativePoseError=Math.max(maxNativePoseError,new THREE.Quaternion().fromArray(joint.quaternion)
            .angleTo(new THREE.Quaternion().fromArray(runtime.lastSampledPose.joints[id].quaternion)));
        }
        if(kind==='idle')for(const id of ids) {
          maxNativePointError=Math.max(maxNativePointError,new THREE.Vector3().fromArray(joints[id].p)
            .distanceTo(new THREE.Vector3().fromArray(nativeIdle[f].joints[id].p)));
        }
      }
      rows.push(row);
    }
    let maxHandoffAngle=0,maxHandoffPoint=0;const handoffs=[];
    for(let i=1;i<rows.length;i++)if(rows[i].clip==='player.idle'&&rows[i-1].clip!==rows[i].clip) {
      const previous=rows[i-1],current=rows[i];let angle=0,distance=0,worst='';
      for(const id of ids) {
        const before=previous.joints[id],after=current.joints[id];
        const step=new THREE.Quaternion().fromArray(before.q).angleTo(new THREE.Quaternion().fromArray(after.q));
        if(step>angle){angle=step;worst=id;}
        distance=Math.max(distance,new THREE.Vector3().fromArray(before.p).distanceTo(new THREE.Vector3().fromArray(after.p)));
      }
      maxHandoffAngle=Math.max(maxHandoffAngle,angle);maxHandoffPoint=Math.max(maxHandoffPoint,distance);
      handoffs.push({f:i,from:previous.clip,angle,distance,worst,before:previous.rest,after:current.rest});
    }
    assert.ok(idleFrames>100,`${kind}: never settled into idle`);
    if(!measure) {
      assert.ok(maxNativePoseError<1e-6,`${kind}: idle differs from native by ${maxNativePoseError} radians`);
      assert.ok(maxNativePointError<.002,`${kind}: rendered idle differs from A by ${maxNativePointError} metres`);
      assert.ok(maxHandoffAngle<.08,`${kind}: idle handoff snapped ${maxHandoffAngle} radians`);
      assert.ok(maxHandoffPoint<.04,`${kind}: idle handoff jumped ${maxHandoffPoint} metres`);
    }
    if(kind==='native-idle')nativeIdle=rows;
    cases.push({kind,idleFrames,maxNativePoseError,maxNativePointError,maxHandoffAngle,maxHandoffPoint,handoffs,
      samples:rows.filter(r=>handoffs.some(h=>Math.abs(r.f-h.f)<=3))});
  }
  runtime.dispose();console.log(JSON.stringify({cases},null,2));
},{levelEntry:{id:'jak-idle',name:'Idle continuity',data:{v:1,name:'Idle continuity',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},
    {t:'platform',p:[20,1.8,-4],s:[8,3.6,5]},{t:'gate',p:[0,0,-200]}]}}});
