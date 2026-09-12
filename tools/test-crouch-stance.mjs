import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

// Reuse the real player's established headless DOM/asset stubs.
const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
const originalWarn = console.warn, originalError = console.error;
const expectedAssetLog = (value) => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const animation = await server.ssrLoadModule('/src/animation/index.ts');
  const raw = await server.ssrLoadModule('/src/animation/unityCrouchCrawlAnimations.generated.ts');
  const player = new Player(new THREE.Scene());
  const binding = animation.RigBinding.fromSculptRuntime(player.animationRig.root);
  const suite = animation.createPlayerStarterAnimationSuite(binding.definition);
  const crouch = suite.clips.find(clip => clip.id === 'player.crouch');
  player.enterAnimationPreview();
  const local = id => player.animationRig.root.worldToLocal(
    binding.getJoint(id).getWorldPosition(new THREE.Vector3()),
  );
  for (const mode of ['raw', 'luna', 'fixed']) {
    const clip = structuredClone(crouch);
    for (const track of clip.tracks) {
      if (track.kind !== 'quaternion' || mode === 'fixed') continue;
      track.keys = raw.UNITY_CROUCH_IDLE_ROTATION_KEYS[track.target].map(([time, value], i) => {
        const q = new THREE.Quaternion().fromArray(value);
        const side = track.target.endsWith('Left') ? 1 : -1;
        if (mode === 'luna' && /^(hip|knee)(Left|Right)$/.test(track.target)) {
          q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), side * (track.target.startsWith('hip') ? .28 : .12)));
        }
        return { id: 'key'+i, time, value: q.normalize().toArray(), interpolation: 'linear' };
      });
    }
    let kneeGap = Infinity, ankleGap = Infinity, ankleY = Infinity, kneeSide = Infinity;
    for (let frame=0; frame<=700; frame++) {
      player.resetAnimationPreview();
      binding.applyPose(animation.sampleComposedClip(clip,frame/120), {resetUnspecified:true,strict:false});
      player.applyAnimationDeformations({}); player.syncCharacterAppearance();
      player.animationRig.root.updateMatrixWorld(true);
      const kl=local('kneeLeft'),kr=local('kneeRight'),al=local('ankleLeft'),ar=local('ankleRight');
      kneeGap=Math.min(kneeGap,kl.x-kr.x);ankleGap=Math.min(ankleGap,al.x-ar.x);ankleY=Math.min(ankleY,al.y,ar.y);
      kneeSide=Math.min(kneeSide,kl.x-local('hipLeft').x,local('hipRight').x-kr.x);
    }
    console.log(mode, {kneeGap,ankleGap,ankleY,kneeSide});
    if (mode === 'raw') assert.ok(kneeGap < -.15, 'source fixture must reproduce crossed knees');
    if (mode === 'luna') assert.ok(kneeGap < .01, 'previous guess must reproduce nearly touching knee centres');
    if (mode === 'fixed') {
      assert.ok(kneeGap > .35 && ankleGap > .38, 'real styled rig needs clear leg separation throughout the loop');
      assert.ok(kneeSide > .06, 'knees must stay outward of their own hip');
      assert.ok(ankleY > .22, 'stance correction changed the low-pose floor clearance');
    }
  }

  const oldCrouch=structuredClone(crouch);
  oldCrouch.metadata.starterCatalogVersion=21;
  delete oldCrouch.metadata.crouchStanceRevision;
  for(const track of oldCrouch.tracks)if(track.kind==='quaternion'){
    track.keys=raw.UNITY_CROUCH_IDLE_ROTATION_KEYS[track.target].map(([time,value],index)=>({
      id:`${track.id}:key-${index}`,time,value:[...value],interpolation:'linear',
    }));
  }
  // Only the hip keys may change. Keep source hinges, ankles, torso motion,
  // contacts, clock and exact loop closure.
  for(const track of crouch.tracks){
    if(!/^hip(Left|Right)$/.test(track.target))assert.deepEqual(track,oldCrouch.tracks.find(t=>t.id===track.id));
    assert.deepEqual(track.keys[0].value,track.keys.at(-1).value);
  }
  const oldSuite={...structuredClone(suite),metadata:{...suite.metadata,playerStarterCatalogVersion:21},
    clips:suite.clips.map(c=>c.id===oldCrouch.id?oldCrouch:c)};
  for(const version of [15,16,17,18,19,20,21,22])for(const normalized of [false,true]){
    const saved=structuredClone(oldSuite);saved.metadata.playerStarterCatalogVersion=version;
    const old=saved.clips.find(c=>c.id===oldCrouch.id);old.metadata.starterCatalogVersion=version;old.playbackSpeed=.73;
    const input=normalized?animation.parseAnimationSuite(JSON.stringify(saved)):saved;
    const migrated=animation.reconcilePlayerStarterAnimationSuite(input,binding.definition);
    const updated=migrated.clips.find(c=>c.id===old.id);
    assert.equal(updated.metadata.crouchStanceRevision,1,`saved v${version} normalized=${normalized} failed upgrade`);
    assert.equal(updated.playbackSpeed,.73,'saved speed lost');
    assert.deepEqual(animation.reconcilePlayerStarterAnimationSuite(migrated,binding.definition),migrated,'upgrade not idempotent');
  }
  const edited=structuredClone(oldSuite);edited.clips.find(c=>c.id===oldCrouch.id).tracks[0].keys[0].value[1]+=.01;
  assert.deepEqual(animation.reconcilePlayerStarterAnimationSuite(edited,binding.definition).clips,edited.clips,'authored edits overwritten');
  const rotated=structuredClone(oldSuite);
  rotated.clips.find(c=>c.id===oldCrouch.id).tracks.find(t=>t.target==='hipLeft').keys[0].value[0]+=.001;
  assert.deepEqual(animation.reconcilePlayerStarterAnimationSuite(rotated,binding.definition).clips,rotated.clips,'edited hip rotation overwritten');
  const deleted={...oldSuite,clips:oldSuite.clips.filter(c=>c.id!==oldCrouch.id)};
  assert.ok(!animation.reconcilePlayerStarterAnimationSuite(deleted,binding.definition).clips.some(c=>c.id===oldCrouch.id),'deleted crouch restored');
  player.exitAnimationPreview();
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const level=new Level(new THREE.Scene(),{id:'crouch-stance-test',name:'Crouch stance',data:{
    v:1,name:'Crouch stance',spawn:[0,.02,0],killY:-20,components:[
      {t:'platform',p:[0,-.5,0],s:[50,1,50]},{t:'gate',p:[0,0,-20]},
    ],
  }});
  const live=new Player(level.scene);live.enterLevel('crouch-stance-test');live.respawn(level,true);
  const liveBinding=animation.RigBinding.fromSculptRuntime(live.animationRig.root);
  const runtime=createCharacterAnimationRuntime(live,animation.createPlayerStarterAnimationSuite(liveBinding.definition));
  const input={moveX:0,moveY:0,grabHeld:false,consumeEdges(){}};
  const tick=()=>{live.step(1/60,input,level);level.update(1/60);};
  const liveLocal=id=>live.animationRig.root.worldToLocal(liveBinding.getJoint(id).getWorldPosition(new THREE.Vector3()));
  for(const heading of [0,Math.PI/4,Math.PI/2,Math.PI]){
    live.respawn(level,true,true,{position:new THREE.Vector3(0,.02,0),heading:new THREE.Vector3(Math.sin(heading),0,-Math.cos(heading))});
    input.grabHeld=false;input.moveX=0;for(let f=0;f<12;f++)tick();
    input.grabHeld=true;
    for(let f=0;f<370;f++){
      tick();assert.equal(runtime.activeClipId,'player.crouch');
      if(f<12)continue;
      live.animationRig.root.updateMatrixWorld(true);
      assert.ok(liveLocal('kneeLeft').x-liveLocal('kneeRight').x>.35,'gameplay overlay crossed the knees');
      assert.ok(liveLocal('ankleLeft').x-liveLocal('ankleRight').x>.38,'gameplay overlay crossed the feet');
    }
    input.moveX=1;for(let f=0;f<12;f++)tick();assert.equal(runtime.activeClipId,'player.crawl');
    input.moveX=0;for(let f=0;f<12;f++)tick();assert.equal(runtime.activeClipId,'player.crouch');
    live.animationRig.root.updateMatrixWorld(true);
    assert.ok(liveLocal('kneeLeft').x-liveLocal('kneeRight').x>.35,'crawl-to-crouch returned crossed');
  }
  runtime.dispose();level.dispose();
  console.log('PASS crouch stance: 2,103 preview samples, four complete gameplay loops, crawl transitions, source preservation and saved upgrades');
} finally {
  await server.close(); console.warn=originalWarn;console.error=originalError;
}
