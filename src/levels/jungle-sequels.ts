import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { makeTempleWorld, templePoint, templeLocal, templeFrame, templeSourceHeight } from './jungle-temple-space';

type Point = readonly [number, number];
type Kind = NonNullable<CustomComponent['kind']>;
export interface TemplePipe { name: string; a: number; b: number; lipY: number; radius: number; arc: number; baseY: number; }
export interface TempleGap { a: number; b: number; y: number; switchX?: number; group?: number; }
export interface TempleRoom { name: string; x: number; y: number; launchX: number; capY: number; switchX?: number; group?: number; }
export interface TempleClimb { a: number; b: number; base: number; top: number; steps: number; side: number; }
export interface TempleRoute {
  id: string; data: CustomLevelData; sourceComponents:CustomComponent[]; toWorld:(s:number,y:number,z?:number)=>[number,number,number]; toLocal:(p:readonly number[])=>[number,number,number]; frameAt:(s:number)=>ReturnType<typeof templeFrame>; groundAt:(s:number)=>number; profile: readonly Point[]; pipes: TemplePipe[];
  gaps: TempleGap[]; rooms: TempleRoom[]; climbs: TempleClimb[]; peak: number; end: number;
}

// Jungle Ruins' playable temple terrace is 11.5m high. These routes reach
// three and six times that elevation; geometry and movement tuning are separate.
export const JUNGLE_ORIGINAL_TERRACE = 11.5;
const WIDTH = 8, STONE = '#c8bc94', JADE = '#79a996', GOLD = '#cfb36c';
const round = (n: number) => Math.round(n * 10000) / 10000;

function templeCourse(variant: 1 | 2, profile: readonly Point[], end: number) {
  const components: CustomComponent[] = [], pipes: TemplePipe[] = [], gaps: TempleGap[] = [], rooms: TempleRoom[] = [];
  const climbs: TempleClimb[] = [];
  const groups: CustomGroup[] = [
    {id:1,nm:'Temple masonry and continuous skating lines',editorOnly:true},
    {id:2,nm:'Jade transition pipes',editorOnly:true},
    {id:3,nm:'Gold grind alternatives',editorOnly:true},
    {id:4,nm:'Crate decisions and rewards',editorOnly:true},
    {id:5,nm:'Checkpoints and course finish',editorOnly:true},
    {id:6,nm:'Winding temple camera spine',editorOnly:true},
    {id:7,nm:'Solid temple storeys and sanctuary halls',editorOnly:true},
    {id:90,nm:'Jungle temple scenery',editorOnly:true},
    {id:91,nm:'Planted earth banks and canopy',editorOnly:true},
    {id:92,nm:'Weathered paving and reservoir gateways',editorOnly:true},
    {id:93,nm:'Roofed courts and sanctuaries',editorOnly:true},
    {id:94,nm:'Enclosing jungle ravine',editorOnly:true},
  ];
  const add = (c: CustomComponent) => components.push(c);
  const slab = (a: number, b: number, y: number, nm: string, z = 0, depth = WIDTH) => {
    add({t:'platform',p:[(a+b)/2,y-.65,z],s:[b-a,1.3,depth],tex:'jungle',color:STONE,grp:1,nm});
  };
  const slope = (a: number, b: number, ya: number, yb: number, nm: string) => {
    add({t:'ramp',p:[(a+b)/2,Math.min(ya,yb),0],len:b-a,rise:Math.abs(yb-ya),w:WIDTH,
      yaw:yb>=ya?-90:90,tex:'jungle',color:STONE,grp:1,nm});
  };
  const climb = (a:number,b:number,base:number,top:number,steps:number) => {
    const side=-7.5,span=(b-a)/steps;
    climbs.push({a,b,base,top,steps,side});
    slab(a-10,a,base,'Overgrown stair approach',side,5);
    for(let i=0;i<steps;i++){
      const y=base+(top-base)*(i+1)/steps;
      slab(a+i*span,a+(i+1)*span,y,`Jungle temple climbing step ${i+1}`,side,5);
      components.push({t:'wumpa',p:[a+(i+.55)*span,y+1,side],grp:4,nm:'Stepped ascent fruit trail'});
    }
    slab(b,b+8,top,'Stair route reunion terrace',side,5);
  };
  const crate = (x: number, y: number, kind: Kind, nm: string, z = -2, grp = 4, outline = false) =>
    add({t:'crate',p:[x,y,z],kind,nm,grp,...(outline?{outline:true}:{})});
  const fruit = (x: number, y: number, z = 1.25) => add({t:'wumpa',p:[x,y+1,z],grp:4,nm:'Readable skating line'});
  const line = (a: number,b: number,ya: number,yb=ya) => {
    for(let x=a;x<=b;x+=4)fruit(x,ya+(yb-ya)*(x-a)/(b-a||1));
  };
  const rail = (a:number,b:number,ya:number,yb:number,nm:string,z=1.35) => {
    add({t:'rail',p:[a,ya,z],pts:[[0,0],[b-a,0,0,yb-ya]],color:GOLD,grp:3,nm});
  };
  const checkpoint = (x:number,y:number,nm:string) => add({t:'checkpoint',p:[x,y,1.1],grp:5,nm});
  const bonus = (x:number,y:number,nm:string) => add({t:'bonusplatform',p:[x,y,-1.7],to:[x+3.8,y+.12,1.25],grp:5,nm});
  const pipe = (a:number,b:number,lipY:number,radius:number,nm:string) => {
    const arc=60, deck=2, angle=arc*Math.PI/180;
    const baseY=round(lipY-radius*(1-Math.cos(angle)));
    const flat=round((b-a)/2-radius*Math.sin(angle)-deck);
    // The cross-section is along +X, so both lips meet the side-view route.
    // Crestable walls preserve forward flow; the wider later pipes reward
    // pumping and airborne transfers without requiring a blind reversal.
    add({t:'vertramp',p:[(a+b)/2,baseY,0],len:WIDTH*2,w:flat,rise:radius,arc,deck,
      arcSteps:24,vkind:'half',yaw:0,rails:false,tex:'jungle',color:JADE,grp:2,nm});
    pipes.push({name:nm,a,b,lipY,radius,arc,baseY});
    for(const side of [-1,1])add({t:'wall',p:[(a+b)/2,baseY-.1,side*(WIDTH+.35)],s:[b-a+4,lipY-baseY+1.2,.6],tex:'stone',color:'#b5b69c',grp:2,nm:`${nm} solid side retaining wall`});
    for(const x of [a+2,(a+b)/2,b-2])fruit(x,x===(a+b)/2?baseY:lipY);
    // A narrow upper grind is an optional score line, offset behind the
    // central pumping path; it has supported takeoff and landing aprons.
    rail(a-4,b+4,lipY+.65,lipY+.65,`${nm} high aqueduct rail`,-2.5);
  };
  const gap = (a:number,b:number,y:number,nm:string,switchX?:number,group?:number) => {
    add({t:'pit',p:[(a+b)/2,y-7,0],s:[b-a,1,WIDTH],grp:1,nm});
    gaps.push({a,b,y,switchX,group});
    if(switchX!==undefined&&group!==undefined){
      groups.push({id:group,nm:`${nm} · independent switch circuit`});
      // A bounded mesh is the existing outline-supported terrain primitive.
      const w=(b-a)/2,h=.6,d=WIDTH/2;
      add({t:'mesh',p:[(a+b)/2,y-h,0],vertices:[-w,-h,-d,w,-h,-d,w,h,-d,-w,h,-d,-w,-h,d,w,-h,d,w,h,d,-w,h,d],
        indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5],
        color:JADE,tex:'jungle',outline:true,grp:group,nm:`${nm} visible materialising bridge`});
      crate(switchX,y,'bang','Create the visible jade bridge before skating across',-2.3,group);
    }
  };
  const preserve = (x:number,y:number,nm:string,returnSwitch?:number,group?:number) => {
    // The shelf is too high for an ordinary double jump. Its wooden arrow is
    // a finite access tool, so the upper reward must precede the final smash.
    crate(x,y,'bouncy',`${nm}: preserve the wooden arrow until the upper reward is collected`,-2.3);
    slab(x+2.4,x+7.4,y+7.8,`${nm} upper reward balcony`,-2.3,2.8);
    if(returnSwitch!==undefined&&group!==undefined){
      groups.push({id:group,nm:`${nm} · return reward circuit`});
      crate(returnSwitch,y,'bang',`${nm}: reveal the earlier balcony rewards`,-2.3,group);
      crate(x+4,y+7.8,'life',`${nm}: return after !, use the preserved arrow, then clear it`,-2.3,group,true);
      crate(x+6,y+7.8,'mystery',`${nm}: second return target`,-2.3,group,true);
    }else{
      crate(x+4,y+7.8,'life',`${nm}: high target before the arrow`,-2.3);
      crate(x+6,y+7.8,'wood',`${nm}: upper companion reward`,-2.3);
    }
    rooms.push({name:nm,x,y,launchX:x,capY:y+7.8,switchX:returnSwitch,group});
  };
  const recovery = (x:number,y:number,nm:string) => {
    // Deliberately off the fast central line, with six metres of clear refuge.
    crate(x,y,'tnt',`${nm}: prime from above, leave the marked refuge clear`,-2.3);
    crate(x,y+.96,'wood',`${nm}: collect the cap without a ground spin`,-2.3);
    crate(x+5.5,y,'mystery',`${nm}: safe recovery reward`,-2.3);
  };
  const finish = (y:number) => {
    add({t:'crystal',p:[end-20,y,1.25],grp:5,nm:'Temple summit crystal'});
    add({t:'gate',p:[end-8,y,0],yaw:90,grp:5,nm:'Temple sanctuary finish'});
    const startY=profile[0][1];
    // Deliberate step back from spawn; neither optional mode intersects the
    // ordinary forward skating line (their contact boxes are two metres wide).
    add({t:'clock',p:[-18,startY,-2.5],grp:5});

  };
  const result = ():TempleRoute => {
    const id=variant===1?'jungle-terraces':'jungle-skyline';
    const name=variant===1?'Temple Terraces':'Temple Skyline';
    const sourceComponents=components;
    const world=makeTempleWorld(sourceComponents,profile,variant);
    const toWorld=(s:number,y:number,z=0)=>templePoint(s,y,z,variant);
    return {id,profile,pipes,gaps,rooms,climbs,peak:Math.max(...profile.map(p=>p[1])),end,sourceComponents,toWorld,
      toLocal:(p:readonly number[])=>templeLocal(p,variant,sourceComponents,profile),
      frameAt:(s:number)=>templeFrame(s,variant),groundAt:(s:number)=>templeSourceHeight(sourceComponents,profile,s),
      data:{v:1,name,spawn:toWorld(-14,profile[0][1]+.12,1.25),killY:-18,sky:'day',
        jungleAtmosphere:true,keepPlayFog:true,cameraAirLift:.8,relicTime:variant===1?105:125,
        atmosphere:{fogNear:30,fogFar:155,fogColor:'#6b957c',ambientSky:'#aed8b7',ambientGround:'#645035',
          ambientIntensity:1.15,sunColor:'#fff0c2',sunIntensity:1.5},
        medalTimes:variant===1?{gold:105,silver:145,bronze:200}:{gold:125,silver:175,bronze:240},groups,components:world}};
  };
  return {slab,slope,climb,crate,line,rail,checkpoint,bonus,pipe,gap,preserve,recovery,finish,result};
}

const TERRACES_PROFILE: readonly Point[] = [[-20,0],[34,0],[80,9],[164,9],[234,22.5],[294,22.5],[354,34.5],[490,34.5]];
const a=templeCourse(1,TERRACES_PROFILE,490);
a.slab(-20,34,0,'Fern court: learn the reward and skating lanes');
a.crate(1,0,'mask','Protection before the first temple ascent');
for(const x of [9,13,17])a.crate(x,0,'wood','Opening spin rhythm, on supported stone',1.25);
a.checkpoint(25,0,'Fern court checkpoint before the upper-first room');
a.preserve(28,0,'Fern court upper-first lesson');
a.slope(34,80,0,9,'First broad temple bank');a.line(40,76,1.17,8.22);
a.slab(80,108,9,'First pipe observation terrace');
a.crate(88,9,'multihit','Optional striped rhythm on the quiet back edge');
a.pipe(108,144,9,6,'Jade teaching halfpipe');
a.slab(144,164,9,'Wide halfpipe recovery');a.checkpoint(151,9,'Lower aqueduct checkpoint');
a.slope(164,234,9,22.5,'Second temple processional bank');a.line(170,226,10.16,20.96);
a.climb(168,234,9,22.5,6);
a.rail(176,218,12.1,20.2,'Ascending aqueduct grind',-2.5);
a.slab(234,256,22.5,'Switch court: bridge and landing are both visible');
a.crate(239,22.5,'wood','Slow down at the switch court');
a.bonus(242,22.5,'Jade Reservoir bonus entrance off the skating line');
a.gap(256,268,22.5,'Jade bridge trial',249,20);
a.slab(268,294,22.5,'Jade bridge reward terrace');
for(const x of [275,278,281])a.crate(x,22.5,'wood','Rewards after the created bridge',1.25);
a.slope(294,354,22.5,34.5,'Three-times-high temple ascent');a.line(300,348,23.7,33.3);
a.slab(354,378,34.5,'Summit observation and checkpoint');a.checkpoint(359,34.5,'Summit checkpoint before the fuse court');
a.recovery(366,34.5,'Summit fuse court');
a.pipe(378,424,34.5,9,'High sanctuary halfpipe');
a.slab(424,438,34.5,'Clear approach to the sanctuary jump');
a.slab(438,452,34.5,'Flat sanctuary ollie approach after the temple turn');
a.gap(452,458,34.5,'Six-metre sanctuary ollie');a.rail(447,465,35.2,35.2,'Sanctuary gap grind alternative',-2.5);
a.slab(458,490,34.5,'Broad sanctuary landing and finish');
for(const x of [463,466])a.crate(x,34.5,'mystery','Landing rewards set behind the clear touchdown',-2.3);
a.finish(34.5);

const SKYLINE_PROFILE: readonly Point[] = [[-20,0],[50,0],[140,17.25],[250,17.25],[340,34.5],[464,34.5],[510,46],[594,46],[642,57.5],[650,57.5],[694,57.5],[764,69],[818,69]];
const b=templeCourse(2,SKYLINE_PROFILE,818);
b.slab(-20,50,0,'High temple arrival and open skating runway');
b.crate(0,0,'mask','Protection for the skyline route');
for(const x of [10,14,18])b.crate(x,0,'wood','Three-box skating pickup line',1.25);
b.checkpoint(26,0,'Arrival checkpoint before the return-gallery puzzle');
b.preserve(31,0,'Return-gallery plan',45,30);
b.slope(50,140,0,17.25,'Long rolling ascent to the fifth temple tier');b.line(58,132,1.53,15.72);
b.rail(72,124,4.92,14.89,'Fifth-tier long rising grind',-2.5);
b.slab(140,172,17.25,'Pipe approach with space to build speed');
b.crate(149,17.25,'multihit','Optional rhythm box clear of the pipe takeoff');
b.pipe(172,222,17.25,12,'Cloud aqueduct halfpipe');
b.slab(222,250,17.25,'Cloud aqueduct recovery and checkpoint');b.checkpoint(231,17.25,'Cloud aqueduct checkpoint');
b.recovery(239,17.25,'Cloud fuse lesson reprise');
b.slope(250,340,17.25,34.5,'Six-times-high temple crown bank');b.line(258,332,18.78,32.97);
b.climb(258,340,17.25,34.5,8);
b.rail(268,323,21.6,32.14,'Crown bank gold grind',-2.5);
b.slab(340,384,34.5,'Crown court: visible bridge then uninterrupted pipe line');
b.checkpoint(346,34.5,'Crown court checkpoint before final skating sequence');
b.bonus(362,34.5,'Sun-Crown Treasury bonus entrance off the skating line');
b.crate(354,34.5,'bouncy','Preserve crown arrow for the upper life crate',-2.3);
b.crate(354,43.9,'life','Crown upper target before destroying its arrow',-2.3);
b.gap(384,396,34.5,'Crown bridge',374,31);
b.slab(396,400,34.5,'Crown bridge pipe entry');
b.pipe(400,452,34.5,14,'Sun crown halfpipe');
b.slab(452,464,34.5,'Sun crown downhill entry');
b.slope(464,510,34.5,46,'Rising sun passage through the fourth storey');b.line(470,502,36,44);
b.pipe(510,568,46,18,'Giant jade halfpipe');
b.slab(568,594,46,'Giant pipe recovery');b.checkpoint(578,46,'Final aqueduct checkpoint');
b.slope(594,642,46,57.5,'Fifth-storey winding temple bank');b.line(602,642,47.6,55.8);
b.rail(604,642,49.1,58.2,'Descending aqueduct finale',-2.5);
b.slab(642,650,57.5,'Flat final ollie apron above the temple court');
b.gap(650,657,57.5,'Seven-metre final skate jump');b.rail(642,665,58.2,58.2,'Final gap gold grind',-2.5);
b.slab(657,694,57.5,'Deep sanctuary landing after the skyline run');
for(const x of [667,670,673])b.crate(x,57.5,'mystery','Finish rewards beyond the clear touchdown',-2.3);
b.slope(694,764,57.5,69,'Last temple storey: climb onto the sanctuary core');
b.line(702,754,58.8143,67.3571);
b.slab(764,818,69,'Upper temple terrace and playable sanctuary hall');
b.checkpoint(771,69,'Sanctuary core checkpoint');
b.finish(69);

export const JUNGLE_TERRACES_ROUTE=a.result();
export const JUNGLE_SKYLINE_ROUTE=b.result();
export const JUNGLE_TERRACES_LEVEL=JUNGLE_TERRACES_ROUTE.data;
export const JUNGLE_SKYLINE_LEVEL=JUNGLE_SKYLINE_ROUTE.data;
export const JUNGLE_SEQUEL_ROUTES=[JUNGLE_TERRACES_ROUTE,JUNGLE_SKYLINE_ROUTE] as const;
