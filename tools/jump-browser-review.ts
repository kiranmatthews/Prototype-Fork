// A/B/C/D playtest. Live controls are the default; source drafts are never saved.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Level } from '../src/level';
import { LOCOMOTION_WALK_BLEND_INPUT, RigBinding, createPlayerStarterAnimationSuite } from '../src/animation';
import type { AnimationClip } from '../src/animation';
import {PANCAKE_SLAM} from '../src/animation/pancakeSlam';
import previousClips from './fixtures/pre-reference-jump-clips.json';
import { sfx } from '../src/audio';
import { createJakStudySuite, JAK_JUMP_PHYSICS } from './jak-jump-variant';
import { createJakDirectSuite, JAK_DIRECT_PHYSICS, type JakMotionBank } from './jak-direct-motion';
import { GreenEcoFire, type GreenEcoRendering } from '../src/greenEcoFire';
import { JUMP_ECO_VENTS } from './jump-eco-vents';
import { CONST, TUNING } from '../src/tuning';
import { ledgeBasis, ledgeEdgePoint } from '../src/ledgeTraversal';
import {PlayableSkateMotion} from '../src/skateReferenceLab/playableMotion';
import {BoardScribbleEffect} from '../src/skateReferenceLab/boardScribble';
import type {MotionData} from '../src/skateReferenceLab/retarget';
import {motionStudyAsset,loadMotionStudyBuffer,loadMotionStudyJson} from '../src/motionStudyAssets';

void sfx.loadJumpReferenceAudio(motionStudyAsset('jak-audio'));

const g: any = await new Promise(resolve => {
  const poll = () => {
    const game = (window as any).__game;
    if (game && !game.gameFlow.blocksGameplay) resolve(game); else requestAnimationFrame(poll);
  }; poll();
});
g.campaign.startEphemeral();
const p = g.player, runtime = g.characterAnimationRuntime;
const ecoFire = new GreenEcoFire(g.scene, JUMP_ECO_VENTS);
let ecoEnabled = true, ecoVisit = 0;
let ecoCpuMs = 0;
const binding = RigBinding.fromSculptRuntime(p.animationRig.root);
const suite = createPlayerStarterAnimationSuite(binding.definition);
const oldSuite = {...suite, clips: suite.clips.map(clip =>
  (previousClips.find(old => old.id === clip.id) as AnimationClip | undefined) ?? clip)};
const studySuite = createJakStudySuite(suite);
let directSuite: typeof suite | null = null;
try {
  directSuite = createJakDirectSuite(suite, binding.definition, await loadMotionStudyJson<JakMotionBank>('jak-motion'));
} catch (error) { console.warn('Jak motion unavailable', error); }
let variant: 'A' | 'B' | 'C' | 'D' = 'B';
let before = false, inspect = false, jakSounds = true, jumpFlip = true;
let replayReview=false;
let skateMotion: PlayableSkateMotion | null = null, boardInk: BoardScribbleEffect | null = null;
let skateEnabled=true, inkEnabled=true;
const inkSupport=new THREE.Plane();
try {
  {
    skateMotion=new PlayableSkateMotion(p,await loadMotionStudyJson<MotionData>('skate-motion'),{continuousTransitions:true});
    skateMotion.setActive(false);
    const texture=await new THREE.TextureLoader().loadAsync(new URL('../src/skateReferenceLab/assets/board-scribble.png',import.meta.url).href);
    boardInk=new BoardScribbleEffect(texture,p.group,skateMotion.retarget.board,skateMotion.boardScribble);
    texture.dispose();g.scene.add(boardInk.sprite);
  }
} catch(error){console.warn('Skate motion unavailable',error);}
const syncSkate=()=>{
  skateMotion?.setActive(variant==='D'&&skateEnabled);
  if(skateMotion&&skateMotion.scribbles!==(inkEnabled&&!!boardInk))skateMotion.scribbles=inkEnabled&&!!boardInk;
  if(boardInk&&!skateMotion?.active)boardInk.sprite.visible=false;
};
// Level changes, checkpoints and restart can all respawn the real player.
// Remove the old pose before that operation; rejoin from its resulting state
// on the next native step without playing a fictitious pickup or mount.
const nativeRespawn=p.respawn.bind(p);
p.respawn=(...args:any[])=>{skateMotion?.setActive(false);return nativeRespawn(...args);};
const nativePuffUpdate = g.puffs.update.bind(g.puffs);
g.puffs.update = (dt: number, camera: THREE.Camera) => {
  nativePuffUpdate(dt, camera);
  ecoFire.enabled = ecoEnabled && !inspect && g.getCurrentLevel().id === 'codex-lab';
  const start = performance.now();
  ecoFire.update(dt, camera);
  ecoCpuMs += (performance.now() - start - ecoCpuMs) * .04;
};
let reviewLevel: Level | null = null, savedCoursePosition: THREE.Vector3 | null = null;
let mode = 'Full jump', frame = 0, frozen = false, slow = false, skips = 0, stepFrame=false;
let angle = Math.PI / 2, stopAt = 'None', hadAir = false, landFrame = 0, doubleFrame = 0;
let lastSwitch = {positionDelta: 0, verticalVelocityDelta: 0, speedDelta: 0};
let sourceModel: THREE.Group | null = null, sourceMixer: THREE.AnimationMixer | null = null;
const sourceActions = new Map<string, THREE.AnimationAction>();
const sourceOffset = new THREE.Vector3();
const sourceContactMeshes:{mesh:THREE.Mesh;indices:number[]}[]=[];
const sourceContactPoint=new THREE.Vector3();
async function loadSource() {
  if (sourceModel) return;
  sourceNote.textContent = 'Loading Jak reference…';
  try {
    const gltf = await new GLTFLoader().parseAsync(await loadMotionStudyBuffer('jak-motion', 'eichar-lod0.glb'), '');
    sourceModel = gltf.scene; sourceModel.visible = false;
    // The exported shared buffer contains unused vertices from other meshes.
    // Keep the complete LOD0 geometry and skip invalid unused-vertex bounds.
    sourceModel.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.frustumCulled = false;
        if (node instanceof THREE.SkinnedMesh) node.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,1,0),5);
        // Ignore the export's unused shared-buffer vertices. These actual
        // rendered vertices supply the original flop's missing floor alignment.
        const index=node.geometry.index,range=node.geometry.drawRange;
        const start=range.start,end=Math.min(index?.count??node.geometry.attributes.position.count,start+range.count);
        const indices=new Set<number>();
        for(let i=start;i<end;i++)indices.add(index?index.getX(i):i);
        sourceContactMeshes.push({mesh:node,indices:[...indices]});
      }
    });
    g.scene.add(sourceModel); sourceMixer = new THREE.AnimationMixer(sourceModel);
    for (const clip of gltf.animations) {
      const action = sourceMixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished = true; action.play(); action.paused = true; action.weight = 0;
      sourceActions.set(clip.name.replace('eichar-',''),action);
    }
    sourceNote.textContent = 'Bone Man left · original Jak right · same source frame';
  } catch (error) { sourceBox.checked = false; sourceNote.textContent = 'Jak model could not load. Toggle to retry.'; console.warn(error); }
}
function updateSource() {
  if (!sourceModel || !sourceMixer) return false;
  sourceModel.visible = inspect && variant === 'D' && sourceBox.checked;
  if (!sourceModel.visible) return false;
  const clip = runtime.document.clips.find((c: AnimationClip) => c.id === runtime.activeClipId);
  let name = clip?.metadata?.jakSourceClip as string | undefined, time = runtime.diagnostics.timelineTime ?? 0;
  time /= Number(clip?.metadata?.jakSourceTimeScale ?? 1);
  sourceNote.textContent = clip?.metadata?.jakNativeRunClip ? 'Bone Man left · 50/50 run · original Jak right'
    : clip?.metadata?.jakLedgeSettle ? 'Bone Man left · softer ledge catch · original Jak right'
    : name ? 'Bone Man left · original Jak right · same source frame'
    : 'Bone Man left · native idle / transition · Jak at rest';
  if (clip?.metadata?.jakSourceTailClip && time * 60 >= Number(clip.metadata.jakSourceTailAt)) {
    name = String(clip.metadata.jakSourceTailClip);
    time += (Number(clip.metadata.jakSourceTailFrame) - Number(clip.metadata.jakSourceTailAt)) / 60;
  }
  time += Number(clip?.metadata?.jakSourceStartFrame ?? 0) / 60;
  if(clip?.metadata?.pancakeSlam){
    // The reference is the original moving flop recovery, aligned by action
    // phase rather than pretending the adapted pancake uses identical keys.
    name=p.slamActive?(p.slamHangT>0?'flop-down':'flop-down-loop'):'moving-flop-down-land';
    time=p.slamActive?(p.slamHangT>0?(1-p.slamHangT/CONST.slamHang)*.25:0):
      (1-p.slamFlatT/CONST.slamFlat)*.65;
    sourceNote.textContent='Bone Man left · pancake adaptation · original Jak flop right';
  }
  const poseFrame = runtime.diagnostics.motionContext?.inputs?.jakFrame ?? p.footStudyFrame;
  if (name === 'jump' && poseFrame > 40) {name = 'jump-loop'; time = ((poseFrame - 40) / 60) % (28 / 60);}
  for (const action of sourceActions.values()) action.weight = 0;
  const set = (id: string, weight: number) => {
    const action = sourceActions.get(id); if (!action) return;
    action.enabled = true; action.weight = weight; action.time = Math.min(time, action.getClip().duration);
  };
  if (name) set(name,1); else set('stance-loop',1);
  const speed = p.walkVelocity.length();
  if (name === 'jump' || name === 'run') {
    const weight = name === 'jump' ? THREE.MathUtils.clamp((speed - 2.5) / 5,0,1)
      : runtime.diagnostics.motionContext?.inputs?.[LOCOMOTION_WALK_BLEND_INPUT] ?? 0;
    set(name,1-weight); set(name === 'jump' ? 'jump-forward' : 'walk',weight);
  }
  sourceMixer.update(0);
  sourceOffset.set(Math.cos(angle),0,-Math.sin(angle)).multiplyScalar(2.5);
  if(mode.toLowerCase().includes('ledge') || mode.startsWith('Catch '))
    sourceOffset.set(p.ledgeNormal.z,0,-p.ledgeNormal.x).multiplyScalar(2.5);
  sourceModel.position.copy(p.pos).add(sourceOffset); p.bodyGroup.getWorldQuaternion(sourceModel.quaternion);
  sourceModel.updateWorldMatrix(true,true);
  if (clip?.metadata?.jakRootMode === 'flip') {
    const hip = sourceModel.getObjectByName('hips')!.getWorldPosition(new THREE.Vector3());
    sourceModel.position.add(p.pos.clone().add(sourceOffset).add(new THREE.Vector3(0,1.028,0)).sub(hip));
  } else if (clip?.metadata?.jakLedge && p.state === 'hang') {
    const hands = sourceModel.getObjectByName('sk_lhand')!.getWorldPosition(new THREE.Vector3())
      .add(sourceModel.getObjectByName('sk_rhand')!.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    const centre = ledgeEdgePoint(new THREE.Vector3(),p.ledgeAnchor,ledgeBasis(p.ledgeNormal,CONST.playerHalf.x,CONST.playerHalf.z))
      .add(sourceOffset); centre.y=p.ledgeLip+.025;
    const weight = p.ledgePhase === 'climb' ? 1-THREE.MathUtils.smoothstep(p.ledgeClimbK,.45,.8) : 1;
    sourceModel.position.add(centre.sub(hands).multiplyScalar(weight));
  }
  // This scene skips automatic matrix traversal. SkinnedMesh's override must
  // refresh bindMatrixInverse after placement, not just Object3D world frames.
  sourceModel.updateMatrixWorld(true);
  if(clip?.metadata?.pancakeSlam&&p.grounded){
    // GOAL aligns the flop recovery to its support surface each tick. Raw
    // source keys alone put the head below this viewer's plane during the roll.
    let floor=Infinity;
    for(const {mesh,indices}of sourceContactMeshes)for(const index of indices){
      mesh.getVertexPosition(index,sourceContactPoint).applyMatrix4(mesh.matrixWorld);
      floor=Math.min(floor,sourceContactPoint.y);
    }
    if(Number.isFinite(floor)&&floor<p.pos.y+.006){
      sourceModel.position.y+=p.pos.y+.006-floor;
      sourceModel.updateMatrixWorld(true);
    }
  }
  return true;
}
const visited = new Set<string>(), soundPlays = {old: 0, new: 0};
const nativeJumpSound = sfx.playJump.bind(sfx);
sfx.playJump = (second = false) => {
  if (before || !jakSounds) {
    sfx.play('footstep2', second ? .6 : .55, second ? 1.8 : 1.5);
    soundPlays.old++;
  } else {nativeJumpSound(second); soundPlays.new++;}
};

function chooseVersion(next: 'A' | 'B' | 'C' | 'D') {
  if (next === 'D' && !directSuite) return;
  const position = p.pos.clone(), velocity = p.vVel, speed = p.speed;
  variant = next; before = next === 'A';
  p.onFootJumpStudy = next === 'D' ? {...JAK_DIRECT_PHYSICS,flip:jumpFlip} : next === 'C' ? JAK_JUMP_PHYSICS : null;
  // No respawn, restart, input reset or camera reset. Airborne progress and
  // landing time continue while the next presentation frame reads the new keys.
  runtime.setDocument(before ? oldSuite : variant === 'D' ? directSuite! : variant === 'C' ? studySuite : suite);
  syncSkate();
  lastSwitch = {positionDelta: position.distanceTo(p.pos),
    verticalVelocityDelta: p.vVel - velocity, speedDelta: p.speed - speed};
  if (inspect && frozen) resetInspector();
}
function resetInspector() {
  if (!reviewLevel) return;
  frame = landFrame = doubleFrame = 0; frozen = hadAir = stepFrame = false; visited.clear();
  p.enterLevel('jump-review'); p.respawn(reviewLevel, true); p.freeSkate = false;
  if(mode==='Slow X push'||mode==='Fakie slow X push'){
    p.freeSkate=true;p.speed=18;p.lastPlanar=18;p.stance=mode==='Fakie slow X push'?1:-1;
    p.grounded=true;p.state='ride';p.groundHit=p.queryGround(reviewLevel);
  }
  if (mode==='Ice stance' || mode==='Fakie ice stance') {
    p.respawn(reviewLevel,true,true,{position:new THREE.Vector3(1080,.02,18)});
    p.freeSkate=true;p.speed=18;p.lastPlanar=18;p.stance=mode==='Fakie ice stance'?1:-1;
    p.grounded=true;p.state='ride';p.groundHit=p.queryGround(reviewLevel);
  }
  if (mode.toLowerCase().includes('ledge') || mode.startsWith('Catch ')) {
    p.respawn(reviewLevel,true,true,{position:new THREE.Vector3(1020,mode==='Play ledges'?.02:2.35,mode==='Play ledges'?2:-.7)});
    p.freeSkate=false;
    if(mode!=='Play ledges') {
      p.state='air';p.grounded=false;p.vVel=-1;p.airborneT=.4;p.launchVy=15;p.airFromSkate=false;
      p.pos.z=-1.1;p.prevPos.copy(p.pos);
      p.walkVelocity.set(mode==='Catch left'?4:mode==='Catch right'?-4:0,0,-4);
      p.lastVelX=p.walkVelocity.x;p.lastVelZ=-4;
      p.rawInput={...p.rawInput,moveX:0,moveY:1,jumpHeld:false,jumpPressed:false,jumpReleased:false};
      const wall=reviewLevel.walls.find(w=>Math.abs(w.max.y-3.35)<.01);
      if(wall)p.tryLedgeGrab(wall,reviewLevel);
    }
  }
  runtime.restart();
}
function setInspect(value: boolean) {
  if (value === inspect) return;
  inspect = value;
  if (inspect) {
    savedCoursePosition = p.pos.clone();
    reviewLevel ??= new Level(g.scene, {id: 'jump-review', name: 'Jump review', data: {
      v: 1, name: 'Jump review', spawn: [1000, .02, 0], killY: -30, components: [
        {t: 'platform', p: [1000, -.5, -200], s: [200, 1, 1000]}, {t: 'gate', p: [1000, 0, -400]},
        {t: 'platform', p: [1020, 1.8, -4], s: [8, 3.6, 5]},
        {t: 'platform', p: [1027, .85, -4], s: [4, 1.7, 5]},
        {t: 'platform', p: [1080, -.09, -7], s: [20, .2, 16], slip:true, iceGrip:.08},
      ],
    }});
    // Synthetic motion review has no race start. Keep its auto-created clock
    // and combo orb out of the mount/ink silhouette at the inspection spawn.
    reviewLevel.setRunModesEnabled(false);
    resetInspector();
  } else {
    frozen = false; slow = false; stopAt = 'None';
    p.enterLevel(g.getCurrentLevel().id);
    p.respawn(g.getLevel(), true, true, savedCoursePosition ? {position: savedCoursePosition} : undefined);
    p.freeSkate = false; runtime.restart();
  }
  inspectorControls.hidden = !inspect;
  panel.classList.toggle('inspecting',inspect);
}
const nativeStep = p.step.bind(p);
p.step = (dt: number, input: any, level: Level) => {
  syncSkate();
  if (!inspect) {
    const result = nativeStep(dt, input, level);
    frame++; visited.add(runtime.activeClipId ?? 'legacy');
    return result;
  }
  if(mode==='Play ledges')p.camDir.set(-Math.sin(angle),0,-Math.cos(angle));
  if (!reviewLevel || frozen&&!stepFrame || slow&&!stepFrame&&++skips%3!==0) return;
  stepFrame=false;
  if(mode==='Slow X push'||mode==='Fakie slow X push'){
    p.camDir.set(0,0,-1);
    if(frame===30)p.speed=p.lastPlanar=4;
    nativeStep(dt,{moveX:0,moveY:0,jumpHeld:frame>=30&&frame<240,jumpPressed:frame===30,jumpReleased:frame===240},reviewLevel);
    reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    if(stopAt==='Push stroke'&&skateMotion?.phase==='push'&&skateMotion.time>=.35 ||
      stopAt==='Speed recovered'&&frame>150&&!skateMotion?.diagnostics.speedRecoveryPush)frozen=true;
    if(frame>=360)resetInspector();return;
  }
  if (mode==='Ice stance' || mode==='Fakie ice stance') {
    p.camDir.set(0,0,-1);
    nativeStep(dt,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false},reviewLevel);
    reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    const iceMix=skateMotion?.diagnostics.iceBlend??0;
    if(stopAt==='Ice approach'&&frame===45 || stopAt==='On ice'&&frame===90 || stopAt==='After ice'&&frame===160 ||
      stopAt==='Ice blend in'&&p.groundHit?.slippy&&iceMix>=.4&&iceMix<1 ||
      stopAt==='Ice blend out'&&frame>90&&!p.groundHit?.slippy&&iceMix>.2&&iceMix<=.6)frozen=true;
    if(frame>=260)resetInspector();return;
  }
  if (mode === 'Idle' || mode === 'Idle and stops') {
    p.camDir.set(0,0,-1);
    const demo={moveX:0,moveY:mode==='Idle and stops'?(frame>=90&&frame<180?1:frame>=300&&frame<390?.3:0):0,
      jumpHeld:false,jumpPressed:false,jumpReleased:false};
    nativeStep(dt,demo,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    if(stopAt==='Settled'&&frame===(mode==='Idle'?120:470))frozen=true;
    if(mode==='Idle and stops'&&frame>540)resetInspector();return;
  }
  if(['Skate flow','Mount cancel','Abandon ship','Skating spin','Air spin','Grab release'].includes(mode)){
    p.camDir.set(0,0,-1);
    const t=frame/60,cancel=mode==='Mount cancel'&&t>=.7&&t<.75;
    const abandon=mode==='Abandon ship';
    const heldAt=(s:number)=>s>.4&&s<3.5||abandon&&s>=3.6&&s<3.7;
    const held=heldAt(t),previousHeld=heldAt((frame-1)/60);
    const airSpin=mode==='Air spin'&&t>=3.55&&!p.grounded&&Math.abs(p.grabSpinAngle)<Math.PI;
    const sourceGrab=mode==='Grab release'&&t>=3.55&&t<3.72;
    const demo={moveX:airSpin?1:0,moveY:t<(abandon?8.4:4.8)&&(mode!=='Mount cancel'||t>.4)&&!cancel?1:0,
      jumpHeld:held,jumpPressed:held&&!previousHeld,jumpReleased:!held&&previousHeld,
      spinPressed:mode==='Skating spin'&&frame===130,spinHeld:mode==='Skating spin'&&frame>=130&&frame<132,
      grabHeld:sourceGrab||!abandon&&t>4.8&&t<8.4,grabPressed:mode==='Grab release'&&frame===213};
    nativeStep(dt,demo,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    const ink=skateMotion?.boardScribble;
    if(stopAt==='Mount hold'&&ink?.stage==='prepare'&&ink.progress>=.45
      ||stopAt==='Cancel unwind'&&ink?.stage==='unwind'
      ||stopAt==='Board appears'&&ink?.active&&ink.targetVisible&&ink.frame===0
      ||stopAt==='Board disappears'&&ink?.active&&!ink.targetVisible&&ink.frame===0
      ||stopAt==='Mount'&&skateMotion?.phase==='mount'&&skateMotion.mountProgress>=.5
      ||stopAt==='Dismount'&&skateMotion?.phase==='dismount'&&skateMotion.time>=.3
      ||stopAt==='Abandon flip'&&p.boardAbandonActive&&p.flipTimer>0&&p.flipTimer<=CONST.flipDuration*.525
      ||stopAt==='Landing roll'&&p.rollLandingT>=.2
      ||stopAt==='Spin'&&(p.spinning&&p.spinTimer<=TUNING.spinDuration*.5||!p.grounded&&Math.abs(p.grabSpinAngle)>=Math.PI*.5)
      ||stopAt==='Grab release'&&p.grabPhase==='exit'&&p.grabPose<.8)frozen=true;
    if(frame>=660)resetInspector();return;
  }
  if (mode==='Play ledges') {
    nativeStep(dt,input,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');return;
  }
  if (mode.toLowerCase().includes('ledge') || mode.startsWith('Catch ')) {
    p.camDir.set(0,0,-1);
    const demo={moveX:mode==='Shimmy ledge'?(frame>90&&frame<150?1:frame>=150&&frame<250?-1:frame>=280&&frame<340?1:0):0,
      moveY:mode==='Ledge hold to climb'?1:mode==='Ledge release and climb'?(frame<20||frame>=32?1:0):mode==='Climb ledge and run'&&frame>=230?1:mode==='Climb ledge'&&frame===230?1:mode==='Release ledge'&&frame>230?-1:0,
      jumpHeld:false,jumpPressed:false,jumpReleased:false};
    nativeStep(dt,demo,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    if(stopAt==='Catch'&&frame===20 || stopAt==='Settled'&&frame===160 ||
      stopAt==='Before climb'&&frame===45 ||
      stopAt==='Catch rebound'&&runtime.activeClipId?.startsWith('player.jak-ledge-')&&(runtime.diagnostics.timelineTime??0)>=1.18 ||
      stopAt==='Climb rebound'&&p.ledgeClimbRecovery>=.23 ||
      stopAt==='Run exit'&&p.ledgeClimbRecovery>=.05 ||
      stopAt==='Pull-up'&&p.state==='hang'&&p.ledgePhase==='climb'&&p.ledgeClimbK>=.5 ||
      stopAt==='Release'&&runtime.activeClipId==='player.jak-ledge-off'&&(runtime.diagnostics.timelineTime??0)>=.17)frozen=true;
    if(frame>400)resetInspector();return;
  }
  if(mode==='Pancake slam'||mode==='Slam and run'){
    p.camDir.set(0,0,-1);
    const slam=frame===48;
    nativeStep(dt,{moveX:0,moveY:mode==='Slam and run'&&frame>48?1:0,
      jumpHeld:frame>=20&&frame<30,jumpPressed:frame===20,jumpReleased:frame===30,
      grabHeld:slam,grabPressed:slam},reviewLevel);
    reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    const age=p.slamFlatT>0?CONST.slamFlat-p.slamFlatT:-1;
    if(stopAt==='Slam gather'&&p.slamActive&&p.slamHangT<.23&&p.slamHangT>.15 ||
      stopAt==='Slam spread'&&p.slamActive&&p.slamHangT<=0 ||
      stopAt==='Slam impact'&&age>=.04&&age<.08 ||
      stopAt==='Slam rebound'&&age>=.18&&age<.22 ||
      stopAt==='Slam inversion'&&age>=.24&&age<.28 ||
      stopAt==='Slam feet down'&&age>=PANCAKE_SLAM.feetDown-PANCAKE_SLAM.hang ||
      stopAt==='Slam settle'&&age>=.48 ||stopAt==='Run exit'&&frame>=140)frozen=true;
    if(frame>=210)resetInspector();return;
  }
  if (mode === 'Walk, run and turn') {
    p.camDir.set(0,0,-1);
    const demo = {moveX:frame>=210&&frame<285?-1:0,moveY:frame<90?.3:frame<210?1:0,
      jumpHeld:false,jumpPressed:false,jumpReleased:false};
    nativeStep(dt,demo,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    if(frame>480)resetInspector();return;
  }
  if (mode === 'Reverse and restart') {
    p.camDir.set(0,0,-1);
    const demo = {moveX:frame>=300&&frame<360?1:0,
      moveY:frame<90?1:frame<180?-1:frame<200?0:frame<260?1:0,
      jumpHeld:false,jumpPressed:false,jumpReleased:false};
    nativeStep(dt,demo,reviewLevel);reviewLevel.update(dt);frame++;visited.add(runtime.activeClipId??'legacy');
    if(stopAt==='Turn'&&p.walkTurnaround&&p.walkVelocity.length()<3 ||
      stopAt==='Restart'&&frame===205 || stopAt==='Settled'&&frame===430)frozen=true;
    if(frame>480)resetInspector();return;
  }
  const secondJump = mode === 'Double jump' || mode === 'Running double jump';
  const running = mode === 'Running jump' || mode === 'Coasting jump' || mode === 'Running double jump' || mode === 'Run and stop';
  const hold = mode === 'Tap jump' ? 3 : running || mode === 'Precision jump' ? 18 : 35, release = 50 + hold;
  const demo = {moveX: 0, moveY: mode === 'Precision jump' ? .2 : running &&
      (mode !== 'Run and stop' || frame < 145) && (mode !== 'Coasting jump' || frame < release) ? 1 : 0,
    jumpHeld: frame >= 50 && frame < release, jumpPressed: frame === 50, jumpReleased: frame === release};
  if (secondJump && hadAir && !doubleFrame && p.vVel < 2) {
    demo.jumpPressed = demo.jumpHeld = true; doubleFrame = frame;
  }
  if (doubleFrame && frame === doubleFrame + 1) demo.jumpReleased = true;
  nativeStep(dt, demo, reviewLevel); reviewLevel.update(dt); frame++;
  visited.add(runtime.activeClipId ?? 'legacy');
  if (!p.grounded) hadAir = true; else if (hadAir && !landFrame) landFrame = frame;
  const phase = runtime.diagnostics.motionContext?.actionProgress ?? 0;
  const targetAir = !secondJump || doubleFrame > 0 && frame > doubleFrame + 1;
  if (stopAt === 'Charge' && frame === release || targetAir && (
      stopAt === 'Reach' && !p.grounded && phase >= .12 && p.vVel > 0 ||
      stopAt === 'Apex' && !p.grounded && p.vVel <= 0 ||
      stopAt === 'Roll complete' && !p.grounded && runtime.diagnostics.motionContext?.inputs?.jakRollLaunch &&
        (runtime.diagnostics.motionContext?.inputs?.jakFlipProgress ?? 0) >= 1.1 ||
      stopAt === 'Second boost' && doubleFrame > 0 && frame === doubleFrame + 6 ||
      stopAt === 'Catch' && landFrame && frame === landFrame + 5 ||
      stopAt === 'Rebound' && landFrame && frame === landFrame + 11 ||
      stopAt === 'Settled' && landFrame && frame >= landFrame + 40 &&
        ['player.idle','player.run'].includes(runtime.activeClipId ?? '') &&
        runtime.diagnostics.transitionBlendWeight === null)) frozen = true;
  if (frame > (mode === 'Run and stop' ? 750 : 300)) resetInspector();
};
const nativeRender = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => {
  const alongside = args[1] === g.camera && updateSource();
  if ((inspect||replayReview) && args[1] === g.camera) {
    const target = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    if (alongside) target.addScaledVector(sourceOffset,.5);
    const distance = alongside ? 8.2 : 6.4;
    g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * distance, .25, Math.cos(angle) * distance));
    g.camera.up.set(0, 1, 0); g.camera.lookAt(target); g.camera.updateMatrixWorld(true);
  }
  if(args[1]===g.camera&&boardInk){
    skateMotion?.constrainRenderPose();
    boardInk.update(g.camera,p.grounded&&p.groundHit?inkSupport.setFromNormalAndCoplanarPoint(p.groundHit.normal,p.pos):undefined);
    // The full game deliberately disables automatic scene matrix traversal.
    boardInk.sprite.updateMatrixWorld(true);
  }
  return nativeRender(...args);
};

const panel = document.createElement('section'); panel.id = 'jump-ab-panel';
panel.setAttribute('aria-label', 'Jump A/B/C/D playtest');
panel.innerHTML = '<h1>Jump A/B/C/D playtest</h1>';
const versions = document.createElement('div'), current = document.createElement('div');
versions.className = 'versions';
current.dataset.testid = 'jump-ab-current'; panel.append(versions, current);
const button = (parent: HTMLElement, label: string, fn: () => void) => {
  const b = document.createElement('button'); b.textContent = label;
  b.onclick = () => {sfx.unlock(); fn(); b.blur();}; parent.append(b); return b;
};
const oldButton = button(versions, 'A · Original', () => chooseVersion('A'));
const newButton = button(versions, 'B · Animation', () => chooseVersion('B'));
const studyButton = button(versions, 'C · Jak feel', () => chooseVersion('C'));
const directButton = button(versions, 'D · Jak hybrid', () => chooseVersion('D'));
directButton.disabled = !directSuite;
if (!directSuite) directButton.title = 'Jak motion could not load. Reload to retry.';
const controlsToggle = button(panel,'Hide controls',() => {
  const compact = panel.classList.toggle('compact');
  controlsToggle.textContent = compact ? 'Show controls' : 'Hide controls';
});
controlsToggle.className = 'controls-toggle';
const instructions = document.createElement('p');
instructions.textContent = 'WASD / arrows to move · Space to jump; tap again in air for double jump. Controller controls work too.';
const continuity = document.createElement('small'); continuity.textContent = '1 / 2 / 3 / 4 switches A / B / C / D. D follows the live TUNER values.';
panel.append(instructions, continuity);
const directHint = document.createElement('p');
directHint.textContent = 'D pairs Bone Man’s idle and hybrid run with Jak’s jumps and ledges, plus the new Skate mounts, riding and pickups. Release to jump; hold X / Space + direction to skate. Q brakes and steps off.';
panel.append(directHint);
const options = document.createElement('details'); options.innerHTML = '<summary>Playtest options</summary>';
// Opt-in local replay inspection uses the real level and recorded controller
// input. Advance the complete game clock one fixed tick per rendered frame,
// so pausing never leaves the world running around a frozen player.
if(import.meta.env.DEV&&g.launchReview){
  const review=document.createElement('fieldset'),legend=document.createElement('legend');
  legend.textContent='Local replay review';review.append(legend);options.append(review);
  const file=document.createElement('input');file.type='file';file.accept='.json';
  file.setAttribute('aria-label','Replay file');review.append(file);
  const target=document.createElement('input');target.type='number';target.min='0';target.value='1430';
  target.setAttribute('aria-label','Pause replay at frame');review.append(target);
  const note=document.createElement('output');note.setAttribute('aria-label','Replay review status');review.append(note);
  let data:unknown=null,playing=false;
  const start=()=>{
    if(!data)return;
    setInspect(false);g.launchReview.rate=1;g.loadReplay(data);replayReview=true;playing=true;
  };
  file.onchange=async()=>{if(file.files?.[0]){
    try{data=JSON.parse(await file.files[0].text());start();}catch{note.textContent='Invalid replay JSON';}
  }};
  button(review,'Replay from start',start);
  button(review,'Continue replay',()=>{playing=true;});
  button(review,'Pause replay',()=>{playing=false;});
  button(review,'Step replay',()=>{playing=false;g.launchReview.advance=CONST.fixedStep;});
  button(review,'End replay review',()=>{replayReview=playing=false;g.launchReview.rate=1;});
  const render=document.createElement('select');render.setAttribute('aria-label','Replay render quality');
  render.add(new Option('Normal','normal'));render.add(new Option('MAX / native','max'));
  render.onchange=()=>{g.renderQualitySettings.setRegularResolution(render.value==='max'?null:720);render.blur();};
  review.append(render);
  const tick=()=>{
    if(replayReview){
      if(g.gameFlow.blocksGameplay)g.launchReview.rate=1;
      else{
        g.launchReview.rate=0;
        if(g.replayer.frame>=Number(target.value))playing=false;
        if(playing&&g.replayer.active)g.launchReview.advance=CONST.fixedStep;
      }
      note.textContent=`${playing?'Playing':'Paused'} replay ${g.replayer.frame} / ${g.replayer.total}`;
    }
    requestAnimationFrame(tick);
  };tick();
}
const skateOptions=document.createElement('div');options.append(skateOptions);
const skateLabel=document.createElement('label'),skateBox=document.createElement('input');
skateBox.type='checkbox';skateBox.checked=true;skateBox.disabled=!skateMotion;
skateBox.onchange=()=>{skateEnabled=skateBox.checked;syncSkate();skateBox.blur();};
skateLabel.append(skateBox,' New Skate motion in D');skateOptions.append(skateLabel);
const inkLabel=document.createElement('label'),inkBox=document.createElement('input');
inkBox.type='checkbox';inkBox.checked=true;inkBox.disabled=!boardInk;
inkBox.onchange=()=>{inkEnabled=inkBox.checked;syncSkate();inkBox.blur();};
inkLabel.append(inkBox,' Board scribbles');skateOptions.append(inkLabel);
const skateNote=document.createElement('small');
skateNote.textContent=skateMotion?'Switch off new Skate motion to compare with previous D skating.':'Skate motion could not load. Reload to retry; foot motion remains available.';
skateOptions.append(skateNote);
const flipLabel=document.createElement('label'),flipBox=document.createElement('input');
flipBox.type='checkbox';flipBox.checked=true;
flipBox.onchange=()=>{jumpFlip=flipBox.checked;chooseVersion(variant);flipBox.blur();};
flipLabel.append(flipBox,' Running jump flip in D');options.append(flipLabel);
const soundLabel = document.createElement('label'), soundBox = document.createElement('input');
soundBox.type = 'checkbox'; soundBox.checked = true;
soundBox.onchange = () => {jakSounds = soundBox.checked; soundBox.blur();};
soundLabel.append(soundBox, ' Jak sounds in B / C / D'); options.append(soundLabel);
const ecoLabel = document.createElement('label'), ecoBox = document.createElement('input');
ecoBox.type = 'checkbox'; ecoBox.checked = true;
ecoBox.onchange = () => {ecoEnabled = ecoBox.checked; ecoBox.blur();};
ecoLabel.append(ecoBox, ' Green eco fire'); options.append(ecoLabel);
const ecoRenderLabel = document.createElement('label'), ecoRender = document.createElement('select');
ecoRender.setAttribute('aria-label', 'Eco rendering');
ecoRenderLabel.append('Eco rendering ', ecoRender);
ecoRender.add(new Option('Gouraud puffs', 'gouraud'));
const originalEco = new Option('Original textures', 'original'); originalEco.disabled = true; ecoRender.add(originalEco);
ecoRender.onchange = () => {ecoFire.rendering = ecoRender.value as GreenEcoRendering; ecoRender.blur();};
options.append(ecoRenderLabel);
const ecoFreezeLabel = document.createElement('label'), ecoFreeze = document.createElement('input');
ecoFreeze.type = 'checkbox'; ecoFreeze.onchange = () => {ecoFire.paused = ecoFreeze.checked; ecoFreeze.blur();};
ecoFreezeLabel.append(ecoFreeze, ' Freeze eco for comparison'); options.append(ecoFreezeLabel);
const ecoRenderNote = document.createElement('small');
ecoRenderNote.textContent = 'Same original particle motion in both views.'; options.append(ecoRenderNote);
for(const element of [ecoLabel,ecoRenderLabel,ecoFreezeLabel,ecoRenderNote])element.classList.add('eco-control');
void ecoFire.loadSourceTextures(motionStudyAsset('jak-eco').replace(/\/$/, '')).then(() => {originalEco.disabled = false;}).catch(() => {
  ecoRenderNote.textContent = 'Gouraud puffs ready. Original textures could not load.';
});
const modes = document.createElement('div'); options.append(modes);
const playButton = button(modes, 'Play course', () => setInspect(false));
const inspectButton = button(modes, 'Watch motion', () => setInspect(true));
button(modes,'Ledge playground',()=>{mode='Play ledges';angle=0;setInspect(true);resetInspector();});
button(modes, 'Restart course', () => {
  setInspect(false); p.enterLevel(g.getCurrentLevel().id); p.respawn(g.getLevel(), true, true);
  p.freeSkate = false; runtime.restart(); visited.clear();
});
const ecoNote = document.createElement('small');
button(modes, 'Next eco vent', () => {
  setInspect(false); ecoEnabled = ecoBox.checked = true;
  const vent = JUMP_ECO_VENTS[ecoVisit++ % JUMP_ECO_VENTS.length];
  p.enterLevel(g.getCurrentLevel().id);
  p.respawn(g.getLevel(), true, true, {position: new THREE.Vector3(...vent.approach)});
  p.freeSkate = false; runtime.restart(); ecoNote.textContent = `Eco vent · ${vent.name}`;
});
options.append(ecoNote);
const inspectorControls = document.createElement('div'); inspectorControls.hidden = true; options.append(inspectorControls);
const sourceLabel = document.createElement('label'), sourceBox = document.createElement('input'), sourceNote = document.createElement('small');
sourceBox.type = 'checkbox'; sourceBox.onchange = () => {if (sourceBox.checked) void loadSource(); sourceBox.blur();};
sourceLabel.append(sourceBox,' Show original Jak alongside (D)'); inspectorControls.append(sourceLabel,sourceNote);
const select=(label:string,values:string[],change:(value:string)=>void)=>{
  const row=document.createElement('label'),control=document.createElement('select');
  control.setAttribute('aria-label',label);for(const value of values)control.add(new Option(value,value));
  control.onchange=()=>{change(control.value);control.blur();};row.append(label+' ',control);inspectorControls.append(row);return control;
};
const motionSelect=select('Motion',['Idle','Idle and stops','Tap jump','Full jump','Precision jump','Double jump','Running jump','Coasting jump','Running double jump','Run and stop','Walk, run and turn','Reverse and restart','Pancake slam','Slam and run',
  'Skate flow','Mount cancel','Slow X push','Fakie slow X push','Abandon ship','Skating spin','Air spin','Grab release','Ice stance','Fakie ice stance','Ledge catch','Catch left','Catch right','Climb ledge','Climb ledge and run','Ledge hold to climb','Ledge release and climb','Release ledge','Shimmy ledge','Play ledges'],value=>{mode=value;resetInspector();});
motionSelect.value=mode;
const viewSelect=select('View',['Front','Side','Behind','Oblique'],value=>angle=({Front:Math.PI,Side:Math.PI/2,Behind:0,Oblique:.7}[value]??0));
viewSelect.value='Side';
const quality=select('Render',['Normal','MAX / native'],value=>g.renderQualitySettings.setRegularResolution(value==='MAX / native'?null:720));
quality.value=g.renderQualitySettings.regularResolution==='max'?'MAX / native':'Normal';
button(inspectorControls, 'Freeze / play', () => frozen = !frozen);
button(inspectorControls, 'Step frame', () => {frozen=true;stepFrame=true;});
button(inspectorControls, 'Slow / realtime', () => slow = !slow);
button(inspectorControls, 'Control this ledge', () => {
  mode='Play ledges';frozen=false;slow=false;stopAt='None';
  if(p.state!=='hang')resetInspector();
});
const ledgeHint=document.createElement('small');
ledgeHint.textContent='On ledges: move along the edge to shimmy and away to drop. Climb with a fresh direction toward the ledge or a new Space press; an existing hold needs 0.75 seconds after the catch.';
inspectorControls.append(ledgeHint);
select('Pause at',['None','Charge','Reach','Apex','Roll complete','Second boost','Catch','Rebound','Settled','Pull-up','Release','Turn','Restart','Slam gather','Slam spread','Slam impact','Slam rebound','Slam inversion','Slam feet down','Slam settle',
  'Mount hold','Cancel unwind','Board appears','Board disappears','Mount','Dismount','Push stroke','Speed recovered','Abandon flip','Landing roll','Spin','Grab release','Ice approach','Ice blend in','On ice','Ice blend out','After ice','Before climb','Catch rebound','Climb rebound','Run exit'],value=>{stopAt=value;resetInspector();});
const diagnostics = document.createElement('details'); diagnostics.innerHTML = '<summary>Diagnostics</summary>';
const status = document.createElement('pre'); status.dataset.testid = 'jump-review-status'; diagnostics.append(status);
options.append(diagnostics); panel.append(options); document.body.append(panel);
window.addEventListener('keydown', event => {
  if (event.repeat || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')) return;
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
    event.preventDefault();event.stopImmediatePropagation();
    chooseVersion(event.code === 'Digit1' ? 'A' : event.code === 'Digit2' ? 'B' : event.code === 'Digit3' ? 'C' : 'D');
  }
}, true);
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  oldButton.setAttribute('aria-pressed', String(before)); newButton.setAttribute('aria-pressed', String(variant === 'B'));
  studyButton.setAttribute('aria-pressed', String(variant === 'C'));
  directButton.setAttribute('aria-pressed', String(variant === 'D'));
  directHint.hidden = variant !== 'D';
  skateOptions.hidden=variant!=='D';
  instructions.textContent = 'WASD / arrows to move · Space to jump; tap again in air for double jump. Hold while running to skate.';
  playButton.setAttribute('aria-pressed', String(!inspect)); inspectButton.setAttribute('aria-pressed', String(inspect));
  const audio = before || !jakSounds ? 'Original sounds' : sfx.jumpAudioSource;
  current.textContent = `${variant} · ${variant === 'A' ? 'Original motion + physics' : variant === 'B' ? 'New motion · original physics' : variant === 'C' ? 'Jak motion + foot physics' : 'Jak hybrid · live UI tuning'} · ${audio}`;
  const d = runtime.diagnostics, scalars = runtime.lastSampledPose?.scalars;
  motionSelect.value=mode;
  viewSelect.value=angle===Math.PI?'Front':angle===Math.PI/2?'Side':angle===0?'Behind':'Oblique';
  sourceNote.hidden=!sourceBox.checked;
  status.textContent = JSON.stringify({variant, mode: inspect ? mode : 'Live play', before, frame, frozen, slow, stopAt,
    audio, soundPlays, sourceFrame: p.footStudyFrame, sourceClip: runtime.document.clips.find((c: AnimationClip) => c.id === runtime.activeClipId)?.metadata?.jakSourceClip, skating: p.freeSkate, active: d.activeClipId, phase: d.timelineTime?.toFixed(3),
    rollProgress: d.motionContext?.inputs?.jakFlipProgress,
    takeoff: {speed:d.motionContext?.inputs?.jakTakeoffSpeed,flipMinSpeed:d.motionContext?.inputs?.jakFlipMinSpeed,
      flip:!!d.motionContext?.inputs?.jakRollLaunch},
    abandon:p.boardAbandonActive,abandonFlipRemaining:p.flipTimer,landingRoll:p.rollLandingT,
    spin:{active:p.spinning,attackAngle:p.spinAngle,airAngle:p.grabSpinAngle,stance:p.stance,grabPhase:p.grabPhase},
    tuning: {jumpMinVelocity:TUNING.jumpMinVelocity,jumpVelocity:TUNING.jumpVelocity,riseGravity:TUNING.riseGravity,
      fallGravity:TUNING.fallGravity,doubleJumpVelocity:TUNING.doubleJumpVelocity,doubleJumpWindow:TUNING.doubleJumpWindow,
      jumpFlipMinSpeed:TUNING.jumpFlipMinSpeed},
    position: p.pos.toArray().map((v: number) => +v.toFixed(3)), vVel: +p.vVel.toFixed(3), grounded: p.grounded,
    footSpeed:+p.walkVelocity.length().toFixed(3),turning:p.walkTurnaround,
    gaitSpeed:+(d.motionContext?.normalizedSpeed ?? 0).toFixed(3),
    walkBlend:+(d.motionContext?.inputs?.[LOCOMOTION_WALK_BLEND_INPUT] ?? 0).toFixed(3),
    lastSwitch, torso: scalars?.['deform.torso.length']?.toFixed(2), shin: scalars?.['deform.leg.lower.left.length']?.toFixed(2),
    jumpFlip,ledge:p.state==='hang'?p.ledgePhase:null,ledgeGripError:+p.ledgeGripError.toFixed(4),
    ledgeSeconds:+p.ledgeSourceSeconds.toFixed(3),ledgeClimbRecovery:+p.ledgeClimbRecovery.toFixed(3),
    cameraInput:p.camDir.toArray(),ledgeNormal:p.ledgeNormal.toArray(),
    sourceHip:sourceModel?.getObjectByName('hips')?.getWorldPosition(new THREE.Vector3()).toArray(),
    targetHip:binding.joints.get('hips')?.getWorldPosition(new THREE.Vector3()).toArray(),
    skateStance:{stance:p.stance,ice:!!p.boardG.userData.iceSkateMotion,
      rightFootLead:+binding.joints.get('ankleRight')!.getWorldPosition(new THREE.Vector3())
        .sub(binding.joints.get('ankleLeft')!.getWorldPosition(new THREE.Vector3())).dot(p.axisF).toFixed(3)},
    skate:skateMotion?{...skateMotion.diagnostics,active:skateMotion.active,
      scribble:{stage:skateMotion.boardScribble.stage,frame:skateMotion.boardScribble.frame,
        appearances:skateMotion.boardScribble.appearances,disappearances:skateMotion.boardScribble.disappearances,
        visible:boardInk?.sprite.visible}}:null,
    ecoFire: {...ecoFire.diagnostics, cpuMs: +ecoCpuMs.toFixed(3)}, visited: [...visited]}, null, 2);
  requestAnimationFrame(report);
}
p.freeSkate = false; chooseVersion(directSuite ? 'D' : 'B'); report();
