import * as THREE from 'three';
import { createAnimationClip } from './document';
import type { AnimationClip, QuaternionTuple, Vec3Tuple } from './types';

export const SLOPE_SLIDE_CLIP_ID = 'player.slope-slide';

/** A sustained shoe glide: both feet stay down while the upper body makes
 * small, delayed balance corrections. No stride or baseball-slide tuck. */
export function buildSlopeSlideClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({id:SLOPE_SLIDE_CLIP_ID,
    name:'Downhill Slide — Planted Counterbalance',rigId,duration:1.6});
  const beats=[0,.18,.43,.68,.86,1];
  const sway=[0,.045,-.035,.025,0,0];
  const rotation=(joint:string,poses:Vec3Tuple[])=>{
    const id=`${clip.id}:${joint}:quaternion`;
    clip.tracks.push({id,target:joint,kind:'quaternion',keys:poses.map((pose,i)=>({
      id:`${id}:${i}`,time:beats[i]*clip.duration,
      value:new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose,'XYZ')).toArray() as QuaternionTuple,
      interpolation:'cubic',
    }))});
  };
  const position=(joint:string,value:Vec3Tuple)=>{
    const id=`${clip.id}:${joint}:position`;
    clip.tracks.push({id,target:joint,kind:'position',keys:[0,clip.duration].map((time,i)=>({
      id:`${id}:${i}`,time,value:[...value] as Vec3Tuple,interpolation:'linear',
    }))});
  };
  position('root',[0,0,0]);
  position('hips',[0,-.045,0]);
  rotation('hips',beats.map(()=>[0,0,0]));
  if(includeTorsoRoot)rotation('torsoRoot',sway.map(v=>[-.075,0,v*.3]));
  rotation('spine',sway.map(v=>[includeTorsoRoot?-.04:-.115,0,v*.4]));
  rotation('chest',sway.map(v=>[.025,-v*.3,v*.3]));
  rotation('neck',sway.map(v=>[.035,v*.1,-v*.4]));
  rotation('head',sway.map(v=>[.04,v*.2,-v*.6]));
  for(const [side,sign] of [['Left',1],['Right',-1]] as const){
    // Equal-length bent legs with opposing offsets give a staggered stance
    // without lifting either shoe. The ankle cancels the complete leg bend.
    const hip=-.31-sign*.08,knee=.62,spread=sign*.11;
    rotation(`hip${side}`,beats.map(()=>[hip,0,spread]));
    rotation(`knee${side}`,beats.map(()=>[knee,0,0]));
    rotation(`ankle${side}`,beats.map(()=>[-hip-knee,0,-spread]));
    rotation(`toe${side}`,beats.map(()=>[0,0,0]));
    rotation(`clavicle${side}`,sway.map(v=>[0,0,sign*.045-v*.08]));
    rotation(`shoulder${side}`,sway.map(v=>[sign*.15-v*.6,sign*.08,
      sign*(side==='Left'?1.08:.92)-v*.8]));
    rotation(`elbow${side}`,sway.map((_,i)=>[-.56+sway[Math.max(0,i-1)]*sign,.02*sign,.1*sign]));
    rotation(`wrist${side}`,sway.map((_,i)=>[.08,sign*.14,-sway[Math.max(0,i-1)]*.7]));
  }
  clip.contacts=(['Left','Right'] as const).map(side=>({
    id:`${clip.id}:shoe-${side}`,start:0,end:clip.duration,effector:`foot${side}`,mode:'custom',weight:1,
    metadata:{planarContact:'glide',verticalContact:'ground',locking:'no-world-XZ-plant'},
  }));
  clip.tags=['player','starter-authored','slope','slide','balance','in-place'];
  clip.metadata={starterCatalogVersion:34,
    performance:'Held staggered shoe glide, soft knees, open arms and restrained upper-body rebound',
    footContactPolicy:'Both shoes glide on the support plane; no stepping or root travel'};
  return clip;
}
