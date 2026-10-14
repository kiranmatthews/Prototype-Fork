import * as m from '../src/levels/rumblewater-run.ts';
import {downstreamInputs,rumblewaterSteps,checkpointApproach} from './rumblewater-downstream-pilot.mjs';

/** A browser controller, not a physics replay. It emits the same stick/button
 * samples as the native pilot while observing the current production Player. */
export function createRumblewaterLivePilot(g,name='outer-high'){
 const p=g.player,l=g.getLevel(),report={};let frame=0,previous={};
 const s=()=>m.rumbleProgress(p.pos),pt=(station,u=0)=>m.rumblePoint(station,m.rumbleHeight(station),u);
 const steerToward=target=>{
  const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,len=Math.hypot(dx,dz)||1;
  const f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},scale=1/(Math.hypot(f.x,f.z)||1),fx=f.x*scale,fz=f.z*scale;
  return{moveX:(dx*-fz+dz*fx)/len,moveY:(dx*fx+dz*fz)/len};
 };
 const follow=(u=0,buttons={},look=7)=>({...steerToward(pt(s()+look,typeof u==='function'?u(s()+look):u)),...buttons});
 const skate=(u=0)=>checkpointApproach(p,l,m,s(),follow,frame)??follow(u,{jumpHeld:true,spinHeld:frame%30<8});
 const grind=(u=0)=>p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:true}:follow(u,{grindHeld:true,jumpHeld:true});
 const r={p,l,steerToward,snapshot:()=>({frame,position:p.pos.toArray(),state:p.state}),get frame(){return frame;}};
 const ctx={r,m,s,pt,follow,skate,grind,report};
 const {until,untilPred,hop,stepFor}=rumblewaterSteps(ctx);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 function* play(){
  yield* stepFor(20);yield* hop(84.5,98);
  const fork=s=>smooth((s-136)/24)*(1-smooth((s-278)/32));
  yield* until(138,()=>skate());
  if(name.startsWith('inner')){
   yield* hop(188.5,201,s=>-7*fork(s));yield* hop(246.5,259,s=>-7*fork(s));yield* until(311,()=>skate(s=>-7*fork(s)));
  }else{
   yield* until(158,()=>skate(s=>7*fork(s)));
   yield* untilPred(()=>p.state==='grind',()=>grind(s=>7*fork(s)),{maxFrames:500,label:'opening aqueduct catch'});
   yield* until(290,()=>grind(s=>7*fork(s)));
   yield* untilPred(()=>p.grounded&&p.state!=='grind',()=>follow(),{maxFrames:400,label:'opening aqueduct landing'});
  }
  yield* until(452,()=>skate(s=>2.5*Math.sin((s-323)/32)));
  yield* hop(468.5,482);yield* until(580,()=>skate(s=>s<550?2*Math.sin((s-490)/25):0));
  const low=s=>-7.2*smooth((s-584)/24)*(1-smooth((s-687)/29)),high=s=>7*smooth((s-584)/24)*(1-smooth((s-687)/29));
  if(name.endsWith('low')){yield* hop(622.4,635,low);yield* until(718,()=>skate(low));}
  else{
   yield* until(607,()=>skate(high));yield* untilPred(()=>p.state==='grind',()=>grind(high),{maxFrames:400,label:'high mill catch'});
   yield* until(674,()=>grind(high));yield* untilPred(()=>p.grounded&&p.state!=='grind',()=>follow(high),{maxFrames:400,label:'high mill landing'});
   yield* until(720,()=>skate(high));
  }
  yield* until(777,()=>skate());yield* hop(840.2,856);yield* until(892,()=>skate());
  yield* downstreamInputs(ctx,name.endsWith('high'));
 }
 const iterator=play();
 return{report,get frame(){return frame;},next(){
  const next=iterator.next();if(next.done)return null;const sample=next.value??{};
  const input={moveX:sample.moveX??0,moveY:sample.moveY??0,jumpReleased:false,restartPressed:false,jumpCancelled:false};
  const len=Math.hypot(input.moveX,input.moveY);if(len>1){input.moveX/=len;input.moveY/=len;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
   input[held]=!!sample[held];const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!previous[held]);
  }
  input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!previous.jumpHeld);previous={...input};frame++;return input;
 }};
}
