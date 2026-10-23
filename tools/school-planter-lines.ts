import {SCHOOL_HALL_PASS,SCHOOL_LAWN_TRANSFER,SCHOOL_PLANTERS,SCHOOL_CLASSROOM_PLANTER,SCHOOL_HUGE_RAIL,schoolLawnHeight} from '../src/levels/school-miami';
const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
const quantize=(s:any)=>{const n=Math.max(1,Math.hypot(s.moveX||0,s.moveY||0));return {...s,moveX:Math.round((s.moveX||0)/n*100)/100,moveY:Math.round((s.moveY||0)/n*100)/100};};
const cameraAxis=(p:any,x:number,z:number)=>{const n=Math.hypot(p.camDir.x,p.camDir.z)||1;return{moveX:(-p.camDir.z*x+p.camDir.x*z)/n,moveY:(p.camDir.x*x+p.camDir.z*z)/n};};
function balanceControl(p:any,dt:number){let previous=0;return()=>{const b=p.balanceMeter?.bal??0,c=clamp(-b*6-(b-previous)/dt*.65);previous=b;return c;};}
function railAt(l:any,p:any,q:number[]){const r=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...q))<.1);if(!r)throw Error('Missing named planter rail');return r;}
export function hallPassRails(l:any,p:any){return {takeoff:railAt(l,p,SCHOOL_HALL_PASS.takeoff[0]),receiver:railAt(l,p,SCHOOL_HALL_PASS.receiver[0])};}
export function lawnTransferRails(l:any,p:any){return {takeoff:railAt(l,p,SCHOOL_LAWN_TRANSFER.takeoff[0]),receiver:railAt(l,p,SCHOOL_LAWN_TRANSFER.receiver[0])};}
export function upperPlanterRails(l:any,p:any){return SCHOOL_PLANTERS.slice(0,4).map(v=>railAt(l,p,[v.p[0]-v.width/2,.6,v.p[2]+v.depth/2]));}

/** Normal controller inputs only. The caller establishes the initial
 * approach; no position, velocity or balance assistance is applied here. */
export function createHallPass(p:any,a:any,b:any,dt:number){
  const balance=balanceControl(p,dt);let popped=false,armed=false,exitPopped=false,held=false;
  const report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  return {report,sample:()=>{
    const release=report.takeoffGrindFrames>0&&!popped&&a.totalLength-p.grindT<1;if(release)popped=true;
    const repress=popped&&!armed&&p.pos.z<b.points[0].z+1.5;if(repress)armed=true;
    const exitRelease=report.receivingGrindFrames>=14&&!exitPopped;if(exitRelease)exitPopped=true;
    const charge=report.takeoffGrindFrames>0&&!popped||report.receivingGrindFrames>=10&&!exitPopped,press=charge&&!held;held=charge;
    const axes=report.receivingGrindFrames>=10?cameraAxis(p,.55,0):{moveX:p.state==='grind'?balance():0,moveY:0};
    return quantize({...axes,grindHeld:(!popped||armed)&&!exitPopped&&p.pos.z<a.points[0].z+1.3,grindPressed:repress,jumpHeld:charge,jumpPressed:press,jumpReleased:release||exitRelease});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'){if(p.grindRail===a)report.takeoffGrindFrames++;else if(p.grindRail===b)report.receivingGrindFrames++;else throw Error('Hall Pass caught a different rail');}
    if(report.air&&p.grounded){if(report.takeoffGrindFrames<20||report.receivingGrindFrames<14||Math.abs(p.pos.y)>.08)throw Error('Hall Pass missed the alcove or roof rollout');report.landed=true;return true;}
    return false;
  }};
}
export function createUpperPlanterChain(p:any,rails:any[],dt:number){
  const balance=balanceControl(p,dt);let index=0,popped=false,armed=false,held=false;
  const report={frames:0,grindFrames:rails.map(()=>0),transfers:0,landed:false};
  return {report,sample:()=>{
    const active=p.state==='grind'?rails.indexOf(p.grindRail):-1;
    if(active>index){if(active!==index+1)throw Error('Planter chain skipped a planter');index=active;report.transfers++;popped=false;armed=false;}
    const release=index<rails.length-1&&active===index&&!popped&&rails[index].totalLength-p.grindT<.8;if(release)popped=true;
    const repress=popped&&!armed&&p.pos.x>rails[index+1].points[0].x-1;if(repress)armed=true;
    const charge=active===index&&index<rails.length-1&&!popped,press=charge&&!held;held=charge;
    return quantize({moveX:active>=0?balance():0,moveY:0,grindHeld:!popped||armed,grindPressed:report.frames===0||repress,jumpHeld:charge,jumpPressed:press,jumpReleased:release});
  },observe:()=>{
    report.frames++;const active=p.state==='grind'?rails.indexOf(p.grindRail):-1;
    if(p.state==='grind'&&active<0)throw Error('Planter chain caught a different rail');if(active>=0)report.grindFrames[active]++;
    if((popped||index===rails.length-1)&&p.grounded){if(report.grindFrames.some(n=>n<8)||report.transfers!==3||Math.abs(p.pos.y)>.06)throw Error('Planter chain landed before all four planters');report.landed=true;return true;}
    return false;
  }};
}
export function createLawnTransfer(p:any,a:any,b:any,dt:number){
  const balance=balanceControl(p,dt);let popped=false,armed=false,exitPopped=false,held=false;
  const report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  return {report,sample:()=>{
    const release=report.takeoffGrindFrames>0&&!popped&&a.totalLength-p.grindT<1;if(release)popped=true;
    const repress=popped&&!armed&&p.pos.x>b.points[0].x-1.5;if(repress)armed=true;
    const aroundCorner=report.receivingGrindFrames>0&&p.grindT>12,exitRelease=aroundCorner&&!exitPopped&&p.grindT>14;if(exitRelease)exitPopped=true;
    const charge=report.takeoffGrindFrames>0&&!popped||aroundCorner&&!exitPopped,press=charge&&!held;held=charge;
    const axes=aroundCorner?cameraAxis(p,-.55,0):{moveX:p.state==='grind'?balance():0,moveY:0};
    return quantize({...axes,grindHeld:(!popped||armed)&&!exitPopped,grindPressed:report.frames===0||repress,jumpHeld:charge,jumpPressed:press,jumpReleased:release||exitRelease});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'){if(p.grindRail===a)report.takeoffGrindFrames++;else if(p.grindRail===b)report.receivingGrindFrames++;else throw Error('Lawn transfer caught a different rail');}
    if(report.air&&p.grounded){if(report.receivingGrindFrames<8||p.pos.x<46||p.pos.x>56||p.pos.z< -23.5||p.pos.z>3.5||Math.abs(p.pos.y-schoolLawnHeight(p.pos.z,.12))>.08)throw Error('Lawn transfer missed its receiving planter rollout');report.landed=true;return true;}
    return false;
  }};
}

export function classroomTransferRails(l:any,p:any){return {takeoff:railAt(l,p,SCHOOL_CLASSROOM_PLANTER[0]),receiver:railAt(l,p,[SCHOOL_HUGE_RAIL[0][0],SCHOOL_HUGE_RAIL[0][1]+.05,SCHOOL_HUGE_RAIL[0][2]])};}
export function createClassroomTransfer(p:any,a:any,b:any,dt:number){
  const balance=balanceControl(p,dt),end=a.points.at(-1),start=b.points[0],h=start.clone().sub(end).setY(0).normalize(),gap=start.clone().sub(end).setY(0).length();
  let popped=false,armed=false,held=false;
  const report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,receivingProgress:0,air:false,landed:false};
  return{report,sample:()=>{
    const release=report.takeoffGrindFrames>0&&!popped&&a.totalLength-p.grindT<.8;if(release)popped=true;
    const repress=popped&&!armed&&p.pos.clone().sub(end).dot(h)>gap-1.3;if(repress)armed=true;
    const charge=report.takeoffGrindFrames>0&&!popped,press=charge&&!held;held=charge;
    return quantize({moveX:p.state==='grind'?balance():0,moveY:0,grindHeld:!popped||armed,grindPressed:report.frames===0||repress,jumpHeld:charge,jumpPressed:press,jumpReleased:release});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'){if(p.grindRail===a)report.takeoffGrindFrames++;else if(p.grindRail===b){report.receivingGrindFrames++;report.receivingProgress=Math.max(report.receivingProgress,p.grindT);}else throw Error('Classroom transfer caught a different rail');}
    if(p.state==='air'&&p.lastRail===b)report.receivingProgress=Math.max(report.receivingProgress,p.grindT);
    if(report.air&&p.grounded){if(report.receivingGrindFrames<8||report.receivingProgress<b.totalLength-.3||Math.abs(p.pos.y+5)>.08)throw Error('Classroom transfer missed its full quarter grind or yard rollout');report.landed=true;return true;}
    return false;
  }};
}
