import * as THREE from 'three';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS,CHARACTER_ELASTICITY_REVISION} from './elasticity';
import type {AnimationClip,AnimationTrack,RigDefinition,QuaternionTuple} from './types';

/** The airborne hold and grounded recovery use independent gameplay clocks.
 * A long drop holds the spread pose; the first contact starts the rebound. */
export const PANCAKE_SLAM = {hang:.32,holdEnd:.26,recovery:.5,bottomEnd:.455,feetDown:.75,duration:.82} as const;

// Keep the first pancake iteration's spread, palm orientation and flat impact.
// Recovery is a low, continuous forward roll rather than the later high flip.
// One eased turn and the live support solver keep the recovery clear and smooth.
// time, pelvis height, hips/chest/neck pitch, arm pitch/roll, elbow,
// thigh pitch/splay, knee, ankle, independent segment load, impact limb reach.
const beats=[
  [0,    .78,-28,-10,30,-135,80,-35,-85,24,124,-35,-.85],
  [PANCAKE_SLAM.holdEnd,.78,-28,-10,30,-135,80,-35,-85,24,124,-35,-.85],
  [.320, .49, 86,  1,-22,   0,110, -8,   0,26,  8, 65, .20,.45],
  [.355, .09, 89,  0,-40,   2,112, -5,   0,29,  5, 78,-1.0,1.0],
  [.405, .095,89,  0,-40,   2,112, -5,   0,29,  5, 78,-.98,.98],
  [PANCAKE_SLAM.bottomEnd,.10,89,0,-40,2,112,-5,0,29,5,78,-.95,.95],
  [.495, .20,105, 20, 26, -32,58,-55, -70,14,115,-10,-.25,.20],
  [.545, .30,155, 38, 42, -65,25,-95,-115, 5,155,-25,-.65],
  [.595, .33,215, 40, 40, -68,18,-98,-120, 3,155,-30,-.70],
  [.645, .32,280, 30, 28, -48,20,-72,-105, 3,145,-30,-.60],
  [.695, .40,335, 16,  5, -12,24,-35, -62, 4,100,-30,-.45],
  [.750, .60,360,  5, -5,   4,15,-18, -28, 3, 45,-16,-.30],
  [.790, .73,360, -3,  3,   0,10,-12,  -5, 2, 12, -4, .25],
  [.820, .71,360,  0,  0,   0,10,-12,   0, 0,  6, -3, 0],
];
const recoveryStart=PANCAKE_SLAM.bottomEnd,turnEnd=PANCAKE_SLAM.feetDown;
// A broad-speed turn leaves a readable bottom beat without making the roll
// faster at its centre. Both ends still arrive with zero angular velocity.
const smoothTurn=(x:number)=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
// An actual hold, not a cubic plateau whose automatic tangents keep drifting.
const interpolation=(index:number)=>index===0?'step' as const:index>=3&&index<5?'linear' as const:'cubic' as const;

export function createPancakeSlamClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const id=original.id,tracks:AnimationTrack[]=[],amplitudes=characterElasticityAmplitudes('pancake-slam');
  const impactAmplitudes=characterElasticityAmplitudes('pancake-slam-impact');
  const hipsY=rig.joints.find(j=>j.id==='hips')!.rest.position[1];
  const rotations:Record<string,(b:number[])=>number[]>={
    root:()=>[0,0,0],hips:b=>[b[0]<=recoveryStart?b[2]:89+271*smoothTurn((b[0]-recoveryStart)/(turnEnd-recoveryStart)),0,0],torsoRoot:()=>[0,0,0],spine:()=>[0,0,0],
    chest:b=>[b[3],0,0],neck:b=>[b[4],0,0],head:()=>[0,0,0],
  };
  for(const [side,sign] of [['Left',1],['Right',-1]] as const){
    rotations[`clavicle${side}`]=()=>[0,0,0];
    rotations[`shoulder${side}`]=b=>[b[5],0,sign*b[6]];
    rotations[`elbow${side}`]=b=>[b[7],0,0];
    // The first pancake's broad palms face the support plane.
    rotations[`wrist${side}`]=()=>[0,sign*90,0];
    rotations[`hip${side}`]=b=>[b[8],0,sign*b[9]];
    rotations[`knee${side}`]=b=>[b[10],0,0];
    rotations[`ankle${side}`]=b=>[b[11],0,0];
    rotations[`toe${side}`]=()=>[0,0,0];
  }
  for(const [target,angles]of Object.entries(rotations)){
    // The turn is sampled at an even cadence. SQUAD across irregularly spaced
    // pose beats otherwise accelerates around the inversion, then brakes at
    // the next key even though the underlying eased turn has continuous speed.
    const samples=target==='hips'?[...beats.filter(b=>b[0]<=recoveryStart),
      ...Array.from({length:44},(_,i)=>[recoveryStart+(turnEnd-recoveryStart)*(i+1)/44]),
      ...beats.filter(b=>b[0]>turnEnd)]:beats;
    tracks.push({id:`${id}:pancake:${target}`,kind:'quaternion',target,
    keys:samples.map((b,i)=>({id:`${target}:${i}`,time:b[0],value:new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(...angles(b).map(THREE.MathUtils.degToRad) as [number,number,number]))
      .toArray() as QuaternionTuple,interpolation:target==='hips'&&b[0]>=recoveryStart?'linear':interpolation(i)})),
    });
  }
  tracks.push({id:`${id}:pancake:root-height`,kind:'position',target:'root',keys:beats.map((b,i)=>({
    id:`root:${i}`,time:b[0],value:[0,b[1]-hipsY,0],interpolation:interpolation(i),
  }))});
  for(const [target,part]of ELASTIC_LENGTH_CONTROLS)tracks.push({id:`${id}:pancake:${target}`,kind:'scalar',target,
    // Flatten the torso while BOTH arms and legs extend at the bottom. Keep
    // that reach through contact, then unwind it into the rolling recovery.
    keys:beats.map((b,i)=>({id:`${target}:${i}`,time:b[0],
      value:part>0&&b[13]!==undefined?1+impactAmplitudes[part]*b[13]
        :1+amplitudes[part]*b[12]*(part===1||part===2?-1:1),interpolation:interpolation(i)})),
  });
  return {...original,name:'Body slam · held drop and smooth forward recovery',duration:PANCAKE_SLAM.duration,
    range:{start:0,end:PANCAKE_SLAM.duration},playbackSpeed:1,tracks,proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:hold`,time:0,name:'Cartoon anticipation hold'},
      {id:`${id}:spread`,time:.32,name:'Belly-first drop'},
      {id:`${id}:impact`,time:.355,name:'Slam contact'},
      {id:`${id}:bottom`,time:PANCAKE_SLAM.bottomEnd,name:'Finish flat settle'},
      {id:`${id}:rebound`,time:.545,name:'Tucked forward roll'},
      {id:`${id}:feet`,time:PANCAKE_SLAM.feetDown,name:'Feet-down compression'}],
    metadata:{pancakeSlam:true,jakDirect:true,progressSource:'gameplay-actionProgress',
      pancakeRecoveryStart:PANCAKE_SLAM.feetDown,
      pancakeContactRoll:true,
      elasticityProfile:'pancake-slam',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      impactElasticityProfile:'pancake-slam-impact',
      slamPose:'first-pancake',
      motionReference:'First pancake impact; low continuous forward recovery informed by Jak moving-flop-down-land',
      elasticityPrinciple:'independent segment compression, extension and finite rebound'},
  };
}
