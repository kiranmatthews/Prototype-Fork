import * as THREE from 'three';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS,CHARACTER_ELASTICITY_REVISION} from './elasticity';
import type {AnimationClip,AnimationTrack,RigDefinition,QuaternionTuple} from './types';

/** The airborne hold and grounded recovery use independent gameplay clocks.
 * A long drop holds the spread pose; the first contact starts the rebound. */
export const PANCAKE_SLAM = {hang:.32,holdEnd:.26,recovery:.5,feetDown:.68,duration:.82} as const;

// Original articulated poses: gather, belly-first spread, flat impact,
// elastic recoil, forward tumble, feet-under-body spring and settle.
// Jak's moving-flop-down-land continues its hip turn through the rebound,
// unlike the standing recovery which unwinds. Adapt that forward direction
// to the lower pancake impact and Bone Man's proportions/recovery clock.
// Angles are degrees in Bone Man's semantic joint frame. No skeleton scaling.
const beats=[
  // time, pelvis height, hips pitch, chest pitch, neck pitch, arm pitch/roll,
  // elbow, thigh pitch/splay, knee, ankle, segment load
  [0,    .82,-18,-10, 28, -135, 68,-30, -82,18,112,-25,-.60],
  [PANCAKE_SLAM.holdEnd,.82,-18,-10,28,-135,68,-30,-82,18,112,-25,-.60],
  [.32,  .49, 86,  1,-22,    0,110, -8,   0,26,  8, 65, .20],
  [.355, .09, 89,  0,-40,    2,112, -5,   0,29,  5, 78,-1.0],
  [.395, .10, 89,  0,-40,    2,112, -5,   0,29,  5, 78,-.95],
  [.425, .34,108, -4,-30,  -12, 90,-30, -35,24, 70, 45, .45],
  [.465, .82,150,-12,-12,  -35, 60,-60, -78,18,135,  0, .60],
  [.510,1.10,212,-20,  0,  -45, 35,-80,-104,12,142,-20,-.60],
  [.560,1.03,275,-10, 12,  -28, 55,-65, -70,16,118,-25,-.35],
  [.615, .72,328, 10,-10,  -10, 45,-40, -38,12, 75,-20, .45],
  [.665, .56,354,  8, -8,    8, 24,-20, -45, 6, 82,-35,-.75],
  [.705, .64,360, -6,  4,    4, 15,-18, -22, 3, 36,-12, .30],
  [.755, .72,360, -3,  3,    0, 10,-12,  -5, 2, 12, -4, .12],
  [.820, .71,360,  0,  0,    0, 10,-12,   0, 0,  6, -3, 0],
];
// An actual hold, not a cubic plateau whose automatic tangents keep drifting.
const interpolation=(index:number)=>index===0?'step' as const:'cubic' as const;

export function createPancakeSlamClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const id=original.id,tracks:AnimationTrack[]=[],amplitudes=characterElasticityAmplitudes('pancake-slam');
  const hipsY=rig.joints.find(j=>j.id==='hips')!.rest.position[1];
  const rotations:Record<string,(b:number[])=>number[]>={
    root:()=>[0,0,0],hips:b=>[b[2],0,0],torsoRoot:()=>[0,0,0],spine:()=>[0,0,0],
    chest:b=>[b[3],0,0],neck:b=>[b[4],0,0],head:()=>[0,0,0],
  };
  for(const [side,sign] of [['Left',1],['Right',-1]] as const){
    rotations[`clavicle${side}`]=()=>[0,0,0];
    rotations[`shoulder${side}`]=b=>[b[5],0,sign*b[6]];
    rotations[`elbow${side}`]=b=>[b[7],0,0];
    // Cancel the neutral medial palm mount: both broad palms face the floor
    // in the horizontal sprawl instead of balancing on their glove edges.
    rotations[`wrist${side}`]=()=>[0,sign*90,0];
    rotations[`hip${side}`]=b=>[b[8],0,sign*b[9]];
    rotations[`knee${side}`]=b=>[b[10],0,0];
    rotations[`ankle${side}`]=b=>[b[11],0,0];
    rotations[`toe${side}`]=()=>[0,0,0];
  }
  for(const [target,angles]of Object.entries(rotations))tracks.push({
    id:`${id}:pancake:${target}`,kind:'quaternion',target,
    keys:beats.map((b,i)=>({id:`${target}:${i}`,time:b[0],value:new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(...angles(b).map(THREE.MathUtils.degToRad) as [number,number,number]))
      .toArray() as QuaternionTuple,interpolation:interpolation(i)})),
  });
  tracks.push({id:`${id}:pancake:root-height`,kind:'position',target:'root',keys:beats.map((b,i)=>({
    id:`root:${i}`,time:b[0],value:[0,b[1]-hipsY,0],interpolation:interpolation(i),
  }))});
  for(const [target,part]of ELASTIC_LENGTH_CONTROLS)tracks.push({id:`${id}:pancake:${target}`,kind:'scalar',target,
    // Arms fling outward as the torso/legs compress, then gather back in on
    // the recoil. Their separate phase makes the impact read as a pancake.
    keys:beats.map((b,i)=>({id:`${target}:${i}`,time:b[0],value:1+amplitudes[part]*b[12]*(part===1||part===2?-1:1),interpolation:interpolation(i)})),
  });
  return {...original,name:'D · Pancake slam and elastic recovery',duration:PANCAKE_SLAM.duration,
    range:{start:0,end:PANCAKE_SLAM.duration},playbackSpeed:1,tracks,proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:hold`,time:0,name:'Cartoon anticipation hold'},
      {id:`${id}:spread`,time:.32,name:'Belly-first drop'},
      {id:`${id}:impact`,time:.355,name:'Pancake impact'},
      {id:`${id}:rebound`,time:.465,name:'Forward rebound'},
      {id:`${id}:feet`,time:PANCAKE_SLAM.feetDown,name:'Feet-down compression'}],
    metadata:{pancakeSlam:true,jakDirect:true,progressSource:'gameplay-actionProgress',
      pancakeRecoveryStart:PANCAKE_SLAM.feetDown,
      elasticityProfile:'pancake-slam',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      motionReference:'Jak 1 eichar-moving-flop-down-land; forward recovery adapted to pancake contact',
      elasticityPrinciple:'independent segment compression, extension and finite rebound'},
  };
}
