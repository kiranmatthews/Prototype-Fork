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
 railLine(112,198,s=>mix(1,-1.6,(s-112)/86),-4.4,g,'Outside arc over the first gap');
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
 railLine(1320,1444,s=>mix(9.3,14.1,(s-1320)/124),s=>5.8*Math.sin(Math.PI*(s-1320)/124),g,'Machinery high line · rising S grind');
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
export const CODEX_LAB_LEVEL:CustomLevelData={
 v:1,name:'Blockworks · Greybox',spawn:routePoint(2,.15),killY:-20,sky:'day',keepPlayFog:true,cameraAirLift:.8,
 atmosphere:{fogEnabled:true,fogNear:105,fogFar:230,fogColor:'#c1c9d1',backdrop:'fog',ambientSky:'#e8f1ff',ambientGround:'#626d7d',ambientIntensity:1.1,sunColor:'#ffffff',sunIntensity:1.25,fillColor:'#c8d9f0',fillIntensity:.35,drawDistance:360,shadowStrength:.65},
 medalTimes:{gold:240,silver:300,bronze:390},components:C,groups,
};

// Warehouse · 1999 reference study. u runs away from the start on the supplied
// overhead plan; v runs to the rider's right. One uniform skater-relative scale.
export const WAREHOUSE_SCALE=.14;
export const warehousePoint=(u:number,v:number,y=0):Point=>[(v-208)*WAREHOUSE_SCALE,y,(253-u)*WAREHOUSE_SCALE];
export const WAREHOUSE_LANDMARKS={
 spawn:warehousePoint(79,268,6.42),
 halfpipe:{u:388,v0:208,v1:405,radius:2.8,flatHalf:3.5,height:2.8},
 bigRail:[[330,148,.78],[442,148,.78],[469,170,.78]],
 kickerGap:{left:441,right:472,centreV:69,width:3.36,height:1.05},
 taxi:warehousePoint(520,279),secret:warehousePoint(388,372,6.35),
} as const;
export const WAREHOUSE_REFERENCE_LEVEL:CustomLevelData=(()=>{
 const components:CustomComponent[]=[],groups:CustomGroup[]=[
  {id:500,nm:'Warehouse · floor and roll-in',editorOnly:true},
  {id:501,nm:'Halfpipe · banks · secret room',editorOnly:true},
  {id:502,nm:'Wall transitions · channel gaps',editorOnly:true},
  {id:503,nm:'Big Rail · kicker gap · taxi',editorOnly:true},
  {id:504,nm:'Industrial shell and surface details',editorOnly:true},
  {id:505,nm:'Five source box stacks and recovery',editorOnly:true},
  {id:506,nm:'Warehouse roof · hide for plan inspection',editorOnly:true},
 ];
 const wood='#aa8458',concrete='#858983',steel='#858e87',dark='#363c3b';
 const add=(c:CustomComponent)=>components.push(c);
 const box=(nm:string,u:number,v:number,y:number,w:number,h:number,d:number,color=concrete,tex='pavement',grp=500,solid=true)=>{
  add({t:solid?'platform':'mesh',nm,p:warehousePoint(u,v,y),s:[w,h,d],color,tex,edgeGrinding:false,grp,
   ...(!solid?{solid:false,vertices:cubeVertices,indices:cubeIndices}: {})});
 };
 const mesh=(nm:string,points:Point[],indices:number[],color:string,grp=500,solid=true,tex='pavement',vert=false)=>{
  const p=points[0];add({t:'mesh',nm,p,vertices:points.flatMap(q=>q.map((n,i)=>n-p[i])),indices,color,tex,solid,...(solid?{vert}:grp===506?{castShadow:true}:{}),edgeGrinding:false,grp});
 };
 const quad=(nm:string,a:Point,b:Point,c:Point,d:Point,color:string)=>mesh(nm,[a,b,c,d],[0,2,1,0,3,2],color,504,false,'solid');
 const rect=(nm:string,u0:number,v0:number,u1:number,v1:number,y:number,color=concrete,grp=500)=>
  box(nm,(u0+u1)/2,(v0+v1)/2,y-1,(v1-v0)*WAREHOUSE_SCALE,2,(u1-u0)*WAREHOUSE_SCALE,color,'pavement',grp);
 const line=(nm:string,points:number[][],grp=503)=>{
  const p=warehousePoint(points[0][0],points[0][1],points[0][2]);
  add({t:'rail',nm,p,pts:points.map(q=>{const w=warehousePoint(q[0],q[1],q[2]);return[w[0]-p[0],w[2]-p[2],0,w[1]-p[1]];}),color:steel,grp});
 };
 const profile=(nm:string,u:number,v0:number,v1:number,knots:number[][],color=concrete,grp=500)=>{
  const vertices:Point[]=[],indices:number[]=[];
  for(const [du,y]of knots)vertices.push(warehousePoint(u+du,v0,y),warehousePoint(u+du,v1,y));
  for(let i=0;i<knots.length-1;i++){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
  mesh(nm,vertices,indices,color,grp,true);
 };
 const transition=(nm:string,uv:number[][],radius:number,base=0,deck=.42,grp=502)=>{
  const p=warehousePoint(uv[0][0],uv[0][1],base);
  add({t:'vertramp',nm,p,pts:uv.map(q=>{const w=warehousePoint(q[0],q[1]);return[w[0]-p[0],w[2]-p[2],(q[2]??0)*WAREHOUSE_SCALE];}),
   vkind:'quarter',w:0,rise:radius,arc:90,arcSteps:32,deck,tex:'wood',color:wood,edgeGrinding:false,grp});
 };
 // Staggered outline, raised balcony and two independent roll-ins.
 rect('Main warehouse slab',253,58,634,407,0);components[components.length-1].depthBias=2;
 rect('North kicker bay',330,8,584,58,0);
 profile('Raised loading bay deck',138,58,157,[[0,1.68],[124,1.68]]);
 rect('Loading bay foundation',138,58,262,157,0);
 rect('Start balcony',9,157,137,306,6.3,wood);
 transition('Start balcony back quarterpipe',[[28,306],[28,157]],2.52,6.3,.14);
 rect('Left roll-in foundation',137,157,274,208,0);
 rect('Right roll-in foundation',137,256,274,306,0);
 const roll=Array.from({length:49},(_,i)=>{const t=i/48;return[137*t,6.3*(1-t*t*(3-2*t))];});
 profile('Left smooth roll-in',137,157,208,roll);
 profile('Right smooth roll-in',137,256,306,roll);
 box('Centre roll-in divider',203,232,4.5,6.72,9,13.16,'#42483f','metal');
 transition('Divider foot quarterpipe',[[273,256],[273,208]],1.68,0,.2);
 transition('Loading bay back transition',[[153,157],[153,58]],1.68,1.68,.28);
 transition('Loading bay front lip',[[274,157],[274,58]],1.68,0,.42);
 // Actual channel gaps interrupt the near-wall coping.
 // The raised loading bay supplies the coping between the two roll-ins.
 transition('Near wall · below channels',[[274,407],[274,306]],2.52,0,.3);
 transition('Far wall · continuous hips and rear coping',[
  [561,8],[561,91,18],[523,137,20],[523,158,18],
  [552,181,18],[609,181,20],[609,365,20],[590,382,20],[530,382,18],[510,359,18],[445,359],
 ],2.66,0,.56);
 transition('Kicker wall quarterpipe',[[350,31],[420,31]],2.66,0,.56);
 rect('Kicker wall box shelf',330,8,365,31,2.66,wood,502);
 profile('Box shelf return bank',350,31,54,[[0,2.66],[18,0]],wood,502);
 const hp=WAREHOUSE_LANDMARKS.halfpipe;
 add({t:'vertramp',nm:'Main halfpipe · bank-to-bank profile',p:warehousePoint(hp.u,(hp.v0+hp.v1)/2),
  len:(hp.v1-hp.v0)*WAREHOUSE_SCALE,yaw:90,vkind:'half',w:hp.flatHalf,rise:hp.radius,
  arc:90,arcSteps:40,deck:.14,tex:'wood',color:wood,edgeGrinding:false,grp:501});
 // Exterior kickers are ordinary banks. Sharing the vert flag with the U
 // would turn their forward transfers into a wall air back toward the start.
 for(const side of [-1,1]){
  const verts:Point[]=[],indices:number[]=[],zc=warehousePoint(hp.u,0)[2];
  for(let i=0;i<=24;i++){
   const t=i/24,e=.14,f=t<e?t*t/(2*e):t-e/2,y=hp.radius*f/(1-e/2),lat=8.24-1.8*t;
   verts.push([0,y,zc+side*lat],[(hp.v1-hp.v0)*WAREHOUSE_SCALE,y,zc+side*lat]);
   if(i){const a=(i-1)*2;indices.push(...(side>0?[a,a+1,a+3,a,a+3,a+2]:[a,a+3,a+1,a,a+2,a+3]));}
  }
  mesh(side>0?'Halfpipe roll-in transfer bank':'Halfpipe taxi-side transfer bank',verts,indices,wood,501,true,'wood',false);
 }
 // Only the ends of the outside banks taper; the U's floor remains open.
 for(const side of [-1,1]){
  const zc=warehousePoint(hp.u,0)[2],lip=zc+side*6.3,outer=zc+side*8.24,inner=zc+side*3.5;
  mesh('Halfpipe bank end apron',[[0,0,outer],[0,2.8,lip],[0,0,inner],[-2.8,0,lip]],
   side<0?[0,1,3,1,2,3]:[0,3,1,1,3,2],wood,501,true,'wood');
 }
 // The suspended secret room is open along the bank-to-bank flight corridor.
 box('Secret room floor',388,378,6.21,7.56,.28,3.92,'#544f40','metal',501);
 box('Secret room roof',388,378,10.9,7.56,.28,4.48,'#343b38','metal',501);
 for(const v of [351,405])box('Secret room side panel',388,v,8.55,.18,4.4,3.92,dark,'metal',501);
 for(const u of [374,402])for(const v of [351,405])box('Secret room steel frame',u,v,8.55,.18,4.4,.18,'#303936','metal',501);
 for(const v of [351,405])for(const u of [381,388,395])box('Secret room window upright',u,v,8.7,.16,4.1,.08,steel,'metal',504);
 line('Big Rail · straight to kink',WAREHOUSE_LANDMARKS.bigRail.map(q=>[...q]));
 // Opposed kickers, 4.34 m clear gap, with solid back faces.
 profile('Kicker gap · launch',417,57,81,[[0,0],[24,1.05],[24.15,0]],wood,503);
 profile('Kicker gap · receiver',472,57,81,[[0,0],[.15,1.05],[26,0]],wood,503);
 profile('Taxi transfer · hood roof boot',502,269,288,[[0,0],[7,.65],[11,1.18],[24,1.18],[28,.65],[36,0]],'#b29b3f',503);
 box('Taxi yellow body',520,278.5,.38,2.65,.7,4.45,'#a89132','metal',504,false);
 for(const v of [268.5,288.5])for(const u of [509,530]){
  const centre=warehousePoint(u,v,.33),points:Point[]=[],indices:number[]=[];
  for(const x of [-.15,.15])for(let j=0;j<12;j++){const a=j*Math.PI/6;points.push([centre[0]+x,centre[1]+Math.sin(a)*.33,centre[2]+Math.cos(a)*.33]);}
  for(let j=0;j<12;j++){const n=(j+1)%12;indices.push(j,n,12+n,j,12+n,12+j);if(j>0&&j<11)indices.push(0,j,j+1,12,12+j+1,12+j);}
  mesh('Taxi rubber wheel',points,indices,'#252925',504,false,'solid');
  box('Taxi wheel hub',u,v,.33,.33,.28,.28,'#8c9185','metal',504,false);
 }
 for(const v of [269,288]){
  const points=[warehousePoint(509,v,.66),warehousePoint(513,v,1.16),warehousePoint(525,v,1.16),warehousePoint(530,v,.66)];
  mesh('Taxi side glazing',points,[0,1,2,0,2,3],'#263c3a',504,false,'solid');components[components.length-1].doubleSided=true;
  box('Taxi window pillar',520,v,.87,.045,.5,.13,'#bca346','solid',504,false);
 }
 for(const [u0,u1]of [[509,513],[526,530]]){
  const front=u0===509;
  mesh('Taxi windscreen',[warehousePoint(u0,270,front ? .67 : 1.19),warehousePoint(u0,287,front ? .67 : 1.19),warehousePoint(u1,287,front ? 1.19 : .67),warehousePoint(u1,270,front ? 1.19 : .67)],
   [0,1,2,0,2,3],'#314948',504,false,'solid');components[components.length-1].doubleSided=true;
 }
 box('Taxi roof sign',520,278.5,1.32,1.1,.25,.28,'#d8c477','solid',504,false);
 for(const u of [504,536])box('Taxi bumper',u,278.5,.42,2.7,.19,.14,'#8c9289','metal',504,false);
 rect('Rear coping box deck',445,378,510,407,2.66,wood,502);
 line('High Rail · wall above the far quarterpipe',[[629,238,5.25],[629,337,5.25],[623,362,5.25]],502);
 for(const [i,u,v,y]of [[1,114,287,6.3],[2,469,389,2.66],[3,566,159,2.66],[4,345,22,2.66],[5,219,80,1.68]]){
  for(const [du,dv,dy]of [[0,0,0],[7,0,0],[0,7,0],[7,7,0],[3.5,3.5,.96]])
   add({t:'crate',kind:'wood',p:warehousePoint(u+du,v+dv,y+dy),grp:505,nm:`Source Box ${i}`});
 }
 const perimeter=[[9,157],[138,157],[138,58],[330,58],[330,8],[584,8],[584,157],[634,157],[634,407],[253,407],[253,306],[9,306]];
 const wallP=warehousePoint(9,157,-3);
 add({t:'wallpath',nm:'Warehouse shell · surveyed outline',p:wallP,
  pts:perimeter.map(([u,v])=>{const p=warehousePoint(u,v);return[p[0]-wallP[0],p[2]-wallP[2]];}),closed:true,
  w:.6,rise:18,solid:false,color:'#72766b',tex:'solid',edgeGrinding:false,grp:504});
 // Tall plaster bays and rusted columns replace oversized masonry blocks.
 for(let i=0;i<perimeter.length;i++){
  const a=perimeter[i],b=perimeter[(i+1)%perimeter.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(length*WAREHOUSE_SCALE/6));
  const du=-(b[1]-a[1])/length*.34/WAREHOUSE_SCALE,dv=(b[0]-a[0])/length*.34/WAREHOUSE_SCALE;
  for(let j=0;j<n;j++){
   const t0=(j+.045)/n,t1=(j+.955)/n;
   const u0=a[0]+(b[0]-a[0])*t0+du,v0=a[1]+(b[1]-a[1])*t0+dv,u1=a[0]+(b[0]-a[0])*t1+du,v1=a[1]+(b[1]-a[1])*t1+dv;
   mesh('Weathered warehouse wall bay',[warehousePoint(u0,v0,3),warehousePoint(u1,v1,3),warehousePoint(u1,v1,14.7),warehousePoint(u0,v0,14.7)],
    [0,1,2,0,2,3],['#626b63','#7c8070','#697267'][j%3],504,false,'solid');components[components.length-1].doubleSided=true;
   const u=a[0]+(b[0]-a[0])*j/n+du,v=a[1]+(b[1]-a[1])*j/n+dv;
   box('Rusted I-beam',u,v,7.5,.24,15,.24,'#71583b','metal',504,false);
  }
 }
 // The board's vert plane stays at the visible coping. Its forgiving body
 // collider needs clearance behind that plane during launch and re-entry.
 // Solid vertical faces also answer the native 'is there a wall behind
 // this lip?' probe, preventing Up from transferring through masonry.
 for(let i=0;i<perimeter.length;i++){
  const a=perimeter[i],b=perimeter[(i+1)%perimeter.length],k=.42/WAREHOUSE_SCALE/Math.hypot(b[0]-a[0],b[1]-a[1]);
  const du=-(b[1]-a[1])*k,dv=(b[0]-a[0])*k;
  mesh('Masonry contact face', [warehousePoint(a[0]+du,a[1]+dv,-3),warehousePoint(b[0]+du,b[1]+dv,-3),warehousePoint(b[0]+du,b[1]+dv,45),warehousePoint(a[0]+du,a[1]+dv,45)],
   [0,1,2,0,2,3],concrete,504,true,'solid');
  Object.assign(components[components.length-1],{invisible:true,doubleSided:true});
 }
 const outer=perimeter.map((q,i)=>{
  const a=perimeter[(i+perimeter.length-1)%perimeter.length],b=perimeter[(i+1)%perimeter.length];
  const n=(dx:number,dz:number)=>{const l=Math.hypot(dx,dz);return[dz/l,-dx/l];};
  const n0=n(q[0]-a[0],q[1]-a[1]),n1=n(b[0]-q[0],b[1]-q[1]);
  const k=1.2/WAREHOUSE_SCALE/(1+n0[0]*n1[0]+n0[1]*n1[1]);
  return[q[0]+(n0[0]+n1[0])*k,q[1]+(n0[1]+n1[1])*k];
 });
 add({t:'wallpath',nm:'Outside masonry · vert-body clearance',p:wallP,pts:outer.map(([u,v])=>{const p=warehousePoint(u,v);return[p[0]-wallP[0],p[2]-wallP[2]];}),
  closed:true,w:.3,rise:48,containment:true,invisible:true,edgeGrinding:false,grp:504});
 for(let v=181;v<402;v+=44){
  box('Far wall steel upright',631,v,7,.24,14,.35,'#4c4435','metal',504,false);
  box('Far wall clerestory',630,v+12,10.8,2.6,2.2,.06,'#b5c9b4','solid',504,false);
 }
 for(let u=284;u<630;u+=55){
  box('Side wall steel upright',u,405,7,.35,14,.24,'#4c4435','metal',504,false);
  box('Side wall clerestory',u+15,404.5,11,.06,2.2,2.5,'#bdcbb7','solid',504,false);
 }
 // A pitched roof and open trusses enclose the chase view, with clearance
 // for the existing skater's full bank transfers and pumped halfpipe airs.
 const roofY=(v:number)=>17+7*(1-Math.min(1,Math.abs(v-208)/200));
 for(let i=0;i<perimeter.length;i++){
  const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];
  mesh('Warehouse roof · upper gable',[warehousePoint(a[0],a[1],14.9),warehousePoint(b[0],b[1],14.9),warehousePoint(b[0],b[1],roofY(b[1])),warehousePoint(a[0],a[1],roofY(a[1]))],
   [0,1,2,0,2,3],'#555c50',506,false,'solid');components[components.length-1].doubleSided=true;
 }
 for(const [u0,v0,u1,v1]of [[253,58,634,407],[330,8,584,58],[138,58,253,157],[9,157,253,306]]){
  const mid=Math.max(v0,Math.min(v1,208)),cuts=[v0,mid,v1].filter((v,i,a)=>i===0||v!==a[i-1]);
  for(let j=0;j<cuts.length-1;j++){
   const a=cuts[j],b=cuts[j+1];
   mesh('Warehouse roof · corrugated pitch',[warehousePoint(u0,a,roofY(a)),warehousePoint(u1,a,roofY(a)),warehousePoint(u1,b,roofY(b)),warehousePoint(u0,b,roofY(b))],
    [0,1,2,0,2,3],'#454942',506,false,'metal');
   components[components.length-1].doubleSided=true;
  }
 }
 for(let u=280;u<625;u+=58){
  const vertices:Point[]=[],indices:number[]=[];
  for(const [a,b]of [[58,208],[208,407]]){
   const i=vertices.length;vertices.push(warehousePoint(u,a,roofY(a)-.12),warehousePoint(u,b,roofY(b)-.12),warehousePoint(u,b,roofY(b)-.72),warehousePoint(u,a,roofY(a)-.72));indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  mesh('Warehouse roof · steel truss',vertices,indices,'#655b45',506,false,'metal');components[components.length-1].doubleSided=true;
 }
 for(let u=280;u<625;u+=20){
  const v1=u>=329&&u<=447?207:403;
  quad('Concrete joint',warehousePoint(u,60,.008),warehousePoint(u+.15,60,.008),warehousePoint(u+.15,v1,.008),warehousePoint(u,v1,.008),'#747b74');
 }
 for(let v=65;v<402;v+=20)for(const [u0,u1]of (v>=208?[[275,329],[447,629]]:[[275,629]]))
  quad('Concrete joint',warehousePoint(u0,v,.009),warehousePoint(u1,v,.009),warehousePoint(u1,v+.15,.009),warehousePoint(u0,v+.15,.009),'#747b74');
 for(const [u,v]of [[398,149],[520,279],[481,369]])for(let i=0;i<13;i++){
  const du=Math.sin(i*2.4)*23,dv=Math.cos(i*1.9)*17;
  const p=warehousePoint(u+du,v+dv,.014+i*.0003),a=i*1.73,cs=Math.cos(a),sn=Math.sin(a),w=1.1+(i%3)*.4,d=2.1;
  const points=[[-w,-d],[w,-d],[w,d],[-w,d]].map(([x,z])=>[p[0]+x*cs+z*sn,p[1],p[2]-x*sn+z*cs] as Point);
  mesh('Flush scattered plywood',points,[0,2,1,0,3,2],['#7c7255','#a18b67','#686f59'][i%3],504,false,'wood');
 }
 add({t:'checkpoint',nm:'Warehouse floor recovery',p:warehousePoint(296,289,.02),grp:505});
 add({t:'zone',nm:'Warehouse arrival heading',p:warehousePoint(80,235,6.3),s:[25,1,19],dir:'S',grp:500});
 add({t:'pit',nm:'Outside shell recovery',p:warehousePoint(320,208,-7),s:[160,1,160],invisible:true,grp:505});
 return {v:1,name:'Warehouse · Reference',spawn:[...WAREHOUSE_LANDMARKS.spawn],startWarpPad:false,
  skatepark:true,killY:-12,sky:'day',keepPlayFog:true,
  atmosphere:{backdrop:'fog',fogEnabled:true,fogNear:85,fogFar:175,fogColor:'#454d48',
   ambientSky:'#d5dfd2',ambientGround:'#776b54',ambientIntensity:1.25,
   sunColor:'#ffedc4',sunIntensity:1.55,fillColor:'#a7bcc2',fillIntensity:.42,drawDistance:210,shadowStrength:.65},
  components,groups};
})();
