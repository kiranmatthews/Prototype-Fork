// One supported placement precedes each fixture; subsequent motion is ordinary
// controller input. The same pilot runs in the native and production browser.
export const mallRailFixtures = [
 {name:'Concourse bench',start:[-11100,314.7586,968.0928],target:[-11529.2539,355.9365,968.0928],direction:[0,0,1],lead:4.5,exitSide:1},
 {name:'First concourse display ledge',start:[-13600,314.7586,349.7578],target:[-13107.0352,355.9365,369.8467],direction:[.04072,0,-.99917],lead:6.5,exitSide:0},
 {name:'Up-escalator inside handrail',start:[-13300,314.7586,10],target:[-13107.0352,380.833,-9.0332],direction:[-.01652,0,-.99986],lead:3,exitSide:1},
 {name:'Concourse display, both bends and outward exit',start:[-13600,314.7586,349.7578],target:[-13107.0352,355.9365,369.8467],direction:[.04072,0,-.99917],lead:6.5,exitLead:8,exitSide:1,rolloutFrames:30},
 {name:'Crossrail low arch',start:[5500,-1467,5780],target:[4801,-1466.5,5910.4],direction:[.18229,0,.98324],lead:5,exitSide:-1},
];

export function createMallRailPilot(f,m,l,p,Vector3){
 const target=new Vector3(...m.mallPoint(...f.target)),heading=new Vector3(...f.direction);
 const targetRail=l.rails.map((rail,i)=>({i,d:rail.closest(target).distance})).sort((a,b)=>a.d-b.d)[0].i;
 const e={name:f.name,start:p.pos.toArray(),targetRail,frames:0,grindFrames:0,grindDistance:0,rails:[],bail:false,landed:false,groundFrames:0,crossedNodes:[],corners:[],maxBalance:0,done:false,trace:[]};
 let launched=false,exited=false,previous=p.pos.clone(),priorRail=null,priorT=0,priorSpeed=0;
 const long=f.exitLead!==undefined;
 return {e,sample(){
  const remaining=target.clone().sub(p.pos).dot(heading);
  if(remaining<f.lead)launched=true;
  const grinding=p.state==='grind',toEnd=grinding?p.grindRail.totalLength-p.grindT:Infinity;
  if(!long&&e.grindFrames>=24||long&&toEnd<f.exitLead||e.grindFrames>0&&!grinding)exited=true;
  const exitIntent=long?toEnd<f.exitLead+.6:e.grindFrames>=22;
  const steer=(heading.x*-p.axisF.z+heading.z*p.axisF.x)*3;
  const moveX=grinding?(exitIntent?(f.exitSide??0):Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))):p.grounded?Math.max(-1,Math.min(1,steer)):0;
  priorRail=p.grindRail;priorT=p.grindT;priorSpeed=p.grindVel;
  return {moveX,moveY:grinding?(exitIntent?0:1):p.grounded?heading.dot(p.axisF):0,jumpHeld:grinding?!exited:!launched,grindHeld:launched&&!exited&&(grinding||!p.grounded)};
 },observe(){
  e.frames++;
  if(p.state==='grind'){
   e.grindFrames++;e.maxBalance=Math.max(e.maxBalance,Math.abs(p.balance));
   // Exclude the initial air-to-rail snap from measured grind travel.
   if(priorRail===p.grindRail)e.grindDistance+=p.pos.distanceTo(previous);
   const rail=l.rails.indexOf(p.grindRail);if(!e.rails.includes(rail))e.rails.push(rail);
  }
  if(priorRail&&p.grindRail===priorRail){
   let boundary=0;
   for(let node=1;node<priorRail.points.length-1;node++){
    boundary+=priorRail.points[node].distanceTo(priorRail.points[node-1]);
    if(boundary>Math.min(priorT,p.grindT)&&boundary<=Math.max(priorT,p.grindT)){
     const sourceNode=m.MALL_RAILS[l.rails.indexOf(priorRail)].sourceNodes[node];
     if(!e.crossedNodes.includes(sourceNode))e.crossedNodes.push(sourceNode);
     e.corners.push({node:sourceNode,entrySpeed:priorSpeed,exitSpeed:p.grindVel});
    }
   }
  }
  e.bail||=p.isBailing;previous.copy(p.pos);e.end=m.mallSourcePoint(...p.pos.toArray());
  if(exited&&p.grounded&&p.state==='ride')e.groundFrames++;else e.groundFrames=0;
  if(e.groundFrames>=(f.rolloutFrames??1))e.landed=true;
  e.done=e.landed||e.bail||['dead','gameover'].includes(p.state)||e.frames>=720;
  if(e.frames%5===0||e.done)e.trace.push({frame:e.frames,source:e.end,state:p.state,speed:p.speed,balance:p.balance,balanceVelocity:p.balanceVel,rail:p.grindRail?l.rails.indexOf(p.grindRail):null});
 }};
}
