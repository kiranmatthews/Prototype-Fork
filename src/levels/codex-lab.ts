import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { BLOCKWORKS_GROUND, ROUTE_END, emitPit, emitRibbon, routePoint, routeYaw, type Point } from './blockworks-geometry';
export { BLOCKWORKS_GROUND, ROUTE_END, routePoint, routeTangent, routeYaw, routeX } from './blockworks-geometry';

// The road is a continuous physical curve. The control/camera chord remains
// north-going: Up cannot secretly steer the bends, and the rider must carve.
// Each district combines mechanics and hands its momentum into the next one.
const C:CustomComponent[]=[];
const groups:CustomGroup[]=[{id:1,nm:'Steady camera/control chord',editorOnly:true},{id:2,nm:'Shared excavated ground',editorOnly:true}];
const GREY=['#aeb5bd','#8a96a2','#c5cbd0','#717f8d'];
const AMBER='#d5a850',ICE='#a6dfe9';
type Scalar=number|((s:number)=>number);
const mix=(a:number,b:number,t:number)=>a+(b-a)*Math.max(0,Math.min(1,t));
const smooth=(a:number,b:number,s:number)=>{const t=Math.max(0,Math.min(1,(s-a)/(b-a)));return t*t*(3-2*t);};
const lerpY=(a:number,b:number,ya:number,yb:number)=>(s:number)=>mix(ya,yb,(s-a)/(b-a));
const add=(c:CustomComponent)=>C.push(c);
export const BLOCKWORKS_SECTIONS=[
 {name:'01 · Sweeping entry',a:0,b:235,y:0},
 {name:'02 · Terrace canyon',a:235,b:510,y:-2.4},
 {name:'03 · Frozen bends',a:510,b:745,y:0},
 {name:'04 · Curved aqueduct',a:745,b:1040,y:0},
 {name:'05 · Switch foundry',a:1040,b:1300,y:3.6},
 {name:'06 · Rail and machinery',a:1300,b:1560,y:8.4},
 {name:'07 · Roof relay',a:1560,b:1870,y:13.2},
 {name:'08 · Crown sweep',a:1870,b:2140,y:6},
].map((d,i)=>({...d,grp:10+i,start:routePoint(d.a,d.y),yaw:0,length:d.b-d.a,endY:d.y}));
for(const d of BLOCKWORKS_SECTIONS)groups.push({id:d.grp,nm:d.name,editorOnly:true});
export const BLOCKWORKS_ROADS:{a:number;b:number;top:Scalar;width:Scalar;offset:Scalar;grp:number;ice:boolean}[]=[];
export const BLOCKWORKS_GAPS:{a:number;b:number;y:number;width:number;kind:string}[]=[];
export const BLOCKWORKS_CLIMBS:{name:string;grp:number;start:Point;steps:{s:number;top:number;u:number;width:number;depth:number;point:Point}[];exit:Point}[]=[];
export const BLOCKWORKS_CHECKPOINTS:{s:number;p:Point;after:string}[]=[];
export const BLOCKWORKS_SWITCHES:{name:string;group:number;p:Point}[]=[];
export const BLOCKWORKS_MOVERS:CustomComponent[]=[];

function road(a:number,b:number,top:Scalar,width:Scalar,grp:number,offset:Scalar=0,ice=false,name='Curved roof road'){
 const first=C.length;
 emitRibbon(C,a,b,top,width,{grp,offset,color:ice?ICE:GREY[0],...(ice?{slip:true,iceGrip:.08}:{}),name});
 if(name==='High curved roof walk'||name==='Crown departure')for(const c of C.slice(first))if(c.t==='mesh')c.depthBias=1;
 BLOCKWORKS_ROADS.push({a,b,top,width,offset,grp,ice});
}
function gap(a:number,b:number,y:number,width:number,grp:number,kind='charged gap'){
 emitPit(C,a,b,y-6,width,grp);BLOCKWORKS_GAPS.push({a,b,y,width,kind});
}
function box(p:Point,top:number,width:number,depth:number,grp:number,yaw=0,color=GREY[1],name='Grounded building'){
 add({t:'platform',p:[p[0],(top+BLOCKWORKS_GROUND)/2,p[2]],s:[width,top-BLOCKWORKS_GROUND,depth],yaw,tex:'solid',color,edgeGrinding:false,grp,nm:name});
}
function pad(s:number,top:number,width:number,depth:number,grp:number,u=0,color=GREY[1]){
 box(routePoint(s,top,u),top,width,depth,grp,routeYaw(s),color);
}
// The modules are visual faces over one identical solid cuboid. This keeps
// the complete mass/collision while avoiding hundreds of tiny rotated walls.
const cubeVertices:number[]=[],cubeIndices:number[]=[];
for(const [normal,points] of [
 [[1,0,0],[[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
 [[-1,0,0],[[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
 [[0,1,0],[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]]],
 [[0,-1,0],[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]],
 [[0,0,1],[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]]],
 [[0,0,-1],[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]]],
] as [Point,Point[]][]) {
 const i=cubeVertices.length/3;cubeVertices.push(...points.flat());
 const a=points[1].map((v,k)=>v-points[0][k]),b=points[2].map((v,k)=>v-points[0][k]);
 const dot=(a[1]*b[2]-a[2]*b[1])*normal[0]+(a[2]*b[0]-a[0]*b[2])*normal[1]+(a[0]*b[1]-a[1]*b[0])*normal[2];
 cubeIndices.push(...(dot>0?[i,i+1,i+2,i,i+2,i+3]:[i,i+2,i+1,i,i+3,i+2]));
}
function assembly(s:number,base:number,layers:number,nx:number,nz:number,grp:number,u=0){
 const centre=routePoint(s,base,u),angle=routeYaw(s)*Math.PI/180;
 box(centre,base+layers*2.4,nx*2.4,nz*2.4,grp,routeYaw(s),GREY[3],'Solid modular building');
 C[C.length-1].depthBias=1;
 for(let h=0;h<layers;h++)for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
  const dx=(x-(nx-1)/2)*2.4,dz=(z-(nz-1)/2)*2.4;
  add({t:'mesh',p:[centre[0]+Math.cos(angle)*dx+Math.sin(angle)*dz,base+(h+.5)*2.4,centre[2]-Math.sin(angle)*dx+Math.cos(angle)*dz],
   s:[2.4,2.4,2.4],yaw:routeYaw(s),vertices:cubeVertices,indices:cubeIndices,tex:'solid',color:GREY[(h+x+z)%4],solid:false,edgeGrinding:false,grp,nm:'Jump-sized roof module'});
 }
}
const fruit=(s:number,y:number,grp:number,u=0)=>add({t:'wumpa',p:routePoint(s,y, u),grp});
function fruitLine(a:number,b:number,y:Scalar,grp:number,u=0,spacing=14){for(let s=a;s<=b;s+=spacing)fruit(s,(typeof y==='function'?y(s):y)+1,grp,u);}
function mark(s:number,y:number,grp:number,u=0,color=AMBER){
 const a=routePoint(s,y+.025,u-1),b=routePoint(s,y+.025,u+1),c=routePoint(s+2,y+.025,u);
 add({t:'mesh',p:a,vertices:[0,0,0,b[0]-a[0],0,b[2]-a[2],c[0]-a[0],0,c[2]-a[2]],indices:[0,1,2],tex:'solid',color,solid:false,doubleSided:true,edgeGrinding:false,grp,nm:'Travel arrow'});
}
function rail(points:[number,number,number][],grp:number,name:string){
 const world=points.map(([s,y,u])=>routePoint(s,y,u)),p=world[0];
 add({t:'rail',p,pts:world.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),grp,nm:name});
}
function railLine(a:number,b:number,y:Scalar,offset:Scalar,grp:number,name:string){
 const n=Math.ceil((b-a)/5);rail(Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n);return[s,typeof y==='function'?y(s):y,typeof offset==='function'?offset(s):offset];}),grp,name);
}
function crate(s:number,y:number,kind:NonNullable<CustomComponent['kind']>,grp:number,u=0){add({t:'crate',p:routePoint(s,y,u),kind,grp});}
function enemy(s:number,y:number,foe:NonNullable<CustomComponent['foe']>,grp:number,u=0,range=0,speed=0){
 add({t:'enemy',p:routePoint(s,y,u),foe,range,speed,grp});
}
function checkpoint(s:number,y:number,grp:number,after:string,u=3){
 const p=routePoint(s,y,u);add({t:'checkpoint',p,grp,nm:after});BLOCKWORKS_CHECKPOINTS.push({s,p,after});
}
function switchBox(s:number,y:number,u:number,group:number,name:string){
 const p=routePoint(s,y,u);groups.push({id:group,nm:name});add({t:'crate',p,kind:'bang',grp:group,nm:name});BLOCKWORKS_SWITCHES.push({name,group,p});
}
function steelPier(s:number,top:number,u:number,group:number,grp:number,pitY:number,size=3){
 // All crates remain on the world grid. Their portal legs materialize with
 // the deck; permanent feet stay below the lethal channel until activated.
 const p=routePoint(s,top,u),base=top-.96,n=Math.ceil((base-pitY+1.5)/.96),foot=base-n*.96;
 box(p,foot,size*.96,size*.96,grp,0,GREY[3],'Submerged steel footing');
 const half=(size-1)*.48;
 for(let h=0;h<n;h++)for(const dx of [-half,half])add({t:'crate',p:[p[0]+dx,foot+h*.96,p[2]],kind:'metal',outline:true,grp:group});
 for(let x=0;x<size;x++)for(let z=0;z<size;z++)add({t:'crate',p:[p[0]+(x-(size-1)/2)*.96,base,p[2]+(z-(size-1)/2)*.96],kind:'metal',outline:true,grp:group});
}
function mover(c:CustomComponent){add(c);BLOCKWORKS_MOVERS.push(c);}

// Shared ground gives every road and building real depth. It is a reset
// basin beneath the elevated course, not a bypass around its commitments.
add({t:'platform',p:[0,BLOCKWORKS_GROUND-2,20-ROUTE_END/2],s:[250,4,ROUTE_END+80],tex:'solid',color:'#626c76',edgeGrinding:false,grp:2,nm:'Continuous ground stratum'});
add({t:'pit',p:[0,BLOCKWORKS_GROUND+.35,20-ROUTE_END/2],s:[250,1,ROUTE_END+80],invisible:true,grp:2,nm:'Ground-floor reset'});

// 1. The first bend is gameplay immediately: bank/roof on the inside,
// turtle versus outside line, then carry the same run into a real gap.
{
 const g=10;
 road(-12,120,0,s=>mix(14,9,s/90),g);road(120,166,lerpY(120,166,0,-2.4),9,g);
 gap(166,176.8,-2.4,21,g);road(176.8,208,-2.4,s=>mix(14,10,(s-176.8)/31.2),g);road(208,235,-2.4,10,g);
 const rp=routePoint(64,0,-3.4);add({t:'ramp',p:rp,len:14,rise:1.4,w:3.6,yaw:routeYaw(64),tex:'solid',color:GREY[2],grp:g,nm:'Inside-bank launch'});
 pad(78,1.4,4.8,12,g,-3.4);pad(93,2.8,4.8,12,g,-3.4);pad(109,1.4,4.8,14,g,-3.4);
 railLine(112,198,s=>mix(1,-1.6,(s-112)/86),-4.4,g,'Outside arc over the first gap');
 enemy(130,-.52,'turtle',g,-1.5,1.2,.85);fruit(130,2.4,g,-1.5);fruitLine(20,60,0,g);fruitLine(145,163,lerpY(120,166,0,-2.4),g,0,9);
 mark(153,-1.72,g);mark(164,-2.3,g);fruit(171,.3,g);crate(28,0,'mask',g,-4);
 add({t:'clock',p:routePoint(8,0,4),grp:g});add({t:'comboorb',p:routePoint(8,0,-4),grp:g});
}

// 2. Buildings occupy the inside of a long physical crescent. The four
// upper bays demand lateral set-up; there is no shared hold-Up stair strip.
{
 const g=11;
 road(235,275,-2.4,11,g);road(275,354,-2.43,24,g,0,false,'Connected courtyard foundation');
 const steps=[{s:286,top:0,u:-4.8},{s:304,top:2.4,u:3.6},{s:324,top:4.8,u:-3.6},{s:343,top:7.2,u:3.6}]
  .map(p=>({...p,width:12,depth:26.4,point:routePoint(p.s,p.top,p.u)}));
 for(let i=0;i<steps.length;i++){const p=steps[i];assembly(p.s,-2.4,i+1,5,11,g,p.u);fruit(p.s,p.top+1,g,p.u);}
 // Lower wings join the stepped roofs into a substantial building envelope.
 road(279,350,-.03,3.6,g,-10,false,'Lower west gallery');road(282,349,-.03,3.6,g,10,false,'Lower east gallery');
 road(352,438,7.2,7.2,g,0,false,'High curved roof walk');
 enemy(388,7.2,'spiker',g);railLine(367,416,8.1,s=>4.4*(1-smooth(396,416,s)),g,'Outer parapet returning to the roof');
 road(438,510,lerpY(438,510,7.2,0),10,g);fruitLine(411,436,7.2,g);fruitLine(450,506,lerpY(438,510,7.2,0),g);
 checkpoint(422,7.2,g,'Courtyard roof sequence complete',2.4);
 BLOCKWORKS_CLIMBS.push({name:'Courtyard roof bays',grp:g,start:routePoint(273,-2.4,-4.8),steps,exit:routePoint(358,7.2)});
}

// 3. Gentle frozen chords sit between dry bends; they retain the .08 ice
// inertia without demanding impossible full-speed turns on tight ice.
{
 const g=12;
 road(510,575,0,10,g);road(575,599,0,8,g,0,true,'Ice approach chord');
 road(599,635,0,12,g);road(635,660,0,8,g,0,true,'Ice carry chord');
 road(660,687,0,12,g);road(687,714,0,8,g,0,true,'Ice launch chord');
 road(714,724,0,10,g);gap(724,734.8,0,22,g);road(734.8,755,0,14,g);
 for(const s of [566,607,672,716])mark(s,0,g);
 fruitLine(524,570,0,g);fruitLine(578,711,0,g,0,22);fruit(729,2.4,g);
 checkpoint(750,0,g,'Frozen bends and launch complete',2.4);
}

// 4. The trough itself curves. Its flat bottom ends below the departure
// road: use the wall/coping, then pop from one curving rail to the receiver.
{
 const g=13,start=routePoint(770,0);
 road(755,770,0,14,g);
 road(770,920,-.04,23,g,0,false,'Aqueduct retaining mass');
 const pts=Array.from({length:23},(_,i)=>{const s=mix(770,920,i/22),p=routePoint(s,0);return[p[0]-start[0],p[2]-start[2],0,0] as [number,number,number,number];});
 add({t:'vertramp',p:start,pts,vkind:'half',curve:'spline',rise:3.6,w:3.6,arc:75,deck:4,tex:'solid',color:GREY[1],grp:g,nm:'Sweeping vert aqueduct'});
 road(920,958,lerpY(920,944,3.6*(1-Math.cos(75*Math.PI/180)),3.6),8,g,s=>mix(9.2,4.2,smooth(920,958,s)),false,'Coping departure');
 gap(958,1000,3.6,34,g,'rail transfer');
 railLine(936,976,s=>mix(4.4,5,(s-936)/40),s=>mix(8.5,4.5,(s-936)/40),g,'High arc · transfer launch');
 railLine(982,1012,s=>mix(4.25,4.4,(s-982)/30),s=>mix(2,0,(s-982)/30),g,'Lower curving receiver');
 road(1000,1040,3.6,14,g);fruitLine(778,902,0,g,1.4,20);fruit(911,5,g,8.4);fruit(979,6.6,g,3);
 mark(935,3.6,g,7);checkpoint(1030,3.6,g,'Vert exit and rail transfer complete',-4);
}

// 5. A route-reading foundry. The right switch builds a safe lower reward
// perch; the left builds the ascent to the upper bridge switch. Ghost steel
// makes both consequences visible, and every incomplete route can return.
export const BLOCKWORKS_FOUNDRY={
 approach:routePoint(1080,3.6),stairsKey:routePoint(1085,3.6,-4.8),rewardKey:routePoint(1085,3.6,4.8),bridgeKey:routePoint(1136,8.4,-5.4),
 stairs:Array.from({length:5},(_,i)=>({s:1109.5+i*5,top:4.56+i*.96,u:-5.4})),
 bridge:[...Array.from({length:9},(_,i)=>({s:1143+i*6,top:8.4,u:Math.min(0,-5.4+i*1.8)})),{s:1195,top:8.4,u:0}],
 exit:routePoint(1200,8.4),groups:{stairs:100,reward:101,bridge:102},
};
{
 const g=14,f=BLOCKWORKS_FOUNDRY;
 road(1040,1106,3.6,s=>s<1075?12:18,g);gap(1106,1198,3.6,42,g,'three-switch route puzzle');
 switchBox(1085,3.6,-4.8,100,'Left key · upper access stair');switchBox(1085,3.6,4.8,101,'Right key · lower reward perch');
 for(const p of f.stairs)steelPier(p.s,p.top,p.u,100,g,-2.4,4);
 box(routePoint(1136,8.4,-5.4),8.4,7.2,7.2,g,0,GREY[2],'Upper switch tower');
 switchBox(1136,8.4,-5.4,102,'Upper key · main curved crossing');
 for(const p of f.bridge)steelPier(p.s,p.top,p.u,102,g,-2.4,4);
 for(let i=0;i<4;i++)steelPier(1110.5+i*5,3.6,7+Math.min(i,2)*2,101,g,-2.4,4);
 const reward=routePoint(1131,3.6,11);
 box(reward,3.6,10,6,g,0,GREY[2],'Lower reward and bonus perch');crate(1131,3.6,'mask',g,11);fruit(1131,4.9,g,9);
 add({t:'bonusplatform',p:[reward[0]+3,3.6,reward[2]],to:[reward[0]-1.6,3.7,reward[2]+1],grp:g,nm:'Optional foundry bonus'});
 road(1198,1300,8.4,s=>mix(14,10,(s-1198)/60),g);
 fruitLine(1050,1077,3.6,g);fruitLine(1220,1274,8.4,g);
 mark(1098,3.6,g,-4.8);mark(1098,3.6,g,4.8,'#b59dd4');
 checkpoint(1280,8.4,g,'Foundry crossing complete',3.5);
}

// 6. Machinery belongs to the route: a ferry carries through the curve,
// then a quick lift reaches a loading roof. A demanding high grind rewards
// riders who commit early instead of making everyone wait for a cycle.
export const BLOCKWORKS_MACHINE={ferry:routePoint(1355,8.4),lift:routePoint(1410,10.8)};
{
 const g=15;
 road(1300,1340,8.4,s=>mix(10,16,(s-1324)/16),g);gap(1340,1370,8.4,30,g,'freight crossing');
 mover({t:'mover',p:BLOCKWORKS_MACHINE.ferry,s:[8,.8,8],axis:'z',travelSign:-1,amp:11,speed:.95,phase:-Math.PI/2,grp:g,nm:'Freight deck through the bend'});
 road(1370,1406,8.4,14,g);gap(1406,1414,8.4,24,g,'loading lift');
 mover({t:'mover',p:BLOCKWORKS_MACHINE.lift,s:[8,.8,8],axis:'y',amp:2.4,speed:1.1,phase:-Math.PI/2,grp:g,nm:'Fast loading lift'});
 for(const sign of [-1,1]){const p=BLOCKWORKS_MACHINE.lift;box([p[0]+sign*5.2,0,p[2]],14.4,.6,9,g,0,GREY[3],'Grounded lift guide');}
 road(1414,1520,13.2,9,g);road(1520,1560,13.2,12,g);
 railLine(1320,1444,s=>mix(9.3,14.1,(s-1320)/124),s=>5.8*Math.sin(Math.PI*(s-1320)/124),g,'Machinery high line · rising S grind');
 fruitLine(1303,1330,8.4,g);fruitLine(1425,1545,13.2,g);
 checkpoint(1550,13.2,g,'Machinery and high roof complete',3.5);
}

// 7. Spend the height in one continuous run: descending bend -> short ice
// carry -> gap -> enemy choice -> kicker -> narrow roof/parapet. No reset
// plazas separate these commitments.
{
 const g=16;
 road(1560,1634,lerpY(1560,1634,13.2,4.8),9,g);road(1634,1640,4.8,9,g);
 road(1640,1664,4.8,8,g,0,true,'Roof-race ice carry');road(1664,1687,4.8,10,g);
 gap(1687,1695.2,4.8,23,g);road(1695.2,1740,4.8,9,g);
 road(1740,1754,lerpY(1740,1754,4.8,6.8),9,g,0,false,'Curved kicker');gap(1754,1766,6.8,22,g);
 road(1766,1870,6,7.2,g);
 enemy(1722,4.8,'grunt',g,-1.2,1,.9);enemy(1818,6,'turtle',g,-1.2,1,.7);fruit(1818,9,g,-1.2);
 assembly(1728,4.8,1,2,4,g,5.5);assembly(1836,6,1,2,5,g,-5);
 railLine(1776,1853,6.9,s=>4.4*Math.sin(Math.PI*(s-1776)/77),g,'Roof relay parapet');
 fruitLine(1573,1628,lerpY(1560,1634,13.2,4.8),g);fruit(1692,7.2,g);fruit(1760,10,g);fruitLine(1780,1860,6,g,0,17);
 mark(1678,4.8,g);mark(1685,4.8,g);mark(1750,6.23,g);
}

// 8. The last sweep stays physically curved all the way to the tower.
// Checkpoint precedes a complete finale, never another nearby checkpoint.
{
 const g=17;
 road(1870,1985,6,9,g);checkpoint(1910,6,g,'Roof relay complete',2.7);
 road(1985,2008,6,8,g,0,true,'Final ice chord');road(2008,2018,6,10,g);gap(2018,2028.8,6,24,g);
 road(2028.8,2041,6,14,g);road(2041,2083,5.97,22,g,0,false,'Crown tower foundation');
 const steps=[{s:2048,top:8.4,u:-2.4},{s:2061,top:10.8,u:2.4},{s:2074,top:13.2,u:-2.4}]
  .map(p=>({...p,width:7.2,depth:12,point:routePoint(p.s,p.top,p.u)}));
 for(let i=0;i<steps.length;i++){const p=steps[i];assembly(p.s,6,i+1,3,5,g,p.u);fruit(p.s,p.top+1,g,p.u);}
 road(2078,2100,13.2,8,g,0,false,'Crown departure');gap(2100,2118,13.2,24,g,'finish grind');road(2118,2152,13.2,14,g);
 railLine(2088,2125,14,s=>-3*Math.sin(Math.PI*(s-2088)/37),g,'Crown arc into the finish');
 add({t:'crystal',p:routePoint(2129,14.5),grp:g});add({t:'gate',p:routePoint(2136,13.2),yaw:0,grp:g});
 fruitLine(1882,1980,6,g);fruit(2023,8.4,g);mark(2016,6,g);
 BLOCKWORKS_CLIMBS.push({name:'Crown roof bays',grp:g,start:routePoint(2039,6,-2.4),steps,exit:routePoint(2085,13.2)});
}

// A steady north-facing chord leaves the actual road curvature on screen.
// The camera follows the rider's position along the bends, but never turns
// the input frame to make a bend play like another straight corridor.
export const BLOCKWORKS_CAMERA_ROUTE:Point[]=[];
for(let s=-30;s<=ROUTE_END+40;s+=10){const p:Point=[0,0,20-s];BLOCKWORKS_CAMERA_ROUTE.push(p);add({t:'camnode',p,grp:1});}
export const CODEX_LAB_LEVEL:CustomLevelData={
 v:1,name:'Blockworks · Greybox',spawn:routePoint(2,.15),killY:-20,sky:'day',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:105,fogFar:230,fogColor:'#c1c9d1',backdrop:'fog',ambientSky:'#e8f1ff',ambientGround:'#626d7d',ambientIntensity:1.1,sunColor:'#ffffff',sunIntensity:1.25,fillColor:'#c8d9f0',fillIntensity:.35,drawDistance:360,shadowStrength:.65},
 medalTimes:{gold:240,silver:300,bronze:390},components:C,groups,
};
