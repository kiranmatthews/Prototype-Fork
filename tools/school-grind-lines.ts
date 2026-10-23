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
export function createBalancedGrind(p:any,rail:any,dt:number,sideExit=false,returnOnReversal=false){
  const direction=p.axisF.dot(rail.tangentAt(rail.closest(p.pos).t))<0?-1:1;
  const balance=meterControl(p,dt),report={frames:0,grindFrames:0,maxT:0,minT:rail.totalLength,progress:0,direction,maxBalance:0,caught:false,landed:false,...(returnOnReversal?{reversed:false,turnT:0}: {})};
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
    if(returnOnReversal&&p.state==='grind'&&p.grindRail===rail&&p.grindDir!==direction&&!report.reversed){report.reversed=true;report.turnT=p.grindT;}
    if(p.state==='grind'&&p.grindRail===rail){report.caught=true;report.grindFrames++;report.maxT=Math.max(report.maxT,p.grindT);report.minT=Math.min(report.minT,p.grindT);report.progress=Math.max(report.progress,direction>0?p.grindT:rail.totalLength-p.grindT);report.maxBalance=Math.max(report.maxBalance,Math.abs(p.balanceMeter?.bal??0));}
    // Natural run-off advances grindT to the exact endpoint before changing
    // state. Include that last step, not only samples still marked grind.
    if(p.state==='air'&&(exitPopped||report.caught&&p.lastRail===rail)){report.maxT=Math.max(report.maxT,p.grindT);report.minT=Math.min(report.minT,p.grindT);report.progress=Math.max(report.progress,direction>0?p.grindT:rail.totalLength-p.grindT);}
    if(report.caught&&p.grounded){
      if(returnOnReversal){
        const returned=direction>0?report.minT<.3:report.maxT>rail.totalLength-.3;
        if(!report.reversed||report.progress<5||!returned)throw Error('Uphill grind did not reverse and return through its starting endpoint');
      }else if(report.progress<rail.totalLength-.3)throw Error('Long grind left its rail before the end');
      report.landed=true;return true;
    }
    return false;
  }};
}
export function createRoofMiniGap(p:any,takeoff:any,receiver:any,dt:number,scale=1){
  const balance=meterControl(p,dt),report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  const exitAt=scale>1.5?34:14;
  let caught=false,popped=false,repress=false,exitPopped=false;
  return {report,sample:()=>{
    const release=caught&&!popped&&p.pos.x>32.6*scale;if(release)popped=true;
    const press=popped&&!repress&&p.pos.x>38.2*scale;if(press)repress=true;
    const exitRelease=report.receivingGrindFrames>=exitAt&&!exitPopped;if(exitRelease)exitPopped=true;
    // Side intent must precede the release edge. Stop it once airborne so
    // the deliberate launch does not become an unrelated air-turn command.
    const side=scale>1.5?(p.state==='grind'&&report.receivingGrindFrames>=exitAt-2?1:0):(report.receivingGrindFrames>=10?.55:0),camLen=Math.hypot(p.camDir.x,p.camDir.z)||1,correction=balance();
    return quantize({grindHeld:!popped||repress&&!exitPopped,grindPressed:report.frames===0||press,
      jumpHeld:caught&&!popped||report.receivingGrindFrames>=10&&!exitPopped,jumpPressed:report.takeoffGrindFrames===1||report.receivingGrindFrames===10,jumpReleased:release||exitRelease,
      moveX:side?p.camDir.x/camLen*side:p.state==='grind'?correction:0,moveY:side?p.camDir.z/camLen*side:0});
  },observe:()=>{
    report.frames++;report.air||=p.state==='air';
    if(p.state==='grind'&&p.grindRail===takeoff){caught=true;report.takeoffGrindFrames++;}
    if(p.state==='grind'&&p.grindRail===receiver)report.receivingGrindFrames++;
    if(exitPopped&&p.grounded){if(report.receivingGrindFrames<exitAt||Math.abs(p.pos.y-7*scale)>.08||p.pos.z<17.5*scale)throw Error('Roof Mini Gap missed its roof rollout');report.landed=true;return true;}
    return false;
  }};
}

export function createPerimeterMiniGap(p:any,a:any,b:any,dt:number,scale=1){
  const balance=meterControl(p,dt),report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  // At the enlarged scale, continue round the rear corner before exiting
  // inward; popping along the straight aims across the classroom frontage.
  const exitAt=scale>1.5?440:60;
  let popped=false,armed=false,exitPopped=false,held=false;
  const end=a.points.at(-1),start=b.points[0],h=start.clone().sub(end).setY(0).normalize(),gap=start.distanceTo(end);
  return{report,sample:()=>{
    const release=!popped&&report.takeoffGrindFrames>0&&a.totalLength-p.grindT<(scale>1.5?3:.85);if(release)popped=true;
    const repress=popped&&!armed&&p.pos.clone().sub(end).dot(h)>gap-1.3;if(repress)armed=true;
    const exitCharge=report.receivingGrindFrames>=exitAt-8&&!exitPopped,exitRelease=report.receivingGrindFrames>=exitAt&&!exitPopped;if(exitRelease)exitPopped=true;
    const charge=!popped&&report.takeoffGrindFrames>0||exitCharge&&!exitRelease,press=charge&&!held;held=charge;
    let moveX=p.state==='grind'?balance():0,moveY=0;
    if(scale>1.5?p.state==='grind'&&report.receivingGrindFrames>=exitAt-2:exitCharge||exitRelease){const t=b.tangentAt(p.grindT),n=Math.hypot(p.camDir.x,p.camDir.z)||1,side=scale>1.5?1:.8,wx=-t.z*side,wz=t.x*side;moveX=(-p.camDir.z*wx+p.camDir.x*wz)/n;moveY=(p.camDir.x*wx+p.camDir.z*wz)/n;}
    return quantize({moveX,moveY,grindHeld:(!popped||armed)&&!exitPopped,grindPressed:report.frames===0||repress,jumpHeld:charge,jumpPressed:press,jumpReleased:release||exitRelease});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'){if(p.grindRail===a)report.takeoffGrindFrames++;else if(p.grindRail===b)report.receivingGrindFrames++;else throw Error('Mini Gap caught a different rail');}
    if(report.air&&p.grounded){if(report.receivingGrindFrames<exitAt||Math.abs(p.pos.y+5*scale)>.08)throw Error('Mini Gap missed its receiving quarter or yard rollout');report.landed=true;return true;}
    return false;
  }};
}
