import type {RaceKnot,SkateRaceData} from '../race/types';
import {spaghettiWorld,spaghettiRail,spaghettiSamples,type P,type SpaghettiDock,type SpaghettiRun} from './spaghetti-infinite-course';

export const SPAGHETTI_STAGES=['Rolling Start','Slipstream Gates','Over / Under','Split Chicane','Copper Bowl','Open Throttle','Needle Exchange','Twin Spines','The Flyover','Sprint Gallery','Final Switch','Finish Dive'];
const spans=[240,280,260,300,220,320,260,300,240,280,300,260];

/** Uninterrupted competitive lines, rare shared interchanges and optional
 * launch routes. No platforming sequence is reused by this course. */
export function createSpaghettiRace(){
 const length=spans.reduce((a,b)=>a+b,0),w=spaghettiWorld(false,-length-112),docks:SpaghettiDock[]=[],runs:SpaghettiRun[]=[];
 const line:RaceKnot[]=[],railChoices:NonNullable<SkateRaceData['railChoices']>=[],grinds:NonNullable<SkateRaceData['grinds']>=[];
 let z=0;
 for(let i=0;i<=spans.length;i++){
  const d:SpaghettiDock={name:SPAGHETTI_STAGES[i]??'Final approach',p:[0,114-i*18,z],width:i===0?96:i===4||i===8?76:16,depth:i===0?68:i===4||i===8?32:24,yaw:0};docks.push(d);
  for(const x of d.width>16?[0]:[-26,0,26])w.slab(`Race interchange ${i+1} / ${x}`,[x,d.p[1],z],d.width,d.depth,'#94b5bf',10+i);
  if(i<spans.length){
   for(const x of [-26,0,26])w.add({t:'speedpad',p:[x,d.p[1]+.03,z-5],s:[6,.1,5],speed:32,cycle:.65,nm:'Race launch strip',grp:10+i});
   for(const x of [-29,29])w.box([x,d.p[1],z+5],'mystery','Race item choice');
  }
  line.push([0,d.p[1],z,90]);z-=spans[i]??0;
 }
 line.unshift([0,114,26,90]);
 for(let stage=0;stage<spans.length;stage++){
  const a=docks[stage],b=docks[stage+1],span=spans[stage],paths:string[][]=[];
  const mode=stage%4;
  for(let choice=0;choice<3;choice++){
   const x=[-26,0,26][choice],sign=stage%2?-1:1,amp=choice===1?(mode===3?12:5):(mode===2?57:12);
   const nodes:P[]=[[x,a.p[1]+.9,a.p[2]-a.depth/2+9],[x,a.p[1]+.9,a.p[2]-a.depth/2-10]];
   for(const t of [.22,.44,.66,.82]){
    const wave=Math.sin((mode===3?3:2)*Math.PI*t)*sign;
    const xx=mode===2&&choice!==1?x*Math.cos(Math.PI*2*t):x+amp*wave;
    nodes.push([Math.max(-40,Math.min(40,xx)),a.p[1]-18*t+.9+(choice-1)*(mode===2?10:4)*Math.sin(Math.PI*t),a.p[2]-span*t]);
   }
   nodes.push([x,b.p[1]+.9,b.p[2]+b.depth/2+10],[x,b.p[1]+.9,b.p[2]+b.depth/2-7]);
   const name=`${stage+1}.${choice+1} / ${['Low ribbon','Needle line','High weave'][choice]} / ${SPAGHETTI_STAGES[stage]}`;
   const run:SpaghettiRun={name,stage,choice,nodes,radius:14,lanes:[0]};runs.push(run);
   const component=spaghettiRail(run),samples=spaghettiSamples(component);w.add(component);paths.push([name]);grinds.push({start:samples[0],end:samples[samples.length-1],lanes:[0]});
  }
  railChoices.push({from:[...a.p],to:[...b.p],paths});
  if([1,5,10].includes(stage)){
   const x=stage%2?-39:39,y=a.p[1],q=a.p[2]-22;
   w.slab('Race kicker approach',[x,y,a.p[2]-7],12,12,'#d4b473',10+stage);
   w.rail('Race kicker entry '+stage,[[Math.sign(x)*26,y+.9,a.p[2]+2],[x,y+.9,a.p[2]-3],[x,y+.9,a.p[2]-10]],3,10+stage);
   w.add({t:'ramp',p:[x,y,q],w:12,len:16,rise:4,tex:'spaghetti-basalt',color:'#d4b473',nm:'Race kicker / '+stage,grp:10+stage});
   w.slab('Race kicker receiver',[x,y-9,q-32],14,18,'#cfbc90',10+stage);
   w.box([x,y-9,q-32],'mystery','Air-route item');
   w.rail('Race kicker return '+stage,[[x,y-8.1,q-38],[Math.sign(x)*26,b.p[1]+.9,b.p[2]+5]],12,10+stage);
  }
  if(stage===3||stage===7)w.add({t:'vertramp',p:[0,a.p[1]-24,a.p[2]-span*.52],len:span*.62,w:10,rise:7,arc:84,deck:2,vkind:'half',tex:'spaghetti-basalt',color:'#739b9f',nm:'Race banking bowl / '+stage,grp:10+stage});
  if(stage===7)for(let k=0;k<3;k++)w.add({t:'vertramp',p:[k===1?5:0,a.p[1]-34-k*7,a.p[2]-82-k*18],len:42,w:4,rise:5,arc:90,deck:0,yaw:90,vkind:'half',tex:'spaghetti-basalt',color:'#9bb8b1',nm:`Race spine ${stage}.${k}`,grp:10+stage});
 }
 for(const stage of [4,9]){
  const z=docks[stage].p[2]-110,p=w.recoveryPoint(z,4),q:P=[p[0],p[1]+22,p[2]-30];
  w.add({t:'trampoline',p:[p[0],p[1]+.03,p[2]],s:[9,.6,8],speed:32,amp:1.25,tex:'solid',color:'#c2b178',nm:'Race Carlisle spring',grp:3});
  w.slab('Race spring prize',q,12,16,'#cab88d');w.box([q[0]-3.5,q[1],q[2]],'mystery','Spring shortcut item');
  const target=w.recoveryBelow(q,58);w.rail('Race spring return '+stage,[[q[0],q[1]+.9,q[2]-3],[q[0],q[1]+.9,q[2]-9],target],4);
 }
 const last=docks[docks.length-1];
 for(const x of [-26,0,26])w.rail('Race final descent '+x,[[x,last.p[1]+.9,last.p[2]-3],[x,last.p[1]+.9,last.p[2]-15],[x===0?4:x*.6,w.finishY+.9,w.finishZ+24],[x===0?4:x*.6,w.finishY+.9,w.finishZ+8]],9,2);
 w.finish();w.connectRecovery([[0,114,26],...[2,4,6,9,12].map(i=>docks[i].p)]);
 const data=w.data([0,114,26]);line.push([0,w.finishY,w.finishZ,90]);
 data.skateRace={v:1,racers:8,seed:270327,gemReward:'win',stages:SPAGHETTI_STAGES,line,jumps:[],grinds,railChoices,finishWidth:90,
  originalLength:line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1],p[2]-line[i][2]),0)};
 data.groups!.push(...SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm,editorOnly:true})));
 return {data,docks,runs,islands:w.islands,recovery:w.recovery,far:w.far,finishZ:w.finishZ};
}
