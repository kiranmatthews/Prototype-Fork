import {spaghettiWorld,spaghettiClearanceHeight,type P} from './spaghetti-infinite-course';

export const LANTERN_CHAPTERS=['Lantern Steps','The Broken Loom','Counterweights','Spine Stair','The Box Garden','Hanging Lanterns','Spring Vault','The Bellows','Needle Windows','The Last Stitch'];
// Keep jump courts between the six recovery strata, with head clearance.
const chapterHeights=[112,96,60,48,12,0,-36,-48,-84,-96].map(y=>spaghettiClearanceHeight(y));
const chapterSteps=[
 {x:[-18,-9,2,-6,7,18],y:[0,-2,-4,-2,-5,-8]},
 {x:[18,12,4,-4,-12,-18],y:[0,-1,-3,-5,-6,-8]},
 {x:[-18,-8,0,8,18,24],y:[0,-3,-1,-3,-5,-8]},
 {x:[18,8,-2,-12,-4,6],y:[0,-3,-6,-4,-6,-8]},
 {x:[-18,-10,2,12,2,-10],y:[0,-2,-4,-6,-4,-8]},
 {x:[18,8,0,-8,-18,-24],y:[0,-1,-3,-5,-7,-8]},
 {x:[-18,-6,6,18,10,0],y:[0,-2,-4,-6,-4,-8]},
 {x:[18,10,-2,-12,-4,8],y:[0,-2,-4,-2,-5,-8]},
 {x:[-18,-8,4,-4,8,20],y:[0,-3,-1,-3,-5,-8]},
 {x:[18,10,0,-10,0,12],y:[0,-2,-4,-6,-4,-8]},
];
export interface LanternJump {from:P;to:P;name:string;fromWidth?:number;fromDepth?:number;toWidth?:number;toDepth?:number;}
export interface LanternRouteStop {name:string;p:P;w:number;d:number;chapter:number;}

function boxRoutePlan():LanternRouteStop[][] {
 return chapterHeights.map((y,chapter)=>{
  const z=-chapter*200,name=LANTERN_CHAPTERS[chapter];
  const steps=chapterSteps[chapter].x.map((x,j)=>({name:`${name} / step ${j+1}`,p:[x,y+chapterSteps[chapter].y[j],z-j*18] as P,w:j?12:18,d:j?14:20,chapter}));
  const end=steps[5].p,next:P=chapter<9?[chapterSteps[chapter+1].x[0],chapterHeights[chapter+1],z-200]:[0,-132,-2080];
  const reward:P=[Math.round(end[0]*.45+next[0]*.55),y-14,z-144];
  const blend=(a:P,b:P,t:number):P=>a.map((v,i)=>v+(b[i]-v)*t) as P;
  for(let j=1;j<=2;j++)steps.push({name:`${name} / box trail transfer ${j}`,p:blend(end,reward,j/3),w:12,d:14,chapter});
  steps.push({name:name+' / reward balcony',p:reward,w:16,d:20,chapter});
  const count=chapter<9?3:7;
  for(let j=1;j<count;j++)steps.push({name:`${name} / box trail exit ${j}`,p:blend(reward,next,j/count),w:12,d:14,chapter});
  return steps;
 });
}

/** A foot-and-board adventure with small jump courts, timing challenges and
 * reward detours. Rails connect the courts without replacing their centres. */
export function createSpaghettiPlatformer(){
 const w=spaghettiWorld(true,-2080),jumps:LanternJump[]=[],chapters:{name:string;entry:P;landings:P[]}[]=[];
 const routeChapters=boxRoutePlan(),route=routeChapters.flat();
 route.push({name:'Lanternworks / crystal landing',p:[0,w.finishY,w.finishZ+9],w:30,d:26,chapter:9});
 // Leave a clear viewing/jumping envelope around the box route. Move only
 // conflicting recovery islands to the nearest existing stratum, preferring
 // lower shelves. Every corridor column retains a floor and connecting rails.
 for(const row of w.recovery)for(const island of row){
  const nearby=route.slice(1).flatMap((b,i)=>{
   const a=route[i],dz=b.p[2]-a.p[2],t=Math.max(0,Math.min(1,(island.p[2]-a.p[2])/dz));
   const x=a.p[0]+(b.p[0]-a.p[0])*t,z=a.p[2]+dz*t;
   return Math.abs(x-island.p[0])<island.w/2+9&&Math.abs(z-island.p[2])<island.d/2+9?[a.p[1]+(b.p[1]-a.p[1])*t]:[];
  });
  const originalY=island.p[1],candidates=[120,72,24,-24,-72,-120].sort((a,b)=>Math.abs(a-originalY)-Math.abs(b-originalY)||a-b);
  island.p[1]=candidates.find(height=>nearby.every(y=>Math.abs(((height-y+432)%288)-144)>=26))??originalY;
 }
 const entry:P=[-18,chapterHeights[0],18];
 w.slab('Lanternworks arrival',[-18,chapterHeights[0],16],38,44,'#d9c59b');
 for(let chapter=0;chapter<10;chapter++){
  const z=-chapter*200,y=chapterHeights[chapter],landings:P[]=[];
  const name=LANTERN_CHAPTERS[chapter];
  for(let j=0;j<6;j++){
   const p:P=[chapterSteps[chapter].x[j],y+chapterSteps[chapter].y[j],z-j*18];landings.push(p);
   const slab=w.slab(`${name} / step ${j+1}`,p,j===0?18:12,j===0?20:14,j%2?'#bda881':'#dbcaab',10+chapter);
   if(j>0&&j<5)slab.pts=[[-6,-5,1],[-4,-7,1],[4,-7,1],[6,-5,1],[6,5,1],[4,7,1],[-4,7,1],[-6,5,1]];
   if(j>0){
    const a=landings[j-1];jumps.push({from:a,to:p,name:`${name} / jump ${j}`});
    const dx=p[0]-a[0];
    w.rail(`${name} / edge stitch ${j}`,[[a[0]+4,a[1]+1,a[2]],[a[0]+4+dx*.4,a[1]+1,a[2]-6],[p[0]+4-dx*.4,p[1]+1,p[2]+6],[p[0]+4,p[1]+1,p[2]]],2,10+chapter);
   }
   if(j===0&&chapter>0)w.add({t:'checkpoint',p:[p[0]-3,p[1],p[2]+3],nm:name+' checkpoint',grp:3});
  }
  chapters.push({name,entry:landings[0],landings});
  const end=landings[5],reward:P=[...routeChapters[chapter].find(s=>s.name.endsWith('/ reward balcony'))!.p];
  w.slab(name+' / reward balcony',reward,16,20,'#c5a871',10+chapter);
  // Keep the jump sequence open down the centre. Its left rail mouths offer
  // an early lower route and a longer cargo detour, opposite the edge stitch.
  const landing=(j:number)=>({name:name+' / step '+(j+1),p:landings[j],w:j===0?18:12,d:j===0?20:14});
  const balcony={name:name+' / reward balcony',p:reward,w:16,d:20};
  w.fork(name+' / fork / lower thread',landing(0),w.lowerLanding(landings[0],132),-1,10+chapter);
  w.fork(name+' / fork / cargo balcony',landing(2),balcony,-1,10+chapter,5.2);
  w.fork(name+' / fork / balcony descent',balcony,w.lowerLanding(reward,108),-1,10+chapter);
  const transfers=routeChapters[chapter].filter(s=>s.name.includes('box trail transfer'));
  for(const stop of transfers){
   w.slab(stop.name,stop.p,stop.w,stop.d,'#e6cf9e',10+chapter);
  }
  const exits=routeChapters[chapter].filter(s=>s.name.includes('box trail exit'));
  for(const stop of exits)w.slab(stop.name,stop.p,stop.w,stop.d,'#e6cf9e',10+chapter);
  w.rail(name+' / balcony bridge',[[end[0]+4,end[1]+1,end[2]-2],...transfers.map(s=>[s.p[0]+4,s.p[1]+1,s.p[2]] as P),[reward[0]+4,reward[1]+1,reward[2]+4]],3,10+chapter);
  if(chapter<9){
   const next:P=[chapterSteps[chapter+1].x[0],chapterHeights[chapter+1],z-200];
   w.rail(name+' / forward exit',[[reward[0]+4,reward[1]+1,reward[2]-2],...exits.map(s=>[s.p[0]+4,s.p[1]+1,s.p[2]] as P),[next[0]+4,next[1]+1,next[2]+4]],3,10+chapter);
  }else w.rail('Last Stitch / final descent',[[reward[0]+4,reward[1]+1,reward[2]-3],...exits.map(s=>[s.p[0]+4,s.p[1]+1,s.p[2]] as P),[4,w.finishY+.9,w.finishZ+8]],3,19);
  if([1,2,3,5,6,9].includes(chapter)){
   const p:P=[30,y-18,z-100],q:P=[30,y+4,z-122];
   w.slab(name+' / spring well',[p[0],p[1]-2.4,p[2]],16,18,'#968d84',10+chapter);
   w.add({t:'trampoline',p:[p[0],p[1]+.03,p[2]],s:[14,.6,16],speed:32,amp:1.25,tex:'solid',color:'#d94f15',nm:name+' / Carlisle spring',grp:10+chapter});
   w.slab(name+' / high vault',q,14,18,'#a59e95',10+chapter);
   const approach=landings[2];
   w.rail(name+' / spring approach',[[approach[0],approach[1]+1,approach[2]],[approach[0],approach[1]+1,approach[2]-8],[p[0],p[1]+1,p[2]+3]],3,10+chapter);
   w.rail(name+' / vault return',[[q[0],q[1]+1,q[2]-3],[q[0],q[1]+1,q[2]-11],w.recoveryBelow(q,80)],5,10+chapter);
  }
  if(chapter===3||chapter===7){
   for(let k=0;k<3;k++)w.add({t:'vertramp',p:[-12+(k===1?5:k===2?-4:0),y-24-k*7,z-106-k*18],len:32,w:4,rise:5,arc:90,deck:0,yaw:90,vkind:'half',tex:'spaghetti-basalt',color:['#b7c5b0','#c8aa83','#acb6bb'][k],nm:`Lantern spine ${chapter}.${k}`,grp:10+chapter});
   w.rail(name+' / spine return',[[-12,y-32,z-145],[-12,y-32,z-155],w.recoveryBelow([-12,y-32,z-155],35)],3,10+chapter);
  }
  if(chapter===0||chapter===4||chapter===8){
   const p:P=[38,y-16,z-86];w.downhill(name+' / kicker approach',[38,y-14,z-71],12,14,4,10+chapter);
   w.rail(name+' / kicker entry',[[landings[1][0]+4,landings[1][1]+1,landings[1][2]-2],[landings[1][0]+4,landings[1][1]+1,landings[1][2]-9],[38,y-11,z-64],[38,y-13,z-71]],4,10+chapter);
   w.add({t:'ramp',p,w:12,len:16,rise:4,tex:'spaghetti-basalt',color:'#c9a86e',nm:name+' / kicker',grp:10+chapter});
   const q:P=[38,y-25,z-118];w.slab(name+' / kicker receiver',q,14,18,'#a59e95',10+chapter);
   w.rail(name+' / kicker return',[[38,y-24,z-124],w.recoveryBelow(q,74)],5,10+chapter);
  }
  if(chapter%2===1){const p=landings[3];w.add({t:'enemy',foe:chapter%4===1?'hopper':'turtle',p:[p[0]-2,p[1],p[2]],range:1.8,speed:1.1,nm:name+' / landing guardian',grp:3});}
 }
 w.finish();w.connectRecovery();
 // One complete box route. Optional springs, pipes and recovery rails keep
 // their traversal role without hiding required crates on competing paths.
 for(const stop of route.slice(0,-1)){
  const [x,y,z]=stop.p;
  w.box([x-1.4,y,z+1.5],stop.name.includes('reward balcony')&&[2,6,8].includes(stop.chapter)?'life':'wood',stop.name+' / leading box');
  w.box([x+1.4,y,z-1.5],stop.name.includes('reward balcony')&&stop.chapter%3===1?'multihit':'wood',stop.name+' / following box');
 }
 w.box([-18,entry[1],12],'wood','Box trail / start here');
 for(let i=0;i<route.length-1;i++){
  const a=route[i],b=route[i+1];
  if(!/\/ step [1-5]$/.test(a.name)){
   jumps.push({from:a.p,to:b.p,name:a.name+' → '+b.name,fromWidth:a.w,fromDepth:a.d,toWidth:b.w,toDepth:b.d});
  }
  for(const t of [.32,.67])w.fruit([a.p[0]+(b.p[0]-a.p[0])*t,a.p[1]+(b.p[1]-a.p[1])*t+5,a.p[2]+(b.p[2]-a.p[2])*t],'Box trail / next landing');
 }
 const data=w.data(entry);data.alwaysSkate=false;
 for(const p of new Set([...chapters.flatMap(c=>[c.entry,...c.landings]),...route.map(s=>s.p)]))p[1]/=3;
 // Persistent paint survives box collection; it points at the actual next
 // landing, including diagonals and the final crystal, rather than due south.
 for(let i=0;i<route.length;i++){
  const stop=route[i],next=route[i+1],c=data.components.find(c=>c.nm===stop.name);
  if(c){c.color='#e7d4ac';c.emissive='#3e3020';}
  const [x,y,z]=stop.p,dx=next?next.p[0]-x:0,dz=next?next.p[2]-z:-1,len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len;
  const vertex=(side:number,forward:number):P=>[x+uz*side+ux*forward,y+.025,z-ux*side+uz*forward];
  data.components.push({t:'mesh',nm:'Box trail / gold direction',p:[0,0,0],vertices:[...vertex(-2.1,1),...vertex(0,4),...vertex(2.1,1),...vertex(0,2)],indices:[0,1,3,1,2,3],solid:false,scenerySolid:false,castShadow:false,tex:'solid',color:'#ffdc77',emissive:'#806023',doubleSided:true,grp:10+stop.chapter});
  for(const side of [-1,1])data.components.push({t:'mesh',nm:'Box trail / gold landing edge',p:[x+side*(stop.w/2-.35),y+.03,z],vertices:[-.15,0,stop.d/2-2,.15,0,stop.d/2-2,.15,0,-stop.d/2+2,-.15,0,-stop.d/2+2],indices:[0,1,2,0,2,3],solid:false,scenerySolid:false,castShadow:false,tex:'solid',color:'#ffdc77',emissive:'#806023',grp:10+stop.chapter});
 }
 for(const c of data.components)if(c.nm?.endsWith('/ departure arrow')){c.color='#748d99';c.emissive='#1b2632';}
 data.groups!.push(...LANTERN_CHAPTERS.map((nm,i)=>({id:10+i,nm,editorOnly:true})));
 return {data,islands:w.islands,recovery:w.recovery,chapters,jumps,route,far:w.far,finishZ:w.finishZ};
}
