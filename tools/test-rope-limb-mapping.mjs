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
  const scene=new THREE.Scene();
  const level=new Level(scene,{id:'rope-limbs',name:'Rope limbs',data:{v:1,name:'Rope limbs',
    spawn:[0,2,0],killY:-80,components:[{t:'ropeswing',p:[0,6,0],len:6,amp:0,speed:1,phase:0},
      {t:'gate',p:[0,-30,0]}]}});
  const live=new Player(scene),liveBinding=a.RigBinding.fromSculptRuntime(live.animationRig.root);
  const runtime=createCharacterAnimationRuntime(live,a.createPlayerStarterAnimationSuite(liveBinding.definition));
  const input={moveX:0,moveY:0,jumpHeld:false,consumeEdges(){}};
  let maximumGripError=0;
  for(const heading of [0,Math.PI/2,Math.PI]){
    live.pos.set(0,2,0);live.prevPos.copy(live.pos);live.state='air';live.grounded=false;
    live.ropeCoolT=0;live.lastVelX=Math.sin(heading)*12;live.lastVelZ=-Math.cos(heading)*12;
    live.speed=12;live.vVel=-2;level.update(0);live.syncVisual(input,0);
    assert.equal(live.tryRopeGrab(level),true);
    for(const direction of [0,1,-1]){
      input.moveY=direction;
      for(let frame=0;frame<180;frame++){
        live.ropeD=3;live.stepRope(1/60,input,level);live.syncVisual(input,1/60);
        const d=live.ropeAnimationDiagnostics;
        maximumGripError=Math.max(maximumGripError,d.leftGripError,d.rightGripError);
        // Match the established rope contact tolerance across the full loops,
        // including momentarily fully extended poses, not just the catch frame.
        assert.ok(d.leftGripError<.02&&d.rightGripError<.02,
          `grip drift heading=${heading} direction=${direction}@${frame}: ${d.leftGripError}, ${d.rightGripError}`);
        const rig=live.animationRig.root;
        const left=rig.worldToLocal(liveBinding.getJoint('elbowLeft').getWorldPosition(new THREE.Vector3()));
        const right=rig.worldToLocal(liveBinding.getJoint('elbowRight').getWorldPosition(new THREE.Vector3()));
        assert.ok(left.x>right.x,'live contact solver crossed the elbows');
      }
    }
  }
  runtime.dispose();level.dispose();

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
  console.log(`PASS rope limb mapping: 128 source directions (max ${maxError.toFixed(3)}°), 1,620 live hang/climb/descend frames (grip ${maximumGripError.toFixed(6)}), saved upgrades, scaled-parent grip`);
} finally { await server.close();console.warn=warn;console.error=error; }
