import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';
import { LIMB_CHILDREN } from './import-unity-rope-animations.mjs';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel:'silent', server:{middlewareMode:true} });
const warn = console.warn, error = console.error;
const expected = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!expected(args[0])) warn(...args); };
console.error = (...args) => { if (!expected(args[0])) error(...args); };
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const p = new Player(new THREE.Scene());
  const binding = a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const fixtures = JSON.parse(await readFile(new URL('./fixtures/rope-source-directions.json', import.meta.url), 'utf8'));
  const local = id => binding.root.worldToLocal(binding.getJoint(id).getWorldPosition(new THREE.Vector3()));
  let maxError = 0;
  p.enterAnimationPreview();
  for (const sample of fixtures.fixtures) {
    p.resetAnimationPreview();p.clearCharacterAppearance();
    const clip = suite.clips.find(c => c.id === sample.clip);
    // Source parity is measured without character proportion scaling or live
    // rope IK. It must not be possible for IK to hide another crossed mapping.
    binding.applyPose(a.sampleClip(clip,sample.time),{resetUnspecified:true,strict:false});
    binding.root.updateMatrixWorld(true);
    for (const [joint, direction] of Object.entries(sample.directions)) {
      const actual = local(LIMB_CHILDREN[joint]).sub(local(joint)).normalize();
      const degrees = actual.angleTo(new THREE.Vector3(...direction)) * 180 / Math.PI;
      maxError = Math.max(maxError,degrees);
      assert.ok(degrees < 2.5,`${sample.clip}@${sample.time} ${joint}: ${degrees.toFixed(3)}° from source`);
    }
  }
  p.exitAnimationPreview();

  // Old saved source clips get the repair, exact recovery copies and saved
  // playback speed; unrelated clips and already-upgraded edits stay intact.
  const old = structuredClone(suite);old.metadata.playerStarterCatalogVersion=27;
  for(const clip of old.clips.filter(c=>c.id.startsWith('player.rope'))){
    delete clip.metadata.ropeMappingRevision;clip.playbackSpeed=.73;
    clip.tracks[0].keys[0].value=[0,0,0,1];
  }
  const migrated=a.reconcilePlayerStarterAnimationSuite(old,binding.definition);
  for(const clip of old.clips){
    const current=migrated.clips.find(c=>c.id===clip.id);
    if(!clip.id.startsWith('player.rope')){assert.deepEqual(current,clip);continue;}
    assert.equal(current.metadata.ropeMappingRevision,1);
    assert.equal(current.playbackSpeed,.73);
    assert.deepEqual(migrated.clips.find(c=>c.id===`${clip.id}.pre-limb-mapping`).tracks,clip.tracks);
    assert.deepEqual(current.tracks,suite.clips.find(c=>c.id===clip.id).tracks);
  }
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(migrated,binding.definition),migrated);

  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {drawnRopePoint}=await server.ssrLoadModule('/src/ropeGeometry.ts');
  const scene=new THREE.Scene();
  const ropeLevel=(amp,len=6,anchor=6)=>new Level(scene,{id:'rope-limbs',name:'Rope limbs',data:{v:1,name:'Rope limbs',
    spawn:[0,2,0],killY:-80,components:[{t:'ropeswing',p:[0,anchor,0],len,amp,speed:0,phase:0,yaw:90},
      {t:'gate',p:[0,-30,0]}]}});
  const level=ropeLevel(0);
  const live=new Player(scene),liveBinding=a.RigBinding.fromSculptRuntime(live.animationRig.root);
  const runtime=createCharacterAnimationRuntime(live,a.createPlayerStarterAnimationSuite(liveBinding.definition));
  const input={moveX:0,moveY:0,jumpHeld:false,consumeEdges(){}};
  const joint=id=>liveBinding.getJoint(id).getWorldPosition(new THREE.Vector3());
  const catchRope=(on,heading,at=2)=>{
    live.pos.set(0,at,0);live.prevPos.copy(live.pos);live.state='air';live.grounded=false;
    live.ropeCoolT=0;live.lastVelX=Math.sin(heading)*12;live.lastVelZ=-Math.cos(heading)*12;
    live.speed=12;live.vVel=-2;on.update(0);live.syncVisual(input,0);
    assert.equal(live.tryRopeGrab(on),true);
  };
  const frame=(on,dt=1/60)=>{on.update(dt);live.stepRope(dt,input,on);live.syncVisual(input,dt);return live.ropeAnimationDiagnostics;};
  const elbowsApart=()=>{
    const rig=live.animationRig.root;
    const left=rig.worldToLocal(joint('elbowLeft')),right=rig.worldToLocal(joint('elbowRight'));
    assert.ok(left.x>right.x,'live contact solver crossed the elbows');
  };
  let maximumGripError=0,liveFrames=0,holds=0;
  for(const heading of [0,Math.PI/2,Math.PI]){
    // A catch comes in from the flight: the arms reach for the rope and the hands are on it within a fifth of a
    // second, and stay on it from then on.
    catchRope(level,heading);input.moveY=0;
    for(let n=0;n<12;n++)frame(level);
    for(const direction of [0,1,-1,0]){
      input.moveY=direction;
      const before=live.ropeAnimationDiagnostics.handHolds,from=live.ropeD;
      for(let n=0;n<110;n++){
        const d=frame(level);liveFrames++;
        maximumGripError=Math.max(maximumGripError,d.leftGripError,d.rightGripError);
        // Match the established rope contact tolerance across the hang, the whole climb and the way back down,
        // reaching hands included: a hand is where it is meant to be at every moment of its reach.
        assert.ok(d.leftGripError<.02&&d.rightGripError<.02,
          `grip drift heading=${heading} direction=${direction}@${n}: ${d.leftGripError}, ${d.rightGripError}`);
        elbowsApart();
      }
      const taken=live.ropeAnimationDiagnostics.handHolds-before,travelled=Math.abs(live.ropeD-from);
      // The hands walk the rope: a new hold for about every half metre of it, and none while holding still (bar
      // the one a hand was already reaching for when the climb stopped).
      if(direction===0)assert.ok(taken<=1,`the hands took ${taken} new holds on the rope while holding still`);
      else assert.ok(taken>=Math.floor(travelled/.6)&&taken<=Math.ceil(travelled/.35)+1,
        `the hands took ${taken} holds over ${travelled.toFixed(2)} m of rope`);
      holds+=taken;
    }
  }
  runtime.dispose();level.dispose();

  // The rope stays in front of the body all the way through a swing, with the legs round it or hanging free: it
  // never comes nearer the spine, the hips or the head than its own thickness and theirs.
  const swing=ropeLevel(.85,7,9),rope=swing.ropeSwings[0],point=new THREE.Vector3();
  const clear=id=>{
    const at=id==='hips'?joint('hipLeft').add(joint('hipRight')).multiplyScalar(.5):joint(id);let nearest=Infinity;
    for(let d=0;d<=rope.len;d+=.05)nearest=Math.min(nearest,drawnRopePoint(rope,d,point).distanceTo(at));
    return nearest;
  };
  let nearestRope=Infinity,swingFrames=0;
  for(const grip of [4.6,6.9]){
    swing.time=0;catchRope(swing,0,9-grip-1);live.ropeD=grip;input.moveY=0;
    for(let n=0;n<40;n++)frame(swing);
    for(let n=0;n<320;n++){
      frame(swing);swingFrames++;
      for(const id of ['hips','spine','chest','neck','head']){
        const gap=clear(id);nearestRope=Math.min(nearestRope,gap);
        assert.ok(gap>.2,`the rope is ${gap.toFixed(3)} m from the ${id} at swing angle ${rope.theta.toFixed(2)}, grip ${grip}`);
      }
    }
    // A leap forward goes straight through where the rope is drawn. The rope gives way round the body, and
    // comes back to its own line once the body has gone; where the rope can be caught never moves at all.
    let pushed=0;const caught=swing.ropePointAt(rope,3,new THREE.Vector3()).clone();
    live.chargeTimer=0;live.ropeLeap(swing,rope);
    for(let n=0;n<26;n++){
      swing.update(1/60);live.pos.z-=9/60;live.pos.y+=4/60;live.syncVisual(input,1/60);
      pushed=Math.max(pushed,live.ropeAnimationDiagnostics.ropeShove);
    }
    assert.ok(pushed>.3,`a leap through the rope pushed it aside by only ${pushed.toFixed(3)} m`);
    live.state='ride';live.grounded=true;
    for(let n=0;n<240;n++){swing.update(1/60);live.syncVisual(input,1/60);}
    assert.ok(live.ropeAnimationDiagnostics.ropeShove<1e-6,'the rope did not come back to its own line after the leap');
    assert.ok(!rope.shove||rope.shove.lengthSq()===0,'the drawn rope was left pushed aside');
    assert.ok(Number.isFinite(caught.x));
  }
  swing.dispose();

  // The live contact adaptation opts into affine aiming; scale/shear must not
  // leave a permanent error even when source arm rotations are far from rest.
  const {solveTwoBoneIk}=await server.ssrLoadModule('/src/animation/ik.ts');
  const parent=new THREE.Group(),root=new THREE.Bone(),mid=new THREE.Bone(),end=new THREE.Bone();
  parent.scale.set(1.5,.85,1.2);parent.rotation.set(.2,.45,.3);
  parent.add(root);root.add(mid);mid.add(end);mid.position.y=-.5;end.position.y=-.65;
  root.rotation.set(-1.2,.3,1.4);mid.rotation.set(-.8,.3,.2);
  parent.updateMatrixWorld(true);
  const target=parent.localToWorld(new THREE.Vector3(.25,.6,.35));
  for(let i=0;i<6;i++)solveTwoBoneIk({root,mid,end,target,pole:new THREE.Vector3(1,0,1),accountForParentScale:true});
  assert.ok(end.getWorldPosition(new THREE.Vector3()).distanceTo(target)<.005,'scaled-parent grip cannot converge');
  console.log(`PASS rope limb mapping: 128 source directions (max ${maxError.toFixed(3)}°), ${liveFrames.toLocaleString('en-GB')} live hang/climb/descend frames (grip ${maximumGripError.toFixed(6)}, ${holds} holds walked), ${swingFrames} swing frames (rope never nearer the body's line than ${nearestRope.toFixed(2)} m), rope gives way to a leap and returns, saved upgrades, scaled-parent grip`);
} finally { await server.close();console.warn=warn;console.error=error; }
