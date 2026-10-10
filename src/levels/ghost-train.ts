import type {CustomComponent, CustomGroup, CustomLevelData} from '../level';
import {GhostArt, type GhostPoint} from './ghost-train-art';
import {addGhostTrainShowScenes} from './ghost-train-show-scenes';
import {addDerelictGhostScenes} from './ghost-train-derelict';

/** A 2.3 km dark ride built as close staged chambers, with genuine elevation. */
export const GHOST_TRAIN_END=2250;
const C:CustomComponent[]=[],groups:CustomGroup[]=[{id:1,nm:'Indoor ride camera choreography',editorOnly:true}],art=new GhostArt(C,48);
const WALL_PANES:{room:number;a:number;b:number;side:number;spring:number}[]=[];
const P={stone:'#a9bca9',dark:'#596e63',light:'#c0c6a9',floor:'#a4b7a0',iron:'#364c44',steel:'#7d9b86',brass:'#9e8657',red:'#682849',green:'#a1ff57',gold:'#b6b378',wood:'#b6a28b',bone:'#d4d3a5',black:'#081d17'};
type Scalar=number|((s:number)=>number);
const at=(v:Scalar,s:number)=>typeof v==='function'?v(s):v;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const add=(c:CustomComponent)=>C.push(c);
const grid=(p:GhostPoint):GhostPoint=>p.map(v=>Math.round(v*4096)/4096) as GhostPoint;
const mix=(a:number,b:number,t:number)=>a+(b-a)*clamp(t);
const smooth=(a:number,b:number,s:number)=>{const t=clamp((s-a)/(b-a));return t*t*(3-2*t);};

const X:[number,number][]=[[0,0],[46,0],[75,-9],[146,-9],[195,5],[242,5],[280,15],[320,15],[354,-3],[399,-3],[443,8],[513,8],[546,-5],[578,-5],[616,4],[653,4],[691,-5],[732,-5],[766,7],[835,7],[872,-7],[909,-7],[944,8],[976,8],[1000,0],[1060,0],[1100,8],[1138,-8],[1223,-8],[1265,8],[1370,8],[1410,-6],[1454,-6],[1496,2],[1543,2],[1587,-5],[1630,-5],[1690,8],[1740,8],[1794,0],[1874,0],[1910,-8],[1964,-8],[2001,4],[2042,4],[2087,-5],[2130,-5],[2170,0],[2290,0]];
const Y:[number,number][]=[[-30,0],[146,0],[220,-2],[285,-2],[346,2],[601,2],[615,3.4],[671,3.4],[685,2],[746,2],[826,6],[1102,6],[1152,2],[1228,2],[1290,-4],[1409,-4],[1450,-4],[1586,-2],[1695,-2],[1787,10],[1968,10],[2038,8],[2290,8]];
function interpolate(knots:[number,number][],s:number):number{
  if(s<=knots[0][0])return knots[0][1];
  for(let i=1;i<knots.length;i++)if(s<=knots[i][0])return mix(knots[i-1][1],knots[i][1],smooth(knots[i-1][0],knots[i][0],s));
  return knots[knots.length-1][1];
}
export const ghostRouteX=(s:number)=>interpolate(X,s);
export const ghostRouteHeight=(s:number)=>interpolate(Y,s);
export const routeHeight=ghostRouteHeight;
export function ghostRouteTangent(s:number):GhostPoint{const dx=(ghostRouteX(s+.025)-ghostRouteX(s-.025))/.05,n=Math.hypot(dx,1);return[dx/n,0,-1/n];}
export function ghostRoutePoint(s:number,y=ghostRouteHeight(s),u=0):GhostPoint{const [x,,z]=ghostRouteTangent(s);return grid([ghostRouteX(s)-z*u,y,18-s+x*u]);}
export const ghostRouteYaw=(s:number)=>{const [x,,z]=ghostRouteTangent(s);return-Math.atan2(x,-z)*180/Math.PI;};
export function ghostRouteProgress(p:GhostPoint|{x:number;y:number;z:number}):number{
  const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z,base=18-z;let s=base;
  for(let i=0;i<5;i++){
    const derivative=(ghostRouteX(s+.025)-ghostRouteX(s-.025))/.05,curvature=(ghostRouteX(s+.05)-2*ghostRouteX(s)+ghostRouteX(s-.05))/.0025;
    const step=((ghostRouteX(s)-x)*derivative+s-base)/Math.max(.25,1+derivative*derivative+(ghostRouteX(s)-x)*curvature);
    s-=Math.max(-4,Math.min(4,step));
  }
  return s;
}
export const routeProgress=ghostRouteProgress;
export const GHOST_TRAIN_ROUTE=Array.from({length:575},(_,i)=>{const s=-20+i*4;return{s,p:ghostRoutePoint(s),yaw:ghostRouteYaw(s)};});
export const GHOST_TRAIN_SECTIONS=[
  {name:'01 · Last Departure',a:-20,b:230,theme:'station'},{name:'02 · Execution Gallery',a:230,b:510,theme:'axes'},
  {name:'03 · Feast of the Uninvited',a:510,b:830,theme:'banquet'},{name:'04 · Iron Procession',a:830,b:1100,theme:'armour'},
  {name:'05 · Phantom Freight',a:1100,b:1390,theme:'freight'},{name:'06 · Track of the Forgotten',a:1390,b:1680,theme:'crypt'},
  {name:'07 · Black Clockworks',a:1680,b:1960,theme:'machinery'},{name:'08 · Emerald Throne',a:1960,b:2290,theme:'throne'},
].map((d,i)=>({...d,grp:10+i,start:ghostRoutePoint(d.a),end:ghostRoutePoint(d.b)}));
for(const d of GHOST_TRAIN_SECTIONS)groups.push({id:d.grp,nm:d.name,editorOnly:true});
const district=(s:number)=>GHOST_TRAIN_SECTIONS.find(d=>s>=d.a&&s<d.b)??GHOST_TRAIN_SECTIONS[7];
export const GHOST_TRAIN_ROOMS=[
 ['Ticket vestibule',-20,68,8.8,8.8,'vault'],['Last departure platform',68,104,8.8,10,'timber'],['Monster gate and execution court',104,148,14.2,13,'hero'],['Under the castle',148,230,7,7.8,'flat'],
 ['Headsman arcade',230,322,7.5,8.6,'vault'],['Shattered flagstones',322,412,8.2,9.2,'flat'],['Crimson blade court',412,510,9,10,'ribbed'],
 ['The butler door',510,575,8,9,'vault'],['Banquet of the uninvited',575,627,22,15.5,'hero'],['Raised serving gallery',627,722,8.5,9.2,'timber'],['Scullery and serving stair',722,830,8,8.5,'timber'],
 ['Armour vestibule',830,910,8,9,'flat'],['Hall of false mirrors',910,995,11,11.5,'ribbed'],['The ruined drawbridge',995,1100,9,12,'vault'],
 ['Freight descent',1100,1160,7.5,8,'timber'],['Phantom transfer depot',1160,1260,9.5,10,'flat'],['Funeral carriage shed',1260,1390,9.5,11,'timber'],
 ['Narrow crypt entry',1390,1450,7.8,8,'vault'],['The hanging railway abyss',1450,1502,21,16,'hero'],['Upper tomb bridges',1502,1548,13.2,18,'ribbed'],['Emerald maw vault',1548,1588,17,15,'hero'],['Tomb of the watchman',1588,1680,7.8,8.6,'vault'],
 ['Clockwork gearing hall',1680,1770,8.5,11,'timber'],['Counterweight balcony',1770,1875,12.4,12,'ribbed'],['Behind the clock face',1875,1960,8,10,'flat'],
 ['Throne antechamber',1960,2040,8.5,10.5,'vault'],['The emerald court',2040,2160,21,16,'hero'],['Last shattered vault',2160,2290,9.8,11,'ribbed'],
].map(([name,a,b,width,ceiling,style],i)=>({name:name as string,a:a as number,b:b as number,width:width as number,ceiling:ceiling as number,style:style as string,grp:district(a as number).grp,id:i}));
const roomAt=(s:number)=>GHOST_TRAIN_ROOMS.find(r=>s>=r.a&&s<r.b)??GHOST_TRAIN_ROOMS[GHOST_TRAIN_ROOMS.length-1];
const roomWidth=(room:Pick<typeof GHOST_TRAIN_ROOMS[number],'a'|'b'|'width'|'style'>,s:number)=>{
  if(room.style!=='hero')return room.width;
  const t=clamp((s-room.a)/(room.b-room.a)),edge=Math.min(1,t/.24,(1-t)/.24);
  return room.width*(.60+.40*edge);
};
export const GHOST_TRAIN_WALL_OPENINGS:{room:number;a:number;b:number;side:number;bottom:number;top:number;name:string}[]=[];
export const GHOST_TRAIN_PREVIEW_POINTS=[
  {id:'station',name:'Last departure train boarding',roomId:1,s:74,u:0},
  {id:'axes',name:'Headsman arcade',roomId:3,s:279,u:0},
  {id:'banquet',name:'Feast of the uninvited',roomId:7,s:586,u:0},
  {id:'armour',name:'The iron procession',roomId:10,s:935,u:0},
  {id:'freight',name:'Phantom transfer depot',roomId:13,s:1164,u:0},
  {id:'crypt',name:'The hanging railway abyss',roomId:16,s:1440,u:0},
  {id:'machinery',name:'Counterweight balcony',roomId:19,s:1825,u:0},
  {id:'throne',name:'Emerald throne arrival',roomId:23,s:2238,u:0},
].map(p=>({...p,roomId:roomAt(p.s).id,y:ghostRouteHeight(p.s)+.12,previewPoint:ghostRoutePoint(p.s,ghostRouteHeight(p.s)+.12,p.u),heading:ghostRouteTangent(p.s),lookAhead:10}));
type MeshyScenery='ghostwallbay'|'ghostbanquettable'|'ghostchandelier'|'ghosttrestle'|'ghostmonsterportal'|'ghostflagstone';
const SCENE_SIZE:Record<MeshyScenery,GhostPoint>={ghostwallbay:[2.717344,5.4,2.395418],ghostbanquettable:[1.66529,1.3,3.40314],ghostchandelier:[4.2,4.14351,4.2],ghosttrestle:[2.14152,1.489338,6],ghostmonsterportal:[9,9,8.842023],ghostflagstone:[2,.080104,1.791042]};
function meshy(kind:MeshyScenery,s:number,u:number,feet:number,size=SCENE_SIZE[kind],yaw=ghostRouteYaw(s),name?:string){add({t:'decor',dkind:kind,p:ghostRoutePoint(s,feet,u),s:size,yaw,solid:false,grp:district(s).grp,nm:name??`Meshy ${kind} staged castle scenery`});}
export interface GhostWaypoint{s:number;p:GhostPoint;kind:'walk'|'cart'|'rail'|'jump'|'checkpoint'|'gate';name?:string;componentIndex?:number}
export const GHOST_TRAIN_WAYPOINTS:GhostWaypoint[]=[],GHOST_TRAIN_CHECKPOINTS:{s:number;p:GhostPoint;name:string}[]=[],GHOST_TRAIN_CARTS:{s:number;p:GhostPoint;component:CustomComponent;relay:number;componentIndex:number}[]=[],GHOST_TRAIN_RAILS:{a:number;b:number;y:number;u:number;points:GhostPoint[]}[]=[],GHOST_TRAIN_GAPS:{a:number;b:number;kind:'cart'|'rail'|'jump';name:string}[]=[],GHOST_TRAIN_AXES:CustomComponent[]=[],GHOST_TRAIN_ENEMIES:CustomComponent[]=[],GHOST_TRAIN_FLOORS:{a:number;b:number;width:number;top:Scalar;offset:number}[]=[];
function waypoint(s:number,kind:GhostWaypoint['kind'],y=ghostRouteHeight(s),u=0,name?:string,componentIndex?:number){GHOST_TRAIN_WAYPOINTS.push({s,p:ghostRoutePoint(s,y+.1,u),kind,...(name?{name}:{}),...(componentIndex===undefined?{}:{componentIndex})});}
function showlight(s:number,u:number,height:number,color='#9dff69',targetS=s+7,targetU=0,intensity=62,vr=0){
  const y=ghostRouteHeight(s);add({t:'decor',dkind:'ghostshowlight',p:ghostRoutePoint(s,y+height,u),to:ghostRoutePoint(targetS,ghostRouteHeight(targetS)+1.1,targetU),color,amp:vr===0?Math.max(110,intensity):Math.min(65,intensity),w:.6,rise:32,vr,grp:district(s).grp,nm:'Dark ride theatrical light'});
  art.box(ghostRoutePoint(s,y+height,u),[.24,.4,.3],P.brass,district(s).grp,'Wall sconce brass body',ghostRouteYaw(s));
  art.box(ghostRoutePoint(s,y+height+.1,u),[.14,.24,.14],color,district(s).grp,'Wall sconce lit lantern',ghostRouteYaw(s),color);
}
function checkpoint(s:number,name:string,u=1.65){
  const p=ghostRoutePoint(s,undefined,u);add({t:'checkpoint',p,grp:district(s).grp,nm:name});GHOST_TRAIN_CHECKPOINTS.push({s,p,name});waypoint(s,'checkpoint',p[1],u,name);
  art.box(ghostRoutePoint(s,p[1]+.015),[Math.min(5.8,roomAt(s).width-.8),.03,3],P.brass,district(s).grp,'Safe arrival brass carpet',ghostRouteYaw(s));
  showlight(s,-2.4,4.2,'#89ffc5',s,u,44,1);
}
function floor(a:number,b:number,width=6.2,top:Scalar=ghostRouteHeight,offset=0,tex='castle-bath'){
  GHOST_TRAIN_FLOORS.push({a,b,width,top,offset});
  for(let from=a;from<b;from+=40){
    const to=Math.min(b,from+40),n=Math.max(1,Math.ceil((to-from)/4)),origin=ghostRoutePoint(from,0),v:number[]=[],ix:number[]=[];
    const face=(q:GhostPoint[])=>{const j=v.length/3;for(const p of q)v.push(...grid([p[0]-origin[0],p[1],p[2]-origin[2]]));for(let k=1;k<q.length-1;k++)ix.push(j,j+k,j+k+1);};
    for(let i=0;i<n;i++){
      const sa=mix(from,to,i/n),sb=mix(from,to,(i+1)/n),l0=ghostRoutePoint(sa,at(top,sa),offset-width/2),r0=ghostRoutePoint(sa,at(top,sa),offset+width/2),l1=ghostRoutePoint(sb,at(top,sb),offset-width/2),r1=ghostRoutePoint(sb,at(top,sb),offset+width/2),down=(p:GhostPoint):GhostPoint=>[p[0],p[1]-1.2,p[2]];
      face([l0,r0,r1,l1]);face([l0,l1,down(l1),down(l0)]);face([r1,r0,down(r0),down(r1)]);
      if(i===0)face([r0,l0,down(l0),down(r0)]);if(i===n-1)face([l1,r1,down(r1),down(l1)]);
    }
    add({t:'mesh',p:origin,vertices:v,indices:ix,tex,color:P.floor,grp:district(from).grp,nm:tex==='castle-timber'?'Supported serving-table runway':'Supported castle paving and ramp'});
  }
}
function pit(a:number,b:number,name:string,kind:'cart'|'rail'|'jump'){
  const width=roomAt((a+b)/2).width+2,y=Math.min(ghostRouteHeight(a),ghostRouteHeight(b))-5,points=[ghostRoutePoint(a,y,-width/2),ghostRoutePoint(b,y,-width/2),ghostRoutePoint(b,y,width/2),ghostRoutePoint(a,y,width/2)],p=points[0];
  add({t:'pit',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2]]),s:[1,1,1],color:P.black,grp:district(a).grp,nm:name});GHOST_TRAIN_GAPS.push({a,b,kind,name});
}
function rail(a:number,b:number,u=0,name='Shattered ghost railway'){
  const n=Math.ceil((b-a)/3),points=Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n);return ghostRoutePoint(s,ghostRouteHeight(s)+.48,u);}),p=points[0];
  add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),grp:district(a).grp,nm:name});GHOST_TRAIN_RAILS.push({a,b,y:p[1],u,points});
  for(let s=a;s<b;s+=12)waypoint(s,'rail',ghostRouteHeight(s)+.48,u,name);
  track(a,b,s=>ghostRouteHeight(s)+.36,true);
  // Broken ends have fallen splinters and bent rail pieces beside the safe tip.
  for(const [s,sign]of [[a,-1],[b,1]])for(const side of [-1,1])art.beam(ghostRoutePoint(s,ghostRouteHeight(s)+.34,side*.76),ghostRoutePoint(s+sign*1.2,ghostRouteHeight(s)-.55,side*1.15),.12,P.iron,district(s).grp,'Bent snapped railway end',.16);
  for(const s of [a+.15,b-.15])for(const side of [-1,1])art.box(ghostRoutePoint(s,ghostRouteHeight(s)+.54,u+side*.76),[.1,.07,.55],'#b1ff98',district(s).grp,'Luminous receiving rail tip',ghostRouteYaw(s),'#83ed65');
}
function track(a:number,b:number,y:Scalar=(s)=>ghostRouteHeight(s)+.045,hanging=false){
  if(hanging){
    for(let from=a;from<b;from+=6){const to=Math.min(b,from+6),s=(from+to)/2,length=to-from;meshy('ghosttrestle',s,0,at(y,s)-.248*length,[.35692*length,.248223*length,length],ghostRouteYaw(s),'Meshy suspended broken railway and skull trestle');}
    return;
  }
  const step=hanging?2.7:5.5;
  for(let s=a;s<b;s+=step){
    const g=district(s).grp,yy=at(y,s);art.box(ghostRoutePoint(s,yy-.13),[2.3,.22,.27],P.wood,g,'Railway sleeper',ghostRouteYaw(s),undefined,'castle-timber');
    for(const side of [-1,1])art.beam(ghostRoutePoint(s,yy,side*.76),ghostRoutePoint(Math.min(b,s+step+.02),at(y,Math.min(b,s+step+.02)),side*.76),.07,P.steel,g,'Polished twin train rails',.11);
    if(hanging&&Math.floor((s-a)/2.7)%3===0){
      const lo=yy-4.8;for(const side of [-1,1]){
        art.beam(ghostRoutePoint(s,lo,side*1.15),ghostRoutePoint(s,yy-.25,side*1.15),.18,P.iron,g,'Hanging railway trestle');
        art.beam(ghostRoutePoint(s,lo,side*1.15),ghostRoutePoint(Math.min(b,s+8.1),at(y,Math.min(b,s+8.1))-.25,side*1.15),.13,P.iron,g,'Suspended track diagonal truss');
      }
      art.beam(ghostRoutePoint(s,lo,-1.15),ghostRoutePoint(s,lo,1.15),.16,P.iron,g,'Track trestle cross brace');
    }
  }
}
function axe(s:number,u=0,phase=0){
  const y=ghostRouteHeight(s),c:CustomComponent={t:'pendulum',dkind:'ghostaxe',p:ghostRoutePoint(s,y+5.8,u),len:4.5,amp:.82,speed:1.35,phase,yaw:ghostRouteYaw(s),grp:district(s).grp,nm:'Close execution axe'};
  add(c);GHOST_TRAIN_AXES.push(c);showlight(s-4,-2.7,4.4,'#bcf281',s,u,85);
}
function enemy(s:number,kind:'ghostknight'|'ghostfood'|'ghostcake',u=0,vr=0,range=1.1){
  const c:CustomComponent={t:'enemy',dkind:kind,p:ghostRoutePoint(s,undefined,u),s:kind==='ghostknight'?[1.3,2.75,1.25]:[1.55,1.6,1.45],foe:kind==='ghostknight'?'grunt':'hopper',range,speed:kind==='ghostknight'?.85:1.05,vr,grp:district(s).grp,nm:kind==='ghostknight'?'Emerald-eyed mechanical armour':'Banquet food animatronic'};
  add(c);GHOST_TRAIN_ENEMIES.push(c);
}
function display(s:number,kind:'ghostknight'|'ghostfood'|'ghostcake',u:number,top:number,height:number,vr=0){add({t:'decor',dkind:kind,p:ghostRoutePoint(s,top,u),s:[height*.65,height,height*.6],vr,yaw:ghostRouteYaw(s)+(u>0?90:-90),grp:district(s).grp,nm:'Close staged haunted castle performer'});}
function cartRelay(a:number,id:number,name:string){
  // Four centimetres of true clearance makes the moving cabin own support
  // where its entry/exit overlaps a stationary loading dock.
  const b=a+33,y=ghostRouteHeight(a)+.04;pit(a,b,`${name} empty track trench`,'cart');track(a-7,b+8,y-1.25,true);
  for(let i=0;i<4;i++){
    const s=a+3.5+i*7.8,c:CustomComponent={t:'mover',dkind:'ghostcart',p:ghostRoutePoint(s,y),s:[3.2,.35,6.2],axis:'z',travelSign:-1,amp:4.5,speed:.62,phase:-Math.PI/2+id*.47,grp:district(a).grp,nm:`${name} · moving carriage ${i+1}`},componentIndex=C.length;
    add(c);GHOST_TRAIN_CARTS.push({s,p:c.p,component:c,relay:id,componentIndex});waypoint(s,'cart',y,0,c.nm,componentIndex);
    if(i<3)waypoint(s+2,'jump',y,0,'Compact carriage transfer');
  }
  waypoint(a-2,'walk',y,0,'Board train');waypoint(b+6,'walk',y,0,'Leave train');
  for(const s of [a-5,b+4])showlight(s,-3.4,4.3,'#9cf66c',s+3,0,85);
}

function solidFurniture(s:number,u:number,_width:number,depth:number,top:number,name:string){
  const base=ghostRouteHeight(s),g=district(s).grp,h=top-base;
  const scale=h/.382,unitW=.489341974*scale,unitD=scale,count=Math.max(1,Math.round(depth/unitD));
  for(let i=0;i<count;i++){
    const station=s+(i-(count-1)/2)*unitD;
    add({t:'platform',p:ghostRoutePoint(station,base+h/2,u),s:[unitW,h,unitD],yaw:ghostRouteYaw(s),invisible:true,tex:'castle-timber',color:P.wood,edgeGrinding:true,grp:g,nm:name});
    meshy('ghostbanquettable',station,u,base,[unitW,h,unitD],ghostRouteYaw(s),name);
  }
  for(const z of [-depth*.28,0,depth*.28]){
    art.ring(ghostRoutePoint(s+z,top+.045,u),.58,.17,P.bone,g,'Golden-rim feast platter',0,false,8);
    art.ring(ghostRoutePoint(s+z,top+.052,u),.7,.06,P.brass,g,'Golden-rim feast platter',0,false,8);
  }
}
function banquet(s:number,u:number,vr=0){
  const y=ghostRouteHeight(s),g=district(s).grp;solidFurniture(s,u,3,6.4,y+1.3,'Solid Meshy carved banquet table');
  display(s,'ghostfood',u,y+1.32,1.55,vr);display(s+2,'ghostcake',u,y+1.32,1.2,vr+1);
  for(const z of [-4,4]){
    const chairU=u+Math.sign(u)*2.0;art.box(ghostRoutePoint(s+z,y+.55,chairU),[.9,.18,.85],P.red,g,'Banquet chair cushion',ghostRouteYaw(s));
    art.box(ghostRoutePoint(s+z,y+1.1,chairU+Math.sign(u)*.42),[.95,1.8,.15],P.wood,g,'High backed feast chair',ghostRouteYaw(s),undefined,'castle-timber');
  }
}
function coffin(s:number,u:number){const y=ghostRouteHeight(s),g=district(s).grp;art.box(ghostRoutePoint(s,y+.45,u),[1.35,.9,2.9],P.dark,g,'Carved stone sarcophagus',ghostRouteYaw(s),undefined,'castle-stone');art.box(ghostRoutePoint(s,y+.97,u),[1.5,.2,3.05],P.light,g,'Sarcophagus lid',ghostRouteYaw(s),undefined,'castle-stone');art.box(ghostRoutePoint(s,y+1.09,u),[.15,.04,2.1],P.brass,g,'Sarcophagus gold inlay',ghostRouteYaw(s));}
function chandelier(s:number,radius:number){const room=roomAt(s),base=ghostRouteHeight(s),y=base+(room.style==='hero'?4.6:room.ceiling-3.7),g=district(s).grp,width=radius*2;meshy('ghostchandelier',s,0,y,[width,width*.98655,width]);art.beam(ghostRoutePoint(s,y+width*.98655),ghostRoutePoint(s,base+room.ceiling),.05,P.iron,g,'Chandelier suspension chain');}

function doorway(s:number,width:number,height:number,g:number){
  const y=ghostRouteHeight(s),opening=Math.min(5.8,width-1),yaw=ghostRouteYaw(s),panel=(width-opening)/2;
  if(panel>.1)for(const side of [-1,1])add({t:'wall',p:ghostRoutePoint(s,y-.6,side*(opening+panel)/2),s:[panel,height+.6,1.2],yaw,tex:'castle-stone',color:P.dark,edgeGrinding:false,grp:g,nm:'Solid reveal doorway wing'});
  add({t:'wall',p:ghostRoutePoint(s,y+6.7),s:[opening,height-6.7,1.2],yaw,tex:'castle-stone',color:P.dark,edgeGrinding:false,grp:g,nm:'Solid reveal doorway lintel'});
  // The deep decorative arch used to enclose the following camera. Real
  // masonry now frames the clear route; sculpted alcoves sit beside it.
  showlight(s-3,-opening*.48,4.7,'#9cf66c',s+3,0,72);
}
function chamber(room:typeof GHOST_TRAIN_ROOMS[number]){
  const {a,b,width:w,ceiling:h,grp:g,style,id}=room;
  for(const side of [-1,1]){
    const n=Math.ceil((b-a)/8),knots=Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n);return ghostRoutePoint(s,ghostRouteHeight(s)-6,side*(roomWidth(room,s)/2-.2));}),p=knots[0];
    add({t:'wallpath',p,pts:knots.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w:.4,rise:h+6,containment:true,invisible:true,edgeGrinding:false,grp:g,nm:'Close enclosing chamber boundary'});
  }
  for(let s=a;s<b;s+=12){
    const next=Math.min(b,s+12),spring=style==='flat'||style==='timber'?h:h*.7;
    for(const side of [-1,1]){
      WALL_PANES.push({room:id,a:s,b:next,side,spring});
      const mid=(s+next)/2;art.box(ghostRoutePoint(mid,ghostRouteHeight(mid)+.9,side*(roomWidth(room,mid)/2-.12)),[.24,.18,next-s+.12],P.light,g,'Carved stone dado',ghostRouteYaw(mid),undefined,'castle-stone');
      if(style!=='flat')art.box(ghostRoutePoint(mid,ghostRouteHeight(mid)+spring-.08,side*(roomWidth(room,mid)/2-.14)),[.32,.23,next-s+.12],P.light,g,'Vault spring stone moulding',ghostRouteYaw(mid),undefined,'castle-stone');
    }
    const crown=style==='flat'||style==='timber'?[[-.5,h],[.5,h]]:[[-.5,spring],[-.28,h*.94],[0,h],[.28,h*.94],[.5,spring]];
    for(let k=0;k<crown.length-1;k++)art.face([ghostRoutePoint(s,ghostRouteHeight(s)+crown[k][1],roomWidth(room,s)*crown[k][0]),ghostRoutePoint(next,ghostRouteHeight(next)+crown[k][1],roomWidth(room,next)*crown[k][0]),ghostRoutePoint(next,ghostRouteHeight(next)+crown[k+1][1],roomWidth(room,next)*crown[k+1][0]),ghostRoutePoint(s,ghostRouteHeight(s)+crown[k+1][1],roomWidth(room,s)*crown[k+1][0])],P.dark,g,'Enclosed chamber ceiling',undefined,style==='timber'?'castle-timber':'castle-stone');
  }
  const rhythm=style==='hero'?18:style==='ribbed'?12:22;
  for(let s=a+8;s<b-5;s+=rhythm){
    const y=ghostRouteHeight(s),spring=style==='flat'||style==='timber'?h:h*.7,span=roomWidth(room,s);
    for(const side of [-1,1]){
      art.box(ghostRoutePoint(s,y+spring/2,side*(span/2-.25)),[.6,spring,.72],P.light,g,'Distinct chamber buttress',ghostRouteYaw(s),undefined,'castle-stone');
      art.box(ghostRoutePoint(s,y+.3,side*(span/2-.25)),[1,.6,1.15],P.dark,g,'Buttress plinth',ghostRouteYaw(s),undefined,'castle-stone');
      if((id+Math.floor(s/rhythm))%2===0){
        const u=side*(span/2-.27);art.face([ghostRoutePoint(s+2,y+5.4,u),ghostRoutePoint(s+3.9,y+5.4,u),ghostRoutePoint(s+3.9,y+2.55,u),ghostRoutePoint(s+3,y+1.95,u),ghostRoutePoint(s+2,y+2.55,u)],P.red,g,'Close crimson heraldic pennant');
      }
    }
    if(style==='timber')art.beam(ghostRoutePoint(s,y+h-.25,-span/2),ghostRoutePoint(s,y+h-.25,span/2),.32,P.wood,g,'Heavy oak service ceiling beam',.4,'castle-timber');
    else if(style==='ribbed'||style==='hero'){
      for(const side of [-1,1])art.beam(ghostRoutePoint(s,y+spring,side*span/2),ghostRoutePoint(s,y+h,0),.25,P.light,g,'Pointed carved vault rib',.3,'castle-stone');
    }
  }
  if(style!=='hero'&&id%3===0)chandelier((a+b)/2,1.0);
  if(style!=='hero')for(let s=a+10;s<b-7;s+=27)for(const side of [-1,1])if((Math.floor((s-a)/27)+id+(side<0?0:1))%3!==0)meshy('ghostwallbay',s,side*(roomWidth(room,s)/2+.8),ghostRouteHeight(s)+.05,SCENE_SIZE.ghostwallbay,ghostRouteYaw(s)+(side<0?90:-90),'Meshy inset carved window and door bay');
  if([2,3,4,9,11,15,17,20,23].includes(id)){
    const s=a+12,y=ghostRouteHeight(s)+h-.8,u=roomWidth(room,s)/2-.5,anchor=ghostRoutePoint(s,y,u);
    const ends=[ghostRoutePoint(s+3,y,u),ghostRoutePoint(s+2,y-1.8,u),ghostRoutePoint(s,y-2.5,u)];
    for(const end of ends)art.beam(anchor,end,.017,P.bone,g,'Cobweb corner radial silk');
    for(const t of [.35,.7])for(let k=0;k<2;k++){
      const q=(end:GhostPoint):GhostPoint=>end.map((v,j)=>anchor[j]+(v-anchor[j])*t) as GhostPoint;
      art.beam(q(ends[k]),q(ends[k+1]),.012,P.bone,g,'Cobweb corner cross silk');
    }
  }
  // Every room has an arrival and a mid-room key, matched to actual fixtures.
  showlight(a+14,-Math.min(3.7,w/2-.3),4.7,id%4===1?'#94f9bd':'#9cf66c',a+22,0,style==='hero'?98:68,id%4===1?1:0);
  showlight(b-18,Math.min(3.7,w/2-.3),4.4,'#bc9cff',b-7,0,42,2);
  if(id>0)doorway(a+2,roomWidth(room,a+2),h,g);
  const mid=(a+b)/2,fy=ghostRouteHeight(mid),high=/hanging railway|tomb bridges|maw vault|departure|freight|carriage|counterweight|shattered/i.test(room.name);
  add({t:'camnode',p:ghostRoutePoint(mid,fy+3),s:[w+4,32,b-a+12],yaw:ghostRouteYaw(mid),cameraView:true,radius:5,
    cameraPosition:ghostRoutePoint(mid-6,fy+(high?7.1:6.1)),cameraTarget:ghostRoutePoint(mid+9,fy+2.2),cameraFollowDistance:high?7:6.4,cameraFollowTargetHeight:high?1.8:2,cameraFov:64,grp:1,nm:`Camera · ${room.name}`});
}

// Four compact coupled convoys. Straight centerlines make cabin-scale jumps
// fair; doorways and switchbacks on either side provide the spatial variety.
const relaySpecs=[{a:82,id:0,name:'Last Departure'},{a:1168,id:1,name:'Phantom Freight'},{a:1310,id:2,name:'Funeral Freight'},{a:1835,id:3,name:'Counterweight Escape'}];
const hopSpecs:[[number,number],...[number,number][]]=[[38,40.6],[155,158],[213,215.7],[306,308.8],[353,356.2],[373,376.2],[439,442],[462,465.2],[618,621],[637,639.2],[761,764],[923,926],[1114,1117],[1269,1272],[1399,1402],[1637,1640],[1747,1750],[1938,1941],[2063,2066],[2110,2113]];
const exclusions=[...relaySpecs.map(r=>({a:r.a,b:r.a+33,kind:'cart' as const})),...hopSpecs.map(([a,b])=>({a,b,kind:'jump' as const})),{a:1008,b:1042,kind:'rail' as const},{a:1442,b:1580,kind:'rail' as const},{a:2180,b:2214,kind:'rail' as const}].sort((a,b)=>a.a-b.a);
for(const room of GHOST_TRAIN_ROOMS){
  let cursor=room.a;const width=room.width-.8;
  for(const e of exclusions){if(e.b<=cursor||e.a>=room.b)continue;if(e.a>cursor)floor(cursor,Math.min(e.a,room.b),width);cursor=Math.max(cursor,e.b);}
  if(cursor<room.b)floor(cursor,room.b,width);
  chamber(room);
}
// Transverse masonry closes changes in vault height and room width. The
// pointed Meshy entrances sit inside a genuine supported passage opening.
for(let i=0;i<GHOST_TRAIN_ROOMS.length-1;i++){
  const from=GHOST_TRAIN_ROOMS[i],to=GHOST_TRAIN_ROOMS[i+1],s=from.b,y=ghostRouteHeight(s),span=Math.max(roomWidth(from,s),roomWidth(to,s)),h=Math.max(from.ceiling,to.ceiling),opening=Math.min(5.8,roomWidth(from,s)-.5,roomWidth(to,s)-.5),head=6.7,panel=(span-opening)/2,yaw=ghostRouteYaw(s),g=to.grp;
  for(const side of [-1,1])if(panel>.01)add({t:'wall',p:ghostRoutePoint(s,y-6,side*(opening+panel)/2),s:[panel,h+6,.6],yaw,tex:'castle-stone',color:P.stone,edgeGrinding:false,grp:g,nm:'Closed chamber transition masonry'});
  add({t:'wall',p:ghostRoutePoint(s,y+head),s:[opening,h-head,.6],yaw,tex:'castle-stone',color:P.stone,edgeGrinding:false,grp:g,nm:'Closed vault transition above passage'});
}
for(const r of relaySpecs)cartRelay(r.a,r.id,r.name);
for(const e of exclusions.filter(e=>e.kind==='jump')){pit(e.a,e.b,e.a===637?'Broken serving table':'Collapsed bathhouse crossing','jump');waypoint(e.a-1.5,'jump');waypoint(e.b+2,'walk');}
pit(1008,1042,'Ruined armour drawbridge','rail');rail(998,1024,0,'Drawbridge departure rail');rail(1026.4,1052,0,'Drawbridge receiving rail');waypoint(1022.5,'jump',ghostRouteHeight(1022.5)+.48);
pit(1442,1580,'Hanging crypt railway abyss','rail');rail(1432,1480,0,'Hanging railway · outgoing');rail(1482.4,1527,0,'Hanging railway · middle');rail(1529.4,1590,0,'Hanging railway · receiving');for(const s of [1478.2,1525.2])waypoint(s,'jump',ghostRouteHeight(s)+.48);
pit(2180,2214,'Last shattered vault track','rail');rail(2170,2194,0,'Last vault · outgoing');rail(2196.4,2224,0,'Last vault · receiving');waypoint(2192.2,'jump',ghostRouteHeight(2192.2)+.48);
// Optional elevated lines carry momentum across the short hopping routes.
// These are native grind rails, with fruit tracing the choice into the haze.
export const GHOST_TRAIN_BONUS_LINES=[{a:338,b:389,u:-2.4},{a:747,b:801,u:-2.4}];
for(const route of GHOST_TRAIN_BONUS_LINES){
  const points=Array.from({length:19},(_,i)=>{const t=i/18,s=mix(route.a,route.b,t);return ghostRoutePoint(s,ghostRouteHeight(s)+.65+Math.sin(t*Math.PI)*.7,route.u);}),p=points[0];
  add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),color:'#87dfab',grp:district(route.a).grp,nm:'Optional momentum line over the broken baths'});
  for(let i=1;i<points.length-1;i+=3)add({t:'wumpa',p:[points[i][0],points[i][1]+.65,points[i][2]],grp:district(route.a).grp,nm:'High grind-line fruit'});
}
for(const f of GHOST_TRAIN_FLOORS){if(f.b-f.a>6)track(f.a,f.b);}

add({t:'clock',p:ghostRoutePoint(8,undefined,2.1),grp:10});add({t:'crate',p:ghostRoutePoint(26,undefined,-1.9),kind:'mask',grp:10,nm:'Boarding safety mask'});
for(const s of [28,52,123,137]){const y=ghostRouteHeight(s);art.box(ghostRoutePoint(s,y+.5,2.7),[.9,1,3.2],P.red,10,'Station velvet waiting bench',ghostRouteYaw(s));art.box(ghostRoutePoint(s,y+2.8,-3.3),[.25,2.3,3.4],P.brass,10,'Ticket window brass grille',ghostRouteYaw(s));}
for(const [i,s]of [137,176,246,287,404,495,507,1720,1781,1918].entries())axe(s,i%3===0?.65:i%3===1?-.65:0,i*.84);
for(const s of [694,712])for(const side of [-1,1])banquet(s,side*2.9,Math.floor(s)%3);
for(const [i,s]of [550,587,672,725].entries())enemy(s,i%2?'ghostcake':'ghostfood',i%2?2.35:-2.35,i,.65);
// A real rising gallery hands the feast theatre into the service passage.
for(const [i,s]of [855,888,954,973,1073,1617,1672,1988,2099,2144].entries())enemy(s,'ghostknight',i%2?2.15:-2.15,0,.65);
for(const s of [847,898,927,966,1081,1977,2026])for(const side of [-1,1]){
  const u=side*(roomAt(s).width/2-1.05),y=ghostRouteHeight(s);art.box(ghostRoutePoint(s,y+.18,u),[1.25,.36,1.35],P.dark,district(s).grp,'Armour alcove carved plinth',ghostRouteYaw(s),undefined,'castle-stone');display(s,'ghostknight',u,y+.36,2.5);showlight(s-2,u,3.8,'#82f8ad',s,u,45,1);
}
for(const s of [1402,1425,1598,1628,1663])for(const side of [-1,1])coffin(s,side*2.7);
for(const s of [1472,1514,1559])for(const side of [-1,1]){
  const g=district(s).grp,y=ghostRouteHeight(s);art.box(ghostRoutePoint(s,y-3,side*5.3),[1.6,10,2],P.dark,g,'Abyss ruined masonry pier',ghostRouteYaw(s),undefined,'castle-stone');
  showlight(s,side*4.3,2.3,'#74e9b4',s+7,0,78,1);
}
for(const s of [1705,1745,1804,1885,1940])add({t:'decor',dkind:'ghostclockwork',p:ghostRoutePoint(s,undefined,s%2?2.8:-2.8),w:3.2,s:[2.962,3.2,2.929],yaw:ghostRouteYaw(s),grp:16,nm:'Meshy castle drive and counterweight mechanism'});
add({t:'decor',dkind:'ghostclockwork',p:ghostRoutePoint(1831,undefined,-3.8),s:[4.2579,4.6,4.2109],w:4.6,yaw:ghostRouteYaw(1831),grp:16,nm:'Meshy clockwork counterweight tableau'});
showlight(1827,2.8,5.3,'#9cf66c',1831,-3.8,136);showlight(1835,-4.8,4.4,'#b06edf',1831,-3.8,62,2);
for(const s of [2054,2086,2120])banquet(s,4.9,0);enemy(2048,'ghostcake',-2.35,2,.65);
for(const side of [-1,1]){
  const y=ghostRouteHeight(2255),u=side*3.2;art.box(ghostRoutePoint(2255,y+2.8,u),[1.1,5.6,1.4],P.brass,17,'Emerald throne herald pillars',ghostRouteYaw(2255));display(2255,'ghostknight',u,y,2.95);
}
art.box(ghostRoutePoint(2267,9.0),[5.2,2,3.5],P.dark,17,'Throne dais',ghostRouteYaw(2267),undefined,'castle-stone');art.box(ghostRoutePoint(2268,12.0),[3.0,4.2,.7],P.red,17,'Crimson royal throne back',ghostRouteYaw(2268));art.box(ghostRoutePoint(2267,10.1),[3.0,.45,2.2],P.brass,17,'Brass throne seat',ghostRouteYaw(2267));
for(const [s,name,u]of [[54,'Bathhouse boarding',1.3],[130,'Last Departure',1.2],[183,'First steam hall',1.4],[223,'Under the castle',1.5],[331,'Execution flags',1.65],[482,'Flagstone crossings complete',1.65],[515,'Service entrance',1.4],[560,'Butler entrance',1.55],[705,'Banquet runway cleared',1.6],[817,'Serving stair complete',1.5],[983,'Armour procession',1.6],[1060,'Drawbridge cleared',1.5],[1085,'Freight boarding',1.4],[1210,'Freight transfer island',1.5],[1283,'Lower train platform',1.4],[1351,'Funeral train cleared',1.5],[1380,'Steam crypt entry',1.4],[1598,'Hanging railway complete',1.5],[1690,'Clockworks entrance',1.5],[1880,'High convoy complete',1.5],[1955,'Boiler room cleared',1.4],[2019,'Throne antechamber',1.5],[2157,'Last vault departure',1.5]] as [number,string,number][])checkpoint(s,name,u);
add({t:'gate',p:ghostRoutePoint(2250),yaw:ghostRouteYaw(2250),grp:17,nm:'Emerald throne ghost train finish'});waypoint(2250,'gate');
add({t:'crystal',p:ghostRoutePoint(699,ghostRouteHeight(699)+1.2,-2.3),grp:12,nm:'The uninvited guest reward'});
for(let s=34;s<2240;s+=22){if(GHOST_TRAIN_GAPS.some(g=>s>g.a-4&&s<g.b+4))continue;add({t:'wumpa',p:ghostRoutePoint(s,ghostRouteHeight(s)+1.05),grp:district(s).grp});}
addGhostTrainShowScenes(C,{point:ghostRoutePoint,height:ghostRouteHeight,yaw:ghostRouteYaw,rooms:GHOST_TRAIN_ROOMS});
addDerelictGhostScenes(C,{point:ghostRoutePoint,height:ghostRouteHeight,yaw:ghostRouteYaw,rooms:GHOST_TRAIN_ROOMS,widthAt:roomWidth,gaps:GHOST_TRAIN_GAPS,bonusLines:GHOST_TRAIN_BONUS_LINES});
// Match the solid faces to the actual, uniformly scaled Meshy sculptures.
// The measured monster-mouth rectangle is conservative and remains passable.
for(const c of [...C]){
  if(c.t==='platform'&&c.nm==='Supported raised feast dais'){c.invisible=false;c.tex='castle-stone';c.color='#e1d4be';}
  if(c.t!=='decor')continue;
  if(c.dkind==='ghostwallbay'){
    const scale=c.w??c.s?.[1]??5.4;
    add({t:'wall',p:[...c.p],s:[.503211975*scale,scale,.443596005*scale],yaw:c.yaw??0,invisible:true,edgeGrinding:false,grp:c.grp,nm:'Measured Meshy window-bay collision'});
    const s=ghostRouteProgress(c.p),r=roomAt(s),centre=ghostRoutePoint(s),t=ghostRouteTangent(s),cross=(c.p[0]-centre[0])*-t[2]+(c.p[2]-centre[2])*t[0],side=Math.sign(cross)||1;
    GHOST_TRAIN_WALL_OPENINGS.push({room:r.id,a:Math.max(r.a,s-1.1),b:Math.min(r.b,s+1.1),side,bottom:c.p[1]+.85,top:c.p[1]+scale-.4,name:c.nm??'Meshy leadlight recess'});
  }
  if(c.dkind==='ghostmonsterportal'){
    const scale=c.w??c.s?.[1]??9,opening=.37378*scale,clearance=.49706*scale,depth=.982447028*scale,panel=(scale-opening)/2,a=(c.yaw??0)*Math.PI/180;
    for(const side of [-1,1]){
      const x=side*(opening+panel)/2;
      add({t:'wall',p:[c.p[0]+x*Math.cos(a),c.p[1],c.p[2]-x*Math.sin(a)],s:[panel,scale,depth],yaw:c.yaw??0,invisible:true,edgeGrinding:false,grp:c.grp,nm:'Measured monster-mouth side collision'});
    }
    add({t:'wall',p:[c.p[0],c.p[1]+clearance,c.p[2]],s:[opening,scale-clearance,depth],yaw:c.yaw??0,invisible:true,edgeGrinding:false,grp:c.grp,nm:'Measured monster-mouth arch collision'});
  }
}
// Cut the render wall in front of the genuine recessed Meshy leadlight.
// Five stone recess faces seal every opening behind it, even at grazing views;
// the continuous invisible containment boundary still owns collision.
for(const pane of WALL_PANES){
  const r=GHOST_TRAIN_ROOMS[pane.room],openings=GHOST_TRAIN_WALL_OPENINGS.filter(o=>o.room===pane.room&&o.side===pane.side&&o.b>pane.a&&o.a<pane.b),cuts=[pane.a,pane.b,...openings.flatMap(o=>[Math.max(pane.a,o.a),Math.min(pane.b,o.b)])].sort((a,b)=>a-b);
  const edge=(s:number,y:number,extra=0)=>ghostRoutePoint(s,y,pane.side*(roomWidth(r,s)/2+extra));
  const band=(a:number,b:number,lo:(s:number)=>number,hi:(s:number)=>number)=>{if(hi((a+b)/2)-lo((a+b)/2)<.002)return;art.face([edge(a,lo(a)),edge(b,lo(b)),edge(b,hi(b)),edge(a,hi(a))],P.stone,r.grp,'Castle stone wall around real leadlight',undefined,'castle-stone');};
  for(let i=1;i<cuts.length;i++){
    const a=cuts[i-1],b=cuts[i];if(b-a<.001)continue;const mid=(a+b)/2,base=(s:number)=>ghostRouteHeight(s)-6,top=(s:number)=>ghostRouteHeight(s)+pane.spring,holes=openings.filter(o=>mid>o.a-.001&&mid<o.b+.001).sort((x,y)=>x.bottom-y.bottom);let low=base;
    for(const hole of holes){const bottom=(s:number)=>Math.max(base(s),hole.bottom),upper=(s:number)=>Math.min(top(s),hole.top);band(a,b,low,bottom);low=upper;}
    band(a,b,low,top);
  }
}
for(const opening of GHOST_TRAIN_WALL_OPENINGS){
  const r=GHOST_TRAIN_ROOMS[opening.room],{a,b,side,bottom:y0,top:y1}=opening,depth=2.6;
  const p=(s:number,y:number,extra:number)=>ghostRoutePoint(s,y,side*(roomWidth(r,s)/2+extra));
  const front=[p(a,y0,0),p(b,y0,0),p(b,y1,0),p(a,y1,0)],back=[p(a,y0,depth),p(b,y0,depth),p(b,y1,depth),p(a,y1,depth)];
  art.face(back,P.dark,r.grp,'Sealed leadlight niche back wall',undefined,'castle-stone');
  for(const [i,j]of [[0,1],[1,2],[2,3],[3,0]])art.face([front[i],front[j],back[j],back[i]],P.dark,r.grp,'Carved leadlight recess jamb',undefined,'castle-stone');
}
// Actual Meshy pavers cover the supported foreground surfaces of the reveals.
// Native continuous paving supplies collision beneath their irregular seams.
for(const f of GHOST_TRAIN_FLOORS){
  const r=roomAt((f.a+f.b)/2);if(r.name!=='Last shattered vault')continue;
  for(let s=f.a+1;s<f.b-.9;s+=1.84){
    if(Math.abs(ghostRouteHeight(s+1)-ghostRouteHeight(s-1))>.06)continue;
    for(const u of [-2,0,2]){if(Math.abs(u)+1>f.width/2)continue;meshy('ghostflagstone',s,u,ghostRouteHeight(s)-.080104,SCENE_SIZE.ghostflagstone,ghostRouteYaw(s),'Meshy irregular flagstones at native feet height');}
  }
}
art.finish();
for(let s=-30;s<=2295;s+=5)add({t:'camnode',p:ghostRoutePoint(s),radius:5,grp:1,nm:'Ordered close castle camera lane'});
for(let s=0;s<2250;s+=12)if(!GHOST_TRAIN_GAPS.some(g=>s>g.a-2&&s<g.b+2))waypoint(s,'walk');GHOST_TRAIN_WAYPOINTS.sort((a,b)=>a.s-b.s);
export const GHOST_TRAIN_LEVEL:CustomLevelData={v:1,name:'Haunted Castle · Ghost Train',spawn:ghostRoutePoint(2,.15),killY:-25,sky:'night',keepPlayFog:true,cameraAirLift:.28,
  atmosphere:{fogEnabled:true,fogNear:13,fogFar:74,fogColor:'#0d3426',backdrop:'fog',ambientSky:'#a6cdb0',ambientGround:'#314a38',ambientIntensity:.39,sunColor:'#a5dab0',sunIntensity:.07,fillColor:'#5aa889',fillIntensity:.13,drawDistance:130,shadowStrength:.7},
  medalTimes:{gold:340,silver:430,bronze:560},components:C,groups};
