// Test-only feedback pilot. It issues ordinary controls and never moves the
// rider, rail, machine clock or balance needle.
export function grindPilot(beat,jumps,point,{bypass=false,noPop=false}={}){
 const route=beat.launches.map(name=>jumps.find(j=>j.name===name));
 let active=-1,popping=false,previousJump=false,previousGrind=false,runout=false;
 const catches=[],launches=[],pops=[];
 const inputFor=(values={})=>{
  const input={moveX:0,moveY:0,jumpHeld:false,grindHeld:false,...values};
  input.jumpPressed=input.jumpHeld&&!previousJump;input.jumpReleased=!input.jumpHeld&&previousJump;
  input.grindPressed=input.grindHeld&&!previousGrind;previousJump=input.jumpHeld;previousGrind=input.grindHeld;
  return input;
 };
 const drive=(p,target)=>{
  const dx=target[0]-p.at[0],dz=target[2]-p.at[2],f=dx*p.forward[0]+dz*p.forward[2],side=dx*p.side[0]+dz*p.side[2];
  let forward=Math.abs(f)>1?Math.sign(f):0;
  if(!bypass&&p.spring&&p.mounted){
   // Brake into a rail's long receiving window instead of relying on a snap
   // to erase full board momentum. Coast only within a small speed deadband.
   const desired=Math.max(-20,Math.min(20,f/Math.max(.3,p.vy>0?p.vy/33+.5:.6)));
   forward=Math.abs(desired-p.speed)>1.2?Math.sign(desired-p.speed):0;
  }
  return {moveY:forward,moveX:Math.abs(side)>1?Math.sign(side):0};
 };
 return {catches,launches,pops,sample(p){
  if(beat.gate&&p.state==='finished')return{done:true,input:inputFor(),active};
  if(runout)return{input:inputFor(drive(p,point(4001,12))),active};
  const index=route.findIndex(j=>j.name===p.surface);
  if(p.spring&&p.vy>15&&index>=0&&index!==active){active=index;popping=false;launches.push(p.surface);}
  const atFinish=point(...beat.finish),distance=Math.hypot(p.at[0]-atFinish[0],p.at[2]-atFinish[2]);
  if(active===route.length-1&&p.grounded&&distance<17&&Math.abs(p.at[1]-atFinish[1])<3){
   if(beat.gate){runout=true;return{input:inputFor(drive(p,point(4001,12))),active};}
   return{done:true,input:inputFor(),active};}
  if(p.state==='grind'){
   const rail=beat.rails.find(r=>r.name===p.rail);
   if(!rail)throw Error('Unexpected grind '+p.rail);
   if(!catches.includes(p.rail))catches.push(p.rail);
   const remaining=p.railLength-p.railT;
   if(!noPop&&rail.popTo&&remaining<2.4){popping=true;pops.push(p.rail);return{input:inputFor(),active};}
   const balance=-p.balance*5-p.balanceVel*.7;
   // Keep the incoming Jump hold until the intended exit. Releasing it on
   // the first browser sample after a catch is itself a real rail ollie.
   return{input:inputFor({moveX:rail.popTo&&remaining<8?0:Math.abs(balance)>.12?Math.sign(balance):0,jumpHeld:!noPop}),active};
  }
  if(popping&&!p.spring)return{input:inputFor({jumpHeld:p.vy<0}),active};
  const jump=route[Math.max(0,active)];
  const target=active<0?point(...jump.from):point(...(bypass&&jump.rail?(route[active+1]?.from??beat.finish):jump.to));
  const controls=drive(p,target);
  if(active<0)controls.jumpHeld=Math.hypot(p.at[0]-target[0],p.at[2]-target[2])<10;
  else{controls.jumpHeld=true;controls.grindHeld=!bypass&&!!jump.rail&&p.vy<5;
   // Meet the receiving rail travelling forward. Aiming to stop on one
   // mathematical point can reverse the catch when browser frames vary.
   if(!bypass&&jump.rail&&p.vy<0&&p.speed<2)controls.moveY=1;}
  // A normal rail run-off retains its tangent/momentum until it reaches the
  // receiving deck; air direction buttons would request skate tricks here.
  if(!p.spring&&!p.grounded&&catches.length&&!popping)return{input:inputFor(),active};
  return{input:inputFor(controls),active};
 }};
}

export const observeGrindPlayer=(p,level)=>{const f=level?p.courseInputDirection(level)??p.camDir:p.camDir;return{at:p.pos.toArray(),state:p.state,grounded:p.grounded,
 forward:[f.x,0,f.z],side:[-f.z,0,f.x],speed:p.speed,vy:p.vVel,surface:p.surfaceName,
 spring:p.trampolineAir,mounted:p.freeSkate||p.airFromSkate,rail:p.grindRail?.object.userData.sourceName,
 railT:p.grindT,railLength:p.grindRail?.totalLength,balance:p.balance,balanceVel:p.balanceVel,
 bail:p.isBailing,deaths:p.totalDeaths,time:p.runTime};};
