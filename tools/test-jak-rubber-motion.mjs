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
  const joints=['hips','spine','chest','shoulderLeft','shoulderRight','elbowLeft','elbowRight',
    'hipLeft','hipRight','kneeLeft','kneeRight'];
  for(const [name,hold,move,secondAt] of [['roll tap',3,1,null],['roll full',18,1,null],
    ['roll double early',18,1,2],['roll double late',18,1,-10],['upright double',35,0,-.1],['precision double',18,.2,-.1]]) {
    p.enterLevel('jak-rubber');p.respawn(level,true,true);p.freeSkate=false;
    p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};runtime.restart();
    const rows=[];let second=-1,previous=null;
    for(let f=0;f<240;f++) {
      const input={moveY:move,jumpPressed:f===50,jumpHeld:f>=50&&f<50+hold,jumpReleased:f===50+hold};
      if(secondAt!==null&&second<0&&f>50+hold&&!p.grounded&&p.vVel<secondAt){second=f;input.jumpPressed=input.jumpHeld=true;}
      if(second>=0&&f===second+1)input.jumpReleased=true;
      p.camDir.set(0,0,-1);p.step(1/60,makeInput(input),level);level.update(1/60);p.commitRenderStep(level);
      const pose=runtime.lastSampledPose,d=runtime.diagnostics;
      const angles=Object.fromEntries(joints.map(id=>[id,previous?new THREE.Quaternion().fromArray(previous.joints[id]?.quaternion??[0,0,0,1])
        .angleTo(new THREE.Quaternion().fromArray(pose.joints[id]?.quaternion??[0,0,0,1])):0]));
      rows.push({f,clip:runtime.activeClipId,time:d.timelineTime,blend:d.transitionBlendWeight,frame:p.footStudyFrame,
        air:!p.grounded,second:p.doubleJumpAir,angles,scalars:pose.scalars,
        hips:pose.joints.hips.quaternion,head:new THREE.Box3().setFromObject(p.meshyHead.mesh,true).max.y,
        physics:[...p.pos.toArray(),p.vVel],root:pose.joints.root.position});
      assert.ok(Object.values(pose.scalars).every(Number.isFinite));
      assert.deepEqual(p.riderG.scale.toArray(),[1,1,1],'rubber motion scaled the whole rider');
      assert.equal(p.freeSkate,false);previous=pose;
    }
    const air=rows.filter(r=>r.air),worst=air.flatMap(r=>Object.entries(r.angles).map(([joint,angle])=>
      ({f:r.f,clip:r.clip,time:r.time,joint,angle,previous:rows[r.f-1]?.clip}))).sort((a,b)=>b.angle-a.angle).slice(0,12);
    const ranges=Object.fromEntries(a.ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,[Math.min(...air.map(r=>r.scalars[id])),Math.max(...air.map(r=>r.scalars[id]))]]));
    const handoffs=rows.filter((r,i)=>i>0&&r.clip!==rows[i-1].clip).map(r=>({f:r.f,from:rows[r.f-1].clip,to:r.clip,
      hipAngle:r.angles.hips,rootStep:new THREE.Vector3().fromArray(r.root).distanceTo(new THREE.Vector3().fromArray(rows[r.f-1].root))}));
    const motionRows=rows.filter(r=>r.f>=50+hold&&r.clip!=='player.run'&&r.clip!=='player.idle');
    const maxMotionStep=Math.max(...motionRows.flatMap(r=>Object.values(r.angles)));
    if(!process.argv.includes('--measure')) {
      assert.ok(maxMotionStep<.55,`${name}: abrupt body/limb change ${maxMotionStep} rad`);
      if(name.startsWith('roll')) {
        assert.ok(ranges['deform.leg.lower.left.length'][0]<.86,'roll lost its compression');
        if(secondAt===null)assert.ok(ranges['deform.leg.lower.left.length'][1]>1.12,'roll lost its extension/rebound');
      }
      if(name==='roll double early')assert.ok(rows[second+1].angles.hips>.03,'double jump froze the interrupted rotation');
    }
    if(baseline)assert.deepEqual(rows.map(r=>r.physics),baseline.cases[cases.length].rows.map(r=>r.physics),
      `${name}: animation altered jump physics`);
    cases.push({name,second,worst,ranges,maxMotionStep,handoffs,rows});
  }
  runtime.dispose();console.log(JSON.stringify({cases},null,2));
},{levelEntry:{id:'jak-rubber',name:'Rubber motion',data:{v:1,name:'Rubber motion',spawn:[0,.02,0],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}}});
