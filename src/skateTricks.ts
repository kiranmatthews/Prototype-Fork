/** Source-owned trick loadout. Directions are rider-relative on the board.
 * Gameplay, gate hints and the trick guide share these definitions. */
export const DECK_TRICKS = [
  {kind:'kick',label:'Kickflip',recipe:'LEFT / NEUTRAL + □ / F',hint:'tap {left} + {spin} (or {spin} alone) while airborne on the board',points:100,duration:.34,roll:1,yaw:0,pitch:0},
  {kind:'heel',label:'Heelflip',recipe:'RIGHT + □ / F',hint:'tap {right} + {spin} while airborne on the board',points:100,duration:.34,roll:-1,yaw:0,pitch:0},
  {kind:'shove',label:'Pop Shove-It',recipe:'DOWN + □ / F',hint:'tap {down} + {spin} while airborne on the board',points:100,duration:.32,roll:0,yaw:.5,pitch:0},
  {kind:'imposs',label:'Impossible',recipe:'UP + □ / F',hint:'tap {up} + {spin} while airborne on the board',points:100,duration:.42,roll:0,yaw:0,pitch:1},
  {kind:'varial',label:'Varial Kickflip',recipe:'DOWN + LEFT + □ / F',hint:'tap {down} + {left} + {spin} while airborne on the board',points:300,duration:.40,roll:1,yaw:.5,pitch:0},
  {kind:'varial-heel',label:'Varial Heelflip',recipe:'DOWN + RIGHT + □ / F',hint:'tap {down} + {right} + {spin} while airborne on the board',points:350,duration:.42,roll:-1,yaw:-.5,pitch:0},
  {kind:'hardflip',label:'Hardflip',recipe:'UP + LEFT + □ / F',hint:'tap {up} + {left} + {spin} while airborne on the board',points:300,duration:.42,roll:1,yaw:-.5,pitch:0},
  {kind:'inward-heel',label:'Inward Heelflip',recipe:'UP + RIGHT + □ / F',hint:'tap {up} + {right} + {spin} while airborne on the board',points:350,duration:.44,roll:-1,yaw:.5,pitch:0},
] as const;
export type DeckTrickKind = (typeof DECK_TRICKS)[number]['kind'];
export const deckTrickInfo = (kind: DeckTrickKind) => DECK_TRICKS.find(trick=>trick.kind===kind) ?? DECK_TRICKS[0];
export function deckTrickFromInput(x:number,y:number): DeckTrickKind {
  if(y>.4)return x<-.4?'hardflip':x>.4?'inward-heel':'imposs';
  if(y<-.4)return x<-.4?'varial':x>.4?'varial-heel':'shove';
  return x>.4?'heel':'kick';
}

export const GRAB_TRICKS = [
  {kind:'indy',label:'Indy',direction:'RIGHT / NEUTRAL',hint:'{right} + {grab}',points:300,rate:500,pitch:.6,roll:.5,rightArm:1.2,leftArm:-1.7},
  {kind:'melon',label:'Melon',direction:'LEFT',hint:'{left} + {grab}',points:300,rate:500,pitch:.6,roll:-.5,rightArm:-2,leftArm:1.2},
  {kind:'nose',label:'Nosegrab',direction:'UP',hint:'{up} + {grab}',points:300,rate:500,pitch:1.25,roll:0,rightArm:1.5,leftArm:-2.4},
  {kind:'tail',label:'Tailgrab',direction:'DOWN',hint:'{down} + {grab}',points:300,rate:500,pitch:-.75,roll:0,rightArm:-1.5,leftArm:1.7},
  {kind:'method',label:'Method',direction:'UP + LEFT',hint:'{up} + {left} + {grab}',points:350,rate:550,pitch:-.35,roll:-.95,rightArm:-2.5,leftArm:1.6},
  {kind:'mute',label:'Mute',direction:'UP + RIGHT',hint:'{up} + {right} + {grab}',points:350,rate:550,pitch:1.05,roll:.4,rightArm:-1.8,leftArm:1.6},
  {kind:'stalefish',label:'Stalefish',direction:'DOWN + LEFT',hint:'{down} + {left} + {grab}',points:350,rate:550,pitch:-.65,roll:-.65,rightArm:1.3,leftArm:-1.4},
  {kind:'japan',label:'Japan',direction:'DOWN + RIGHT',hint:'{down} + {right} + {grab}',points:350,rate:550,pitch:.2,roll:1.1,rightArm:1.8,leftArm:-2.2},
] as const;
export type GrabTrickKind = (typeof GRAB_TRICKS)[number]['kind'];
export const grabTrickInfo = (kind: GrabTrickKind) => GRAB_TRICKS.find(trick=>trick.kind===kind) ?? GRAB_TRICKS[0];
export function grabTrickFromInput(x:number,y:number): GrabTrickKind {
  if(y>.4)return x<-.4?'method':x>.4?'mute':'nose';
  if(y<-.4)return x<-.4?'stalefish':x>.4?'japan':'tail';
  return x<-.4?'melon':'indy';
}

export const GRIND_TRICKS = {
  normal:{label:'50-50',direction:'NEUTRAL',points:100,rate:300},
  nose:{label:'Nosegrind',direction:'UP',points:125,rate:330},
  five0:{label:'5-0',direction:'DOWN',points:125,rate:330},
  board:{label:'Boardslide',direction:'LEFT / RIGHT',points:200,rate:400},
  lip:{label:'Lipslide',direction:'LEFT / RIGHT · OVER THE RAIL',points:200,rate:400},
  smith:{label:'Smith Grind',direction:'DOWN + LEFT',points:150,rate:360},
  feeble:{label:'Feeble Grind',direction:'DOWN + RIGHT',points:150,rate:360},
  crook:{label:'Crooked Grind',direction:'UP + LEFT / RIGHT',points:150,rate:360},
} as const;
export type GrindStyle = keyof typeof GRIND_TRICKS;

/** Mechanical identity, independent of camera, rig axes and presentation lean.
 * +Z is the physical nose. A nosegrind loads the front hanger, not the tip
 * (tip/deck contact would be a noseslide). Smith stays on the approach side;
 * Feeble crosses it. A slide's entry path distinguishes board from lip. */
export const GRIND_CONTACTS = {
  normal: { support: 'both-trucks', pitch: 0, yaw: 0 },
  nose: { support: 'front-truck', pitch: .19, yaw: 0 },
  five0: { support: 'rear-truck', pitch: -.24, yaw: 0 },
  crook: { support: 'front-truck', pitch: .25, yaw: .48 },
  smith: { support: 'rear-truck', pitch: .23, yaw: .40 },
  feeble: { support: 'rear-truck', pitch: .23, yaw: -.40 },
  // Opposing ten-degree biases keep the slide silhouette off dead crosswise.
  board: { support: 'deck', pitch: 0, yaw: Math.PI * 80 / 180 },
  lip: { support: 'deck', pitch: 0, yaw: Math.PI * 100 / 180 },
} as const satisfies Record<GrindStyle, { support: string; pitch: number; yaw: number }>;

/** Hand names are relative to the rider's stance, never screen left/right.
 * Method = boned/tweaked Melon; Japan = tucked-knee Mute/Weddle. */
export const GRAB_CONTACTS = {
  indy: { hand: 'trailing', edge: 'toe', pitch: -.08, roll: .20, tuck: .06 },
  melon: { hand: 'leading', edge: 'heel', pitch: .08, roll: -.20, tuck: .06 },
  nose: { hand: 'leading', edge: 'nose', pitch: -.48, roll: 0, tuck: .10 },
  tail: { hand: 'trailing', edge: 'tail', pitch: .48, roll: 0, tuck: .10 },
  method: { hand: 'leading', edge: 'heel', pitch: -.25, roll: -.85, tuck: .16 },
  mute: { hand: 'leading', edge: 'toe', pitch: .08, roll: .20, tuck: .06 },
  stalefish: { hand: 'trailing', edge: 'heel', pitch: -.12, roll: -.30, tuck: .12 },
  japan: { hand: 'leading', edge: 'toe', pitch: -.22, roll: .92, tuck: .18 },
} as const satisfies Record<GrabTrickKind, { hand: string; edge: string; pitch: number; roll: number; tuck: number }>;

export const LIP_CONTACTS = {
  axle: { label: 'Axle Stall', support: 'both-trucks', pitch: 0, yaw: Math.PI / 2 },
  rock: { label: 'Rock to Fakie', support: 'deck', pitch: .04, yaw: 0 },
  nose: { label: 'Nose Stall', support: 'nose-tip', pitch: -.24, yaw: 0 },
  tail: { label: 'Tail Stall', support: 'tail-tip', pitch: .24, yaw: 0 },
} as const;
export type LipStyle = keyof typeof LIP_CONTACTS;

/** Damped compression/rebound. It is zero at contact and settles exactly,
 * allowing locked wheels/hangers/hands to remain fixed while knees bounce. */
export function skateContactBounce(age: number): number {
  if (age < 0 || age >= .65) return 0;
  return Math.sin(age * Math.PI / .18) * Math.exp(-age * 7.5) *
    (1 - smooth((age - .45) / .20));
}

/** The ollie and full backward rotation share their launch. Short segments
 * gather at inversion, then extend with a finite rebound into the catch. */
export function sampleBackflip(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const turn=t*t*t*(10+t*(-15+6*t));
  const compression=smooth(t/.30)*(1-smooth((t-.68)/.30));
  return {rotation:-2*Math.PI*turn,nosePitch:-.55*(1-smooth((t-.25)/.40)),compression,alignment:smooth(t/.12),
    grab:smooth((t-.10)/.28)*(1-smooth((t-.67)/.25)),
    rebound:Math.sin(Math.PI*Math.max(0,Math.min(1,(t-.78)/.22)))*(1-compression)};
}

const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
/** The shoe supplies a brief impulse, followed by a long angular coast.
 * Catch comes from the feet descending onto the deck's unchanged flight arc. */
function sampleToeHeelFlip(kind:'kick'|'heel',progress:number) {
  const t=Math.max(0,Math.min(1,progress)),u=Math.max(0,Math.min(1,(t-.14)/.68)),r=.12;
  const turn=u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)*(1-u)/(2*r*(1-r)):(u-r/2)/(1-r);
  const flick=smooth(t/.24)*(1-smooth((t-.30)/.37));
  const gather=smooth(t/.30);
  return {turn,yawTurn:turn,scoopFlip:false,arms:0,armSweep:0,counter:0,scoopSign:1,flick,scoop:0,rearContact:0,rearToe:0,bank:0,rock:0,flickSign:kind==='heel'?-1:1,noseReach:kind==='heel'?.32:.38,sideReach:kind==='heel'?.26:.20,
    heelLead:kind==='heel'?.65*smooth(t/.12)*(1-smooth((t-.36)/.30)):0,
    departure:smooth(t/.05)*(1-smooth((t-.08)/.10)),tuck:gather*(1-smooth((t-.65)/.35)),
    frontLift:.40*smooth((t-.10)/.22)*(1-smooth((t-.74)/.26)),
    backLift:.40*smooth(t/.22)*(1-smooth((t-.66)/.24)),
    nosePitch:-.48*(1-smooth((t-.18)/.44))};
}
/** A rear-foot tail scoop drives a pitched half-turn. The brief bank/rock
 * comes from that off-centre push, and settles before the front-foot catch. */
export function samplePopShoveIt(progress:number) {
  const t=Math.max(0,Math.min(1,progress)),u=Math.max(0,Math.min(1,(t-.10)/.76)),r=.17;
  const turn=u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)*(1-u)/(2*r*(1-r)):(u-r/2)/(1-r);
  const scoop=smooth(t/.24)*(1-smooth((t-.30)/.42));
  const settle=1-smooth((t-.67)/.17);
  return {turn,yawTurn:turn,scoopFlip:false,arms:0,armSweep:0,counter:0,scoopSign:1,flick:0,flickSign:0,noseReach:0,sideReach:0,heelLead:0,scoop,
    rearContact:1-smooth((t-.08)/.18),rearToe:.28*scoop,
    bank:.16*Math.sin(Math.PI*turn)*settle,rock:.11*Math.sin(2*Math.PI*turn)*settle,
    departure:smooth(t/.05)*(1-smooth((t-.08)/.10)),
    tuck:smooth(t/.30)*(1-smooth((t-.68)/.32)),
    frontLift:.42*smooth(t/.24)*(1-smooth((t-.63)/.25)),
    backLift:.42*smooth((t-.08)/.24)*(1-smooth((t-.80)/.20)),
    nosePitch:-.58*(1-smooth((t-.20)/.56))};
}
/** Rear-foot scoop starts the half-shove before the leading toe/heel
 * releases its flip. Both feet then leave the board to finish its own arc. */
export function sampleVarial(kind:'varial'|'varial-heel',progress:number) {
  const t=Math.max(0,Math.min(1,progress)),heel=kind==='varial-heel';
  const base=sampleToeHeelFlip(heel?'heel':'kick',t),shove=samplePopShoveIt(t);
  const arms=smooth(t/.14)*(1-smooth((t-.80)/.20));
  const scoop=smooth(t/.13)*(1-smooth((t-.14)/.28));
  return {...base,scoopFlip:true,yawTurn:shove.turn,scoop,scoopSign:heel?-1:1,noseReach:heel?.24:.30,sideReach:heel?.16:.18,
    rearContact:1-smooth((t-.025)/.13),rearToe:.18*scoop,
    frontLift:.60*smooth((t-.08)/.22)*(1-smooth((t-.68)/.24)),
    backLift:.60*smooth((t-.04)/.20)*(1-smooth((t-.76)/.24)),
    arms,armSweep:smooth((t-.56)/.34),counter:-.14*(heel?-1:1)*Math.sin(Math.PI*shove.turn)*arms};
}
/** Frontside tail scoop and kickflip release drive a steep, nose-first
 * passage. The feet gather clear before returning to the free board. */
export function sampleHardflip(progress:number) {
  const t=Math.max(0,Math.min(1,progress)),base=sampleVarial('varial',t);
  const passage=smooth((t-.03)/.18)*(1-smooth((t-.36)/.32));
  return {...base,scoopSign:-1,noseReach:.16,sideReach:.24,
    flick:smooth(t/.17)*(1-smooth((t-.26)/.30)),
    rock:-.95*passage,
    frontLift:.76*smooth((t-.02)/.19)*(1-smooth((t-.68)/.24)),
    backLift:.68*smooth((t-.02)/.22)*(1-smooth((t-.76)/.24)),
    counter:.18*Math.sin(Math.PI*base.yawTurn)*base.arms};
}
export function sampleFootFlip(kind:'kick'|'heel'|'shove'|'varial'|'varial-heel'|'hardflip',progress:number) {
  if(kind==='hardflip')return sampleHardflip(progress);
  if(kind==='shove')return samplePopShoveIt(progress);
  if(kind==='varial'||kind==='varial-heel')return sampleVarial(kind,progress);
  return sampleToeHeelFlip(kind,progress);
}
export const sampleKickflip=(progress:number)=>sampleFootFlip('kick',progress);
export const sampleHeelflip=(progress:number)=>sampleFootFlip('heel',progress);

/** The rear shoe rolls through the contact while its ankle draws a small
 * loop. Sliding contact on the deck and a moving axis make a foot wrap, not
 * a rigid prop hinged to one point under a stationary sole. */
export function sampleImpossible(progress:number) {
  const t=Math.max(0,Math.min(1,progress)),u=Math.max(0,Math.min(1,(t-.08)/.76)),r=.17;
  const turn=u<r?u*u/(2*r*(1-r)):u>1-r?1-(1-u)*(1-u)/(2*r*(1-r)):(u-r/2)/(1-r);
  const angle=2*Math.PI*turn,wrap=smooth(t/.12)*(1-smooth((t-.84)/.16));
  const wave=Math.sin(angle),raised=wave*wave*wrap;
  const free=wrap*(1-smooth((t-.68)/.20));
  const rearLift=.38*wrap+.18*raised;
  return {turn,angle,wrap,raised,rearLift,frontLift:rearLift+.60*free,frontOut:.38*free,
    rearBack:-.18*raised,rearSide:.09*wave*wrap,rearToe:.95*wave*wrap,
    rearYaw:.14*wave*wrap,rearRoll:.16*wave*wrap,
    slide:(.50*wave-.125*(1-Math.cos(angle)))*wrap,
    edge:Math.sin(Math.PI*turn)**2*wrap,
    arms:smooth(t/.16)*(1-smooth((t-.80)/.20)),
    armSweep:smooth((t-.58)/.32),counter:.10*Math.sin(2*angle)*wrap,
    catchWeight:smooth((t-.84)/.10),nosePitch:-.28*(1-smooth(t/.20))};
}
/** Deck-local pose: +Z length, +X width, +Y grip. The rider's lift and foot
 * flick are applied after the ordinary sole/contact solver, never to physics. */
export function sampleDeckTrick(kind:DeckTrickKind,progress:number) {
  const trick=deckTrickInfo(kind),t=Math.max(0,Math.min(1,progress));
  const motion=smooth((t-.08)/.78),clearance=smooth(t/.18)*(1-smooth((t-.72)/.28));
  const hard=kind==='inward-heel';
  const footFlip=kind==='kick'||kind==='heel'||kind==='shove'||kind==='varial'||kind==='varial-heel'||kind==='hardflip'?sampleFootFlip(kind,t):null;
  const impossible=kind==='imposs'?sampleImpossible(t):null;
  return {
    roll:trick.roll*2*Math.PI*(footFlip?footFlip.turn:motion)+(footFlip?.bank??0),yaw:trick.yaw*2*Math.PI*(footFlip?footFlip.yawTurn:motion),
    pitch:trick.pitch*2*Math.PI*(impossible?impossible.turn:motion)+(hard?Math.sin(Math.PI*motion)*.85:0)+(footFlip?.rock??0),
    deckDrop:footFlip?0:clearance*(kind==='imposs'?.28:.07),
    orbitY:kind==='imposs'?-.28*Math.sin(2*Math.PI*motion):0,
    orbitZ:kind==='imposs'?-.28*(1-Math.cos(2*Math.PI*motion)):0,
    riderLift:clearance*(kind==='imposs'?.23:.16),
    tuck:clearance,
    flick:Math.sin(Math.PI*smooth(t/.48))*(trick.roll<0?-1:1),
  };
}
