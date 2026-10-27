import type {CustomComponent,CustomLevelData} from '../level';
import {dressAncientGates,ANCIENT_GATES_ATMOSPHERE} from './ancient-gates-art';

/** Feet/deck heights throughout. Helpers own box centres. The original
 * spawn-to-gate route was 448m; this journey is 1,396m, without repeated rooms. */
export const ANCIENT_GATES_LENGTH=1396;
export const ANCIENT_GATES_SECTIONS=[
 {name:'Root Steps',a:-24,b:112,y:0,skill:'variable gaps and opposing enemy rules'},
 {name:'Split Gate',a:112,b:230,y:3,skill:'spin bridge, arrow ascent and falling steps'},
 {name:'Mossback Stair',a:230,b:350,y:5,skill:'rising landings and aerial encounters'},
 {name:'Counterweight Court',a:350,b:464,y:7,skill:'horizontal ferry into a vertical lift'},
 {name:'Hammer Gallery',a:464,b:598,y:14,skill:'crusher windows separated by broken floor'},
 {name:'Broken Aqueduct',a:598,b:711,y:9,skill:'committed skate jump into a descending grind'},
 {name:'Bristle Orchard',a:711,b:844,y:8,skill:'five different enemy reads on isolated ledges'},
 {name:'Lantern Crossing',a:844,b:950,y:6,skill:'fire breath and a disappearing staircase'},
 {name:'Wind Bells',a:950,b:1064,y:10,skill:'swing timing on narrow rising landings'},
 {name:'Sunken Switchyard',a:1064,b:1190,y:13,skill:'restore the descent, discover the bonus, catch a ferry'},
 {name:'Crown Ascent',a:1190,b:1294,y:8,skill:'two conserved launchers and an exposed summit'},
 {name:'Last Gate',a:1294,b:1390,y:24,skill:'descending crumble chain and a guarded final leap'},
] as const;
export const ANCIENT_GATES_CHECKPOINTS=[
 [105,3,0],[221,5,0],[343,7,0],[456,14,0],[589,9,0],[709,8,0],
 [835,6,0],[945,10,0],[1055,13,0],[1181,8,0],[1286,24,0],
] as const;
export const ANCIENT_GATES_DECKS:{a:number;b:number;y:number;name:string}[]=[];
const components:CustomComponent[]=[];
const add=(c:CustomComponent):void=>{components.push(c);};
let group=1;
const deck=(a:number,b:number,y:number,name:string,depth=6.4):void=>{
 ANCIENT_GATES_DECKS.push({a,b,y,name});
 add({t:'platform',p:[(a+b)/2,y-.6,0],s:[b-a,1.2,depth],tex:'checker',color:'#85918b',nm:name,grp:group});
};
const pit=(a:number,b:number,name:string):void=>add({t:'pit',p:[(a+b)/2,-9,0],s:[b-a,1,7],nm:name,grp:group});
const box=(x:number,y:number,kind:CustomComponent['kind'],nm:string,extra:Partial<CustomComponent>={}):void=>add({t:'crate',p:[x,y,0],kind,nm,grp:group,...extra});
const foe=(x:number,y:number,kind:CustomComponent['foe'],range:number,nm:string,speed=2):void=>add({t:'enemy',p:[x,y,0],foe:kind,range,speed,axis:'x',terrainSupports:true,nm,grp:group});
const fruit=(a:number,b:number,y:number,rise=1.8):void=>{
 for(let i=0;i<5;i++)add({t:'wumpa',p:[a+(b-a)*i/4,y+1.1+Math.sin(i/4*Math.PI)*rise,0],grp:group});
};
const risingFruit=(a:number,ay:number,b:number,by:number):void=>{
 for(let i=0;i<7;i++){const t=i/6;add({t:'wumpa',p:[a+(b-a)*t,ay+(by-ay)*t+Math.sin(t*Math.PI)*2.5,0],grp:group});}
};
const bridge=(x:number,y:number,span:number,nm:string):void=>add({t:'spinbridge',p:[x,y,0],s:[span,.4,6.4],cycle:.7,tex:'wood',color:'#9b7951',nm,grp:group});
const crumble=(x:number,y:number,width:number,nm:string,shake=.72):void=>add({t:'crumble',p:[x,y,0],s:[width,.65,5.6],shake,speed:30,nm,grp:group});
const crusher=(x:number,y:number,cycle:number,phase:number,nm:string):void=>add({t:'crusher',p:[x,y,0],s:[3.2,3.6,6.4],cycle,phase,nm,grp:group});
const bell=(x:number,y:number,speed:number,phase:number,nm:string):void=>add({t:'pendulum',p:[x,y+7,0],len:6,amp:.95,speed,phase,yaw:90,nm,grp:group});

// 1: the gaps change width and height. The second enemy punishes stomping.
deck(-24,6,0,'Gatehouse arrival');box(-6,0,'mask','Gatehouse guardian mask');
deck(10,18,1,'Low root tooth');deck(23,29,2.6,'High root tooth');deck(35,42,1.2,'Dropped root tooth');
deck(49,62,3,'Crab watch ledge');deck(68,87,3,'Bristle approach');
bridge(87,3,8,'First split timber gate');deck(95,112,3,'Root Steps refuge');
foe(56,3,'grunt',2.2,'Crab on the long landing',1.7);foe(77,3,'spiker',2.4,'Bristleback demands a spin',1.6);
box(15,1,'wood','First root offering');box(39,1.2,'mystery','Low root offering');
for(const [a,b,y] of [[6,10,0],[18,23,1],[29,35,1.8],[42,49,2],[62,68,3]]){pit(a,b,'Root ravine');fruit(a-.8,b+1,y);}
pit(87,95,'Timber gate ravine');

// 2: a safe read before a mine, deployable leaf, conserved arrow and falling receivers.
group=2;deck(112,131,3,'Split Gate fuse court');box(124,3,'nitro','Single visible gate mine');
bridge(131,3,8,'Second split timber gate');deck(139,155,3,'Arrow launch court');box(151,3,'metalbounce','Split Gate climb arrow');
deck(159,179,10,'First gate parapet');crumble(183,9.5,4.2,'Falling lintel one');
crumble(192,8,4,'Falling lintel two');crumble(200,6.5,4,'Falling lintel three');deck(205,230,5,'Split Gate recovery');
box(171,10,'life','Parapet reward');pit(131,139,'Split timber opening');pit(155,159,'Arrow tower opening');pit(179,205,'Falling lintel chasm');
fruit(151,163,6,3.4);fruit(179,183,9.7);fruit(184.5,192,8.5);fruit(194,200,7.3);

// 3: individual patrol islands keep landing silhouettes and attack tells visible.
group=3;deck(230,246,5,'Mossback approach');deck(252,264,6.2,'Mossback lower stair');deck(270,282,8,'Spring Frog stair');
deck(289,300,9.4,'Mossback crown stair');deck(308,325,8.2,'Watcher descent');deck(331,350,7,'Mossback refuge');
foe(258,6.2,'turtle',1.5,'Lower Mossback',1.5);foe(276,8,'hopper',1.8,'Stair spring frog',1.6);
foe(295,9.4,'turtle',1.4,'Upper Mossback',1.7);foe(317,8.2,'floater',2,'Parapet watcher',1.3);
box(239,5,'wood','Mossback stair supplies');box(338,7,'mystery','Watcher landing reward');
for(const [a,b,y] of [[246,252,5.8],[264,270,7.1],[282,289,8.7],[300,308,8.8],[325,331,7.8]]){pit(a,b,'Mossback stair gap');fruit(a,b,y);}

// 4: a long ferry followed by a lift. Neither chasm is a foot-jump shortcut.
group=4;deck(350,374,7,'Counterweight observation court');foe(362,7,'spinner',0,'Retracting court whirler',0);
add({t:'mover',p:[390,7,0],s:[7,.85,6.4],axis:'x',amp:12,speed:.55,phase:-Math.PI/2,nm:'Long counterweight ferry',grp:group});
deck(406,421,7,'Counterweight transfer ledge');
add({t:'mover',p:[429,10.5,0],s:[6,.85,6.4],axis:'y',amp:3.5,speed:.7,phase:-Math.PI/2,nm:'Counterweight crown lift',grp:group});
deck(438,464,14,'Counterweight upper court');box(450,14,'mask','Hammer Gallery guardian mask');
pit(374,406,'Counterweight ferry chasm');pit(421,438,'Counterweight lift shaft');fruit(369,379,7);fruit(402,408,7);

// 5: safe observation pockets separated by real broken floor, not a flat gauntlet.
group=5;deck(464,486,14,'First hammer court');crusher(477,14,3.7,.12,'Entrance hammer');
deck(494,518,14,'Double hammer court');crusher(507,14,4.2,.64,'Offbeat hammer');
deck(524,537,12.5,'Hammer gallery broken tooth');bell(531,12.5,1.25,.3,'Gallery swinging weight');
deck(544,568,10,'Low hammer court');crusher(557,10,3.4,.35,'Low vault hammer');
deck(576,598,9,'Hammer Gallery refuge');box(583,9,'wood','Hammer keeper offering');
for(const [a,b,y] of [[486,494,14],[518,524,13.2],[537,544,11.4],[568,576,9.5]]){pit(a,b,'Hammer Gallery broken floor');fruit(a,b,y);}

// 6: the course's single long kicker. The rail begins on its supported receiver.
group=6;deck(598,627,9,'Aqueduct skate runway');
add({t:'ramp',p:[630.5,9,0],len:7,rise:1.3,w:6.4,yaw:-90,tex:'checker',color:'#9ca19a',nm:'Broken aqueduct kicker',grp:group});
deck(651,667,10.3,'Aqueduct receiving arch');deck(691,711,8,'Aqueduct rail receiver');
add({t:'rail',p:[664,10.65,0],pts:[[0,0,0,0],[8,0,0,-.15],[17,0,0,-1.3],[30,0,0,-2.3]],nm:'Descending aqueduct grind',grp:group});
pit(634,651,'Committed aqueduct jump');pit(667,691,'Aqueduct missing arch');fruit(632,653,10.2,3.6);box(659,10.3,'mystery','Aqueduct landing cache');

// 7: five enemy rules on different islands, ending in a long bull arena/refuge.
group=7;deck(711,734,8,'Bristle orchard wall');deck(740,754,9.2,'Frog branch');deck(760,774,7.5,'Watcher branch');
deck(780,794,8.5,'Shell branch');deck(801,844,6,'Bull orchard and refuge');
foe(723,8,'spiker',3,'Orchard Bristleback',2.1);foe(747,9.2,'hopper',2,'Orchard Spring Frog',2);
foe(768,7.5,'floater',2.1,'Orchard Violet Watcher',1.5);foe(787,8.5,'turtle',2,'Orchard Mossback',2.2);
foe(816,6,'charger',9,'Orchard Russet Bull',2.4);box(830,6,'wood','Bull refuge offering');
for(const [a,b,y] of [[734,740,8.6],[754,760,8.3],[774,780,8],[794,801,7.2]]){pit(a,b,'Orchard branch opening');fruit(a,b,y);}

// 8: a fire mouth leads to three staggered, disappearing steps.
group=8;deck(844,870,6,'Fire breath observation court');
add({t:'firetiki',p:[861,6,-4.3],yaw:0,amp:0,range:8,cycle:4.5,phase:.15,nm:'Lantern mouth crossing',grp:group});
deck(876,887,7.4,'Lantern crossing launch');
for(const [i,[x,y]] of [[895,8],[907,9],[919,10]].entries())add({t:'phasepad',p:[x,y,0],s:[6,.65,6.4],cycle:10,phase:i===0?0:1-i*.28,amp:.65,nm:`Lantern step ${i+1}`,grp:group});
deck(930,950,10,'Lantern Crossing refuge');box(938,10,'mystery','Lantern keeper cache');
pit(870,876,'Fire court break');pit(887,930,'Lantern staircase abyss');fruit(869,877,6.7);fruit(887,895,7.8);fruit(920,931,10);

// 9: cross-depth swings are readable from the side; each receiving tooth differs.
group=9;deck(950,972,10,'Wind bell approach');bell(963,10,1.2,0,'Low wind bell');
deck(978,985,11,'First bell tooth');deck(991,999,12,'Second bell tooth');bell(995,12,1.05,1.8,'High wind bell');
deck(1005,1012,13,'Third bell tooth');deck(1018,1026,14,'Fourth bell tooth');bell(1022,14,1.38,.4,'Crown wind bell');
deck(1033,1064,13,'Wind Bells refuge');foe(1043,13,'moa',2.2,'Bell keeper Moa',1.5);
for(const [a,b,y] of [[972,978,10.5],[985,991,11.5],[999,1005,12.5],[1012,1018,13.5],[1026,1033,13.5]]){pit(a,b,'Wind bell ravine');fruit(a,b,y);}

// 10: the local switch restores permanent masonry, independent of bonus circuits.
group=10;deck(1064,1083,10,'Sunken switch court');box(1077,10,'bang','Sunken masonry seal',{grp:40});
const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
for(const [i,[x,y]] of [[1089,10],[1098,9],[1107,8]].entries())add({t:'mesh',p:[x,y-.4,0],s:[4.5,.8,6.4],...cube,outline:true,grp:40,tex:'checker',color:'#95ad9d',nm:`Restored sunken stair ${i+1}`});
deck(1115,1142,8,'Reliquary discovery court');
// A deliberate depth detour enters the hoard; ordinary jumps along the main
// lane cannot land on its stone. The return rejoins solid ground beyond it.
add({t:'platform',p:[1128,7.4,-3.7],s:[18,1.2,5.8],tex:'checker',color:'#85918b',nm:'Optional reliquary alcove',grp:group});
add({t:'bonusplatform',p:[1128,8,-4.2],to:[1137,8.12,0],nm:'The Gatekeeper’s Hoard entrance',grp:group});
add({t:'mover',p:[1155,8,0],s:[6,.85,6.4],axis:'x',amp:8,speed:.8,phase:0,nm:'Sunken cross-current ferry',grp:group});
deck(1170,1190,8,'Sunken Switchyard refuge');box(1175,8,'mask','Crown guardian mask');pit(1083,1115,'Unrestored staircase chasm');pit(1142,1170,'Sunken ferry crossing');fruit(1109,1117,8);

// 11: the two steel arrows survive retries. The watcher is beyond the landing.
group=11;deck(1190,1203,8,'Crown first launcher');box(1198,8,'metalbounce','Lower crown arrow');
deck(1207,1222,15,'Crown middle parapet');box(1217,15,'metalbounce','Upper crown arrow');
deck(1227,1242,22,'Crown watcher parapet');foe(1236,22,'floater',1.5,'Crown Violet Watcher',1.6);
deck(1248,1255,23.5,'Crown narrow tooth');deck(1261,1271,25,'Crown highest tooth');deck(1278,1294,24,'Last Gate checkpoint');box(1266,25,'life','Crown summit offering');
pit(1203,1207,'Lower crown ascent opening');pit(1222,1227,'Upper crown ascent opening');
risingFruit(1198,10,1210,16.1);risingFruit(1217,17,1230,23.1);
for(const [a,b,y] of [[1242,1248,22.7],[1255,1261,24.2],[1271,1278,24.5]]){pit(a,b,'Crown vertical ravine');fruit(a,b,y,2.4);}

// 12: a fast descent, then a stable attack read and two exact final landings.
group=12;crumble(1300,23,4.4,'Last Gate falling tooth one',.65);crumble(1310,21.5,4.2,'Last Gate falling tooth two',.65);crumble(1320,20,4.6,'Last Gate falling tooth three',.65);
deck(1329,1342,18.5,'Last whirler court');foe(1336,18.5,'spinner',0,'Last Gate Brass Whirler',0);deck(1349,1356,17,'Last isolated keystone');
deck(1362,1390,16,'Ancient Gates sanctuary');foe(1368,16,'grunt',1.2,'Sanctuary sentinel crab',2.2);
pit(1294,1329,'Last Gate falling abyss');pit(1342,1349,'Last whirler gap');pit(1356,1362,'Final gate gap');
fruit(1293,1300,23.7);fruit(1302,1310,22.3);fruit(1312,1320,20.8);fruit(1322,1330,19.3);fruit(1341,1350,17.8);fruit(1355,1363,16.5);box(1372,16,'mystery','Last gate offering');
box(1374,16,'nitrobang','Clear the gate mine');

for(const [i,p] of ANCIENT_GATES_CHECKPOINTS.entries())add({t:'checkpoint',p:[...p],nm:`Gate ${i+1} — ${ANCIENT_GATES_SECTIONS[i+1].name}`,grp:i+1});
add({t:'gate',p:[1376,16,0],yaw:90,nm:'Beyond the Ancient Gates',grp:12});add({t:'clock',p:[-16,0,-2.3],nm:'Optional Ancient Gates time trial',grp:1});
// Keep 2.5D enemy rules meaningful; authored surfaces keep ordinary edge grinding.
add({t:'wall',p:[699,-24,1.05],s:[1418,90,.6],collisionHeight:90,invisible:true,nm:'Ancient Gates near depth boundary',grp:80});
for(const [a,b] of [[-10,1119],[1137,1408]])add({t:'wall',p:[(a+b)/2,-24,-1.05],s:[b-a,90,.6],collisionHeight:90,invisible:true,nm:'Ancient Gates far depth boundary',grp:80});
add({t:'wall',p:[1128,-24,-6.4],s:[18,90,.6],collisionHeight:90,invisible:true,nm:'Reliquary alcove far boundary',grp:80});
for(const x of [1119,1137])add({t:'wall',p:[x,-24,-3.7],s:[.6,90,5.3],collisionHeight:90,invisible:true,nm:'Reliquary alcove side boundary',grp:80});
for(const z of [-3.5,3.5])add({t:'wall',p:[-17,-24,z],s:[26,90,.6],collisionHeight:90,invisible:true,nm:'Optional clock alcove boundary',grp:80});
add({t:'zone',p:[683,0,0],s:[1450,1,18],dir:'E',nm:'Ancient Gates east travel',grp:80});
add({t:'camnode',p:[-30,0,0],radius:0,grp:80});add({t:'camnode',p:[1400,0,0],radius:0,grp:80});
add({t:'camnode',p:[683,16,0],s:[1460,110,24],cameraView:true,cameraPresentationOnly:true,
 cameraPosition:[0,9.5,24],cameraTarget:[0,2,0],cameraFollowDistance:18,cameraKeepDistance:true,
 cameraFollowTargetHeight:2,cameraFov:55,cameraAspect:16/9,radius:3,nm:'Readable Ancient Gates side view',grp:80});

components.push(...dressAncientGates(components,ANCIENT_GATES_DECKS));
export const JUNGLE_GATE_RUN_LEVEL:CustomLevelData={v:1,name:'The Ancient Gates',spawn:[-20,.12,0],killY:-18,ledgeAssist:1,sky:'day',components,
 jungleAtmosphere:true,jungleDepthFade:false,jungleStyle:'painterly',keepPlayFog:true,atmosphere:ANCIENT_GATES_ATMOSPHERE,
 medalTimes:{gold:330,silver:390,bronze:450},
 groups:[...ANCIENT_GATES_SECTIONS.map((s,i)=>({id:i+1,nm:`${i+1}. ${s.name}`})),{id:40,nm:'Sunken masonry restoration circuit'},{id:80,nm:'Side-view camera and depth boundary',editorOnly:true},{id:90,nm:'Ancient Gates Meshy scenery and painted valley'}]};
