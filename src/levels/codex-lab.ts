import {warehouseRibbon,warehouseIsland,warehouseBeam,type WarehousePoint} from './warehouse-geometry';
import {warehouseDressing} from './warehouse-dressing';
import {dressBlockworks,HAUNTED_ISLAND_ATMOSPHERE} from './blockworks-art';
import {addSkateWedge,addSkateLid,addWedgeBetween,type SkateBlock,type SkateWedge} from './blockworks-ramps';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { BLOCKWORKS_GROUND, ROUTE_END, emitPit, emitRibbon, routePoint, routeYaw, type Point } from './blockworks-geometry';
export { BLOCKWORKS_GROUND, ROUTE_END, routePoint, routeTangent, routeYaw, routeX } from './blockworks-geometry';

// The camera nodes follow the authored road, with straight headings across
// jump gaps so forward input agrees with each takeoff-to-landing line.
// Each district combines mechanics and hands its momentum into the next one.
const C:CustomComponent[]=[];
const groups:CustomGroup[]=[{id:1,nm:'Course-aligned camera nodes',editorOnly:true},{id:2,nm:'Shared excavated ground',editorOnly:true}];
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
export const BLOCKWORKS_ROADS:{a:number;b:number;top:Scalar;width:Scalar;offset:Scalar;grp:number;ice:boolean;visuals:CustomComponent[]}[]=[];
export const BLOCKWORKS_GAPS:{a:number;b:number;y:number;width:number;kind:string}[]=[];
export const BLOCKWORKS_CLIMBS:{name:string;grp:number;start:Point;steps:{s:number;top:number;u:number;width:number;depth:number;point:Point}[];exit:Point}[]=[];
export const BLOCKWORKS_CHECKPOINTS:{s:number;p:Point;after:string}[]=[];
export const BLOCKWORKS_SWITCHES:{name:string;group:number;p:Point}[]=[];
export const BLOCKWORKS_MOVERS:CustomComponent[]=[];

function road(a:number,b:number,top:Scalar,width:Scalar,grp:number,offset:Scalar=0,ice=false,name='Curved roof road'){
 const first=C.length;
 emitRibbon(C,a,b,top,width,{grp,offset,color:ice?ICE:GREY[0],...(ice?{slip:true,iceGrip:.08}:{}),name});
 if(name==='High curved roof walk'||name==='Crown departure')for(const c of C.slice(first))if(c.t==='mesh')c.depthBias=1;
 BLOCKWORKS_ROADS.push({a,b,top,width,offset,grp,ice,visuals:C.slice(first).filter(c=>c.t==='mesh')});
}
function gap(a:number,b:number,y:number,width:number,grp:number,kind='charged gap'){
 emitPit(C,a,b,y-6,width,grp);BLOCKWORKS_GAPS.push({a,b,y,width,kind});
}
function box(p:Point,top:number,width:number,depth:number,grp:number,yaw=0,color=GREY[1],name='Grounded building'){
 add({t:'platform',p:[p[0],(top+BLOCKWORKS_GROUND)/2,p[2]],s:[width,top-BLOCKWORKS_GROUND,depth],yaw,tex:'solid',color,grp,nm:name});
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

// Ground hugs the actual architecture; local shoulders belong to the roof
// courts, vert structure and foundry branch instead of an empty 250m field.
const groundFlare=(s:number,a:number,b:number,c:number,d:number)=>smooth(a,b,s)*(1-smooth(c,d,s));
export const BLOCKWORKS_GROUND_WIDTH=(s:number)=>22
 +8*groundFlare(s,248,275,354,386)
 +14*groundFlare(s,1048,1080,1150,1200);
const groundStations=Array.from({length:225},(_,i)=>-24+(ROUTE_END+64)*i/224);
const groundEdge=(side:number)=>groundStations.map(s=>{const p=routePoint(s,0,side*BLOCKWORKS_GROUND_WIDTH(s)/2);return[p[0],p[2]-20,0] as [number,number,number];});
add({t:'platform',p:[0,BLOCKWORKS_GROUND-2,20],s:[1,4,1],pts:[...groundEdge(-1),...groundEdge(1).reverse()],tex:'solid',color:'#626c76',edgeGrinding:false,grp:2,nm:'Continuous ground stratum'});
add({t:'pit',p:[0,BLOCKWORKS_GROUND+.35,20-ROUTE_END/2],s:[250,1,ROUTE_END+80],invisible:true,grp:2,nm:'Ground-floor reset'});

// 1. The first bend is gameplay immediately: bank/roof on the inside,
// turtle versus outside line, then carry the same run into a real gap.
{
 const g=10;
 road(-12,120,0,s=>mix(10,8,s/90),g);road(120,166,lerpY(120,166,0,-2.4),8,g);
 gap(166,176.8,-2.4,18,g);road(176.8,208,-2.4,s=>mix(10,8,(s-176.8)/31.2),g);road(208,235,-2.4,8,g);
 pad(78,1.4,4.8,12,g,-3.4);pad(93,2.8,4.8,12,g,-3.4);pad(109,1.4,4.8,14,g,-3.4);
 railLine(112,198,s=>mix(2.2,-1.6,(s-112)/86),-4.4,g,'Outside arc over the first gap');
 enemy(130,-.52,'turtle',g,-1.5,1.2,.85);fruit(130,2.4,g,-1.5);fruitLine(20,60,0,g);fruitLine(145,163,lerpY(120,166,0,-2.4),g,0,9);
 enemy(48,0,'moa',g,0,2.3,1.45);C[C.length-1].nm='Moa crossing · dodge the peck';
 mark(153,-1.72,g);mark(164,-2.3,g);fruit(171,.3,g);crate(28,0,'mask',g,-4);
 add({t:'clock',p:routePoint(8,0,4),grp:g});
}

// 2. Buildings occupy the inside of a long physical crescent. The four
// upper bays demand lateral set-up; there is no shared hold-Up stair strip.
{
 const g=11;
 road(235,275,-2.4,10.8,g);road(275,354,-2.43,24,g,0,false,'Connected courtyard foundation');
 const steps=[{s:286,top:0,u:-4.8},{s:304,top:2.4,u:3.6},{s:324,top:4.8,u:-3.6},{s:343,top:7.2,u:3.6}]
  .map(p=>({...p,width:12,depth:26.4,point:routePoint(p.s,p.top,p.u)}));
 for(let i=0;i<steps.length;i++){const p=steps[i];assembly(p.s,-2.4,i+1,5,11,g,p.u);fruit(p.s,p.top+1,g,p.u);}
 // Lower wings join the stepped roofs into a substantial building envelope.
 road(279,350,-.03,3.6,g,-10,false,'Lower west gallery');road(282,349,-.03,3.6,g,10,false,'Lower east gallery');
 road(352,438,7.2,7.2,g,0,false,'High curved roof walk');
 enemy(388,7.2,'spiker',g);railLine(367,416,8.1,s=>4.4*(1-smooth(396,416,s)),g,'Outer parapet returning to the roof');
 road(438,510,lerpY(438,510,7.2,0),8,g);fruitLine(411,436,7.2,g);fruitLine(450,506,lerpY(438,510,7.2,0),g);
 checkpoint(422,7.2,g,'Courtyard roof sequence complete',2.4);
 BLOCKWORKS_CLIMBS.push({name:'Courtyard roof bays',grp:g,start:routePoint(273,-2.4,-4.8),steps,exit:routePoint(358,7.2)});
}

// 3. Gentle frozen chords sit between dry bends; they retain the .08 ice
// inertia without demanding impossible full-speed turns on tight ice.
{
 const g=12;
 road(510,575,0,8,g);road(575,599,0,8,g,0,true,'Ice approach chord');
 road(599,635,0,9,g);road(635,660,0,8,g,0,true,'Ice carry chord');
 road(660,687,0,9,g);road(687,714,0,8,g,0,true,'Ice launch chord');
 road(714,724,0,8.4,g);gap(724,734.8,0,18,g);road(734.8,755,0,8.8,g);
 for(const s of [566,607,672,716])mark(s,0,g);
 fruitLine(524,570,0,g);fruitLine(578,711,0,g,0,22);fruit(729,2.4,g);
 checkpoint(750,0,g,'Frozen bends and launch complete',2.4);
}

// 4. Session the walls, not a rail across the riding line. High crate rows
// reward genuine pumped vert air; the floor has its own clean onward ramp.
export const BLOCKWORKS_VERT_AQUEDUCT={
 from:770,to:920,floor:0,radius:3.6,flatHalf:2.6,deck:1.2,lipHeight:3.6,lipOffset:6.2,
 targets:[
  ...[-2.4,0,2.4].map((d,i)=>({s:826+d,y:14.4,u:6.2,kind:(i===1?'mystery':'wood') as NonNullable<CustomComponent['kind']>,name:`Right high-air crate ${i+1}`})),
  ...[-2.4,0,2.4].map((d,i)=>({s:874+d,y:15.2,u:-6.2,kind:(i===1?'life':'wood') as NonNullable<CustomComponent['kind']>,name:`Left high-air crate ${i+1}`})),
 ].map(t=>({...t,p:routePoint(t.s,t.y,t.u)})),
 guides:[826,874].flatMap((s,i)=>{const side=i===0?1:-1;return [[1.2,1.2],[3.8,1.5],[5.8,3.8],[6.2,6.5],[6.2,9.5],[6.2,12.2]]
  .map(([u,y])=>({s,y,u:u*side,p:routePoint(s,y,u*side)}));}),
 exit:{from:920,rampEnd:944,to:958,top:3.6,width:6.4},
 transfer:{launch:[944,976],receiver:[982,1012]},
};
{
 const g=13,v=BLOCKWORKS_VERT_AQUEDUCT,start=routePoint(v.from,0);
 road(755,770,0,9.6,g);
 road(v.from,v.to,-.04,15.2,g,0,false,'Compact aqueduct retaining mass');
 const pts=Array.from({length:23},(_,i)=>{const s=mix(v.from,v.to,i/22),p=routePoint(s,0);return[p[0]-start[0],p[2]-start[2],0,0] as [number,number,number,number];});
 add({t:'vertramp',p:start,pts,vkind:'half',curve:'spline',rise:v.radius,w:v.flatHalf,arc:90,arcSteps:24,deck:v.deck,
  rails:false,edgeGrinding:false,tex:'solid',color:GREY[1],grp:g,nm:'Vert vault · clear wall-to-wall riding'});
 for(const target of v.targets)add({t:'crate',p:target.p,kind:target.kind,grp:g,nm:target.name});
 for(const guide of v.guides)add({t:'wumpa',p:guide.p,grp:g,nm:'High vert-air ascent cue'});
 // Cross-pipe arrows sit on the flat and point at the wall, while the fruit
// trail continues up beyond the coping toward the deliberately aerial boxes.
 for(const [s,side] of [[826,1],[874,-1]]){
  const p=routePoint(s,.028,side*2.3),a=routePoint(s-1,.028,side*.3),b=routePoint(s+1,.028,side*.3);
  add({t:'mesh',p,vertices:[0,0,0,a[0]-p[0],0,a[2]-p[2],b[0]-p[0],0,b[2]-p[2]],indices:[0,1,2],
   tex:'solid',color:AMBER,solid:false,doubleSided:true,edgeGrinding:false,grp:g,nm:'Pump across the halfpipe'});
 }
 road(v.exit.from,v.exit.rampEnd,lerpY(v.exit.from,v.exit.rampEnd,0,v.exit.top),v.exit.width,g,0,false,'Halfpipe floor departure');
 road(v.exit.rampEnd,v.exit.to,v.exit.top,v.exit.width,g);
 gap(958,1000,3.6,22,g,'rail transfer');
 railLine(944,976,s=>mix(4.4,5,(s-944)/32),s=>mix(0,-1.2,(s-944)/32),g,'After-pipe launch rail');
 railLine(982,1012,s=>mix(4.25,4.4,(s-982)/30),s=>mix(.8,0,(s-982)/30),g,'After-pipe receiving rail');
 road(1000,1040,3.6,9.6,g);fruitLine(780,910,0,g,0,26);fruitLine(926,942,lerpY(920,944,0,3.6),g,0,8);fruit(979,6.6,g,0);
 mark(933,1.95,g);checkpoint(1030,3.6,g,'High vert vault and rail transfer complete',-4);
}

// 5. A route-reading foundry. The right switch builds a safe lower reward
// perch; the left builds the ascent to the upper bridge switch. Ghost steel
// makes both consequences visible, and every incomplete route can return.
export const BLOCKWORKS_FOUNDRY={
 approach:routePoint(1080,3.6),stairsKey:routePoint(1085,3.6,-4.8),rewardKey:routePoint(1085,3.6,4.8),bridgeKey:routePoint(1136,8.4,-5.4),
 stairs:Array.from({length:5},(_,i)=>({s:1109.5+i*5,top:4.56+i*.96,skateTop:4.76+i*.96,u:-5.4})),
 bridge:[...Array.from({length:9},(_,i)=>({s:1143+i*6,top:8.4,u:Math.min(0,-5.4+i*1.8)})),{s:1195,top:8.4,u:0}],
 exit:routePoint(1200,8.4),groups:{stairs:100,reward:101,bridge:102},
};
{
 const g=14,f=BLOCKWORKS_FOUNDRY;
 road(1040,1106,3.6,s=>mix(8.4,16.8,smooth(1068,1084,s)),g);gap(1106,1198,3.6,36,g,'three-switch route puzzle');
 switchBox(1085,3.6,-4.8,100,'Left key · upper access stair');switchBox(1085,3.6,4.8,101,'Right key · lower reward perch');
 for(const p of f.stairs)steelPier(p.s,p.top,p.u,100,g,-2.4,4);
 box(routePoint(1136,8.4,-5.4),8.4,7.2,7.2,g,0,GREY[2],'Upper switch tower');
 switchBox(1136,8.4,-5.4,102,'Upper key · main curved crossing');
 for(const p of f.bridge)steelPier(p.s,p.top,p.u,102,g,-2.4,4);
 for(let i=0;i<4;i++)steelPier(1110.5+i*5,3.6,7+Math.min(i,2)*2,101,g,-2.4,4);
 const reward=routePoint(1131,3.6,11);
 box(reward,3.6,10,6,g,0,GREY[2],'Lower reward and bonus perch');crate(1131,3.6,'mask',g,11);fruit(1131,4.9,g,9);
 add({t:'bonusplatform',p:[reward[0]+3,3.6,reward[2]],to:[reward[0]-1.6,3.7,reward[2]+1],grp:g,nm:'Optional foundry bonus'});
 // A modest precision detour: same-height 2.2m gap, narrower 2.4m landing,
 // and an unobstructed return to the reward roof. Its column reaches ground.
 const crystalPerch:Point=[reward[0]-8.4,3.6,reward[2]];
 box(crystalPerch,3.6,2.4,2.4,g,0,'#b59dd4','Foundry crystal precision perch');
 add({t:'crystal',p:[crystalPerch[0],5,crystalPerch[2]],grp:g,nm:'Foundry optional precision reward'});
 road(1198,1300,8.4,s=>mix(9.2,8,(s-1198)/25)+1.2*groundFlare(s,1260,1274,1287,1300),g);
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
 road(1300,1340,8.4,s=>mix(8.4,12,smooth(1320,1337,s)),g);gap(1340,1370,8.4,20,g,'freight crossing');
 mover({t:'mover',p:BLOCKWORKS_MACHINE.ferry,s:[8,.8,8],axis:'z',travelSign:-1,amp:11,speed:.95,phase:-Math.PI/2,grp:g,nm:'Freight deck through the bend'});
 road(1370,1406,8.4,9.6,g);gap(1406,1414,8.4,18,g,'loading lift');
 mover({t:'mover',p:BLOCKWORKS_MACHINE.lift,s:[8,.8,8],axis:'y',amp:2.4,speed:1.1,phase:-Math.PI/2,grp:g,nm:'Fast loading lift'});
 for(const sign of [-1,1]){const p=BLOCKWORKS_MACHINE.lift;box([p[0]+sign*5.2,0,p[2]],14.4,.6,9,g,0,GREY[3],'Grounded lift guide');}
 road(1414,1520,13.2,8,g);road(1520,1560,13.2,s=>8+1.2*groundFlare(s,1525,1543,1553,1560),g);
 // Crest above the lift guides before descending onto the receiving roof.
 railLine(1320,1444,s=>s<=1410?mix(9.3,15.3,(s-1320)/90):mix(15.3,14.1,(s-1410)/34),s=>5.8*Math.sin(Math.PI*(s-1320)/124),g,'Machinery high line · rising S grind');
 fruitLine(1303,1330,8.4,g);fruitLine(1425,1545,13.2,g);
 checkpoint(1550,13.2,g,'Machinery and high roof complete',3.5);
}

// 7. Spend the height in one continuous run: descending bend -> short ice
// carry -> gap -> enemy choice -> kicker -> narrow roof/parapet. No reset
// plazas separate these commitments.
{
 const g=16;
 road(1560,1634,lerpY(1560,1634,13.2,4.8),8,g);road(1634,1640,4.8,8,g);
 road(1640,1664,4.8,8,g,0,true,'Roof-race ice carry');road(1664,1687,4.8,8.4,g);
 gap(1687,1695.2,4.8,18,g);road(1695.2,1740,4.8,8,g);
 road(1740,1754,lerpY(1740,1754,4.8,6.8),8,g,0,false,'Curved kicker');gap(1754,1766,6.8,18,g);
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
 road(1870,1985,6,8,g);checkpoint(1910,6,g,'Roof relay complete',2.7);
 road(1985,2008,6,8,g,0,true,'Final ice chord');road(2008,2018,6,8.4,g);gap(2018,2028.8,6,18,g);
 road(2028.8,2041,6,8.4,g);road(2041,2083,5.97,14.4,g,0,false,'Crown tower foundation');
 const steps=[{s:2048,top:8.4,u:-2.4},{s:2061,top:10.8,u:2.4},{s:2074,top:13.2,u:-2.4}]
  .map(p=>({...p,width:7.2,depth:12,point:routePoint(p.s,p.top,p.u)}));
 for(let i=0;i<steps.length;i++){const p=steps[i];assembly(p.s,6,i+1,3,5,g,p.u);fruit(p.s,p.top+1,g,p.u);}
 road(2078,2100,13.2,8,g,0,false,'Crown departure');gap(2100,2118,13.2,18,g,'finish grind');road(2118,2152,13.2,9.6,g);
 railLine(2088,2125,14,s=>-3*Math.sin(Math.PI*(s-2088)/37),g,'Crown arc into the finish');
 add({t:'gate',p:routePoint(2136,13.2),yaw:0,grp:g});
 fruitLine(1882,1980,6,g);fruit(2023,8.4,g);mark(2016,6,g);
 BLOCKWORKS_CLIMBS.push({name:'Crown roof bays',grp:g,start:routePoint(2039,6,-2.4),steps,exit:routePoint(2085,13.2)});
}

// Partial-width wedges keep the jump lines while making every block tier rideable.
export const BLOCKWORKS_SKATE_RAMPS:SkateWedge[]=[];
const skateBlock=(s:number,top:number,width:number,depth:number,u=0,yaw=routeYaw(s)):SkateBlock=>({p:routePoint(s,top,u),top,width,depth,yaw});
const joinBlocks=(a:SkateBlock,b:SkateBlock,g:number,name:string,w=2.4,gated=false)=>addSkateWedge(C,BLOCKWORKS_SKATE_RAMPS,a,b,g,name,w,gated);
const entryBlocks=[skateBlock(78,1.4,4.8,12,-3.4),skateBlock(93,2.8,4.8,12,-3.4),skateBlock(109,1.4,4.8,14,-3.4)];
joinBlocks(skateBlock(66,0,4.8,12,-2.7),entryBlocks[0],10,'Entry shelf access',2.4);
joinBlocks(entryBlocks[0],entryBlocks[1],10,'Entry upper shelf wedge',2.4);
joinBlocks(entryBlocks[1],entryBlocks[2],10,'Entry descending shelf wedge',2.4);
joinBlocks(skateBlock(123,0,8,14),entryBlocks[2],10,'Entry shelf return',2.4);
for(const climb of BLOCKWORKS_CLIMBS){
 const crown=climb.grp===17;
 let previous=crown?skateBlock(2035,6,8.4,12):skateBlock(267,-2.4,10.8,16);
 for(const [i,step]of climb.steps.entries()){
  const next:SkateBlock={p:step.point,top:step.top,width:step.width,depth:step.depth,yaw:routeYaw(step.s)};
  joinBlocks(previous,next,climb.grp,`${climb.name} · skate tier ${i+1}`,crown?2.4:3);
  previous=next;
 }
}
addWedgeBetween(C,BLOCKWORKS_SKATE_RAMPS,routePoint(275.3,-2.43,3.6),routePoint(282.15,-.03,9.5),2.2,11,'Courtyard east gallery wedge');
joinBlocks(skateBlock(1718,4.8,8,14),skateBlock(1728,7.2,4.8,9.6,5.5),16,'Relay east roof wedge',2.2);
joinBlocks(skateBlock(1823,6,7.2,14),skateBlock(1836,8.4,4.8,12,-5),16,'Relay west roof wedge',2.2);
// The same switch owns the steel lids and ramps; there is no permanent bypass.
const f=BLOCKWORKS_FOUNDRY;
let previous=skateBlock(1100,3.6,5,12,-5.4);
for(const [i,step]of f.stairs.entries()){
 const next=skateBlock(step.s,step.skateTop,3.84,3.84,step.u,0);
 addSkateLid(C,next,f.groups.stairs);
 joinBlocks(previous,next,f.groups.stairs,`Switch stair wedge ${i+1}`,1.8,true);previous=next;
}
for(const step of f.bridge)addSkateLid(C,skateBlock(step.s,step.top+.035,3.84,3.84,step.u,0),f.groups.bridge);
for(let i=0;i<4;i++)addSkateLid(C,skateBlock(1110.5+i*5,3.635,3.84,3.84,7+Math.min(i,2)*2,0),f.groups.reward);

// Follow the physical course. A short collinear run of nodes around each
// jump gives the camera time to settle onto the landing line before takeoff.
// These are ordinary editable camnodes; no camera or movement tuning changes.
const cameraJumps=BLOCKWORKS_GAPS.filter(gap=>gap.kind==='charged gap');
const cameraStations=new Set<number>();
for(let s=-30;s<=ROUTE_END+40;s+=10)cameraStations.add(s);
for(const gap of cameraJumps)for(const s of [gap.a-50,gap.a-35,gap.a,gap.b,gap.b+15,gap.b+30])cameraStations.add(s);
export const BLOCKWORKS_CAMERA_ROUTE:Point[]=[];
for(const s of [...cameraStations].sort((a,b)=>a-b)){
 const p=routePoint(s,0);
 for(const gap of cameraJumps){
  if(s<gap.a-50||s>gap.b+30)continue;
  const a=routePoint(gap.a,0),b=routePoint(gap.b,0);
  const straightX=a[0]+(b[0]-a[0])*(s-gap.a)/(gap.b-gap.a);
  const weight=smooth(gap.a-50,gap.a-35,s)*(1-smooth(gap.b+15,gap.b+30,s));
  p[0]=mix(p[0],straightX,weight);
 }
 BLOCKWORKS_CAMERA_ROUTE.push(p);add({t:'camnode',p,grp:1});
}
dressBlockworks(C,groups,BLOCKWORKS_ROADS,BLOCKWORKS_GAPS);
export const CODEX_LAB_LEVEL:CustomLevelData={
 v:1,name:'Haunted Hassle',spawn:routePoint(2,.15),killY:-20,sky:'haunted',keepPlayFog:true,cameraAirLift:.8,
 atmosphere:{...HAUNTED_ISLAND_ATMOSPHERE},
 medalTimes:{gold:240,silver:300,bronze:390},components:C,groups,
};

// Three connected session areas, with five independent skill branches.
// See docs/warehouse-flow/design.md for approach/receiver/recovery decisions.
export const WAREHOUSE_START:WarehousePoint=[0,3.35,10];
export const WAREHOUSE_EXIT:WarehousePoint=[-15,0,6];
export const WAREHOUSE_TOKEN_ROUTES = [
 {name:'01 / Loading gap',start:[-46,.15,-117],heading:[1,0,0],token:[-5,4.3,-117]},
 {name:'02 / Plywood gallery',start:[-47,.15,-90],heading:[0,0,1],token:[-47,6.9,-44]},
 {name:'03 / Workshop roof',start:[30,.15,-20],heading:[0,0,-1],token:[30,5.9,-57]},
 {name:'04 / Crane rail',start:[44,.15,-59],heading:[0,0,-1],token:[35,9.1,-94]},
 {name:'05 / Maintenance transfer',start:[7,.15,-83],heading:[-1,0,0],token:[-35,10.6,-83]},
] as const;
export const WAREHOUSE_GANTRY_RAIL:WarehousePoint[]=[[44,4.7,-80],[44,6.3,-85],[40,8.25,-91],[35,8.25,-94]];

export const WAREHOUSE_PARK_LEVEL:CustomLevelData=(()=>{
 const components:CustomComponent[]=[];
 const groups:CustomGroup[]=[{id:200,nm:'Warehouse / continuous floor and 48 m shell',editorOnly:true},
  {id:201,nm:'Arrival / ground-level finish',editorOnly:true},{id:202,nm:'Crossroads / linked street session',editorOnly:true},
  {id:203,nm:'Plywood halfpipe / gallery',editorOnly:true},{id:204,nm:'Loading dock / gap and runout',editorOnly:true},
  {id:205,nm:'Workshop / roof transfer',editorOnly:true},{id:206,nm:'Crane / rising rail',editorOnly:true},
  {id:207,nm:'Maintenance / high transfer',editorOnly:true}];
 let group=200;
 const add=(c:CustomComponent)=>{c.grp=group;components.push(c);return c;};
 const slab=(nm:string,x:number,z:number,top:number,w:number,d:number,h=.8,color='#c8ced0')=>
  add({t:'platform',nm,p:[x,top-h/2,z],s:[w,h,d],tex:'solid',color});
 const ramp=(nm:string,x:number,z:number,base:number,rise:number,len:number,w:number,yaw=0,color='#dee2e3')=>
  add({t:'ramp',nm,p:[x,base,z],rise,len,w,yaw,tex:'solid',color});
 const beam=(nm:string,a:WarehousePoint,b:WarehousePoint,w=.5,d=.5,color='#c4cecc')=>add(warehouseBeam(nm,a,b,w,d,color));
 const rail=(nm:string,points:WarehousePoint[],radius=5)=>{
  const p=points[0];return add({t:'rail',nm,p:[...p],pts:points.map((q,i)=>[q[0]-p[0],q[2]-p[2],i===0||i===points.length-1?0:radius,q[1]-p[1]]),color:'#d2d6d8'});
 };
 const roundRect=(w:number,d:number,r:number):[number,number][]=>{
  const pts:[number,number][]=[];
  for(const[x,z,a]of [[-w/2+r,d/2-r,.5],[-w/2+r,-d/2+r,1],[w/2-r,-d/2+r,1.5],[w/2-r,d/2-r,0]])
   for(let i=0;i<=12;i++){const angle=(a+i/24)*Math.PI;pts.push([x+Math.cos(angle)*r,z+Math.sin(angle)*r]);}
  return pts;
 };
 const trim=(nm:string,a:WarehousePoint,b:WarehousePoint,color:string)=>beam(nm,a,b,.08,.16,color);
 const island=(nm:string,x:number,z:number,w:number,d:number,h:number,bank:number,color:string)=>{
  const c=warehouseIsland(nm,x,z,w,d,h,bank);c.color=color;return add(c);
 };
 // Continuous base makes a missed optional line a recoverable floor session.
 const floor=slab('Continuous concrete floor',0,-58,0,116,156,2,'#ddd9d0');floor.depthBias=2;floor.edgeGrinding=false;
 add({t:'wallpath',nm:'Enclosed warehouse walls / 48 m',p:[0,-2,-58],pts:roundRect(112,152,8),closed:true,
  w:1,rise:50,collisionHeight:52,containment:true,tex:'solid',color:'#565f68'});
 const roof=slab('Warehouse roof / real ceiling',0,-58,48.6,116,156,.6,'#98a5a6');roof.edgeGrinding=false;
 for(let z=10;z>=-126;z-=22.667){
  for(const x of[-54,54])add({t:'wall',nm:'Warehouse portal column',p:[x,0,z],s:[1.2,47,1.2],tex:'solid',color:'#d0d4c9'});
  beam('Roof truss lower chord',[-54,43,z],[54,43,z],.65,.65);
  beam('Roof truss upper chord',[-54,47,z],[54,47,z],.65,.65);
  for(let x=-54;x<54;x+=13.5){
   beam('Roof truss diagonal',[x,43,z],[x+13.5,47,z],.28,.28);
   beam('Roof truss diagonal',[x,47,z],[x+13.5,43,z],.28,.28);
  }
 }
 for(const x of[-54,-27,0,27,54])beam('Roof longitudinal purlin',[x,47.6,16],[x,47.6,-132],.7,.7);
 // Separated low turnarounds leave floor entrances open on both sides.
 add({t:'vertramp',nm:'Front return quarter',p:[34,0,9],len:22,yaw:90,w:.5,rise:3,arc:80,deck:1.5,vkind:'quarter',tex:'solid',color:'#a3aaaf'});
 add({t:'vertramp',nm:'Back return quarter',p:[0,0,-129],len:30,yaw:-90,w:.5,rise:2.6,arc:80,deck:1,vkind:'quarter',tex:'solid',color:'#a3aaaf'});

 group=201;
 slab('Arrival balcony',0,10,3.2,20,10,3.2,'#bdcbd0');
 ramp('Arrival drop-in',0,-3.5,0,3.2,17,18,180,'#d2e0e4');
 rail('Arrival left handrail',[[-8,3.5,7],[-8,3.5,5],[-8,.65,-10]],2);
 trim('Arrival lip',[-9,3.24,5],[9,3.24,5],'#d7d9d5');
 add({t:'gate',nm:'Return with all five tokens',p:[...WAREHOUSE_EXIT]});
 add({t:'checkpoint',nm:'Arrival floor retry',p:[-15,0,-6]});

 group=202;
 island('First manual pad',0,-23,14,6,.55,3,'#e1e3dc');
 island('Crossroads hip / four directions',0,-49,20,18,1.8,5,'#cfd9d8');
 island('North link / pump and manual',0,-72,12,6,.75,4,'#dae1d8');
 rail('Street crescent / entry to hip',[[12,.65,-16],[17,.75,-25],[18,.8,-36],[15,1,-43],[10,2.05,-46],[7,2.05,-52]],7);
 rail('Crossroads west ledge',[[-9,2.05,-43],[-11,2.05,-48],[-9,2.05,-54],[-13,1.2,-60],[-16,.7,-65]],4);
 rail('North manual link',[[4,.95,-68],[4,.95,-75],[8,.7,-80],[14,.7,-82]],3);
 // Straight spine links can be ridden in either direction; low faces remain readable.
 island('Workshop cross-link hip',18,-53,2,6,1.2,2.5,'#d2ddda');
 island('Pipe cross-link hip',-17,-53,2,6,1.1,2.5,'#d2ddda');
 add({t:'checkpoint',nm:'Crossroads retry',p:[8,0,-32]});

 group=203;
 add({t:'vertramp',nm:'Standalone halfpipe / plywood session',p:[-31,0,-45],len:30,w:4,rise:3.6,
  vkind:'half',arc:90,arcSteps:24,lipRise:.3,deck:2.5,outerBank:3,tex:'solid',color:'#eddbc3'});
 slab('Plywood gallery / raised receiver',-47,-44,5.8,6,14,.8,'#ddcdb5');
 for(const z of[-49,-39])for(const x of[-49.5,-44.5])beam('Gallery support',[x,0,z],[x,5,z],.45,.45);
 ramp('Gallery pump bank',-47,-69.5,0,3.5,17,6,180,'#ddcdb5');
 rail('Gallery rising rail',[[-47,3.65,-62],[-47,4.3,-55],[-47,6.05,-47],[-47,6.05,-40]],5);
 ramp('Gallery return / forgiving drop',-47,-23.5,0,3.5,25,8,0,'#ddcdb5');
 trim('Gallery receiving edge',[-50,5.85,-51],[-44,5.85,-51],'#d4c5a4');
 rail('Plywood southern connector',[[-41,4.1,-31],[-36,3.6,-27],[-25,1.4,-27],[-19,.7,-29]],5);

 group=204;
 // Eastbound gap: the receiving deck and downhill runout share the approach heading.
 ramp('Loading dock approach',-35,-117,0,3.2,18,14,-90,'#d4d8c9');
 slab('Loading dock takeoff',-22,-117,3.2,8,14,3.2,'#d4d8c9');
 slab('Loading dock receiver / 6 m gap',-4,-117,3.2,16,14,3.2,'#d4d8c9');
 ramp('Loading dock downhill runout',13,-117,0,3.2,18,14,90,'#d4d8c9');
 rail('Dock gap rail',[[-26,3.45,-122],[-18,3.45,-122],[-10,3.45,-122],[4,3.45,-122],[20,.7,-122]],3);
 trim('Dock takeoff edge',[-18,3.25,-124],[-18,3.25,-110],'#d4c19b');
 trim('Dock receiving edge',[-12,3.25,-124],[-12,3.25,-110],'#d4c19b');
 add({t:'checkpoint',nm:'Loading floor retry',p:[-28,0,-100]});

 group=205;
 ramp('Workshop roof approach',30,-33,0,4.2,18,14,0,'#bfcedb');
 slab('Workshop takeoff',30,-44.5,4.2,14,5,4.2,'#bfcedb');
 slab('Workshop roof / 5 m transfer',30,-57.5,4.8,16,11,4.8,'#bfcedb');
 ramp('Workshop roof downhill',30,-72,0,4.8,18,16,180,'#bfcedb');
 rail('Workshop side grind',[[36,.65,-23],[36,4.45,-42],[36,4.45,-47],[36,5.05,-53],[36,5.05,-62],[36,.7,-80]],3);
 trim('Workshop takeoff edge',[23,4.25,-47],[37,4.25,-47],'#adc9d2');
 trim('Workshop receiving edge',[22,4.85,-52],[38,4.85,-52],'#adc9d2');

 group=206;
 ramp('Crane launch bank',44,-76,0,6,20,6,0,'#c7cbc0');
 slab('Crane landing / rail reward',35,-94,8,14,10,.8,'#c7cbc0');
 rail('Ascending crane-service rail',WAREHOUSE_GANTRY_RAIL,5);
 ramp('Crane return to crossroads',18,-94,0,8,20,8,-90,'#c7cbc0');
 for(const x of[29,41])beam('Crane suspension',[x,42,-94],[x,7.2,-94],.22,.22);
 beam('Crane header',[27,16.5,-94],[43,16.5,-94],.6,.6,'#dcc18a');
 trim('Crane receiving edge',[28,8.06,-89],[42,8.06,-89],'#d4c19b');

 group=207;
 ramp('Maintenance floor climb',-10,-83,0,8.5,28,7,90,'#c4cdd8');
 // High precision branch has its own ground entry and a visible 5 m break.
 slab('Maintenance shelf / high transfer',-35,-83,9.5,12,8,.8,'#c4cdd8');
 // The reward feeds the next takeoff; it never dumps into the dock's side.
 const maintenanceReturn=warehouseRibbon('Maintenance carved return to dock',
  [[-38,9.5,-83],[-46,8.8,-88],[-47,6.3,-98],[-41,3.8,-109],[-31,3.2,-116],[-23,3.2,-117]],8,.7);
 maintenanceReturn.color='#c4cdd8';add(maintenanceReturn);
 rail('Maintenance ascending edge',[[4,.7,-86],[-9,4.6,-86],[-24,8.75,-86]],0);
 rail('Maintenance shelf south edge',[[-30,9.75,-79],[-35,9.75,-79],[-40,9.75,-79]],2);
 for(const x of[-40,-30])beam('Maintenance suspension',[x,42,-78.5],[x,8.7,-78.5],.22,.22);
 trim('Maintenance receiving edge',[-29,9.56,-87],[-29,9.56,-79],'#b6c3cd');

 for(const [i,route]of WAREHOUSE_TOKEN_ROUTES.entries()){
  group=[204,203,205,206,207][i];add({t:'wumpa',nm:route.name,p:[...route.token]});
 }
 group=200;
 add({t:'zone',nm:'Warehouse / competition free-skate camera',p:[0,22,-58],s:[116,56,156],dir:'S'});
 groups.push({id:208,nm:'Warehouse / original Meshy architecture and dressing',editorOnly:true});
 components.push(...warehouseDressing(components));
 return {v:1,name:'Warehouse / Five Lines',spawn:[...WAREHOUSE_START],startWarpPad:false,killY:-14,
  skatepark:true,alwaysSkate:false,warehouseArt:true,skateCollectathon:true,sky:'day',keepPlayFog:true,
  atmosphere:{backdrop:'sky',fogEnabled:true,fogNear:75,fogFar:300,fogColor:'#78848d',ambientSky:'#b7cce2',ambientGround:'#817160',
   ambientIntensity:1.8,sunColor:'#f0e6d3',sunIntensity:7.5,sunDirection:[-.78,.5,-.24],fillColor:'#b9d2ed',fillIntensity:.6,drawDistance:450,shadowStrength:.9},
  components,groups};
})();

// Rooftop Relay: a separate lab brief, preserving the shipped Blockworks course.
// Coordinates are feet/top heights. Transfers share a straight X line, while
// the safe roof interiors give the player room to change lanes before each lip.
export const ROOFTOP_ROOFS = [
 {name:'Launch tower',x:0,top:96,depth:34,width:22,gap:0},
 {name:'First catch',x:0,top:92,depth:30,width:24,gap:4},
 {name:'Copper court',x:6,top:87,depth:36,width:24,gap:3.5},
 {name:'Laundry loft',x:6,top:81,depth:32,width:20,gap:3.75},
 {name:'Westward terrace',x:-4,top:73,depth:36,width:24,gap:3.5},
 {name:'Garden refuge',x:-8,top:67,depth:40,width:26,gap:3.5},
 {name:'Signal house',x:0,top:59,depth:34,width:22,gap:3.5},
 {name:'Eastward leap',x:8,top:52,depth:36,width:22,gap:3.5},
 {name:'Water-tank court',x:8,top:46,depth:40,width:26,gap:3.75},
 {name:'Slate steps',x:0,top:38,depth:34,width:22,gap:3.5},
 {name:'Last long alley',x:-6,top:31,depth:38,width:24,gap:4},
 {name:'Last refuge',x:-6,top:23,depth:40,width:26,gap:3.75},
 {name:'Arrival terrace',x:0,top:16,depth:46,width:28,gap:3.5},
].map((r,index,all)=>{
 const a=all.slice(0,index).reduce((sum,q)=>sum+q.depth+q.gap,0)+r.gap;
 return {...r,index,a,b:a+r.depth,entryX:index?(all[index-1].x+r.x)/2:r.x,
  exitX:index<all.length-1?(r.x+all[index+1].x)/2:r.x};
});
export const ROOFTOP_GAPS=ROOFTOP_ROOFS.slice(1).map((r,i)=>({index:i,a:ROOFTOP_ROOFS[i].b,b:r.a,x:r.entryX,from:ROOFTOP_ROOFS[i].top,to:r.top}));
export const ROOFTOP_CHECKPOINTS=[2,5,8,11].map(index=>{
 const r=ROOFTOP_ROOFS[index],p=rooftopPoint(r.a+22);return {index,p};
});
export const ROOFTOP_LENGTH=ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1].b;
export function rooftopPoint(s:number):Point {
 const r=ROOFTOP_ROOFS.find(r=>s<=r.b)??ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1];
 if(s<r.a){const prev=ROOFTOP_ROOFS[r.index-1];return[r.entryX,prev?mix(prev.top,r.top,(s-prev.b)/(r.a-prev.b)):r.top,-s];}
 const t=smooth(r.a+13,r.b-10,s);
 return[mix(r.entryX,r.exitX,t),r.top,-s];
}
export const ROOFTOP_RELAY_LEVEL:CustomLevelData=(()=>{
 const components:CustomComponent[]=[],roofGroups:CustomGroup[]=[];
 const add=(c:CustomComponent)=>components.push(c);
 const paint='#f9d074',landing='#82c8b9',roofColor='#697e82';
 const vertices=[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5];
 const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4];
 const prop=(p:Point,s:Point,color:string,nm:string,grp:number)=>add({t:'mesh',p,s,vertices,indices,color,tex:'solid',solid:false,edgeGrinding:false,nm,grp});
 const arrow=(x:number,y:number,s:number,grp:number,color=paint)=>add({t:'mesh',p:[x,y+.035,-s],
  vertices:[-1,0,1.3,1,0,1.3,1,0,0,2,0,0,0,0,-2,-2,0,0,-1,0,0],
  indices:[0,1,2,0,2,6,6,2,4,6,4,5,2,3,4],solid:false,doubleSided:true,castShadow:false,edgeGrinding:false,tex:'solid',color,grp,nm:'Painted downhill arrow'});
 const bodyColors=['#b68b71','#9e8779','#bba18a','#8b8d8b','#a37c69'];
 for(const r of ROOFTOP_ROOFS){
  const grp=300+r.index;roofGroups.push({id:grp,nm:`${String(r.index+1).padStart(2,'0')} · ${r.name}`,editorOnly:true});
  const z=-(r.a+r.b)/2;
  add({t:'wall',p:[r.x,0,z],s:[r.width,r.top-.35,r.depth],tex:'solid',color:bodyColors[r.index%bodyColors.length],edgeGrinding:false,grp,nm:`${r.name} · solid building`});
  add({t:'platform',p:[r.x,r.top-.175,z],s:[r.width+.4,.35,r.depth+.4],tex:'pavement',color:roofColor,grp,nm:`${r.name} · roof`});
  // Side parapets leave the complete departure and receiving edges open.
  for(const side of [-1,1]){
   add({t:'wall',p:[r.x+side*(r.width/2-.1),r.top,z],s:[.38,.65,r.depth-3],tex:'solid',color:'#d3b397',grp,nm:'Side parapet'});
   prop([r.x+side*(r.width/2+.015),r.top-1.7,z],[.08,.5,r.depth],paint,'Facade cornice',grp);
   for(let floor=6;floor<r.top-4;floor+=8)for(let s=r.a+4;s<r.b-2;s+=6)
    prop([r.x+side*(r.width/2+.03),floor,-s],[.08,2.8,2.2],'#475e69','Recessed window',grp);
  }
  for(let x=r.x-r.width/2+3;x<r.x+r.width/2-1;x+=5)for(let floor=6;floor<r.top-4;floor+=8)
   prop([x,floor,-r.b-.03],[1.8,2.8,.08],'#475e69','Street-facing window',grp);
  // Receiving zone extends well past the first contact: enough room to stop,
  // aim, or land a full-speed charged ollie before the next roof edge.
  prop([r.entryX,r.top+.018,-(r.a+4.5)],[10,.025,7],landing,'Broad receiving-zone paint',grp);
  arrow(r.entryX,r.top,r.a+7,grp,landing);
  for(const s of [r.a+17,r.b-10]){const p=rooftopPoint(s);arrow(p[0],r.top,s,grp);}
  if(r.index<ROOFTOP_ROOFS.length-1){
   prop([r.exitX,r.top+.02,-(r.b-1.8)],[8,.03,1],paint,'Takeoff stripe',grp);
   for(const side of [-1,1])prop([r.exitX+side*4.2,r.top+.3,-(r.b-1.7)],[.45,.6,1.3],paint,'Departure edge marker',grp);
  }
  // Every missed roof has a local fall plane; the city base is scenery, not
  // a forty-second fall. These zones are below all intended local landings.
  add({t:'pit',p:[r.x,r.top-12,z],s:[100,1,r.depth+r.gap+2],invisible:true,grp,nm:'Fast alley recovery'});
  const side=r.index%2?-1:1,px=r.x+side*(r.width/2-3);
  add({t:'platform',p:[px,r.top+.7,z+3],s:[2.8,1.4,3.6],tex:'metal',color:'#53676b',grp,nm:'Roof ventilation housing'});
  prop([px,r.top+1.45,z+3],[3.1,.18,3.9],'#bac6c3','Vent lid',grp);
  for(let j=-1;j<=1;j++)prop([px+j*.7,r.top+1.56,z+3],[.12,.06,2.7],'#475559','Vent grille',grp);
  // Distinct roof silhouettes act as landmarks between similar jumps.
  if([2,8].includes(r.index)){
   const tx=r.x-r.width/2+3.5,tz=-(r.a+24);
   for(const dx of [-1.2,1.2])prop([tx+dx,r.top+1.2,tz],[.25,2.4,2.4],'#4c5558','Water-tank steel trestle',grp);
   prop([tx,r.top+3.1,tz],[3.8,3,4.1],'#a97853','Copper rooftop water tank',grp);
   for(const dy of [2.1,4.1])prop([tx,r.top+dy,tz],[3.95,.18,4.25],'#485c60','Tank binding band',grp);
   prop([tx,r.top+4.65,tz],[4.2,.25,4.5],'#607376','Tank cap',grp);
  }
  if([5,11].includes(r.index))for(const side of [-1,1])for(const s of [r.a+7,r.b-8]){
   const x=r.x+side*(r.width/2-3.2);
   add({t:'platform',p:[x,r.top+.35,-s],s:[3,.7,4.5],tex:'stone',color:'#d4b18e',grp,nm:'Roof-garden planter'});
   for(const dx of [-.7,.7])prop([x+dx,r.top+1,-s],[1.3,1.3,3.4],'#64876c','Roof garden foliage',grp);
  }
  if([3,7,10].includes(r.index)){
   const x=r.x-r.width/2+2.6;
   add({t:'platform',p:[x,r.top+1.5,-(r.b-8)],s:[2,3,2],tex:'stone',color:'#ba8465',grp,nm:'Rooftop chimney'});
   prop([x,r.top+3.1,-(r.b-8)],[2.6,.3,2.6],'#d8bf9b','Chimney crown',grp);
  }

  for(const s of [r.a+10,r.a+19,r.b-6]){const p=rooftopPoint(s);add({t:'wumpa',p:[p[0],p[1]+1,-s],grp});}
  if([0,4,7,10].includes(r.index))add({t:'crate',p:[r.exitX+2.8,r.top,-(r.b-10)],kind:'wood',grp,nm:'Optional rooftop supply'});
 }
 for(const c of ROOFTOP_CHECKPOINTS)add({t:'checkpoint',p:c.p,grp:300+c.index,nm:'Safe roof checkpoint'});
 // An optional narrow maintenance balcony rewards a deliberate detour on
 // the largest safe roof; it never occupies the main transfer/landing line.
 const reward=ROOFTOP_ROOFS[8];
 add({t:'ramp',p:[reward.x+reward.width/2-5.3,reward.top,-(reward.a+23)],len:4,rise:.8,w:3.2,yaw:-90,tex:'metal',color:'#cc9b60',grp:308,nm:'Maintenance balcony access ramp'});
 add({t:'platform',p:[reward.x+reward.width/2+2.4,reward.top-.25,-(reward.a+23)],s:[5,.5,3.2],tex:'metal',color:'#cc9b60',grp:308,nm:'Optional maintenance balcony'});
 add({t:'crystal',p:[reward.x+reward.width/2+3.4,reward.top+1,-(reward.a+23)],grp:308});
 // A short step over the parapet is intentional; a second small platform
 // gives runners a broad return target rather than a one-way collectible.
 add({t:'platform',p:[reward.x+reward.width/2-1.7,reward.top+.4,-(reward.a+23)],s:[3.2,.8,4.5],tex:'metal',color:'#cc9b60',grp:308,nm:'Balcony access step'});
 const last=ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1];
 add({t:'gate',p:[last.x,last.top,-(last.b-9)],yaw:0,grp:312});
 for(const side of [-1,1])add({t:'platform',p:[last.x+side*8,last.top+.4,-(last.b-10)],s:[2,.8,8],tex:'stone',color:'#d6b88c',grp:312,nm:'Arrival terrace planter'});
 // Camera and controls follow the actual transfer line, with a settled heading
 // at each edge. The lane descends with the rooftops, never with street level.
 roofGroups.push({id:330,nm:'Ordered downhill camera lane',editorOnly:true},{id:331,nm:'Surrounding skyline',editorOnly:true});
 add({t:'camnode',p:[0,96,18],grp:330});
 for(const r of ROOFTOP_ROOFS)for(const s of [r.a,r.a+12,r.b-10,r.b])add({t:'camnode',p:rooftopPoint(s),grp:330});
 add({t:'camnode',p:[last.x,last.top,-last.b-25],grp:330});
 // Compact authored skyline masses make the altitude readable at play scale.
 for(let i=0;i<30;i++){
  const side=i%2?-1:1,s=-20+i*19,near=ROOFTOP_ROOFS.find(r=>s<=r.b)??last;
  const height=near.top-10+(i*17%31),x=near.x+side*(near.width/2+24+(i*11%28));
  prop([x,height/2,-s],[16+(i%3)*5,height,21+(i%4)*3],bodyColors[(i+2)%bodyColors.length],'Neighbouring city block',331);
  prop([x,height+.6,-s],[18+(i%3)*5,1.2,23+(i%4)*3],'#65777f','Distant roof cornice',331);
 }
 return {v:1,name:'Rooftop Relay',spawn:[0,96.12,-6],startWarpPad:false,killY:-8,sky:'sunset',keepPlayFog:true,cameraAirLift:1,cameraLookAhead:12,
  cameraRig:{camDist:9,camHeight:7.8,camPitch:35,camFov:60},
  atmosphere:{backdrop:'sky',fogEnabled:true,fogNear:110,fogFar:380,fogColor:'#b3a7a5',ambientSky:'#d5e2f1',ambientGround:'#8d7669',ambientIntensity:1.5,sunColor:'#ffdbad',sunIntensity:2.5,fillColor:'#a7c7de',fillIntensity:.5,drawDistance:550,shadowStrength:.7},
  medalTimes:{gold:35,silver:55,bronze:90},components,groups:roofGroups};
})();
