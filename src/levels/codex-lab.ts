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
// City rebuild: explicitly authored district sequences, actual alternate roofs,
// and level/uphill transfers. Station is distance along the curving city spine.
type RoofKind = 'court'|'taper'|'atrium'|'slalom'|'terrace'|'ribbon'|'diamond'|'works'|'crumble'|'garden'|'tower';
type RoofDistrictSpec = {name:string;lesson:string;lengths:number[];widths:number[];kinds:RoofKind[];heading:number;turn:number;roof:string;body:string;accent:string;fork?:number};
const roofDistrictSpecs:RoofDistrictSpec[]=[
 {name:'Copper Quarter',lesson:'Read the roofs · broad catches and short level hops',lengths:[44,28,58,22,36,18,50,30,62,24,44],widths:[30,20,26,15,24,12,28,18,32,16,24],kinds:['court','taper','terrace','tower','garden','diamond','court','taper','garden','tower','court'],heading:0,turn:24,roof:'#bd8060',body:'#d1a084',accent:'#ffe2a0'},
 {name:'Market Switchbacks',lesson:'Set up the turn · chimneys and widening corner courts',lengths:[36,64,20,42,28,54,16,70,24,46,38],widths:[26,24,13,20,16,28,10,32,14,22,28],kinds:['court','slalom','diamond','taper','tower','terrace','ribbon','slalom','tower','garden','court'],heading:48,turn:30,roof:'#617f9a',body:'#c0b2a0',accent:'#f5d167'},
 {name:'Hanging Gardens',lesson:'Choose a route · wide courtyard walk or narrow garden islets',lengths:[60,50,46,34,70,22,40,56,18,64,30],widths:[34,32,28,22,36,14,30,26,12,32,26],kinds:['garden','court','atrium','terrace','atrium','diamond','garden','atrium','tower','garden','court'],heading:6,turn:-42,roof:'#74977a',body:'#d9c0a1',accent:'#d5efaa',fork:-32},
 {name:'Sawtooth Foundry',lesson:'Climb the kickers · launch from rising roof lips',lengths:[32,46,24,54,20,62,66,26,72,18,48],widths:[24,20,14,26,12,28,18,16,30,10,26],kinds:['court','works','tower','taper','diamond','works','slalom','ribbon','terrace','tower','court'],heading:-54,turn:-24,roof:'#8c7983',body:'#b18b7e',accent:'#ffbc66'},
 {name:'Glass Mile',lesson:'Change the rhythm · long skylight halls and tiny connector roofs',lengths:[82,48,66,26,94,20,48,32,76,22,58],widths:[30,30,26,16,36,10,24,14,32,12,28],kinds:['atrium','court','slalom','diamond','atrium','ribbon','terrace','tower','atrium','taper','court'],heading:-8,turn:46,roof:'#6d9a9d',body:'#b5c2bd',accent:'#b9fff0',fork:36},
 {name:'Water-Tower Heights',lesson:'Earn altitude · rising gaps between compact tower tops',lengths:[30,24,48,18,62,32,22,54,28,38,70],widths:[24,14,22,10,30,16,12,26,18,20,32],kinds:['court','tower','terrace','diamond','slalom','taper','tower','garden','works','ribbon','court'],heading:62,turn:18,roof:'#a87956',body:'#c3a68b',accent:'#f2d395'},
 {name:'Freight Roofs',lesson:'Hold a line · narrow warehouses, coping rails and open spans',lengths:[54,32,72,20,44,28,86,22,60,18,46],widths:[22,12,18,9,16,11,20,8,18,9,24],kinds:['works','ribbon','slalom','tower','taper','ribbon','works','diamond','terrace','tower','court'],heading:18,turn:-46,roof:'#71859a',body:'#9ea4a4',accent:'#ffcc66'},
 {name:'Billboard Bend',lesson:'Commit to the fork · tighter antenna roofs hold the crystal',lengths:[42,68,24,54,18,76,30,66,26,64,38],widths:[26,32,12,24,9,28,16,20,11,30,24],kinds:['court','court','tower','atrium','ribbon','terrace','diamond','slalom','tower','garden','court'],heading:-64,turn:-14,roof:'#977896',body:'#bbaaaf',accent:'#ffabce',fork:-40},
 {name:'Construction Exchange',lesson:'Keep moving · loose panels, duct chicanes and ramp transfers',lengths:[64,28,46,22,72,32,54,18,68,26,44],widths:[26,14,20,10,28,16,22,8,24,12,26],kinds:['works','taper','crumble','tower','slalom','diamond','crumble','ribbon','terrace','tower','court'],heading:-18,turn:50,roof:'#a79472',body:'#b7a489',accent:'#ffe36a'},
 {name:'Conservatory Crescent',lesson:'Pick your pace · broad planted atriums or a thin outside gallery',lengths:[52,50,76,24,48,20,64,30,82,26,42],widths:[30,30,34,12,24,9,30,16,36,14,28],kinds:['garden','court','atrium','tower','garden','diamond','atrium','ribbon','garden','terrace','court'],heading:52,turn:26,roof:'#698f82',body:'#d6cbb0',accent:'#d4e9a0',fork:38},
 {name:'Antenna Run',lesson:'Precision chain · short narrow catches, staggered entries and climbs',lengths:[30,16,66,22,62,18,38,26,54,20,70],widths:[22,8,16,9,24,7,14,8,20,7.5,28],kinds:['court','tower','slalom','diamond','terrace','ribbon','works','taper','crumble','tower','court'],heading:8,turn:-55,roof:'#738798',body:'#bbc3c5',accent:'#c5e9ff'},
 {name:'Civic Crown',lesson:'The final crossing · combine the turns, atriums, ramps and precision line',lengths:[68,48,42,18,78,28,54,20,66,32,92],widths:[32,30,22,8,28,14,24,9,30,16,40],kinds:['garden','court','atrium','ribbon','slalom','diamond','works','tower','atrium','terrace','court'],heading:-42,turn:42,roof:'#a8a0a2',body:'#dac9b5',accent:'#fff0b5',fork:-34},
];
export interface RooftopRoof {index:number;district:number;name:string;a:number;b:number;depth:number;width:number;top:number;rise:number;step:number;gap:number;kind:RoofKind;route:number;}
export const ROOFTOP_ROOFS:RooftopRoof[]=[];
export const ROOFTOP_DISTRICTS:{index:number;name:string;lesson:string;a:number;b:number;first:number;last:number;heading:number;turn:number;roof:string;body:string;accent:string}[]=[];
let roofStation=0,roofHeight=28;
for(const [district,d] of roofDistrictSpecs.entries()){
 const a=roofStation,first=ROOFTOP_ROOFS.length;
 for(let j=0;j<d.lengths.length;j++){
  const index=ROOFTOP_ROOFS.length,depth=d.lengths[j];
  const climb=!d.fork&&[3,7,10].includes(j)||!!d.fork&&j===10;
  const rise=climb?(district<3?1.5:district<7?2.2:2.8):0;
  const step=climb&&j===7?.55:0;
  const gap=2.8+Math.min(1.4,district*.12)+[0,.25,.5,.1][j%4];
  ROOFTOP_ROOFS.push({index,district,name:`${d.name} / ${j+1}`,a:roofStation,b:roofStation+depth,depth,width:d.widths[j],top:roofHeight,rise,step,gap,kind:d.kinds[j],route:-1});
  roofStation+=depth+gap;roofHeight+=rise+step;
 }
 const last=ROOFTOP_ROOFS.length-1;
 ROOFTOP_DISTRICTS.push({index:district,name:d.name,lesson:d.lesson,a,b:roofStation,first,last,heading:d.heading,turn:d.turn,roof:d.roof,body:d.body,accent:d.accent});
}
ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1].rise=0;
export const ROOFTOP_LENGTH=ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1].b;
// Integrated headings give a true arc-length city route, with several broad
// reversals of lateral direction. The forward Z component stays negative so
// district skylines and camera lanes cannot accidentally cross one another.
const roofSpine:Point[]=[[0,0,0]],roofHeadings:number[]=[];
function roofHeadingAt(s:number){
 const d=ROOFTOP_DISTRICTS.find(d=>s<d.b)??ROOFTOP_DISTRICTS[ROOFTOP_DISTRICTS.length-1];
 const t=Math.max(0,Math.min(1,(s-d.a)/(d.b-d.a))),next=ROOFTOP_DISTRICTS[d.index+1]?.heading??0;
 return mix(d.heading,next,smooth(.72,1,t))+d.turn*Math.sin(Math.PI*t);
}
for(let s=0;s<=ROOFTOP_LENGTH+50;s+=2){
 const yaw=Math.max(-80,Math.min(80,roofHeadingAt(s)))*Math.PI/180;roofHeadings.push(yaw);
 if(s>0){const p=roofSpine[roofSpine.length-1];roofSpine.push([p[0]-Math.sin(yaw)*2,0,p[2]-Math.cos(yaw)*2]);}
}
export function rooftopYaw(s:number){return (roofHeadings[Math.max(0,Math.min(roofHeadings.length-1,Math.round(s/2)))]??0)*180/Math.PI;}
export function rooftopWorld(s:number,y:number,u=0):Point{
 const k=Math.max(0,Math.min(roofSpine.length-2,Math.floor(s/2))),t=(s-k*2)/2,a=roofSpine[k],b=roofSpine[k+1],yaw=rooftopYaw(s)*Math.PI/180;
 return[a[0]+(b[0]-a[0])*t+Math.cos(yaw)*u,y,a[2]+(b[2]-a[2])*t-Math.sin(yaw)*u];
}
export function rooftopProject(x:number,z:number,hint?:number){
 let best=Infinity,result=0;
 const lo=hint===undefined?0:Math.max(0,Math.floor((hint-45)/2)),hi=hint===undefined?roofSpine.length-1:Math.min(roofSpine.length-1,Math.ceil((hint+65)/2));
 for(let k=lo;k<hi;k++){
  const a=roofSpine[k],b=roofSpine[k+1],dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));
  const distance=(x-a[0]-t*dx)**2+(z-a[2]-t*dz)**2;
  if(distance<best){best=distance;result=(k+t)*2;}
 }
 return result;
}
export const ROOFTOP_FORKS=roofDistrictSpecs.flatMap((d,index)=>{
 if(!d.fork)return[];
 const district=ROOFTOP_DISTRICTS[index],first=ROOFTOP_ROOFS[district.first+1],last=ROOFTOP_ROOFS[district.first+8];
 return[{index:district.index,a:first.a+6,b:last.b-6,offset:d.fork,top:first.top,name:index===7?'Antenna crystal line':index===2?'Garden island line':index===4?'Glasshouse service roofs':index===9?'Outside conservatory gallery':'Crown precision line',width:index===7?5.2:index===11?5.6:7.2}];
});
export const ROOFTOP_BRANCH_ROOFS:RooftopRoof[]=ROOFTOP_FORKS.flatMap((f)=>{
 const count=8,gap=f.index<7?3.5:4.15,available=f.b-f.a-gap*(count-1),weights=[1.3,.65,1.1,.75,1.45,.6,1,1.15],sum=weights.reduce((a,b)=>a+b,0);let a=f.a;
 return weights.map((weight,j)=>{
  const depth=available*weight/sum,r:RooftopRoof={index:200+f.index*10+j,district:f.index,name:`${f.name} / ${j+1}`,a,b:a+depth,depth,width:f.width+(j===0||j===7?3:j%3===0?1.8:0),top:f.top,rise:0,step:0,gap,kind:j%3===0?'diamond':j%3===1?'ribbon':'tower',route:f.index};a=r.b+gap;return r;
 });
});
const roofForkOffset=(s:number,route:number)=>{const f=ROOFTOP_FORKS.find(f=>f.index===route);if(!f)return 0;const run=Math.min(90,(f.b-f.a)*.25);return f.offset*smooth(f.a,f.a+run,s)*(1-smooth(f.b-run,f.b,s));};
export function rooftopRoofAt(s:number,route='main'){
 const fork=route==='main'?undefined:ROOFTOP_FORKS.find(f=>(route==='challenge'||route===`fork-${f.index}`)&&s>=f.a&&s<=f.b);
 const list=fork?ROOFTOP_BRANCH_ROOFS.filter(r=>r.route===fork.index):ROOFTOP_ROOFS;
 return list.find(r=>s<=r.b)??list[list.length-1];
}
export function rooftopSurfaceY(r:RooftopRoof,s:number){return r.top+r.rise*smooth(r.b-Math.min(22,r.depth*.48),r.b,s);}
function roofGuideOffset(r:RooftopRoof,s:number){
 const t=Math.max(0,Math.min(1,(s-r.a)/r.depth)),edge=smooth(0,.22,t)*(1-smooth(.78,1,t));
 if(r.kind==='atrium'){const neck=Math.min(24,r.depth*.28);return -(r.width/2-3.2)*smooth(r.a+1,r.a+neck-1,s)*(1-smooth(r.b-neck+1,r.b-1,s));}
 if(r.kind==='slalom')return Math.sin(t*Math.PI*2)*Math.min(5,r.width*.25)*edge;
 return 0;
}
export function rooftopPoint(s:number,route='main'):Point{
 const r=rooftopRoofAt(s,route);let y=rooftopSurfaceY(r,s);
 if(s<r.a){const prev=(r.route<0?ROOFTOP_ROOFS:ROOFTOP_BRANCH_ROOFS.filter(q=>q.route===r.route)).find(q=>q.b<r.a&&q.index===r.index-1);if(prev)y=mix(prev.top+prev.rise,r.top,(s-prev.b)/(r.a-prev.b));}
 return rooftopWorld(s,y,roofForkOffset(s,r.route)+roofGuideOffset(r,s));
}
function roofGaps(list:RooftopRoof[]){return list.slice(1).map((r,i)=>({index:`${list[i].index}-${r.index}`,a:list[i].b,b:r.a,from:list[i].top+list[i].rise,to:r.top,roof:list[i].index,next:r.index,route:r.route,ramp:list[i].rise>0}));}
export const ROOFTOP_GAPS=roofGaps(ROOFTOP_ROOFS);
export function rooftopGaps(route='main'){
 const forks=route==='main'?[]:ROOFTOP_FORKS.filter(f=>route==='challenge'||route===`fork-${f.index}`);
 return [...ROOFTOP_GAPS.filter(g=>!forks.some(f=>(g.a+g.b)/2>f.a&&(g.a+g.b)/2<f.b)),...forks.flatMap(f=>roofGaps(ROOFTOP_BRANCH_ROOFS.filter(r=>r.route===f.index)))].sort((a,b)=>a.a-b.a);
}
export const ROOFTOP_CHECKPOINTS=ROOFTOP_DISTRICTS.flatMap(d=>[d.first,d.last].map(index=>{
 const r=ROOFTOP_ROOFS[index],s=r.a+Math.min(r.depth*.52,28);return{index,s,p:rooftopPoint(s),district:d.index};
}));
export const ROOFTOP_RELAY_LEVEL:CustomLevelData=(()=>{
 const components:CustomComponent[]=[],groups:CustomGroup[]=ROOFTOP_DISTRICTS.map(d=>({id:300+d.index,nm:`${String(d.index+1).padStart(2,'0')} · ${d.name} · ${d.lesson}`,editorOnly:true}));
 groups.push({id:390,nm:'Ordered city camera lane',editorOnly:true});
 const visual=ROOFTOP_DISTRICTS.map(d=>({p:rooftopWorld(d.a,0),vertices:[] as number[],indices:[] as number[],colors:[] as number[]}));
 const rgb=(hex:string)=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
 const face=(district:number,points:Point[],indices:number[],color:string)=>{const v=visual[district],k=v.vertices.length/3;for(const p of points){v.vertices.push(p[0]-v.p[0],p[1],p[2]-v.p[2]);v.colors.push(...rgb(color));}v.indices.push(...indices.map(i=>i+k));};
 const box=(district:number,p:Point,size:Point,color:string,yaw=0)=>{
  const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),points:Point[]=[];
  for(const [x,y,z] of [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]){const dx=x*size[0]/2,dz=z*size[2]/2;points.push([p[0]+c*dx+s*dz,p[1]+y*size[1]/2,p[2]-s*dx+c*dz]);}
  face(district,points,[0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4],color);
 };
 // Both routes own physical clearance at their split and merge. The blue
 // bridge can cross an earlier courtyard edge before its final receiver.
 const crossesBranch=(r:RooftopRoof,s:number,u:number,w=0,depth=0)=>r.route<0&&ROOFTOP_FORKS.some(f=>
  [s-depth/2,s,s+depth/2].some(t=>t>=f.a&&t<=f.b&&Math.abs(u-roofForkOffset(t,f.index))<(f.width+5)/2+w/2+1.4));
 const localBox=(r:RooftopRoof,s:number,u:number,y:number,size:Point,color:string)=>box(r.district,rooftopWorld(s,y,roofForkOffset(s,r.route)+u),size,color,rooftopYaw(s));
 const arrow=(r:RooftopRoof,s:number,u:number,color:string,scale=1)=>{
  const y=rooftopSurfaceY(r,s)+.045,base=roofForkOffset(s,r.route)+u;
  face(r.district,[[-.7,1.2],[.7,1.2],[.7,0],[1.45,0],[0,-1.8],[-1.45,0],[-.7,0]].map(([x,z])=>rooftopWorld(s-z*scale,y,base+x*scale)),[0,1,2,0,2,6,6,2,4,6,4,5,2,3,4],color);
 };
 const widthAt=(r:RooftopRoof,s:number)=>{const t=Math.max(0,Math.min(1,(s-r.a)/r.depth));return r.width*(r.kind==='taper'?1.15-.4*t:r.kind==='diamond'?.72+.4*Math.sin(Math.PI*t):1);};
 const outline=(r:RooftopRoof,a:number,b:number,width:number|((s:number)=>number),u=0)=>{
  const n=Math.max(1,Math.ceil((b-a)/14)),s=Array.from({length:n+1},(_,i)=>a+(b-a)*i/n);
  return [...s.map(t=>rooftopWorld(t,0,roofForkOffset(t,r.route)+u-(typeof width==='function'?width(t):width)/2)),...s.reverse().map(t=>rooftopWorld(t,0,roofForkOffset(t,r.route)+u+(typeof width==='function'?width(t):width)/2))];
 };
 const plate=(r:RooftopRoof,a:number,b:number,width:number|((s:number)=>number),u=0,suffix='roof')=>{
  const p=rooftopWorld((a+b)/2,r.top-.2,roofForkOffset((a+b)/2,r.route)),pts=outline(r,a,b,width,u).map(q=>[q[0]-p[0],q[2]-p[2]] as [number,number]);
  const d=ROOFTOP_DISTRICTS[r.district],grp=300+r.district;
  components.push({t:'wall',p:[p[0],0,p[2]],s:[1,r.top-.4,1],pts,tex:'solid',color:d.body,edgeGrinding:false,grp,nm:`${r.name} · building mass`});
  components.push({t:'platform',p,s:[1,.4,1],pts,tex:'solid',color:r.route>=0?'#679d96':d.roof,grp,nm:`RR:${r.index} ${suffix}`});
 };
 const ramp=(r:RooftopRoof)=>{
  if(!r.rise)return;const a=r.b-Math.min(22,r.depth*.48),n=8,points:Point[]=[],indices:number[]=[];
  for(let i=0;i<=n;i++){const s=mix(a,r.b,i/n),w=widthAt(r,s)*.82;for(const side of [-1,1])points.push(rooftopWorld(s,rooftopSurfaceY(r,s)+.02,roofForkOffset(s,r.route)+side*w/2));if(i){const k=(i-1)*2;indices.push(k,k+1,k+3,k,k+3,k+2);}}
  const topTriangles=indices.length/3,p=points[0],vertices=points.flatMap(q=>[q[0]-p[0],q[1]-p[1],q[2]-p[2]]),count=points.length;
  for(const q of points)vertices.push(q[0]-p[0],r.top-.15-p[1],q[2]-p[2]);
  for(let i=0;i<n;i++)for(const side of [0,1]){const k=i*2+side,j=k+2;indices.push(k,j,j+count,k,j+count,k+count);}
  for(const k of [0,count-2])indices.push(k,k+count,k+count+1,k,k+count+1,k+1);
  // Keep current mesh metadata explicit when this level is edited in an older local toolkit.
  const launch:CustomComponent & {solidSides:boolean;grindTopTriangles:number}={t:'mesh',p,vertices,indices,solidSides:true,grindTopTriangles:topTriangles,tex:'metal',color:ROOFTOP_DISTRICTS[r.district].accent,grp:300+r.district,nm:`RR:${r.index} rising launch roof`};
  components.push(launch);
 };
 const solidProp=(r:RooftopRoof,s:number,u:number,width:number,height:number,depth:number,color:string,name:string)=>{
  const p=rooftopWorld(s,rooftopSurfaceY(r,s),roofForkOffset(s,r.route)+u);
  components.push({t:'wall',p,s:[width,height,depth],yaw:rooftopYaw(s),tex:'solid',color,grp:300+r.district,nm:name});
 };
 for(const r of [...ROOFTOP_ROOFS,...ROOFTOP_BRANCH_ROOFS]){
  const d=ROOFTOP_DISTRICTS[r.district],grp=300+r.district,mid=(r.a+r.b)/2;
  if(r.kind==='atrium'){
   const neck=Math.min(24,r.depth*.28),walk=6.4;
   plate(r,r.a,r.a+neck,r.width,0,'atrium entry');plate(r,r.b-neck,r.b,r.width,0,'atrium exit');
   for(const side of [-1,1])plate(r,r.a+neck-.05,r.b-neck+.05,walk,side*(r.width/2-walk/2),'atrium gallery');
   for(const side of [-1,1])for(const s of [r.a+neck+3,r.b-neck-3]){if(crossesBranch(r,s,side*(r.width/2-1),3,3))continue;localBox(r,s,side*(r.width/2-1),r.top+1.2,[1.2,2.4,1.2],'#486b60');localBox(r,s,side*(r.width/2-1),r.top+2.6,[3,1.2,3],'#789568');}
   // The opening is a real unfilled void, with a lower visible interior.
   localBox(r,mid,0,1,[Math.max(2,r.width-14),2,Math.max(2,r.depth-24)],'#354b52');
  }else if(r.kind==='crumble'){
   const a=mid-4,b=mid+4;plate(r,r.a,a,r.width);plate(r,b,r.b,r.width);
   components.push({t:'crumble',p:rooftopWorld(mid,r.top),s:[r.width,.45,8.2],yaw:rooftopYaw(mid),shake:1.15,speed:30,grp,nm:`RR:${r.index} loose construction deck`});
   for(const side of [-1,1])localBox(r,mid,side*(r.width/2+1),r.top-2,[.6,4,10],'#d7b466');
  }else plate(r,r.a,r.b,s=>widthAt(r,s));
  ramp(r);
  if(!['atrium','crumble'].includes(r.kind))for(let s=r.a+6;s<r.b-2;s+=7){
   const w=widthAt(r,s),u=roofForkOffset(s,r.route),y=rooftopSurfaceY(r,s)+.027;
   face(r.district,[rooftopWorld(s-.035,y,u-w/2+.15),rooftopWorld(s-.035,y,u+w/2-.15),rooftopWorld(s+.035,y,u+w/2-.15),rooftopWorld(s+.035,y,u-w/2+.15)],[0,1,2,0,2,3],'#59666e');
  }
  // High windows, cornices and parapet sections vary by district. They are
  // batched per district rather than thousands of independent scene objects.
  for(const s of [r.a+r.depth*.25,r.a+r.depth*.65])for(const side of [-1,1]){
   const u=side*(widthAt(r,s)/2-.25),y=r.top;
   if(r.width>14&&r.route<0&&!crossesBranch(r,s,u,.45,Math.min(10,r.depth*.22)))solidProp(r,s,u,.45,.64,Math.min(10,r.depth*.22),'#d5c6ad','Short solid roof parapet');
   for(const h of [5,11,17])if(y>h+4)localBox(r,s,side*(widthAt(r,s)/2+.035),y-h,[.08,2.4,3.4],r.district===7?'#e6acba':'#445e70');
   localBox(r,s,side*(widthAt(r,s)/2+.08),y-1.5,[.18,.45,Math.min(14,r.depth*.28)],d.accent);
  }
  if(r.kind==='slalom')for(const [t,side] of [[.32,-1],[.68,1]]){
   const s=r.a+r.depth*t,u=side*r.width*.2;
   if(crossesBranch(r,s,u,r.width*.38,4))continue;
   solidProp(r,s,u,r.width*.36,1.45,3.5,'#596d76','Alternating ventilation housing');
   localBox(r,s,u,r.top+1.56,[r.width*.38,.22,3.8],'#c3d0ce');
   for(const off of [-.8,0,.8])localBox(r,s+off,u,r.top+1.71,[r.width*.3,.06,.12],'#3b5057');
  }
  if(['terrace','garden','court'].includes(r.kind)&&r.width>18)for(const side of [-1,1]){
   const s=mid,u=side*(r.width/2-3.2);
   if(crossesBranch(r,s,u,3.4,6))continue;
   solidProp(r,s,u,3.4,.8,6,'#c8b195','Garden terrace planter');localBox(r,s,u,r.top+1.4,[3.1,1.3,5.6],r.district%2?'#668f71':'#8b9a68');
  }
  if((r.kind==='tower'||r.district===5&&r.kind==='terrace')&&!crossesBranch(r,mid,(r.index%2?1:-1)*Math.max(2,r.width/2-2),3.5,4)){
   const s=mid,u=(r.index%2?1:-1)*Math.max(2,r.width/2-2);
   localBox(r,s,u,r.top+1.6,[.3,3.2,2.4],'#4b5a61');localBox(r,s,u,r.top+3.7,[3.1,3,3.3],'#a37957');
   for(const h of [2.5,4.6])localBox(r,s,u,r.top+h,[3.3,.2,3.5],'#465b64');
  }
  if(r.kind==='works'){
   for(const side of [-1,1]){const s=mid,u=side*(r.width/2-1.4);localBox(r,s,u,r.top+3.5,[.3,7,.3],'#cfb281');localBox(r,s,u,r.top+7,[.4,.4,Math.min(25,r.depth*.6)],d.accent);}
   if(r.width>17)solidProp(r,mid,r.width/2-3,3,2,8,'#526b7c','Freight service block');
  }
  // Branch decks are visibly different structures with open steel trestles.
  if(r.route>=0)for(const side of [-1,1])localBox(r,mid,side*r.width*.4,r.top-3,[.45,6,Math.max(3,r.depth-6)],'#495c69');
  if(r.district===7&&r.route<0&&r.index%3===0){
   const s=mid,u=r.width/2+2;localBox(r,s,u,r.top+5,[.5,10,.5],'#4c5b67');localBox(r,s,u,r.top+10,[.8,6,11],'#553f65');
   for(const h of [-1.4,0,1.4])localBox(r,s,u-.45,r.top+10+h,[.15,.45,9],'#f7bcdb');
  }
  // Two genuinely different paths are visible before the choice. Gold marks
  // the broad city route; turquoise marks the thinner optional roof chain.
  for(const s of [r.a+Math.min(7,r.depth*.2),r.b-Math.min(6,r.depth*.2)])arrow(r,s,roofGuideOffset(r,s),r.route<0?d.accent:'#87f3e1',r.width<10?.7:1);
  for(let s=r.a+10;s<r.b-5;s+=16){const p=rooftopPoint(s,r.route<0?'main':`fork-${r.route}`);components.push({t:'wumpa',p:[p[0],p[1]+1,p[2]],grp});}
  const lip=r.b-1.15,w=Math.min(8,widthAt(r,lip)*.8);localBox(r,lip,0,rooftopSurfaceY(r,lip)+.045,[w,.05,.7],r.route<0?d.accent:'#87f3e1');
  if(r.route<0){
   const p=rooftopWorld(mid,r.top-12),pts=outline(r,r.a-4,r.b+r.gap+4,180).map(q=>[q[0]-p[0],q[2]-p[2]] as [number,number]);
   components.push({t:'pit',p,s:[1,1,1],pts,invisible:true,grp,nm:'Local street reset · short missed-roof recovery'});
  }
 }
 for(const c of ROOFTOP_CHECKPOINTS){
  const r=ROOFTOP_ROOFS[c.index],p=c.p;components.push({t:'checkpoint',p,grp:300+r.district,nm:`${ROOFTOP_DISTRICTS[r.district].name} · refuge`});
  localBox(r,c.s,0,p[1]+.025,[Math.min(12,r.width*.7),.035,6],'#8abca8');
  if(c.index===ROOFTOP_DISTRICTS[r.district].last)components.push({t:'crate',p:rooftopWorld(c.s+4,p[1],2.4),kind:r.district%3===2?'life':'mask',grp:300+r.district,nm:'Refuge supply'});
 }
 for(const f of ROOFTOP_FORKS){
  const r=rooftopRoofAt(f.a),p=rooftopWorld(f.a-3,f.top);
  for(const side of [-1,1]){box(f.index,rooftopWorld(f.a-3,f.top+2,side*4),[.25,4,.25],'#53646b',rooftopYaw(f.a));}
  box(f.index,[p[0],f.top+4,p[2]],[9,.6,.5],'#8ae4d4',rooftopYaw(f.a));
  components.push({t:'crate',p:rooftopWorld(f.b-8,f.top,roofForkOffset(f.b-8,f.index)+2.4),kind:'mystery',grp:300+f.index,nm:`${f.name} reward`});
  arrow(r,f.a-5,Math.sign(f.offset)*3,'#87f3e1',1.2);
 }
 const crystalFork=ROOFTOP_FORKS.find(f=>f.index===7)!,crystalRoof=ROOFTOP_BRANCH_ROOFS.filter(r=>r.route===7)[4],crystalS=(crystalRoof.a+crystalRoof.b)/2;
 components.push({t:'crystal',p:rooftopWorld(crystalS,crystalFork.top+1,roofForkOffset(crystalS,7)),grp:307,nm:'Billboard antenna-route crystal'});
 // Grindable coping shortcuts are optional and rejoin their own real roof.
 for(const district of [3,6,8,10]){
  const d=ROOFTOP_DISTRICTS[district],r=ROOFTOP_ROOFS[d.first+4],a=r.a+5,b=r.b-4,p=rooftopWorld(a,r.top+.9,-r.width/2+.4),pts=[] as [number,number,number,number][];
  for(let s=a;s<=b;s+=Math.max(1,(b-a)/6)){const q=rooftopWorld(s,r.top+.9,-widthAt(r,s)/2+.4);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
  components.push({t:'rail',p,pts,grp:300+district,nm:'Optional roof-edge coping line'});
 }
 // District-specific skyline silhouettes: market bays, glass blocks, paired
 // towers, smokestacks, conservatory frames and the final civic observatory.
 for(const d of ROOFTOP_DISTRICTS){
  for(let i=0;i<9;i++){
   const s=mix(d.a+12,d.b-15,i/8),r=rooftopRoofAt(s),side=i%2?1:-1,u=side*(65+(i%3)*13),height=r.top+(-8+(i*11%26));
   const p=rooftopWorld(s,height/2,u),width=16+(i%4)*8,depth=20+(i%3)*10;
   box(d.index,p,[width,height,depth],i%2?d.body:'#9eabb0',rooftopYaw(s));box(d.index,rooftopWorld(s,height+.5,u),[width+1.5,1,depth+1.5],d.roof,rooftopYaw(s));
   if([3,6,8].includes(d.index))box(d.index,rooftopWorld(s,height+6,u),[2,12,2],'#7e7271');
   if([4,9].includes(d.index))for(const dx of [-width*.35,width*.35])box(d.index,rooftopWorld(s,height+3,u+dx),[.4,6,depth],'#a7d5cd',rooftopYaw(s));
   if([5,7,10].includes(d.index))box(d.index,rooftopWorld(s,height+7,u),[.25,14,.25],d.accent);
   for(const h of [5,12])if(height>h+4)box(d.index,rooftopWorld(s,height-h,u-side*(width/2+.04)),[.1,2.4,depth*.65],'#425866',rooftopYaw(s));
  }
  // A skyline landmark frames the next district, without covering its road.
  const s=d.b-55,r=rooftopRoofAt(s),u=(d.index%2?1:-1)*48;
  if(d.index===11){for(const side of [-1,1])box(d.index,rooftopWorld(s,r.top+14,side*38),[10,28,14],'#d9d0b8',rooftopYaw(s));}
  else box(d.index,rooftopWorld(s,r.top+8,u),[5+d.index%3*3,16,7],d.accent,rooftopYaw(s));
 }
 for(const [district,v] of visual.entries())components.push({t:'mesh',p:v.p,vertices:v.vertices,indices:v.indices,colors:v.colors,tex:'solid',color:'#ffffff',solid:false,edgeGrinding:false,grp:300+district,nm:`${ROOFTOP_DISTRICTS[district].name} · batched architecture and wayfinding`});
 for(let s=0;s<ROOFTOP_LENGTH;s+=22)components.push({t:'camnode',p:rooftopWorld(s,rooftopPoint(s)[1]),grp:390});
 const last=ROOFTOP_ROOFS[ROOFTOP_ROOFS.length-1],finish=last.b-14;components.push({t:'camnode',p:rooftopWorld(ROOFTOP_LENGTH+20,last.top+last.rise),grp:390});
 components.push({t:'gate',p:rooftopPoint(finish),yaw:rooftopYaw(finish),grp:311,nm:'Civic Crown finish'});
 components.push({t:'clock',p:rooftopWorld(12,28,5),grp:300,nm:'City relay time trial'});
 const spawn=rooftopPoint(6);spawn[1]+=.12;
 return {v:1,name:'Rooftop Relay',spawn,startWarpPad:false,killY:-8,sky:'sunset',keepPlayFog:true,cameraAirLift:1,cameraLookAhead:13,
  cameraRig:{camDist:10,camHeight:8.6,camPitch:35,camFov:64},
  atmosphere:{backdrop:'sky',fogEnabled:true,fogNear:145,fogFar:420,fogColor:'#afa7b5',ambientSky:'#d5e2f1',ambientGround:'#8d7669',ambientIntensity:1.6,sunColor:'#ffdbad',sunIntensity:2.5,fillColor:'#a7c7de',fillIntensity:.5,drawDistance:520,shadowStrength:.7},
  medalTimes:{gold:420,silver:650,bronze:1000},components,groups};
})();
