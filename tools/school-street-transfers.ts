import {SCHOOL_MINI_GAP,SCHOOL_PARK_GAP,SCHOOL_TABLES,SCHOOL_LONG_ASS_RAIL,SCHOOL_WEST_WEDGE,schoolMapPoint} from '../src/levels/school-miami';
type Point=[number,number,number];
const quantize=(sample:any)=>{const n=Math.max(1,Math.hypot(sample.moveX||0,sample.moveY||0));return {...sample,moveX:Math.round((sample.moveX||0)/n*100)/100,moveY:Math.round((sample.moveY||0)/n*100)/100};};
const cameraAxis=(p:any,wx:number,wz:number)=>{const n=Math.hypot(p.camDir.x,p.camDir.z)||1;return{moveX:(-p.camDir.z*wx+p.camDir.x*wz)/n,moveY:(p.camDir.x*wx+p.camDir.z*wz)/n};};
function nearStart(l:any,p:any,q:Point){return l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...q))<.3);}
export function schoolStreetTrials(l:any,p:any){
  const miniEnd=p.pos.clone().set(...SCHOOL_MINI_GAP.takeoffCoping).add(p.pos.clone().set(0,.05,0));
  const outer=l.rails.find((r:any)=>r.points.at(-1).distanceTo(miniEnd)<.3);
  const sign=schoolMapPoint(352,78);sign[1]=-2.45;
  const table=SCHOOL_TABLES[3],rad=table.yaw*Math.PI/180;
  const tableRails=[-1,1].map(side=>nearStart(l,p,[table.p[0]+side*.48*Math.cos(rad)-1.6*Math.sin(rad),table.p[1]+.79,table.p[2]-side*.48*Math.sin(rad)-1.6*Math.cos(rad)]));
  const long=nearStart(l,p,SCHOOL_LONG_ASS_RAIL[0]);
  return [
    {name:'Funbox to perimeter rail',centre:schoolMapPoint(331,74),heading:[-.92,0,.392] as Point,speed:14,release:.7,rails:[outer],exit:[.55,0] as [number,number]},
    {name:'Funbox to Table',centre:schoolMapPoint(331,74),heading:[-.18,0,.984] as Point,speed:12,release:1.1,rails:tableRails,armZ:-68.2},
    {name:'Funbox to Playground Rail',centre:schoolMapPoint(471,106),heading:[-.98,0,-.199] as Point,speed:14,release:.4,rails:[nearStart(l,p,sign)],exit:[0,.55] as [number,number]},
    {name:'West wedge to Long Ass Rail',centre:SCHOOL_WEST_WEDGE.p,heading:[-.4,0,-.9165] as Point,speed:14,release:1.7,approach:3,rails:[long]},
  ];
}
/** One grounded approach, a real charged ollie, the intended rail and a
 * supported rollout. The controller never alters position or velocity. */
export function createStreetTransfer(p:any,c:ReturnType<typeof schoolStreetTrials>[number],dt:number){
  if(c.rails.some(r=>!r))throw Error(`${c.name}: missing receiving rail`);
  const h=p.axisF.clone().set(...c.heading).normalize();
  let popped=false,popFrame=-100,exitPopped=false,previous=0;
  const report={frames:0,air:false,takeoffY:0,receivingGrindFrames:0,landed:false};
  return {report,sample:()=>{
    const d=(c.centre[0]-p.pos.x)*h.x+(c.centre[2]-p.pos.z)*h.z,release=!popped&&d<c.release;
    if(release){popped=true;popFrame=report.frames;report.takeoffY=p.pos.y;}
    const exitCharge=!!c.exit&&report.receivingGrindFrames>=8&&!exitPopped,exitRelease=!!c.exit&&report.receivingGrindFrames>=12&&!exitPopped;if(exitRelease)exitPopped=true;
    const b=p.balanceMeter?.bal??0,correction=Math.max(-1,Math.min(1,-b*6-(b-previous)/dt*.65));previous=b;
    const side=c.exit&&report.receivingGrindFrames>=8?cameraAxis(p,...c.exit):{moveX:p.state==='grind'?correction:0,moveY:0};
    const grind=popped&&report.frames>popFrame+3&&(c.armZ===undefined||p.pos.z>c.armZ)&&!exitPopped;
    return quantize({...side,jumpHeld:!popped||exitCharge&&!exitRelease,jumpPressed:report.frames===0||report.receivingGrindFrames===8&&!!c.exit,jumpReleased:release||exitRelease,grindHeld:grind});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'){if(!c.rails.includes(p.grindRail))throw Error(`${c.name}: caught a different rail`);report.receivingGrindFrames++;}
    if(report.air&&p.grounded){if(report.receivingGrindFrames<8||report.takeoffY< -4.7)throw Error(`${c.name}: landed before the intended transfer`);report.landed=true;return true;}
    return false;
  }};
}
export function parkGapRails(l:any,p:any){
  const a=p.pos.clone().set(...SCHOOL_PARK_GAP.takeoff).add(p.pos.clone().set(0,.05,0)),b=p.pos.clone().set(...SCHOOL_PARK_GAP.receiver).add(p.pos.clone().set(0,.05,0));
  return {takeoff:l.rails.find((r:any)=>r.points.at(-1).distanceTo(a)<.3),receiver:l.rails.find((r:any)=>r.points[0].distanceTo(b)<.3)};
}
export function createParkGap(p:any,a:any,b:any,dt:number,exit:[number,number]=[-.55,0],exitFrames=12){
  if(!a||!b)throw Error('Park Gap coping missing');
  let popped=false,armed=false,previous=0,held=false,exitPopped=false;
  const end=a.points.at(-1),start=b.points[0],h=start.clone().sub(end).setY(0).normalize(),gap=start.distanceTo(end);
  const report={frames:0,takeoffGrindFrames:0,receivingGrindFrames:0,air:false,landed:false};
  return {report,sample:()=>{
    const release=!popped&&report.takeoffGrindFrames>0&&p.pos.distanceTo(end)<.85;if(release)popped=true;
    const press=popped&&!armed&&p.pos.clone().sub(end).dot(h)>gap-1.3;if(press)armed=true;
    const exitRelease=report.receivingGrindFrames>=exitFrames&&!exitPopped;if(exitRelease)exitPopped=true;
    const charge=!popped&&report.takeoffGrindFrames>0||report.receivingGrindFrames>=exitFrames-4&&!exitPopped,chargePress=charge&&!held;held=charge;
    const bal=p.balanceMeter?.bal??0,correction=Math.max(-1,Math.min(1,-bal*6-(bal-previous)/dt*.65));previous=bal;
    const axes=report.receivingGrindFrames>=exitFrames-4?cameraAxis(p,...exit):{moveX:p.state==='grind'?correction:0,moveY:0};
    return quantize({...axes,jumpHeld:charge,jumpPressed:chargePress,jumpReleased:release||exitRelease,grindHeld:(!popped||armed)&&!exitPopped,grindPressed:report.frames===0||press});
  },observe:()=>{
    report.frames++;report.air||=popped&&p.state==='air';
    if(p.state==='grind'&&p.grindRail===a)report.takeoffGrindFrames++;
    if(p.state==='grind'&&p.grindRail===b)report.receivingGrindFrames++;
    if(report.air&&p.grounded){if(report.receivingGrindFrames<8||Math.abs(p.pos.y+5)>.08)throw Error('Park Gap missed its receiving quarter or yard rollout');report.landed=true;return true;}
    return false;
  }};
}

export function miniGapRails(l:any,p:any){
  const a=p.pos.clone().set(...SCHOOL_MINI_GAP.takeoffCoping).add(p.pos.clone().set(0,.05,0)),b=p.pos.clone().set(...SCHOOL_MINI_GAP.receiverCoping).add(p.pos.clone().set(0,.05,0));
  return {takeoff:l.rails.find((r:any)=>r.points.at(-1).distanceTo(a)<.3),receiver:l.rails.find((r:any)=>r.points[0].distanceTo(b)<.3)};
}
