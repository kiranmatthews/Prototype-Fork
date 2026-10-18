import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const observe=process.argv.includes('--observe');
await withSkateRuntime(async ({THREE,server,scene,player:p,level,step,TUNING,Player,Level})=>{
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
  // Native catches and Lipslide-to-Boardslide inputs exercise the shoulder
  // blend at the +/-pi look boundary. Half the cases exit directly from the
  // cross grind; the others switch to a normal grind before the ollie.
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const transitionLevel=new Level(new THREE.Scene(),{id:'cross-grind-look',name:'Cross-grind look',data:{v:1,name:'Cross-grind look',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const transitionRail=new Rail([new THREE.Vector3(0,.8,100),new THREE.Vector3(0,.8,-100)],false);
  transitionLevel.grindRails.push(transitionRail);transitionLevel.rails.push(transitionRail);
  let transitionFrames=0,transitionCases=0,minimumGaze=1,maximumHeadTurn=0,maximumShoulderTurn=0,maximumFootError=0;
  for(const style of ['board','lip'])for(const direction of [-1,1])for(const stance of [-1,1])for(const deckYaw of [0,Math.PI]){
    const label=`${style}/${direction}/${stance}/${deckYaw}`;
    p.respawn(transitionLevel,true,true,{position:new THREE.Vector3(),heading:new THREE.Vector3(0,0,-direction)});runtime.restart();
    p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;p.deckYawOffset=deckYaw;
    p.state='ride';p.grounded=true;p.speed=12;p.balanceBoostT=60;p.camDir.set(0,0,-1);
    for(let f=0;f<90;f++)p.syncVisual(makeInput(),1/60);
    p.pos.set(style==='lip'?.12:-.12,1.05,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-1;p.grindVel=12;p.regrindCd=0;
    p.axisF.set(.3,0,-direction).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.visualYaw=Math.atan2(p.axisF.x,p.axisF.z)-Math.PI;
    let landed=false,landedFrames=0,lastHead=p.headM.quaternion.clone(),lastShoulder=p.upperG.quaternion.clone();
    for(let f=0;f<360;f++){
      const input=makeInput({grindHeld:f<201});
      if(f===0||f===90){input.grindPressed=true;input.moveX=1;}
      if(f===150&&style==='lip')input.grindPressed=true;
      input.jumpHeld=f>=200&&f<212;input.jumpPressed=f===200;input.jumpReleased=f===212;
      // Commit a side hop before release; a neutral hop would land on the
      // same solid bar and correctly trigger the rail-impact bail.
      if(f===211||f===212)input.moveX=1;
      p.step(1/60,input,transitionLevel);transitionLevel.update(1/60);p.group.updateMatrixWorld(true);transitionFrames++;
      assert.equal(p.isBailing,false,`${label}: transition bailed at ${f}`);
      if(f===0)assert.equal(p.grindStyle,style,`${label}: wrong native catch`);
      if(f===90)assert.equal(p.grindStyle,'board',`${label}: Lipslide-to-Boardslide switch failed`);
      if(f===150)assert.equal(p.grindStyle,style==='lip'?'normal':'board',`${label}: final grind style changed`);
      if(f===212)assert.equal(p.state,'air',`${label}: jump release did not exit`);
      const headTurn=THREE.MathUtils.radToDeg(p.headM.quaternion.angleTo(lastHead));
      const shoulderTurn=THREE.MathUtils.radToDeg(p.upperG.quaternion.angleTo(lastShoulder));
      maximumHeadTurn=Math.max(maximumHeadTurn,headTurn);maximumShoulderTurn=Math.max(maximumShoulderTurn,shoulderTurn);
      assert.ok(headTurn<30,`${label}: head flipped at ${f}: ${headTurn}`);
      assert.ok(shoulderTurn<20,`${label}: shoulder snapped at ${f}: ${shoulderTurn}`);
      lastHead.copy(p.headM.quaternion);lastShoulder.copy(p.upperG.quaternion);
      maximumFootError=Math.max(maximumFootError,p.boardG.userData.skateContact?.footError??0);
      if(f>=60&&f<90||f>=120&&f<150){
        const gaze=new THREE.Vector3(0,0,1).transformDirection(p.riderG.getObjectByName('socket-look').matrixWorld).setY(0).normalize();
        const travel=transitionRail.tangentAt(p.grindT).multiplyScalar(p.grindDir).setY(0).normalize();
        minimumGaze=Math.min(minimumGaze,gaze.dot(travel));
        assert.ok(gaze.dot(travel)>.95,`${label}: held gaze missed travel at ${f}: ${gaze.dot(travel)}`);
        assert.ok(Math.abs(p.headYawPose)<=1.45+1e-6,`${label}: neck overtwisted`);
      }
      if(f>212&&p.grounded){landed=true;if(++landedFrames>=60)break;}
    }
    assert.ok(landed&&landedFrames===60,`${label}: did not land and settle`);
    assert.ok(p.grindCrossPose<1e-6,`${label}: cross-grind presentation leaked after landing`);
    transitionCases++;
  }
  assert.ok(maximumFootError<.006,`cross-grind transition lost sole contact: ${maximumFootError}`);
  runtime.dispose();transitionLevel.dispose();
  console.log(`PASS ${transitionCases} native entry/switch/exit/landing cases, ${transitionFrames} frames: gaze dot >= ${minimumGaze.toFixed(5)}, head <= ${maximumHeadTurn.toFixed(2)}°/step, shoulders <= ${maximumShoulderTurn.toFixed(2)}°/step, sole error <= ${(maximumFootError*1000).toFixed(3)} mm.`);
  if(observe)console.log(JSON.stringify(results,null,2));
  else console.log(`PASS ${results.length} straight/curved, mirrored cross-grind cases with overlay and render restoration: peak turn ${Math.max(...results.map(r=>r.maximum)).toFixed(3)}°/step, render divergence ${Math.max(...results.map(r=>r.divergence)).toFixed(5)}°.`);
  // The authored skating knee bounce now moves the whole head by up to 32 mm.
  // Keep the independent angular-flip and render-feedback gates unchanged.
  if(!observe)for(const r of results){assert.ok(r.maximum<(r.shape==='straight'?.1:2),`settled grind head oscillates: ${JSON.stringify(r)}`);assert.ok(r.verticalRange<(r.shape==='straight'?.05:.08),'head exceeded the bounded skate bounce');assert.ok(r.divergence<.01,'render restoration changed procedural head motion');}
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
  // This recording predates the absolute park controls. Replayer supplies
  // current defaults for absent keys, so its exact grind-frame count changes
  // with the movement model. Keep it exercising a substantial grind sequence.
  assert.ok(grindFrames>=50,'replay did not exercise its grinding sequence');assert.ok(peak<30,`replay still flips the head: ${peak} degrees`);
  // Authored head tracks remain the final authority; removing one returns to
  // the independent procedural state rather than feeding the edit into it.
  const authored=new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,1.8,-.2));
  const remove=rider.setAuthoredPoseOverlay(({rig})=>rig.jointsById.get('head').node.quaternion.copy(authored));
  rider.step(1/60,makeInput(),level);assert.ok(rider.headM.quaternion.angleTo(authored)<1e-6);remove();
  rider.respawn(level,true);assert.equal(rider.headPitchPose,0);assert.equal(rider.headYawPose,0);
  console.log(`PASS supplied replay: ${grindFrames} grind frames, maximum ${peak.toFixed(2)}° head turn including trick transitions; no repeated flips. Authored head override and reset remain valid.`);
});
