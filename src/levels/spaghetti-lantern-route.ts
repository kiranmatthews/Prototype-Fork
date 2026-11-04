import {CONST,TUNING} from '../tuning';
import {lanternClearancePath} from './spaghetti-lantern-clearance';
import type {CustomComponent,CustomLevelData} from '../level';
import {spaghettiRail,spaghettiSamples,type P,type SpaghettiIsland} from './spaghetti-infinite-course';

export interface LanternRouteStop extends SpaghettiIsland {chapter:number;}
export interface LanternRouteLeg {
 name:string;kind:'walk'|'jump'|'rail'|'spring';from:LanternRouteStop;to:LanternRouteStop;
 points:P[];rail?:string;reverse?:boolean;spring?:string;
}
const distance=(a:P,b:P)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const mix=(a:P,b:P,t:number):P=>a.map((v,i)=>v+(b[i]-v)*t) as P;

/** A single collectible itinerary through the original six-storey maze.
 * The architecture and its unmarked alternative rails remain intact. Only
 * three approach/return connections per excursion need new rail spans;
 * there is no new walkway, and no recovery island is moved to fit the route. */
export function buildLanternRoute(data:CustomLevelData,islands:SpaghettiIsland[],recovery:SpaghettiIsland[][],
 chapters:{name:string;entry:P;landings:P[]}[]){
 const C=data.components,stops:LanternRouteStop[]=[],legs:LanternRouteLeg[]=[];
 // Keep the old lower weave, but take it around each net's rim. Running a
 // grind straight through the fabric makes the mandatory bounce ambiguous.
 for(const rail of C.filter(c=>c.t==='rail'&&c.nm?.startsWith('Recovery weave / tier 6 /'))){
  for(const p of rail.pts!)for(const pad of C.filter(c=>c.t==='trampoline')){
   if(Math.abs(rail.p[0]+p[0]-pad.p[0])<.1&&Math.abs(rail.p[2]+p[1]-pad.p[2])<12)
    p[0]+=(pad.p[0]>0?-1:1)*9.5;
  }
 }
 // Collectibles tell one story. An unmarked shortcut is still useful after a
 // miss, but it cannot quietly hide a required box on another floor.
 data.components=C.filter(c=>!['crate','wumpa','checkpoint','zone'].includes(c.t));
 const add=(c:CustomComponent)=>{data.components.push(c);return c;};
 const stop=(name:string,chapter:number,p?:P):LanternRouteStop=>{
  const island=islands.find(s=>s.name===name);
  if(!island)throw new Error('Missing lantern landing: '+name);
  return {...island,p:[...(p??island.p)],chapter};
 };
 const append=(to:LanternRouteStop,kind:LanternRouteLeg['kind'],points:P[],extra:Partial<LanternRouteLeg>={})=>{
  const from=stops[stops.length-1];stops.push(to);
  legs.push({name:from.name+' → '+to.name,kind,from,to,points,...extra});
 };
 const connect=(to:LanternRouteStop,label:string)=>{
  const from=stops[stops.length-1];
  // The old weave passes through the shelf centres; original jump courts
  // also have an edge stitch and a spring branch. Give this marked exit its
  // own mouth so Grind cannot latch onto an unrelated overlapping line.
  const mouthPoint=(s:LanternRouteStop,departing:boolean):P=>[s.p[0]+(s.tier===undefined?-3:
   (s.name==='Recovery 45.3'?-5:5)*(departing?1:-1)),s.p[1],s.p[2]+(departing&&s.tier===undefined?5.5:0)];
  const a=mouthPoint(from,true),b=mouthPoint(to,false),dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
  const ux=dx/length,uz=dz/length;
  // Level mouths give the player time to catch/release at each real deck.
  const exit=(s:LanternRouteStop,p:P,sign:number):P=>{
   const centre=islands.find(i=>i.name===s.name)!.p;
   const edge=(value:number,delta:number,half:number)=>Math.abs(delta)<.001?Infinity:((delta>0?half:-half)-value)/delta;
   const run=Math.max(0,Math.min(edge(p[0]-centre[0],ux*sign,s.w/2),edge(p[2]-centre[2],uz*sign,s.d/2)))+4;
   return [p[0]+ux*run*sign,p[1]+.9,p[2]+uz*run*sign];
  };
  const rail=spaghettiRail({name:label,stage:to.chapter,choice:0,lanes:[0],radius:2,
   nodes:[[a[0],a[1]+.9,a[2]],...lanternClearancePath(exit(from,a,1),exit(to,b,-1),islands),[b[0],b[1]+.9,b[2]]]});
  add(rail);append(to,'rail',spaghettiSamples(rail),{rail:label});
 };
 const existing=(to:LanternRouteStop,name:string,reverse=false)=>{
  const c=C.find(c=>c.nm===name&&c.t==='rail');if(!c)throw new Error('Missing itinerary rail: '+name);
  if(name==='The Last Stitch / balcony bridge'){
   const knots=spaghettiSamples(c),nodes=lanternClearancePath(knots[0],knots[knots.length-1],islands);
   const clear=spaghettiRail({name,stage:9,choice:0,lanes:[0],radius:2,nodes});c.p=clear.p;c.pts=clear.pts;
  }
  let points=spaghettiSamples(c);if(reverse)points=points.reverse();
  const a=stops[stops.length-1].p,b=to.p;
  const nearest=(p:P)=>points.reduce((best,q,i)=>distance(q,p)<distance(points[best],p)?i:best,0);
  const start=nearest(a),end=nearest(b);
  points=points.slice(start,end+1);
  if(points.length<2)throw new Error('Reversed itinerary segment: '+name);
  append(to,'rail',points,{rail:name,reverse});
 };
 const foot=(to:LanternRouteStop)=>{
  const a=stops[stops.length-1].p,b=to.p;
  append(to,'jump',Array.from({length:9},(_,i)=>{const t=i/8,p=mix(a,b,t);p[1]+=Math.sin(t*Math.PI)*2.4;return p;}));
 };
 const shelf=(row:number,tier:number,chapter:number)=>stop(recovery[row][tier].name,chapter);
 const springChapters=[1,2,3,5,6,9];
 // Sideways climbs, northbound returns and a southbound overshoot: these use
 // different faces of the old maze instead of ten identical forward courts.
 const excursions=[{row:15,tier:2,returnRows:-6},{row:21,tier:2,returnRows:-3},
  {row:30,tier:1,returnRows:3},{row:44,tier:1,returnRows:-3},
  {row:56,tier:0,returnRows:3},{row:80,tier:2,returnRows:-3}];
 stops.push(stop('Lanternworks arrival',0,[...data.spawn]));stops[0].p[1]-=.08;
 for(let chapter=0;chapter<chapters.length;chapter++){
  const {name}=chapters[chapter],step=(j:number)=>stop(`${name} / step ${j+1}`,chapter);
  if(chapter===0){append(step(0),'walk',[stops[0].p,step(0).p]);}
  else existing(step(0),chapters[chapter-1].name+' / forward exit');
  foot(step(1));foot(step(2));
  const springIndex=springChapters.indexOf(chapter);
  if(springIndex>=0){
   const spring=C.find(c=>c.t==='trampoline'&&c.grp===10+chapter)!;
   const berth=recovery.flat().find(s=>Math.abs(s.p[0]-spring.p[0])<.1&&Math.abs(s.p[2]-spring.p[2])<.1&&s.tier===5)!;
   const approach=shelf(berth.row!-2,chapter%2?3:4,chapter);
   connect(approach,name+' / lantern descent');
   const boarding=stop(berth.name,chapter,[berth.p[0],berth.p[1],berth.p[2]+10.5]);
   connect(boarding,name+' / lantern spring approach');
   const plan=excursions[springIndex],receiver=shelf(plan.row,plan.tier,chapter),a=spring.p,b=receiver.p;
   // Same native ballistic arc as Carlisle: held-Jump amplifies the net;
   // ordinary air steering owns X/Z. Fruit samples describe that actual arc.
   const up=spring.speed!*spring.amp!;let y=a[1],vy=up,frames=0;const heights:number[]=[y];
   do{vy=Math.max(-CONST.maxFallSpeed,vy-(vy>0?TUNING.riseGravity:TUNING.fallGravity)/60);y+=vy/60;heights.push(y);frames++;}
   while((vy>=0||y>b[1])&&frames<600);
   const points=heights.map((h,i)=>{const p=mix(a,b,i/frames);p[1]=h;return p;});
   append(receiver,'spring',points,{spring:spring.nm});
   const returning=shelf(plan.row+plan.returnRows,plan.tier,chapter);
   const thread=plan.row%3,first=Math.min(plan.row,returning.row!),span=Math.floor((first-thread)/24)+1;
   existing(returning,`Recovery weave / tier ${plan.tier+1} / thread ${thread+1} / span ${span}`,plan.returnRows<0);
   connect(chapter===6?shelf(54,3,chapter):step(3),name+' / lantern return to court');
  }else foot(step(3));
  // This old upper shelf overhangs step five. Use it as the landing itself,
  // then drop to step six, instead of asking for an unseen landing beneath it.
  if(chapter!==6)foot(step(4));foot(step(5));
  existing(stop(name+' / reward balcony',chapter),name+' / balcony bridge');
 }
 const finish=stop('Finish collector',9,[0,-44,-2071]);
 existing(finish,'Last Stitch / final descent');
 // Gold remains a thin, persistent directional cue after the boxes break.
 // It does not recolour entire decks or drown out the surrounding maze.
 for(let i=0;i<stops.length;i++){
  const s=stops[i],out=legs[i],target=out?.points[Math.min(3,out.points.length-1)]??[0,s.p[1],s.p[2]-8];
  const [x,y,z]=s.p,dx=target[0]-x,dz=target[2]-z,len=Math.hypot(dx,dz)||1,ux=dx/len,uz=dz/len;
  const local=(side:number,forward:number):P=>[uz*side+ux*forward,.025,-ux*side+uz*forward];
  add({t:'mesh',nm:'Lantern itinerary / direction',p:[x,y,z],vertices:[...local(-1.4,1),...local(0,3.5),...local(1.4,1),...local(0,1.8)],
   indices:[0,1,3,1,2,3],solid:false,scenerySolid:false,castShadow:false,tex:'solid',color:'#ffcf79',emissive:'#73501c',doubleSided:true,grp:10+s.chapter});
  if(i<stops.length-1){
   const side=i%2?1:-1;
   add({t:'crate',kind:'wood',p:[x+uz*1.6*side,y,z-ux*1.6*side],nm:`Lantern itinerary / ${i+1} / box`,grp:3});
   if(s.name.includes('reward balcony')||out?.kind==='spring')add({t:'crate',kind:s.chapter===6?'life':'wood',p:[x-uz*1.6*side,y,z+ux*1.6*side],nm:`Lantern itinerary / ${i+1} / cache`,grp:3});
  }
  if(i&&s.name.endsWith('/ step 1'))add({t:'checkpoint',p:[x-2.8,y,z+2.2],nm:chapters[s.chapter].name+' checkpoint',grp:3});
 }
 const cameraPoints:P[]=[];
 for(const leg of legs){
  let sinceFruit=0;
  for(let i=0;i<leg.points.length-1;i++){
   const a=leg.points[i],b=leg.points[i+1],length=distance(a,b),count=Math.max(1,Math.ceil(length/4));
   for(let j=0;j<count;j++){
    const p=mix(a,b,j/count);cameraPoints.push(p);sinceFruit+=length/count;
    if(sinceFruit>=7){sinceFruit=0;add({t:'wumpa',p:[p[0],p[1]+1.2,p[2]],nm:'Lantern itinerary / '+leg.kind+' trail',grp:3});}
   }
  }
  const p=leg.points[leg.points.length-1];cameraPoints.push(p);
  add({t:'wumpa',p:[p[0],p[1]+1.4,p[2]],nm:'Lantern itinerary / receiver',grp:3});
  // Make rail mouths visible without assuming the player knows which of
  // the unmarked rails branches back toward the required boxes.
  if(leg.kind==='rail')for(const p of leg.points.slice(0,2))add({t:'wumpa',p:[p[0],p[1]+1.2,p[2]],nm:'Lantern itinerary / rail mouth',grp:3});
 }
 // Smooth the ordered spine over 12m, so a rail mouth's four-metre offset
 // cannot briefly turn the camera sideways between two forward landings.
 const spaced:P[]=[];let residual=0;
 for(let i=0;i<cameraPoints.length-1;i++){
  const a=cameraPoints[i],b=cameraPoints[i+1],length=distance(a,b);
  for(let at=residual;at<length;at+=4)spaced.push(mix(a,b,at/length));
  residual=(residual-length)%4;if(residual<0)residual+=4;
 }
 for(let i=0;i<spaced.length;i++){
  const p:P=[0,0,0];let weight=0;
  for(let j=-2;j<=2;j++){const q=spaced[Math.max(0,Math.min(spaced.length-1,i+j))],w=3-Math.abs(j);weight+=w;for(let k=0;k<3;k++)p[k]+=q[k]*w;}
  add({t:'camnode',p:p.map(v=>v/weight) as P,radius:0,nm:'Lantern itinerary / camera',grp:1});
 }
 for(const c of data.components)if(c.nm?.endsWith('/ departure arrow')){c.color='#74818a';c.emissive='#18232e';}
 data.cameraLookAhead=7;data.verticalLoop!.launchCamera=true;
 data.medalTimes={gold:360,silver:480,bronze:660};
 data.groups!.find(g=>g.id===1)!.nm='Lantern itinerary camera';
 return {stops,legs};
}
