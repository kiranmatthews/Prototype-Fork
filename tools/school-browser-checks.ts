import {SCHOOL_KICKER,SCHOOL_POOLS,SCHOOL_ROOF_AC,SCHOOL_ROOF_ACCESS,SCHOOL_MAIN_RAIL,SCHOOL_CHECKPOINTS,SCHOOL_LONG_HALFPIPE,SCHOOL_ROOF_PLANK,SCHOOL_BONUS_ROOF,SCHOOL_DITCH_KICKER,SCHOOL_BRIDGES,SCHOOL_DITCH,SCHOOL_WEST_DESCENT,SCHOOL_LONG_ASS_RAIL,SCHOOL_MINI_GAP,SCHOOL_HUGE_RAIL,SCHOOL_LAWN_SIDE_RAILS,SCHOOL_ROOF_MINI_GAP,schoolMapPoint} from '../src/levels/school-miami';
import {createSchoolCircuit} from './school-circuit';
import {createBalancedGrind,createRoofMiniGap,createPerimeterMiniGap} from './school-grind-lines';
import {CONST} from '../src/tuning';
import {schoolDetailTrials} from './school-detail-lines';
import {SCHOOL_WORLD_SCALE} from '../src/levels/school-miami';
import {runSchoolScaleBrowserChecks} from './school-scale-lines';
import {schoolStreetTrials,createStreetTransfer,parkGapRails,createParkGap,miniGapRails} from './school-street-transfers';
import {hallPassRails,lawnTransferRails,upperPlanterRails,createHallPass,createUpperPlanterChain,createLawnTransfer,classroomTransferRails,createClassroomTransfer} from './school-planter-lines';
type Point=[number,number,number];
type Trial={name:string;init:()=>void;input:(n:number)=>any;done:(n:number)=>boolean;limit?:number;allowDeath?:boolean};

/** Drives the real frame loop with ordinary controller samples. Placements
 * isolate each feature; motion within a case never edits position/velocity. */
export function runSchoolBrowserChecks(g:any,prefix=''){
  if(Number(SCHOOL_WORLD_SCALE)!==1)return runSchoolScaleBrowserChecks(g,prefix);
  const p=g.player,l=g.getLevel(),input=g.input,oldStep=p.step,oldPoll=input.pollGamepad,update=input.update.bind(input);
  const report:any={running:true,stage:'',passed:[],failure:null,frames:0,tuningBefore:JSON.stringify(g.TUNING)};
  let sample:any={},frame=0,trialIndex=0,air=false,popped=false,waypoint=1,dead=false,banked=false;
  let circuit:ReturnType<typeof createSchoolCircuit>;
  const place=(q:Point,h:Point,speed=12)=>{
    p.respawn(l,true,true,{position:p.pos.clone().set(...q),heading:p.axisF.clone().set(...h).normalize()});
    p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
    p.groundHit=p.queryGround(l);if(!p.groundHit)throw Error('Missing placement support');
    p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
  };
  const steer=(q:Point)=>{const a=Math.atan2(q[0]-p.pos.x,-(q[2]-p.pos.z)),b=Math.atan2(p.axisF.x,-p.axisF.z),d=Math.atan2(Math.sin(a-b),Math.cos(a-b));return Math.max(-1,Math.min(1,d*3));};
  const near=(q:Point,d=2.2)=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)<d;
  const pathTrial=(name:string,pts:Point[],charge=false,fullTurn=false,hillBrake=false,cruise=12):Trial=>({name,init:()=>{waypoint=1;place([pts[0][0],pts[0][1]+.1,pts[0][2]],[pts[1][0]-pts[0][0],0,pts[1][2]-pts[0][2]],charge?18:cruise);},
    input:()=>{while(waypoint<pts.length-1&&near(pts[waypoint],hillBrake?2:3))waypoint++;const turn=steer(pts[waypoint]);return {moveX:turn,moveY:fullTurn?Math.sqrt(1-turn*turn):1,jumpHeld:charge,grabHeld:hillBrake&&p.pos.z<39&&p.speed>cruise};},done:()=>waypoint===pts.length-1&&near(pts.at(-1)!)});
  const k=SCHOOL_KICKER,h=k.direction,run=k.gap/2+k.run+7;
  const dk=SCHOOL_DITCH_KICKER,dh=dk.direction,db=SCHOOL_BRIDGES[2];let overBridge=false;
  const ditch=SCHOOL_DITCH,dl=Math.hypot(ditch.b[0]-ditch.a[0],ditch.b[2]-ditch.a[2]),dn=[(ditch.b[2]-ditch.a[2])/dl,0,-(ditch.b[0]-ditch.a[0])/dl],ditchHalf=ditch.half+ditch.radius*Math.sin(65*Math.PI/180),ditchCross=ditch.a.map((v,i)=>v+(ditch.b[i]-v)*.58);
  let exited=false,overGarbage=false,dumpsterCaught=false,dumpsterRepress=false,dumpsterAFrames=0,dumpsterBFrames=0,dumpsterA:any,dumpsterB:any;
  let streetLine:ReturnType<typeof createStreetTransfer>,parkLine:ReturnType<typeof createParkGap>;
  let grindLine:ReturnType<typeof createBalancedGrind>,roofMini:ReturnType<typeof createRoofMiniGap>,miniLine:ReturnType<typeof createPerimeterMiniGap>;
  let planterLine:ReturnType<typeof createHallPass>|ReturnType<typeof createUpperPlanterChain>|ReturnType<typeof createLawnTransfer>|ReturnType<typeof createClassroomTransfer>;
  const balancedTrial=(name:string,select:()=>any,ground=false,reverse=false):Trial=>({name,limit:900,init:()=>{
    const r=select();if(!r)throw Error(`${name}: missing rail`);const t=reverse?r.totalLength-.4:.4,h=r.tangentAt(t).multiplyScalar(reverse?-1:1).setY(0).normalize(),q=r.pointAt(t);
    if(ground){const a=r.points[0].clone().addScaledVector(h,-1.5);place([a.x,.1,a.z],h.toArray(),14);}
    else{q.y+=.3;place(q.toArray(),h.toArray(),14);p.pos.copy(q);p.prevPos.copy(q);p.grounded=false;p.state='air';p.vVel=0;p.airFromSkate=true;p.airGrav='board';}
    if(p.balanceBoostT||p.uberTimer)throw Error('Long grind has a balance assist');grindLine=createBalancedGrind(p,r,CONST.fixedStep);(report.longGrinds??=[]).push({name,result:grindLine.report});
  },input:()=>grindLine.sample(),done:()=>grindLine.observe()});
  const trials:Trial[]=[
    {name:'Native canopy start',init:()=>{p.respawn(l,true);if(p.axisF.x<.99)throw Error('Native spawn faces off canopy');},input:()=>({moveY:1}),done:n=>{if(n<90)return false;if(p.pos.x<9||Math.abs(p.pos.z)>.1||Math.abs(p.pos.y-3.4)>.06)throw Error('Native start left canopy');return true;}},
    pathTrial('Downhill approach',[[44,0,-4],[43,0,-8],[41,-2,-22],[39,-5,-36],[37,-5,-39]]),
    {name:'Kicker Gap',init:()=>{air=false;popped=false;place([k.x-h[0]*run,-4.9,k.z-h[2]*run],h,18);},input:()=>{if(!popped&&(k.x-p.pos.x)*h[0]+(k.z-p.pos.z)*h[2]<k.gap/2+.9)popped=true;return {jumpHeld:!popped};},done:()=>{air||=p.state==='air';return air&&p.grounded&&(p.pos.x-k.x)*h[0]+(p.pos.z-k.z)*h[2]>k.gap/2;}},
    ...SCHOOL_POOLS.map((pool):Trial=>({name:`${pool.name} vert return`,init:()=>{air=false;place([pool.centre[0],pool.bottom+.1,pool.centre[2]],[1,0,0],16);},input:()=>({jumpHeld:true}),done:()=>{air||=p.vertAir;return air&&p.grounded;}})),
    pathTrial('Roof service hill',SCHOOL_ROOF_ACCESS.filter((_,i,a)=>i%7===0||i===a.length-1),true,true,true),
    pathTrial('Winding halfpipe',SCHOOL_LONG_HALFPIPE,false,true),
    {name:'Perimeter lane width',init:()=>place([-60,-4.9,-52],[0,0,-1],8),input:()=>({moveY:1}),done:()=>{if(p.pos.z>-56)return false;if(!p.grounded||Math.abs(p.pos.y+5)>.06)throw Error('Gap in perimeter quarter floor join');return true;}},
    pathTrial('West descent to pools',SCHOOL_WEST_DESCENT,false,true,true,9),
    pathTrial('Gym doorway',[[48.5,0,9],[48.5,0,19],[48.5,0,32],[48.5,0,42]]),
    {name:'Air-conditioner roof gap',init:()=>{air=false;popped=false;place([72,7.1,SCHOOL_ROOF_AC.z],[-1,0,0],18);},input:()=>{if(p.pos.x<SCHOOL_ROOF_AC.kickerX-SCHOOL_ROOF_AC.kickerRun/2+1)popped=true;return{jumpHeld:!popped};},done:()=>{air||=p.state==='air';if(!air||!p.grounded)return false;if(p.pos.x>=SCHOOL_ROOF_AC.x-SCHOOL_ROOF_AC.width/2-.1||Math.abs(p.pos.y-7)>.06)throw Error('AC jump first landing missed clear roof');return true;}},
    {name:'Roof 2 Roof',init:()=>{air=false;place([65.5,7.1,23],[0,0,-1],18);},input:()=>({moveY:1,jumpHeld:true}),done:()=>{air||=p.state==='air';if(!air||!p.grounded||p.pos.z>=SCHOOL_BONUS_ROOF.maxZ)return false;if(p.pos.z<1||Math.abs(p.pos.y-7)>.06)throw Error('Missed bonus roof');return true;}},
    {name:'Over a Footbridge',init:()=>{air=false;popped=false;overBridge=false;place([dk.p[0]-dh[0]*3.8,-6.4,dk.p[2]-dh[2]*3.8],dh,18);if(Math.abs(p.pos.y+6.5)>.06)throw Error('Ditch start missed bed');},input:()=>{if((dk.p[0]-p.pos.x)*dh[0]+(dk.p[2]-p.pos.z)*dh[2]< -dk.run/2+.6)popped=true;return {jumpHeld:!popped};},done:()=>{air||=p.state==='air';const past=(p.pos.x-db.p[0])*dh[0]+(p.pos.z-db.p[2])*dh[2];if(Math.abs(past)<.5&&p.state==='air'&&p.pos.y>-4.58)overBridge=true;if(!air||!p.grounded||past<=db.width/2)return false;if(!overBridge)throw Error('Ditch jump missed bridge');return true;}},
    balancedTrial('Roof-to-awning plank',()=>{const q=p.pos.clone().set(...SCHOOL_ROOF_PLANK[0]).add(p.pos.clone().set(0,.06,0));return l.rails.find((r:any)=>r.points[0].distanceTo(q)<.1);}),
    balancedTrial('Green downhill full grind',()=>l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...SCHOOL_MAIN_RAIL[0]))<.1)),
    balancedTrial('Green uphill full grind',()=>l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...SCHOOL_MAIN_RAIL[0]))<.1),false,true),
    ...SCHOOL_POOLS.map((pool,from):Trial=>({name:`Swim Team ${from+1}`,init:()=>{air=false;popped=false;exited=false;place([pool.centre[0],pool.bottom+.1,pool.centre[2]],[from===0?1:-1,0,0],18);},input:()=>{if(p.grounded&&p.rideNormal.y<.12)popped=true;return {moveY:1,jumpHeld:!popped};},done:()=>{air||=p.vertAir;exited||=air&&!p.vertAir;if(!exited||!p.grounded)return false;const target=SCHOOL_POOLS[1-from];if(p.pos.y>=-5.3||p.pos.y<target.bottom-.06||Math.abs(p.pos.x-target.centre[0])>=8||Math.abs(p.pos.z-target.centre[2])>=10)throw Error('Swim Team first landing missed basin');return true;}})),
    ...[-1,1].map((dir):Trial=>{const h=dn.map(v=>v*dir) as Point;return{name:`Ditch Slap ${dir}`,init:()=>{air=false;popped=false;place([ditchCross[0]-h[0]*(ditchHalf+5),-4.9,ditchCross[2]-h[2]*(ditchHalf+5)],h,18);},input:()=>{if((ditchCross[0]-p.pos.x)*h[0]+(ditchCross[2]-p.pos.z)*h[2]<ditchHalf+1)popped=true;return {jumpHeld:!popped};},done:()=>{air||=p.state==='air';if(!air||!p.grounded)return false;if((p.pos.x-ditchCross[0])*h[0]+(p.pos.z-ditchCross[2])*h[2]<=ditchHalf||Math.abs(p.pos.y+5)>.06)throw Error('Ditch Slap missed opposite bank');return true;}};}),
    {name:'Dumpster Rail Gap and rollout',init:()=>{dumpsterA=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(18,.55,28))<.1);dumpsterB=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(18,1.1,40.5))<.1);if(!dumpsterA||!dumpsterB)throw Error('Missing dumpster rails');dumpsterCaught=false;dumpsterRepress=false;popped=false;dumpsterAFrames=0;dumpsterBFrames=0;place([18,.1,26],[0,0,1],14);},input:()=>{if(dumpsterCaught&&p.pos.z>34.6)popped=true;if(popped&&p.pos.z>41.8)dumpsterRepress=true;return{grindHeld:!popped||dumpsterRepress,jumpHeld:dumpsterCaught&&!popped};},done:()=>{dumpsterCaught||=p.state==='grind'&&p.grindRail===dumpsterA;if(p.state==='grind'&&p.grindRail===dumpsterA)dumpsterAFrames++;if(popped&&p.state==='grind'&&p.grindRail===dumpsterB)dumpsterBFrames++;if(dumpsterBFrames<8||!p.grounded)return false;if(dumpsterAFrames<20||p.pos.z<=47||Math.abs(p.pos.y)>.06)throw Error('Dumpster transfer missed rollout');return true;}},
    {name:'Garbage Ollie',init:()=>{air=false;popped=false;overGarbage=false;place([18.2,.1,52.2],[1,0,0],12);},input:()=>{if(p.pos.x>18.6)popped=true;return {jumpHeld:!popped};},done:()=>{air||=p.state==='air';if(Math.abs(p.pos.x-23.3)<.4&&Math.abs(p.pos.z-52.2)<.3&&p.pos.y>.48)overGarbage=true;if(!air||!p.grounded)return false;if(!overGarbage||p.pos.x<=23.64||Math.abs(p.pos.y)>.06)throw Error('Garbage Ollie missed actual crate');return true;}},
    ...SCHOOL_LAWN_SIDE_RAILS.map((points,i)=>balancedTrial(`Stair-side curb ${i+1} full grind`,()=>l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...points[0]))<.1))),
    balancedTrial('Long Ass Rail full grind',()=>{const q=p.pos.clone().set(...SCHOOL_LONG_ASS_RAIL[0]);return l.rails.find((r:any)=>r.points[0].distanceTo(q)<.1);},true),
    balancedTrial('Huge Rail full grind',()=>{const q=p.pos.clone().set(...SCHOOL_HUGE_RAIL[0]).add(p.pos.clone().set(0,.05,0));return l.rails.find((r:any)=>r.points[0].distanceTo(q)<.3);}),
    balancedTrial('Playground Rail full grind',()=>{const q=p.pos.clone().set(...schoolMapPoint(352,78));q.y=-2.45;return l.rails.find((r:any)=>r.points[0].distanceTo(q)<.1);}),
    {name:'Perimeter Mini Gap and rollout',init:()=>{
      const {takeoff:a,receiver:b}=miniGapRails(l,p);if(!a||!b)throw Error('Mini Gap coping missing');const q=a.pointAt(a.totalLength-4).add(p.pos.clone().set(0,.3,0)),h=a.tangentAt(a.totalLength-4).setY(0).normalize();
      place(q.toArray(),h.toArray(),12);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';if(p.balanceBoostT||p.uberTimer)throw Error('Mini Gap has a balance assist');miniLine=createPerimeterMiniGap(p,a,b,CONST.fixedStep);report.perimeterMini=miniLine.report;
    },input:()=>miniLine.sample(),done:()=>miniLine.observe()},
    {name:'Roof Mini Gap and rollout',init:()=>{
      const a=p.pos.clone().set(...SCHOOL_ROOF_MINI_GAP.left).add(p.pos.clone().set(0,1.85,-1.8)),b=p.pos.clone().set(...SCHOOL_ROOF_MINI_GAP.right).add(p.pos.clone().set(0,1.85,-1.8));
      const ra=l.rails.find((r:any)=>r.points.at(-1).distanceTo(a)<.6&&r.totalLength>25),rb=l.rails.find((r:any)=>r.points[0].distanceTo(b)<.1);if(!ra||!rb)throw Error('Roof Mini Gap coping missing');
      const q=ra.pointAt(ra.totalLength-4).add(p.pos.clone().set(0,.3,0)),h=ra.tangentAt(ra.totalLength-4).setY(0).normalize();place(q.toArray(),h.toArray(),12);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';if(p.balanceBoostT)throw Error('Roof Mini Gap has a balance assist');
      roofMini=createRoofMiniGap(p,ra,rb,CONST.fixedStep);report.roofMini=roofMini.report;
    },input:()=>roofMini.sample(),done:()=>roofMini.observe()},
    ...schoolStreetTrials(l,p).map((c):Trial=>({name:c.name,limit:450,init:()=>{
      const h=p.axisF.clone().set(...c.heading).normalize(),q=p.pos.clone().set(...c.centre).addScaledVector(h,-(c.approach??5.5));q.y=-4.9;place(q.toArray(),h.toArray(),c.speed);
      if(p.balanceBoostT)throw Error('Street transfer has a balance assist');streetLine=createStreetTransfer(p,c,CONST.fixedStep);(report.streetTransfers??=[]).push({name:c.name,result:streetLine.report});
    },input:()=>streetLine.sample(),done:()=>streetLine.observe()})),
    {name:'Park Gap and rollout',limit:350,init:()=>{
      const {takeoff:a,receiver:b}=parkGapRails(l,p);if(!a||!b)throw Error('Park Gap coping missing');const q=a.pointAt(a.totalLength-4).add(p.pos.clone().set(0,.3,0)),h=a.tangentAt(a.totalLength-4).setY(0).normalize();place(q.toArray(),h.toArray(),12);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';
      if(p.balanceBoostT)throw Error('Park Gap has a balance assist');parkLine=createParkGap(p,a,b,CONST.fixedStep);report.parkGap=parkLine.report;
    },input:()=>parkLine.sample(),done:()=>parkLine.observe()},
    ...['Hall Pass','Upper planter chain','Lawn rail-to-rail','Classroom planter to Huge Rail'].map((name):Trial=>({name,limit:500,init:()=>{
      if(name==='Classroom planter to Huge Rail'){
        const {takeoff:a,receiver:b}=classroomTransferRails(l,p),h=a.tangentAt(.4).setY(0).normalize(),q=a.points[0].clone().addScaledVector(h,-3);q.y=-4.9;place(q.toArray(),h.toArray(),14);planterLine=createClassroomTransfer(p,a,b,CONST.fixedStep);
      }else if(name==='Hall Pass'){
        const {takeoff:a,receiver:b}=hallPassRails(l,p),h=a.tangentAt(.4).setY(0).normalize(),q=a.points[0].clone().addScaledVector(h,-4);q.y=.1;
        place(q.toArray(),h.toArray(),12);planterLine=createHallPass(p,a,b,CONST.fixedStep);
      }else if(name==='Upper planter chain'){
        const rails=upperPlanterRails(l,p),q=rails[0].points[0].clone().add(p.pos.clone().set(-3,-.5,0));place(q.toArray(),[1,0,0],12);planterLine=createUpperPlanterChain(p,rails,CONST.fixedStep);
      }else{
        const {takeoff:a,receiver:b}=lawnTransferRails(l,p),q=a.pointAt(a.totalLength-10).add(p.pos.clone().set(0,.3,0)),h=a.tangentAt(a.totalLength-10).setY(0).normalize();place(q.toArray(),h.toArray(),18);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';planterLine=createLawnTransfer(p,a,b,CONST.fixedStep);
      }
      if(p.balanceBoostT||p.uberTimer)throw Error('Planter transfer has a balance assist');(report.planterLines??=[]).push({name,result:planterLine.report});
    },input:()=>planterLine.sample(),done:()=>planterLine.observe()})),
    ...schoolDetailTrials(p,l,place,CONST.fixedStep).map((c):Trial=>({name:c.name,limit:c.limit,init:()=>{c.init();(report.details??=[]).push({name:c.name,kind:c.kind,result:c.result});},input:n=>c.sample(n),done:()=>c.observe()})),
    {name:'Continuous campus circuit',limit:2600,init:()=>{p.respawn(l,true);circuit=createSchoolCircuit(p);report.circuit=circuit.report;},input:()=>circuit.sample(),done:()=>circuit.observe()},
    {name:'Checkpoint and fall recovery',allowDeath:true,limit:900,init:()=>{banked=false;dead=false;const q=SCHOOL_CHECKPOINTS[1];place([q[0]-3,q[1]+.1,q[2]],[1,0,0],18);},input:()=>({moveY:banked?0:1,jumpHeld:!banked}),done:()=>{
      if(!banked&&l.activeCheckpoint===l.checkpoints[1]){banked=true;report.checkpointBanked=true;p.pos.set(110,-10,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-10;p.airFromSkate=true;p.airGrav='board';}
      dead||=p.state==='dead';report.fallObserved=dead;return dead&&p.state==='ride'&&p.grounded&&p.pos.distanceTo(l.checkpoints[1].spawnPos)<2;
    }},
  ];
  if(prefix)trials.splice(0,trials.length,...trials.filter(c=>c.name.startsWith(prefix)));
  const stop=(failure:string|null)=>{p.step=oldStep;input.pollGamepad=oldPoll;report.running=false;report.failure=failure;report.tuningUnchanged=report.tuningBefore===JSON.stringify(g.TUNING);delete report.tuningBefore;p.speed=0;};
  const next=()=>{frame=0;sample={};if(trialIndex>=trials.length){stop(null);return;}report.stage=trials[trialIndex].name;trials[trialIndex].init();};
  input.pollGamepad=()=>{
    const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;
    const held:any={0:sample.jumpHeld,1:sample.grabHeld,2:sample.spinHeld,3:sample.grindHeld};
    return{id:'School local validation',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:false,value:held[i]?1:0}))};
  };
  p.step=(dt:number,controls:any,level:any)=>{
    try{
      const trial=trials[trialIndex];sample=trial.input(frame);update();oldStep.call(p,dt,controls,level);frame++;report.frames++;
      if(p.isBailing&&!trial.allowDeath)throw Error(`${trial.name}: bail`);
      if(!p.pos.toArray().every(Number.isFinite))throw Error('Non-finite position');
      if(trial.done(frame)){report.passed.push({name:trial.name,frames:frame});trialIndex++;next();}
      else if(frame>(trial.limit??600))throw Error(`${trial.name}: timeout at ${p.pos.toArray()}`);
    }catch(e){stop(String(e));}
  };
  try{next();}catch(e){stop(String(e));}
  return report;
}
