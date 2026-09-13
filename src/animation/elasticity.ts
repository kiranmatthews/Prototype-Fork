import { createProceduralDriver } from './document';
import type { AnimationClip, AnimationTrack, RigDefinition } from './types';

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
  grind:[.024,.020,.040,.015,.025], grab:[.030,0,0,.018,.020],
  hang:[0,0,0,.035,.050], climb:[0,0,0,.030,.050],
  rope:[.025,0,0,.035,.050], 'rope-climb':[.025,0,0,.040,.050],
  'rope-release':[.080,.070,.10,.070,.10], 'rope-release-charged':[.080,.070,.10,.070,.10],
  slam:[.065,.030,.050,.045,.060], bail:[.045,.045,.060,.060,.080],
  death:[.040,.020,.030,.025,.035], spin:[.045,.030,.045,.025,.040],
};
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
