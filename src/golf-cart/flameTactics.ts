/** Damage-only side flames: one short burst, then a timed refill. */
export const CART_FLAMES={burst:.7,recharge:6,prediction:.4,startGrace:.8};
export interface FlameBody {x:number;y:number;z:number;vx:number;vy:number;vz:number}

/** Stratified slots prevent a lucky random draw from charging the whole grid
 * together. The race seed shuffles who gets each slot, including the human. */
export function initialFlameRecharge(count:number,seed:number):number[]{
  let state=(seed^0x6a09e667)>>>0||1;
  const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
  const slots=Array.from({length:count},(_,i)=>CART_FLAMES.startGrace+
    (CART_FLAMES.recharge-CART_FLAMES.startGrace)*(i+.2+.6*random())/count);
  for(let i=count-1;i>0;i--){const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  return slots;
}

/** Earliest overlap with either actual side-jet damage volume. Sweeping relative
 * velocity catches an overtaking kart before it draws level; a receding kart,
 * someone directly ahead/behind, or someone on another height is not a target. */
export function sideFlameContact(source:FlameBody&{yaw:number},target:FlameBody,horizon=0):number|null {
  const sin=Math.sin(source.yaw),cos=Math.cos(source.yaw);
  const dx=target.x-source.x,dz=target.z-source.z,vx=target.vx-source.vx,vz=target.vz-source.vz;
  const side=dx*cos-dz*sin,along=dx*sin+dz*cos;
  const sideSpeed=vx*cos-vz*sin,alongSpeed=vx*sin+vz*cos;
  let first=Infinity;
  for(const sign of [-1,1]){
    let enter=0,leave=horizon;
    for(const [p,v,lo,hi] of [[side*sign,sideSpeed*sign,1.2,5.8],[along,alongSpeed,-2.1,2.1],[target.y-source.y,target.vy-source.vy,-3,3]]){
      if(Math.abs(v)<1e-8){if(p<=lo||p>=hi){leave=-1;break;}}
      else{const a=(lo-p)/v,b=(hi-p)/v;enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));}
    }
    if(enter<=leave&&leave>=0)first=Math.min(first,enter);
  }
  return Number.isFinite(first)?first:null;
}
