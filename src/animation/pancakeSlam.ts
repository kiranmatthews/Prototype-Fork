import * as THREE from 'three';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS,CHARACTER_ELASTICITY_REVISION} from './elasticity';
import {sampleQuaternionKeys} from './sampling';
import type {AnimationClip,AnimationTrack,QuaternionKeyframe,RigDefinition,QuaternionTuple} from './types';

/** Three gameplay clocks drive one timeline. The hang plays `0..hang`; the
 * drop plays `hang..groundStart` and holds there for a long fall; the first
 * contact starts `groundStart..duration`, which is also the control lock.
 *
 * The keys below are written on a brisk authoring clock (`HANG`, `GROUND`,
 * `g(age)`) and then stretched onto the floaty playback clock: the hang, the
 * start of the drop and the whole recovery run slow, while the splat itself
 * keeps its speed. */
const HANG=.32,GROUND=.44;
const g=(age:number)=>GROUND+age;
const FLOAT={hang:.55/HANG,drop:1.6,splat:.045,recovery:(1.15-.045)/(.70-.045)} as const;
const playbackHang=HANG*FLOAT.hang,playbackGround=playbackHang+(GROUND-HANG)*FLOAT.drop;
/** Authoring time to playback time. */
const float=(time:number)=>time<=HANG?time*FLOAT.hang:time<=GROUND?playbackHang+(time-HANG)*FLOAT.drop
  :playbackGround+Math.min(time-GROUND,FLOAT.splat)+Math.max(0,time-GROUND-FLOAT.splat)*FLOAT.recovery;
const RECOVERY=float(g(.70))-playbackGround;
export const PANCAKE_SLAM = {hang:playbackHang,groundStart:playbackGround,recovery:RECOVERY,
  /** Seconds the plummet takes to reach its unchanged peak speed. */
  dropRamp:.16,
  coil:float(.115),dive:float(.22),rebound:float(g(.08)),flatEnd:float(g(.125)),roll:float(g(.255)),
  feetDown:float(g(.385)),crouch:float(g(.43)),spring:float(g(.56)),settle:float(g(.63)),duration:float(g(.70)),
  /** Seconds the arms and torso keep settling over live locomotion once control returns. */
  tail:.6} as const;

// Degrees unless noted. `pelvis`/`back` are root height/setback in rig units;
// `torso`/`arms`/`legs` are signed loads on the shared elasticity profiles;
// `plant` levels the soles once they land and `toes` is their heel lift.
type Channel='pelvis'|'back'|'hips'|'spine'|'chest'|'neck'|'armPitch'|'armRoll'|'armSweep'|'elbow'
  |'thigh'|'splay'|'knee'|'ankle'|'plant'|'toes'|'torso'|'arms'|'legs';
/** `out` leaves a key at speed (an impact), `in` arrives at speed and stops
 * dead (a slap), `hit` does both (a bounce). Everything else eases. */
type Key=readonly [time:number,value:number,mode?:'in'|'out'|'hit'];

// One list per channel, each an eased curve through its own extremes: recoil
// past the coil, drift through the hang, whip into the dive, splat, rebound,
// gather back, roll, rock onto the feet, spring past standing and settle.
// Separate timing per channel is what lets limbs and head overlap the torso.
const KEYS:Record<Channel,readonly Key[]>={
  // The support solve seats the grounded body; these heights cover the hang,
  // the drop and unsupported or steep contact.
  pelvis:[[0,.78],[.065,.84],[.115,.79],[.22,.805],[.265,.78],[.30,.70],[HANG,.64],[.37,.52],[GROUND,.49,'out'],[g(.03),.10],
    [g(.125),.10],[g(.205),.34],[g(.255),.60],[g(.345),.26],[g(.385),.27],[g(.43),.50],[g(.47),.62],[g(.56),.80],[g(.63),.74],
    [g(.70),.775]],
  // The gather pulls the pelvis back off the hands; the roll turns there and
  // the rise carries it forward again over the planted soles.
  back:[[g(.11),0],[g(.205),-.20],[g(.30),-.22],[g(.385),-.27],[g(.43),-.24],[g(.47),-.20],[g(.56),-.05],[g(.70),-.03]],
  // The dive peaks before the hang ends and eases on through the drop.
  hips:[[0,-4],[.065,-38],[.115,-27],[.22,-34],[.265,8],[.30,52],[HANG,72],[.345,88],[.37,96],[GROUND,91,'out'],[g(.03),89.5],
    [g(.08),88.5],[g(.125),90],[g(.16),99],[g(.205),122],[g(.255),180],[g(.30),245],[g(.345),300],[g(.385),338],[g(.43),362],
    [g(.47),370],[g(.56),355],[g(.63),361.5],[g(.70),360]],
  spine:[[0,0],[.065,-9],[.115,-5],[.22,-8],[.27,8],[HANG,5],[.37,-2],[GROUND,0,'out'],[g(.03),3],[g(.08),-7],[g(.125),0],
    [g(.19),24],[g(.255),32],[g(.30),30],[g(.345),22],[g(.385),14],[g(.43),18],[g(.47),14],[g(.56),-6],[g(.63),2],[g(.70),0]],
  chest:[[0,-2],[.065,-15],[.115,-9],[.22,-13],[.27,14],[HANG,6],[.37,-5],[GROUND,-6,'out'],[g(.03),4],[g(.08),-16],[g(.125),-2],
    [g(.19),38],[g(.255),48],[g(.30),46],[g(.345),36],[g(.385),24],[g(.43),26],[g(.47),18],[g(.56),-10],[g(.63),3],[g(.70),0]],
  neck:[[0,6],[.065,14],[.115,32],[.22,36],[.27,10],[HANG,-22],[.37,-38],[GROUND,-40,'out'],[g(.035),-24],[g(.09),-48],
    [g(.135),-34],[g(.19),36],[g(.255),52],[g(.30),48],[g(.345),20],[g(.385),-4],[g(.43),-16],[g(.47),-12],[g(.545),10],
    [g(.60),-8],[g(.65),3],[g(.70),0]],
  armPitch:[[0,-40],[.065,-150],[.115,-135],[.22,-142],[HANG,-70],[.37,-10],[GROUND,0],[g(.03),2],[g(.125),2],[g(.205),-45],
    [g(.255),-70],[g(.30),-74],[g(.345),-60],[g(.39),5],[g(.435),52],[g(.47),60],[g(.56),-28],[g(.63),10],[g(.70),0]],
  armRoll:[[0,40],[.065,96],[.115,80],[.22,86],[HANG,128],[.37,120],[GROUND,118],[g(.03),112],[g(.08),115],[g(.125),112],
    [g(.205),62],[g(.255),24],[g(.30),24],[g(.345),26],[g(.39),30],[g(.47),34],[g(.56),64],[g(.635),4],[g(.70),10]],
  // Arms and legs trail above the falling torso, slap down after it and bounce.
  armSweep:[[.22,0],[HANG,6],[.37,22],[GROUND,27],[g(.03),-3,'hit'],[g(.08),12],[g(.13),0]],
  elbow:[[0,-45],[.065,-12],[.115,-38],[.22,-46],[HANG,-12],[.37,-18],[GROUND,-20],[g(.03),-4,'in'],[g(.08),-16],[g(.125),-5],
    [g(.205),-95],[g(.255),-105],[g(.30),-100],[g(.345),-80],[g(.39),-50],[g(.47),-35],[g(.56),-22],[g(.63),-18],[g(.70),-12]],
  thigh:[[0,-40],[.065,-72],[.115,-88],[.22,-95],[.27,-55],[HANG,4],[.37,12],[GROUND,14],[g(.035),-1,'hit'],[g(.085),10],
    [g(.13),1],[g(.17),-58],[g(.215),-112],[g(.255),-130],[g(.30),-130],[g(.345),-122],[g(.385),-118],[g(.43),-97],
    [g(.47),-80],[g(.56),-3],[g(.63),-13],[g(.70),0]],
  splay:[[0,14],[.065,20],[.115,24],[.22,25],[HANG,22],[.37,25],[GROUND,26],[g(.04),30],[g(.125),29],[g(.205),16],[g(.255),8],
    [g(.345),10],[g(.385),14],[g(.47),14],[g(.56),8],[g(.70),6]],
  knee:[[0,70],[.065,108],[.115,126],[.22,133],[.27,100],[HANG,22],[.37,25],[GROUND,26],[g(.045),4,'hit'],[g(.09),24],
    [g(.135),6],[g(.18),92],[g(.225),140],[g(.26),152],[g(.30),152],[g(.345),146],[g(.385),140],[g(.43),120],[g(.47),98],
    [g(.56),3],[g(.63),22],[g(.70),6]],
  ankle:[[0,-10],[.065,-28],[.115,-35],[.22,-36],[HANG,50],[.37,66],[GROUND,70],[g(.04),80],[g(.09),66],[g(.135),78],
    [g(.205),10],[g(.26),-20]],
  plant:[[g(.34),0],[g(.385),1]],
  toes:[[g(.345),10],[g(.40),0],[g(.50),0],[g(.56),18],[g(.615),0]],
  torso:[[0,0],[.065,.4],[.115,-.8],[.22,-.95],[HANG,.55],[.37,.3],[GROUND,.2,'out'],[g(.03),-1.25],[g(.08),-.45],[g(.125),-.9],
    [g(.19),-.7],[g(.255),-1],[g(.30),-1],[g(.345),-.6],[g(.385),-.5],[g(.43),-1.05],[g(.47),-.7],[g(.56),.55],[g(.63),-.3],
    [g(.70),0]],
  arms:[[0,0],[.065,.45],[.115,.3],[.22,.35],[HANG,.7],[.37,.8],[GROUND,.85],[g(.035),1.1,'in'],[g(.08),.9],[g(.125),1],
    [g(.205),.15],[g(.255),-.3],[g(.345),-.3],[g(.43),-.2],[g(.47),0],[g(.56),.35],[g(.63),-.1],[g(.70),0]],
  legs:[[0,0],[.065,-.3],[.115,-.8],[.22,-.9],[HANG,.5],[.37,.7],[GROUND,.8],[g(.04),1.1,'in'],[g(.085),.9],[g(.13),1],
    [g(.19),0],[g(.255),-.6],[g(.345),-.6],[g(.385),-.2],[g(.43),-.6],[g(.47),-.3],[g(.56),.5],[g(.63),-.25],[g(.70),0]],
};
// Seconds each channel trails the torso. The head and the ends of the limbs
// arrive last; the two sides are skewed a few milliseconds against twinning.
const LAG:Partial<Record<Channel,number>>={chest:.01,neck:.03,armPitch:.024,armRoll:.024,armSweep:.014,elbow:.04,arms:.024,
  thigh:.008,splay:.008,knee:.02,ankle:.034,legs:.02};
const ARM_SKEW=.007,LEG_SKEW=.007;
const ARM:readonly Channel[]=['armPitch','armRoll','armSweep','elbow','arms'],LEG:readonly Channel[]=['thigh','splay','knee','ankle','legs'];
// A held pose still breathes: the hands and head shiver through the hang.
const SHIVER:readonly (readonly [Channel,number,number,number,number])[]=[['armSweep',float(.105),.2,3,13],['neck',float(.11),.19,1.6,13]];

// For the gather the arms are placed by where the hands belong rather than by
// joint angles, so the palms meet the floor beside the shoulders (the right
// hand mirrors the left). The offset is level with the world; the elbows
// point out and back from the chest. As the body tips over, the placement
// melts back into the keyed tuck, which holds the hands in front of the chest.
type Vec=readonly [number,number,number];
const PLANT:Vec=[.12,-.24,.08],ELBOW:Vec=[1,-.3,-.5];
const REACH:readonly Key[]=[[g(.125),0],[g(.19),1],[g(.21),1],[g(.265),0]];
// The pancake's palms-down wrist turn unwinds as the hands leave the floor.
const PALM:readonly Key[]=[[g(.20),1],[g(.30),0]];
// Out of the tuck the arms play the jump landing's own sweep at its own
// pace: flung wide and high as the feet arrive, down in front, then back past
// the hips with a soft elbow. It starts as the body sits up and, like a jump
// landing's, finishes over live locomotion after control has returned.
const SWEEP_START=g(.345),SWEEP:readonly Key[]=[[SWEEP_START,0],[g(.42),1]];
const HAND_LAG=.024;

/** Shape-preserving cubic through the keys: extremes rest, runs flow, and
 * nothing overshoots unless a key says so. */
function curve(keys:readonly Key[]):(time:number)=>number {
  const n=keys.length,h:number[]=[],d:number[]=[];
  for(let i=0;i<n-1;i++){h.push(keys[i+1][0]-keys[i][0]);d.push((keys[i+1][1]-keys[i][1])/h[i]);}
  const auto=keys.map((_,i)=>{
    if(i===0||i===n-1||d[i-1]*d[i]<=0)return 0;
    const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];
    return (a+b)/(a/d[i-1]+b/d[i]);
  });
  const arrive=keys.map((key,i)=>i>0&&(key[2]==='in'||key[2]==='hit')?2*d[i-1]:auto[i]);
  const leave=keys.map((key,i)=>i<n-1&&(key[2]==='out'||key[2]==='hit')?2*d[i]:auto[i]);
  return time=>{
    if(time<=keys[0][0])return keys[0][1];
    if(time>=keys[n-1][0])return keys[n-1][1];
    let i=0;while(keys[i+1][0]<=time)i++;
    const s=(time-keys[i][0])/h[i],s2=s*s,s3=s2*s;
    return (2*s3-3*s2+1)*keys[i][1]+(s3-2*s2+s)*h[i]*leave[i]+(3*s2-2*s3)*keys[i+1][1]+(s3-s2)*h[i]*arrive[i+1];
  };
}
const onPlayback=(keys:readonly Key[]):Key[]=>keys.map(([time,value,mode])=>[float(time),value,mode]);
const CURVES=Object.fromEntries(Object.entries(KEYS).map(([channel,keys])=>[channel,curve(onPlayback(keys))])) as Record<Channel,(time:number)=>number>;

const REACH_CURVE=curve(onPlayback(REACH));
const PALM_CURVE=curve(onPlayback(PALM)),SWEEP_CURVE=curve(onPlayback(SWEEP));

/** One side's channel values. `side` is +1 left, -1 right, 0 the centre line. */
function samplePose(time:number,side:number):Record<Channel,number> {
  const pose={} as Record<Channel,number>;
  for(const channel of Object.keys(KEYS) as Channel[]){
    const skew=ARM.includes(channel)?-side*ARM_SKEW:LEG.includes(channel)?side*LEG_SKEW:0;
    pose[channel]=CURVES[channel](time-(LAG[channel]??0)-skew);
  }
  for(const [channel,start,span,amplitude,hertz] of SHIVER){
    const u=(time-start)/span;
    if(u>0&&u<1)pose[channel]+=amplitude*Math.sin(Math.PI*u)**2*Math.sin(2*Math.PI*hertz*(time-start)+side);
  }
  return pose;
}

/** `landing` is the jump landing whose arm sweep finishes the rise. */
export function createPancakeSlamClip(original:AnimationClip,rig:RigDefinition,landing?:AnimationClip):AnimationClip {
  const id=original.id,tracks:AnimationTrack[]=[],amplitudes=characterElasticityAmplitudes('pancake-slam');
  const impactAmplitudes=characterElasticityAmplitudes('pancake-slam-impact');
  const hipsY=rig.joints.find(j=>j.id==='hips')!.rest.position[1];
  // Compression uses the shared slam profile. Reach uses the impact profile,
  // whose longer limb amplitudes are what spread the pancake at contact.
  const stretch=(load:number,part:number)=>1+(load<0||part===0?amplitudes[part]:impactAmplitudes[part])*load;
  const rad=THREE.MathUtils.degToRad;
  // Landed soles stay level under whatever the leg above them is doing. The
  // live contact solve then pins them to the floor for the rise.
  const solve=(time:number,side:number)=>{
    const pose=samplePose(time,side);
    pose.ankle=THREE.MathUtils.lerp(pose.ankle,pose.toes-(pose.hips-360+pose.thigh+pose.knee),pose.plant);
    return pose;
  };
  const upperArm=Math.hypot(...rig.joints.find(j=>j.id==='elbowLeft')!.rest.position);
  const forearm=Math.hypot(...rig.joints.find(j=>j.id==='wristLeft')!.rest.position);
  const shoulderQ=new THREE.Quaternion(),elbowQ=new THREE.Quaternion(),axisX=new THREE.Vector3(1,0,0);
  const euler=(angles:number[])=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.map(rad) as [number,number,number]));
  const sweepFrom=float(SWEEP_START);
  const landingKeys=(joint:string)=>landing?.tracks.find(track=>track.kind==='quaternion'&&track.target===joint)?.keys as QuaternionKeyframe[]|undefined;
  /** Shoulder, elbow and wrist for one arm: the keyed angles through the
   * pancake, the placed hand through the gather and tuck, then the sweep. */
  const arm=(time:number,sign:number,pose:Record<Channel,number>)=>{
    const name=sign>0?'Left':'Right',t=time-HAND_LAG+sign*ARM_SKEW;
    const result=[euler([pose.armPitch,sign*pose.armSweep,sign*pose.armRoll]),euler([pose.elbow,0,0]),euler([0,sign*90*PALM_CURVE(t),0])];
    const reach=REACH_CURVE(time-HAND_LAG);
    if(reach>0){
      // The level offset, turned into the chest's frame.
      const hand=new THREE.Vector3(sign*PLANT[0],PLANT[1],PLANT[2]).applyAxisAngle(axisX,-rad(pose.hips+pose.spine+pose.chest));
      const a=upperArm*stretch(pose.arms,1),b=forearm*stretch(pose.arms,2);
      const distance=THREE.MathUtils.clamp(hand.length(),Math.abs(a-b)+.01,(a+b)*.995),along=hand.clone().normalize();
      const side=new THREE.Vector3(sign*ELBOW[0],ELBOW[1],ELBOW[2]);
      side.addScaledVector(along,-side.dot(along)).normalize();
      const shoulderAngle=Math.acos(THREE.MathUtils.clamp((a*a+distance*distance-b*b)/(2*a*distance),-1,1));
      const flex=Math.PI-Math.acos(THREE.MathUtils.clamp((a*a+b*b-distance*distance)/(2*a*b),-1,1));
      const upper=along.clone().multiplyScalar(Math.cos(shoulderAngle)).addScaledVector(side,Math.sin(shoulderAngle));
      // The forearm folds toward the upper arm's own +Z, away from the elbow's side.
      const z=side.clone().multiplyScalar(-1).addScaledVector(upper,side.dot(upper)).normalize();
      const y=upper.clone().multiplyScalar(-1),x=new THREE.Vector3().crossVectors(y,z);
      shoulderQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      elbowQ.setFromAxisAngle(axisX,-flex);
      result[0].slerp(shoulderQ,reach);result[1].slerp(elbowQ,reach);
    }
    const sweep=SWEEP_CURVE(t);
    if(sweep>0)for(const [i,joint] of ['shoulder','elbow','wrist'].entries()){
      const keys=landingKeys(joint+name),value=keys&&sampleQuaternionKeys(keys,Math.max(0,t-sweepFrom));
      if(value)result[i].slerp(new THREE.Quaternion(...value),sweep);
    }
    return result;
  };
  const times=[...new Set([
    ...Array.from({length:Math.floor(playbackGround*120)+1},(_,i)=>i/120),playbackHang,
    ...Array.from({length:Math.round((RECOVERY+PANCAKE_SLAM.tail)*120)+1},(_,i)=>playbackGround+i/120),
  ].map(time=>+time.toFixed(6)))].sort((a,b)=>a-b);
  const frames=times.map(time=>{
    const centre=solve(time,0);
    const sides={Left:solve(time,1),Right:solve(time,-1)};
    return {time,centre,sides,arms:{Left:arm(time,1,sides.Left),Right:arm(time,-1,sides.Right)}};
  });
  type Frame=typeof frames[number];
  const posed:Record<string,(frame:Frame)=>THREE.Quaternion>={};
  const rotations:Record<string,(frame:Frame)=>number[]>={
    root:()=>[0,0,0],hips:f=>[f.centre.hips,0,0],torsoRoot:()=>[0,0,0],spine:f=>[f.centre.spine,0,0],
    chest:f=>[f.centre.chest,0,0],neck:f=>[f.centre.neck,0,0],head:()=>[0,0,0],
  };
  for(const [side,sign] of [['Left',1],['Right',-1]] as const){
    rotations[`clavicle${side}`]=()=>[0,0,0];
    // The first pancake's broad palms face the support plane until the gather.
    posed[`shoulder${side}`]=f=>f.arms[side][0];posed[`elbow${side}`]=f=>f.arms[side][1];posed[`wrist${side}`]=f=>f.arms[side][2];
    rotations[`hip${side}`]=f=>[f.sides[side].thigh,0,sign*f.sides[side].splay];
    rotations[`knee${side}`]=f=>[f.sides[side].knee,0,0];
    rotations[`ankle${side}`]=f=>[f.sides[side].ankle,0,0];
    rotations[`toe${side}`]=()=>[0,0,0];
  }
  // Every curve is baked at an even 120 Hz cadence, so playback only ever
  // blends neighbouring samples and each eased shape survives intact.
  for(const [target,angles]of Object.entries(rotations))posed[target]=frame=>euler(angles(frame));
  for(const [target,rotation]of Object.entries(posed))tracks.push({id:`${id}:pancake:${target}`,kind:'quaternion',target,
    keys:frames.map((frame,i)=>({id:`${target}:${i}`,time:frame.time,value:rotation(frame).toArray() as QuaternionTuple,
      interpolation:'linear' as const})),
  });
  tracks.push({id:`${id}:pancake:root-height`,kind:'position',target:'root',keys:frames.map((frame,i)=>({
    id:`root:${i}`,time:frame.time,value:[0,frame.centre.pelvis-hipsY,frame.centre.back],interpolation:'linear' as const,
  }))});
  for(const [target,part]of ELASTIC_LENGTH_CONTROLS){
    const side=target.includes('.left.')?'Left':target.includes('.right.')?'Right':null;
    tracks.push({id:`${id}:pancake:${target}`,kind:'scalar',target,keys:frames.map((frame,i)=>{
      const pose=side?frame.sides[side]:frame.centre;
      return {id:`${target}:${i}`,time:frame.time,interpolation:'linear' as const,
        value:stretch(part===0?pose.torso:part<3?pose.arms:pose.legs,part)};
    })});
  }
  const end=PANCAKE_SLAM.duration+PANCAKE_SLAM.tail;
  return {...original,name:'Body slam · elastic pancake, low roll and spring to the feet',duration:end,
    range:{start:0,end},playbackSpeed:1,tracks,proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:hold`,time:PANCAKE_SLAM.coil,name:'Coiled anticipation'},
      {id:`${id}:dive`,time:PANCAKE_SLAM.dive,name:'Wind-up into the dive'},
      {id:`${id}:spread`,time:PANCAKE_SLAM.hang,name:'Belly-first drop'},
      {id:`${id}:impact`,time:PANCAKE_SLAM.groundStart,name:'Slam contact'},
      {id:`${id}:rebound`,time:PANCAKE_SLAM.rebound,name:'Pancake rebound'},
      {id:`${id}:bottom`,time:PANCAKE_SLAM.flatEnd,name:'Gather back'},
      {id:`${id}:roll`,time:PANCAKE_SLAM.roll,name:'Tucked forward roll'},
      {id:`${id}:feet`,time:PANCAKE_SLAM.feetDown,name:'Feet down'},
      {id:`${id}:crouch`,time:PANCAKE_SLAM.crouch,name:'Loaded crouch'},
      {id:`${id}:spring`,time:PANCAKE_SLAM.spring,name:'Spring past standing'}],
    metadata:{pancakeSlam:true,jakDirect:true,progressSource:'gameplay-actionProgress',
      pancakeHang:PANCAKE_SLAM.hang,pancakeGroundStart:PANCAKE_SLAM.groundStart,pancakeRecovery:RECOVERY,
      pancakeDropRamp:PANCAKE_SLAM.dropRamp,
      pancakeFeetDown:PANCAKE_SLAM.feetDown,
      pancakeTail:PANCAKE_SLAM.tail,
      // Locomotion returns under the settle: the legs by the end of the lock,
      // so a run can start on its first frame; the arms and torso over the tail.
      pancakeRecoveryStart:PANCAKE_SLAM.spring-.02,
      pancakeLegsBlend:[PANCAKE_SLAM.spring-.02,PANCAKE_SLAM.duration],
      pancakeBodyBlend:[PANCAKE_SLAM.duration-.2,end],
      pancakeContactRoll:true,
      elasticityProfile:'pancake-slam',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      impactElasticityProfile:'pancake-slam-impact',
      slamPose:'first-pancake',
      motionReference:'First pancake impact; low continuous forward recovery informed by Jak moving-flop-down-land',
      elasticityPrinciple:'independent segment compression, extension and finite rebound'},
  };
}
