import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({server,player:p})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {withCharacterElasticity,CHARACTER_ELASTICITY_REVISION}=await server.ssrLoadModule('/src/animation/elasticity.ts');
  const {SKATE_OLLIE_LENGTH_KEYS,SkateOllieMotion}=await server.ssrLoadModule('/src/skateOllieMotion.ts');
  const rig=a.RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const suite=a.createPlayerStarterAnimationSuite(rig);
  const motion=a.createProceduralMotionContext({normalizedSpeed:.5,grounded:true});
  for(const clip of suite.clips){
    assert.equal(clip.metadata.elasticityRevision,CHARACTER_ELASTICITY_REVISION,clip.id);
    const values=new Map();
    for(let i=0;i<48;i++){
      const pose=a.sampleComposedClip(clip,clip.duration*i/47,motion);
      for(const [control,value] of Object.entries(pose.scalars))if(control.startsWith('deform.')){
        assert.ok(Number.isFinite(value)&&value>=.54&&value<=1.76,`${clip.id}: unsafe ${control} ${value}`);
        const range=values.get(control)??[Infinity,-Infinity];
        range[0]=Math.min(range[0],value);range[1]=Math.max(range[1],value);values.set(control,range);
      }
    }
    assert.ok([...values.values()].some(([min,max])=>max-min>.001),`${clip.id}: no elastic motion`);
    for(const driver of clip.proceduralDrivers.filter(d=>d.id.includes(':elasticity:'))){
      const start=a.sampleProceduralDriverValue(driver,0,motion).value;
      const end=a.sampleProceduralDriverValue(driver,clip.duration,motion).value;
      assert.ok(Math.abs(start-end)<1e-9,`${clip.id}: nonseamless elasticity loop`);
    }
    for(const track of clip.tracks.filter(t=>t.id.includes(':elasticity:'))){
      assert.equal(track.keys[0].value,1);assert.equal(track.keys.at(-1).value,1);
    }
  }
  // Grip-sensitive arms are not length-modulated; the current hand/rope/ledge
  // contact solve retains ownership rather than having its targets pulled away.
  for(const id of ['player.crawl','player.grab','player.hang','player.climb','player.rope','player.rope-climb']){
    const clip=suite.clips.find(c=>c.id===id);
    assert.ok(!clip.proceduralDrivers.some(d=>d.id.includes(':elasticity:')&&d.target.target.startsWith('deform.arm')),id);
  }
  const old=structuredClone(suite);old.metadata.playerStarterCatalogVersion=30;
  for(const clip of old.clips){
    delete clip.metadata.elasticityRevision;delete clip.metadata.elasticityPrinciple;delete clip.metadata.elasticityProfile;
    clip.tracks=clip.tracks.filter(t=>!t.id.includes(':elasticity:'));
    clip.proceduralDrivers=clip.proceduralDrivers.filter(d=>!d.id.includes(':elasticity:'));
  }
  const edited=old.clips.find(c=>c.id==='player.idle');edited.playbackSpeed=2.3;
  edited.tracks.push({id:'my-torso',kind:'scalar',target:'deform.torso.length',keys:[{id:'a',time:0,value:.95,interpolation:'linear'},{id:'b',time:edited.duration,value:1.04,interpolation:'linear'}]});
  const migrated=a.reconcilePlayerStarterAnimationSuite(old,rig);
  for(const before of old.clips){
    const after=migrated.clips.find(c=>c.id===before.id);
    assert.equal(after.playbackSpeed,before.playbackSpeed);
    for(const track of before.tracks)assert.deepEqual(after.tracks.find(t=>t.id===track.id),track,'migration overwrote user motion');
  }
  assert.ok(!migrated.clips.find(c=>c.id===edited.id).proceduralDrivers.some(d=>d.target.target==='deform.torso.length'),'doubled the edited torso layer');
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(migrated,rig),migrated);
  const fresh=withCharacterElasticity(a.createAnimationClip({rigId:rig.id,name:'New Animation',duration:1}),rig);
  assert.ok(fresh.proceduralDrivers.length>0,'new Studio animations need the same core principle');

  // The old peaks/catch/rebound are actually present, and the procedural
  // modifier composes with authored deformation without accumulating per tick.
  assert.equal(SKATE_OLLIE_LENGTH_KEYS.legLower.rise[1][1],1.65);
  assert.equal(SKATE_OLLIE_LENGTH_KEYS.torso.rise.at(-1)[1],.78);
  assert.equal(SKATE_OLLIE_LENGTH_KEYS.torso.land[2][1],1.1);
  p.syncVisual(makeInput(),1/60);
  const bridge=p.playerAnimationBridge,base=p.elbowR.position.y,scale=p.armR.scale.clone();
  bridge.applyDeformations({'deform.arm.upper.left.length':1.2});
  bridge.modulateDeformations({'deform.arm.upper.left.length':.8});
  assert.ok(Math.abs(p.elbowR.position.y/base-.96)<1e-9);
  assert.deepEqual(p.armR.scale.toArray(),scale.toArray());
  bridge.prepareLegacyPose();assert.ok(Math.abs(p.elbowR.position.y-base)<1e-9);
  bridge.modulateDeformations({'deform.arm.upper.left.length':.9});
  assert.ok(Math.abs(p.elbowR.position.y/base-.9)<1e-9,'last frame factor accumulated');
  bridge.prepareLegacyPose();
  const elastic=new SkateOllieMotion();
  let previous=1,largestStep=0,peak=1,min=1;
  for(let frame=0;frame<100;frame++){
    const time=frame/60,pose=elastic.step(1/60,{active:true,grounded:frame>=42,verticalVelocity:11-time*33,launchVelocity:11,airborneSeconds:time,fallReferenceVelocity:20,time});
    const value=pose?.deformations['deform.leg.lower.left.length']??1;
    largestStep=Math.max(largestStep,Math.abs(value-previous));previous=value;peak=Math.max(peak,value);min=Math.min(min,value);
  }
  assert.ok(peak>1.5&&min<.85&&largestStep<.20,`ollie lost its strong, continuous elastic range: peak ${peak}, min ${min}, step ${largestStep}`);
  assert.equal(elastic.step(1/60,{active:false,grounded:true,verticalVelocity:0,launchVelocity:0,airborneSeconds:0,fallReferenceVelocity:20,reset:true}),null);
  console.log(`PASS all ${suite.clips.length} character clips have deformation; seamless loops, finite one-shots, grip protection, lossless/idempotent saved upgrade, new-clip defaults and nonaccumulating rig composition. Ollie shin ${min.toFixed(2)}–${peak.toFixed(2)}x.`);
});
