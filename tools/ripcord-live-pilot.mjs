import * as m from '../src/levels/ripcord-river.ts';
import {rumblewaterSteps,checkpointApproach} from './rumblewater-downstream-pilot.mjs';

/** Production input-only tour of the independent Ripcord layout. */
export function createRipcordLivePilot(g,name='inner-low'){
 const p=g.player,l=g.getLevel(),report={},side=name.startsWith('outer')?1:-1;
 let frame=0,previous={};
 const s=()=>m.ripcordProgress(p.pos),pt=(at,u=0)=>m.ripcordPoint(at,m.ripcordHeight(at),u);
 const steerToward=target=>{
  const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,len=Math.hypot(dx,dz)||1,f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};
  const norm=Math.hypot(f.x,f.z)||1,fx=f.x/norm,fz=f.z/norm;
  return{moveX:(dx*-fz+dz*fx)/len,moveY:(dx*fx+dz*fz)/len};
 };
 const follow=(u=0,buttons={},look=7)=>({...steerToward(pt(s()+look,typeof u==='function'?u(s()+look):u)),...buttons});
 const rooms={RUMBLEWATER_REFUGES:m.RIPCORD_REFUGES};
 const skate=(u=0)=>checkpointApproach(p,l,rooms,s(),follow,frame)??follow(u,{jumpHeld:true,spinHeld:frame%30<8});
 const grind=u=>p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:true}:follow(u,{grindHeld:true,jumpHeld:true});
 const r={p,l,steerToward,snapshot:()=>({frame,position:p.pos.toArray(),state:p.state}),get frame(){return frame;}};
 const {until,untilPred,hop,stepFor}=rumblewaterSteps({r,s,follow,skate,grind,report});
 function* play(){
  yield* stepFor(20);
  yield* hop(142.2,156,m.terraceLane);yield* hop(234.2,250,m.terraceLane);
  yield* until(405,()=>skate(s=>s<330?m.terraceLane(s):0),'terrace vault');
  const twin=s=>m.twinLane(s,side),a=side<0?548:626,b=side<0?557:636;
  yield* hop(a-1.8,b+3,twin);yield* until(798,()=>skate(twin),'twin spillway shelter');
  yield* hop(902.2,917,m.sluiceLane);yield* hop(1008.2,1021,m.sluiceLane);
  yield* until(1193,()=>skate(m.sluiceLane),'sluice vault');
  if(name.endsWith('high')){
   yield* until(1202,()=>skate(m.canopyRailLane),'canopy rail approach');
   yield* untilPred(()=>p.state==='grind',()=>grind(m.canopyRailLane),{maxFrames:400,label:'supported canopy rail catch'});
   yield* until(1281,()=>grind(m.canopyRailLane),'canopy diagonal grind');
   yield* untilPred(()=>p.grounded&&p.state!=='grind',{moveX:0,moveY:0},{maxFrames:400,label:'canopy rail landing'});
   report.canopyRail=r.snapshot();
  }
  yield* hop(1338.2,1353,m.canopyLane);yield* hop(1452.2,1466,m.canopyLane);
  yield* until(1608,()=>skate(m.canopyLane),'thunder checkpoint');
  yield* hop(1704.2,1719);yield* hop(1798.2,1811);
  yield* hop(m.RIPCORD_BOULDER_END-1.8,m.RIPCORD_BOULDER_END+15);
  yield* untilPred(()=>p.state==='finished',()=>skate(),{maxFrames:900,label:'Ripcord sanctuary finish'});
 }
 const iterator=play();
 return{report,get frame(){return frame;},next(){
  const next=iterator.next();if(next.done)return null;const sample=next.value??{};
  const input={moveX:sample.moveX??0,moveY:sample.moveY??0,jumpReleased:false,restartPressed:false,jumpCancelled:false};
  const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
   input[held]=!!sample[held];const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!previous[held]);
  }
  input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!previous.jumpHeld);previous={...input};frame++;return input;
 }};
}
