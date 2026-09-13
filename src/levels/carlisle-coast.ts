import type {CustomComponent,CustomLevelData} from '../level';
import {CITY_MODULES} from '../cityModules';

// Test Course's long route becomes a grounded city. Coordinates are snapped
// to Quaternius' 6 m road grid; its intersections occupy three grid cells.
const C:CustomComponent[]=[];
const groups:NonNullable<CustomLevelData['groups']>=[];
const add=(c:CustomComponent)=>{C.push(c);};
const G={streets:1,blocks:2,pits:3,skate:4,foot:5,wires:6,scenery:7,camera:8};
for(const [nm,id] of Object.entries(G))groups.push({id,nm});
const surface=(dkind:CustomComponent['dkind'],x:number,z:number,w?:number,d?:number,top=.15,yaw=0,grp=G.streets)=>{
 const spec=CITY_MODULES[dkind as keyof typeof CITY_MODULES];
 const size=spec?.size??(dkind==='citydeck'?[4.5,.4,4.5]:dkind==='citytaper'?[18,.15,18]:[3,.15,3]);
 const h=size[1];add({t:'platform',dkind,p:[x,top-h/2,z],s:[w??size[0],h,d??size[2]],yaw,edgeGrinding:false,grp});
};
const prop=(dkind:CustomComponent['dkind'],p:[number,number,number],s?:[number,number,number],yaw=0,solid=false,grp=G.scenery)=>add({t:'decor',dkind,p,s,yaw,solid,grp});
const crate=(x:number,z:number,kind:CustomComponent['kind']='wood',y=0,grp=G.skate,outline=false)=>add({t:'crate',p:[x,y,z],kind,grp,...(outline?{outline:true}:{})});
const pickup=(x:number,y:number,z:number)=>add({t:'wumpa',p:[x,y,z],grp:G.skate});
const rail=(points:[number,number,number][],invisible=false,cable=false)=>{const [x,y,z]=points[0];add({t:'rail',dkind:cable?'cityutilitypole':'citydeck',p:[x,y,z],pts:points.map(p=>[p[0]-x,p[2]-z,0,p[1]-y]),invisible,grp:G.wires});};
const checkpoint=(x:number,z:number)=>add({t:'checkpoint',p:[x,0,z],grp:G.streets});

interface Excavation {id:string;x:number;z:number;w:number;d:number;axis:'x'|'z';kind:'hop'|'beam'|'deck'|'foot';}
export const CARLISLE_EXCAVATIONS:Excavation[]=[
 {id:'water-main',x:0,z:-159,w:18,d:12,axis:'z',kind:'hop'},
 {id:'cable-trench',x:0,z:-285,w:18,d:12,axis:'z',kind:'deck'},
 {id:'tram-cut',x:0,z:-381,w:18,d:60,axis:'z',kind:'beam'},
 {id:'drain-repair',x:0,z:-483,w:18,d:12,axis:'z',kind:'hop'},
 {id:'station-box',x:0,z:-615,w:18,d:72,axis:'z',kind:'deck'},
 {id:'canal-works',x:0,z:-873,w:18,d:72,axis:'z',kind:'beam'},
 {id:'junction-repair',x:0,z:-1008,w:18,d:18,axis:'z',kind:'deck'},
 {id:'delivery-cut',x:0,z:-1449,w:18,d:12,axis:'z',kind:'hop'},
 {id:'market-cut',x:0,z:-1503,w:18,d:12,axis:'z',kind:'deck'},
 {id:'quay-drain',x:0,z:-1563,w:18,d:12,axis:'z',kind:'hop'},
 {id:'east-works',x:39,z:-1728,w:12,d:18,axis:'x',kind:'deck'},
 {id:'east-culvert',x:60,z:-1728,w:6,d:18,axis:'x',kind:'hop'},
 {id:'east-tram',x:87,z:-1728,w:24,d:18,axis:'x',kind:'beam'},
 {id:'east-drain',x:132,z:-1728,w:6,d:18,axis:'x',kind:'hop'},
 {id:'harbour-station',x:156,z:-1911,w:18,d:84,axis:'z',kind:'beam'},
 {id:'dock-service',x:156,z:-2100,w:18,d:90,axis:'z',kind:'foot'},
 {id:'last-culvert',x:156,z:-2232,w:18,d:6,axis:'z',kind:'hop'},
];
const holeAt=(x:number,z:number,margin=0)=>CARLISLE_EXCAVATIONS.some(h=>Math.abs(x-h.x)<h.w/2+margin&&Math.abs(z-h.z)<h.d/2+margin);

// Continuous deep ground outside the deliberately cut excavations. There is
// no hidden floor beneath a pit and no floating outer edge within the view.
const cuts=[120,-2472,...CARLISLE_EXCAVATIONS.flatMap(h=>[h.z-h.d/2,h.z+h.d/2])].sort((a,b)=>a-b);
for(let i=1;i<cuts.length;i++){
 const a=cuts[i-1],b=cuts[i];if(b-a<.01)continue;
 const spans=CARLISLE_EXCAVATIONS.filter(h=>(a+b)/2>h.z-h.d/2&&(a+b)/2<h.z+h.d/2).map(h=>[h.x-h.w/2,h.x+h.w/2]).sort((a,b)=>a[0]-b[0]);
 let left=-600;
 for(const [lo,hi] of [...spans,[600,600]]){
  if(lo>left){const w=lo-left,z=(a+b)/2,x=(left+lo)/2;
   add({t:'platform',p:[x,-10.18,z],s:[w,20,b-a],invisible:true,edgeGrinding:false,grp:G.blocks});
   add({t:'platform',dkind:'citypavementflat',p:[x,-.255,z],s:[w,.15,b-a],solid:false,edgeGrinding:false,grp:G.blocks});
  }left=Math.max(left,hi);
 }
}

const crossingZ=[-96,-216,-528,-720,-1104,-1200,-1296,-1392,-1632];
const serviceZ=[-336,-792,-1152,-1344,-1992];
const lastCrossings=[-1800,-2016,-2184];
function run(x:number,zStart:number,zEnd:number,crossings:number[]){
 for(let z=zStart;z>=zEnd;z-=6){
  if(holeAt(x,z,2.9))continue;
  const service=serviceZ.find(c=>Math.abs(c-z)<9);if(service!==undefined){if(z===service)surface('citytjunction',x,z,undefined,undefined,.15,90);continue;}
  const intersection=crossings.find(c=>Math.abs(c-z)<9);
  if(intersection!==undefined){if(z===intersection)surface('citycrossing',x,z);continue;}
  surface('cityroad4',x,z,undefined,undefined,.15,90);
 }
 for(const z of crossings)for(const sign of [-1,1]){
  for(let distance=12;distance<=60;distance+=6)surface('cityroad4',x+distance*sign,z);
  prop('citycivic',[x+sign*74,.15,z],[20,28,16],sign<0?90:-90,true,G.blocks);
 }
}
run(0,12,-1716,crossingZ);
surface('citycurve4',0,-1728,undefined,undefined,.15,180);
for(let x=12;x<=144;x+=6)if(!holeAt(x,-1728,2.9))surface('cityroad4',x,-1728);
surface('citycurve4',156,-1728);
run(156,-1740,-2310,lastCrossings);

// Two-lane service streets and a curved shop access road form coherent
// secondary city geometry around the primary boulevard.
for(const z of serviceZ){
 const x=z<-1740?156:0;surface('cityroad4',x-12,z);surface('citytaper',x-24,z);
 for(const d of [36,42])surface('cityroad2',x-d,z);
 surface('citycurve2',x-51,z,undefined,undefined,.15,270);
 for(let d=9;d<=51;d+=6)surface('cityroad2',x-51,z-d,undefined,undefined,.15,90);
 for(const dx of [-3,0,3])prop('cityplanter',[x-51+dx,.15,z-55],[2,.6,2]);
}

const worksBays=[[13,-370,90],[-14,-620,-90],[169,-1904,90],[143,-2100,-90]];
const buildingKinds=['citytownhouse','cityapartments','citycivic','citybrickshops','citywarehouse','citycreamoffice','cityglassoffice','cityterrace','citysteelworks'] as const;
export const CARLISLE_BLOCKS:{x:number;z:number;kind:string}[]=[];
function streetside(x:number,start:number,end:number,crossings:number[],seed:number){
 for(const side of [-1,1]){
  let at=start-12,index=0;
  while(at>end+12){
   const kind=buildingKinds[(index*5+seed+(side>0?2:0))%buildingKinds.length],spec=CITY_MODULES[kind];
   const width=Math.round(spec.size[0]/2)*2,depth=Math.round(spec.size[2]/2)*2;
   const z=at-width/2;
   if(![...crossings,...serviceZ].some(c=>Math.abs(z-c)<width/2+12)&&!worksBays.some(b=>Math.sign(b[0]-x)===side&&Math.abs(b[0]-x)<25&&Math.abs(z-b[1])<width/2+8)){
    // Facades sit at a consistent setback; their actual depth fills the block.
    const bx=x+side*(10+depth/2);
    prop(kind,[bx,.15,z],[width,spec.size[1],depth],side<0?90:-90,true,G.blocks);
    CARLISLE_BLOCKS.push({x:bx,z,kind});
    surface('citypavementflat',x+side*40,z,62,width+3,.15,0,G.blocks);
    if(index%2===0)prop('citylamp',[x+side*7.6,0,z+width*.3]);
    if(index%3===0){prop('cityplanter',[x+side*7.6,.15,z-width*.27],[1.4,.6,1.4]);prop('seagrape',[x+side*7.6,.75,z-width*.27],undefined,0,false,G.scenery);}
    // A second, offset row closes the skyline and gives the neighbourhood depth.
    if(index%2===0&&!serviceZ.some(c=>z<c+12&&z>c-65))prop(buildingKinds[(index+seed+3)%9],[x+side*64,.15,z-5],undefined,side<0?90:-90,true,G.blocks);
   }
   at-=width+3;index++;
  }
 }
}
streetside(0,18,-1707,crossingZ,0);streetside(156,-1746,-2334,lastCrossings,4);
for(const side of [-1,1])for(let x=18;x<150;x+=24){
 const kind=buildingKinds[(x/6+(side>0?2:0))%9],spec=CITY_MODULES[kind];
 prop(kind,[x,.15,-1728+side*(10+spec.size[2]/2)],undefined,side>0?180:0,true,G.blocks);
 surface('citypavementflat',x,-1728+side*40,24,62,.15,0,G.blocks);
}

// Construction cuts have retaining faces, warning barriers and a readable
// crossing. Their supports reach the excavation floor rather than hanging.
for(const h of CARLISLE_EXCAVATIONS){
 add({t:'pit',p:[h.x,-7,h.z],s:[h.w,2,h.d],invisible:true,grp:G.pits,nm:h.id});
 add({t:'platform',dkind:'citypavementflat',p:[h.x,-13.2,h.z],s:[h.w,.4,h.d],solid:false,color:'#000000',edgeGrinding:false,grp:G.pits});
 const along=h.axis==='z'?h.d:h.w;
 for(const side of [-1,1]){
  const x=h.axis==='z'?h.x+side*h.w/2:h.x,z=h.axis==='z'?h.z:h.z+side*h.d/2;
  add({t:'wall',p:[x,-13,z],s:h.axis==='z'?[.4,13,h.d]:[h.w,13,.4],invisible:true,edgeGrinding:false,grp:G.pits});
  for(let d=-along/2+3;d<along/2;d+=6){
   const px=h.axis==='z'?x:h.x+d,pz=h.axis==='z'?h.z+d:z;
   prop('cityfence',[px,0,pz],undefined,h.axis==='z'?90:0,true,G.pits);
   prop('cityretaining',[px,-13,pz],[6,13,.35],h.axis==='z'?(side<0?90:-90):(side<0?0:180),false,G.pits);
  }
 }
 for(const side of [-1,1]){
  const x=h.axis==='z'?h.x:h.x+side*h.w/2,z=h.axis==='z'?h.z+side*h.d/2:h.z;
  add({t:'wall',p:[x,-13,z],s:h.axis==='z'?[h.w,13,.35]:[.35,13,h.d],invisible:true,edgeGrinding:false,grp:G.pits});
  for(const across of [-6,0,6])prop('cityretaining',[x+(h.axis==='z'?across:0),-13,z+(h.axis==='z'?0:across)],[6,13,.35],h.axis==='z'?(side<0?0:180):(side<0?90:-90),false,G.pits);
  for(const across of [-6.3,6.3]){
   const px=h.axis==='z'?x+across:x+side*.7,pz=h.axis==='z'?z+side*.7:z+across;
   prop('cityjersey',[px,0,pz],undefined,h.axis==='z'?0:90,true,G.pits);
   prop('citycone',[px+(h.axis==='z'?1.8:0),0,pz+(h.axis==='z'?0:1.8)],undefined,0,false,G.pits);
  }
 }
 if(h.kind==='hop'){
  // Narrow service boards give an accessible foot line across the short cuts.
  const count=Math.max(1,Math.floor(along/5));
  for(let i=0;i<count;i++){const offset=-along/2+(i+1)*along/(count+1);
   const x=h.axis==='z'?h.x+3.8:h.x+offset,z=h.axis==='z'?h.z+offset:h.z+3.8;
   surface('citydeck',x,z,3.4,3.4,0,0,G.pits);prop('cityscaffold',[x,-12,z],[3.4,12,3.4],0,false,G.pits);
  }
 }else if(h.kind==='deck'||h.kind==='foot'||h.kind==='beam'){
  const count=Math.ceil(along/6);
  for(let i=0;i<count;i++){const offset=-along/2+3+i*6;
   const across=(h.kind==='foot'||h.kind==='beam')?5.4:(i%2?3.0:4.3);
   const x=h.axis==='z'?h.x+across:h.x+offset,z=h.axis==='z'?h.z+offset:h.z+across;
   surface('citydeck',x,z,(h.kind==='foot'||h.kind==='beam')?3.2:4.5,4.5,0,0,G.pits);prop('cityscaffold',[x,-12,z],[(h.kind==='foot'||h.kind==='beam')?3.2:4.5,12,4.5],0,false,G.pits);
   if(i%3===1){crate(x,z,'wood');pickup(x,1.9,z);}
  }
 }
 // A supported steel spine makes the continuous skating route obvious.
 const first=h.axis==='z'?[h.x-3,1.1,h.z+along/2+5]:[h.x-along/2-5,1.1,h.z-3];
 const last=h.axis==='z'?[h.x-3,1.1,h.z-along/2-5]:[h.x+along/2+5,1.1,h.z-3];
 rail([first as [number,number,number],last as [number,number,number]]);
 for(let d=-along/2+2;d<=along/2-1;d+=12){
  const x=h.axis==='z'?h.x-3:h.x+d,z=h.axis==='z'?h.z+d:h.z-3;
  prop('cityscaffold',[x,-12,z],[1.4,13,1.4],0,false,G.pits);
 }
}

// Clear, deliberate skating strings: repeated spacing, readable lane changes,
// rewards on the line, and breathing room before every excavation.
for(const [x,start,end] of [[0,-18,-126],[0,-174,-252],[0,-420,-456],[0,-666,-810],[0,-1026,-1080],[0,-1116,-1182],[0,-1212,-1266],[0,-1308,-1368],[0,-1380,-1428],[0,-1578,-1614],[0,-1644,-1686],[156,-1752,-1776],[156,-1818,-1848],[156,-1968,-1998],[156,-2160,-2208],[156,-2250,-2280]]){
 let i=0;for(let z=start;z>=end;z-=9){if(holeAt(x,z,5))continue;const lane=[-3,-3,0,3,3,0][i%6];crate(x+lane,z,i%9===7?'mystery':'wood');if(i%5===4)pickup(x+lane,1.8,z);i++;}
}
for(const [x,z] of [[0,-84],[0,-192],[0,-432],[0,-672],[0,-924],[0,-1116],[0,-1248],[0,-1410],[0,-1584],[0,-1680],[108,-1728],[156,-1818],[156,-1980],[156,-2160]])checkpoint(x,z);

// Loading-bay switch stairs: the outline stack becomes a route to the raised
// reward dock. All crates have physical support, and the switch is reachable.
let puzzleId=100;
for(const [x,z,side] of [[0,-234,-1],[0,-1152,1],[0,-1332,-1],[156,-2028,1]]){
 const id=puzzleId++;groups.push({id,nm:'Loading bay switch stairs '+id});
 const bay=x+side*7.2;crate(bay,z+5,'bang',.15,id);
 for(let step=0;step<3;step++)for(let row=0;row<=step;row++)crate(bay,z-step*1.2,'wood',row+.15,id,true);
 surface('citydeck',bay,z-5,4,4,2.65,0,G.foot);prop('cityscaffold',[bay,0,z-5],[4,2.3,4],0,false,G.foot);
 crate(bay,z-5,'life',2.65,G.foot);crate(bay-side*1.2,z-5,'multihit',2.65,G.foot);
 for(const d of [-2.4,2.4])prop('citycone',[bay+d,0,z+5]);
}

// Demolition alcoves: TNT can be triggered from a clear approach; the marked
// retreat is beyond blast range. Metal steps offer a deliberate jump route.
for(const [x,z] of [[0,-450],[0,-1260],[156,-1836]]){
 for(const dx of [-1,0,1])crate(x+dx,z,'tnt');
 crate(x-4,z+2,'metal');crate(x-4,z+2,'wood',1);crate(x+4,z-4,'mask');
 crate(x+3,z+10,'bouncy');pickup(x+3,2,z+10);
}
// Two compact late-game choices mix safe metal footholds and lethal nitro.
for(const [x,z] of [[0,-1530],[156,-2256]]){
 for(const dx of [-2,0,2])crate(x+dx,z,'nitro');
 crate(x-4,z+2,'metal');crate(x-4,z-1,'metalbounce');crate(x+4,z+4,'bouncy');crate(x+4,z-4,'multihit');
}
// Street hazards are spaced from pits so recovery is readable and fair.
for(const [x,z,foe] of [[0,-198,'grunt'],[0,-330,'turtle'],[0,-546,'spiker'],[0,-780,'charger'],[0,-1176,'grunt'],[0,-1362,'turtle'],[0,-1614,'spinner'],[156,-1770,'grunt'],[156,-1998,'spiker'],[156,-2196,'turtle']] as const)
 add({t:'enemy',p:[x,0,z],range:3.5,speed:1.3,foe,grp:G.foot});

// Three optional high lines: low steel lead-ins climb to live-looking cables.
// Every sag point is both rendered and grindable; the pole shafts stay outside the track.
for(const [x,z,length] of [[0,-348,72],[0,-828,84],[156,-1860,96]]){
 const points:[number,number,number][]=[[x-3,1.1,z+24],[x-4.2,3.3,z+14],[x-5.7,7.25,z]];
 const spans=Math.ceil(length/36),step=length/spans;
 for(let i=0;i<=spans;i++){
  const pz=z-i*step;prop('cityutilitypole',[x-7.3,.15,pz],undefined,0,false,G.wires);
  add({t:'wall',p:[x-7.3,.15,pz],s:[.42,8,.42],invisible:true,grp:G.wires});
  if(i<spans)for(let j=1;j<=12;j++){const t=j/12;points.push([x-5.7,7.25-Math.sin(t*Math.PI)*.85,pz-t*step]);}
 }
 points.push([x-4.2,3.3,z-length-14],[x-3,1.1,z-length-24]);rail(points,false,true);
 for(const end of [z+14,z-length-14])prop('cityscaffold',[x-4.2,0,end],[1,3.1,1],0,false,G.wires);
 for(const end of [z+25,z-length-25])prop('citycone',[x-4.4,0,end]);
}
// Work crews have parked machinery on protected bays beside major cuts.
for(const [x,z,yaw] of worksBays){
 const roadX=z<-1740?156:0;surface('citypavementflat',roadX+Math.sign(x-roadX)*15.5,z,13,18,.15,0,G.scenery);
 prop('cityexcavator',[x,.15,z],undefined,yaw,true,G.scenery);
}

// Ordered spine follows the actual two quarter-circle road bends.
for(const [x,z,radius] of [[0,24,0],[0,-1728,9],[156,-1728,9],[156,-2340,0]])
 add({t:'camnode',p:[x,0,z],radius,grp:G.camera});
surface('citypavementflat',156,-2328,32,30,.15,0,G.blocks);
prop('citycivic',[156,.15,-2342],[26,28,18],0,true,G.blocks);
for(const x of [146,166]){prop('cityplanter',[x,.15,-2318],[2,.6,2]);prop('seagrape',[x,.75,-2318]);}
add({t:'crystal',p:[156,.7,-2292],grp:G.streets});
add({t:'gate',p:[156,0,-2304],grp:G.streets});
add({t:'clock',p:[2.5,0,2],grp:G.streets});add({t:'comboorb',p:[-4,0,2],grp:G.streets});

export const CARLISLE_COAST_LEVEL:CustomLevelData={
 v:1,name:'Carlisle Coast',spawn:[0,.12,4],killY:-18,sky:'coast',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:95,fogFar:245,fogColor:'#b1cedd',ambientSky:'#d4e9f1',ambientGround:'#a69981',ambientIntensity:2.0,sunColor:'#ffe4bd',sunIntensity:3.0,fillColor:'#b2d5de',fillIntensity:.7,shadowStrength:.42,drawDistance:270},
 medalTimes:{gold:180,silver:210,bronze:255},groups,components:C,
};
