import type {CustomComponent} from '../level';
import type {SpaghettiPoint as P} from './spaghetti-rails';

/** Greybox jump language: amber takeoff chevrons, pale receiving brackets.
 * Both sit outside the three strands and have no collision or grind line. */
export function spaghettiJumpCues(takeoff:P,landing:P,forward:P,index:number):CustomComponent[] {
 const n=Math.hypot(forward[0],forward[2])||1,fx=forward[0]/n,fz=forward[2]/n;
 const yaw=Math.atan2(-fx,-fz)*180/Math.PI,result:CustomComponent[]=[];
 const chevron=[-.85,1,0,0,2,0,.85,1,0,.56,1,0,0,1.65,0,-.56,1,0];
 const bracket=[-.7,.6,0,-.7,2.1,0,-.4,2.1,0,-.4,.9,0,.7,.9,0,.7,.6,0];
 for(const side of [-1,1])for(const receiving of [false,true]){
  const at=receiving?landing:takeoff;
  // Hang below the rail plane so the balance meter does not cover the cue.
  result.push({t:'mesh',p:[at[0]-fz*side*6.8,at[1]-2.5,at[2]+fx*side*6.8],yaw,
   vertices:receiving?bracket:chevron,indices:receiving?[0,1,2,0,2,3,0,3,4,0,4,5]:[0,1,5,1,4,5,1,2,3,1,3,4],
   solid:false,scenerySolid:false,doubleSided:true,tex:'solid',color:receiving?'#d2eceb':'#ffcd55',emissive:receiving?'#27474b':'#66411a',
   grp:4,nm:`Jump ${index+1} / ${receiving?'receiving bracket':'takeoff chevron'} / ${side<0?'left':'right'}`});
 }
 return result;
}
