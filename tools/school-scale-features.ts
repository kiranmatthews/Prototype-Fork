import { SCHOOL_ROOF_MINI_GAP, SCHOOL_GYM_BANKS, SCHOOL_GYM_BANK, SCHOOL_GYM_RAILS, SCHOOL_SKYLIGHT, SCHOOL_REAR_SHED, schoolGymBankHeight, schoolWorldPoint } from '../src/levels/school-miami';
import { createBalancedGrind, createPerimeterMiniGap, createRoofMiniGap } from './school-grind-lines';
import { miniGapRails, parkGapRails, createParkGap } from './school-street-transfers';
import type { SchoolScaleTrial } from './school-scale-lines';
type Point=[number,number,number];
type Place=(q:Point,h:Point,speed:number)=>void;

/** Features whose landing height and gaps changed with the campus scale.
 * Each pilot uses normal controller input after one initial placement. */
export function schoolScaleFeatureTrials(p:any,l:any,place:Place,dt:number,S:number):SchoolScaleTrial[]{
  const world=(q:readonly number[])=>schoolWorldPoint(q,S),vector=(q:readonly number[])=>p.pos.clone().set(...world(q));
  const trials:SchoolScaleTrial[]=[];
  const railStart=(rail:any,speed:number)=>{
    if(!rail)throw Error('Missing scaled gap coping');
    const t=rail.totalLength-8,h=rail.tangentAt(t).setY(0).normalize(),q=rail.pointAt(t).add(p.pos.clone().set(0,.3,0));
    place(q.toArray(),h.toArray(),speed);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';
    if(p.balanceBoostT||p.uberTimer)throw Error('Scaled gap has a balance assist');
  };
  for(const name of ['Perimeter Mini Gap','Roof Mini Gap','Park Gap']){
    let line:any;const result:any={};
    trials.push({name:`Scaled ${name}`,limit:900,result,init:()=>{
      let a:any,b:any;
      if(name==='Roof Mini Gap'){
        const end=vector(SCHOOL_ROOF_MINI_GAP.left).add(p.pos.clone().set(0,1.85*S,-1.8*S)),start=vector(SCHOOL_ROOF_MINI_GAP.right).add(p.pos.clone().set(0,1.85*S,-1.8*S));
        a=l.rails.find((r:any)=>r.points.at(-1).distanceTo(end)<.6*S&&r.totalLength>25*S);b=l.rails.find((r:any)=>r.points[0].distanceTo(start)<.1);
        railStart(a,21);line=createRoofMiniGap(p,a,b,dt,S);
      }else{
        ({takeoff:a,receiver:b}=name==='Park Gap'?parkGapRails(l,p,S):miniGapRails(l,p,S));
        railStart(a,18);line=name==='Park Gap'?createParkGap(p,a,b,dt,[-.55,0],12,S):createPerimeterMiniGap(p,a,b,dt,S);
      }
      if(!b)throw Error('Missing scaled receiving coping');result.gap=line.report;
    },sample:()=>line.sample(),observe:()=>line.observe()});
  }
  for(const speed of [12,20]){
    const result={air:false,returned:false,maxY:0};
    trials.push({name:`Scaled gym hoop return ${speed}`,limit:650,result,init:()=>place(world([48.5,.1,36]),[0,0,1],speed),
      sample:n=>({jumpHeld:true,jumpPressed:n===0}),observe:()=>{
        result.air||=p.vertAir;result.returned||=result.air&&p.grounded;result.maxY=Math.max(result.maxY,p.pos.y);
        if(p.pos.y>6*S)throw Error('Gym air escaped the ceiling');
        return result.returned&&p.grounded&&Math.abs(p.pos.y)<.06&&p.speed>3&&p.pos.z<43.5*S-1;
      }});
  }
  for(const [i,b] of SCHOOL_GYM_BANKS.entries())for(const direction of [-1,1]){
    const s=SCHOOL_GYM_BANK,h:Point=[b.side*direction,0,0],q:Point=direction===1?[b.toeX-b.side*3,.1,32]:[b.toeX+b.side*(s.run-1.3),schoolGymBankHeight(s.run-1.3)+.1,32];
    const result={maxStep:0,minSpeed:100,arrived:false};const previous=p.pos.clone();
    trials.push({name:`Scaled gym ${i?'east':'west'} bank ${direction}`,limit:500,result,init:()=>{place(world(q),h,16);previous.copy(p.pos);},sample:()=>({moveY:1}),observe:()=>{
      result.maxStep=Math.max(result.maxStep,previous.distanceTo(p.pos));previous.copy(p.pos);result.minSpeed=Math.min(result.minSpeed,p.speed);
      if(!p.grounded||result.maxStep>.5||p.speed<3)throw Error('Gym bank join interrupted contact or momentum');
      const d=(p.pos.x/S-b.toeX)*b.side;if(direction===1?d<s.run-1.3:d> -3)return false;
      if(Math.abs(p.pos.y-(direction===1?schoolGymBankHeight(d)*S:0))>.06)throw Error('Gym bank missed receiving surface');
      result.arrived=true;return true;
    }});
  }
  for(const [i,points] of SCHOOL_GYM_RAILS.entries())for(const direction of [-1,1])for(const airEntry of [false,true]){
    let line:ReturnType<typeof createBalancedGrind>,entry:any,popped=false;const result:any={direction,minGrindSpeed:null,maxApproachSpeed:0};
    trials.push({name:`Scaled gym ${airEntry?'bank air to rail':'complete rail'} ${i+1}/${direction}`,limit:1400,result,init:()=>{
      const rail=l.rails.find((r:any)=>r.points[0].distanceTo(vector(points[0]))<.1);if(!rail)throw Error('Missing scaled gym rail');
      entry=direction===1?rail.points[0]:rail.points.at(-1);
      const t=direction===1?.1:rail.totalLength-.1,h=rail.tangentAt(t).setY(0).normalize().multiplyScalar(direction),q=entry.clone().addScaledVector(h,-10);q.y=.1;
      if(airEntry)q.z+=direction*.5;
      place(q.toArray(),h.toArray(),airEntry?23:18);line=createBalancedGrind(p,rail,dt);result.grind=line.report;
    },sample:n=>{
      // The unchanged skater cannot carry a flat 23 m/s entry up the full
      // 6.8 m rise without slowing. A normal bank ollie catches higher on
      // the end rail and preserves speed through the crest and top bar.
      const release=airEntry&&!popped&&p.pos.y>1.2*S;if(release){popped=true;result.takeoffY=p.pos.y;}
      return {...line.sample(),grindHeld:!airEntry||p.state==='grind'||popped&&p.pos.y>2.6*S,grindPressed:false,jumpHeld:!airEntry||!popped,jumpPressed:n===0,jumpReleased:release};
    },observe:()=>{
      if(!line.report.caught)result.maxApproachSpeed=Math.max(result.maxApproachSpeed,p.speed);
      if(p.state==='grind')result.minGrindSpeed=Math.min(result.minGrindSpeed??Infinity,p.speed);
      if(airEntry&&result.minGrindSpeed!==null&&result.minGrindSpeed<10)throw Error('Gym air-to-rail lost its approach momentum');
      return line.observe();
    }});
  }
  for(const direction of [-1,1]){
    const s=SCHOOL_SKYLIGHT,result={entered:false,landed:false,firstLanding:null as number[]|null};
    trials.push({name:`Scaled skylight drop ${direction}`,limit:500,result,init:()=>place(world([direction===1?s.hole.minX-.7:s.hole.maxX+.7,s.lipY+.1,s.z]),[direction,0,0],12),sample:()=>({}),observe:()=>{
      result.entered||=p.state==='air'&&p.pos.y<(s.lipY-1)*S;
      if(!result.entered||!p.grounded)return false;result.firstLanding=p.pos.toArray();
      if(Math.abs(p.pos.y)>.06)throw Error('Skylight drop missed the gym floor');result.landed=true;return true;
    }});
  }
  for(let side=0;side<SCHOOL_REAR_SHED.length;side++){
    const a=vector(SCHOOL_REAR_SHED[side]),b=vector(SCHOOL_REAR_SHED[(side+1)%SCHOOL_REAR_SHED.length]),mid=a.clone().add(b).multiplyScalar(.5),edge=b.clone().sub(a).setY(0).normalize(),out=edge.clone().set(-edge.z,0,edge.x);
    const result={blocked:false,closest:Infinity};
    trials.push({name:`Scaled rear shed collision ${side+1}`,limit:180,result,init:()=>{const q=mid.clone().addScaledVector(out,3);q.y=-6;place(q.toArray(),out.clone().negate().toArray(),6);},sample:()=>({}),observe:n=>{
      const distance=p.pos.clone().sub(mid).dot(out);result.closest=Math.min(result.closest,distance);
      if(distance<.35)throw Error('Rider passed through the rear shed wall');
      if(n<30||result.closest>1)return false;result.blocked=true;return true;
    }});
  }
  return trials;
}
