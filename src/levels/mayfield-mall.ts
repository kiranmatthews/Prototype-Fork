import { BoxGeometry, CylinderGeometry, ShapeGeometry } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { MALL_LEVEL } from './mall';
import { SCHOOL_MIAMI_LEVEL, SCHOOL_TABLES } from './school-miami';
import { KONA_LEVEL } from './kona';
import { warehouseBeam, warehouseIsland } from './warehouse-geometry';

type P = [number, number, number];
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [];
let group = 800;
const palette = {cream:'#f4dfb5',tile:'#d6ddd1',teal:'#4c9f9b',purple:'#8064a0',pink:'#d98698',blue:'#7eafc2',ink:'#343d58',yellow:'#f6c66f',green:'#689c7a'};
const add = (c: CustomComponent) => { c.grp = group; C.push(c); return c; };
function section(id:number,nm:string) { group=id; groups.push({id,nm,editorOnly:true}); }
function slab(nm:string,x:number,s:number,y:number,w:number,d:number,h=.6,color=palette.tile) {
  return add({t:'platform',nm,p:[x,y-h/2,-s],s:[w,h,d],tex:'solid',color});
}
const paint = new Map<string,{vertices:number[];indices:number[];color:string;grp:number}>();
function geometry(_nm:string,geo:BoxGeometry|CylinderGeometry|ShapeGeometry,p:P,color:string,yaw=0) {
  geo.rotateY(yaw*Math.PI/180); geo.translate(...p);
  const key=`${group}/${color}`;
  // Split batches before the editor's 4,096-vertex mesh limit, retaining every triangle.
  let b=paint.get(key); let k=key;
  for(let i=0;b && b.vertices.length+geo.attributes.position.count*3>12000;i++){k=`${key}/${i}`;b=paint.get(k);}
  if(!b){b={vertices:[],indices:[],color,grp:group};paint.set(k,b);}
  const offset=b.vertices.length/3;
  b.vertices.push(...Array.from(geo.attributes.position.array));
  b.indices.push(...(geo.index?Array.from(geo.index.array):Array.from({length:geo.attributes.position.count},(_,i)=>i)).map(i=>i+offset));
  geo.dispose();
}
function box(nm:string,p:P,s:P,color:string,yaw=0){geometry(nm,new BoxGeometry(...s),p,color,yaw);}
function cylinder(nm:string,p:P,r:number,h:number,color:string){geometry(nm,new CylinderGeometry(r,r,h,24),p,color);}
const font = new FontLoader().parse(fontData);
function text(label:string,p:P,height:number,width:number,color=palette.cream,yaw=0) {
  const geo=new ShapeGeometry(font.generateShapes(label,height),4); geo.computeBoundingBox();
  const bounds=geo.boundingBox!;const span=bounds.max.x-bounds.min.x,scale=Math.min(1,width/span);
  geo.scale(scale,scale,1);geo.translate(-(bounds.min.x+bounds.max.x)/2*scale,0,0);
  // Long signage is split into triangle chunks by geometry(), with no detail swaps.
  geometry(label,geo,p,color,yaw);
}
function sign(label:string,s:number,y:number,w=17,color=palette.purple,x=0) {
  box(`${label} sign`,[x,y,-s],[w,2.3,.35],color);
  box('Sign cream rim',[x,y-1.12,-s+.05],[w+.35,.13,.45],palette.yellow);
  text(label,[x,y-.52,-s+.19],1.25,w-1.2);
}
function wall(nm:string,x:number,a:number,b:number,y:number,h:number,color:string){
  return add({t:'wall',nm,p:[x,y,-(a+b)/2],s:[.7,h,b-a],tex:'solid',color});
}
function floor(a:number,b:number,y:number,w:number,color=palette.tile) {
  slab('Concourse · continuous supported floor',0,(a+b)/2,y,w,b-a,.8,color);
  for(const x of [-w/2+1.1,w/2-1.1]) box('Teal tile border',[x,y+.012,-(a+b)/2],[.65,.018,b-a],palette.teal);
  for(let s=a+3;s<b-1;s+=6)box('Floor tile joint',[0,y+.012,-s],[w-.3,.012,.045],'#b4beb7');
}
function passage(a:number,b:number,y:number,w:number,indoor=true) {
  for(const side of [-1,1]){
    wall('Mall frontage / solid boundary',side*(w/2+.1),a,b,y,indoor?10:2.8,indoor?palette.cream:palette.pink);
    box('Continuous plum cornice',[side*(w/2-.35),y+(indoor?8.8:2.65),-(a+b)/2],[1,.45,b-a],palette.purple);
  }
  if(indoor) for(let s=a+8;s<b;s+=24){
    for(const side of [-1,1]){
      const x=side*(w/2-1.25);
      add({t:'wall',nm:'Inset storefront column',p:[x,y,-s],s:[1.1,9.2,1.1],color:palette.pink,tex:'solid'});
      box('Column plinth',[x,y+.38,-s],[1.65,.76,1.65],palette.teal);
      box('Column capital',[x,y+8.2,-s],[1.7,.5,1.7],palette.yellow);
    }
    // High open skylight ribs keep the normal follow camera below the structure.
    box('Skylight transverse rib',[0,y+10.4,-s],[w, .35,.5],palette.teal);
    for(const x of [-w*.33,w*.33])box('Cream soffit',[x,y+10.4,-s+8],[w*.28,.32,16],palette.cream);
  }
}
function shop(label:string,x:number,s:number,y:number,color:string) {
  const side=Math.sign(x),yaw=-side*90,face=x-side*.45;
  box('Shop window recess',[x,y+2.6,-s],[.3,4.8,15],palette.ink);
  box('Shop tinted glazing',[face,y+2.5,-s],[.12,4.1,13.4],palette.blue);
  for(const dz of [-6.7,0,6.7])box('Window jamb',[face-side*.1,y+2.5,-s+dz],[.2,4.6,.16],palette.cream);
  box('Shop coloured fascia',[face,y+5.6,-s],[.35,1.65,15.2],color);
  text(label,[face-side*.2,y+5.25,-s],.85,13, palette.cream,yaw);
  for(const dz of [-4,4]){
    box('Display plinth',[face-side*.12,y+.6,-s+dz],[.2,1,2.3],palette.yellow);
    cylinder('Window display disc',[face-side*.25,y+1.8,-s+dz],.45,.5,color);
  }
}
function planter(x:number,s:number,y=0,w=3,d=4){
  slab('Planter · grindable cream rim',x,s,y+.75,w,d,.75,palette.cream);
  box('Planter dark soil',[x,y+.77,-s],[w-.35,.06,d-.35],'#49564f');
  add({t:'decor',dkind:'palm',nm:'Atrium palm',p:[x,y+.79,-s],w:.8,rise:6.5});
  add({t:'wall',nm:'Palm trunk contact',p:[x,y+.75,-s],s:[.35,5,.35],invisible:true});
}
function rail(nm:string,points:P[],color=palette.teal) {const p=points[0];return add({t:'rail',nm,p:[...p],pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),color});}
function ramp(nm:string,a:number,b:number,low:number,high:number,w:number,x=0){
  return add({t:'ramp',nm,p:[x,Math.min(low,high),-(a+b)/2],w,len:b-a,rise:Math.abs(high-low),yaw:high>low?0:180,vert:false,color:palette.cream,tex:'solid'});
}
function checkpoint(s:number,y:number,name:string,x=0){add({t:'checkpoint',p:[x,y,-s],nm:name});}
function fruit(s:number,x=0,y=0){add({t:'wumpa',p:[x,y+1,-s]});}
function crate(s:number,x=0,y=0,kind:CustomComponent['kind']='wood'){add({t:'crate',p:[x,y,-s],kind});}
function gap(a:number,b:number,y:number,w:number,name:string){
  add({t:'pit',p:[0,y-5,-(a+b)/2],s:[w+3,1,b-a+.3],invisible:true,nm:name});
  for(const s of [a-.35,b+.35])box('Gap warning stripe',[0,y+.025,-s],[w,.025,.4],palette.yellow);
}
// Move complete, selected prop assemblies. Original courses and their settings are untouched.
function cloneAssembly(parts:CustomComponent[],pivot:P,target:P,scale:number,yaw:number,label:string){
  const a=yaw*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
  const rotate=(p:P):P=>[scale*(p[0]*cs+p[2]*sn),scale*p[1],scale*(-p[0]*sn+p[2]*cs)];
  for(const source of parts){
    const c=structuredClone(source),p=rotate(c.p.map((n,i)=>n-pivot[i]) as P);
    c.p=p.map((n,i)=>n+target[i]) as P;c.nm=`${label} · ${source.nm}`;
    if(c.vertices){
      const localYaw=(c.yaw??0)*Math.PI/180,lc=Math.cos(localYaw),ls=Math.sin(localYaw),sv=c.s??[1,1,1];
      const v:number[]=[];for(let i=0;i<c.vertices.length;i+=3){const [x,y,z]=c.vertices.slice(i,i+3).map((n,j)=>n*sv[j]);v.push(...rotate([x*lc+z*ls,y,-x*ls+z*lc]));}c.vertices=v;delete c.s;delete c.yaw;delete c.normals;
    } else {if(c.s)c.s=c.s.map(n=>n*scale) as P;c.yaw=(c.yaw??0)+yaw;}
    if(c.pts)c.pts=c.pts.map(q=>{const v=rotate([q[0],q[3]??0,q[1]]);return[v[0],v[2],(q[2]??0)*scale,v[1]];});
    for(const key of ['len','rise','w','deck','radius','lipRise','outerBank','collisionHeight'] as const)if(c[key]!==undefined)c[key]*=scale;
    // Source-only park/capture and breakable registration never follow a moved prop.
    delete c.breakable;delete c.breakGroup;delete c.sourceBox;delete c.skateCamera;delete c.gravityTrack;
    if(c.t==='platform')delete c.edgeGrinding;
    add(c);
  }
}
function bounds(parts:CustomComponent[]){const min:P=[Infinity,Infinity,Infinity],max:P=[-Infinity,-Infinity,-Infinity];for(const c of parts)for(let i=0;i<(c.vertices?.length??0);i+=3)for(let k=0;k<3;k++){const n=c.p[k]+c.vertices![i+k];min[k]=Math.min(min[k],n);max[k]=Math.max(max[k],n);}return{min,max,base:[(min[0]+max[0])/2,min[1],(min[2]+max[2])/2] as P};}
const directory=MALL_LEVEL.components.filter(c=>c.breakable==='sign'&&c.breakGroup===33);
const directoryBounds=bounds(directory);
function directoryAt(x:number,s:number,y:number){cloneAssembly(directory,directoryBounds.base,[x,y,-s],2.4/(directoryBounds.max[1]-directoryBounds.min[1]),0,'Mall directory');}
function picnic(x:number,s:number,y:number,yaw=0){
  const table=SCHOOL_TABLES[0],pivot=table.p.map(n=>n*2) as P;
  const parts=SCHOOL_MIAMI_LEVEL.components.filter(c=>c.nm?.startsWith(table.name)&&c.t==='platform');
  cloneAssembly(parts,pivot,[x,y,-s],.67,yaw,'School Miami food-court table');
  for(const dx of [-1.5,1.5])box('Table steel trestle',[x+dx,y+.45,-s],[.13,.9,1.7],palette.teal);
}

export const MAYFIELD_LENGTH=804;
export const MAYFIELD_GAPS=[{a:399,b:403,y:0,w:10},{a:505,b:509.5,y:2.4,w:12}];
export const MAYFIELD_CHECKPOINTS=[{s:92,y:0},{s:220,y:3.6},{s:366,y:0},{s:470,y:0},{s:558,y:0},{s:704,y:0}];
/** Intended main line: furniture is rearranged around these forward-only waypoints. */
export const MAYFIELD_ROUTE:P[]=[[0,0,4],[0,0,-40],[4.5,0,-64],[0,0,-92],[0,3.6,-156],[0,3.6,-185],[-4,3.6,-204],[0,3.6,-230],[0,0,-279],[8,0,-305],[8,0,-336],[0,0,-365],[0,0,-394],[0,0,-411],[0,0,-445],[0,0,-472],[0,2.4,-498],[0,2.4,-517],[0,0,-553],[0,0,-593],[0,0,-690],[0,0,-728],[5,0,-753],[0,0,-779],[0,0,-796]];

section(800,'01 · Mayfield Galleria / Mall concourse');
floor(-12,112,0,26);passage(-12,112,0,26);
sign('MAYFIELD MALL',18,8.1,21);sign('THE GALLERIA',100,8,19,palette.teal);
for(const [s,label] of [[38,'SOLE MATES'],[70,'WEEKEND RECORDS'],[96,'ODD SOCKS']] as const){shop(label,-12.7,s,0,palette.purple);shop(s===38?'PAPER MOON':s===70?'SUNSHINE SURF':'SIDE QUEST',12.7,s,0,palette.teal);}
for(const s of [28,84])for(const x of [-9.4,9.4])planter(x,s);
// Offset central display: a broad passing lane on either side, no invisible proxy over the aisle.
slab('Mall display island',-2,60,.55,6,9,.55,palette.pink);box('Weekend record display',[-2,1.35,-60],[3.5,1.6,4.5],palette.purple);
text('SATURDAY',[-2,1.55,-57.7],.6,3.4);directoryAt(8,45,0);directoryAt(-8,94,0);
crate(35,-3);crate(67,4.5);crate(82,-4,0,'mask');add({t:'clock',p:[-5,0,-12],nm:'Mayfield time trial'});

section(801,'02 · Food court / School Miami tables and banks');
// A 3.6 m climb over 38 m replaces the original stacked escalator U-turns.
ramp('Twin escalator · broad walkable ascent',112,150,0,3.6,16);
for(const x of [-10.5,10.5])slab('Escalator solid flanking gallery',x,131,3.6,5,38,4.4,palette.pink);
for(const x of [-8.3,8.3])rail('Escalator handrail',[[x,.7,-111],[x,4.3,-151]]);
for(let s=113;s<150;s+=1.2)box('Escalator tread / visual only',[0,(s-112)/38*3.6+.025,-s],[15.8,.024,.08],palette.teal);
passage(112,150,0,26);floor(150,240,3.6,34);passage(150,240,3.6,34);
sign('FOOD + FRIENDS',161,11.5,24,palette.pink);
for(const side of [-1,1]){
  shop(side<0?'CHILL FREEZE':'FRY DAY',side*16.7,180,3.6,side<0?palette.purple:palette.teal);
  shop(side<0?'PIZZA PLANET':'THE ARCADE',side*16.7,220,3.6,side<0?palette.pink:palette.purple);
  for(const s of [176,197,225])picnic(side*10,s,3.6,side<0?0:180);
}
// Two low tables on the play line provide jump/grind opportunities with 7 m passing lanes.
picnic(5,204,3.6,0);planter(-12,233,3.6);planter(12,233,3.6);
for(const x of [-9,9]){slab('Slush kiosk counter',x,163,4.7,4,3,1.1,palette.teal);for(const dx of[-1,0,1])cylinder('Slush dispenser',[x+dx,5.4,-163],.32,.9,[palette.pink,palette.yellow,palette.purple][dx+1]);}
crate(187,0,3.6);crate(213,-4,3.6,'bouncy');directoryAt(-5,234,3.6);
ramp('Courtyard promenade · continuous descent',240,276,3.6,0,26);passage(240,276,0,26);

section(802,'03 · Palm court / fountain and footbridge');
floor(276,382,0,32);passage(276,382,0,32,false);
sign('PALM COURT',285,7.6,20,palette.teal);
for(const side of [-1,1])for(const s of [292,346,373])planter(side*12,s,0,4,5);
// The fountain is a real bounded island, never a hidden wall across its passage.
const fountain=warehouseIsland('Mall fountain · rounded skateable bank',-2,-321,7,14,.8,1.6);fountain.color=palette.pink;add(fountain);
slab('Fountain bowl rim',-2,321,1.1,6.8,13.8,.35,palette.cream);
box('Fountain water',[-2,1.13,-321],[5.8,.045,12.8],palette.blue);
cylinder('Fountain centre',[-2,1.9,-321],1.6,1.55,palette.teal);
cylinder('Fountain upper basin',[-2,2.8,-321],2.3,.25,palette.cream);
cylinder('Fountain water jet',[-2,3.9,-321],.1,2.1,palette.blue);
for(const s of [305,338]){picnic(-10,s,0,0);crate(s,8);}
rail('Fountain right bank grind',[[5,.75,-301],[5,.75,-341]]);
floor(382,399,0,10);floor(403,426,0,10);gap(399,403,0,10,'Atrium water-channel recovery');
for(const side of [-1,1]){rail('Footbridge edge / continuous alternate grind',[[side*4.7,.65,-383],[side*4.7,.65,-423]]);wall('Footbridge boundary',side*6,382,426,-6,7,palette.teal);}
box('Channel water below bridge',[0,-4.7,-401],[32,.1,14],palette.blue);
fruit(401,0,.9);sign('LOADING HALL',420,8,19,palette.purple);

section(803,'04 · Loading hall / Warehouse dock and plywood');
floor(426,482,0,30,'#aebfbb');floor(540,582,0,30,'#aebfbb');passage(426,582,0,30);
for(let s=438;s<580;s+=24){
  for(const side of [-1,1])add(warehouseBeam('Warehouse portal upright',[side*13,0,-s],[side*13,11,-s],.42,.42,palette.teal));
  add(warehouseBeam('Warehouse roof truss',[-13,10.5,-s],[13,10.5,-s],.45,.45,palette.ink));
  for(let x=-12;x<12;x+=6)add(warehouseBeam('Warehouse diagonal',[x,10.4,-s],[x+6,12,-s],.23,.23,palette.pink));
}
// Reoriented and narrowed dock: ascent, short gap, receiver, long runout all share -Z.
ramp('Warehouse delivery dock ascent',482,498,0,2.4,12);slab('Dock takeoff',0,501.5,2.4,12,7);
slab('Dock receiving deck',0,517.75,2.4,12,16.5);ramp('Dock forgiving runout',526,550,2.4,0,12);
gap(505,509.5,2.4,12,'Loading dock gap recovery');
rail('Dock parallel grind',[[5.5,.7,-481],[5.5,3.05,-498],[5.5,3.05,-526],[5.5,.65,-551]],palette.yellow);
// Ground beside the raised dock stays lower; it never overlaps its top contact surface.
for(const x of [-10.5,10.5])slab('Dock side recovery aisle',x,516,0,9,68);
for(const side of [-1,1]){
  for(const s of [446,463,566]){slab('Pallet island',side*10,s,.24,4.5,4,.24,'#ab845b');crate(s,side*10,.24);crate(s+1.3,side*10,.24);}
  add({t:'vertramp',nm:'Warehouse plywood quarter / open ends',p:[side*6.5,0,-459],vkind:'quarter',yaw:side<0?180:0,w:.4,rise:2.4,arc:80,arcSteps:32,deck:1.2,outerBank:1.5,len:20,tex:'wood',color:'#d2ad76',rails:true});
}
crate(500,-2,2.4);fruit(507,0,3.2);crate(531,2,1.9,'life');
sign('ROLL INTO THE WEEKEND',575,8,26,palette.pink);

section(804,'05 · Kona Gardens / continuous skate promenade');
floor(582,606,0,30);passage(582,714,0,30,false);floor(690,714,0,30);
// Kona's disconnected bowls become one straight, open-ended halfpipe promenade.
// The flat 12 m middle is ordinary level travel. Exact quarter geometry owns the
// whole cross section: no broad foundation beneath it and no coplanar overlay.
add({t:'vertramp',nm:'Kona promenade / paired smooth transitions',p:[0,0,-648],len:84,w:6,rise:2.4,arc:90,arcSteps:40,vkind:'half',deck:4.4,tex:'solid',color:palette.blue,rails:true});
// The swept profile owns its entire raised deck. A second slab here catches
// the rider's capsule at the vertical lip before the real transition can launch.
for(const x of [-13.95,13.95])slab('Kona outer walking margin',x,648,0,2.1,84,.6,palette.cream);
// Visible, non-vert exit banks join the raised side decks at both open ends.
for(const x of [-10.7,10.7]){ramp('Kona deck walk-in',590,606,0,2.4,4.2,x);ramp('Kona deck walk-out',690,706,2.4,0,4.2,x);}
const kiosk=KONA_LEVEL.components.filter(c=>c.t==='mesh'&&c.grp===25),kb=bounds(kiosk),ks=6/(kb.max[0]-kb.min[0]);
cloneAssembly(kiosk,kb.base,[-10,0,-584],ks,0,'Kona garden kiosk');
// An explicit footprint belongs to the kiosk body, not its projecting eaves.
add({t:'wall',nm:'Kona kiosk fitted body',p:[-10,0,-584],s:[3.8,3,3.8],color:palette.teal,tex:'solid'});
for(const s of [600,710])for(const x of [-13.7,13.7])planter(x,s,0,1.6,3);
for(const s of [620,646,676]){crate(s,s===646?-3:3,0);for(const x of [-8.4,8.4])fruit(s,x,3.8);}
sign('KONA GARDENS',600,8.1,22,palette.teal);

section(805,'06 · Sunset Walk / Mayfield exit plaza');
floor(714,812,0,30);passage(714,812,0,30);
sign('SUNSET WALK',724,8.2,21,palette.purple);
shop('LATER DAYS',-14.7,749,0,palette.pink);shop('MAYFIELD CINEMA',14.7,749,0,palette.teal);
for(const side of [-1,1]){planter(side*11,737);planter(side*11,777);picnic(side*10,765,0);}
slab('Final window display',-3,752,.6,6,8,.6,palette.purple);crate(754,5);crate(770,-3,0,'mystery');
add({t:'crystal',p:[0,1,-780],nm:'Mayfield crystal'});sign('SEE YOU NEXT WEEKEND',799,8.1,27,palette.pink);
add({t:'gate',p:[0,0,-796],nm:'Mayfield Mall exit',yaw:0});
wall('Exit side wall',-15.5,780,812,0,10,palette.cream);wall('Exit side wall',15.5,780,812,0,10,palette.cream);

section(806,'Route, checkpoints and recovery');
for(const [i,c]of MAYFIELD_CHECKPOINTS.entries())checkpoint(c.s,c.y,`Mayfield checkpoint ${i+1}`);
for(const s of [0,100,160,230,280,370,426,476,556,600,698,750,810])add({t:'camnode',p:[0,0,-s],radius:5,nm:'Mayfield forward corridor'});
for(const [a,b,y] of [[18,40,0],[82,104,0],[154,176,3.6],[222,235,3.6],[349,376,0],[431,443,0],[557,576,0],[588,602,0],[712,730,0],[765,777,0]])for(let s=a;s<b;s+=6)fruit(s,0,y);
add({t:'pit',p:[0,-12,-400],s:[100,1,880],invisible:true,nm:'Mayfield below-course recovery'});
// Batch only scenery; authored surfaces and complete prop triangles retain their own collision.
for(const b of paint.values())C.push({t:'mesh',nm:'Mayfield architecture and lettering',p:[0,0,0],vertices:b.vertices,indices:b.indices,solid:false,edgeGrinding:false,color:b.color,tex:'solid',grp:b.grp});
export const MAYFIELD_MALL_LEVEL:CustomLevelData={
  v:1,name:'Mayfield Mall',spawn:[0,.12,4],killY:-16,startWarpPad:false,
  skatepark:false,alwaysSkate:false,sky:'day',keepPlayFog:true,jungleDepthFade:false,
  cameraRig:{camDist:9,camHeight:4.7,camPitch:18,camFov:64},cameraLookAhead:5,
  relicTime:55,medalTimes:{gold:55,silver:80,bronze:115},
  atmosphere:{fogEnabled:true,fogNear:85,fogFar:240,fogColor:'#b9d6df',drawDistance:330,
    ambientSky:'#fff1d5',ambientGround:'#7b8994',ambientIntensity:1.5,sunColor:'#fff0c8',sunIntensity:1.7,fillColor:'#b9dce2',fillIntensity:.7,shadowStrength:.45,backdrop:'fog'},
  components:C,groups,
};
