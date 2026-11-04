import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=JSON.parse(await readFile(process.argv[2],'utf8'));
const baselineArg=process.argv.indexOf('--baseline');
let baseline;
if(baselineArg>=0) {
  const raw=await readFile(process.argv[baselineArg+1],'utf8'),end=raw.lastIndexOf('\n{"exitCode"');
  baseline=JSON.parse(raw.slice(raw.indexOf('{\n'),end>=0?end:undefined));
}
await withSkateRuntime(async({server,player:p,level,THREE})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const binding=a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite=createJakDirectSuite(a.createPlayerStarterAnimationSuite(binding.definition),binding.definition,bank);
  const runtime=createCharacterAnimationRuntime(p,suite),cases=[];
  const point=id=>binding.joints.get(id).getWorldPosition(new THREE.Vector3());
  for(const hold of [3,18,35])for(const flip of [false,true])for(const timing of [2,-.1,-10]) {
    p.enterLevel('jak-double');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip};runtime.restart();
    let pressed=-1,second=-1,apex=-1,previous=null;const rows=[];
    for(let f=0;f<200;f++) {
      const input={moveY:hold===35?0:1,jumpPressed:f===30,jumpHeld:f>=30&&f<30+hold,jumpReleased:f===30+hold};
      if(f>30+hold&&!p.grounded&&pressed<0&&p.vVel<timing){pressed=f;input.jumpPressed=input.jumpHeld=true;}
      if(f===pressed+1)input.jumpReleased=true;
      p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
      if(p.doubleJumpAir&&second<0)second=f;
      if(second>=0&&apex<0&&p.vVel<=0)apex=f;
      const pose=binding.capturePose(),head=new THREE.Box3().setFromObject(p.meshyHead.mesh,true).max.y;
      const row={f,age:second<0?null:f-second,clip:runtime.activeClipId,time:runtime.diagnostics.timelineTime,
        frame:p.footStudyFrame,pos:p.pos.toArray(),v:p.vVel,hips:point('hips').y,head,
        chest:point('chest').y,torso:pose.scalars?.['deform.torso.length'],
        hipAngle:previous?new THREE.Quaternion().fromArray(pose.joints.hips.quaternion).angleTo(new THREE.Quaternion().fromArray(previous.joints.hips.quaternion)):0};
      rows.push(row);previous=pose;
    }
    assert.ok(second>0&&apex>second,`double launch did not execute: ${JSON.stringify({hold,flip,timing,pressed,second,apex,skate:p.freeSkate})}`);
    const start=rows[second-1],rise=rows.slice(second,apex+1),early=rows.slice(second,second+6);
    const result={hold,flip,timing,second,apex,riseFrames:apex-second,
      hipRise3:rows[second+2].hips-start.hips,headRise3:rows[second+2].head-start.head,
      minHipStep:Math.min(...early.map((r,i)=>r.hips-rows[second+i-1].hips)),
      minHeadStep:Math.min(...early.slice(0,4).map((r,i)=>r.head-rows[second+i-1].head)),
      maxAngle:Math.max(...rows.slice(second,second+9).map(r=>r.hipAngle)),
      headPeak:Math.max(...rise.map(r=>r.head)),physics:rows.map(r=>[...r.pos,r.v]),
      rows:rows.slice(second-2,second+22)};
    cases.push(result);
    if(!process.argv.includes('--measure')) {
      assert.ok(result.headRise3>.3,'double jump has no immediate visible upward accent');
      assert.ok(result.minHeadStep>0,'head dips during the second takeoff');
      assert.ok(result.minHipStep>.03,'body stalls during the second takeoff');
      assert.ok(result.maxAngle<.65,'interrupted flip snaps upright');
    }
    if(baseline)assert.deepEqual(result.physics,baseline.cases[cases.length-1].physics,
      'presentation polish changed gameplay movement');
  }
  runtime.dispose();
  console.log(JSON.stringify({cases},null,2));
},{levelEntry:{id:'jak-double',name:'Double jump',data:{v:1,name:'Double jump',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}}});
