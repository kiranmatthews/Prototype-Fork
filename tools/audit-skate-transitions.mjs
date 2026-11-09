import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const [file,out]=process.argv.slice(2);
if(!file||!out)throw new Error('Usage: node tools/audit-skate-transitions.mjs replay.json report.json');
const replay=JSON.parse(await readFile(file,'utf8'));
if(replay.level!=='codex-lab')throw new Error('This replay audit uses the Haunted Hassle source level (codex-lab).');
const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withBlockworksRuntime(async r=>{
  const {Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
  const {PlayableSkateMotion}=await r.server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await r.server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await r.server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await r.server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const p=r.p,binding=RigBinding.fromSculptRuntime(p.animationRig.root);
  p.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
  const runtime=createCharacterAnimationRuntime(p,createJakDirectSuite(createPlayerStarterAnimationSuite(binding.definition),binding.definition,jak));
  const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
  const joints=['hips','hipLeft','hipRight','kneeLeft','kneeRight','ankleLeft','ankleRight'];
  const node=id=>p.animationRig.jointsById.get(id).node;
  const point=id=>node(id).getWorldPosition(new r.THREE.Vector3());
  const snapshot=()=>({
    joints:Object.fromEntries(joints.map(id=>[id,node(id).quaternion.toArray()])),
    hips:node('hips').getWorldQuaternion(new r.THREE.Quaternion()).toArray(),
    chest:node('chest').getWorldQuaternion(new r.THREE.Quaternion()).toArray(),
    lead:point('ankleRight').sub(point('ankleLeft')).dot(p.axisF),
    feet:['Left','Right'].map(side=>point(`ankle${side}`).sub(p.pos).toArray()),
    bodyYaw:p.bodyGroup.rotation.y,
  });
  let native,previous;
  const update=motion.update.bind(motion);
  motion.update=context=>{native=snapshot();update(context);};
  const take=new Replayer(),input={},rows=[],events=[];
  take.begin(replay);
  try{for(let f=0;f<replay.frames;f++){
    take.feed(input,p.camDir);r.tick(input);
    const pose=snapshot(),quat=a=>new r.THREE.Quaternion().fromArray(a);
    const state=motion.phase+'/'+motion.diagnostics.nativeOwner+'/'+p.stance;
    if(!previous||state!==previous.state)events.push({f,state,source:motion.sourceName,clip:runtime.activeClipId});
    const legStep=previous?Math.max(...joints.slice(1).map(id=>quat(pose.joints[id]).angleTo(quat(previous.pose.joints[id])))):0;
    const nativeLegStep=previous?Math.max(...joints.slice(1).map(id=>quat(native.joints[id]).angleTo(quat(previous.native.joints[id])))):0;
    const row={f,state,source:motion.sourceName,sourceTime:motion.time,diagnostics:motion.diagnostics,
      clip:runtime.activeClipId,clipTime:runtime.diagnostics.timelineTime,stance:p.stance,deckYaw:p.deckYawOffset,
      visualYaw:p.visualYaw,axis:p.axisF.toArray(),speed:p.speed,footSpeed:p.walkVelocity.length(),grounded:p.grounded,
      mounted:p.freeSkate,charging:p.charging,input:{x:input.moveX,y:input.moveY,jump:input.jumpHeld,spin:input.spinHeld},
      pose,native,legStep,nativeLegStep,hipStep:previous?quat(pose.hips).angleTo(quat(previous.pose.hips)):0,
      physics:[...p.pos.toArray(),p.vVel,p.speed,...p.walkVelocity.toArray(),p.stance,p.state,p.freeSkate,p.grounded]};
    rows.push(row);previous=row;
  }}finally{take.end();motion.dispose();runtime.dispose();}
  const largestTurns=[...rows].sort((a,b)=>b.hipStep-a.hipStep).slice(0,20)
    .map(({f,state,hipStep,source,stance,speed,footSpeed,visualYaw})=>({f,state,hipStep,source,stance,speed,footSpeed,visualYaw}));
  // Small IK movements can make frozen pickup legs look "animated" in a
  // quaternion-delta check. Compare their actual contacts to the live gait.
  let walkingSince=-1;const gait=[];
  for(const row of rows){
    if(!row.state.startsWith('dismount/')){walkingSince=-1;continue;}
    if(row.sourceTime>=.4&&row.footSpeed>.15&&walkingSince<0)walkingSince=row.f;
    if(walkingSince<0||row.f-walkingSince<13)continue;
    gait.push({f:row.f,error:Math.max(...row.pose.feet.map((foot,i)=>
      Math.hypot(...foot.map((v,j)=>v-row.native.feet[i][j]))))});
  }
  const dismounts=events.filter(e=>e.state.startsWith('dismount/')).map(e=>({f:e.f,hipStep:rows[e.f].hipStep}));
  const summary={frames:rows.length,events,largestTurns,dismounts,gaitFrames:gait.length,
    maxGaitError:Math.max(0,...gait.map(g=>g.error)),unmatchedGaitFrames:gait.filter(g=>g.error>.005).map(g=>g.f)};
  await writeFile(out,JSON.stringify({replay:file,...summary,rows}));
  console.log(JSON.stringify(summary,null,2));
},{levelId:'codex-lab',endlessDeaths:replay.endlessDeaths,maxFrames:replay.frames+1});
