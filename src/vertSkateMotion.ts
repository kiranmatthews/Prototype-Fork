import * as THREE from 'three';

const clamp = (v:number,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth = (v:number) => {const t=clamp(v);return t*t*(3-2*t);};
/** A hump: nothing at `a` and at `b`, one midway, and level at both ends. */
const hump = (p:number,a:number,b:number) => {const s=Math.sin(Math.PI*clamp((p-a)/(b-a)));return s*s;};
/** The same -1..1 every time for the same whole number: what makes one air unlike the next. */
const scatter = (n:number,salt:number) => {const x=Math.sin(n*12.9898+salt*78.233)*43758.5453;return 2*(x-Math.floor(x))-1;};

export interface SpineTransferMotion {
  progress:number;
  tuck:number;
  reach:number;
  rebound:number;
  /** Share of the turn the body has made. It goes against the turn first, is
   * driven late and hard, runs past the far wall and comes back to it. */
  turn:number;
  /** Radians the chest is ahead of the deck about the turn's axis: the throw.
   * Negative late on, when it is held back to stop the turn. */
  lead:number;
  /** Radians the head is ahead of the chest again: it finds the landing first. */
  head:number;
  /** Radians the leading and the trailing arm stand off the body. The leading
   * one goes up and over toward the far side and reaches for it; the trailing
   * one comes out late, half as far, and is left behind him. They are never
   * level: `fore` carries the first forward of the chest and the second back. */
  arms:[number,number];
  fore:[number,number];
  /** Radians the deck hangs behind the feet's own turn, then whips through. */
  boardLag:number;
  /** Radians the body rocks out of the plane of the turn. */
  wobble:number;
  /** Radians the shoulders come round about the body's own length. */
  twist:number;
  /** 0..1: the transfer owns the upper body, and the hang's idle stops adding to it. */
  busy:number;
  /** 0..1: how much of what the idle was still doing has been taken off him.
   * Slower than `busy`: his arms were swinging, and they are not cut off. */
  hold:number;
}

/** One finite gather, rollover and extension into the receiving transition.
 * It is thrown, not turned: a wind-up against the turn, the head and chest
 * going over first with the arms, the deck dragged round after them, too far,
 * and caught. `variant` (a whole number, one per transfer) moves the timing
 * and the size of each part a little, so two in a row are not the same. */
export function sampleSpineTransfer(elapsed:number,duration:number,variant=0):SpineTransferMotion {
  const p=clamp(elapsed/Math.max(.001,duration));
  const a=scatter(variant,1),b=scatter(variant,2),c=scatter(variant,3);
  // The upper body runs a little early in one transfer and a little late in the next.
  const q=Math.pow(p,1+.10*a);
  // A short transfer has no time for a long wind-up or a long way past: what
  // it would have to do in three frames it does less of, and it starts its
  // drive sooner. Measured against an even turn of the same length this keeps
  // the hardest moment (the catch) near three times as hard, at any length.
  const size=clamp(duration/.5,.5,1.2),lag=Math.min(1,size);
  const drive=smooth(Math.pow(clamp((p-.11*lag)/(1-.31*lag)),1.14));
  return {progress:p,
    tuck:smooth(p/.18)*(1-smooth((p-.44)/.42)),
    reach:smooth(p/.30)*(1-smooth((p-.72)/.28)),
    rebound:Math.sin(Math.PI*clamp((p-.72)/.28))*(1-smooth((p-.86)/.14)),
    // (the small beat on top of the drive is the hitch of a body that is being heaved, not spun)
    turn:drive-.024*size*hump(p,0,.26)+(.058+.014*b)*size*hump(p,.70,1)+.011*Math.sin(2*Math.PI*2.4*p+Math.PI*c)*hump(p,.14,.92),
    lead:(.40+.07*b)*hump(q,.02,.62)-(.19+.04*a)*hump(q,.60,1),
    head:.30*hump(q,0,.56)-.08*hump(q,.60,1),
    arms:[(1.40+.20*c)*hump(q,.05,.80)-.14*hump(q,0,.24)-.12*hump(q,.82,1),
      (.55+.12*b)*hump(q,.16,.88)-.20*hump(q,.02,.30)],
    fore:[.40*hump(q,.05,.70),-.62*hump(q,.16,.90)],
    boardLag:.16*hump(p,.10,.62)-.07*hump(p,.66,1),
    wobble:(.085+.03*b)*Math.sin(2*Math.PI*1.35*p+(c>0?0:Math.PI))*Math.sqrt(hump(p,0,1)),
    twist:(a>0?1:-1)*(.10+.06*Math.abs(b))*hump(p,.12,.78),
    busy:smooth(p/.06)*(1-smooth((p-.88)/.12)),
    hold:smooth(p/.26)*(1-smooth((p-.84)/.16)),
  };
}

/** How far the drawn turn is ahead of (or behind) the even one the simulation
 * and the camera follow, as a share of the whole turn. */
export function spineTransferTurnOffset(motion:SpineTransferMotion):number {
  return motion.turn-smooth(motion.progress);
}

/** Interpolate rotations through wheels-down, never normalize a lerp between
 * opposite normals (which stalls on one wall, then snaps to the other). */
export function spineTransferNormal(from:THREE.Vector3,to:THREE.Vector3,progress:number,out:THREE.Vector3):THREE.Vector3 {
  const up=new THREE.Vector3(0,1,0);
  const a=new THREE.Quaternion().setFromUnitVectors(up,from);
  const b=new THREE.Quaternion().setFromUnitVectors(up,to);
  return out.copy(up).applyQuaternion(a.slerp(b,smooth(progress))).normalize();
}

// ------------------------------------------------------------ the vert air --
// A vert air with nothing asked of it is not a held pose. The deck is thrown
// up the wall and the rider goes with it by his feet: on the way up his chest,
// head and arms hang back down the wall; at the top everything comes level,
// floats, and he folds over the board and finds the lip; on the way down they
// trail up the wall while his legs reach for it, and with the wall coming he
// stops trailing and gets ready for it. Every part follows on its own spring,
// the loose ones (the arms) swinging past and coming back, so nothing arrives
// together and a knock (a box headed, a lip clipped) goes through him.

export interface VertAirInput {
  /** In a vert air on the board, with no trick, grab or bail owning the body. */
  active:boolean;
  /** Metres per second, rising positive, and the speed he left the lip at. */
  verticalVelocity:number;
  launchVelocity:number;
  /** 0..1: something else (a spine transfer) has the upper body for now. */
  busy:number;
  /** A whole number, one per air: its small differences from the last one. */
  variant:number;
  /** Seconds, for the slow drift that never repeats inside one air. */
  time:number;
  reset?:boolean;
}
export interface VertAirArm {
  /** Radians the arm hangs back from the motion: down the wall, positive. */
  trail:number;
  /** Radians it stands off the body. */
  spread:number;
  /** Radians it is carried toward the chest's side (negative: behind him). */
  swing:number;
  /** Radians more bend at the elbow, and of flop at the wrist. */
  elbow:number;
  wrist:number;
}
/** Everything is about the hang's own axes — the rider's length (the wall's
 * normal), the way up the wall, and across it — so it reads the same on any
 * wall, in either stance, and through a spin. */
export interface VertAirPose {
  weight:number;
  /** Radians the body tips about the across-wall axis: head up the wall, positive. */
  lean:number;
  /** Radians the spine and chest bend further, the same way: the curve of it. */
  bow:number;
  /** Radians the shoulders open toward up the wall (down it, when negative). */
  twist:number;
  /** Radians he folds forward over his toes. */
  crouch:number;
  /** Radians the head tips up the wall on top of the body, and turns to look. */
  head:number;
  look:number;
  /** The arm on the up-the-wall side, then the other. */
  arms:[VertAirArm,VertAirArm];
  /** Radians more knee bend (less, when negative: the reach). */
  knee:number;
  /** Metres the hips hang back up the wall (positive) and sit toward the chest. */
  hipAlong:number;
  hipAcross:number;
  /** Radians the deck is loose under his feet about each of the three axes. */
  boardPitch:number;
  boardRoll:number;
  boardYaw:number;
  /** 0..1 how hard the arms are being thrown about: it lengthens them. */
  fling:number;
}

/** A spring stepped exactly, so the motion does not depend on the frame rate. */
class Follow {
  x=0; v=0;
  constructor(private readonly rate:number,private readonly damping:number){}
  reset():void {this.x=this.v=0;}
  step(target:number,dt:number):number {
    const decay=this.rate*this.damping,turn=this.rate*Math.sqrt(1-this.damping*this.damping);
    const dx=this.x-target,e=Math.exp(-decay*dt),c=Math.cos(turn*dt),s=Math.sin(turn*dt);
    this.x=target+e*(dx*c+(this.v+decay*dx)/turn*s);
    this.v=e*(this.v*c-(decay*this.v+this.rate*this.rate*dx)/turn*s);
    return this.x;
  }
}

const follow=(spring:readonly [number,number])=>new Follow(spring[0],spring[1]);
/** [rate (1/s), damping]: under 1 swings past and settles. The trunk is firm,
 * the head firmer, the arms loose, and the two arms are not the same arm. */
const AIR_SPRINGS = {
  lean:[7.2,.50],bow:[8.4,.46],twist:[6.2,.58],crouch:[6.8,.62],head:[11,.70],look:[8,.68],
  trail:[[8.6,.36],[7.2,.32]],spread:[[9.0,.45],[7.8,.40]],swing:[[8.0,.42],[6.8,.38]],elbow:[[11,.50],[9.5,.46]],
  knee:[10,.56],hipAlong:[8,.60],hipAcross:[6,.65],boardPitch:[8.5,.48],boardRoll:[7.4,.46],boardYaw:[6.6,.52],
  work:[9,.9],
} as const;
/** How much of each: radians, except the hips in metres. */
export const VERT_AIR = {
  /** The body's trail behind the motion: on the way up, and on the way down. */
  lean:[.30,.24],bow:[.20,.16],
  /** The shoulders open the way he is going. */
  twist:.15,
  /** At the top he folds over the board and tucks his knees; coming down he reaches. */
  crouch:.07,tuck:.42,reach:.14,
  /** The head looks up the wall while it climbs, and has found the lip before the top. */
  look:[.14,.45],level:.80,
  /** The arms hang back from the motion (on the way up, on the way down; the
   * arm up the wall, then the other), stand off the body as it floats, and bend. */
  trail:[[1.05,.72],[.70,1.15]],spread:[.16,.60,.10],swing:[.22,-.18],carry:.25,elbow:[-.10,.45,.60],whip:.05,wrist:.08,
  /** They never stop working for balance: [always, more as he floats, more as he falls], and how much of it is fore and aft. */
  balance:[.08,.16,.10],fore:.9,
  /** The wall is coming: from [this much of the lip's speed, over this much more]
   * the arms come back down off the trail and forward of him, the elbows fold
   * [radians, radians], and the trunk squares up to the wall by this share. */
  brace:[.5,.5,.30,.25,.5],
  /** The hips lag the deck along the wall, and sit toward the chest at the top. */
  hips:[.07,.06,.03],
  /** The deck is not on rails. */
  board:[.10,.07,.12],
  /** The slow drift under all of it: [share, beats per second, beats per second].
   * The arms and the deck work about twice as fast as the trunk. */
  drift:[1,.83,1.37],quick:1.9,
} as const;

export class VertAirMotion {
  private weight=0;
  private wasActive=false;
  private variant=0;
  private readonly lean=new Follow(...AIR_SPRINGS.lean);
  private readonly bow=new Follow(...AIR_SPRINGS.bow);
  private readonly twist=new Follow(...AIR_SPRINGS.twist);
  private readonly crouch=new Follow(...AIR_SPRINGS.crouch);
  private readonly head=new Follow(...AIR_SPRINGS.head);
  private readonly look=new Follow(...AIR_SPRINGS.look);
  private readonly knee=new Follow(...AIR_SPRINGS.knee);
  private readonly hipAlong=new Follow(...AIR_SPRINGS.hipAlong);
  private readonly hipAcross=new Follow(...AIR_SPRINGS.hipAcross);
  private readonly boardPitch=new Follow(...AIR_SPRINGS.boardPitch);
  private readonly boardRoll=new Follow(...AIR_SPRINGS.boardRoll);
  private readonly boardYaw=new Follow(...AIR_SPRINGS.boardYaw);
  private readonly arm=[0,1].map(i=>({trail:follow(AIR_SPRINGS.trail[i]),spread:follow(AIR_SPRINGS.spread[i]),
    swing:follow(AIR_SPRINGS.swing[i]),elbow:follow(AIR_SPRINGS.elbow[i])}));
  /** How hard the arms are working for balance: eased, so it is never switched. */
  private readonly work=follow(AIR_SPRINGS.work);
  private all():Follow[] {
    return [this.lean,this.bow,this.twist,this.crouch,this.head,this.look,this.knee,this.hipAlong,this.hipAcross,
      this.boardPitch,this.boardRoll,this.boardYaw,this.work,...this.arm.flatMap(a=>[a.trail,a.spread,a.swing,a.elbow])];
  }
  reset():void {this.weight=0;this.wasActive=false;for(const follow of this.all())follow.reset();}

  step(dt:number,p:VertAirInput):VertAirPose|null {
    if(p.reset){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(p.active&&!this.wasActive)this.variant=p.variant;
    this.wasActive=p.active;
    this.weight+=((p.active?1:0)-this.weight)*(1-Math.exp(-(p.active?9:7)*t));
    // (on the first frame of an air its launch speed has not been written down yet)
    const launch=Math.max(6,Math.abs(p.launchVelocity),p.verticalVelocity);
    // +1 leaving the lip, 0 at the top, -1 coming back onto it.
    const u=p.active?clamp(p.verticalVelocity/launch,-1.25,1.25):0;
    const rise=Math.max(0,u),fall=Math.max(0,-u);
    const float=p.active?Math.exp(-(u/.45)*(u/.45)):0;
    const own=p.active?1-clamp(p.busy):0;
    const v=(salt:number)=>scatter(this.variant,salt);
    // Two slow beats that never line up, starting somewhere else in every air.
    const [share,beat,offbeat]=VERT_AIR.drift;
    const drift=(salt:number,pace=1)=>share*(Math.sin(2*Math.PI*(beat*pace*p.time+v(salt)))+.6*Math.sin(2*Math.PI*(offbeat*pace*p.time+v(salt+.5))))/1.6;
    const A=VERT_AIR;
    // The trail is worst leaving the lip and eases well before the top.
    const drag=Math.pow(rise,1.5);
    // Coming back to the wall he stops trailing and gets ready for it.
    const brace=smooth((fall-A.brace[0])/A.brace[1]),trailing=fall*(1-A.brace[4]*brace);
    const lean=this.lean.step(own*(-A.lean[0]*drag+A.lean[1]*trailing+.05*float*drift(21)),t);
    const bow=this.bow.step(own*(-A.bow[0]*drag+A.bow[1]*trailing+.05*float*v(11)),t);
    const twist=this.twist.step(own*(A.twist*u+.04*float*drift(22)),t);
    const crouch=this.crouch.step(own*float*(A.crouch+.03*drift(23)),t);
    // He looks where he is going, and that is the lip well before he gets to the top.
    const along=A.look[0]*rise-A.look[1]*smooth((.25-u)/.6);
    const head=this.head.step(own*(along-A.level*(lean+bow)),t);
    const look=this.look.step(own*.10*float*drift(24),t);
    const knee=this.knee.step(own*(A.tuck*float-A.reach*fall),t);
    const hipAlong=this.hipAlong.step(own*(-A.hips[0]*drag+A.hips[1]*fall),t);
    const hipAcross=this.hipAcross.step(own*float*(A.hips[2]+.015*drift(25)),t);
    const boardPitch=this.boardPitch.step(own*(float*(A.board[0]*v(12)+.05*drift(26))+.05*u),t);
    const boardRoll=this.boardRoll.step(own*(.4+.6*float)*(A.board[1]*drift(27,A.quick)+.04*v(13)),t);
    const boardYaw=this.boardYaw.step(own*((.4+.6*float)*A.board[2]*drift(28,A.quick)+.05*v(14)),t);
    // (The balance work rides on top of the springs: it is quicker than a loose
    // arm can follow, and a spring would swallow it.)
    const working=this.work.step(own*(A.balance[0]+A.balance[1]*float+A.balance[2]*fall),t);
    const spread=own*(A.spread[0]+A.spread[1]*float+A.spread[2]*fall);
    const bend=own*(A.elbow[0]*rise+A.elbow[1]*float+A.elbow[2]*fall+A.brace[3]*brace);
    const reach=1-.9*brace;
    let thrown=0;
    const arms=this.arm.map((arm,i)=>{
      const lopsided=1+(i?-1:1)*.15*v(15);
      const pose={
        trail:arm.trail.step(own*(A.trail[i][0]*drag-A.trail[i][1]*fall*reach+(i?.06*v(16):0)),t)+working*drift(31+i,A.quick),
        spread:arm.spread.step(spread*lopsided*(i?.9:1),t),
        // (coming down, the arm up the wall is carried forward of him: it is going to the lip first)
        swing:arm.swing.step(own*(A.swing[i]*float+(i?0:A.carry)*fall*reach+A.brace[2]*brace),t)+A.fore*working*drift(29+i,A.quick),
        // (an arm that is being thrown folds at the elbow, and its forearm follows late)
        elbow:arm.elbow.step(bend*(i?1.15:1)+Math.min(.5,A.whip*Math.abs(arm.trail.v)),t),
        wrist:clamp(-A.wrist*arm.trail.v,-.5,.5),
      };
      thrown+=Math.abs(arm.trail.v)+.5*Math.abs(arm.spread.v);
      return pose;
    }) as [VertAirArm,VertAirArm];
    // Nothing of it is drawn under a five-hundredth of its weight: it is over, and the next air starts from rest.
    if(!p.active&&this.weight<.002){this.reset();return null;}
    return {weight:this.weight,lean,bow,twist,crouch,head,look,arms,knee,hipAlong,hipAcross,boardPitch,boardRoll,boardYaw,
      fling:clamp(thrown/9)};
  }
}
