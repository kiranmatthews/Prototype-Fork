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

const smooth=(t:number)=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};
/** Deck-local pose: +Z length, +X width, +Y grip. The rider's lift and foot
 * flick are applied after the ordinary sole/contact solver, never to physics. */
export function sampleDeckTrick(kind:DeckTrickKind,progress:number) {
  const trick=deckTrickInfo(kind),t=Math.max(0,Math.min(1,progress));
  const motion=smooth((t-.08)/.78),clearance=smooth(t/.18)*(1-smooth((t-.72)/.28));
  const hard=kind==='hardflip'||kind==='inward-heel';
  return {
    roll:trick.roll*2*Math.PI*motion,yaw:trick.yaw*2*Math.PI*motion,
    pitch:trick.pitch*2*Math.PI*motion+(hard?Math.sin(Math.PI*motion)*.85:0),
    deckDrop:clearance*(kind==='imposs'?.28:.07),
    orbitY:kind==='imposs'?-.28*Math.sin(2*Math.PI*motion):0,
    orbitZ:kind==='imposs'?-.28*(1-Math.cos(2*Math.PI*motion)):0,
    riderLift:clearance*(kind==='imposs'?.23:.16),
    tuck:clearance,
    flick:Math.sin(Math.PI*smooth(t/.48))*(trick.roll<0?-1:1),
  };
}
