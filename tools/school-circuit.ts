import { SCHOOL_KICKER, SCHOOL_LONG_HALFPIPE, SCHOOL_PLANTERS, SCHOOL_START_CANOPY, SCHOOL_WEST_DESCENT, schoolMapPoint } from '../src/levels/school-miami';

type Point=[number,number,number];

/** A complete native-spawn circuit. This controller only reads the rider
 * and produces ordinary stick/button input; it never places or pushes it. */
export function createSchoolCircuit(p:any){
  const points:Point[]=[
    ...SCHOOL_START_CANOPY.slice(2),[36,0,SCHOOL_PLANTERS[7].p[2]+.825],
    [41,0,-2],[43,0,-8],[41,-2,-22],[39,-5,-36],[34,-5,-40],[27,-5,-49],
    [18,-5,-58],[18,-5,-64],[26,-5,-69],[27,-5,-76],[22,-5,-83],
    [12,-5,-85],[0,-5,-85],[-12,-5,-84],[-17.3,-5,-82.6],
    ...SCHOOL_LONG_HALFPIPE.slice(0,-1).reverse(),[-75,-5,-41],[-76,-5,-27],
    ...[[42,196],[61,205],[95,211],[131,215],[166,213]].map(([u,v])=>schoolMapPoint(u,v)),
    [-31,-5,-28],...SCHOOL_WEST_DESCENT.slice(0,-2).reverse(),[4,0,1],
  ];
  let index=0,popped=false,heldBefore=false;
  const last=p.pos.clone();
  const report={frames:0,waypoints:0,totalWaypoints:points.length,distance:0,gimmeGrindFrames:0,kickerAir:false,kickerLanded:false};
  return {
    report,
    sample(){
      const q=points[index];
      if(q&&Math.hypot(p.pos.x-q[0],p.pos.z-q[2])<(index<3?1.2:2.2)&&(index!==3||(p.grounded&&p.state==='ride'))){index++;report.waypoints=index;}
      if(index===points.length)return {};
      const target=points[index],a=Math.atan2(target[0]-p.pos.x,-(target[2]-p.pos.z)),b=Math.atan2(p.axisF.x,-p.axisF.z);
      const delta=Math.atan2(Math.sin(a-b),Math.cos(a-b)),turn=Math.max(-1,Math.min(1,delta*3));
      const k=SCHOOL_KICKER,h=k.direction;
      if(index>=8&&(k.x-p.pos.x)*h[0]+(k.z-p.pos.z)*h[2]<k.gap/2+.9)popped=true;
      const held=index>=6&&!popped;
      const input={moveX:+turn.toFixed(2),moveY:+Math.sqrt(1-turn*turn).toFixed(2),
        grindHeld:index<=3,grindPressed:report.frames===0,
        jumpHeld:held,jumpPressed:held&&!heldBefore,jumpReleased:!held&&heldBefore,
        // Return to cruising speed before the narrow perimeter bends.
        grabHeld:index>=10&&p.grounded&&p.speed>12.5};
      heldBefore=held;return input;
    },
    observe(){
      report.frames++;report.distance+=last.distanceTo(p.pos);last.copy(p.pos);
      const planter=SCHOOL_PLANTERS[7];
      if(p.state==='grind'&&p.grindRail?.points.some((q:any)=>Math.abs(q.x-(planter.p[0]-2))<.03&&Math.abs(q.y-.6)<.02))report.gimmeGrindFrames++;
      if(index>=8&&index<=10&&p.state==='air')report.kickerAir=true;
      if(report.kickerAir&&index>=10&&p.grounded)report.kickerLanded=true;
      if(index<points.length)return false;
      if(report.gimmeGrindFrames<5||!report.kickerLanded)throw Error('Campus circuit skipped its opening grind or Kicker Gap landing');
      return true;
    },
  };
}
