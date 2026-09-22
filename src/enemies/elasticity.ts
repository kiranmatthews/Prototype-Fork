import { characterElasticityAmplitudes } from '../animation/elasticity';
import { ENEMY_LEGS, type EnemyAnimationFrame, type EnemyKind, type EnemyLeg } from './types';

export interface EnemyElasticityProfile {
  idle: number;
  walk: number;
  anticipation: number;
  rebound: number;
  landing: number;
  defeat: number;
}
/** Editable per-species strengths applied to the shared character profiles.
 * Mechanical foes flex mounts and joints; their metal shells stay rigid. */
export const ENEMY_ELASTICITY_PROFILES: Record<EnemyKind,EnemyElasticityProfile> = {
  grunt:   {idle:1,walk:1,anticipation:1,rebound:1,landing:1,defeat:1},
  spiker:  {idle:.7,walk:.8,anticipation:.8,rebound:.8,landing:.8,defeat:.8},
  turtle:  {idle:.45,walk:.6,anticipation:.7,rebound:.7,landing:.6,defeat:.7},
  charger: {idle:.8,walk:.9,anticipation:1.35,rebound:1.2,landing:1,defeat:1.1},
  hopper:  {idle:1.25,walk:1.2,anticipation:1.7,rebound:1.7,landing:1.6,defeat:1.3},
  floater: {idle:.55,walk:.6,anticipation:.8,rebound:.9,landing:.4,defeat:.7},
  sentry:  {idle:.3,walk:0,anticipation:.55,rebound:.65,landing:0,defeat:.5},
  spinner: {idle:.2,walk:0,anticipation:.35,rebound:.5,landing:0,defeat:.4},
};
export interface EnemyElasticitySample {
  torso: number;
  legs: Record<EnemyLeg,{upper:number;lower:number}>;
}
const clamp01=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp01(v);return t*t*(3-2*t);};
const SHARED={idle:characterElasticityAmplitudes('idle'),walk:characterElasticityAmplitudes('walk'),
  jump:characterElasticityAmplitudes('jump'),death:characterElasticityAmplitudes('death')};
/** Finite compression, rebound and settle. Exactly zero at and past duration. */
export function enemyElasticPulse(time:number,duration:number):number {
  if(time<=0||time>=duration)return 0;
  const t=time/duration;
  const keys:readonly (readonly [number,number])[]=[[0,0],[.24,-1],[.55,.55],[.78,-.15],[1,0]];
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const a=keys[i-1],b=keys[i],u=smooth((t-a[0])/(b[0]-a[0]));
    return a[1]+(b[1]-a[1])*u;
  }
  return 0;
}
/** Segment ratios only. Never returns a scale for the actor or whole rig. */
export function sampleEnemyElasticity(kind:EnemyKind,frame:EnemyAnimationFrame,
  phase:number,planted:Partial<Record<EnemyLeg,boolean>>={},defeatTime=0):EnemyElasticitySample {
  const profile=ENEMY_ELASTICITY_PROFILES[kind];
  const moving=frame.speed>.05&&frame.grounded&&frame.alive;
  const amplitudes=moving?SHARED.walk:SHARED.idle;
  const strength=moving?profile.walk:profile.idle;
  const wave=-Math.sin(Math.PI*2*(moving?phase*2:frame.time*.9));
  let torso=1+amplitudes[0]*strength*wave;
  let transient=0;
  if(!frame.alive){
    // Complete the settle even while gameplay flies the defeated actor away.
    transient=enemyElasticPulse(defeatTime,frame.flung?.45:.12)*profile.defeat;
    torso=1+SHARED.death[0]*transient*3;
  }else if(kind==='charger'&&frame.state==='telegraph'){
    transient=-smooth(frame.stateTime/.55)*profile.anticipation;
  }else if(kind==='charger'&&frame.state==='recover'){
    transient=enemyElasticPulse(frame.stateTime,.75)*profile.rebound;
  }else if(kind==='hopper'&&frame.state==='crouch'){
    transient=-smooth(frame.stateTime/.45)*profile.anticipation+
      enemyElasticPulse(frame.stateTime,.22)*profile.landing;
  }else if(kind==='hopper'&&frame.state==='leap'){
    transient=Math.sin(Math.PI*clamp01(frame.stateTime/.36))*profile.rebound;
  }else if(kind==='sentry'&&frame.state==='fire'){
    transient=enemyElasticPulse(frame.stateTime,.15)*profile.rebound;
  }else if(kind==='floater'&&frame.state==='swoop'){
    transient=enemyElasticPulse(frame.stateTime,.8)*profile.rebound;
  }
  if(frame.alive)torso+=SHARED.jump[0]*transient;
  const legs={} as EnemyElasticitySample['legs'];
  for(const leg of ENEMY_LEGS){
    if(!frame.alive){legs[leg]={upper:1+transient*.05,lower:1+transient*.075};continue;}
    if(planted[leg]){legs[leg]={upper:1,lower:1};continue;}
    const front=leg.startsWith('front'),diagonal=leg==='frontLeft'||leg==='hindRight';
    const legWave=-Math.sin(Math.PI*2*(phase+(diagonal?0:.5)));
    const upper=amplitudes[front?1:3],lower=amplitudes[front?2:4];
    legs[leg]={upper:1+upper*strength*(moving?legWave:wave)+transient*.05,
      lower:1+lower*strength*(moving?legWave:wave)+transient*.075};
  }
  return {torso,legs};
}
