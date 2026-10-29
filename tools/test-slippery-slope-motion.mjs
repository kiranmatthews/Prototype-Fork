import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const slopeData=(degrees,gravity=true)=>{const grade=Math.tan(degrees*Math.PI/180);return{v:1,name:'Slope effort',spawn:[0,50.12,0],killY:-90,components:[
 {t:'mesh',nm:'Effort slope',p:[0,50,0],vertices:[-40,80*grade,80,40,80*grade,80,40,-140*grade,-140,-40,-140*grade,-140],indices:[0,1,2,0,2,3],solid:true,tex:'solid',slip:gravity,iceGrip:.02,...(gravity?{slipGravity:1}:{})},
 {t:'gate',p:[35,50,-125]},
]};};
const rows=[],out=process.env.CARLISLE_MOTION_OUT??'docs/carlisle-relay/slope-motion';
await withSkateRuntime(async({THREE,Level,Player,CONST,TUNING,server})=>{
 const a=await server.ssrLoadModule('/src/animation/index.ts'),{createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
 const tuning=JSON.stringify(TUNING);
 const create=(degrees,enabled=true,gravity=true)=>{
  const scene=new THREE.Scene(),level=new Level(scene,{id:'slope-effort',name:'Slope effort',data:slopeData(degrees,gravity)});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.enterLevel('slope-effort');p.endlessDeaths=true;p.rawInput=makeInput();p.respawn(level,true);
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root),suite=a.createPlayerStarterAnimationSuite(binding.definition),runtime=createCharacterAnimationRuntime(p,suite,{enabled});
  return{level,p,runtime};
 };
 const state=f=>({at:f.p.pos.toArray(),velocity:f.p.walkVelocity.toArray(),state:f.p.state,board:f.p.freeSkate,grounded:f.p.grounded});
 const tick=(f,moveY)=>{const input=makeInput({moveY});f.p.rawInput=input;f.p.step(CONST.fixedStep,input,f.level);f.level.update(CONST.fixedStep);f.p.commitRenderStep(f.level);};
 const dispose=f=>{f.runtime.dispose();f.level.dispose();};
 const dry=create(0,true,false);for(let i=0;i<90;i++)tick(dry,-1);
 const dryStart=dry.runtime.playbackSeconds;for(let i=0;i<60;i++)tick(dry,-1);
 const dryCadence=dry.runtime.playbackSeconds-dryStart;
 assert.equal(dry.runtime.activeClipId,'player.run');
 for(const degrees of [18,22,26])for(const [name,moveY] of [['downhill',1],['neutral',0],['uphill',-1]]){
  const on=create(degrees),off=create(degrees,false);
  for(let i=0;i<90;i++){tick(on,moveY);tick(off,moveY);assert.deepEqual(state(on),state(off),'animation changed movement');}
  const p=on.p,expected=name==='uphill'?'player.run':'player.slope-slide';
  assert.equal(p.animationClipHint,expected);assert.equal(on.runtime.activeClipId,expected);
  assert.ok(p.grounded&&!p.freeSkate&&!p.isBailing);
  const start=on.runtime.playbackSeconds,phase=p.walkPhase;
  for(let i=0;i<60;i++){tick(on,moveY);assert.equal(p.animationClipHint,expected);}
  const cadence=on.runtime.playbackSeconds-start;
  if(name==='uphill'){
   assert.ok(p.pos.z>2&&p.walkVelocity.z>1&&p.walkVelocity.z<TUNING.walkSpeed*.4,'uphill progress must be supported but reduced');
   assert.equal(p.animationIntent.motion.normalizedSpeed,1);assert.ok(Math.abs(cadence-dryCadence)<1e-8,'uphill run loop slowed down');
  }else{
   assert.ok(p.pos.z<-10&&p.walkVelocity.z<-10,'downhill momentum lost');assert.equal(p.walkPhase,phase,'downhill run gait still advanced');
   assert.equal(p.slideTimer,0,'cosmetic slide started the canned gameplay slide');
  }
  rows.push({degrees,name,position:p.pos.toArray(),velocity:p.walkVelocity.toArray(),clip:p.animationClipHint,active:on.runtime.activeClipId,cadence,normalizedSpeed:p.animationIntent.motion.normalizedSpeed});
  dispose(on);dispose(off);
 }
 const reverse=create(22);for(let i=0;i<75;i++)tick(reverse,1);
 const oldSpeed=-reverse.p.walkVelocity.z;tick(reverse,-1);
 assert.ok(reverse.p.walkVelocity.z<0,'reversal erased downhill inertia');assert.equal(reverse.p.animationClipHint,'player.run');
 for(let i=0;i<150;i++)tick(reverse,-1);
 assert.ok(reverse.p.walkVelocity.z>1,'uphill effort never overcame the slide');
 const uphill=state(reverse);for(let i=0;i<60;i++)tick(reverse,0);
 assert.equal(reverse.p.animationClipHint,'player.slope-slide');assert.ok(reverse.p.walkVelocity.z<0,'release did not restore gravity slide');
 rows.push({name:'reverse then release',oldDownhillSpeed:oldSpeed,uphill,released:state(reverse)});
 // Actions keep their existing routes; the new foot mode never owns them.
 const p=reverse.p;
 for(const [name,setup,expected] of [
  ['board',()=>{p.freeSkate=true;},'player.skate'],
  ['air',()=>{p.freeSkate=false;p.state='air';p.grounded=false;p.vVel=5;},'player.jump'],
  ['grind',()=>{p.state='grind';},'player.grind'],
  ['death',()=>{p.state='dead';},'player.death'],
 ]){setup();assert.equal(p.animationClipHint,expected,name);}
 dispose(reverse);dispose(dry);assert.equal(JSON.stringify(TUNING),tuning);
}, {levelEntry:{id:'slope-effort',name:'Slope effort',data:slopeData(18)}});
await mkdir(out,{recursive:true});
await writeFile(`${out}/native.json`,JSON.stringify({rows},null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
console.log('PASS downhill glide, slower supported uphill movement at full run cadence, inertial reversal, release and action priority.');
