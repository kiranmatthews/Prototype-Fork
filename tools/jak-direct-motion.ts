import * as THREE from 'three';
import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS, createProceduralMotionContext, sampleComposedClip, withCharacterElasticity } from '../src/animation';
import type { AnimationClip, AnimationSuiteDocument, AnimationTrack, RigDefinition, QuaternionTuple, Vec3Tuple } from '../src/animation';
import type { OnFootJumpStudy } from '../src/onFootJumpStudy';
import { JAK_LEDGE_MOTION, ledgeRebound } from '../src/animation/ledgeMotion';
import {createPancakeSlamClip} from '../src/animation/pancakeSlam';

type JointSample = {p: Vec3Tuple; q: QuaternionTuple};
type Frame = Record<string, JointSample>;
export interface JakMotionBank {
  version: number; fps: number; source: string; bind: Frame;
  clips: Record<string, {duration: number; frames: number; samples: Frame[]}>;
}
export const JAK_DIRECT_PHYSICS: Readonly<OnFootJumpStudy> = Object.freeze({
  // D supplies presentation only. The live tuner owns every movement value.
  nativePhysics: true, direct: true, nativeLocomotion: true,
});

// Source and destination both face +Z in rig space. The source bind has
// horizontal arms and differently oriented bones; copying local quaternions
// would twist the limbs. Align each bind segment, then transfer world motion
// and solve destination locals in hierarchy order. Only proportions differ.
const mapping: Record<string, string> = {
  hips:'hips',torsoRoot:'upper_body',spine:'upper_body',chest:'chest',neck:'neckA',head:'neckB',
  shoulderLeft:'Larm',elbowLeft:'Lforarm',wristLeft:'sk_lhand',
  shoulderRight:'Rarm',elbowRight:'Rforarm',wristRight:'sk_rhand',
  hipLeft:'Lthigh',kneeLeft:'Lknee',ankleLeft:'Lankle',
  hipRight:'Rthigh',kneeRight:'Rknee',ankleRight:'Rankle',
};
const segments: Record<string, [string,string,string]> = {
  shoulderLeft:['Larm','Lforarm','deform.arm.upper.left.length'],
  elbowLeft:['Lforarm','sk_lhand','deform.arm.lower.left.length'],
  shoulderRight:['Rarm','Rforarm','deform.arm.upper.right.length'],
  elbowRight:['Rforarm','sk_rhand','deform.arm.lower.right.length'],
  hipLeft:['Lthigh','Lknee','deform.leg.upper.left.length'],
  kneeLeft:['Lknee','Lankle','deform.leg.lower.left.length'],
  hipRight:['Rthigh','Rknee','deform.leg.upper.right.length'],
  kneeRight:['Rknee','Rankle','deform.leg.lower.right.length'],
};
const v=(p:number[])=>new THREE.Vector3().fromArray(p);
const q=(p:number[])=>new THREE.Quaternion().fromArray(p).normalize();
const vector=(f:Frame,a:string,b:string)=>v(f[b].p).sub(v(f[a].p));

// Align the complete stride, rather than one convenient frame: opposing
// foot phases would cancel the knee lift when the two cycles are blended.
function nativeRunPhase(native:AnimationClip, direct:AnimationClip):number {
  const motion=createProceduralMotionContext({normalizedSpeed:1});
  const count=64, legs=['hipLeft','hipRight','kneeLeft','kneeRight','ankleLeft','ankleRight'];
  const samples=(clip:AnimationClip)=>Array.from({length:count},(_,i)=>
    sampleComposedClip(clip,clip.range.start+i/count*(clip.range.end-clip.range.start),motion));
  const a=samples(native),d=samples(direct);
  let best=Infinity,offset=0;
  for(let shift=0;shift<count;shift++) {
    let score=0;
    for(let i=0;i<count;i++)for(const id of legs) {
      const qa=q(a[(i+shift)%count].joints[id]?.quaternion??[0,0,0,1]);
      const qd=q(d[i].joints[id]?.quaternion??[0,0,0,1]);
      score+=(id.startsWith('hip')?2:1)*(1-Math.abs(qa.dot(qd)));
    }
    if(score<best){best=score;offset=shift/count;}
  }
  return offset;
}

export function createJakDirectSuite(base:AnimationSuiteDocument, rig:RigDefinition, bank:JakMotionBank):AnimationSuiteDocument {
  if(bank.version!==1 || bank.fps!==60 || !bank.clips.jump)throw new Error('Unsupported local Jak motion bank');
  const suite=structuredClone(base);
  const nativeRun=structuredClone(base.clips.find(clip=>clip.id==='player.run')!);
  nativeRun.id='player.jak-native-run';
  nativeRun.name='D · Bone Man run blend reference';
  suite.clips.push(nativeRun);
  // Special launches (including an earned double jump after a crate bounce)
  // keep Bone Man's native air clocks rather than a stale on-foot Jak clock.
  for(const name of ['jump','fall','double-jump']) {
    const native=structuredClone(base.clips.find(clip=>clip.id===`player.${name}`)!);
    native.id=`player.native-air-${name}`;
    native.name=`Bone Man · Native ${name}`;
    suite.clips.push(native);
  }
  const neutral=bank.clips['stance-loop'].samples[0];
  const definitions=new Map(rig.joints.map(j=>[j.id,j]));
  const correction=new Map<string,THREE.Quaternion>();
  for(const [id,source] of Object.entries(mapping)) {
    const restDirection=segments[id] ? vector(bank.bind,segments[id][0],segments[id][1]).normalize() : null;
    const align=restDirection?new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),restDirection):new THREE.Quaternion();
    // Hands inherit the calibrated forearm frame; keep source wrist flex/twist.
    if(id.startsWith('wrist')) {
      const s=id.endsWith('Left')?'Left':'Right', seg=segments[`elbow${s}`];
      align.setFromUnitVectors(new THREE.Vector3(0,-1,0),vector(bank.bind,seg[0],seg[1]).normalize());
    }
    correction.set(id,q(bank.bind[source].q).invert().multiply(align));
  }
  const targetLegLength=Math.abs(definitions.get('kneeLeft')!.rest.position[1])+Math.abs(definitions.get('ankleLeft')!.rest.position[1]);
  const sourceLegLength=vector(neutral,'Lthigh','Lknee').length()+vector(neutral,'Lknee','Lankle').length();
  const legRatio=targetLegLength/sourceLegLength;
  const targetAnkleY=definitions.get('hips')!.rest.position[1]-targetLegLength;
  const neutralAnkleY=Math.min(neutral.Lankle.p[1],neutral.Rankle.p[1]);
  const waistRatio=v(definitions.get('spine')!.rest.position).length()/vector(neutral,'hips','upper_body').length();
  const retarget=(frame:Frame, rootMode='feet', phase=0, locomotion=false)=>{
    const locals:Record<string,QuaternionTuple>={}, positions:Record<string,THREE.Vector3>={}, worlds:Record<string,THREE.Quaternion>={};
    const lengths:Record<string,number>={}, translations:Record<string,Vec3Tuple>={};
    for(const [, [a,b,control]] of Object.entries(segments))
      lengths[control]=vector(frame,a,b).length()/vector(neutral,a,b).length();
    lengths['deform.torso.length']=vector(frame,'upper_body','neckA').length()/vector(neutral,'upper_body','neckA').length();
    for(const joint of rig.joints) {
      const parentQ=joint.parentId?worlds[joint.parentId]:new THREE.Quaternion();
      const parentP=joint.parentId?positions[joint.parentId]:new THREE.Vector3();
      const source=mapping[joint.id];
      let desired=source?q(frame[source].q).multiply(correction.get(joint.id)!):parentQ.clone().multiply(q(joint.rest.quaternion));
      if(segments[joint.id]) {
        const [a,b]=segments[joint.id];
        const expected=new THREE.Vector3(0,-1,0).applyQuaternion(desired);
        desired.premultiply(new THREE.Quaternion().setFromUnitVectors(expected,vector(frame,a,b).normalize()));
      }
      worlds[joint.id]=desired;
      const local=q(joint.rest.quaternion).invert().multiply(parentQ.clone().invert().multiply(desired));
      if(source || ['root','torsoRoot','clavicleLeft','clavicleRight','toeLeft','toeRight'].includes(joint.id))locals[joint.id]=local.toArray() as QuaternionTuple;
      const offset=v(joint.rest.position);
      // The source waist also translates as it compresses. Bone Man's lower
      // spine is a separate segment; carry that motion without scaling its
      // skeleton or forcing the upper chest's length onto the lower back.
      if(joint.id==='spine') {
        const waist=vector(frame,'hips','upper_body').multiplyScalar(waistRatio);
        if(locomotion) {
          // Jak's waist stretches to twice its stance length in the run.
          // Bone Man's separate lower spine already fills the waist; retain
          // the bend and a restrained elastic pulse within that segment.
          const rest=v(joint.rest.position).length();
          waist.setLength(rest*THREE.MathUtils.clamp(1+(waist.length()/rest-1)*.25,.85,1.18));
        }
        offset.copy(waist.applyQuaternion(parentQ.clone().invert()));
        translations.spine=offset.clone().sub(v(joint.rest.position)).toArray() as Vec3Tuple;
      }
      const parentSegment=joint.parentId?segments[joint.parentId]:null;
      if(parentSegment)offset.multiplyScalar(lengths[parentSegment[2]]);
      if(['chest','neck','clavicleLeft','clavicleRight'].includes(joint.id))offset.y*=lengths['deform.torso.length'];
      positions[joint.id]=offset.applyQuaternion(parentQ).add(parentP);
    }
    // Match the source's foot lift while retaining this character's lengths.
    // This includes the authored landing compression and subsequent rebound.
    const sourceFloor=Math.min(frame.Lankle.p[1],frame.Rankle.p[1]);
    const rootY=targetAnkleY+(sourceFloor-neutralAnkleY)*legRatio-
      Math.min(positions.ankleLeft.y,positions.ankleRight.y);
    const root:Vec3Tuple=[frame.main.p[0]*legRatio,rootY,frame.main.p[2]*legRatio];
    if(rootMode==='flip') {
      // The gameplay arc carries the hips. Copying the rolling clip's root
      // would add a second trajectory and make the feet orbit the floor.
      root.splice(0,3,0,0,0);
    } else if(rootMode==='hands' || rootMode==='release' || rootMode==='climb') {
      // Contact-relative retargeting preserves the catch's pendulum/squash.
      // Final world-space glove contacts adapt to the live lip/proportions.
      const centre=positions.wristLeft.clone().add(positions.wristRight).multiplyScalar(.5);
      const handRoot=new THREE.Vector3(0,1.25,.35).sub(centre);
      if(rootMode==='release')handRoot.lerp(v(root),THREE.MathUtils.smoothstep(phase,.35,1));
      if(rootMode==='climb')handRoot.lerp(v(root),THREE.MathUtils.smoothstep(phase,.45,1));
      root.splice(0,3,...handRoot.toArray());
    }
    return {locals,lengths,translations,root};
  };
  const specs:[string,string,boolean][]=[
    // Idle stays identical to A/B/C, including its native neutral-arm layer.
    ['player.run','run',true],['player.walk','walk',true],
    // Keep Bone Man's momentum-driven brake and finite settle. Jak's eight
    // second pacing sequence fights this controller's short coast/restart.
    ['player.jump','jump',false],
    ['player.double-jump','jump',false],['player.fall','jump-loop',true],
    ['player.land','jump-land',false],['player.jak-run-land','run-squash',false],
    ['player.jak-run-land-weak','run-squash-weak',false],['player.jak-jump-forward','jump-forward',false],
    ['player.jak-short-land','jump-short-land',false],
    ['player.jak-soft-land','jump-land',false],
    ['player.jak-flip','wheel-flip',false],['player.jak-flip-land','wheel-flip-land',false],
    ['player.jak-ledge-catch','falling-to-edge-grab',false],
    ['player.jak-ledge-left','edge-grab-swing-left',false],
    ['player.jak-ledge-right','edge-grab-swing-right',false],
    ['player.hang','edge-grab-stance0',true],['player.jak-hang-shift','edge-grab-stance1',true],
    ['player.climb','edge-grab-to-jump',false],['player.jak-ledge-off','edge-grab-off',false],
  ];
  for(const [id,name,loop] of specs) {
    const source=bank.clips[name];
    if(!source)throw new Error(`Missing ${name}; rerun tools/extract-jak-motion.mjs on the local GLB`);
    const shortTail=id==='player.jak-short-land'?bank.clips['jump-land']:null;
    const startFrame=id==='player.jak-soft-land'?50:0;
    const reference=shortTail?{...source,duration:(source.frames+shortTail.frames-50)/60,
      samples:[...source.samples.slice(0,source.frames),...shortTail.samples.slice(50)]}
    :startFrame?{...source,duration:source.duration-startFrame/60,samples:source.samples.slice(startFrame)}:source;
    const original=suite.clips.find(c=>c.id===id)??suite.clips.find(c=>c.id==='player.land')!;
    const tracks:AnimationTrack[]=[];
    const ledge=name.includes('edge-grab');
    const catchMotion=['player.jak-ledge-catch','player.jak-ledge-left','player.jak-ledge-right'].includes(id);
    const timeScale=catchMotion?JAK_LEDGE_MOTION.catchTimeScale:1;
    const duration=reference.duration*timeScale;
    const keyTime=(i:number)=>Math.min(reference.duration,i/60)*timeScale;
    const rootMode=id==='player.jak-flip'?'flip':id==='player.jak-ledge-off'?'release':id==='player.climb'?'climb':ledge?'hands':'feet';
    const locomotion=['player.run','player.walk','player.jak-run-land','player.jak-run-land-weak'].includes(id);
    const poses=reference.samples.map((frame,i)=>retarget(frame,rootMode,i/Math.max(1,reference.samples.length-1),locomotion));
    if(catchMotion) {
      const rest=retarget(bank.clips['edge-grab-stance0'].samples[0],'hands');
      const amplitudes=characterElasticityAmplitudes('jak-ledge-catch');
      poses.forEach((pose,i)=>{
        const phase=i/Math.max(1,poses.length-1), settle=THREE.MathUtils.smoothstep(phase,.62,1);
        for(const joint of Object.keys(pose.locals))pose.locals[joint]=q(pose.locals[joint]).slerp(q(rest.locals[joint]),settle).toArray() as QuaternionTuple;
        for(const joint of Object.keys(pose.translations))pose.translations[joint]=v(pose.translations[joint]).lerp(v(rest.translations[joint]),settle).toArray() as Vec3Tuple;
        pose.root=v(pose.root).lerp(v(rest.root),settle).toArray() as Vec3Tuple;
        for(const control of Object.keys(pose.lengths))pose.lengths[control]=THREE.MathUtils.lerp(pose.lengths[control],rest.lengths[control],settle);
        const pulse=ledgeRebound((phase-.52)/.48);
        for(const [control,part] of ELASTIC_LENGTH_CONTROLS)pose.lengths[control]*=1+amplitudes[part]*pulse;
      });
    }
    if(id==='player.jak-flip') {
      // The source ends 23 degrees short of upright, expecting its ground
      // recovery to finish the turn. Distribute that correction across the
      // second half: a last-six-key correction accelerates into the finish.
      const open=q(retarget(neutral,'flip').locals.hips);
      const finish=q(poses[poses.length-1].locals.hips).invert().multiply(open);
      const turns=poses.map(pose=>q(pose.locals.hips));
      const releaseIndex=Math.round((poses.length-1)*.60);
      const tucked=structuredClone(poses[releaseIndex]), extended=poses[poses.length-1];
      for(let i=0;i<poses.length;i++) {
        const phase=i/(poses.length-1);
        const weight=THREE.MathUtils.smoothstep(phase,.52,1);
        // Ease the source clock to zero velocity at the upright key. Its
        // original ground-roll exit otherwise stops a moving airborne hip.
        const tail=THREE.MathUtils.clamp((phase-.70)/.30,0,1);
        const turnPhase=phase+.30*tail*tail*(1-tail);
        const turnFrame=turnPhase*(poses.length-1), lo=Math.floor(turnFrame), hi=Math.min(lo+1,poses.length-1);
        poses[i].locals.hips=turns[lo].clone().slerp(turns[hi],turnFrame-lo)
          .multiply(new THREE.Quaternion().slerp(finish,weight)).toArray() as QuaternionTuple;
        if(i>releaseIndex) {
          // The short native jump arc compresses the source's late untuck to
          // just a few ticks. Open the limbs progressively during the final
          // third of the revolution instead of holding the ball then snapping.
          const release=THREE.MathUtils.smootherstep(i,releaseIndex,poses.length-1);
          for(const joint of Object.keys(poses[i].locals))if(joint!=='hips')
            poses[i].locals[joint]=q(tucked.locals[joint]).slerp(q(extended.locals[joint]),release).toArray() as QuaternionTuple;
          for(const joint of Object.keys(poses[i].translations))
            poses[i].translations[joint]=v(tucked.translations[joint]).lerp(v(extended.translations[joint]),release).toArray() as Vec3Tuple;
        }
      }
    }
    const elasticProfile=id==='player.jak-flip'?'jak-flip':id==='player.double-jump'?'jak-double-jump':null;
    if(elasticProfile) {
      const amplitudes=characterElasticityAmplitudes(elasticProfile);
      const beats=id==='player.jak-flip'?[[0,0],[.10,.65],[.26,-.9],[.58,-.65],[.76,.9],[.86,.9],[.95,-.10],[1,0]]
        :[[0,0],[5/40,-.28],[9/40,1],[14/40,-.65],[22/40,.25],[34/40,0],[1,0]];
      for(let i=0;i<poses.length;i++) {
        const phase=i/Math.max(1,poses.length-1);
        const index=Math.max(1,beats.findIndex(b=>b[0]>=phase));
        const [from,to]=[beats[index-1],beats[index]];
        const pulse=THREE.MathUtils.lerp(from[1],to[1],THREE.MathUtils.smoothstep(phase,from[0],to[0]));
        for(const [control,part] of ELASTIC_LENGTH_CONTROLS)poses[i].lengths[control]*=1+amplitudes[part]*pulse;
      }
    }
    for(const target of Object.keys(poses[0].locals))tracks.push({id:`${id}:${target}:source`,kind:'quaternion',target,
      keys:poses.map((pose,i)=>({id:`${id}:${target}:${i}`,time:keyTime(i),value:pose.locals[target],interpolation:'linear'}))});
    tracks.push({id:`${id}:root:source`,kind:'position',target:'root',keys:poses.map((pose,i)=>({id:`${id}:root:p${i}`,time:keyTime(i),value:pose.root,interpolation:'linear'}))});
    for(const target of Object.keys(poses[0].translations))tracks.push({id:`${id}:${target}:position:source`,kind:'position',target,
      keys:poses.map((pose,i)=>({id:`${id}:${target}:p${i}`,time:keyTime(i),value:pose.translations[target],interpolation:'linear'}))});
    for(const target of Object.keys(poses[0].lengths))tracks.push({id:`${id}:${target}:source`,kind:'scalar',target,
      keys:poses.map((pose,i)=>({id:`${id}:${target}:${i}`,time:keyTime(i),value:pose.lengths[target],interpolation:'linear'}))});
    // Transfer Bone Man's cycle cadence, not raw foot velocity. Its animation
    // intent keeps strides alive as physical momentum crosses zero in a turn.
    const playbackSpeed=id==='player.run'||id==='player.walk'
      ? original.playbackSpeed*reference.duration/(original.range.end-original.range.start) : 1;
    const clip:AnimationClip=withCharacterElasticity({...original,id,name:`D · Jak ${name} (direct retarget)`,duration,
      playbackSpeed,range:{start:0,end:duration},loop:{...original.loop,mode:loop?'loop':'once'},
      tracks,proceduralDrivers:[],contacts:[],events:[],markers:[],
      metadata:{jakDirect:true,jakSourceClip:name,jumpReferenceRevision:1,jakRootMode:rootMode,
        ...(ledge?{jakLedge:true}:{}),
        ...(catchMotion?{jakSourceTimeScale:timeScale,jakLedgeSettle:true,elasticityProfile:'jak-ledge-catch'}:{}),
        ...(id==='player.climb'?{elasticityProfile:'jak-ledge-climb'}:{}),
        ...(shortTail?{jakSourceTailClip:'jump-land',jakSourceTailAt:source.frames,jakSourceTailFrame:50}:{}),
        ...(startFrame?{jakSourceStartFrame:startFrame}:{}),
        referenceStudy:'Direct local source sample retarget; source data excluded from Git and production'},
    },rig);
    const profile=elasticProfile??(catchMotion?'jak-ledge-catch':id==='player.climb'?'jak-ledge-climb':null);
    if(profile)clip.metadata={...clip.metadata,elasticityProfile:profile};
    if(id==='player.run') {
      clip.name='D · Bone Man / Jak run (50/50)';
      clip.metadata={...clip.metadata,jakNativeRunClip:nativeRun.id,jakNativeRunWeight:.5,
        jakNativeRunPhase:nativeRunPhase(nativeRun,clip)};
    }
    const index=suite.clips.findIndex(c=>c.id===id);if(index>=0)suite.clips[index]=clip;else suite.clips.push(clip);
  }
  suite.clips=suite.clips.map(clip=>clip.id==='player.slam'?createPancakeSlamClip(clip,rig):clip);
  return suite;
}
