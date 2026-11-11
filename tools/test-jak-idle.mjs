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
  const idle=base.clips.find(c=>c.id==='player.idle'),standing=suite.clips.find(c=>c.id==='player.idle');
  // D stands in its own idle: the source idle's timeline and its swing about
  // each joint's average, in the skate study's stand. A/B/C keep the source.
  assert.deepEqual(idle,a.createPlayerStarterAnimationSuite(binding.definition).clips.find(c=>c.id==='player.idle'),
    'building D changed the A/B/C idle');
  assert.ok(standing.metadata.jakIdle&&standing.metadata.ownsIdleArms&&standing.metadata.stanceSource==='BR_DISMOUNT_LO_INTO_STAND_0',
    'D does not stand in its own idle');
  assert.deepEqual([standing.duration,standing.playbackSpeed,standing.range,standing.loop,standing.proceduralDrivers],
    [idle.duration,idle.playbackSpeed,idle.range,idle.loop,idle.proceduralDrivers],'D\'s idle lost the source idle\'s tempo or breath');
  const turns=clip=>new Map(clip.tracks.filter(t=>t.kind==='quaternion').map(t=>[t.target,t.keys]));
  const mean=keys=>{const first=new THREE.Quaternion().fromArray(keys[0].value),sum=new THREE.Vector4(0,0,0,0);
    for(const key of keys){const q=new THREE.Quaternion().fromArray(key.value);if(q.dot(first)<0)q.set(-q.x,-q.y,-q.z,-q.w);sum.add(new THREE.Vector4(q.x,q.y,q.z,q.w));}
    return new THREE.Quaternion(sum.x,sum.y,sum.z,sum.w).normalize();};
  let maxSwingError=0,maxStanceTurn=0;const sourceTurns=turns(idle);
  for(const [target,keys] of turns(standing)){
    const from=sourceTurns.get(target);
    assert.deepEqual(keys.map(k=>k.time),from.map(k=>k.time),`${target}: D's idle is keyed off the source idle's beat`);
    if(/^(hip|knee|ankle|toe)(Left|Right)$/.test(target))continue; // the legs are solved under the pelvis, not swung
    const about=mean(keys),aboutFrom=mean(from);
    maxStanceTurn=Math.max(maxStanceTurn,about.angleTo(aboutFrom));
    for(let i=0;i<keys.length;i++){
      // (Stored keys are rounded; an angle between quaternions wants them whole.)
      const swing=new THREE.Quaternion().fromArray(keys[i].value).multiply(about.clone().invert()).normalize();
      const swingFrom=new THREE.Quaternion().fromArray(from[i].value).multiply(aboutFrom.clone().invert()).normalize();
      maxSwingError=Math.max(maxSwingError,swing.angleTo(swingFrom));
    }
  }
  assert.ok(maxSwingError<1e-5,`D's idle does not swing as the source idle does: ${maxSwingError} radians`);
  assert.ok(maxStanceTurn>.2,`D's idle still stands as the source idle does: ${maxStanceTurn} radians`);
  const runtime=createCharacterAnimationRuntime(p,suite),cases=[];
  const ids=['hips','spine','head','shoulderLeft','shoulderRight','elbowLeft','elbowRight','wristLeft','wristRight',
    'hipLeft','hipRight','kneeLeft','kneeRight','ankleLeft','ankleRight'];
  let nativeIdle;const stances={};
  for(const kind of ['native-idle','idle','run-stop','walk-stop','tap-land','flip-land','double-land','climb-idle']) {
    p.enterLevel('jak-idle');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy=kind==='native-idle'?null:{...JAK_DIRECT_PHYSICS,flip:kind!=='tap-land'};
    runtime.setDocument(kind==='native-idle'?base:suite);runtime.restart();
    if(kind==='climb-idle') {
      p.pos.set(20,2.35,-1.1);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;
      p.walkVelocity.set(0,0,-4);p.lastVelZ=-4;p.rawInput=makeInput({moveY:1});
      assert.ok(p.tryLedgeGrab(level.walls.find(w=>Math.abs(w.max.y-3.35)<.01),level));
    }
    const rows=[];let second=-1,maxNativePoseError=0,maxNativePointError=0,idleFrames=0,idleFor=0;
    for(let f=0;f<480;f++) {
      const moving=kind==='run-stop'||kind==='walk-stop';
      const jumping=kind.endsWith('land'),hold=kind==='tap-land'?3:kind==='flip-land'?18:35;
      const input={moveY:kind==='flip-land'&&f<=50+hold?1:moving&&f>=30&&f<150?(kind==='walk-stop'?.3:1):0,
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
      // The palms, which hang off the wrists wherever the wrists turn them.
      for(const [id,glove] of [['palmLeft',p.gloveLeft],['palmRight',p.gloveRight]])
        joints[id]={p:glove.gripSocket.getWorldPosition(new THREE.Vector3()).toArray()};
      const row={f,clip:runtime.activeClipId,time:d.timelineTime,blend:d.transitionBlendWeight,
        rest:p.characterUpperArmRestAngleWeight,recovery:d.idleRecoveryWeight,joints};
      // A cut into the idle is carried, not faded, and each part lets go at
      // its own rate: it is the idle's own clip once the slowest has.
      idleFor=row.clip==='player.idle'?idleFor+1:0;
      if(row.clip==='player.idle'&&row.blend===null&&f>200&&idleFor>90) {
        idleFrames++;
        // The source idle uses the editable neutral-arm layer; D's stance carries its own shoulders.
        assert.equal(row.rest,kind==='native-idle'?1:0,'the resting arm layer is not the idle\'s own');
        const expected=a.sampleComposedClip(kind==='native-idle'?idle:standing,row.time,d.motionContext);
        for(const [id,joint] of Object.entries(expected.joints))if(joint.quaternion) {
          maxNativePoseError=Math.max(maxNativePoseError,new THREE.Quaternion().fromArray(joint.quaternion)
            .angleTo(new THREE.Quaternion().fromArray(runtime.lastSampledPose.joints[id].quaternion)));
        }
        if(kind==='idle'||kind==='native-idle')(stances[kind]??=[]).push(joints);
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
    if(kind==='flip-land')assert.ok(rows.some(r=>r.clip==='player.jak-flip')&&rows.some(r=>r.clip==='player.jak-flip-land'),
      'running jump fixture must retain the roll and its stationary recovery');
    if(!measure) {
      assert.ok(maxNativePoseError<1e-6,`${kind}: the settled idle is not its own clip by ${maxNativePoseError} radians`);
      assert.ok(maxHandoffAngle<.08,`${kind}: idle handoff snapped ${maxHandoffAngle} radians`);
      assert.ok(maxHandoffPoint<.04,`${kind}: idle handoff jumped ${maxHandoffPoint} metres`);
    }
    if(kind==='native-idle')nativeIdle=rows;
    cases.push({kind,idleFrames,maxNativePoseError,maxNativePointError,maxHandoffAngle,maxHandoffPoint,handoffs,
      samples:rows.filter(r=>handoffs.some(h=>Math.abs(r.f-h.f)<=3))});
  }
  // The stance as it is drawn: narrower, level and hanging, with the same bob, on soles that stay put.
  const stanceOf=frames=>{
    const range=(id,axis)=>{const values=frames.map(j=>j[id].p[axis]);return [Math.min(...values),Math.max(...values)];};
    const at=(id,axis)=>frames.reduce((sum,j)=>sum+j[id].p[axis],0)/frames.length,span=r=>r[1]-r[0];
    const flex=frames.map(j=>Math.min(...['Left','Right'].map(side=>{
      const hip=new THREE.Vector3().fromArray(j[`hip${side}`].p),knee=new THREE.Vector3().fromArray(j[`knee${side}`].p),ankle=new THREE.Vector3().fromArray(j[`ankle${side}`].p);
      return knee.clone().sub(hip).angleTo(ankle.sub(knee));})));
    return {width:Math.abs(at('ankleLeft',0)-at('ankleRight',0)),stagger:Math.abs(at('ankleLeft',2)-at('ankleRight',2)),
      hands:Math.abs(at('wristLeft',0)-at('wristRight',0)),hips:at('hips',1),bob:span(range('hips',1)),
      palms:['palmLeft','palmRight'].map(id=>Math.abs(at(id,0)-at('hips',0))),
      drift:Math.max(...['ankleLeft','ankleRight'].flatMap(id=>[0,2].map(axis=>span(range(id,axis))))),
      straightestKnee:THREE.MathUtils.radToDeg(Math.min(...flex))};
  };
  const stance={source:stanceOf(stances['native-idle']),d:stanceOf(stances.idle)};
  if(!measure) {
    assert.ok(stance.d.width<stance.source.width-.06&&stance.d.width>.25,`D's feet are not closer under him: ${stance.d.width} m apart (source ${stance.source.width})`);
    assert.ok(stance.d.stagger<.1&&stance.source.stagger>.3,`D's feet are not level with each other: ${stance.d.stagger} m (source ${stance.source.stagger})`);
    assert.ok(stance.d.hands<stance.source.hands-.2,`D's arms do not hang: hands ${stance.d.hands} m apart (source ${stance.source.hands})`);
    // Each hand at his side, not across the front of his thigh.
    assert.ok(Math.min(...stance.d.palms)>.43&&Math.abs(stance.d.palms[0]-stance.d.palms[1])<.05,
      `a hand hangs in across him: palms ${stance.d.palms.map(x=>x.toFixed(3))} m from his middle`);
    assert.ok(stance.d.hips>stance.source.hips+.01,`D does not stand taller: hips ${stance.d.hips} (source ${stance.source.hips})`);
    assert.ok(Math.abs(stance.d.bob-stance.source.bob)<.003,`D's idle lost the source bob: ${stance.d.bob} m (source ${stance.source.bob})`);
    assert.ok(stance.d.drift<.004,`D's soles drift over the floor: ${stance.d.drift} m`);
    assert.ok(stance.d.straightestKnee>8,`a knee locks straight at the top of the bob: ${stance.d.straightestKnee} degrees`);
  }
  runtime.dispose();console.log(JSON.stringify({stance,maxSwingError,maxStanceTurn,cases},null,2));
},{levelEntry:{id:'jak-idle',name:'Idle continuity',data:{v:1,name:'Idle continuity',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},
    {t:'platform',p:[20,1.8,-4],s:[8,3.6,5]},{t:'gate',p:[0,0,-200]}]}}});
