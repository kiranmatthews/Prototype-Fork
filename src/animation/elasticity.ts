import { skateGrabTweak } from '../skateGrabMotion';
import type { GrabTrickKind } from '../skateTricks';
import { createProceduralDriver } from './document';
import type { AnimationClip, AnimationTrack, RigDefinition } from './types';
import { sampleUnderRailMotion, sampleSkateRevert } from '../skateBodyMotion';
import { sampleBackflip, sampleFootFlip, sampleImpossible } from '../skateTricks';

export const CHARACTER_ELASTICITY_REVISION = 1;
/** Torso, upper arm, forearm, thigh and shin. Zero protects a planted grip. */
type Amplitudes = readonly [number,number,number,number,number];
const PROFILES:Record<string,Amplitudes> = {
  idle:[.022,.012,.022,.008,.010], walk:[.040,.020,.035,.035,.048], run:[.070,.025,.050,.055,.080],
  'swim-idle':[.025,.035,.045,.015,.022], swim:[.055,.060,.090,.045,.060],
  'jump-charge':[.06,.04,.06,.035,.045], 'run-stop':[.05,.035,.05,.025,.04],
  jump:[.12,.08,.12,.12,.15], 'double-jump':[.12,.08,.12,.12,.15], 'slide-jump':[.12,.08,.12,.12,.15],
  fall:[.08,.06,.08,.08,.10], land:[.10,.06,.08,.10,.12],
  crouch:[.028,.008,.014,.010,.015], crawl:[.028,0,0,.022,.028],
  'crouch-enter':[.035,0,.012,.016,.016], 'crouch-exit':[.035,0,.012,.016,.016],
  slide:[.050,.025,.035,.020,.035], skate:[.020,.012,.020,.010,.015],
  teeter:[.060,.035,.080,0,0], // chest/arms rebound; planted legs keep their lengths
  grind:[.024,.020,.040,.015,.025], grab:[.030,0,0,.018,.020],
  hang:[0,0,0,.035,.050], climb:[0,0,0,.030,.050],
  rope:[.025,0,0,.035,.050], 'rope-climb':[.025,0,0,.040,.050],
  'rope-release':[.080,.070,.10,.070,.10], 'rope-release-charged':[.080,.070,.10,.070,.10],
  slam:[.065,.030,.050,.045,.060], bail:[.045,.045,.060,.060,.080],
  death:[.040,.020,.030,.025,.035], spin:[.045,.030,.045,.025,.040],
};
/** Shared segment amplitudes for imported creature rigs as well as player clips.
 * Callers receive a copy so per-character tuning cannot change player defaults. */
export function characterElasticityAmplitudes(profile:string):Amplitudes {
  return [...(PROFILES[profile]??PROFILES.idle)];
}
export const ELASTIC_LENGTH_CONTROLS = [
  ['deform.torso.length',0],
  ['deform.arm.upper.left.length',1],['deform.arm.upper.right.length',1],
  ['deform.arm.lower.left.length',2],['deform.arm.lower.right.length',2],
  ['deform.leg.upper.left.length',3],['deform.leg.upper.right.length',3],
  ['deform.leg.lower.left.length',4],['deform.leg.lower.right.length',4],
] as const;

/** An editable default for every player clip, including new Studio clips.
 * Existing scalar keys/drivers own their targets: never double their squash,
 * replace user keys, or put a perpetual oscillator on a settled death. */
export function withCharacterElasticity(clip:AnimationClip,rig?:RigDefinition):AnimationClip {
  if(clip.metadata?.elasticityRevision===CHARACTER_ELASTICITY_REVISION)return clip;
  if(rig&&!rig.controls.some(c=>c.id==='deform.torso.length'))return clip;
  const name=clip.id.replace(/^player\./,''),amplitudes=PROFILES[name]??PROFILES.idle;
  const owned=new Set(clip.tracks.filter(t=>t.kind==='scalar'&&t.keys.length>0).map(t=>t.target));
  for(const driver of clip.proceduralDrivers)if(driver.target.kind==='scalar')owned.add(driver.target.target);
  const tracks=[...clip.tracks],drivers=[...clip.proceduralDrivers];
  const loop=clip.loop.mode!=='once';
  for(const [target,part] of ELASTIC_LENGTH_CONTROLS){
    const amplitude=amplitudes[part];
    if(!amplitude||owned.has(target)||rig&&!rig.controls.some(c=>c.id===target))continue;
    const id=`${clip.id}:elasticity:${target}`;
    if(loop){
      const cycles=name==='run'||name==='walk'||name==='crawl'?2:1;
      drivers.push(createProceduralDriver('oscillator',{kind:'scalar',target,baseValue:1},{
        id,name:`Elasticity · ${target}`,order:700+drivers.length,blend:'multiply',source:'time',
        frequency:cycles/Math.max(.001,clip.duration),phase:part===2?.10:part===1?.05:0,
        amplitude:-amplitude,bias:1,clamp:[1-amplitude,1+amplitude],
      }));
    }else{
      const span=name==='death'?Math.min(1,clip.duration):clip.duration;
      const beats=name==='slam'?[[0,0],[.60,.35],[.84,-1],[.94,.5],[1,0]]
        :[[0,0],[.24,-1],[.55,.55],[.78,-.15],[1,0]];
      tracks.push({id,kind:'scalar',target,keys:beats.map(([phase,value],i)=>({
        id:`${id}:${i}`,time:phase*span,value:1+amplitude*value,interpolation:'cubic',
      }))} as AnimationTrack);
    }
  }
  return {...clip,tracks,proceduralDrivers:drivers,metadata:{...clip.metadata,
    elasticityRevision:CHARACTER_ELASTICITY_REVISION,
    elasticityPrinciple:'independent segment compression, extension and rebound',
    elasticityProfile:PROFILES[name]?name:'idle',
  }};
}

/** The gameplay skate pose remains contact-owned, so its restrained rolling
 * breath is sampled here rather than playing the old Skate Push joint keys. */
export function skateRestElasticity(time:number):Record<string,number> {
  const values:Record<string,number>={};
  for(const [target,part] of ELASTIC_LENGTH_CONTROLS)
    values[target]=1-PROFILES.skate[part]*Math.sin(2*Math.PI*(time*.85+(part===2?.10:part===1?.05:0)));
  return values;
}

/** Long independent arm shafts carry the under-rail body. The contact solve
 * plants both palms afterward, so this small elastic sway cannot loosen grips. */
export const SKATE_UNDER_RAIL_ARM_LIMIT = 5.75;
export function skateUnderRailElasticity(weight:number,time:number,returning=false,releasing=false):Record<string,number> {
  const motion=sampleUnderRailMotion(weight,returning,releasing);
  const pulse=.025*Math.sin(time*3.8)*Math.max(0,weight)+motion.armExtra;
  return {...Object.fromEntries(ELASTIC_LENGTH_CONTROLS.filter(([id])=>id.startsWith('deform.arm.')).map(([id])=>
    [id,1+motion.armReach*((id.includes('.lower.')?3:2.8)-1+pulse)])),
    'deform.torso.length':1+.46*motion.torsoDuck};
}

/** Tornado Twist reaches to its leading-hand Weddle grip from a high pelvis. */
export function skate900Elasticity(weight:number,stance:number):Record<string,number> {
  const t=Math.max(0,Math.min(1,weight)),reach=t*t*(3-2*t),side=stance>0?'right':'left';
  return {[`deform.arm.upper.${side}.length`]:1+1.1*reach,[`deform.arm.lower.${side}.length`]:1+1.3*reach};
}

/** Independent segment reach supports each conventional grab silhouette;
 * a finite gather/rebound pulse resolves before the held pose. */
export function skateGrabTweakElasticity(kind:GrabTrickKind,weight:number,stance:number):Record<string,number> {
  const pose=skateGrabTweak(kind);if(!pose)return {};
  const t=Math.max(0,Math.min(1,weight)),w=t*t*(3-2*t),pulse=.025*Math.sin(Math.PI*w);
  const side=(kind==='stalefish'?stance<0:stance>0)?'right':'left',values:Record<string,number>={};
  for(const leg of ['left','right']){
    values[`deform.leg.upper.${leg}.length`]=1+(pose.upperLeg-1)*w+pulse;
    values[`deform.leg.lower.${leg}.length`]=1+(pose.lowerLeg-1)*w+pulse;
  }
  values[`deform.arm.upper.${side}.length`]=1+(pose.upperArm-1)*w+pulse;
  values[`deform.arm.lower.${side}.length`]=1+(pose.lowerArm-1)*w+pulse;
  return values;
}

/** Blend from the live ollie lengths, rather than multiplying two squashes. */
export function skateBackflipElasticity(motion:ReturnType<typeof sampleBackflip>,stance:number,ollie:Record<string,number>):Record<string,number> {
  const gripping=stance>0?'right':'left',values={...ollie};
  for(const [id,part] of ELASTIC_LENGTH_CONTROLS){
    const target=part===0?.60:part===3?.60:part===4?.62:
      id.includes(`.${gripping}.`)?(part===1?1.10:1.16):(part===1?.68:.70);
    const base=ollie[id]??1;
    values[id]=(base+(target-base)*motion.compression)*(1+motion.rebound*(part===0?.04:.08));
  }
  return values;
}

/** Gather the legs above a freely turning board without folding the pelvis down. */
export function skateFootFlipElasticity(motion:ReturnType<typeof sampleFootFlip>,ollie:Record<string,number>,stance:number):Record<string,number> {
  const values={...ollie};
  for(const [id,part] of ELASTIC_LENGTH_CONTROLS){
    if(part===1||part===2){
      if(motion.scoopFlip){const base=ollie[id]??1;values[id]=base+((part===1?1.25:1.35)-base)*motion.arms;}
      continue;
    }
    const target=part===0?.94:part===3?.88:.84,base=ollie[id]??1;
    values[id]=base+(target-base)*motion.tuck;
    // The heel pushes farther sideways: extend only that leading leg, then
    // let it gather again as the shoe retracts above the freely turning deck.
    if(part>=3){
      const leading=id.includes(`.${stance>0?'right':'left'}.`);
      values[id]+=leading?.14*motion.heelLead:.18*motion.scoop;
    }
  }
  return values;
}

/** Gather the free leg, keep reach in the wrapping leg, and let the arms
 * extend into their broad balance sweep using independent segment controls. */
export function skateImpossibleElasticity(motion:ReturnType<typeof sampleImpossible>,ollie:Record<string,number>,stance:number):Record<string,number> {
  const values={...ollie};
  for(const [id,part] of ELASTIC_LENGTH_CONTROLS){
    const leading=id.includes(`.${stance>0?'right':'left'}.`);
    const target=part===0?.88:part===1?1.45:part===2?1.55:leading?(part===3?.60:.56):(part===3?1.02:1.04);
    const base=ollie[id]??1;values[id]=base+(target-base)*motion.wrap;
  }
  return values;
}

/** Charge-like gathering and a visibly lengthening downward balance arm. */
export function skateRevertElasticity(motion:ReturnType<typeof sampleSkateRevert>,enteringStance:number):Record<string,number> {
  const side=enteringStance>0?'left':'right',values:Record<string,number>={
    'deform.torso.length':1-.09*motion.compression+.05*motion.rebound,
    [`deform.arm.upper.${side}.length`]:1+(.30+.10*motion.rebound)*motion.reach,
    [`deform.arm.lower.${side}.length`]:1+(.24+.08*motion.rebound)*motion.reach,
  };
  for(const leg of ['left','right'])for(const part of ['upper','lower'])
    values[`deform.leg.${part}.${leg}.length`]=1-(part==='upper'?.10:.08)*motion.compression+.06*motion.rebound;
  return values;
}
