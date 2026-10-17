import type { EnemyAnimationFrame } from './types';

type Keys = readonly (readonly [seconds: number, value: number])[];
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
function sample(keys:Keys,time:number):number {
  for(let i=1;i<keys.length;i++)if(time<keys[i][0]){
    const [a,x]=keys[i-1],[b,y]=keys[i];return x+(y-x)*smooth((time-a)/(b-a));
  }
  return keys[keys.length-1][1];
}

/** Presentation beats within the existing .45 s crouch / ballistic hop.
 * Keep recovery separate from the next load, lead with the hind-leg kick,
 * and finish the reach before the fixed-step physics touches down (~.70 s).
 * The first airborne pose is the fully loaded crouch, so no joint pops free.
 */
const LOAD:Keys=[[0,0],[.22,0],[.45,1]];
const RELEASE:Keys=[[0,1],[.085,0]];
const KICK:Keys=[[0,0],[.085,1],[.22,0]];
const TUCK:Keys=[[0,0],[.14,0],[.29,1],[.39,1],[.54,0]];
const REACH:Keys=[[0,0],[.41,0],[.53,1],[.68,0]];
const LAND:Keys=[[0,0],[.05,1],[.12,-.32],[.18,.06],[.22,0]];

export function sampleFrogHop(frame:EnemyAnimationFrame) {
  const crouch=frame.alive&&frame.state==='crouch',leap=frame.alive&&frame.state==='leap';
  const t=Math.max(0,frame.stateTime);
  return {
    load:crouch?sample(LOAD,t):leap?sample(RELEASE,t):0,
    kick:leap?sample(KICK,t):0,
    tuck:leap?sample(TUCK,t):0,
    reach:leap?sample(REACH,t):0,
    land:crouch?sample(LAND,t):0,
  };
}
