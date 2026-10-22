import {SCHOOL_KICKER,SCHOOL_POOLS,SCHOOL_ROOF_ACCESS,SCHOOL_MAIN_RAIL,SCHOOL_CHECKPOINTS,SCHOOL_LONG_HALFPIPE,SCHOOL_ROOF_PLANK} from '../src/levels/school-miami';
type Point=[number,number,number];
type Trial={name:string;init:()=>void;input:(n:number)=>any;done:(n:number)=>boolean;limit?:number;allowDeath?:boolean};

/** Drives the real frame loop with ordinary controller samples. Placements
 * isolate each feature; motion within a case never edits position/velocity. */
export function runSchoolBrowserChecks(g:any){
  const p=g.player,l=g.getLevel(),input=g.input,oldStep=p.step,oldPoll=input.pollGamepad,update=input.update.bind(input);
  const report:any={running:true,stage:'',passed:[],failure:null,frames:0,tuningBefore:JSON.stringify(g.TUNING)};
  let sample:any={},frame=0,trialIndex=0,air=false,popped=false,waypoint=1,dead=false,banked=false;
  const place=(q:Point,h:Point,speed=12)=>{
    p.respawn(l,true,true,{position:p.pos.clone().set(...q),heading:p.axisF.clone().set(...h).normalize()});
    p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
    p.groundHit=p.queryGround(l);if(!p.groundHit)throw Error('Missing placement support');
    p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
  };
  const steer=(q:Point)=>{const a=Math.atan2(q[0]-p.pos.x,-(q[2]-p.pos.z)),b=Math.atan2(p.axisF.x,-p.axisF.z),d=Math.atan2(Math.sin(a-b),Math.cos(a-b));return Math.max(-1,Math.min(1,d*3));};
  const near=(q:Point,d=2.2)=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)<d;
  const pathTrial=(name:string,pts:Point[],charge=false,fullTurn=false):Trial=>({name,init:()=>{waypoint=1;place([pts[0][0],pts[0][1]+.1,pts[0][2]],[pts[1][0]-pts[0][0],0,pts[1][2]-pts[0][2]],charge?18:12);},
    input:()=>{while(waypoint<pts.length-1&&near(pts[waypoint],3))waypoint++;const turn=steer(pts[waypoint]);return {moveX:turn,moveY:fullTurn?Math.sqrt(1-turn*turn):1,jumpHeld:charge};},done:()=>waypoint===pts.length-1&&near(pts.at(-1)!)});
  const k=SCHOOL_KICKER,h=k.direction,run=k.gap/2+k.run+7;
  const trials:Trial[]=[
    {name:'Native canopy start',init:()=>{p.respawn(l,true);if(p.axisF.x<.99)throw Error('Native spawn faces off canopy');},input:()=>({moveY:1}),done:n=>{if(n<90)return false;if(p.pos.x<9||Math.abs(p.pos.z)>.1||Math.abs(p.pos.y-3.4)>.06)throw Error('Native start left canopy');return true;}},
    pathTrial('Downhill approach',[[44,0,-4],[43,0,-8],[41,-2,-22],[39,-5,-36],[37,-5,-39]]),
    {name:'Kicker Gap',init:()=>{air=false;popped=false;place([k.x-h[0]*run,-4.9,k.z-h[2]*run],h,18);},input:()=>{if(!popped&&(k.x-p.pos.x)*h[0]+(k.z-p.pos.z)*h[2]<k.gap/2+.9)popped=true;return {jumpHeld:!popped};},done:()=>{air||=p.state==='air';return air&&p.grounded&&(p.pos.x-k.x)*h[0]+(p.pos.z-k.z)*h[2]>k.gap/2;}},
    ...SCHOOL_POOLS.map((pool):Trial=>({name:`${pool.name} vert return`,init:()=>{air=false;place([pool.centre[0],pool.bottom+.1,pool.centre[2]],[1,0,0],16);},input:()=>({jumpHeld:true}),done:()=>{air||=p.vertAir;return air&&p.grounded;}})),
    pathTrial('Roof service hill',SCHOOL_ROOF_ACCESS.filter((_,i,a)=>i%7===0||i===a.length-1),true),
    pathTrial('Winding halfpipe',SCHOOL_LONG_HALFPIPE,false,true),
    pathTrial('Gym doorway',[[31,0,9],[31,0,19],[38,0,25],[48.5,0,32],[48.5,0,42]]),
    {name:'Air-conditioner roof gap',init:()=>{air=false;popped=false;place([70,7.1,27.5],[-1,0,0],18);},input:()=>{if(p.pos.x<61)popped=true;return{jumpHeld:!popped};},done:()=>{air||=p.state==='air';return air&&p.grounded&&p.pos.x<49.7;}},
    {name:'Roof-to-awning plank',init:()=>{air=false;const r=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...SCHOOL_ROOF_PLANK[0]).add(p.pos.clone().set(0,.06,0)))<.1),q=r.pointAt(.4).add(p.pos.clone().set(0,.3,0)),h=r.tangentAt(.4).setY(0).normalize();place(q.toArray(),h.toArray(),14);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';p.balanceBoostT=10;},input:()=>({grindHeld:true}),done:()=>{air||=p.state==='grind';return air&&p.state==='ride'&&p.grounded&&Math.abs(p.pos.y-3.4)<.08;}},
    {name:'Green downhill grind',init:()=>{const rail=l.rails.find((r:any)=>r.points[0].distanceTo(p.pos.clone().set(...SCHOOL_MAIN_RAIL[0]))<.1),t=rail.totalLength*.2,q=rail.pointAt(t).add(p.pos.clone().set(0,.3,0)),h=rail.tangentAt(t).setY(0).normalize();place(q.toArray(),h.toArray(),14);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';p.balanceBoostT=10;},input:()=>({grindHeld:true}),done:n=>{if(n>2&&p.state!=='grind')throw Error('Rail catch interrupted');return n>=45;}},
    {name:'Checkpoint and fall recovery',allowDeath:true,limit:900,init:()=>{banked=false;dead=false;const q=SCHOOL_CHECKPOINTS[1];place([q[0]-3,q[1]+.1,q[2]],[1,0,0],18);},input:()=>({moveY:banked?0:1,jumpHeld:!banked}),done:()=>{
      if(!banked&&l.activeCheckpoint===l.checkpoints[1]){banked=true;report.checkpointBanked=true;p.pos.set(110,-10,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-10;p.airFromSkate=true;p.airGrav='board';}
      dead||=p.state==='dead';report.fallObserved=dead;return dead&&p.state==='ride'&&p.grounded&&p.pos.distanceTo(l.checkpoints[1].spawnPos)<2;
    }},
  ];
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
