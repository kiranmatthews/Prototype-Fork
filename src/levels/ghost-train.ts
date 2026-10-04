import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { GhostArt, type GhostPoint } from './ghost-train-art';

/** A source-owned 2.3 km indoor dark ride; movement uses the ordinary toolkit. */
export const GHOST_TRAIN_END = 2250;
const C:CustomComponent[]=[];
const groups:CustomGroup[]=[{id:1,nm:'Ghost Train · ordered camera lane',editorOnly:true}];
const art=new GhostArt(C);
const P={stone:'#4c4163',dark:'#292235',light:'#776988',mortar:'#353044',floor:'#625a70',iron:'#313745',steel:'#9eabb3',brass:'#c8a363',red:'#863446',green:'#72ff9b',gold:'#e2bf79',wood:'#725047',bone:'#d7cab0',black:'#161520'};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*clamp(t);
const add=(c:CustomComponent)=>C.push(c);
const round=(p:GhostPoint):GhostPoint=>p.map(n=>Math.round(n*4096)/4096) as GhostPoint;

export function ghostRouteX(s:number):number{return 38*Math.sin(s*Math.PI*2/850)+14*Math.sin(s*Math.PI*2/1320);}
export function ghostRouteTangent(s:number):GhostPoint{
  const dx=38*Math.PI*2/850*Math.cos(s*Math.PI*2/850)+14*Math.PI*2/1320*Math.cos(s*Math.PI*2/1320),n=Math.hypot(dx,1);
  return[dx/n,0,-1/n];
}
export function ghostRoutePoint(s:number,y=0,u=0):GhostPoint{
  const [x,,z]=ghostRouteTangent(s);return round([ghostRouteX(s)-z*u,y,18-s+x*u]);
}
export function ghostRouteYaw(s:number):number{const [x,,z]=ghostRouteTangent(s);return-Math.atan2(x,-z)*180/Math.PI;}
export const GHOST_TRAIN_ROUTE=Array.from({length:229},(_,i)=>({s:-20+i*10,p:ghostRoutePoint(-20+i*10),yaw:ghostRouteYaw(-20+i*10)}));
export const GHOST_TRAIN_SECTIONS=[
  {name:'01 · Last Departure',a:-20,b:250,width:22,ceiling:15,theme:'station'},
  {name:'02 · The Execution Gallery',a:250,b:535,width:22,ceiling:14,theme:'axes'},
  {name:'03 · Feast of the Uninvited',a:535,b:840,width:32,ceiling:19,theme:'banquet'},
  {name:'04 · The Iron Procession',a:840,b:1110,width:24,ceiling:16,theme:'armour'},
  {name:'05 · Phantom Freight',a:1110,b:1400,width:25,ceiling:17,theme:'transit'},
  {name:'06 · Track of the Forgotten',a:1400,b:1680,width:26,ceiling:16,theme:'crypt'},
  {name:'07 · The Black Clockworks',a:1680,b:1980,width:24,ceiling:18,theme:'machinery'},
  {name:'08 · The Emerald Throne',a:1980,b:2280,width:30,ceiling:20,theme:'throne'},
].map((s,i)=>({...s,grp:10+i,start:ghostRoutePoint(s.a),end:ghostRoutePoint(s.b)}));
for(const section of GHOST_TRAIN_SECTIONS)groups.push({id:section.grp,nm:section.name,editorOnly:true});
const district=(s:number)=>GHOST_TRAIN_SECTIONS.find(d=>s>=d.a&&s<d.b)??GHOST_TRAIN_SECTIONS[GHOST_TRAIN_SECTIONS.length-1];

export interface GhostWaypoint {s:number;p:GhostPoint;kind:'walk'|'cart'|'rail'|'jump'|'checkpoint'|'gate';name?:string;componentIndex?:number}
export const GHOST_TRAIN_WAYPOINTS:GhostWaypoint[]=[];
export const GHOST_TRAIN_CHECKPOINTS:{s:number;p:GhostPoint;name:string}[]=[];
export const GHOST_TRAIN_CARTS:{s:number;p:GhostPoint;component:CustomComponent;relay:number;componentIndex:number}[]=[];
export const GHOST_TRAIN_RAILS:{a:number;b:number;y:number;u:number;points:GhostPoint[]}[]=[];
export const GHOST_TRAIN_GAPS:{a:number;b:number;kind:'cart'|'rail'|'jump';name:string}[]=[];
export const GHOST_TRAIN_AXES:CustomComponent[]=[];
export const GHOST_TRAIN_ENEMIES:CustomComponent[]=[];
export const GHOST_TRAIN_FLOORS:{a:number;b:number;width:number}[]=[];

function waypoint(s:number,kind:GhostWaypoint['kind'],y=0,u=0,name?:string,componentIndex?:number):void{
  GHOST_TRAIN_WAYPOINTS.push({s,p:ghostRoutePoint(s,y+.14,u),kind,...(name?{name}:{}),...(componentIndex===undefined?{}:{componentIndex})});
}
function checkpoint(s:number,name:string,u=2.8):void{
  const p=ghostRoutePoint(s,0,u);add({t:'checkpoint',p,grp:district(s).grp,nm:name});
  GHOST_TRAIN_CHECKPOINTS.push({s,p,name});waypoint(s,'checkpoint',0,u,name);
  // Brass-and-green paving makes safe islands readable amid the dark ride.
  art.box(ghostRoutePoint(s,-.012),[9.8,.035,4.2],P.brass,district(s).grp,'Checkpoint brass arrival carpet',ghostRouteYaw(s));
  for(const side of [-1,1])art.box(ghostRoutePoint(s,.025,side*4.7),[.15,.08,4.2],P.green,district(s).grp,'Checkpoint emerald edge',ghostRouteYaw(s),P.green);
}

/** Closed floor masses share rounded vertices; wide halls have real side walls. */
function floor(a:number,b:number,width=12,color=P.floor):void{
  GHOST_TRAIN_FLOORS.push({a,b,width});
  for(let from=a;from<b;from+=48){
    const to=Math.min(b,from+48),n=Math.max(1,Math.ceil((to-from)/8)),origin=ghostRoutePoint(from),v:number[]=[],ix:number[]=[];
    const face=(points:GhostPoint[])=>{const j=v.length/3;for(const p of points)v.push(...round([p[0]-origin[0],p[1],p[2]-origin[2]]));for(let k=1;k<points.length-1;k++)ix.push(j,j+k,j+k+1);};
    for(let i=0;i<n;i++){
      const sa=from+(to-from)*i/n,sb=from+(to-from)*(i+1)/n;
      const l0=ghostRoutePoint(sa,0,-width/2),r0=ghostRoutePoint(sa,0,width/2),l1=ghostRoutePoint(sb,0,-width/2),r1=ghostRoutePoint(sb,0,width/2);
      const down=(p:GhostPoint):GhostPoint=>[p[0],-.9,p[2]];
      face([l0,r0,r1,l1]);face([down(l0),down(l1),down(r1),down(r0)]);
      face([l0,l1,down(l1),down(l0)]);face([r1,r0,down(r0),down(r1)]);
      if(i===0)face([r0,l0,down(l0),down(r0)]);
      if(i===n-1)face([l1,r1,down(r1),down(l1)]);
    }
    add({t:'mesh',p:origin,vertices:v,indices:ix,tex:'solid',color,edgeGrinding:false,grp:district(from).grp,nm:'Castle stone floor · closed collision mass'});
  }
  // A subtle paving rhythm remains visible under the theatrical lighting.
  for(let s=Math.ceil(a/8)*8;s<b;s+=8)art.box(ghostRoutePoint(s,.006),[width-.08,.012,.055],P.mortar,district(s).grp,'Stone floor cross joints',ghostRouteYaw(s));
}
function pit(a:number,b:number,name:string,kind:GhostWaypoint['kind']='jump'):void{
  const half=18,points=[ghostRoutePoint(a,-4,-half),ghostRoutePoint(b,-4,-half),ghostRoutePoint(b,-4,half),ghostRoutePoint(a,-4,half)],p=points[0];
  add({t:'pit',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2]]),s:[1,1,1],color:P.black,grp:district(a).grp,nm:name});
  GHOST_TRAIN_GAPS.push({a,b,kind:kind==='rail'?'rail':kind==='cart'?'cart':'jump',name});
}
function rail(a:number,b:number,y=.6,u=0,name='Cartless ghost rail'):void{
  const n=Math.ceil((b-a)/5),points=Array.from({length:n+1},(_,i)=>ghostRoutePoint(a+(b-a)*i/n,y,u)),p=points[0];
  add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),grp:district(a).grp,nm:name});
  GHOST_TRAIN_RAILS.push({a,b,y,u,points});
  for(let s=a;s<b;s+=16)waypoint(s,'rail',y,u,name);
}
function track(a:number,b:number,y=-.09):void{
  for(let s=a;s<b;s+=7.2){
    const g=district(s).grp;art.box(ghostRoutePoint(s,y-.08),[4.3,.22,.46],P.wood,g,'Low-poly railway sleepers',ghostRouteYaw(s));
    for(const side of [-1,1])art.beam(ghostRoutePoint(s,y+.07,side*1.32),ghostRoutePoint(Math.min(b,s+7.25),y+.07,side*1.32),.1,P.steel,g,'Twin polished ghost-train tracks',.14);
  }
}
function axe(s:number,u=0,phase=0):void{
  const c:CustomComponent={t:'pendulum',dkind:'ghostaxe',p:ghostRoutePoint(s,7.2,u),len:6,amp:.92,speed:1.32,phase,yaw:ghostRouteYaw(s),grp:district(s).grp,nm:'Swinging execution axe'};
  add(c);GHOST_TRAIN_AXES.push(c);
  art.beam(ghostRoutePoint(s,7.5,-6.6),ghostRoutePoint(s,7.5,6.6),.55,P.iron,district(s).grp,'Execution axe gantry',.7);
  for(const side of [-1,1])art.box(ghostRoutePoint(s,3.75,side*6.6),[.65,7.5,.75],P.dark,district(s).grp,'Axe gantry upright',ghostRouteYaw(s));
}
function enemy(s:number,kind:'ghostknight'|'ghostfood'|'ghostcake',u=0,vr=0,range=2.8):void{
  const c:CustomComponent={t:'enemy',dkind:kind,p:ghostRoutePoint(s,0,u),foe:kind==='ghostknight'?'grunt':'hopper',range,speed:kind==='ghostknight'?.88:1.35,vr,grp:district(s).grp,nm:kind==='ghostknight'?'Emerald-eyed robotic armour':'Banquet animatronic food'};
  add(c);GHOST_TRAIN_ENEMIES.push(c);
}
function cartRelay(a:number,b:number,id:number,name:string):void{
  // 15 m decks on 18 m centres leave a constant 3 m transfer. Identical
  // phases keep those gaps fair while all the visible carts actually move.
  pit(a,b,`${name} · empty rail trench`,'cart');track(a-10,b+10,-1.1);
  const centres=[a+4,a+22,a+40,a+58],deck=15;
  for(const s of centres){
    const c:CustomComponent={t:'mover',dkind:'ghostcart',p:ghostRoutePoint(s,0),s:[8.4,.8,deck],axis:'z',travelSign:-1,amp:2,speed:.76,phase:-Math.PI/2,grp:district(s).grp,nm:`${name} · carriage ${GHOST_TRAIN_CARTS.length+1}`};
    const componentIndex=C.length;add(c);GHOST_TRAIN_CARTS.push({s,p:c.p,component:c,relay:id,componentIndex});
    waypoint(s,'cart',0,0,c.nm,componentIndex);
  }
  // Floors overlap the end carts by at least two metres throughout a cycle.
  waypoint(a-2,'walk',0,0,`${name} embark`);waypoint(a+10.9,'jump',0,0,`${name} first transfer`);waypoint(a+28.9,'jump',0,0,`${name} second transfer`);waypoint(a+46.9,'jump',0,0,`${name} third transfer`);waypoint(b+9,'walk',0,0,`${name} disembark`);
}

// The architecture is genuinely enclosed. Render-only masonry and vault ribs
// share batches; continuous wallpaths provide uncluttered collision boundaries.
function hall(a:number,b:number,width:number,ceiling:number,g:number,theme:string):void{
  for(const side of [-1,1]){
    const knots=Array.from({length:Math.ceil((b-a)/12)+1},(_,i)=>ghostRoutePoint(mix(a,b,i/Math.ceil((b-a)/12)),-.9,side*width/2)),p=knots[0];
    add({t:'wallpath',p,pts:knots.map(q=>[q[0]-p[0],q[2]-p[2],0]),w:.55,rise:ceiling,invisible:true,edgeGrinding:false,containment:true,grp:g,nm:'Enclosed castle interior boundary'});
  }
  for(let s=a;s<b;s+=18){
    const next=Math.min(b,s+18),wallTop=ceiling*.64;
    for(const side of [-1,1]){
      const u=side*width/2,q=[ghostRoutePoint(s,-1,u),ghostRoutePoint(next,-1,u),ghostRoutePoint(next,wallTop,u),ghostRoutePoint(s,wallTop,u)];
      art.face(q,P.dark,g,'Castle interior wall backing');
      // Large irregular coursed stone gives relief without thousands of props.
      for(let row=0;row<2;row++)art.box(ghostRoutePoint(s+9,2.05+row*3.55,u-side*.13),[.32,3.4,17.6],row%2?P.stone:P.mortar,g,'Purple ashlar wall courses',ghostRouteYaw(s+9));
      art.box(ghostRoutePoint(s+9,1,u-side*.2),[.44,.2,18.15],P.light,g,'Castle dado moulding',ghostRouteYaw(s+9));
      art.box(ghostRoutePoint(s+9,wallTop-.2,u-side*.16),[.6,.35,18.15],P.light,g,'Stone vault spring moulding',ghostRouteYaw(s+9));
    }
    // A pointed, faceted barrel vault rises well above the chase camera.
    const crown=[[-.5,wallTop],[-.36,ceiling*.86],[-.15,ceiling*.97],[0,ceiling],[.15,ceiling*.97],[.36,ceiling*.86],[.5,wallTop]];
    for(let k=0;k<crown.length-1;k++)art.face([ghostRoutePoint(s,crown[k][1],width*crown[k][0]),ghostRoutePoint(next,crown[k][1],width*crown[k][0]),ghostRoutePoint(next,crown[k+1][1],width*crown[k+1][0]),ghostRoutePoint(s,crown[k+1][1],width*crown[k+1][0])],k%2?P.stone:P.dark,g,'Faceted pointed barrel vault');
  }
  for(let s=Math.ceil(a/40)*40;s<b;s+=40){
    const spring=ceiling*.64;
    for(const side of [-1,1]){
      const u=side*(width/2-.45);
      art.box(ghostRoutePoint(s,spring/2,u),[1.1,spring,1.5],P.light,g,'Gothic pier shaft',ghostRouteYaw(s));
      art.box(ghostRoutePoint(s,.3,u),[1.9,.6,2.2],P.stone,g,'Gothic pier base',ghostRouteYaw(s));
      art.box(ghostRoutePoint(s,spring-.15,u),[1.8,.6,2.15],P.brass,g,'Gothic pier capital',ghostRouteYaw(s));
    }
    const rib=[[-.48,spring],[-.35,ceiling*.86],[-.15,ceiling*.97],[0,ceiling+.03],[.15,ceiling*.97],[.35,ceiling*.86],[.48,spring]];
    for(let k=0;k<rib.length-1;k++)art.beam(ghostRoutePoint(s,rib[k][1],width*rib[k][0]),ghostRoutePoint(s,rib[k+1][1],width*rib[k+1][0]),.4,P.light,g,'Pointed vault ribs',.6);
    if(Math.floor(s/40)%2===0)for(const side of [-1,1]){
      const u=side*(width/2-.65),a0=ghostRoutePoint(s+10,3.8,u),a1=ghostRoutePoint(s+13,8.2,u),a2=ghostRoutePoint(s+16,3.8,u);
      art.face([a0,a1,a2],P.green,g,'Emerald stained glass lancet',P.green);
      art.beam(a0,a1,.25,P.brass,g,'Lancet brass tracery');art.beam(a1,a2,.25,P.brass,g,'Lancet brass tracery');art.beam(a2,a0,.25,P.brass,g,'Lancet brass sill');
      // Pennants keep the theatrical haunted-castle palette coherent.
      const bannerU=side*(width/2-.85);art.face([ghostRoutePoint(s+4,8,bannerU),ghostRoutePoint(s+7.5,8,bannerU),ghostRoutePoint(s+7.5,4.2,bannerU),ghostRoutePoint(s+5.75,3.1,bannerU),ghostRoutePoint(s+4,4.2,bannerU)],P.red,g,'Crimson swallowtail castle banner');
    }
  }
  for(let s=a+32;s<b;s+=100)chandelier(s,ceiling-4,g,theme==='banquet'||theme==='throne'?3.3:2.2);
}
function chandelier(s:number,y:number,g:number,radius:number):void{
  const p=ghostRoutePoint(s,y);art.ring(p,radius,.22,P.brass,g,'Low-poly brass chandelier');
  art.beam(ghostRoutePoint(s,y),ghostRoutePoint(s,y+3.6),.1,P.iron,g,'Chandelier suspension');
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,q:GhostPoint=[p[0]+Math.cos(a)*radius,y,p[2]+Math.sin(a)*radius];
    art.beam(p,q,.1,P.brass,g,'Chandelier radial arms');art.box([q[0],q[1]+.38,q[2]],[.14,.72,.14],P.bone,g,'Chandelier candles');
    art.box([q[0],q[1]+.8,q[2]],[.14,.28,.14],P.gold,g,'Chandelier warm flames',0,P.gold);
  }
}
function plate(s:number,u:number,y:number,radius:number,g:number):void{
  const p=ghostRoutePoint(s,y,u);art.ring(p,radius,.3,P.bone,g,'Banquet porcelain platter',0,false,10);art.ring([p[0],p[1]+.015,p[2]],radius+.14,.08,P.brass,g,'Banquet gold platter rim',0,false,10);
}
function banquet(a:number,b:number,g:number,royal=false):void{
  for(let s=a+15;s<b-8;s+=36)for(const side of [-1,1]){
    const u=side*(royal?9.8:10.7),yaw=ghostRouteYaw(s);
    art.box(ghostRoutePoint(s,1.8,u),[4.7,.45,17],P.wood,g,'Long haunted banquet table',yaw);
    art.box(ghostRoutePoint(s,2.035,u),[4.5,.03,16.8],P.red,g,'Banquet crimson tablecloth',yaw);
    for(const z of [-6.5,6.5])for(const x of [-1.5,1.5])art.box(ghostRoutePoint(s+z,.85,u+x),[.4,1.7,.4],P.brass,g,'Banquet carved table legs',yaw);
    for(const z of [-5,0,5]){
      plate(s+z,u,2.1,1.2,g);art.box(ghostRoutePoint(s+z,2.4,u),[.85,.55,1.35],z===0?P.gold:P.bone,g,'Oversized theatrical feast dishes',yaw);
    }
    for(const inner of [-1,1])for(const z of [-5,0,5]){
      const seatU=u+inner*3.3;art.box(ghostRoutePoint(s+z,.7,seatU),[1.5,.28,1.4],P.red,g,'Banquet chairs',yaw);art.box(ghostRoutePoint(s+z,1.3,seatU+inner*.65),[.15,2.1,1.5],P.wood,g,'Banquet high chair backs',yaw);
    }
  }
}
function coffin(s:number,u:number,g:number):void{
  const y=.55,yaw=ghostRouteYaw(s);
  art.box(ghostRoutePoint(s,y,u),[2.5,1.1,5.4],P.dark,g,'Hexed crypt sarcophagus',yaw);art.box(ghostRoutePoint(s,1.2,u),[2.7,.25,5.6],P.light,g,'Sarcophagus stone lid',yaw);
  art.box(ghostRoutePoint(s,1.35,u),[.25,.06,3.8],P.brass,g,'Sarcophagus brass inlay',yaw);art.box(ghostRoutePoint(s-.8,1.35,u),[1.4,.06,.25],P.brass,g,'Sarcophagus brass crossbar',yaw);
}
function machinery(s:number,u:number,g:number):void{
  const p=ghostRoutePoint(s,4,u),yaw=ghostRouteYaw(s);
  art.ring(p,3.4,1.15,P.brass,g,'Clockworks faceted gear',yaw,true,16);art.ring(p,1.2,.65,P.iron,g,'Clockworks central bearing',yaw,true,12);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;art.beam(p,[p[0]+Math.cos(a)*3,p[1]+Math.sin(a)*3,p[2]],.32,P.iron,g,'Clockworks wheel spokes');
  }
  art.box(ghostRoutePoint(s,1,u),[6,2,3],P.dark,g,'Clockworks machinery foundation',yaw);
}

// Floors deliberately end at the ride trenches. There is no hidden ground
// under the cart transfers or the broken-rail sequences.
floor(-20,78,18);floor(136,250,13);cartRelay(78,136,0,'Station departure');
floor(250,357,12);floor(361,437,12);floor(441,535,12);pit(357,361,'Execution-gallery broken flagstones');pit(437,441,'Execution-gallery second flagstone gap');
floor(535,840,27);floor(840,1018,13);floor(1048,1110,13);pit(1018,1048,'Armour gallery collapsed bridge','rail');
floor(1110,1163,15);floor(1221,1302,15);floor(1360,1400,15);cartRelay(1163,1221,1,'Phantom freight transfer');cartRelay(1302,1360,2,'Funeral freight transfer');
floor(1400,1436,14);floor(1572,1680,14);pit(1436,1572,'Crypt cartless broken railway','rail');
floor(1680,1842,13);floor(1900,1980,13);cartRelay(1842,1900,3,'Clockworks cart escape');
floor(1980,2170,25);floor(2214,2280,25);pit(2170,2214,'Emerald throne final shattered track','rail');

for(const d of GHOST_TRAIN_SECTIONS)hall(d.a,d.b,d.width,d.ceiling,d.grp,d.theme);
for(const f of GHOST_TRAIN_FLOORS)track(f.a,f.b);

// 1. Boarding immediately introduces the moving train before the first axe.
add({t:'clock',p:ghostRoutePoint(8,0,5),grp:10});add({t:'comboorb',p:ghostRoutePoint(8,0,-5),grp:10});
add({t:'crate',p:ghostRoutePoint(23,0,-3.7),kind:'mask',grp:10,nm:'Departure safety mask'});
for(const s of [20,48,155,188,222])for(const side of [-1,1])art.box(ghostRoutePoint(s,.5,side*7.8),[1.3,1,9],P.red,10,'Station upholstered waiting bench',ghostRouteYaw(s));
axe(176,0,.4);axe(224,1.2,2.6);checkpoint(153,'Last Departure · train cleared');

// 2. Alternating sweep timing and two honest four-metre floor jumps.
for(const [i,s]of [282,317,391,412,478,509].entries())axe(s,i%2?-1.4:1.4,i*.92);
checkpoint(267,'Execution Gallery · enter');checkpoint(464,'Execution Gallery · blades cleared');
for(const s of [355,435]){waypoint(s-2,'walk');waypoint(s+1,'jump');waypoint(s+8,'walk');}

// 3. Oversized food props belong to long dressed tables, while smaller
// animated enemies spill onto the central lane in a readable stagger.
banquet(550,825,12);for(const [i,s]of [581,626,672,719,770,808].entries())enemy(s,i%3===1?'ghostcake':'ghostfood',i%2?-1.9:1.9,i%3,3);
checkpoint(549,'Feast of the Uninvited · entrance',4);checkpoint(742,'Feast of the Uninvited · banquet cleared',4);
add({t:'crate',p:ghostRoutePoint(689,0,-4.5),kind:'mystery',grp:12,nm:'Banquet guest prize'});

// 4. Armour crosses the aisle mechanically; the ruined footbridge has a
// 3 m rail-to-rail jump rather than an invisible floor bypass.
for(const [i,s]of [875,918,963,998,1081].entries())enemy(s,'ghostknight',i%2?-2.2:2.2,0,3.1);
rail(1008,1031,.55,-.5,'Armour bridge · outgoing rail');rail(1034,1059,.55,.5,'Armour bridge · receiving rail');
track(1018,1048,-.8);waypoint(1029,'jump',.55,-.5,'Armour bridge rail jump');waypoint(1036,'rail',.55,.5);
checkpoint(857,'The Iron Procession · enter');checkpoint(1060,'The Iron Procession · broken bridge cleared');
for(let s=860;s<1100;s+=42)for(const side of [-1,1]){
  const u=side*9.3;art.box(ghostRoutePoint(s,.7,u),[3,1.4,3],P.stone,13,'Armour display plinth',ghostRouteYaw(s));
  art.box(ghostRoutePoint(s,3,u),[1.8,3.2,.45],P.red,13,'Armour alcove crimson backdrop',ghostRouteYaw(s));
}

// 5. Two moving convoys are separated by a generous safe island. Other
// retired carriage bodies occupy the side platforms as set dressing.
checkpoint(1130,'Phantom Freight · boarding');checkpoint(1240,'Phantom Freight · transfer island');checkpoint(1378,'Phantom Freight · disembarked');
for(const s of [1138,1255,1386])for(const side of [-1,1]){
  art.box(ghostRoutePoint(s,.8,side*9),[3.8,1.5,8.5],P.red,14,'Retired ghost carriage sides',ghostRouteYaw(s));
  art.box(ghostRoutePoint(s,1.61,side*9),[3.2,.1,7.8],P.black,14,'Retired carriage open interior',ghostRouteYaw(s));
}

// 6. Cartless train tracks hang over the crypt. The 3 m breaks are visible
// and marked with emerald guide lights; three rails chain the whole vault.
rail(1426,1480,.58,0,'Crypt broken track · first rail');rail(1483,1526,.58,0,'Crypt broken track · second rail');rail(1529,1583,.58,0,'Crypt broken track · third rail');
track(1436,1480,-.75);track(1483,1526,-.75);track(1529,1572,-.75);
for(const [a,b]of [[1480,1483],[1526,1529]]){waypoint(a-1.6,'jump',.58,0,'Broken crypt rail launch');waypoint(b+1.8,'rail',.58,0,'Broken crypt rail catch');}
for(let s=1415;s<1670;s+=30)for(const side of [-1,1])coffin(s,side*9.8,15);
for(const s of [1460,1532,1628])for(const side of [-1,1])art.box(ghostRoutePoint(s,3.5,side*10.5),[.2,6.5,3.2],P.green,15,'Emerald crypt light slit',ghostRouteYaw(s),P.green);
checkpoint(1592,'Track of the Forgotten · grind complete');enemy(1642,'ghostknight',0,0,3.2);

// 7. A short execution aisle feeds the machinery convoy.
for(const [i,s]of [1720,1760,1802].entries())axe(s,i%2?-1.1:1.1,i*1.1);
for(let s=1700;s<1970;s+=35)machinery(s,s%70?-9.2:9.2,16);
checkpoint(1700,'The Black Clockworks · enter');axe(1950,0,.8);

// 8. An ornate feast and marching guard lead to a final broken-track leap,
// then a full arrival carpet beneath the throne and finish gate.
banquet(1987,2135,17,true);for(const [i,s]of [2016,2065,2100,2142].entries())enemy(s,i===2?'ghostfood':'ghostknight',i%2?-2.7:2.7,i%3,3);
checkpoint(1992,'The Emerald Throne · enter',4);checkpoint(2152,'The Emerald Throne · final track');
rail(2159,2191,.58,0,'Throne rail · departure');rail(2194,2225,.58,0,'Throne rail · arrival');track(2170,2191,-.75);track(2194,2214,-.75);
waypoint(2189.4,'jump',.58,0,'Final shattered rail leap');waypoint(2196,'rail',.58,0,'Final shattered rail catch');
add({t:'gate',p:ghostRoutePoint(2250),yaw:ghostRouteYaw(2250),grp:17,nm:'Emerald throne · ghost train finish'});waypoint(2250,'gate',0,0,'Ghost train finish');
for(const side of [-1,1]){
  art.box(ghostRoutePoint(2260,2.5,side*5.7),[1.8,5,2],P.brass,17,'Emerald throne flanking pillars',ghostRouteYaw(2260));
  art.box(ghostRoutePoint(2260,5.3,side*5.7),[2.2,.6,2.4],P.green,17,'Emerald throne luminous capitals',ghostRouteYaw(2260),P.green);
}
art.box(ghostRoutePoint(2267,1.6),[9,3.2,4.8],P.dark,17,'Throne dais',ghostRouteYaw(2267));
art.box(ghostRoutePoint(2268,5),[4.5,5.4,.85],P.red,17,'Crimson throne back',ghostRouteYaw(2268));
art.box(ghostRoutePoint(2267,3),[4.5,.65,3],P.brass,17,'Throne brass seat',ghostRouteYaw(2267));

// Meshy architecture assets punctuate the handmade shell; the same original
// low-poly vocabulary carries through the animatronics and moving carts.
for(const s of [0,250,535,840,1110,1400,1680,1980,2236])add({t:'decor',dkind:'ghostarch',p:ghostRoutePoint(s),s:[10,12,2.2],yaw:ghostRouteYaw(s),solid:false,grp:district(s).grp,nm:'Meshy haunted castle pointed gateway'});

// Sparse route pickups guide the correct supported lane without covering art.
for(let s=34;s<2240;s+=27){
  if(GHOST_TRAIN_GAPS.some(g=>s>g.a-5&&s<g.b+5))continue;
  add({t:'wumpa',p:ghostRoutePoint(s,1.05),grp:district(s).grp});
}
add({t:'crystal',p:ghostRoutePoint(795,1.4,-5.4),grp:12,nm:'Uninvited guest crystal'});
art.finish();

// This remains a chase-camera level: only ordinary ordered camnodes steer
// controls. Pointed ceilings stay safely above the camera's full air rise.
for(let s=-30;s<=GHOST_TRAIN_END+40;s+=12)add({t:'camnode',p:ghostRoutePoint(s),radius:8,grp:1,nm:'Ghost train indoor chase lane'});
for(let s=0;s<GHOST_TRAIN_END;s+=18){
  if(GHOST_TRAIN_GAPS.some(g=>s>g.a-2&&s<g.b+2))continue;
  waypoint(s,'walk');
}
GHOST_TRAIN_WAYPOINTS.sort((a,b)=>a.s-b.s);

export const GHOST_TRAIN_LEVEL:CustomLevelData={
  v:1,name:'Haunted Castle · Ghost Train',spawn:ghostRoutePoint(2,.15),killY:-18,sky:'night',keepPlayFog:true,cameraAirLift:.35,
  atmosphere:{fogEnabled:true,fogNear:46,fogFar:175,fogColor:'#19132b',backdrop:'fog',ambientSky:'#c7bbdf',ambientGround:'#526071',ambientIntensity:1.15,sunColor:'#dcd3ff',sunIntensity:.52,fillColor:'#91d9b2',fillIntensity:.38,drawDistance:245,shadowStrength:.48},
  medalTimes:{gold:310,silver:405,bronze:530},components:C,groups,
};
