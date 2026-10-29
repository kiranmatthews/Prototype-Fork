import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {CARLISLE_TIDAL_RELAY_LEVEL:data,CARLISLE_RELAY_JUMPS:jumps,carlislePoint}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
await withSkateRuntime(async({server,player:p,level,THREE,CONST,TUNING})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {LAUNCH_CLIPS,launchRiseProgress}=await server.ssrLoadModule('/src/animation/launchJump.ts');
  const {LaunchCamera,LAUNCH_CAMERA}=await server.ssrLoadModule('/src/launchCamera.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const rig=a.RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const suite=a.createPlayerStarterAnimationSuite(rig),motion=a.createProceduralMotionContext();
  for(const id of Object.values(LAUNCH_CLIPS)){
    const clip=suite.clips.find(c=>c.id===id);assert.ok(clip,id);
    const poses=Array.from({length:65},(_,i)=>a.sampleComposedClip(clip,clip.duration*i/64,motion));
    assert.ok(!clip.tracks.some(t=>t.kind==='scale'),'whole-bone scaling');
    for(const pose of poses){
      for(const joint of Object.values(pose.joints))for(const values of Object.values(joint))
        if(Array.isArray(values))assert.ok(values.every(Number.isFinite),`${id}: nonfinite joint`);
      assert.ok(Object.values(pose.scalars).every(v=>v>.7&&v<1.3),`${id}: unsafe segment stretch`);
      if(pose.joints.root?.position)assert.ok(Math.hypot(...pose.joints.root.position)<.9,'duplicated world movement');
    }
    if(id.includes('board')){
      assert.ok(!clip.tracks.some(t=>/^(root|hips|hipLeft|hipRight|knee|ankle|toe)/.test(t.target)),`${id}: deck-owned joint`);
      assert.ok(!clip.tracks.some(t=>t.target.startsWith('deform.leg.')));
    }
    if(id.endsWith('float')){
      for(const joint of Object.keys(poses[0].joints)){
        const start=new THREE.Quaternion(...poses[0].joints[joint].quaternion),end=new THREE.Quaternion(...poses.at(-1).joints[joint].quaternion);
        assert.ok(start.angleTo(end)<1e-6,`${id}: ${joint} loop seam`);
      }
      for(const joint of ['shoulderLeft','elbowRight','wristLeft','head']){
        const q=new THREE.Quaternion(...poses[0].joints[joint].quaternion);
        assert.ok(poses.some(pose=>q.angleTo(new THREE.Quaternion(...pose.joints[joint].quaternion))>.08),`${id}: static ${joint}`);
      }
    }
  }
  for(const apex of [.8,2,4]){
    let last=-1;
    for(let t=0;t<=apex+.2;t+=1/120){const phase=launchRiseProgress(t,50*(1-t/apex),50);assert.ok(phase>=last&&phase<=1);last=phase;}
    assert.equal(last,1);
  }
  // Camera is a reversible overlay with a fixed lens; compare the same arc at
  // multiple render rates and assert both apex lag and finite release.
  const trajectories=[];
  for(const hz of [30,60,120]){
    const shot=new LaunchCamera(),camera=new THREE.PerspectiveCamera(49,16/9,.1,2000),subject=new THREE.Vector3();
    let maxLag=0;
    for(let i=0;i<hz*5;i++){
      const t=i/hz,flight=t<4;subject.set(t*3,flight?40*t-10*t*t:0,0);
      shot.restore(camera);camera.position.copy(subject).add(new THREE.Vector3(0,8,12));camera.lookAt(subject);
      const base=camera.position.clone(),q=camera.quaternion.clone();
      shot.apply(camera,subject,flight?{id:1,strength:1,elapsed:t,rise:Math.min(1,t/1.8),gather:t>3.62?(t-3.62)/.38:0,verticalSpeed:40-20*t,board:false}:null,1/hz,i===0,0);
      assert.equal(camera.fov,49);assert.ok(camera.position.toArray().every(Number.isFinite));
      if(t>2&&flight)maxLag=Math.max(maxLag,shot.diagnostics.height-subject.y-LAUNCH_CAMERA.height);
      if(Math.abs(t-3)<.001)trajectories.push(camera.position.clone());
      shot.restore(camera);assert.ok(camera.position.distanceTo(base)<1e-8);assert.ok(camera.quaternion.angleTo(q)<1e-7);
    }
    assert.ok(maxLag>3&&maxLag<=LAUNCH_CAMERA.maxExtraHeight+.001);assert.equal(shot.diagnostics.weight,0);
    shot.apply(camera,subject,null,1/hz,true);assert.equal(shot.diagnostics.weight,0);
  }
  assert.ok(trajectories[0].distanceTo(trajectories[2])<.35,'render-rate-dependent camera');
  const orbit=new LaunchCamera(),orbitCamera=new THREE.PerspectiveCamera(49),orbitSubject=new THREE.Vector3();
  orbitCamera.position.set(0,8,12);
  const orbitLaunch={id:1,strength:1,elapsed:1,rise:.7,gather:0,verticalSpeed:20,board:false};
  orbit.apply(orbitCamera,orbitSubject,orbitLaunch,1/60,false,.1);
  assert.equal(orbit.diagnostics.yaw,0,'stick deadzone moved launch view');
  orbit.restore(orbitCamera);orbit.apply(orbitCamera,orbitSubject,orbitLaunch,1/60,false,1);
  assert.ok(orbit.diagnostics.yaw<0,'horizontal stick did not orbit');
  const runtime=createCharacterAnimationRuntime(p,suite);p.competitionMode=false;p.endlessDeaths=true;
  const reports=[];
  for(const [index,board] of (process.env.BOARD_ONLY?[[0,true]]:[[0,false],[16,false],[39,false],[0,true]])){
    const jump=jumps[index],c=data.components.find(c=>c.nm===jump.name&&(c.t==='trampoline'||c.t==='mover'));
    const mover=jump.moving?level.movers.find(m=>m.mesh.name===jump.name):null;
    const start=mover?mover.mesh.position.clone().add(new THREE.Vector3(0,c.s[1]/2+.15,0)):new THREE.Vector3(...c.p).add(new THREE.Vector3(0,.15,0));
    p.respawn(level,true,false,{position:start,heading:new THREE.Vector3(0,0,-1)});p.freeSkate=board;p.airFromSkate=board;p.airGrav=board?'board':'foot';p.speed=board?8:0;
    const seen=new Set();let launched=false,landed=false,frames=0;
    for(;frames<800;frames++){
      const target=new THREE.Vector3(...carlislePoint(...jump.to)),dx=target.x-p.pos.x,dz=target.z-p.pos.z;
      const f=dx*p.axisF.x+dz*p.axisF.z,s=dx*p.axisL.x+dz*p.axisL.z;
      const brake=board?p.speed*Math.abs(p.speed)/(2*Math.max(TUNING.airControl,12*(p.launchPresentation?.strength??0))*CONST.airBrakeFactor):0;
      const input=makeInput({moveY:launched&&(Math.abs(f)>1.5||Math.abs(brake)>.5)?Math.sign(f-brake):0,moveX:launched&&Math.abs(s)>2?Math.sign(s):0,jumpHeld:!launched});
      p.rawInput=input;const before=p.vVel;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);
      const pos=p.pos.clone(),vel=p.vVel;p.commitRenderStep(level);
      assert.ok(p.pos.distanceTo(pos)<1e-10&&p.vVel===vel,'presentation changed ballistic movement');
      assert.deepEqual(p.riderG.scale.toArray(),[1,1,1],'whole skeleton scaled');
      seen.add(p.animationClipHint);
      if(p.launchPresentation){
        if(!launched){
          p.state='dead';assert.equal(p.launchPresentation,null,'death kept active launch');p.state='air';
        }
        launched=true;
      }
      if(launched&&frames>20&&(p.grounded||before<0&&p.vVel>15)){landed=true;break;}
      if(p.state==='dead')break;
    }
    assert.ok(launched&&landed,`${jump.name}: missed native landing; ${p.state}; ${p.pos.toArray()}; speed ${p.speed}; ${[...seen]}`);
    console.log(JSON.stringify({pad:jump.name,board,frames,clips:[...seen]}));
    assert.ok(seen.has(board?LAUNCH_CLIPS.boardRise:LAUNCH_CLIPS.rise),`${jump.name} board=${board}: ${[...seen]}`);
    assert.ok(seen.has(board?LAUNCH_CLIPS.boardFloat:LAUNCH_CLIPS.float),`${jump.name} board=${board}: ${[...seen]}`);
    assert.ok(seen.has(board?LAUNCH_CLIPS.boardGather:LAUNCH_CLIPS.gather),'missing landing preparation');
    if(index===39){
      assert.equal(runtime.activeClipId,'player.land','ground contact did not start recovery');
      for(let i=0;i<120;i++){p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);p.commitRenderStep(level);}
      assert.equal(runtime.activeClipId,'player.idle','landing did not settle');
    }
    reports.push({pad:jump.name,board,frames,clips:[...seen]});
  }
  p.respawn(level,true);assert.equal(p.launchPresentation,null,'respawn kept launch');
  runtime.dispose();console.log(JSON.stringify({camera:'30/60/120 Hz; fixed FOV; reversible; bounded descent lag',flights:reports},null,2));
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
