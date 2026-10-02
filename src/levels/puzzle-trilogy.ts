import type { CustomComponent, CustomGroup, CustomLevelData, LevelEntry } from '../level';

/** Source-owned experiments derived from docs/PLATFORMER_PUZZLE_RESEARCH.md.
 * All contacts, attack rules, timers and rewards use the existing toolkit.
 * Permanent anchors keep collecting breakable bridge boxes from soft-locking a run.
 */
type Kind = NonNullable<CustomComponent['kind']>;
type Foe = NonNullable<CustomComponent['foe']>;
export interface PuzzleSection { name:string; a:number; b:number; y:number; idea:string }
export interface PuzzleAction {
  kind:'walk'|'jump'|'switch'|'bounce'|'enemy'|'tnt'|'mover'|'phase'|'crumble'|'spinbridge';
  x:number; y:number; to?:number; top?:number; foe?:Foe; note:string;
}
const CUBE = {
  vertices:[-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices:[0,2,1,0,3,2, 4,5,6,4,6,7, 0,1,5,0,5,4,
    3,7,6,3,6,2, 0,4,7,0,7,3, 1,2,6,1,6,5],
};
const PALETTES = [
  {deck:'#708c8d',edge:'#ddbc76',back:'#354f60',sky:'day' as const},
  {deck:'#6e7694',edge:'#e3ac65',back:'#343649',sky:'sunset' as const},
  {deck:'#686c86',edge:'#e0be75',back:'#252e43',sky:'night' as const},
];

function course(index:number,name:string,end:number) {
  const colors=PALETTES[index], components:CustomComponent[]=[], groups:CustomGroup[]=[
    {id:1,nm:'Permanent terraces and retry anchors',editorOnly:true},
    {id:2,nm:'Crate and enemy puzzles',editorOnly:true},
    {id:3,nm:'Side camera and depth boundaries',editorOnly:true},
    {id:4,nm:'Machinery',editorOnly:true},
    {id:5,nm:'Visual foundry backdrop',editorOnly:true},
  ];
  const sections:PuzzleSection[]=[], actions:PuzzleAction[]=[];
  const add=(c:CustomComponent)=>components.push(c);
  const visual=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,nm:string)=>
    add({t:'mesh',p:[x,y,z],s:[w,h,d],...CUBE,solid:false,tex:'solid',color,grp:5,nm});
  const deck=(a:number,b:number,y:number,nm:string)=>{
    add({t:'platform',p:[(a+b)/2,(y-6)/2,0],s:[b-a,y+6,5.4],
      tex:'stone',color:colors.deck,edgeGrinding:false,grp:1,nm});
    // A warm front fascia frames the real top without adding another collider.
    visual((a+b)/2,y-.18,2.74,b-a,.24,.12,colors.edge,`${nm} brass edge`);
    for(let x=a+1.5;x<b-1;x+=4.5)
      visual(x,y-2.7,2.78,.32,4.8,.18,colors.back,`${nm} pier ribs`);
  };
  const crate=(x:number,y:number,kind:Kind,nm:string,grp=2)=>
    add({t:'crate',p:[x,y,0],kind,grp,nm});
  const shelf=(a:number,b:number,y:number,nm:string)=>{
    add({t:'platform',p:[(a+b)/2,y-.3,0],s:[b-a,.6,5.4],tex:'stone',color:colors.deck,edgeGrinding:false,grp:1,nm});
    visual((a+b)/2,y-.18,2.74,b-a,.24,.12,colors.edge,`${nm} brass edge`);
  };
  const fruit=(x:number,y:number)=>add({t:'wumpa',p:[x,y,0],grp:2,nm:'Visible route breadcrumb'});
  const arc=(a:number,b:number,y:number,rise=1.5)=>{
    for(let i=0;i<=4;i++){const t=i/4;fruit(a+(b-a)*t,y+.9+Math.sin(t*Math.PI)*rise);}
  };
  const enemy=(x:number,y:number,foe:Foe,range:number,speed=1.7)=>{
    add({t:'enemy',p:[x,y,0],foe,range,speed,grp:2,nm:`${foe}: ${foe==='turtle'?'stomp the shell':foe==='spiker'?'spin, avoid the spikes':foe==='spinner'?'wait for retraction':foe==='charger'?'read the windup':foe==='floater'?'spin during the low swoop':'read and attack'}`});
    actions.push({kind:'enemy',x,y,foe,note:'Patrol stays entirely on its supported terrace.'});
  };
  const checkpoint=(x:number,y:number)=>add({t:'checkpoint',p:[x,y,0],grp:1,nm:'Safe puzzle bank and retry point'});
  const section=(name:string,a:number,b:number,y:number,idea:string)=>sections.push({name,a,b,y,idea});
  const jump=(x:number,y:number,to:number,top=y,note='Fruit arc marks takeoff and destination.')=>{
    actions.push({kind:'jump',x,y,to,top,note});arc(x,to,Math.max(y,top));
  };
  const bridge=(a:number,b:number,y:number,buttonX:number,buttonY:number,grp:number,nm:string)=>{
    groups.push({id:grp,nm});
    crate(buttonX,buttonY,'bang',`${nm} local ! switch`,grp);
    add({t:'mesh',p:[(a+b)/2,y-.3,0],s:[b-a,.6,5.4],...CUBE,
      outline:true,tex:'stone',color:colors.edge,edgeGrinding:false,grp,nm:`${nm} outlined permanent bridge`});
    actions.push({kind:'switch',x:buttonX,y:buttonY,to:b,top:y,note:'Hit ! before entering its visible outline bridge; no other circuit shares this group.'});
    arc(a+.6,b-.6,y,.4);
  };
  const anchors=(a:number,b:number,y:number,pitch:number,kind:Kind='metal')=>{
    for(let x=a+.8;x<b-.5;x+=pitch){
      crate(x,y,kind,'Permanent gap retry anchor',1);
      if(kind==='metal')crate(x,y+.96,'wood','Breakable reward above permanent footing');
    }
  };
  const clear=(x:number,y:number)=>{
    crate(x,y,'nitrobang','Green ! clears the visible Nitro field');
    actions.push({kind:'switch',x,y,note:'Green ! detonates all Nitro, using the existing level-wide rule.'});
  };
  const flip=(x:number,y:number,span:number,nm:string,yaw=0)=>{
    add({t:'spinbridge',p:[x,y,0],s:[span,.34,1.6],yaw,cycle:.55,tex:'wood',color:'#b77c43',grp:4,nm});
    actions.push({kind:'spinbridge',x,y,to:x+Math.cos(yaw*Math.PI/180)*span,top:y,
      note:'Spin the upright timber directly. It rotates into a solid bridge and stays deployed; a later checkpoint banks the changed route.'});
  };
  const finish=(x:number,y:number)=>{
    add({t:'gate',p:[x,y,0],yaw:90,grp:1,nm:'Finish after the final safe landing'});
    for(const z of [-.83,.83])add({t:'wall',p:[end/2,-14,z],s:[end+32,44,.6],invisible:true,grp:3,nm:'One-line side-scrolling boundary'});
    add({t:'zone',p:[end/2,0,0],s:[end+32,1,18],dir:'E',grp:3,nm:'Normal eastbound side-scroll view'});
    add({t:'camnode',p:[-12,0,0],radius:5,grp:3});
    add({t:'camnode',p:[end+8,0,0],radius:5,grp:3});
    // Repeating recessed arches give depth without concealing the silhouette.
    for(let x=-6;x<end+8;x+=14){
      visual(x,-1,-5,11,12,.6,colors.back,'Recessed foundry wall');
      visual(x-4.7,2.8,-4.55,.6,12,.5,colors.deck,'Backdrop arch pier');
      visual(x+4.7,2.8,-4.55,.6,12,.5,colors.deck,'Backdrop arch pier');
      visual(x,8.1,-4.5,10,.6,.65,colors.edge,'Backdrop brass lintel');
      if(index===2)add({t:'torch',p:[x,-.6,-3.6],rise:3,w:.5,grp:5,nm:'Foundry lantern'});
    }
  };
  const data=():CustomLevelData=>({v:1,name,spawn:[-5,.12,0],killY:-12,hudMode:'bonus',
    sky:colors.sky,components,groups});
  return {add,deck,shelf,crate,fruit,arc,enemy,checkpoint,section,jump,bridge,anchors,clear,flip,finish,data,actions,sections};
}

const a=course(0,'Crate Primer',160);
a.section('1 · Read the box',-8,20,0,'Safe reward boxes, a visible grunt, then one ordinary gap.');
a.deck(-8,16,0,'Open teaching terrace');
a.crate(-2,0,'mask','Protection for the first combat lesson');
a.crate(2,0,'wood','Spin or stomp on supported ground');
a.crate(6,0,'multihit','Five bounces or one spin: optional rhythm lesson');
a.enemy(12,0,'grunt',1.4,1.2);
a.jump(14,0,21,.6);
a.section('2 · Choose the attack',20,42,.6,'Turtle rejects spin; its stomp creates a rebound.');
a.deck(20,42,.6,'Shell lesson landing');
a.enemy(28,.6,'turtle',1.7,1.1);
a.crate(35,.6,'bouncy','Hold jump for the high reward');
a.crate(35,9.8,'life','Upper box: collect before destroying its wooden arrow');
a.section('3 · Change the crossing',42,56,.6,'Spin two upright timbers into permanent bridges; the route you create supports the rewards and the return trip.');
a.flip(42,.6,6,'First timber crossing — spin to deploy');
a.deck(48,50,.6,'Safe hinge-to-hinge rest pier');
a.flip(50,.6,6,'Second timber crossing — spin to deploy');
for(const x of [43.8,47,51.2,54.4])a.crate(x,.6,'wood','Reward on the newly deployed timber route');
a.arc(42.5,55.5,.6,.3);
a.section('4 · Preserve the key',56,100,.6,'Keep the wooden arrow, reach the high !, collect the upper boxes, then return to clear the arrow.');
a.deck(56,80,.6,'Key-room staging terrace');a.checkpoint(59,.6);
a.crate(63,.6,'bouncy','Preserve this launch until the upper key and boxes are claimed');
a.shelf(66,74,8,'High key gallery');
a.crate(67,8,'wood','Upper gallery box 1');a.crate(69,8,'mystery','Upper gallery box 2');
a.bridge(80,100,.6,72,8,10,'First materialisation circuit');
a.actions.push({kind:'bounce',x:63,y:.6,to:68,top:8,note:'Bounce to the high gallery and activate !; descend left and destroy the arrow only after its work is done. Early spinning the arrow loses the key route until checkpoint retry.'});
a.section('5 · Combine the rules',100,160,.6,'Checkpoint, rebound gap, spiked foe, then a green Nitro switch.');
a.deck(100,118,.6,'Switch reward terrace');a.checkpoint(104,.6);
a.crate(107,.6,'tnt','Stomp primes a three-second fuse');
a.crate(109.4,.6,'wood','Selective middle reward between separated TNT');
a.crate(111.8,.6,'tnt','Second fuse: retreat onto clear permanent floor');
a.actions.push({kind:'tnt',x:107,y:.6,to:116,note:'Collect middle wood without spinning either red neighbor, then prime a fuse and retreat; explosions finish the cluster.'});
a.crate(114,.6,'wood','Reward at the next takeoff');
a.crate(121,.6,'metalbounce','Permanent arrow anchor in the gap',1);
a.jump(116,.6,121,1.56);a.jump(121,1.56,125,1.2);
a.deck(124,160,1.2,'Final synthesis terrace');a.enemy(131,1.2,'spiker',1.2,1.3);
a.clear(138,1.2);
for(const x of [144,145,146])a.crate(x,1.2,'nitro','Green danger field: clear or jump for a mastery line');
a.crate(149,1.2,'mystery','Final reward after the cleared field');
a.finish(155,1.2);

const b=course(1,'Switchyard',228);
b.section('1 · Bounce to the gallery',-8,42,0,'Higher reward line and a raised switch approach.');
b.deck(-8,22,0,'Gallery admission');b.crate(-2,0,'mask','Shield for the machinery route');
b.crate(5,0,'multihit','Lower finite bounce support: do not spin the stack yet');
b.crate(5,.96,'multihit','Upper finite bounce support');
b.crate(5,9,'life','Upper-first target: lost if both striped supports are cleared early');
b.crate(14,0,'wood','Admission stepping box: no alternate arrow for the finite-stack cap');
b.shelf(16,20,2.8,'Optional visible life perch');b.crate(18,2.8,'life','Reward for controlling the high bounce');
b.jump(20,0,24,1.4);b.deck(22,42,1.4,'First switch balcony');b.enemy(26,1.4,'spiker',1,1.5);
b.crate(32,1.4,'bouncy','Preserve the switch-gallery launcher');b.shelf(34,40,9,'High gallery key perch');
b.crate(35,9,'wood','Upper key-gallery reward');
b.bridge(42,57,1.4,38,9,10,'Gallery bridge circuit');
b.actions.push({kind:'bounce',x:32,y:1.4,to:36,top:9,note:'Reach the high switch before clearing the wooden launcher; then descend to remove it and cross the new bridge.'});
b.section('2 · Opposite attack rules',57,80,1.4,'Turtle followed by spiker; reset at a safe bank before the gap.');
b.deck(57,80,1.4,'Paired enemy lesson');b.enemy(64,1.4,'turtle',1.8,1.3);b.enemy(73,1.4,'spiker',1.5,1.5);b.checkpoint(78,1.4);
b.section('3 · Crate staircase',80,120,1.4,'Preserve low metal anchors, use the arrow for the upper workshop.');
b.anchors(81,88,1.4,3,'metal');b.crate(89,1.4,'metalbounce','Workshop elevation anchor',1);
b.jump(78,1.4,82,2.36);b.jump(82,2.36,85);b.jump(85,2.36,89);b.jump(89,2.36,94,2.8);
b.deck(92,120,2.8,'Upper explosive workshop');
b.crate(101,2.8,'tnt','Low TNT: head-bump and landing timing');
b.crate(101,3.76,'wood','Reward above a fuse');
b.crate(101,11.8,'life','Upper-first reward needs the intact fuse-stack height');
b.crate(105,2.8,'wood','Safe retreat reward');b.crate(109,2.8,'tnt','Second separated fuse');
b.enemy(115,2.8,'spinner',0,1);
b.actions.push({kind:'tnt',x:101,y:2.8,to:112,note:'Take the stacked wood, prime TNT, retreat; do not spin an explosive stack.'});
b.section('4 · Machinery crossing',120,151,2.8,'A moving receiver is visible from a safe waiting terrace.');
b.flip(120,2.8,4.5,'Workshop entry drawbridge — permanently deployed');
b.deck(124.5,126.5,2.8,'Workshop bridge lever pier');
b.flip(126.5,2.8,3.5,'Workshop exit drawbridge — permanently deployed');
b.arc(119,125,2.8);b.arc(125,131,2.8);b.deck(130,151,2.8,'Machinery checkpoint');b.checkpoint(134,2.8);
b.crate(136,2.8,'bouncy','Return-loop launch: save it until after the far !');
b.bridge(151,169,2.8,147,2.8,11,'Independent workshop circuit');
b.add({t:'mesh',p:[141.5,10.9,0],s:[7,.6,5.4],...CUBE,outline:true,tex:'stone',color:'#e3ac65',edgeGrinding:false,grp:11,nm:'Return gallery appears only after the outward switch'});
for(const x of [140,142,144])b.crate(x,12.4,'wood','New upper row: activate, backtrack, bounce, clear',11);
b.actions.push({kind:'bounce',x:136,y:2.8,to:141,top:11.2,note:'First go right to !147, then return to the conserved arrow136, collect the newly materialized high row, descend, and clear the arrow last.'});
b.section('5 · Windup and cleanup',169,196,2.8,'A charger telegraph precedes a Nitro field and a safe clear switch.');
b.deck(169,196,2.8,'Charge recovery apron');b.enemy(177,2.8,'charger',3.2,1.8);b.clear(184,2.8);
for(const x of [189,190,191,192])b.crate(x,2.8,'nitro','Later Nitro field; same green rule');
b.section('6 · Finite footing finale',196,228,2.8,'Crumble landing, step up, then an attack-rule reprise.');
b.add({t:'crumble',p:[199,2.8,0],s:[3.6,.6,5.4],shake:1.1,tex:'wood',color:'#c3a56c',grp:4,nm:'Warning-before-collapse crossing'});
b.actions.push({kind:'crumble',x:194,y:2.8,to:204,top:4,note:'Cross the warning deck without lingering; the next permanent landing is higher.'});
b.arc(195,203,3.4);b.deck(202,228,4,'Final rule reprise');b.enemy(208,4,'turtle',1,1.3);b.enemy(218,4,'spiker',1,1.5);b.crate(224,4,'mystery','Mastery reward');b.finish(225,4);

const c=course(2,'Clockwork Gauntlet',286);
c.section('1 · Anchor relay',-8,38,0,'Immediately remix high rewards, spiked contact and destructible bridge footing.');
c.deck(-8,22,0,'Foundry intake');c.crate(-2,0,'mask','Opening gauntlet shield');c.enemy(10,0,'spiker',1.7,1.8);
c.crate(17,0,'bouncy','Preserve the intake launch until the upper box is gone');c.crate(17,9.2,'life','High reward needs the intact wooden arrow');
c.crate(27,0,'metalbounce','First relay arrow',1);c.crate(29,1.2,'metal','Relay retry anchor',1);c.crate(29,2.16,'wood','Relay reward');c.crate(33,0,'metalbounce','Second relay arrow',1);
c.jump(21.6,0,27,.96);c.jump(27,.96,29,2.16);c.jump(29,2.16,33,.96);c.jump(33,.96,40,1.6);
c.section('2 · Selective explosive stack',38,77,1.6,'A fuse stack and a local bridge switch require order before departure.');
c.deck(38,59,1.6,'Fuse stack staging area');c.checkpoint(41,1.6);
c.crate(47,1.6,'tnt','Bottom fuse');c.crate(47,2.56,'wood','Selective airborne reward');c.crate(47,3.52,'tnt','Top fuse rejects a careless spin');
c.crate(47,9.8,'life','Upper-first reward: preserve the high TNT support until claimed');
c.crate(51,1.6,'multihit','Five-hit reward on the safe retreat side');
c.actions.push({kind:'tnt',x:47,y:1.6,to:53,note:'Approach the middle wood from the side; prime or evade the TNT, then retreat to the right apron.'});
c.bridge(59,77,1.6,55,1.6,10,'Fuse-room bridge circuit');
c.section('3 · Attack rhythm',77,104,1.6,'Stomp-only armor then a retracting spinner; safe wait positions surround both.');
c.deck(77,104,1.6,'Armor and blade gallery');c.checkpoint(80,1.6);c.enemy(87,1.6,'turtle',2,1.6);c.enemy(97,1.6,'spinner',0,1);
c.section('4 · Phase windows',104,145,1.6,'Two phased crossings separated by a permanent rest island.');
for(const [x,phase] of [[107,0],[119,.5]])c.add({t:'phasepad',p:[x,1.6,0],s:[4.2,.6,5.4],cycle:4.8,amp:.68,phase,color:'#d6a25c',grp:4,nm:'Read the pulse from a permanent waiting deck'});
c.deck(110,116,1.6,'Phase relay rest island');c.deck(122,145,2.8,'Phase exit and charge apron');c.checkpoint(126,2.8);
c.flip(110,1.66,6,'Phase relay return shortcut — spin open once',180);
c.flip(122,2.86,6,'Upper phase return shortcut — spin open once',180);
c.actions.push({kind:'phase',x:102,y:1.6,to:112,top:1.6,note:'Wait on permanent floor; use each lit solid window and depart before its warning ends, with a separate rest island.'});
c.actions.push({kind:'phase',x:114,y:1.6,to:124,top:2.8,note:'The offset phase prevents one memorised input cadence from solving both crossings.'});
c.enemy(136,2.8,'charger',3.4,2);
c.section('5 · Lift and second circuit',145,191,2.8,'A vertical receiver feeds a higher blade room and a separately wired bridge.');
c.add({t:'mover',p:[150,3.4,0],s:[4,.6,5.4],axis:'y',amp:1.2,speed:.75,phase:0,tex:'stone',color:'#daa960',grp:4,nm:'Vertical receiver between different deck heights'});
c.actions.push({kind:'mover',x:143,y:2.8,to:157,top:4,note:'Board the lift low, leave near the high deck, then wait for the spinner opening.'});
c.arc(144,150,3.4);c.arc(150,156,4);c.deck(155,174,4,'Upper blade room');c.enemy(157,4,'spinner',0,1);
c.crate(162,4,'bouncy','Second return circuit: conserve this wooden arrow');
c.bridge(174,191,4,170,4,11,'Upper independent circuit');
c.add({t:'mesh',p:[166,12.1,0],s:[6,.6,5.4],...CUBE,outline:true,tex:'stone',color:'#e0be75',edgeGrinding:false,grp:11,nm:'Second outward-then-return high gallery'});
for(const x of [165,167,168])c.crate(x,13.6,'wood','Activated upper row: preserve launch and return',11);
c.actions.push({kind:'bounce',x:162,y:4,to:166,top:12.4,note:'Wait through the blade window, pass the arrow intact, activate !170, return for the high row, then destroy the arrow.'});
c.section('6 · Air threat and Nitro gallery',191,233,4,'A swooping foe interrupts the route to a high clearing perch.');
c.deck(191,233,4,'Nitro gallery');c.checkpoint(195,4);c.enemy(207,4,'floater',2,1.6);
c.crate(216,4,'bouncy','Conserve this launch for BOTH high galleries');c.shelf(219,223,12.4,'High Nitro clearing perch');c.clear(221,12.4);
for(const x of [225,226,227])for(let row=0;row<3;row++)c.crate(x,4+row*.96,'nitro','Three-high danger wall below the clear perch');
c.actions.push({kind:'bounce',x:216,y:4,to:221,top:12.4,note:'First bounce to green !221 to clear the wall; keep the same arrow for the later backward sweep.'});
c.bridge(200,211,12.4,233.5,4,12,'Final return circuit');
for(const x of [201,204,208])c.crate(x,13.6,'mystery','Last return row: appears only after the far !',12);
c.actions.push({kind:'bounce',x:216,y:4,to:208,top:12.4,note:'After green !, advance to !233.5, return left using the still-intact arrow216, clear the new upper gallery, come back right, and only now spin the arrow.'});
c.crate(232,4,'life','Reward beyond the Nitro wall');
c.section('7 · Composed finale',233,286,4,'Explosive selection, a ranged telegraph, and finite footing before the final step.');
c.deck(233,255,4,'Final attack and fuse apron');c.crate(237,4,'tnt','Final selective fuse');c.crate(239.4,4,'multihit','Commit to five bounces only when the enemy window allows');c.crate(241.8,4,'tnt','Second final fuse');
c.enemy(249,4,'sentry',0,1);
c.add({t:'crumble',p:[259,4,0],s:[4,.6,5.4],shake:.85,tex:'wood',color:'#c5a263',grp:4,nm:'Final finite landing, familiar mechanic'});
c.actions.push({kind:'crumble',x:253,y:4,to:265,top:5.2,note:'Read the sentry windup from permanent floor, cross the crumble pad, land on the last terrace.'});
c.arc(254,259,4);c.arc(259,264,5.2);c.deck(263,286,5.2,'Final mastery landing');c.crate(271,5.2,'mystery','Visible final reward');c.crate(275,5.2,'wood','Last collectible on permanent floor');c.finish(281,5.2);

export const PUZZLE_LEVELS:LevelEntry[]=[
  {id:'crate-primer',name:'Crate Primer',data:a.data()},
  {id:'switchyard',name:'Switchyard',data:b.data()},
  {id:'clockwork-gauntlet',name:'Clockwork Gauntlet',data:c.data()},
];
/** Authoring/test evidence; never drives gameplay or changes player state. */
export const PUZZLE_SECTIONS:Record<string,PuzzleSection[]>={
  'crate-primer':a.sections,'switchyard':b.sections,'clockwork-gauntlet':c.sections,
};
export const PUZZLE_ACTIONS:Record<string,PuzzleAction[]>={
  'crate-primer':a.actions,'switchyard':b.actions,'clockwork-gauntlet':c.actions,
};
