import { characterElasticityAmplitudes } from '../animation/elasticity';
import { ENEMY_ELASTICITY_PROFILES, enemyElasticPulse } from './elasticity';
import type { EnemyAnimationFrame } from './types';

/** Artist-facing strengths on the shared creature elasticity profiles. The
 * actor's root, foot contacts and active peck target are never scaled/moved. */
export const MOA_BOUNCE = {
  walkStretch: 1.9, walkLift: .17, headFollow: .08, tailFollow: .16,
  anticipationDip: .055, peckReach: .20, recoverLift: .14,
  squawkChest: .11, headStretch: .065,
} as const;
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const hump=(t:number,a:number,b:number)=>t<=a||t>=b?0:Math.sin(Math.PI*(t-a)/(b-a))**2;
function keyed(t:number,keys:readonly (readonly [number,number])[]):number {
  for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
    const a=keys[i-1],b=keys[i];return a[1]+(b[1]-a[1])*smooth((t-a[0])/(b[0]-a[0]));
  }
  return keys[keys.length-1][1];
}
const STEP:readonly (readonly [number,number])[]=[[0,-.35],[.13,-1],[.36,.65],[.56,1],[.8,.05],[1,-.35]];
const WALK=characterElasticityAmplitudes('walk')[0],JUMP=characterElasticityAmplitudes('jump')[0];

export function sampleMoaBounce(frame:EnemyAnimationFrame,phase:number,moveWeight:number,baseTorso:number,
  timing:{windup:number;peck:number;recover:number;squawk:number}) {
  const result={torso:baseTorso,forward:1,bodyY:0,bodyZ:0,bodyPitch:0,headY:0,headZ:0,headPitch:0,headScale:1,neckWidth:1,tail:0};
  if(!frame.alive)return result;
  const profile=ENEMY_ELASTICITY_PROFILES.moa,t=frame.stateTime,beat=(phase*2)%1;
  const walking=keyed(beat,STEP),follow=keyed((beat+.9)%1,STEP);
  const gaitWeight=moveWeight*(frame.state==='patrol'||frame.state==='idle'?1:0);
  const walkRatio=1+WALK*profile.walk*MOA_BOUNCE.walkStretch*walking;
  result.torso=baseTorso+(walkRatio-baseTorso)*gaitWeight;
  result.bodyY=MOA_BOUNCE.walkLift*walking*gaitWeight;
  result.headY=MOA_BOUNCE.headFollow*follow*gaitWeight;
  result.headPitch=-.055*follow*gaitWeight;
  result.headScale=1+MOA_BOUNCE.headStretch*follow*gaitWeight;
  result.tail=MOA_BOUNCE.tailFollow*follow*gaitWeight;
  if(frame.state==='windup'){
    const load=smooth(t/timing.windup)*profile.anticipation;
    result.bodyY=-MOA_BOUNCE.anticipationDip*load;
    result.bodyPitch=-.055*load;result.headZ=-.065*load;
    result.headScale=1-.045*load;result.neckWidth=1+.04*load;
  }else if(frame.state==='peck'){
    const release=1-smooth(t/.075),snap=hump(t,0,timing.peck);
    result.torso=baseTorso-.12*profile.anticipation*release;
    result.forward=1+MOA_BOUNCE.peckReach*snap;
    result.bodyY=-MOA_BOUNCE.anticipationDip*profile.anticipation*release;
    result.bodyZ=.10*snap;result.bodyPitch=.075*snap-.055*profile.anticipation*release;
    // Everything affecting the bill is exactly neutral over the damage window.
    result.headZ=-.065*profile.anticipation*release;
    result.headScale=1-.045*profile.anticipation*release;
    result.headY=.065*hump(t,.25,timing.peck);
  }else if(frame.state==='recover'){
    const spring=enemyElasticPulse(t,timing.recover)*profile.rebound;
    const follow=enemyElasticPulse(t-.06,timing.recover-.06)*profile.rebound;
    result.bodyY=MOA_BOUNCE.recoverLift*spring;
    result.headY=.095*follow;result.headPitch=-.10*follow;
    result.headScale=1+.055*follow;result.tail=.18*follow;
  }else if(frame.state==='squawk'){
    const inhale=hump(t,0,.24),first=hump(t,.24,.80),second=hump(t,.88,1.31);
    const breath=(-.7*inhale+first+.65*second)*profile.rebound;
    result.torso=baseTorso-JUMP*enemyElasticPulse(t,timing.squawk)*profile.rebound+MOA_BOUNCE.squawkChest*breath;
    result.bodyY=.09*breath;result.headY=.07*breath;
    result.headScale=1+.065*breath;result.neckWidth=1+.10*inhale-.045*(first+second);
    result.tail=-.08*breath;
  }
  result.torso=clamp(result.torso,.78,1.22);
  return result;
}
