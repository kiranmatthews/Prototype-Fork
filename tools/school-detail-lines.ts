import {SCHOOL_REAR_BANK,SCHOOL_SKYLIGHT,SCHOOL_GYM_RAILS} from '../src/levels/school-miami';
import {createBalancedGrind} from './school-grind-lines';

type Point=[number,number,number];
type Place=(position:Point,heading:Point,speed:number)=>void;
type DetailTrial={name:string;kind:'air'|'ride'|'grind';result:any;limit:number;init:()=>void;sample:(frame:number)=>any;observe:()=>boolean};

/** Shared native-player cases. Only init places a rider; samples thereafter
 * are normal buttons/axes, with no trajectory correction or balance boost. */
export function schoolDetailTrials(p:any,l:any,place:Place,dt:number):DetailTrial[]{
  const trials:DetailTrial[]=[];
  const gym=[
    {name:'Gym hoop quarter',position:[48.5,.1,36],heading:[0,0,1],toe:[48.5,0,43.5]},
    {name:'Gym west quarter',position:[48.5,.1,32],heading:[-1,0,0],toe:[30,0,32]},
    {name:'Gym east quarter',position:[48.5,.1,32],heading:[1,0,0],toe:[66,0,32]},
  ];
  for(const c of gym)for(const speed of [12,16,20]){
    const result={speed,frames:0,air:false,returned:false,flatRollout:false,maxY:0};
    trials.push({name:`${c.name} at ${speed}`,kind:'air',result,limit:350,
      init:()=>place(c.position as Point,c.heading as Point,speed),
      sample:frame=>({jumpHeld:true,jumpPressed:frame===0}),
      observe:()=>{result.frames++;result.air||=p.vertAir;result.maxY=Math.max(result.maxY,p.pos.y);result.returned||=result.air&&p.grounded;
        if(p.pos.y>6)throw Error('Gym air escaped through the ceiling');
        const returnedDistance=(p.pos.x-c.toe[0])*c.heading[0]+(p.pos.z-c.toe[2])*c.heading[2];
        result.flatRollout=result.returned&&p.grounded&&Math.abs(p.pos.y)<.06&&p.speed>3&&returnedDistance< -1;
        return result.flatRollout;},
    });
  }
  for(const speed of [16,18]){
    const result={speed,frames:0,air:false,landed:false,maxY:7};
    trials.push({name:`Direct Roof 2 Awning at ${speed}`,kind:'air',result,limit:180,
      init:()=>place([45,7.1,23],[0,0,-1],speed),sample:frame=>({moveY:1,jumpHeld:true,jumpPressed:frame===0}),
      observe:()=>{result.frames++;result.air||=p.state==='air';result.maxY=Math.max(result.maxY,p.pos.y);
        if(!result.air||!p.grounded)return false;
        if(Math.abs(p.pos.y-3.4)>.06||Math.abs(p.pos.x-45)>1.5||p.pos.z>12||p.pos.z< -2)throw Error('Roof jump first landing missed the awning');
        result.landed=true;return true;},
    });
  }
  const vector=(q:number[])=>p.pos.clone().set(...q),bank=SCHOOL_REAR_BANK;
  for(const t of [.27,.72])for(const direction of [-1,1]){
    const toe=vector(bank.toe[0]).lerp(vector(bank.toe[1]),t),lip=vector(bank.lip[0]).lerp(vector(bank.lip[1]),t);
    const h=lip.clone().sub(toe).setY(0).normalize().multiplyScalar(direction);
    const q=(direction===1?toe:lip).clone().addScaledVector(h,-.6);q.y+=.1;
    const target=(direction===1?lip:toe).clone().addScaledVector(h,.3);
    const result={t,direction,frames:0,maxStep:0,minSpeed:100,arrived:false};let previous=p.pos.clone();
    trials.push({name:`Rear bank ${t}/${direction}`,kind:'ride',result,limit:100,
      init:()=>{place(q.toArray(),h.toArray(),10);previous.copy(p.pos);},sample:()=>({moveY:1}),
      observe:()=>{result.frames++;result.maxStep=Math.max(result.maxStep,previous.distanceTo(p.pos));previous.copy(p.pos);result.minSpeed=Math.min(result.minSpeed,p.speed);
        if(!p.grounded)throw Error('Rear bank surface interrupted ground contact');
        if(result.maxStep>.35||result.minSpeed<5)throw Error('Rear bank join interrupted skating speed');
        if(p.pos.clone().sub(target).dot(h)<0)return false;
        if(Math.abs(p.pos.y-(direction===1?bank.y:-5))>.06)throw Error('Rear bank route missed its receiving surface');
        result.arrived=true;return true;},
    });
  }
  for(const [i,points] of bank.rails.entries())for(const direction of [-1,1]){
    const rail=l.rails.find((r:any)=>r.points[0].distanceTo(vector(points[0]))<.1);
    if(!rail)throw Error('Rear bank rail missing');
    const h=rail.tangentAt(.1).setY(0).normalize().multiplyScalar(direction);
    const q=(direction===1?rail.points[0]:rail.points.at(-1)).clone().addScaledVector(h,-1.5);q.y=bank.y+.1;
    const result:any={direction};let line:ReturnType<typeof createBalancedGrind>;
    trials.push({name:`Rear short rail ${i+1}/${direction}`,kind:'grind',result,limit:160,
      init:()=>{place(q.toArray(),h.toArray(),12);if(p.balanceBoostT||p.uberTimer)throw Error('Rear bank grind has an assist');line=createBalancedGrind(p,rail,dt);result.grind=line.report;},
      sample:()=>line.sample(),observe:()=>line.observe(),
    });
  }
  for(const [i,points] of SCHOOL_GYM_RAILS.entries())for(const direction of [-1,1]){
    const rail=l.rails.find((r:any)=>r.points[0].distanceTo(vector(points[0]))<.1);
    if(!rail)throw Error('Gym end-to-end rail missing');
    const t=direction===1?.1:rail.totalLength-.1,h=rail.tangentAt(t).setY(0).normalize().multiplyScalar(direction);
    const q=(direction===1?rail.points[0]:rail.points.at(-1)).clone().addScaledVector(h,-1.5);q.y=.1;
    const result:any={direction};let line:ReturnType<typeof createBalancedGrind>;
    trials.push({name:`Gym complete rail ${i+1}/${direction}`,kind:'grind',result,limit:700,
      init:()=>{place(q.toArray(),h.toArray(),14);line=createBalancedGrind(p,rail,dt);result.grind=line.report;},
      sample:()=>line.sample(),observe:()=>line.observe(),
    });
  }
  const s=SCHOOL_SKYLIGHT,open=s.hole;
  for(const speed of [6,8])for(const direction of [-1,1]){
    const q:Point=[direction===1?open.minX-.7:open.maxX+.7,s.lipY+.1,s.z];
    const result={speed,direction,frames:0,entered:false,landed:false,rollout:false,maxLateral:0,firstLanding:null as number[]|null};
    trials.push({name:`Skylight drop ${direction}/${speed}`,kind:'air',result,limit:200,
      init:()=>place(q,[direction,0,0],speed),sample:()=>({}),
      observe:()=>{result.frames++;result.entered||=!p.grounded&&p.pos.y<6.4;
        if(!result.landed){result.maxLateral=Math.max(result.maxLateral,Math.abs(p.pos.z-s.z));if(result.maxLateral>.15)throw Error('Skylight frame deflected the straight entry');}
        if(!result.entered)return false;
        if(p.grounded){if(Math.abs(p.pos.y)>.06)throw Error('Skylight drop missed the gym floor');if(!result.landed)result.firstLanding=p.pos.toArray();result.landed=true;}
        result.rollout=result.landed&&p.grounded&&Math.abs(p.pos.x-(direction===1?open.minX:open.maxX))>6;
        return result.rollout;},
    });
  }
  return trials;
}
