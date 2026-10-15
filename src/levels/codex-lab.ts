import {warehouseRibbon,warehouseIsland,warehouseBeam,type WarehousePoint} from './warehouse-geometry';
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

// A separate lab entry preserves the shipped Haunted Hassle course. All riding
// geometry is source-owned, editable, monochrome, and uses the shared primitives.
export const WAREHOUSE_START:WarehousePoint=[-42,8.15,23];
export const WAREHOUSE_EXIT:WarehousePoint=[-53,8,23];
export const WAREHOUSE_TOKEN_ROUTES = [
 {name:'01 / Loading dock',start:[-45,.15,-117],heading:[0,0,-1],token:[-45,6.5,-171]},
 {name:'02 / Halfpipe gallery',start:[-63,.15,-151],heading:[0,0,1],token:[-64,9.5,-91]},
 {name:'03 / Service loft',start:[60,.15,-39],heading:[0,0,-1],token:[26,19.1,-165]},
 {name:'04 / Crane gantry',start:[30,18.15,-165],heading:[-1,0,0],token:[13,29.1,-124]},
 {name:'05 / Roof maintenance',start:[-22,28.15,-124],heading:[-1,0,0],token:[-48,33.1,-93]},
] as const;
export const WAREHOUSE_DROP_IN:WarehousePoint[]=[[-42,8,9],[-42,7.8,0],[-38,5.2,-15],[-28,1.5,-31],[-18,0,-39],[-12,0,-42]];
export const WAREHOUSE_SERVICE_CLIMB:WarehousePoint[]=[[60,0,-43],[64,2,-65],[64,6,-89],[62,10,-114],[55,14,-138],[48,17,-148],[44,18,-153],[40,18,-157],[40,18,-160]];
export const WAREHOUSE_GANTRY_RAIL:WarehousePoint[]=[[22,18.65,-165],[12,19.5,-165],[-2,22,-157],[-7,25,-143],[-2,27.6,-130],[5,28.65,-126.4],[16,28.65,-125.8]];
export const WAREHOUSE_ROOF_PATH:WarehousePoint[]=[[-27,28,-124],[-37,29,-121],[-46,31,-112],[-48,32,-102],[-48,32,-99]];

export const WAREHOUSE_PARK_LEVEL:CustomLevelData=(()=>{
 const components:CustomComponent[]=[];
 const groups:CustomGroup[]=[{id:200,nm:'Warehouse shell / 48 m clear height',editorOnly:true},
  {id:201,nm:'Arrival balcony / curved drop-in',editorOnly:true},{id:202,nm:'Street session / open circulation',editorOnly:true},
  {id:203,nm:'Standalone halfpipe / gallery',editorOnly:true},{id:204,nm:'Loading dock session',editorOnly:true},
  {id:205,nm:'Upper service climb / 18 m loft',editorOnly:true},{id:206,nm:'Crane gantry / 28 m',editorOnly:true},
  {id:207,nm:'Roof maintenance / 32 m',editorOnly:true}];
 let group=200;
 const add=(c:CustomComponent)=>{c.grp=group;components.push(c);return c;};
 const slab=(nm:string,x:number,z:number,top:number,w:number,d:number,h=.8,color='#9a9fa3')=>
  add({t:'platform',nm,p:[x,top-h/2,z],s:[w,h,d],tex:'solid',color});
 const ramp=(nm:string,x:number,z:number,base:number,rise:number,len:number,w:number,yaw=0)=>
  add({t:'ramp',nm,p:[x,base,z],rise,len,w,yaw,tex:'solid',color:'#b4b8bb'});
 const column=(nm:string,x:number,z:number,top:number,w=1.2)=>
  add({t:'wall',nm,p:[x,0,z],s:[w,top,w],tex:'solid',color:'#646b71'});
 const beam=(nm:string,a:WarehousePoint,b:WarehousePoint,w=.5,d=.5,color='#596168')=>add(warehouseBeam(nm,a,b,w,d,color));
 const rail=(nm:string,points:WarehousePoint[],radius=6)=>{
  const p=points[0];return add({t:'rail',nm,p:[...p],pts:points.map((q,i)=>[q[0]-p[0],q[2]-p[2],i===0||i===points.length-1?0:radius,q[1]-p[1]]),color:'#e0e2e4'});
 };
 const ribbon=(nm:string,points:WarehousePoint[],width:number,thickness=.8)=>add(warehouseRibbon(nm,points,width,thickness));
 const hangRibbon=(nm:string,c:CustomComponent)=>{
  const v=c.vertices!;
  for(let i=12*8;i<v.length-12;i+=12*12){
   const dx=v[i+3]-v[i],dz=v[i+5]-v[i+2],length=Math.hypot(dx,dz),nx=dx/length,nz=dz/length,y=v[i+1]-.65;
   const a:WarehousePoint=[v[i]-nx,y,v[i+2]-nz],b:WarehousePoint=[v[i+3]+nx,y,v[i+5]+nz];
   beam(nm+' crosshead',a,b,.4,.45);
   for(const q of[a,b])beam(nm+' suspension',[q[0],48,q[2]],q,.2,.2);
  }
 };
 const roundRect=(w:number,d:number,r:number):[number,number][]=>{
  const pts:[number,number][]=[];
  for(const[x,z,a]of [[-w/2+r,d/2-r,.5],[-w/2+r,-d/2+r,1],[w/2-r,-d/2+r,1.5],[w/2-r,d/2-r,0]])
   for(let i=0;i<=12;i++){const angle=(a+i/24)*Math.PI;pts.push([x+Math.cos(angle)*r,z+Math.sin(angle)*r]);}
  return pts;
 };
 const trestle=(nm:string,x:number,z:number,top:number,width:number)=>{
  for(const side of[-1,1])column(nm+' column',x+side*width/2,z,top-.8,1.1);
  beam(nm+' crosshead',[x-width/2,top-1.1,z],[x+width/2,top-1.1,z],.7,.8);
  for(const side of[-1,1])beam(nm+' knee brace',[x+side*width/2,top-4,z],[x+side*(width/2-2.5),top-1.1,z],.35,.35);
 };
 const arrow=(x:number,y:number,z:number,yaw=0)=>add({t:'mesh',nm:'Route direction',p:[x,y+.025,z],yaw,
  vertices:[-1,0,1,1,0,1,0,0,-1.5],indices:[0,1,2],solid:false,doubleSided:true,tex:'solid',color:'#eeeeee',edgeGrinding:false});

 const floor=slab('Continuous concrete floor',0,-86,0,176,252,2,'#757c82');floor.depthBias=2;floor.edgeGrinding=false;
 add({t:'vertramp',nm:'Sweeping perimeter bowl / continuous coping',p:[0,0,-86],pts:roundRect(136,204,12),
  closed:true,vkind:'quarter',w:.5,rise:4.2,arc:90,lipRise:.2,deck:6,tex:'solid',color:'#a3aaaf'});
 add({t:'wallpath',nm:'Enclosed warehouse walls / 48 m',p:[0,-2,-86],pts:roundRect(172,248,8),closed:true,
  w:1,rise:50,collisionHeight:52,containment:true,tex:'solid',color:'#565f68'});
 const roof=slab('Warehouse roof / real ceiling',0,-86,48.6,176,252,.6,'#3e474f');roof.edgeGrinding=false;
 for(let z=28;z>=-200;z-=24){
  for(const x of[-83,83])column('Warehouse portal column',x,z,47,1.5);
  beam('Roof truss lower chord',[-83,43,z],[83,43,z],.65,.65);
  beam('Roof truss upper chord',[-83,47,z],[83,47,z],.65,.65);
  for(let x=-82;x<82;x+=16.4){
   beam('Roof truss diagonal',[x,43,z],[x+16.4,47,z],.28,.28);
   beam('Roof truss diagonal',[x,47,z],[x+16.4,43,z],.28,.28);
  }
  for(const x of[-47,0,47]){const lamp=beam('Ceiling strip light',[x-9,46.8,z],[x+9,46.8,z],.15,1.1,'#dddddd');lamp.emissive='#aaaaaa';}
 }
 for(const x of[-83,-55,-27,0,27,55,83])beam('Roof longitudinal purlin',[x,47.6,36],[x,47.6,-208],.8,.8);
 for(let x=-72;x<=72;x+=12)beam('Floor expansion joint',[x,.012,30],[x,.012,-202],.025,.008,'#666d73');
 for(let z=28;z>=-200;z-=12)beam('Floor expansion joint',[-80,.012,z],[80,.012,z],.025,.008,'#666d73');

 group=201;
 slab('Arrival balcony / elevated start',-42,21,8,40,26);
 ribbon('Curving arrival drop-in',WAREHOUSE_DROP_IN,14,1);
 for(const z of[11,30])trestle('Arrival deck',-42,z,8,36);
 trestle('Drop-in support',-40,-8,6.8,12);
 rail('Arrival balcony outer guard',[[-61,8.8,8],[-61,8.8,32],[-23,8.8,32],[-23,8.8,11]],3);
 rail('Arrival drop-in left edge',[[-48.2,8.25,9],[-48.2,7.9,0],[-44.2,5.3,-15],[-34.2,1.6,-31],[-24.2,.25,-39]],8);
 arrow(-42,8,12);
 add({t:'checkpoint',nm:'Arrival retry',p:[-31,8,21]});
 add({t:'gate',nm:'Return with all five tokens',p:[...WAREHOUSE_EXIT]});

 group=202;
 add(warehouseIsland('Kidney hip / four-way transfer',0,-91,22,18,2.5,8,.5));
 add(warehouseIsland('Crescent manual island',0,-28,17,11,.65,4,1.8));
 add(warehouseIsland('Wide north pump island',10,-143,16,12,1.5,7,.9));
 rail('Street S-curve',[ [27,.72,-22],[35,.85,-36],[35,1,-51],[22,.85,-66],[21,.72,-79],[29,.72,-90] ],9);
 rail('Kidney crown curve',[[-10,2.73,-88],[-7,2.73,-84],[3,2.73,-82],[10,2.73,-87],[10,2.73,-95],[4,2.73,-99]],5);
 rail('Crescent manual ledge',[[-7,.85,-24],[-2,.85,-22],[5,.85,-23],[8,.85,-28],[5,.85,-32],[-3,.85,-33]],4);
 ribbon('Low serpentine pump bank',[[-12,0,-56],[-6,1.1,-62],[4,1.4,-65],[12,.9,-69],[16,0,-75]],9,.6);
 rail('North sweeping transfer',[[0,1.7,-140],[6,1.7,-137],[13,1.7,-140],[18,1.7,-147],[22,.85,-154]],5);
 add({t:'checkpoint',nm:'Floor session retry',p:[13,0,-58]});

 group=203;
 add({t:'vertramp',nm:'Standalone halfpipe / 42 m session',p:[-46,0,-91],len:42,w:5,rise:4.5,
  vkind:'half',arc:90,arcSteps:24,lipRise:.3,deck:3.5,outerBank:3.5,tex:'solid',color:'#b4b8bc'});
 slab('Halfpipe observation gallery',-64,-91,8.4,8,16);
 for(const z of[-98,-84])trestle('Gallery support',-64,z,8.4,6);
 rail('Halfpipe U-return',[[-59,4.95,-72],[-59,4.95,-108],[-54,4.95,-118],[-38,4.95,-118],[-33,4.95,-108],[-33,4.95,-72]],7);
 for(const x of[-59,-33])for(const z of[-78,-106])column('Halfpipe rail stand',x,z,4.7,.35);
 beam('Halfpipe return rail crossbeam',[-59,4.45,-118],[-33,4.45,-118],.5,.5);
 for(const x of[-59,-33])column('Halfpipe return rail post',x,-118,4.7,.7);
 // A precise alternate discovery route: the perimeter coping hands off to this gallery rail.
 ribbon('Gallery discovery bank',[[-63,0,-136],[-68,1.8,-128],[-71,3.8,-119],[-70.5,4.4,-114],[-70.5,4.4,-110]],6);
 column('Gallery bank support',-70.5,-116,3.6,.8);
 rail('Gallery climbing curve',[[-70.5,4.65,-114],[-70.5,5.4,-104],[-69,7,-96],[-66,8.65,-91],[-62,8.65,-91]],5);

 group=204;
 ramp('Loading dock approach',-45,-133,0,5.4,24,16);
 slab('Loading dock takeoff',-45,-152,5.4,16,14,5.4);
 slab('Loading dock target / 6 m gap',-45,-171,5.4,16,12,5.4);
 rail('Dock transfer curve',[[-52,5.65,-147],[-52,5.65,-159],[-53,5.65,-169],[-55,5.65,-176],[-60,4.6,-181]],5);
 ribbon('Dock curved return / raised drop-out',[[-37,5.4,-171],[-27,5,-169],[-20,4,-161],[-17,2.4,-150]],7);
 trestle('Dock return support',-25,-166,4.6,5);
 arrow(-45,0,-118);arrow(-45,5.4,-156);

 group=205;
 ribbon('Curving service ramp / ground to 18 m',WAREHOUSE_SERVICE_CLIMB,10,1);
 for(const[x,y,z]of [[64,6,-89],[62,10,-114],[55,14,-138],[44,17,-151]] as WarehousePoint[])trestle('Service ramp',x,z,y,8);
 // A short jump leaves the main ramp for the loft; its return heads into the ramp again.
 slab('Service loft / separate upper landing',24,-165,18,14,10,1);
 for(const z of[-168,-162])trestle('Service loft',24,z,18,12);
 rail('Service ramp rising outer rail',WAREHOUSE_SERVICE_CLIMB.map(([x,y,z])=>[x+4.4,y+.75,z] as WarehousePoint),10);
 rail('Service loft curved guard',[[30,18.8,-169],[24,18.8,-169],[18,18.8,-168],[18,18.8,-161]],3);
 slab('Service upper landing / loft launch',40,-166,18,10,12,1);
 for(const z of[-164,-170])trestle('Service upper landing',40,z,18,12);
 add({t:'checkpoint',nm:'Upper service retry',p:[29,18,-162]});
 add({t:'mover',nm:'Freight lift / service loft to crane gantry',p:[26,23,-154],s:[8,.8,8],axis:'y',amp:5,speed:.6,phase:-Math.PI/2,tex:'solid',color:'#bdc2c6'});
 for(const x of[21,31])column('Freight lift guide',x,-154,34,.8);
 beam('Freight lift headframe',[21,34,-154],[31,34,-154],.7,.7);
 arrow(26,18,-162,180);

 group=206;
 slab('Crane gantry / suspended transverse deck',-3,-124,28,54,8,1.2);
 hangRibbon('Lift landing',ribbon('Lift landing to gantry',[[26,28,-150],[26,28,-140],[24,28,-132],[20,28,-124]],6));
 for(const x of[-29,23]){
  column('Crane gantry column',x,-124,27,1.6);
  beam('Gantry knee brace',[x,23,-124],[x+(x<0?5:-5),27,-124],.7,.7);
 }
 beam('Gantry lower steel chord',[-30,26.8,-124],[24,26.8,-124],.8,.9);
 beam('Gantry truss lower chord',[-30,24.6,-124],[24,24.6,-124],.6,.7);
 for(let x=-29;x<23;x+=6.5){
  beam('Gantry truss diagonal',[x,24.6,-124],[x+6.5,26.8,-124],.3,.3);
  beam('Gantry truss diagonal',[x,26.8,-124],[x+6.5,24.6,-124],.3,.3);
 }
 rail('Ascending crane-service rail',WAREHOUSE_GANTRY_RAIL,9);
 beam('Crane rail suspension',[-10,48,-143],[-10,24.5,-143],.22,.22);
 beam('Crane rail support arm',[-10,24.5,-143],[-7,24.5,-143],.4,.4);
 beam('Crane rail suspension',[12,48,-168],[12,19,-168],.22,.22);
 beam('Crane rail support arm',[12,19,-168],[12,19,-165],.4,.4);
 rail('Gantry sweeping rail',[[-25,28.25,-124],[-17,28.25,-123],[-6,28.25,-125],[7,28.25,-124],[21,28.25,-124]],4);
 add({t:'checkpoint',nm:'Gantry retry',p:[-21,28,-124]});
 // Catch terraces under the high line make failed transfers recoverable sessions.
 slab('Intermediate catch terrace',-10,-146,12,20,16,1);
 for(const z of[-152,-140])trestle('Catch terrace',-10,z,12,18);
 ribbon('Catch terrace return',[[-10,12,-138],[-10,9,-124],[-17,5,-111],[-17,2.4,-103]],8);

 group=207;
 hangRibbon('Roof catwalk',ribbon('Curved roof maintenance catwalk',WAREHOUSE_ROOF_PATH,4.8,.8));
 slab('Roof maintenance shelf / final 4 m jump',-48,-91,32,10,8,1);
 for(const z of[-94,-88]){
  for(const x of[-54,-42])beam('Roof shelf suspension',[x,48,z],[x,30.6,z],.25,.25);
  beam('Roof shelf crosshead',[-54,30.6,z],[-42,30.6,z],.6,.7);
 }
 rail('Roof maintenance winding edge',[[-28,28.75,-122],[-37,29.75,-119],[-44,31.75,-111],[-45.7,32.75,-102]],6);
 rail('Roof shelf curved guard',[[-52,32.8,-94],[-52,32.8,-88],[-48,32.8,-87],[-44,32.8,-89]],2);
 // A returning high bank rejoins the service spine; no isolated reward dead ends.
 hangRibbon('Upper return',ribbon('Upper return to gantry',[[-44,32,-92],[-29,31.5,-90],[-15,30,-99],[-9,28,-112],[-9,28,-122]],6));

 for(const [i,route]of WAREHOUSE_TOKEN_ROUTES.entries()){
  group=[204,203,205,206,207][i];add({t:'wumpa',nm:route.name,p:[...route.token]});
 }
 group=200;
 add({t:'zone',nm:'Whole warehouse / rider-relative free skating',p:[0,22,-86],s:[176,56,252],dir:'S'});
 return {v:1,name:'Warehouse / Five Lines',spawn:[...WAREHOUSE_START],startWarpPad:false,killY:-14,
  skatepark:true,alwaysSkate:false,skateCollectathon:true,sky:'day',keepPlayFog:true,
  cameraRig:{camDist:8.6,camHeight:5.5,camPitch:20,camFov:62},
  atmosphere:{backdrop:'fog',fogEnabled:true,fogNear:180,fogFar:360,fogColor:'#59636c',ambientSky:'#ededed',ambientGround:'#858585',
   ambientIntensity:1.35,sunColor:'#ffffff',sunIntensity:1.5,fillColor:'#ffffff',fillIntensity:.5,drawDistance:450,shadowStrength:.6},
  components,groups};
})();
