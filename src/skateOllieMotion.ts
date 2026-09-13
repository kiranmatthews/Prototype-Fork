import { skateRestElasticity } from './animation/elasticity';

type Keys = readonly (readonly [number, number])[];
type LengthPart = 'torso' | 'armUpper' | 'armLower' | 'legUpper' | 'legLower';
type Phase = 'rise' | 'fall' | 'land';
const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));
const smooth = (n:number) => {const t=clamp(n,0,1);return t*t*(3-2*t);};
const sample = (keys:Keys,time:number):number => {
  if(time<=keys[0][0])return keys[0][1];
  for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){
    const [t0,a]=keys[i-1],[t1,b]=keys[i];return a+(b-a)*smooth((time-t0)/(t1-t0));
  }
  return keys[keys.length-1][1];
};

// Recovered from the Jump/Fall/Land scalar tracks at 91cf126 (2026-09-11),
// before the skate contact rewrite. Keep their independent segment deformation,
// not the on-foot hip/knee poses or overhead arms that broke board contacts.
export const SKATE_OLLIE_LENGTH_KEYS: Record<LengthPart,Record<Phase,Keys>> = {
  torso:{rise:[[0,1.25],[.1,1.42],[.5,1.36],[.85,.9],[1,.78]],fall:[[0,.78],[.18,.9],[.38,1],[1,1]],land:[[0,1],[.075,.72],[.18,1.1],[.34,.98],[.45,1]]},
  armUpper:{rise:[[0,1.24],[.1,1.34],[.5,1.3],[.85,.92],[1,.86]],fall:[[0,.86],[.18,.94],[.38,1],[1,1]],land:[[0,1],[.075,.82],[.18,1.06],[.34,.98],[.45,1]]},
  armLower:{rise:[[0,1.3],[.1,1.42],[.5,1.36],[.85,.88],[1,.82]],fall:[[0,.82],[.18,.91],[.38,1],[1,1]],land:[[0,1],[.075,.78],[.18,1.08],[.34,.98],[.45,1]]},
  legUpper:{rise:[[0,1.4],[.1,1.55],[.5,1.48],[.85,.82],[1,.74]],fall:[[0,.74],[.18,.88],[.38,1],[1,1]],land:[[0,1],[.075,.68],[.18,1.08],[.34,.98],[.45,1]]},
  legLower:{rise:[[0,1.48],[.1,1.65],[.5,1.56],[.85,.78],[1,.7]],fall:[[0,.7],[.18,.84],[.38,1],[1,1]],land:[[0,1],[.075,.72],[.18,1.06],[.34,.98],[.45,1]]},
};
const CONTROL_PARTS: Record<string,LengthPart> = {
  'deform.torso.length':'torso',
  'deform.arm.upper.left.length':'armUpper','deform.arm.upper.right.length':'armUpper',
  'deform.arm.lower.left.length':'armLower','deform.arm.lower.right.length':'armLower',
  'deform.leg.upper.left.length':'legUpper','deform.leg.upper.right.length':'legUpper',
  'deform.leg.lower.left.length':'legLower','deform.leg.lower.right.length':'legLower',
};
const SPINE:Record<Phase,Keys>={rise:[[0,-.08],[.1,-.18],[.5,-.1],[1,.18]],fall:[[0,.18],[.38,0],[1,0]],land:[[0,0],[.075,.18],[.18,-.08],[.34,.02],[.45,0]]};
const ARMS:Record<Phase,Keys>={rise:[[0,-.3],[.1,-.85],[.5,-.7],[1,.1]],fall:[[0,.1],[.18,.18],[.5,0],[1,0]],land:[[0,0],[.075,.3],[.18,-.22],[.34,.04],[.45,0]]};

export interface SkateOllieMotionInput {
  active:boolean; grounded:boolean; verticalVelocity:number; launchVelocity:number;
  airborneSeconds:number; fallReferenceVelocity:number; time?:number; reset?:boolean;
}
export interface SkateOlliePose {
  deformations:Record<string,number>;
  spine:number; arms:number; flare:number; jangle:number;
}
/** Additive, phase-driven motion layered before appearance and deck IK. Its
 * finite decay also hands off to grabs/dismounts without snapping length to 1. */
export class SkateOllieMotion {
  private wasAir=false;
  private landingAge=1;
  private lengths:Record<LengthPart,number>={torso:1,armUpper:1,armLower:1,legUpper:1,legLower:1};
  private accents={spine:0,arms:0,flare:0,jangle:0};
  reset():void {
    this.wasAir=false;this.landingAge=1;
    for(const part of Object.keys(this.lengths) as LengthPart[])this.lengths[part]=1;
    this.accents={spine:0,arms:0,flare:0,jangle:0};
  }
  step(dt:number,p:SkateOllieMotionInput):SkateOlliePose|null {
    if(p.reset){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1),air=p.active&&!p.grounded;
    if(p.active&&p.grounded&&this.wasAir)this.landingAge=0;
    else this.landingAge+=t;
    if(!p.active||air)this.landingAge=1;
    this.wasAir=air;
    const phase:Phase|null=air?(p.verticalVelocity>0?'rise':'fall'):p.active&&this.landingAge<.7?'land':null;
    const time=phase==='rise'?clamp(1-p.verticalVelocity/Math.max(1,p.launchVelocity),0,1)
      :phase==='fall'?clamp(-p.verticalVelocity/Math.max(1,p.fallReferenceVelocity),0,1):this.landingAge;
    const takeoff=air?smooth(p.airborneSeconds/.05):1;
    let deviation=0;
    for(const part of Object.keys(this.lengths) as LengthPart[]){
      const target=phase?1+(sample(SKATE_OLLIE_LENGTH_KEYS[part][phase],time)-1)*takeoff:1;
      const rate=part.startsWith('arm')?24:34;
      this.lengths[part]+=(target-this.lengths[part])*(1-Math.exp(-rate*t));
      deviation=Math.max(deviation,Math.abs(this.lengths[part]-1));
    }
    const age=air?p.airborneSeconds:this.landingAge;
    const pulse=phase?Math.sin(age*24)*Math.exp(-age*7)*smooth(age/.045):0;
    const targets={spine:phase?sample(SPINE[phase],time)*takeoff:0,
      arms:phase?sample(ARMS[phase],time)*takeoff:0,
      flare:phase?(air?.22* Math.sin(Math.PI*clamp(p.airborneSeconds/.8,0,1)):.10*Math.exp(-age*10)):0,
      jangle:pulse};
    for(const key of Object.keys(this.accents) as (keyof typeof this.accents)[]){
      this.accents[key]+=(targets[key]-this.accents[key])*(1-Math.exp(-22*t));
      deviation=Math.max(deviation,Math.abs(this.accents[key]));
    }
    if(deviation<1e-5&&!air&&this.landingAge>.7&&!p.active)return null;
    const deformations:Record<string,number>={};
    for(const [control,part] of Object.entries(CONTROL_PARTS))deformations[control]=this.lengths[part];
    if(p.active&&p.grounded&&this.landingAge>.7){
      const breath=skateRestElasticity(p.time??0);
      const weight=smooth((this.landingAge-.7)/.2);
      for(const control of Object.keys(deformations))deformations[control]*=1+(breath[control]-1)*weight;
    }
    return {deformations,...this.accents};
  }
}
