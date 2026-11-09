import * as THREE from 'three';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS,CHARACTER_ELASTICITY_REVISION} from './elasticity';
import type {AnimationClip,AnimationTrack,RigDefinition,QuaternionTuple} from './types';

/** The airborne hold and grounded recovery use independent gameplay clocks.
 * A long drop holds the spread pose; the first contact starts the rebound. */
export const PANCAKE_SLAM = {hang:.32,recovery:.5,duration:.82} as const;

// Original articulated poses: gather, belly-first spread, flat impact,
// elastic recoil, second compression, feet-under-body spring and settle.
// Angles are degrees in Bone Man's semantic joint frame. No skeleton scaling.
const beats=[
  // time, pelvis height, hips pitch, chest pitch, neck pitch, arm pitch/roll,
  // elbow, thigh pitch/splay, knee, ankle, segment load
  [0,    .72,-18,-12, 24, -115, 68,-60, -72,18,112,-25,-.45],
  [.10,  .78,-28,-10, 30, -135, 80,-35, -85,24,124,-35,-.85],
  [.22,  .69, 38, -4,-15,  -35, 95,-12, -20,30, 36,-12, .50],
  [.32,  .49, 86,  1,-22,    0,110, -8,   0,26,  8, 65, .20],
  [.355, .09, 89,  0,-40,    2,112, -5,   0,29,  5, 78,-1.0],
  [.395, .10, 89,  0,-40,    2,112, -5,   0,29,  5, 78,-.95],
  [.465, .35, 74,-12,-20,  -12,100,-18, -16,24, 40, 35, .85],
  [.535, .23, 65,-18, -8,  -38, 83,-48, -42,22, 82, 20,-.55],
  [.625, .39, 29,  8,-22,  -40, 48,-80, -78,14,110,-30,-.35],
  [.725, .75, -6, -8,  6,   10, 24,-30, -18, 4, 28,-10, .55],
  [.775, .67,  4,  3, -3,    0, 16,-18,  -7, 3, 14, -5,-.12],
  [.82,  .71,  0,  0,  0,    0, 10,-12,   0, 0,  6, -3, 0],
];

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
      .toArray() as QuaternionTuple,interpolation:'cubic'})),
  });
  tracks.push({id:`${id}:pancake:root-height`,kind:'position',target:'root',keys:beats.map((b,i)=>({
    id:`root:${i}`,time:b[0],value:[0,b[1]-hipsY,0],interpolation:'cubic',
  }))});
  for(const [target,part]of ELASTIC_LENGTH_CONTROLS)tracks.push({id:`${id}:pancake:${target}`,kind:'scalar',target,
    // Arms fling outward as the torso/legs compress, then gather back in on
    // the recoil. Their separate phase makes the impact read as a pancake.
    keys:beats.map((b,i)=>({id:`${target}:${i}`,time:b[0],value:1+amplitudes[part]*b[12]*(part===1||part===2?-1:1),interpolation:'cubic'})),
  });
  return {...original,name:'D · Pancake slam and elastic recovery',duration:PANCAKE_SLAM.duration,
    range:{start:0,end:PANCAKE_SLAM.duration},playbackSpeed:1,tracks,proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:spread`,time:.32,name:'Belly-first drop'},
      {id:`${id}:impact`,time:.355,name:'Pancake impact'},
      {id:`${id}:rebound`,time:.465,name:'Elastic rebound'}],
    metadata:{pancakeSlam:true,jakDirect:true,progressSource:'gameplay-actionProgress',
      elasticityProfile:'pancake-slam',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      elasticityPrinciple:'independent segment compression, extension and finite rebound'},
  };
}
