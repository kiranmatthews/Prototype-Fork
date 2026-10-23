import { SCHOOL_KICKER, SCHOOL_CORRIDOR_EXIT, SCHOOL_LONG_HALFPIPE, SCHOOL_PLANTERS, SCHOOL_START_CANOPY, SCHOOL_LONG_ASS_RAIL, schoolMapPoint } from '../src/levels/school-miami';

type Point=[number,number,number];

/** A complete native-spawn circuit. This controller only reads the rider
 * and produces ordinary stick/button input; it never places or pushes it. */
export function createSchoolCircuit(p:any,scale=1){
  const authored:Point[]=[
    ...SCHOOL_START_CANOPY.slice(2),[36,0,SCHOOL_PLANTERS[7].p[2]+.825],
    [41,0,-2],[43,0,-8],[41,-2,-22],[39,-5,-36],[34,-5,-40],[27,-5,-49],
    [18,-5,-58],[18,-5,-64],[26,-5,-69],[27,-5,-70],[22,-5,-70],
    [12,-5,-70],[0,-5,-70],[-17,-5,-71],
    ...SCHOOL_LONG_HALFPIPE.slice(0,-3).reverse(),...SCHOOL_CORRIDOR_EXIT.slice(1),[-76,-5,-27],
    ...[[42,196],[61,205],[95,211],[131,215],[166,213]].map(([u,v])=>schoolMapPoint(u,v)),
    [-33.5,-5,-26],...SCHOOL_LONG_ASS_RAIL.filter((_,i,a)=>i%12===0||i===a.length-1).reverse(),[4,0,1],
  ];
  const points=authored.map(q=>q.map(v=>v*scale) as Point);
  let index=0,popped=false,heldBefore=false,previousBalance=0,returnPopped=false;
  const last=p.pos.clone();
  const report={frames:0,waypoints:0,totalWaypoints:points.length,distance:0,gimmeGrindFrames:0,returnGrindFrames:0,kickerAir:false,kickerLanded:false};
  return {
    report,
    sample(){
      const q=points[index];
      if(q&&Math.hypot(p.pos.x-q[0],p.pos.z-q[2])<(index<3?1.2:index>=27&&index<=30?1.1:2.2)*scale&&(index!==3||(p.grounded&&p.state==='ride'))){index++;report.waypoints=index;}
      if(index===points.length)return {};
      const target=points[index],a=Math.atan2(target[0]-p.pos.x,-(target[2]-p.pos.z)),b=Math.atan2(p.axisF.x,-p.axisF.z);
      const delta=Math.atan2(Math.sin(a-b),Math.cos(a-b)),turn=Math.max(-1,Math.min(1,delta*3));
      const k=SCHOOL_KICKER,h=k.direction;
      if(index>=8&&(k.x*scale-p.pos.x)*h[0]+(k.z*scale-p.pos.z)*h[2]<k.gap*scale/2+.9)popped=true;
      const returnGrind=index>=38&&p.state==='grind',openingGrind=index<=3&&p.state==='grind',bal=p.balanceMeter?.bal??0,balance=Math.max(-1,Math.min(1,-bal*6-(bal-previousBalance)*60*.65));previousBalance=bal;
      const nearReturn=returnGrind&&p.grindT<2.1;
      const aimExit=nearReturn&&p.grindT<1.35;
      if(nearReturn&&p.grindT<1.2)returnPopped=true;
      const held=index>=6&&!popped||nearReturn&&!returnPopped;
      let sideX=0,sideY=0;
      if(aimExit){const t=p.grindRail.tangentAt(p.grindT).multiplyScalar(p.grindDir),n=Math.hypot(p.camDir.x,p.camDir.z)||1,wx=t.z*.8,wz=-t.x*.8;sideX=(-p.camDir.z*wx+p.camDir.x*wz)/n;sideY=(p.camDir.x*wx+p.camDir.z*wz)/n;}
      const input={moveX:+(aimExit?sideX:returnGrind||openingGrind?balance:turn).toFixed(2),moveY:aimExit?+sideY.toFixed(2):returnGrind||openingGrind?0:+Math.sqrt(1-turn*turn).toFixed(2),
        grindHeld:index<=3||index>=38&&p.pos.x>-33*scale&&!returnPopped,grindPressed:report.frames===0,
        jumpHeld:held,jumpPressed:held&&!heldBefore,jumpReleased:!held&&heldBefore,
        // Return to cruising speed before the narrow perimeter bends.
        grabHeld:index>=10&&p.grounded&&((index>=17&&index<=19||index>=27&&index<=30||index===points.length-1)?(p.speed>4.5||Math.abs(delta)>.35):p.speed>12.5)};
      // Release the directional ollie input during flight; air steering is
      // a spin command, so resume road steering only after the wheels land.
      if(p.state==='air'){input.moveX=0;input.moveY=0;}
      heldBefore=held;return input;
    },
    observe(){
      report.frames++;report.distance+=last.distanceTo(p.pos);last.copy(p.pos);
      const planter=SCHOOL_PLANTERS[7];
      if(p.state==='grind'&&p.grindRail?.points.some((q:any)=>Math.abs(q.x-(planter.p[0]-2)*scale)<.03&&Math.abs(q.y-.6*scale)<.02))report.gimmeGrindFrames++;
      if(index>=38&&p.state==='grind'&&p.grindRail?.points.some((q:any)=>Math.abs(q.x-SCHOOL_LONG_ASS_RAIL[0][0]*scale)<.02&&Math.abs(q.y-SCHOOL_LONG_ASS_RAIL[0][1]*scale)<.02))report.returnGrindFrames++;
      if(index>=8&&index<=10&&p.state==='air')report.kickerAir=true;
      if(report.kickerAir&&index>=10&&p.grounded)report.kickerLanded=true;
      if(index<points.length)return false;
      if(report.gimmeGrindFrames<5||report.returnGrindFrames<30||!report.kickerLanded)throw Error('Campus circuit skipped its opening grind or Kicker Gap landing');
      return true;
    },
  };
}
