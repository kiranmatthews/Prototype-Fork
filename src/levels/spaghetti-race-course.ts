import type {RaceKnot,SkateRaceData} from '../race/types';
import {spaghettiRail,spaghettiSamples,type P,type SpaghettiDock,type SpaghettiRun} from './spaghetti-infinite-course';
import {spaghettiRaceWorld,raceDeckY,type RaceDeck} from './spaghetti-race-world';

// Version 1's twelve sections and three primary lines. Later dense forks and
// the 48 m compression are deliberately absent; current race systems remain.
export const SPAGHETTI_STAGES=['Rolling Start','Slipstream Gates','Over / Under','Split Chicane','Copper Bowl','Open Throttle','Needle Exchange','Twin Spines','The Flyover','Sprint Gallery','Final Switch','Finish Dive'];
const spans=[240,280,260,300,220,320,260,300,240,280,300,260];
export function createSpaghettiRace(){
 const length=spans.reduce((a,b)=>a+b,0),w=spaghettiRaceWorld(-length-112),docks:SpaghettiDock[]=[],runs:SpaghettiRun[]=[],decks:RaceDeck[][]=[];
 const line:RaceKnot[]=[],railChoices:NonNullable<SkateRaceData['railChoices']>=[];
 let z=0;
 for(let i=0;i<=spans.length;i++){
  const d:SpaghettiDock={name:SPAGHETTI_STAGES[i]??'Final approach',p:[0,114-i*18,z],width:i===0?96:i===4||i===8?76:16,depth:i===0?68:i===4||i===8?32:24,yaw:0};docks.push(d);
  const positions=d.width>16?[0]:[-26,0,26];decks[i]=positions.map((x,lane)=>w.slab(`Race interchange ${i+1} / ${x}`,[x,d.p[1],z],d.width,d.depth,'#94b5bf',10+i,
   i===0?2:[2,2.5,3,3.5,4][(i*2+lane)%5],i===0?.035:[.035,.055,.075,.10][(i+lane*2)%4]));
  d.depth=decks[i][Math.floor(decks[i].length/2)].d;
  if(i<spans.length)for(const [lane,x] of [-26,0,26].entries()){
   const deck=decks[i][decks[i].length===1?0:lane];
   w.add({t:'speedpad',p:[x,raceDeckY(deck,z-5)+.03,z-5],s:[6,.1,3],speed:32,cycle:.65,nm:'Race launch strip',grp:10+i});
   w.box([x,raceDeckY(deck,z+5),z+5]);
   const p:P=[x,raceDeckY(deck,z-12)+.025,z-12];
   w.add({t:'mesh',nm:'Race downhill / direction',p,vertices:[-2.4,deck.grade*2.8,2.8,0,-deck.grade*3.4,-3.4,2.4,deck.grade*2.8,2.8,0,deck.grade*1.3,1.3],indices:[0,1,3,1,2,3],
    color:lane===1?'#e2c580':'#85c8c2',emissive:'#44554a',tex:'solid',solid:false,scenerySolid:false,castShadow:false,grp:10+i});
  }
  line.push([0,d.p[1],z,90]);z-=spans[i]??0;
 }
 const spawn:P=[0,raceDeckY(decks[0][0],26),26];line.unshift([...spawn,90]);
 for(let stage=0;stage<spans.length;stage++){
  const a=docks[stage],b=docks[stage+1],span=spans[stage],paths:string[][]=[],mode=stage%4;
  for(let choice=0;choice<3;choice++){
   const x=[-26,0,26][choice],sign=stage%2?-1:1,amp=choice===1?(mode===3?12:5):(mode===2?57:12);
   const from=decks[stage][decks[stage].length===1?0:choice],to=decks[stage+1][decks[stage+1].length===1?0:choice];
   const startZ=from.p[2]-from.d/2+9,endZ=to.p[2]+to.d/2-7,fromY=raceDeckY(from,startZ),toY=raceDeckY(to,endZ);
   const gap=startZ-endZ,edge=3/gap;
   const nodes:P[]=[[x,fromY+.9,startZ]];
   for(const t of [edge,.22,.44,.66,.82,1-edge]){
    const wave=Math.sin((mode===3?3:2)*Math.PI*t)*sign;
    const xx=mode===2&&choice!==1?x*Math.cos(Math.PI*2*t):x+amp*wave;
    nodes.push([Math.max(-40,Math.min(40,xx)),fromY+(toY-fromY)*t+.9+(choice-1)*(mode===2?10:4)*Math.sin(Math.PI*t),startZ-gap*t]);
   }
   nodes.push([x,toY+.9,endZ]);
   const name=`${stage+1}.${choice+1} / ${['Low ribbon','Needle line','High weave'][choice]} / ${SPAGHETTI_STAGES[stage]}`;
   const run:SpaghettiRun={name,stage,choice,nodes,radius:Math.min(14,gap/8),lanes:[0]};runs.push(run);w.add(spaghettiRail(run));paths.push([name]);
  }
  railChoices.push({from:[...a.p],to:[...b.p],paths});
  if([1,5,10].includes(stage)){
   const x=stage%2?-39:39,source=decks[stage][decks[stage].length===1?0:x<0?0:2],entryZ=source.p[2]-source.d/2-24;
   const y=raceDeckY(source,source.p[2]-source.d/2)-4,q=entryZ-20;
   const approach=w.slab('Race kicker approach / '+stage,[x,y+2,entryZ],12,12,'#d4b473',10+stage,2,1/6);
   w.rail('Race kicker entry '+stage,[[Math.sign(x)*26,raceDeckY(source,source.p[2]-source.d/2+3)+.9,source.p[2]-source.d/2+3],[x,raceDeckY(approach,entryZ+8)+.9,entryZ+8],[x,y+.9,entryZ-12]],3,10+stage);
   w.add({t:'ramp',p:[x,y,q],w:12,len:16,rise:4,tex:'spaghetti-basalt',color:'#d4b473',nm:'Race kicker / '+stage,grp:10+stage});
   const receiver=w.slab('Race kicker receiver / '+stage,[x,y-9,q-40],14,18,'#cfbc90',10+stage,2.5,.045);
   w.box([x,receiver.p[1],receiver.p[2]],'mystery','Air-route item');
   w.rail('Race kicker return '+stage,[[x,receiver.p[1]+.9,receiver.p[2]],[Math.sign(x)*26,b.p[1]+.9,b.p[2]+5]],12,10+stage);
  }
  if(stage===3||stage===7)w.add({t:'vertramp',p:[0,a.p[1]-24,a.p[2]-span*.52],len:span*.62,w:10,rise:7,arc:84,deck:2,vkind:'half',tex:'spaghetti-basalt',color:'#739b9f',nm:'Race banking bowl / '+stage,grp:10+stage});
  if(stage===7)for(let k=0;k<3;k++)w.add({t:'vertramp',p:[k===1?5:0,a.p[1]-34-k*7,a.p[2]-82-k*18],len:42,w:4,rise:5,arc:90,deck:0,yaw:90,vkind:'half',tex:'spaghetti-basalt',color:'#9bb8b1',nm:`Race spine ${stage}.${k}`,grp:10+stage});
 }
 w.clearPrimaryDecks();
 // Keep the eighteen complete Carlisle nets and dense item distribution.
 // Choose open launch shafts; their longer receivers start beyond the net.
 const used=new Set<RaceDeck>();
 for(let index=0;index<18;index++){
  const at=-112-index*(length-180)/17,tier=[4,2,3,1,5][index%5],stretch=[2,3,4][index%3],depth=16*stretch;
  const candidates=w.recovery.flat().filter(s=>s.tier!==0&&!used.has(s)&&Math.abs(s.p[2]-at)<90).sort((a,b)=>Math.abs(a.p[2]-at)+Math.abs(a.tier!-tier)*45-(Math.abs(b.p[2]-at)+Math.abs(b.tier!-tier)*45));
  const s=candidates.find(s=>!w.islands.some(a=>a!==s&&Math.abs(a.p[0]-s.p[0])<(a.w+14)/2&&a.p[2]+a.d/2>s.p[2]-20-depth&&a.p[2]-a.d/2<s.p[2]+8&&a.p[1]>s.p[1]+2&&a.p[1]<s.p[1]+35))??candidates[0];
  used.add(s);const p=s.p,q:P=[p[0],p[1]+18,p[2]-20-depth/2];
  s.spring=w.add({t:'trampoline',p:[p[0],p[1]+.03,p[2]],s:[14,.6,16],speed:32,amp:1.25,tex:'solid',color:'#d94f15',nm:'Race Carlisle spring / '+(index+1),grp:3});
  const prize=w.slab('Race spring prize / '+(index+1),q,14,16,'#cab88d',3,stretch,.035);
  w.box([...q],'mystery','Spring shortcut item');
  const endZ=q[2]-prize.d/2+4,target=w.recoveryBelow([q[0],q[1],endZ],58);
  w.rail('Race spring return '+(index+1),[[q[0],raceDeckY(prize,endZ)+.9,endZ],[q[0],raceDeckY(prize,endZ-4)+.9,endZ-4],target],4);
 }
 for(const [lane,x] of [-26,0,26].entries()){
  const s=decks[decks.length-1][lane],z=s.p[2]-s.d/2+4;
  w.rail('Race final descent '+x,[[x,raceDeckY(s,z)+.9,z],[x,raceDeckY(s,z-6)+.9,z-6],[x===0?4:x*.6,w.finishY+.9,w.finishZ+24],[x===0?4:x*.6,w.finishY+.9,w.finishZ+8]],9,2);
 }
 w.finish();w.connectRecovery([spawn,...[2,4,6,9,12].map(i=>docks[i].p)]);w.fitRails();
 const pickupPoints=w.components.filter(c=>c.t==='crate').map(c=>c.p);
 for(const c of w.components.filter(c=>c.t==='rail')){
  const samples=spaghettiSamples(c),distances=[0];for(let i=1;i<samples.length;i++)distances.push(distances[i-1]+Math.hypot(...samples[i].map((v,k)=>v-samples[i-1][k])));
  const length=distances[distances.length-1];if(length<45)continue;const count=Math.max(1,Math.ceil(length/(c.nm?.startsWith('Recovery')?120:84)));let segment=1;
  for(let i=0;i<count;i++){
   const at=(i+.5)*length/count;while(segment<distances.length-1&&distances[segment]<at)segment++;
   const a=samples[segment-1],b=samples[segment],t=(at-distances[segment-1])/(distances[segment]-distances[segment-1]);
   const p:P=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t-.9,a[2]+(b[2]-a[2])*t];
   if(pickupPoints.some(q=>Math.hypot(...p.map((v,k)=>v-q[k]))<6))continue;
   w.box(p,'mystery',`Rail item / ${c.nm} / ${i+1}`);pickupPoints.push(p);
  }
 }
 const data=w.data(spawn);line.push([0,w.finishY,w.gateZ,90]);
 const grinds=runs.map(run=>{const c=w.components.find(c=>c.t==='rail'&&c.nm===run.name)!,samples=spaghettiSamples(c);return {start:samples[0],end:samples[samples.length-1],lanes:[0]};});
 data.skateRace={v:1,racers:8,seed:270327,gemReward:'win',rivalSkill:'club',grindBalanceScale:.55,itemRespawnSeconds:1.5,itemPool:'rail',stages:SPAGHETTI_STAGES,line,jumps:[],grinds,railChoices,finishWidth:90,
  originalLength:line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1],p[2]-line[i][2]),0)};
 data.groups!.push(...SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm,editorOnly:true})));
 return {data,docks,runs,islands:w.islands,recovery:w.recovery,far:w.far,near:w.near,finishZ:w.finishZ};
}
