/** Review controllers only read rider/meter state and return normal inputs.
 * Placements belong to the caller; these controllers never move the rider. */
const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
const quantize=(sample:any)=>{
  const n=Math.max(1,Math.hypot(sample.moveX||0,sample.moveY||0));
  return {...sample,moveX:Math.round((sample.moveX||0)/n*100)/100,moveY:Math.round((sample.moveY||0)/n*100)/100};
};
function meterControl(p:any,dt:number){
  let previous=0;
  return()=>{const value=p.balanceMeter?.bal??0,axis=clamp(-value*6-(value-previous)/dt*.65);previous=value;return axis;};
}
export function createBalancedGrind(p:any,rail:any,dt:number,sideExit=false){
  const direction=p.axisF.dot(rail.tangentAt(rail.closest(p.pos).t))<0?-1:1;
  const balance=meterControl(p,dt),report={frames:0,grindFrames:0,maxT:0,minT:rail.totalLength,progress:0,direction,maxBalance:0,caught:false,landed:false};
  let exitPopped=false,held=false;
  return {report,sample:()=>{
    const nearEnd=sideExit&&report.progress>rail.totalLength-1.5,release=nearEnd&&!exitPopped&&report.progress>rail.totalLength-.6;
    if(release)exitPopped=true;
    const charge=nearEnd&&!exitPopped,press=charge&&!held;held=charge;
    let moveX=p.state==='grind'?balance():0,moveY=0;
    if(nearEnd){const h=rail.tangentAt(p.grindT).multiplyScalar(direction),camLen=Math.hypot(p.camDir.x,p.camDir.z)||1,wx=-h.z*.55,wz=h.x*.55;moveX=(-p.camDir.z*wx+p.camDir.x*wz)/camLen;moveY=(p.camDir.x*wx+p.camDir.z*wz)/camLen;}
    return quantize({grindHeld:!exitPopped,grindPressed:report.frames===0,moveX,moveY,jumpHeld:charge,jumpPressed:press,jumpReleased:release});
  },observe:()=>{
    report.frames++;
    if(p.state==='grind'&&p.grindRail===rail){report.caught=true;report.grindFrames++;report.maxT=Math.max(report.maxT,p.grindT);report.minT=Math.min(report.minT,p.grindT);report.progress=Math.max(report.progress,direction>0?p.grindT:rail.totalLength-p.grindT);report.maxBalance=Math.max(report.maxBalance,Math.abs(p.balanceMeter?.bal??0));}
    if(exitPopped&&p.state==='air'){report.minT=Math.min(report.minT,p.grindT);report.progress=Math.max(report.progress,direction>0?p.grindT:rail.totalLength-p.grindT);}
    if(report.caught&&p.grounded){if(report.progress<rail.totalLength-.3)throw Error('Long grind left its rail before the end');report.landed=true;return true;}
    return false;
  }};
}
export function createRoofMiniGap(p:any,takeoff:any,receiver:any,dt:number){
  const balance=meterControl(p,dt),report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  let caught=false,popped=false,repress=false,exitPopped=false;
  return {report,sample:()=>{
    const release=caught&&!popped&&p.pos.x>32.6;if(release)popped=true;
    const press=popped&&!repress&&p.pos.x>38.2;if(press)repress=true;
    const exitRelease=report.receivingGrindFrames>=14&&!exitPopped;if(exitRelease)exitPopped=true;
    const side=report.receivingGrindFrames>=10?.55:0,camLen=Math.hypot(p.camDir.x,p.camDir.z)||1,correction=balance();
    return quantize({grindHeld:!popped||repress&&!exitPopped,grindPressed:report.frames===0||press,
      jumpHeld:caught&&!popped||report.receivingGrindFrames>=10&&!exitPopped,jumpPressed:report.takeoffGrindFrames===1||report.receivingGrindFrames===10,jumpReleased:release||exitRelease,
      moveX:side?p.camDir.x/camLen*side:p.state==='grind'?correction:0,moveY:side?p.camDir.z/camLen*side:0});
  },observe:()=>{
    report.frames++;report.air||=p.state==='air';
    if(p.state==='grind'&&p.grindRail===takeoff){caught=true;report.takeoffGrindFrames++;}
    if(p.state==='grind'&&p.grindRail===receiver)report.receivingGrindFrames++;
    if(exitPopped&&p.grounded){if(report.receivingGrindFrames<14||Math.abs(p.pos.y-7)>.08||p.pos.z<17.5)throw Error('Roof Mini Gap missed its roof rollout');report.landed=true;return true;}
    return false;
  }};
}
