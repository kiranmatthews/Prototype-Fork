import { SCHOOL_WORLD_SCALE, schoolWorldPoint, SCHOOL_KICKER, SCHOOL_POOLS, SCHOOL_ROOF_ACCESS, SCHOOL_ROOF_AC, SCHOOL_ROOF_FLAT_RAILS, SCHOOL_MAIN_RAIL, SCHOOL_CHECKPOINTS, SCHOOL_DITCH, SCHOOL_DITCH_SLAP, SCHOOL_DITCH_KICKER, SCHOOL_BRIDGES } from '../src/levels/school-miami';
import { createBalancedGrind } from './school-grind-lines';
import { createSchoolCircuit } from './school-circuit';
import { schoolStreetTrials, createStreetTransfer } from './school-street-transfers';
import { schoolScaleFeatureTrials } from './school-scale-features';
type Point=[number,number,number];
type Place=(q:Point,h:Point,speed:number)=>void;
export type SchoolScaleTrial={name:string;limit:number;init:()=>void;sample:(n:number)=>any;observe:(n:number)=>boolean;result:any;allowDeath?:boolean};

/** Authoring coordinates are transformed only at placement/target boundaries.
 * Every subsequent motion uses unchanged native physics and ordinary input. */
export function schoolScaleTrials(p:any,l:any,place:Place,dt:number,S=SCHOOL_WORLD_SCALE,acLead=1):SchoolScaleTrial[]{
  const world=(q:readonly number[])=>schoolWorldPoint(q,S);
  const cases:SchoolScaleTrial[]=[];
  const set=(q:Point,h:Point,speed=12)=>place(world(q),h,speed);
  const path=(name:string,points:Point[],charge=false,speed=12)=>{
    const targets=points.map(q=>world(q));let index=1;
    const result:any={waypoints:0};
    cases.push({name,limit:2000,result,init:()=>{index=1;set(points[0],[points[1][0]-points[0][0],0,points[1][2]-points[0][2]],speed);},
      sample:n=>{while(index<targets.length-1&&Math.hypot(p.pos.x-targets[index][0],p.pos.z-targets[index][2])<2.5)index++;
        const q=targets[index],a=Math.atan2(q[0]-p.pos.x,-(q[2]-p.pos.z))-Math.atan2(p.axisF.x,-p.axisF.z),turn=Math.max(-1,Math.min(1,Math.atan2(Math.sin(a),Math.cos(a))*3));
        const brake=Math.abs(turn)>.5&&p.speed>12;
        return{moveX:turn,moveY:Math.sqrt(1-turn*turn),jumpHeld:charge,jumpPressed:charge&&n===0,grabHeld:brake};},
      observe:()=>{result.waypoints=index+1;return index===targets.length-1&&Math.hypot(p.pos.x-targets[index][0],p.pos.z-targets[index][2])<2.5&&p.grounded;}});
  };
  cases.push({name:'Native scaled canopy spawn',limit:180,result:{},init:()=>p.respawn(l,true),sample:()=>({moveY:1}),observe:n=>{
    if(n<120)return false;if(p.pos.x<15||Math.abs(p.pos.z)>.2||Math.abs(p.pos.y-3.4*S)>.1)throw Error('Native spawn left canopy');return true;}});
  path('Scaled downhill under awning',[[44,.1,-4],[43,0,-8],[41,-2,-22],[39,-5,-36],[37,-5,-39]]);
  path('Scaled gym doorway',[[48.5,.1,9],[48.5,0,19],[48.5,0,32],[48.5,0,40]]);
  path('Scaled gym doorway return',[[48.5,.1,40],[48.5,0,30],[48.5,0,19],[48.5,0,9]]);
  path('Scaled roof service hill',SCHOOL_ROOF_ACCESS.filter((_,i,a)=>i%7===0||i===a.length-1).map(q=>[q[0],q[1]+.1,q[2]]),true,18);
  for(const side of [-1,1]){
    path(`Scaled roof vent crossing ${side}`,[[side>0?58.3:70.4,7.1,40.5],[side>0?70.4:58.3,7,40.5]]);
    path(`Scaled roof hip crossing ${side}`,[[45.5,7.1,side>0?21.5:31.5],[45.5,7,side>0?31.5:21.5]]);
    const k=SCHOOL_KICKER,h=k.direction.map(v=>v*side) as Point,run=k.gap/2+k.run+10;
    let popped=false,air=false;const result:any={};
    cases.push({name:`Scaled Kicker Gap ${side}`,limit:450,result,init:()=>{popped=false;air=false;set([k.x-h[0]*run,-4.9,k.z-h[2]*run],h,18);},
      sample:n=>{const release=!popped&&((k.x*S-p.pos.x)*h[0]+(k.z*S-p.pos.z)*h[2])<k.gap*S/2+.8;if(release)popped=true;return{jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
      observe:()=>{air||=p.state==='air';if(!air||!p.grounded)return false;result.firstLanding=p.pos.toArray();if((p.pos.x-k.x*S)*h[0]+(p.pos.z-k.z*S)*h[2]<k.gap*S/2)throw Error('Kicker first landing missed receiver');return true;}});
  }
  for(const pool of SCHOOL_POOLS){let air=false;const result:any={};cases.push({name:`Scaled ${pool.name} vert return`,limit:900,result,
    init:()=>{air=false;set([pool.centre[0],pool.bottom+.1,pool.centre[2]],[1,0,0],18);},sample:n=>({jumpHeld:true,jumpPressed:n===0}),
    observe:()=>{air||=p.vertAir;if(!air||!p.grounded)return false;result.landing=p.pos.toArray();return true;}});}
  for(const z of [SCHOOL_ROOF_AC.z,26]){
    let popped=false,air=false;const a=SCHOOL_ROOF_AC,result:any={};
    cases.push({name:`Scaled AC roof air ${z}`,limit:500,result,init:()=>{popped=false;air=false;set([72,7.1,z],[-1,0,0],18);},
      sample:n=>{const release=!popped&&p.pos.x<(a.kickerX-a.kickerRun/2)*S+acLead;if(release)popped=true;return{jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
      observe:()=>{if(!air&&p.state==='air')result.takeoff={pos:p.pos.toArray(),speed:p.speed,vVel:p.vVel};air||=p.state==='air';if(!air||!p.grounded)return false;result.firstLanding=p.pos.toArray();if(p.pos.x>=(a.x-a.width/2)*S||p.pos.y>8.3*S)throw Error('AC first landing did not clear the unit');return true;}});
  }
  {let air=false,popped=false,airTicks=0;const result:any={};cases.push({name:'Scaled Roof 2 Roof',limit:450,result,
    init:()=>{air=false;popped=false;airTicks=0;set([65.5,7.1,26],[0,0,-1],18);},sample:n=>{const release=!popped&&p.grounded&&p.rideNormal.y<.3;if(release)popped=true;return{moveY:p.vertAir&&airTicks++===0?0:1,jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
    observe:()=>{air||=p.state==='air';if(!air||!p.grounded)return false;result.firstLanding=p.pos.toArray();if(p.pos.z>9.9*S||p.pos.z< -2.5*S||Math.abs(p.pos.y-7*S)>.1)throw Error('Roof transfer missed bonus roof');return true;}});}
  for(const side of [{name:'west',q:[45,7.1,21.3],h:[1,0,0],toe:[48.25,7,21.3]},{name:'south',q:[57.5,7.1,33],h:[0,0,-1],toe:[57.5,7,29.15]}]){
    let air=false;const result:any={};cases.push({name:`Scaled AC transition ${side.name} return`,limit:450,result,
      init:()=>{air=false;set(side.q as Point,side.h as Point,18);},sample:n=>({jumpHeld:true,jumpPressed:n===0}),
      observe:()=>{air||=p.vertAir;result.air=air;const d=(p.pos.x-side.toe[0]*S)*side.h[0]+(p.pos.z-side.toe[2]*S)*side.h[2];return air&&p.grounded&&d<-.2;}});
  }
  for(const [i,points] of SCHOOL_ROOF_FLAT_RAILS.entries())for(const direction of [-1,1]){
    const start=world(points[0]),rail=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...start))<.1);
    let line:ReturnType<typeof createBalancedGrind>,popped=false;const result:any={};
    cases.push({name:`Scaled short roof rail ${i+1}/${direction}`,limit:550,result,init:()=>{
      if(!rail)throw Error('Scaled roof rail missing');const h=rail.tangentAt(0).setY(0).normalize().multiplyScalar(direction),q=(direction>0?rail.points[0]:rail.points.at(-1)).clone().addScaledVector(h,-9);q.y=7*S+.1;
      place(q.toArray(),h.toArray(),14);line=createBalancedGrind(p,rail,dt);result.grind=line.report;popped=false;
    },sample:n=>{const end=direction>0?rail.points[0]:rail.points.at(-1),release=!popped&&p.pos.distanceTo(end)<4.5;if(release)popped=true;return{...line.sample(),jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},observe:()=>line.observe()});
  }
  for(const direction of [-1,1]){
    const rail=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...world(SCHOOL_MAIN_RAIL[0])))<.1);let line:ReturnType<typeof createBalancedGrind>;const result:any={};
    cases.push({name:`Scaled complete downhill rail ${direction}`,limit:1600,result,init:()=>{
      if(!rail)throw Error('Downhill rail missing');const t=direction>0?.4:rail.totalLength-.4,h=rail.tangentAt(t).multiplyScalar(direction).setY(0).normalize(),q=rail.pointAt(t).add(p.pos.clone().set(0,.3,0));
      place(q.toArray(),h.toArray(),18);p.pos.copy(q);p.prevPos.copy(q);p.grounded=false;p.state='air';p.vVel=0;p.airFromSkate=true;p.airGrav='board';line=createBalancedGrind(p,rail,dt);result.grind=line.report;
    },sample:()=>line.sample(),observe:()=>line.observe()});
  }
  for(const [from,pool] of SCHOOL_POOLS.entries()){
    let air=false,exited=false,popped=false;const target=SCHOOL_POOLS[1-from],sign=from===0?1:-1,edge=from===0?1.8:4.5,result:any={};
    // Drop into the source basin first. The extra speed is earned on its
    // existing transition, then a charged pop clears the receiving coping.
    cases.push({name:`Scaled Swim Team ${from+1}`,limit:650,result,init:()=>{air=false;exited=false;popped=false;set([pool.centre[0]-sign*(edge+pool.depth+1.4),-4.95,pool.centre[2]],[sign,0,0],23);},
      // The transfer button exits the vert hang as soon as the body clears
      // the coping; held approach direction alone intentionally retains it.
      sample:n=>{const release=!popped&&p.grounded&&(p.pos.x-pool.centre[0]*S)*sign>0&&p.rideNormal.y<.45;if(release)popped=true;return{moveY:1,transferHeld:p.vertAir,jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
      observe:()=>{air||=p.vertAir;exited||=air&&!p.vertAir;if(!exited||!p.grounded)return false;result.firstLanding=p.pos.toArray();
        if(p.pos.y>=-5.3*S||p.pos.y<target.bottom*S-.06||Math.abs(p.pos.x-target.centre[0]*S)>=8*S||Math.abs(p.pos.z-target.centre[2]*S)>=10*S)throw Error('Swim Team first landing missed the other basin');return true;}});
  }
  const ditch=SCHOOL_DITCH,dl=Math.hypot(ditch.b[0]-ditch.a[0],ditch.b[2]-ditch.a[2]),dn=[(ditch.b[2]-ditch.a[2])/dl,0,-(ditch.b[0]-ditch.a[0])/dl],half=(ditch.half+ditch.radius*Math.sin(65*Math.PI/180))*S,cross=world(ditch.a.map((v,i)=>v+(ditch.b[i]-v)*SCHOOL_DITCH_SLAP.t));
  for(const direction of [-1,1]){
    const h=dn.map(v=>v*direction) as Point;let air=false,popped=false;const result:any={};
    cases.push({name:`Scaled Ditch Slap ${direction}`,limit:450,result,init:()=>{air=false;popped=false;delete result.firstLanding;place([cross[0]-h[0]*(half+6),-5*S+.1,cross[2]-h[2]*(half+6)],h,23);},
      sample:n=>{const release=!popped&&(cross[0]-p.pos.x)*h[0]+(cross[2]-p.pos.z)*h[2]<half+.8;if(release)popped=true;return{jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
      observe:()=>{air||=p.state==='air';if(!air||!p.grounded)return false;const past=(p.pos.x-cross[0])*h[0]+(p.pos.z-cross[2])*h[2];
        if(!result.firstLanding){result.firstLanding=p.pos.toArray();if(past<=half||p.pos.y< -5*S-.06)throw Error('Ditch Slap first landing missed the far bank');}
        return past>half+SCHOOL_DITCH_SLAP.run*S+.5&&Math.abs(p.pos.y+5*S)<.06;}});
  }
  {const k=SCHOOL_DITCH_KICKER,h=k.direction,b=SCHOOL_BRIDGES[2];let air=false,popped=false,over=false;const result:any={};
    cases.push({name:'Scaled Over a Footbridge',limit:500,result,init:()=>{air=false;popped=false;over=false;set([k.p[0]-h[0]*7,-6.4,k.p[2]-h[2]*7],h,18);},
      sample:n=>{const release=!popped&&(k.p[0]*S-p.pos.x)*h[0]+(k.p[2]*S-p.pos.z)*h[2]<-k.run*S/2+.8;if(release)popped=true;return{jumpHeld:!popped,jumpPressed:n===0,jumpReleased:release};},
      observe:()=>{air||=p.state==='air';const past=(p.pos.x-b.p[0]*S)*h[0]+(p.pos.z-b.p[2]*S)*h[2];if(Math.abs(past)<.5&&p.state==='air'&&p.pos.y>-4.58*S)over=true;
        if(!air||!p.grounded||past<=b.width*S/2)return false;result.firstLanding=p.pos.toArray();result.overBridge=over;if(!over)throw Error('Footbridge jump missed the bridge');return true;}});
  }
  for(const route of schoolStreetTrials(l,p,S)){
    let line:ReturnType<typeof createStreetTransfer>;const result:any={};
    cases.push({name:`Scaled ${route.name}`,limit:650,result,init:()=>{
      const h=p.axisF.clone().set(...route.heading).normalize(),q=p.pos.clone().set(...route.centre).addScaledVector(h,-route.approach);q.y=-5*S+.1;
      place(q.toArray(),h.toArray(),route.speed);line=createStreetTransfer(p,route,dt);result.transfer=line.report;
    },sample:()=>line.sample(),observe:()=>line.observe()});
  }
  cases.push(...schoolScaleFeatureTrials(p,l,place,dt,S));
  {let line:ReturnType<typeof createSchoolCircuit>;const result:any={};cases.push({name:'Scaled continuous campus circuit',limit:7000,result,
    init:()=>{p.respawn(l,true);line=createSchoolCircuit(p,S);result.circuit=line.report;},sample:()=>line.sample(),observe:()=>line.observe()});}
  {let banked=false,dead=false;const result:any={};cases.push({name:'Scaled checkpoint and fall recovery',limit:900,allowDeath:true,result,
    init:()=>{banked=false;dead=false;const q=world(SCHOOL_CHECKPOINTS[1]);q[0]-=3;q[1]+=.1;place(q,[1,0,0],18);},
    sample:()=>({moveY:banked?0:1,jumpHeld:!banked}),observe:()=>{
      if(!banked&&l.activeCheckpoint===l.checkpoints[1]){banked=true;result.banked=true;p.pos.set(110*S,-10*S,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-10;p.airFromSkate=true;p.airGrav='board';}
      dead||=p.state==='dead';result.fallObserved=dead;return dead&&p.state==='ride'&&p.grounded&&p.pos.distanceTo(l.checkpoints[1].spawnPos)<2;
    }});}
  return cases;
}

export function runSchoolScaleBrowserChecks(g:any,prefix=''){
  const p=g.player,l=g.getLevel(),input=g.input,oldStep=p.step,oldPoll=input.pollGamepad,update=input.update.bind(input);
  const report:any={worldScale:SCHOOL_WORLD_SCALE,running:true,stage:'',passed:[],failure:null,frames:0,tuningBefore:JSON.stringify(g.TUNING)};
  const place:Place=(q,h,speed)=>{p.respawn(l,true,true,{position:p.pos.clone().set(...q),heading:p.axisF.clone().set(...h).normalize()});p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;p.groundHit=p.queryGround(l);if(!p.groundHit)throw Error('Missing scaled placement support');p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);};
  let sample:any={},frame=0,index=0;
  const trials=schoolScaleTrials(p,l,place,1/60).filter(c=>!prefix||c.name.includes('AC'));
  const stop=(failure:string|null)=>{p.step=oldStep;input.pollGamepad=oldPoll;report.running=false;report.failure=failure;report.tuningUnchanged=report.tuningBefore===JSON.stringify(g.TUNING);delete report.tuningBefore;p.speed=0;};
  const next=()=>{frame=0;sample={};if(index>=trials.length){stop(null);return;}report.stage=trials[index].name;trials[index].init();};
  input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0,held:any={0:sample.jumpHeld,1:sample.grabHeld,2:sample.spinHeld,3:sample.grindHeld,7:sample.transferHeld};return{id:'School scaled validation',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:false,value:held[i]?1:0}))};};
  p.step=(dt:number,controls:any,level:any)=>{try{const c=trials[index];sample=c.sample(frame);update();oldStep.call(p,dt,controls,level);frame++;report.frames++;if(p.isBailing&&!c.allowDeath)throw Error(`${c.name}: bail`);if(!p.pos.toArray().every(Number.isFinite))throw Error('Non-finite position');if(c.observe(frame)){report.passed.push({name:c.name,frames:frame,result:c.result});index++;next();}else if(frame>c.limit)throw Error(`${c.name}: timeout at ${p.pos.toArray()}`);}catch(e){stop(String(e));}};
  try{next();}catch(e){stop(String(e));}return report;
}
