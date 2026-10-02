import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

/** Original compact rooms based on PLATFORMER_PUZZLE_RESEARCH.md. The kit
 * shares measured movement dimensions; each parent authors its own sequence. */
export type BonusPattern = 'upper' | 'finite' | 'bridge' | 'return' | 'fuse' | 'relay';
type Kind = NonNullable<CustomComponent['kind']>;
export interface BonusStyle {
  color: string; accent: string; tex: string;
  sky: 'day' | 'sunset' | 'night' | 'coast'; jungleAtmosphere?: boolean;
}
export interface BonusRoomCrate { role: string; x: number; y: number; kind: Kind; name: string }
export interface BonusRoom {
  pattern: BonusPattern; index: number; a: number; b: number; floorY: number;
  crates: BonusRoomCrate[]; launchX?: number; switchX?: number; group?: number;
  shelf?: { a: number; b: number; y: number }; gap?: { a: number; b: number };
  anchors?: number[]; refugeX?: number;
}
export interface BonusAction { pattern: BonusPattern; room: number; instruction: string }
export interface BonusCourse { data: CustomLevelData; rooms: BonusRoom[]; actions: BonusAction[] }
const CUBE = {
  vertices: [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices: [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5],
};
const WIDTHS: Record<BonusPattern, number> = { upper: 28, finite: 24, bridge: 34, return: 34, fuse: 26, relay: 28 };
const INSTRUCTIONS: Record<BonusPattern, string> = {
  upper: 'Use the wooden arrow to claim the high gallery, then descend and destroy the arrow last.',
  finite: 'Retain both striped supports until the overhead cap is collected; each contact spends one of five bounces.',
  bridge: 'Activate the local switch before committing to its visible outline bridge and landing rewards.',
  return: 'Pass the arrow intact, use the far switch, return for the newly revealed high row, then clear the arrow.',
  fuse: 'Stomp the wood above TNT for the overhead cap; return to prime TNT and retreat to the clear refuge.',
  relay: 'Air-spin the wooden caps while retaining the steel stepping stones above the chasm.',
};

export function makeBonusCourse({ name, patterns, style }: {
  name: string; patterns: readonly BonusPattern[]; style: BonusStyle;
}): BonusCourse {
  const components: CustomComponent[] = [], rooms: BonusRoom[] = [], actions: BonusAction[] = [];
  const groups: CustomGroup[] = [
    { id: 1, nm: 'Supported terraces and permanent receiver stones', editorOnly: true },
    { id: 2, nm: 'Ordered crate decisions', editorOnly: true },
    { id: 3, nm: 'Side-view camera and depth containment', editorOnly: true },
  ];
  const deck = (a: number, b: number, y = 0, nm = 'Supported bonus court', outline = false, group = 1) => {
    components.push({ t: 'mesh', p: [(a+b)/2, y-.45, 0], s: [b-a,.9,6.4], ...CUBE,
      tex: style.tex, color: style.color, edgeGrinding: false, grp: group, nm,
      ...(outline ? { outline: true } : {}) });
  };
  const crate = (room: BonusRoom, role: string, x: number, y: number, kind: Kind, outline = false) => {
    const name = `Room ${room.index + 1} ${room.pattern}: ${role}`;
    components.push({ t: 'crate', p: [x,y,0], kind, grp: outline || kind === 'bang' ? room.group : 2, nm: name,
      ...(outline ? { outline: true } : {}) });
    room.crates.push({ role, x, y, kind, name });
  };
  const fruitArc = (a: number, b: number, y: number, rise = 1.4) => {
    for (let n=0;n<5;n++) components.push({ t: 'wumpa', p: [a+(b-a)*n/4,y+1+Math.sin(n/4*Math.PI)*rise,0], grp: 2 });
  };
  deck(-10,0,0,'Bonus arrival and observation');
  let a = 0;
  patterns.forEach((pattern,index) => {
    const b=a+WIDTHS[pattern], room: BonusRoom = { pattern,index,a,b,floorY:0,crates:[] };
    rooms.push(room); actions.push({ pattern,room:index,instruction:INSTRUCTIONS[pattern] });
    if (pattern === 'bridge') {
      room.group=20+index;room.switchX=a+5;room.gap={a:a+11,b:a+23};
      groups.push({id:room.group,nm:`Room ${index+1} independent aqueduct circuit`});
      deck(a,a+11);deck(a+23,b);
      deck(a+11,a+23,0,'Visible bridge created by its local switch',true,room.group);
      crate(room,'local switch',a+5,0,'bang');
      crate(room,'receiver reward',a+27,0,'wood');crate(room,'receiver mystery',a+30,0,'mystery');
      fruitArc(a+11,a+23,0,.35);
    } else if (pattern === 'relay') {
      room.gap={a:a+7,b:a+21};room.anchors=[a+9.2,a+12.4,a+15.6,a+18.8];
      deck(a,a+7);deck(a+21,b);
      room.anchors.forEach((x,n) => {
        crate(room,`steel anchor ${n+1}`,x,0,'metal');
        crate(room,`consumable cap ${n+1}`,x,.96,'wood');
      });
      fruitArc(a+5.5,a+9.2,.96);fruitArc(a+18.8,a+22,.96);
    } else {
      deck(a,b);
      if (pattern === 'upper' || pattern === 'return') {
        room.launchX=a+7;room.shelf={a:a+10,b:a+17,y:pattern==='return'?8.4:7.8};
        const returns=pattern==='return';
        if (returns) {
          room.group=20+index;room.switchX=a+23;
          groups.push({id:room.group,nm:`Room ${index+1} independent return-gallery circuit`});
        }
        crate(room,'conserved arrow',room.launchX,0,'bouncy');
        deck(room.shelf.a,room.shelf.b,room.shelf.y,'Upper reward gallery',returns,returns?room.group:1);
        const rewardY=room.shelf.y+(returns?1.2:0);
        crate(room,'upper life',a+12,rewardY,'life',returns);
        crate(room,'upper mystery',a+15,rewardY,'mystery',returns);
        if (returns) crate(room,'far reveal switch',room.switchX!,0,'bang');
        fruitArc(a+7,a+11,3,3);
      } else if (pattern === 'finite') {
        room.launchX=a+8;
        crate(room,'lower finite support',a+8,0,'multihit');
        crate(room,'upper finite support',a+8,.96,'multihit');
        crate(room,'upper cap',a+8,9,'life');
        components.push({t:'wumpa',p:[a+8,6.7,0],grp:2});
      } else if (pattern === 'fuse') {
        room.launchX=a+8;room.refugeX=a+3.5;
        crate(room,'timed support',a+8,0,'tnt');
        crate(room,'wooden takeoff cap',a+8,.96,'wood');
        crate(room,'upper cap before fuse',a+8,9,'life');
        crate(room,'refuge reward',a+15,0,'mystery');
        fruitArc(a+8,room.refugeX,0);
      }
    }
    if(room.gap)components.push({t:'pit',p:[(room.gap.a+room.gap.b)/2,-7,0],s:[room.gap.b-room.gap.a,1,6.4],grp:1,nm:'Visible chasm below the required crossing'});
    a=b;
  });
  deck(a,a+17,0,'Supported reward collection and bonus return');
  const gateX=a+10;
  components.push({t:'gate',p:[gateX,0,0],yaw:90,grp:1,nm:'Bonus return after the earned gem approach'});
  for(const z of [-.83,.83])components.push({t:'wall',p:[a/2,-14,z],s:[a+54,46,.6],invisible:true,grp:3,nm:'Single-plane side-scrolling boundary'});
  components.push(
    {t:'camnode',p:[-14,0,0],radius:0,grp:3},
    {t:'camnode',p:[a+21,0,0],radius:0,grp:3},
    {t:'camnode',p:[a/2,8,0],s:[a+54,48,18],cameraView:true,radius:1,
      cameraPosition:[0,5,24],cameraTarget:[0,2,0],cameraFollowDistance:42,cameraIntroDistance:0,
      cameraFov:48,cameraAspect:16/9,grp:3,nm:'Side view shows each support, target and receiver together'},
  );
  return { data:{v:1,name,spawn:[-6,.12,0],killY:-12,hudMode:'bonus',sky:style.sky,
    cameraAirLift:.85,...(style.jungleAtmosphere?{jungleAtmosphere:true}:{}),components,groups},rooms,actions };
}
