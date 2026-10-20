import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false}});
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
try{
  const {ENEMY_MOTION,enemyWalkRate,createEnemyPoseBlend}=await server.ssrLoadModule('/src/enemies/motion.ts');
  near(enemyWalkRate('grunt',2,2,1,2,'patrol'),.5,'world size must correct source speed');
  near(enemyWalkRate('grunt',2,2,1,1,'patrol'),1,'unscaled source cadence');
  near(enemyWalkRate('turtle',0,.3,1,2,'patrol'),0,'standing must not advance gait');
  for(const [kind,profile]of Object.entries(ENEMY_MOTION))for(const duration of [.5,1,2]){
    const rate=enemyWalkRate(kind,30,.3,duration,2,'patrol');
    assert.ok(rate/duration<=profile.walkHz+1e-8,`${kind}: cadence is bounded independently of clip duration`);
  }
  assert.ok(enemyWalkRate('charger',17,.6,1,2,'dash')>enemyWalkRate('charger',17,.6,1,2,'patrol'));
  assert.ok(enemyWalkRate('grunt',5,.3,1,2,'patrol',true)<=1.55);

  // Quaternion targets must not alias the interpolation receiver. An old pose
  // held until the last blend frame looks like a snap, even if both ends pass.
  const joint=new THREE.Object3D(),blend=createEnemyPoseBlend([joint]);
  const f={kind:'charger',state:'telegraph',alive:true};
  blend.begin(0,f);joint.rotation.x=-.3;blend.end();
  joint.quaternion.identity();blend.begin(0,{...f,state:'dash'});joint.rotation.x=.3;blend.end();
  near(joint.rotation.x,-.3,'transition begins at previous additive pose');
  joint.quaternion.identity();blend.begin(.07,{...f,state:'dash'});joint.rotation.x=.3;blend.end();
  near(joint.rotation.x,0,'transition has a real halfway pose');
  joint.quaternion.identity();blend.begin(.07,{...f,state:'dash'});joint.rotation.x=.3;blend.end();
  near(joint.rotation.x,.3,'transition reaches target');
  joint.quaternion.identity();blend.begin(.01,{...f,state:'dead',alive:false});blend.end();
  near(joint.rotation.x,0,'defeat does not inherit looping motion');

  const {sfx}=await server.ssrLoadModule('/src/audio.ts');
  const {playEnemySound,updateEnemySounds,resetEnemySounds,enemySoundGain}=await server.ssrLoadModule('/src/enemies/sounds.ts');
  const events=[];sfx.play=(...args)=>events.push(args);
  const player=new THREE.Vector3(),actor={kind:'sentry',state:'track',stateT:0,alive:true,
    group:new THREE.Group(),visual:{diagnostics:{gaitPhase:0}}};
  updateEnemySounds(actor,.01,0,player);
  actor.state='charge';updateEnemySounds(actor,0,0,player);assert.equal(events.length,0,'zero-time aim refresh must be silent');
  updateEnemySounds(actor,.01,0,player);assert.equal(events.at(-1)[0],'enemySentryCharge');
  for(let i=0;i<30;i++)updateEnemySounds(actor,1/60,0,player);
  assert.equal(events.length,1,'charge cue fires once per transition');
  actor.state='fire';updateEnemySounds(actor,.01,0,player);assert.equal(events.at(-1)[0],'enemySentryFire');
  actor.state='cooldown';updateEnemySounds(actor,.01,0,player);assert.equal(events.at(-1)[0],'enemySentryCool');
  resetEnemySounds(actor);actor.state='track';updateEnemySounds(actor,.01,0,player);
  assert.equal(events.length,3,'reset must not play a stale transition');
  actor.kind='grunt';actor.state='patrol';resetEnemySounds(actor);events.length=0;
  actor.visual.diagnostics.plantedFeet={frontLeft:false};updateEnemySounds(actor,.01,3,player);
  actor.visual.diagnostics.plantedFeet.frontLeft=true;updateEnemySounds(actor,.01,3,player);
  assert.equal(events.length,1);assert.equal(events[0][0],'enemyCrabStep');
  updateEnemySounds(actor,.2,0,player);assert.equal(events.length,1,'standing has no footfalls');
  actor.group.position.x=50;playEnemySound(actor,'defeat',player);assert.equal(events.length,1,'distant encounters stay silent');
  actor.group.position.x=0;actor.alive=false;updateEnemySounds(actor,10,3,player);assert.equal(events.length,1,'dead enemies are quiet');
  actor.kind='moa';playEnemySound(actor,'defeat',player);updateEnemySounds(actor,10,3,player);assert.equal(events.length,1,'moa bank is untouched');
  near(enemySoundGain(0),1,'near gain');near(enemySoundGain(28),0,'cull range');
  assert.ok(enemySoundGain(5)>enemySoundGain(15));

  const manifest=JSON.parse(await readFile(new URL('../public/sfx/enemies/manifest.json',import.meta.url)));
  assert.equal(manifest.sounds.length,24);
  let total=0;
  for(const entry of manifest.sounds){
    const bytes=await readFile(new URL('../public/sfx/enemies/'+entry.file,import.meta.url));total+=bytes.length;
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt32LE(24),24000);assert.equal(bytes.readUInt16LE(22),1);
    assert.equal(bytes.readInt16LE(44),0);assert.equal(bytes.readInt16LE(bytes.length-2),0,'no hard cut at tail');
    assert.ok(entry.rms>.025&&entry.peak<.9,'audible, unclipped foley');
  }
  assert.ok(total<500000,'bounded sound-bank size');
  console.log('PASS size-aware species cadence, smooth additive transitions, contact/state-timed distance-limited SFX, reset/death/moa isolation and 24 valid PCM assets.');
}finally{await server.close();}
